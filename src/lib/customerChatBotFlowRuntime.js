import {
  getCustomerChatBotFlow,
  getFlowStepById,
  isCustomerChatBotFlowEnabled,
} from "@/lib/customerChatBotFlowConfig";
import { deliverBotMessages, sleep, typingDelayMs } from "@/lib/customerChatBotFlow";
import { validateFlowInput } from "@/lib/customerChatBotFlowValidation";
import {
  appendBotMessage,
  appendGuestJoinedSystemMessage,
  applyFlowInputCapture,
  getLastGuestMessageWithMeta,
  getSessionById,
  listMessages,
  tryLinkSessionToCrmCustomer,
} from "@/lib/customerChatStore";

export const CUSTOMER_CHAT_BOT_FLOW_STATE_KEY = "smart-break-shift-customer-chat-bot-flow-state-v1";

const FLOW_PHASE = {
  idle: "idle",
  running: "running",
  waiting_input: "waiting_input",
  waiting_choice: "waiting_choice",
  waiting_text_input: "waiting_text_input",
  complete: "complete",
};

function isTextInputMode(step) {
  return step?.inputMode === "text" || step?.inputMode === "freeText";
}

function readStateStore() {
  try {
    const raw = localStorage.getItem(CUSTOMER_CHAT_BOT_FLOW_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) return parsed;
    }
  } catch {
    // ignore
  }
  return { version: 1, sessions: {} };
}

function writeStateStore(store) {
  localStorage.setItem(CUSTOMER_CHAT_BOT_FLOW_STATE_KEY, JSON.stringify(store));
}

function getSessionState(sessionId) {
  const store = readStateStore();
  return store.sessions[sessionId] || null;
}

function setSessionState(sessionId, patch) {
  const store = readStateStore();
  const prev = store.sessions[sessionId] || {
    sessionId,
    currentStepId: null,
    phase: FLOW_PHASE.idle,
    pendingChoiceStepId: null,
    pendingTextInputStepId: null,
    retryCount: 0,
    stepHistory: [],
    lastProcessedGuestMessageId: null,
    executedStepIds: [],
  };
  store.sessions[sessionId] = { ...prev, ...patch };
  writeStateStore(store);
  return store.sessions[sessionId];
}

function getLastGuestMessage(sessionId) {
  const messages = listMessages(sessionId);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_type === "guest") return messages[i].body;
  }
  return "";
}

function pushStepHistory(state, stepId) {
  if (!stepId) return state.stepHistory || [];
  const history = state.stepHistory || [];
  if (history[history.length - 1] === stepId) return history;
  return [...history, stepId];
}

function evaluateCondition(step, sessionId) {
  const session = getSessionById(sessionId);
  if (!session) return null;

  if (step.variable === "merchant_ref_set") {
    return Boolean(String(session.merchant_ref || "").trim());
  }

  if (step.variable === "guest_message_contains") {
    const needle = String(step.value || "").trim();
    if (!needle) return null;
    const haystack = getLastGuestMessage(sessionId);
    return haystack.includes(needle);
  }

  return null;
}

function markExecuted(sessionId, stepId, state) {
  const executed = state.executedStepIds.includes(stepId)
    ? state.executedStepIds
    : [...state.executedStepIds, stepId];
  return { ...state, executedStepIds: executed };
}

function unmarkExecuted(state, stepId) {
  return {
    ...state,
    executedStepIds: (state.executedStepIds || []).filter((id) => id !== stepId),
  };
}

async function deliverSingleMessage(sessionId, body, { onTypingChange, signal }) {
  onTypingChange?.(true);
  await sleep(typingDelayMs(body));
  if (signal?.aborted) {
    onTypingChange?.(false);
    return false;
  }
  onTypingChange?.(false);
  appendBotMessage(sessionId, body);
  return true;
}

