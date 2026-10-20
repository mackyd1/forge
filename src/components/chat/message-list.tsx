"use client";

import type { ChatMessage } from "@/lib/chat/types";

type MessageListProps = {
  messages: ChatMessage[];
  streamingId: string | null;
};

export function MessageList({ messages, streamingId }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-kicker">Workspace</p>
        <p className="empty-title">No thread yet.</p>
        <p className="empty-copy">
          Ask an engineering question — architecture, debugging, TypeScript,
          APIs. Replies stream from Gemini (Google AI Studio). Repo grounding
          lands in Milestone 3.
        </p>
      </div>
    );
  }

  return (
    <ul className="message-list" aria-live="polite">
      {messages.map((message) => {
        const isStreaming = message.id === streamingId;
        return (
          <li
            key={message.id}
            className={`message message-${message.role}`}
            data-streaming={isStreaming ? "true" : undefined}
          >
            <span className="message-role">
              {message.role === "user" ? "You" : "Forge"}
            </span>
            <div className="message-body">
              {message.content || (isStreaming ? "" : "…")}
              {isStreaming ? <span className="stream-caret" aria-hidden /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
