"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/chat/stream";
import type { ChatMessage } from "@/lib/chat/types";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

type IndexStatus = {
  ready: boolean;
  files: number;
  chunks: number;
};

function newId() {
  return crypto.randomUUID();
}

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [indexing, setIndexing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = streamingId !== null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingId]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/index")
      .then(async (response) => {
        const body = (await response.json()) as IndexStatus & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not read index");
        return body;
      })
      .then((status) => {
        if (!cancelled) setIndexStatus(status);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not read index");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reindex() {
    if (indexing || busy) return;
    setIndexing(true);
    setError(null);
    try {
      const response = await fetch("/api/index", { method: "POST" });
      const body = (await response.json()) as IndexStatus & { error?: string };
      if (!response.ok) throw new Error(body.error || "Indexing failed");
      setIndexStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setIndexing(false);
    }
  }

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
        (sources) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, sources } : message,
            ),
          );
        },
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
        <div className="index-rail">
          <p>
            {indexing
              ? "Reading the repo…"
              : indexStatus === null
                ? "Checking index…"
                : indexStatus.ready
                  ? `${indexStatus.files} files · ${indexStatus.chunks} chunks`
                  : "Repo not indexed"}
          </p>
          <button
            type="button"
            onClick={reindex}
            disabled={indexing || busy}
          >
            {indexing ? "Indexing" : indexStatus?.ready ? "Reindex" : "Index repo"}
          </button>
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
            Enter to send · Shift+Enter for a new line · Index the repo, then
            ask where something lives
          </p>
        </div>
      </section>
    </div>
  );
}