async function goBackOneStep(sessionId, currentStepId, state, { onTypingChange, signal } = {}) {
  const history = [...(state.stepHistory || [])];
  let prevStepId = history.pop();

  while (prevStepId === currentStepId && history.length) {
    prevStepId = history.pop();
  }

  if (!prevStepId) {
    setSessionState(sessionId, {
      phase: FLOW_PHASE.complete,
      currentStepId: null,
      pendingTextInputStepId: null,
      pendingChoiceStepId: null,
      retryCount: 0,
    });
    return;
  }

  let nextState = setSessionState(sessionId, {
    stepHistory: history,
    currentStepId: prevStepId,
    phase: FLOW_PHASE.running,
    pendingTextInputStepId: null,
    pendingChoiceStepId: null,
    retryCount: 0,
    lastProcessedGuestMessageId: null,
  });
  nextState = setSessionState(sessionId, unmarkExecuted(nextState, prevStepId));
  nextState = setSessionState(sessionId, unmarkExecuted(nextState, currentStepId));

  await runGuestBotFlow(sessionId, { onTypingChange, signal });
}

async function handleInvalidInput(sessionId, step, state, { onTypingChange, signal } = {}) {
  const invalidMsg = String(step.invalidMessage || "הקלט שהזנת אינו תקין. נסה/י שוב.").trim();
  const retryCount = (state.retryCount || 0) + 1;
  const maxRetries = Number.isFinite(step.maxRetries) ? step.maxRetries : 3;
  const shouldGoBack =
    step.onInvalid === "goBack" || (step.onInvalid === "retry" && retryCount > maxRetries);

  if (invalidMsg) {
    const ok = await deliverSingleMessage(sessionId, invalidMsg, { onTypingChange, signal });
    if (!ok) return;
  }

  if (shouldGoBack) {
    await goBackOneStep(sessionId, step.id, { ...state, retryCount }, { onTypingChange, signal });
    return;
  }

  setSessionState(sessionId, {
    retryCount,
    phase: FLOW_PHASE.waiting_text_input,
    pendingTextInputStepId: step.id,
    currentStepId: step.id,
    lastProcessedGuestMessageId: null,
  });
}

export function isFlowBotComplete(sessionId) {
  if (!isCustomerChatBotFlowEnabled()) return false;
  const state = getSessionState(sessionId);
  return state?.phase === FLOW_PHASE.complete;
}

export function getPendingFlowChoices(sessionId) {
  if (!isCustomerChatBotFlowEnabled()) return null;
  const state = getSessionState(sessionId);
  if (state?.phase !== FLOW_PHASE.waiting_choice || !state.pendingChoiceStepId) return null;

  const flow = getCustomerChatBotFlow();
  const step = getFlowStepById(flow, state.pendingChoiceStepId);
  if (!step || step.type !== "choice" || isTextInputMode(step)) return null;

  return {
    stepId: step.id,
    prompt: step.prompt,
    options: step.options || [],
  };
}

export function getPendingFlowTextInput(sessionId) {
  if (!isCustomerChatBotFlowEnabled()) return null;
  const state = getSessionState(sessionId);
  if (state?.phase !== FLOW_PHASE.waiting_text_input || !state.pendingTextInputStepId) return null;

  const flow = getCustomerChatBotFlow();
  const step = getFlowStepById(flow, state.pendingTextInputStepId);
  if (!step || step.type !== "choice" || !isTextInputMode(step)) return null;

  return {
    stepId: step.id,
    prompt: step.prompt,
    inputMode: step.inputMode,
    validationType: step.validationType,
    allowImageAttachment: Boolean(step.allowImageAttachment),
    retryCount: state.retryCount || 0,
    maxRetries: step.maxRetries ?? 3,
  };
}

export function isFlowWaitingForGuestInput(sessionId) {
  if (!isCustomerChatBotFlowEnabled()) return false;
  const state = getSessionState(sessionId);
  return (
    state?.phase === FLOW_PHASE.waiting_input || state?.phase === FLOW_PHASE.waiting_text_input
  );
}

async function processTextInputStep(sessionId, step, state, guestMeta, { onTypingChange, signal } = {}) {
  const text = String(guestMeta?.body || "").trim();
  const hasImage = Boolean(guestMeta?.image_url);
  const needsText = (step.validationType || "none") !== "none" || !step.allowImageAttachment;

  if (needsText && !text) {
    await handleInvalidInput(sessionId, step, state, { onTypingChange, signal });
    return;
  }

  if (text && !validateFlowInput(text, step)) {
    await handleInvalidInput(sessionId, step, { ...state, retryCount: state.retryCount || 0 }, {
      onTypingChange,
      signal,
    });
    return;
  }

  if (!text && !hasImage) {
    await handleInvalidInput(sessionId, step, state, { onTypingChange, signal });
    return;
  }

  if (text) {
    applyFlowInputCapture(sessionId, step, text);
    tryLinkSessionToCrmCustomer(sessionId);
  }

  const nextStepId = step.nextStepId || step.fallbackNextStepId;
  setSessionState(sessionId, {
    phase: FLOW_PHASE.running,
    pendingTextInputStepId: null,
    currentStepId: nextStepId,
    retryCount: 0,
    lastProcessedGuestMessageId: guestMeta?.id || null,
  });

  await runGuestBotFlow(sessionId, { onTypingChange, signal });
}

