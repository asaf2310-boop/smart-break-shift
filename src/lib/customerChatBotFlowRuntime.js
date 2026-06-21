import {
  getCustomerChatBotFlow,
  getFlowStepById,
  isCustomerChatBotFlowEnabled,
} from "@/lib/customerChatBotFlowConfig";
import { deliverBotMessages, sleep, typingDelayMs } from "@/lib/customerChatBotFlow";
import {
  appendBotMessage,
  appendGuestJoinedSystemMessage,
  getSessionById,
  listMessages,
} from "@/lib/customerChatStore";

export const CUSTOMER_CHAT_BOT_FLOW_STATE_KEY = "smart-break-shift-customer-chat-bot-flow-state-v1";

const FLOW_PHASE = {
  idle: "idle",
  running: "running",
  waiting_input: "waiting_input",
  waiting_choice: "waiting_choice",
  complete: "complete",
};

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
  if (!step || step.type !== "choice") return null;

  return {
    stepId: step.id,
    prompt: step.prompt,
    options: step.options || [],
  };
}

export function isFlowWaitingForGuestInput(sessionId) {
  if (!isCustomerChatBotFlowEnabled()) return false;
  const state = getSessionState(sessionId);
  return state?.phase === FLOW_PHASE.waiting_input;
}

export async function handleGuestFlowInput(sessionId, { onTypingChange, signal } = {}) {
  if (!isCustomerChatBotFlowEnabled()) return;
  const state = getSessionState(sessionId);
  if (!state) return;

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
        setSessionState(sessionId, {
          phase: FLOW_PHASE.waiting_choice,
          pendingChoiceStepId: step.id,
          currentStepId: step.id,
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
