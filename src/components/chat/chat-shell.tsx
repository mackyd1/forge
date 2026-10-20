"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/chat/stream";
import type { ChatMessage } from "@/lib/chat/types";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

function newId() {
  return crypto.randomUUID();
}

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = streamingId !== null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingId]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;

    setError(null);
    setDraft("");

    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content,
    };
    const assistantId = newId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, assistantMessage]);
    setStreamingId(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        nextMessages.map(({ role, content: c }) => ({ role, content: c })),
        (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + delta }
                : m,
            ),
          );
        },
        controller.signal,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) =>
        prev.filter((m) => m.id !== assistantId || m.content.length > 0),
      );
    } finally {
      setStreamingId(null);
      abortRef.current = null;
    }
  }

  return (
    <div className="chat-shell">
      <header className="chat-masthead">
        <div className="masthead-copy">
          <p className="brand">Forge</p>
          <h1 className="headline">Heat the steel. Shape the answer.</h1>
          <p className="lede">
            Engineering chat grounded in your codebase — built the way real
            tools are built.
          </p>
        </div>
        <div className="masthead-meta" aria-hidden>
          <span>m1 · stream</span>
          <span>stub model</span>
        </div>
      </header>

      <section className="chat-stage" aria-label="Conversation">
        <div className="chat-scroll">
          <MessageList messages={messages} streamingId={streamingId} />
          <div ref={bottomRef} />
        </div>

        <div className="chat-dock">
          {error ? <p className="chat-error">{error}</p> : null}
          <Composer
            value={draft}
            disabled={busy}
            onChange={setDraft}
            onSubmit={send}
          />
          <p className="chat-hint">
            Enter to send · Shift+Enter for a new line · Milestone 1 streams a
            stub reply from <code>/api/chat</code>
          </p>
        </div>
      </section>
    </div>
  );
}
