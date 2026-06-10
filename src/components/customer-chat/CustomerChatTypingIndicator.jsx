import React from "react";

/** אינדיקטור "מקליד…" בסגנון ווטסאפ */
export default function CustomerChatTypingIndicator() {
  return (
    <div className="flex justify-end" aria-live="polite" aria-label="הבוט מקליד">
      <div className="customer-chat-bubble customer-chat-bubble--staff customer-chat-typing max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3">
        <span className="customer-chat-bubble__badge">בוט</span>
        <div className="customer-chat-typing__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
