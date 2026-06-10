import { useCallback, useEffect, useRef, useState } from "react";
import {
  getIntroDeliveryIndex,
  isAfterMerchantBotFlowComplete,
  isIntroBotFlowComplete,
  runGuestBotAfterMerchantFlow,
  runGuestBotIntroFlow,
} from "@/lib/customerChatBotFlow";
import { subscribeCustomerChatStore } from "@/lib/customerChatStore";

export function useGuestBotConversation(session) {
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [storeTick, setStoreTick] = useState(0);
  const introRunningRef = useRef(false);
  const afterMerchantRunningRef = useRef(false);

  const sessionId = session?.id;
  const merchantRef = session?.merchant_ref;
  const introIndex = sessionId ? getIntroDeliveryIndex(sessionId) : 0;
  const introComplete = sessionId ? isIntroBotFlowComplete(sessionId) : true;
  const afterMerchantComplete = sessionId ? isAfterMerchantBotFlowComplete(sessionId) : true;

  useEffect(() => subscribeCustomerChatStore(() => setStoreTick((n) => n + 1)), []);

  const stopTyping = useCallback(() => setIsBotTyping(false), []);

  useEffect(() => {
    if (!sessionId || session.status === "closed" || introComplete) return undefined;
    if (introRunningRef.current) return undefined;

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
  }, [sessionId, session?.status, introComplete, introIndex, storeTick, stopTyping]);

  useEffect(() => {
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
    sessionId,
    merchantRef,
    session?.status,
    introComplete,
    afterMerchantComplete,
    storeTick,
    stopTyping,
  ]);

  return { isBotTyping };
}
