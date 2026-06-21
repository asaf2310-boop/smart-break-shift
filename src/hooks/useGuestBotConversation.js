import { useCallback, useEffect, useRef, useState } from "react";
import { isCustomerChatBotFlowEnabled } from "@/lib/customerChatBotFlowConfig";
import {
  getIntroDeliveryIndex,
  isAfterMerchantBotFlowComplete,
  isIntroBotFlowComplete,
  runGuestBotAfterMerchantFlow,
  runGuestBotIntroFlow,
} from "@/lib/customerChatBotFlow";
import {
  getPendingFlowChoices,
  handleGuestFlowInput,
  isFlowBotComplete,
  isFlowWaitingForGuestInput,
  runGuestBotFlow,
} from "@/lib/customerChatBotFlowRuntime";
import { listMessages, subscribeCustomerChatStore } from "@/lib/customerChatStore";

export function useGuestBotConversation(session) {
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [storeTick, setStoreTick] = useState(0);
  const introRunningRef = useRef(false);
  const afterMerchantRunningRef = useRef(false);
  const flowRunningRef = useRef(false);
  const lastGuestCountRef = useRef(0);

  const sessionId = session?.id;
  const merchantRef = session?.merchant_ref;
  const flowEnabled = isCustomerChatBotFlowEnabled();

  const introIndex = sessionId ? getIntroDeliveryIndex(sessionId) : 0;
  const introComplete = sessionId
    ? flowEnabled
      ? isFlowBotComplete(sessionId)
      : isIntroBotFlowComplete(sessionId)
    : true;
  const afterMerchantComplete = sessionId ? isAfterMerchantBotFlowComplete(sessionId) : true;

  const pendingChoices = sessionId && flowEnabled ? getPendingFlowChoices(sessionId) : null;
  const waitingForInput = sessionId && flowEnabled ? isFlowWaitingForGuestInput(sessionId) : false;

  useEffect(() => subscribeCustomerChatStore(() => setStoreTick((n) => n + 1)), []);

  const stopTyping = useCallback(() => setIsBotTyping(false), []);

  useEffect(() => {
    if (!sessionId || session.status === "closed") return undefined;

    if (flowEnabled) {
      if (introComplete || flowRunningRef.current) return undefined;

      const controller = new AbortController();
      flowRunningRef.current = true;

      runGuestBotFlow(sessionId, {
        onTypingChange: setIsBotTyping,
        signal: controller.signal,
      }).finally(() => {
        flowRunningRef.current = false;
        setIsBotTyping(false);
      });

      return () => {
        controller.abort();
        flowRunningRef.current = false;
        stopTyping();
      };
    }

    if (introComplete || introRunningRef.current) return undefined;

    const controller = new AbortController();
    introRunningRef.current = true;

    runGuestBotIntroFlow(sessionId, {
      onTypingChange: setIsBotTyping,
      signal: controller.signal,
    }).finally(() => {
      introRunningRef.current = false;
      setIsBotTyping(false);
    });

    return () => {
      controller.abort();
      introRunningRef.current = false;
      stopTyping();
    };
  }, [sessionId, session?.status, introComplete, introIndex, storeTick, stopTyping, flowEnabled]);

  useEffect(() => {
    if (!flowEnabled || !sessionId || session.status === "closed") return undefined;
    if (introComplete) return undefined;

    const guestCount = listMessages(sessionId).filter((m) => m.sender_type === "guest").length;
    if (guestCount <= lastGuestCountRef.current) {
      lastGuestCountRef.current = guestCount;
      return undefined;
    }
    lastGuestCountRef.current = guestCount;

    if (!waitingForInput && !pendingChoices) return undefined;
    if (flowRunningRef.current) return undefined;

    const controller = new AbortController();
    flowRunningRef.current = true;

    handleGuestFlowInput(sessionId, {
      onTypingChange: setIsBotTyping,
      signal: controller.signal,
    }).finally(() => {
      flowRunningRef.current = false;
      setIsBotTyping(false);
    });

    return () => {
      controller.abort();
      flowRunningRef.current = false;
      stopTyping();
    };
  }, [
    flowEnabled,
    sessionId,
    session?.status,
    introComplete,
    storeTick,
    waitingForInput,
    pendingChoices,
    stopTyping,
  ]);

  useEffect(() => {
    if (flowEnabled) return undefined;
    if (!sessionId || !merchantRef || session.status === "closed") return undefined;
    if (!introComplete || afterMerchantComplete) return undefined;
    if (afterMerchantRunningRef.current) return undefined;

    const controller = new AbortController();
    afterMerchantRunningRef.current = true;

    runGuestBotAfterMerchantFlow(sessionId, {
      onTypingChange: setIsBotTyping,
      signal: controller.signal,
    }).finally(() => {
      afterMerchantRunningRef.current = false;
      setIsBotTyping(false);
    });

    return () => {
      controller.abort();
      afterMerchantRunningRef.current = false;
      stopTyping();
    };
  }, [
    flowEnabled,
    sessionId,
    merchantRef,
    session?.status,
    introComplete,
    afterMerchantComplete,
    storeTick,
    stopTyping,
  ]);

  return { isBotTyping, pendingChoices, flowEnabled };
}
