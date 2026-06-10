import {
  getBotAfterMerchantMessages,
  getBotIntroMessages,
} from "@/lib/customerChatBotConfig";
import {
  appendBotMessage,
  appendGuestJoinedSystemMessage,
  listBotMessages,
} from "@/lib/customerChatStore";

export function typingDelayMs(text) {
  const len = String(text || "").length;
  return Math.min(3200, Math.max(900, 500 + len * 40));
}

export function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function matchedPrefix(deliveredBodies, queue) {
  let matched = 0;
  for (let i = 0; i < queue.length && i < deliveredBodies.length; i++) {
    if (deliveredBodies[i] === queue[i]) matched++;
    else break;
  }
  return matched;
}

export function getIntroDeliveryIndex(sessionId) {
  const delivered = listBotMessages(sessionId).map((m) => m.body);
  return matchedPrefix(delivered, getBotIntroMessages());
}

export function getAfterMerchantDeliveryIndex(sessionId) {
  const intro = getBotIntroMessages();
  const after = getBotAfterMerchantMessages();
  const allBot = listBotMessages(sessionId).map((m) => m.body);
  const afterDelivered = allBot.slice(intro.length);
  return matchedPrefix(afterDelivered, after);
}

export function isIntroBotFlowComplete(sessionId) {
  return getIntroDeliveryIndex(sessionId) >= getBotIntroMessages().length;
}

export function isAfterMerchantBotFlowComplete(sessionId) {
  return getAfterMerchantDeliveryIndex(sessionId) >= getBotAfterMerchantMessages().length;
}

export async function deliverBotMessages({
  sessionId,
  queue,
  startIndex,
  onTypingChange,
  signal,
}) {
  for (let i = startIndex; i < queue.length; i++) {
    if (signal?.aborted) return;
    const body = queue[i];
    onTypingChange?.(true);
    await sleep(typingDelayMs(body));
    if (signal?.aborted) {
      onTypingChange?.(false);
      return;
    }
    onTypingChange?.(false);
    appendBotMessage(sessionId, body);
    if (i < queue.length - 1) {
      await sleep(400);
    }
  }
}

export async function runGuestBotIntroFlow(sessionId, { onTypingChange, signal } = {}) {
  const queue = getBotIntroMessages();
  const startIndex = getIntroDeliveryIndex(sessionId);
  if (startIndex >= queue.length) return;
  if (startIndex === 0) {
    await sleep(500);
    if (signal?.aborted) return;
  }
  await deliverBotMessages({ sessionId, queue, startIndex, onTypingChange, signal });
  if (!signal?.aborted && isIntroBotFlowComplete(sessionId)) {
    appendGuestJoinedSystemMessage(sessionId);
  }
}

export async function runGuestBotAfterMerchantFlow(sessionId, { onTypingChange, signal } = {}) {
  const queue = getBotAfterMerchantMessages();
  const startIndex = getAfterMerchantDeliveryIndex(sessionId);
  if (startIndex >= queue.length) return;
  await deliverBotMessages({ sessionId, queue, startIndex, onTypingChange, signal });
}