export async function handleGuestFlowInput(sessionId, { onTypingChange, signal } = {}) {
  if (!isCustomerChatBotFlowEnabled()) return;
  const state = getSessionState(sessionId);
  if (!state) return;

  if (state.phase === FLOW_PHASE.waiting_text_input) {
    const flow = getCustomerChatBotFlow();
    const step = getFlowStepById(flow, state.pendingTextInputStepId);
    if (!step || step.type !== "choice") return;

    const guestMeta = getLastGuestMessageWithMeta(sessionId);
    if (!guestMeta?.id || guestMeta.id === state.lastProcessedGuestMessageId) return;

    await processTextInputStep(sessionId, step, state, guestMeta, { onTypingChange, signal });
    return;
  }

  if (state.phase === FLOW_PHASE.waiting_choice) {
    const flow = getCustomerChatBotFlow();
    const step = getFlowStepById(flow, state.pendingChoiceStepId);
    if (!step || step.type !== "choice") return;

    const guestMsg = getLastGuestMessage(sessionId).trim();
    const matched = (step.options || []).find(
      (o) => o.label === guestMsg || (guestMsg && guestMsg.includes(o.label))
    );
    if (matched) {
      await handleGuestFlowChoice(sessionId, matched.id, { onTypingChange, signal });
      return;
    }
    if (step.fallbackNextStepId) {
      setSessionState(sessionId, {
        phase: FLOW_PHASE.running,
        pendingChoiceStepId: null,
        currentStepId: step.fallbackNextStepId,
        stepHistory: pushStepHistory(state, step.id),
      });
      await runGuestBotFlow(sessionId, { onTypingChange, signal });
    }
    return;
  }

  if (state.phase !== FLOW_PHASE.waiting_input) return;
  await runGuestBotFlow(sessionId, { onTypingChange, signal });
}

/**
 * Integration point: advance flow after guest taps a quick-reply button.
 */
export async function handleGuestFlowChoice(sessionId, optionId, { onTypingChange, signal } = {}) {
  if (!isCustomerChatBotFlowEnabled()) return;
  const state = getSessionState(sessionId);
  if (!state || state.phase !== FLOW_PHASE.waiting_choice) return;

  const flow = getCustomerChatBotFlow();
  const step = getFlowStepById(flow, state.pendingChoiceStepId);
  if (!step || step.type !== "choice") return;

  const option = (step.options || []).find((o) => o.id === optionId);
  const nextStepId = option?.nextStepId || step.fallbackNextStepId;

  setSessionState(sessionId, {
    phase: FLOW_PHASE.running,
    pendingChoiceStepId: null,
    currentStepId: nextStepId,
    stepHistory: pushStepHistory(state, step.id),
    retryCount: 0,
  });

  if (option?.label) {
    await deliverSingleMessage(sessionId, option.label, { onTypingChange, signal });
  }

  await runGuestBotFlow(sessionId, { onTypingChange, signal });
}

/**
 * Main flow executor — runs auto-advancing steps until wait or complete.
 * When flow.enabled is false, this is a no-op (legacy phase messages apply).
 */
export async function runGuestBotFlow(sessionId, { onTypingChange, signal } = {}) {
  if (!isCustomerChatBotFlowEnabled()) return;

  const flow = getCustomerChatBotFlow();
  if (!flow.entryStepId || !flow.steps.length) return;

  let state = getSessionState(sessionId);
  if (state?.phase === FLOW_PHASE.complete) return;

  if (!state || state.phase === FLOW_PHASE.idle) {
    state = setSessionState(sessionId, {
      currentStepId: flow.entryStepId,
      phase: FLOW_PHASE.running,
      pendingChoiceStepId: null,
      pendingTextInputStepId: null,
      retryCount: 0,
      stepHistory: [],
      lastProcessedGuestMessageId: null,
      executedStepIds: [],
    });
  }

  let stepId = state.currentStepId || flow.entryStepId;
  let safety = 0;

  while (stepId && safety < 30) {
    if (signal?.aborted) return;
    safety += 1;

    const step = getFlowStepById(flow, stepId);
    if (!step) {
      setSessionState(sessionId, { phase: FLOW_PHASE.complete, currentStepId: null });
      return;
    }

    state = getSessionState(sessionId);
    if (state?.phase === FLOW_PHASE.complete) return;

    switch (step.type) {
      case "start": {
        state = setSessionState(sessionId, {
          ...markExecuted(sessionId, step.id, state),
          currentStepId: step.nextStepId,
          phase: FLOW_PHASE.running,
          stepHistory: pushStepHistory(state, step.id),
        });
        stepId = step.nextStepId;
        break;
      }

      case "message": {
        if (!state.executedStepIds.includes(step.id)) {
          const body = String(step.body || "").trim();
          if (body) {
            const ok = await deliverSingleMessage(sessionId, body, { onTypingChange, signal });
            if (!ok) return;
            await sleep(400);
          }
          state = setSessionState(sessionId, markExecuted(sessionId, step.id, state));
        }
        state = setSessionState(sessionId, {
          currentStepId: step.nextStepId,
          phase: FLOW_PHASE.running,
          stepHistory: pushStepHistory(state, step.id),
        });
        stepId = step.nextStepId;
        break;
      }

      case "choice": {
        const prompt = String(step.prompt || "").trim();
        if (!state.executedStepIds.includes(step.id) && prompt) {
          const ok = await deliverSingleMessage(sessionId, prompt, { onTypingChange, signal });
          if (!ok) return;
          state = setSessionState(sessionId, markExecuted(sessionId, step.id, state));
        }

        if (isTextInputMode(step)) {
          setSessionState(sessionId, {
            phase: FLOW_PHASE.waiting_text_input,
            pendingTextInputStepId: step.id,
            currentStepId: step.id,
            retryCount: 0,
            stepHistory: pushStepHistory(state, step.id),
          });
          return;
        }

        setSessionState(sessionId, {
          phase: FLOW_PHASE.waiting_choice,
          pendingChoiceStepId: step.id,
          currentStepId: step.id,
          stepHistory: pushStepHistory(state, step.id),
        });
        return;
      }

      case "condition": {
        const result = evaluateCondition(step, sessionId);
        if (result === null) {
          setSessionState(sessionId, {
            phase: FLOW_PHASE.waiting_input,
            currentStepId: step.id,
          });
          return;
        }
        const branchId = result ? step.nextStepIdWhenTrue : step.nextStepIdWhenFalse;
        if (!branchId) {
          setSessionState(sessionId, {
            phase: FLOW_PHASE.waiting_input,
            currentStepId: step.id,
          });
          return;
        }
        state = setSessionState(sessionId, {
          ...markExecuted(sessionId, step.id, state),
          currentStepId: branchId,
          phase: FLOW_PHASE.running,
          stepHistory: pushStepHistory(state, step.id),
        });
        stepId = branchId;
        break;
      }

      case "transfer": {
        const handoff = String(step.handoffMessage || "").trim();
        if (handoff && !state.executedStepIds.includes(step.id)) {
          const ok = await deliverSingleMessage(sessionId, handoff, { onTypingChange, signal });
          if (!ok) return;
          state = setSessionState(sessionId, markExecuted(sessionId, step.id, state));
        }
        appendGuestJoinedSystemMessage(sessionId);
        setSessionState(sessionId, {
          phase: FLOW_PHASE.complete,
          currentStepId: step.nextStepId || null,
        });
        return;
      }

      case "end": {
        setSessionState(sessionId, {
          phase: FLOW_PHASE.complete,
          currentStepId: null,
        });
        return;
      }

      default:
        setSessionState(sessionId, { phase: FLOW_PHASE.complete });
        return;
    }
  }
}

/** @deprecated retained for tests — batch delivery helper */
export { deliverBotMessages };
