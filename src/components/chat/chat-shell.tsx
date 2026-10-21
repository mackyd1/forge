"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/chat/stream";
import type { ChatMessage } from "@/lib/chat/types";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

type RepoSourceInfo = {
  label: string;
  kind: "local" | "github";
  root: string;
  remote: string | null;
};

type IndexStatus = {
  ready: boolean;
  files: number;
  chunks: number;
  remaining?: number;
  source?: RepoSourceInfo;
};

function newId() {
  return crypto.randomUUID();
}

function tally(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [sourceDraft, setSourceDraft] = useState("");
  const [activeRoot, setActiveRoot] = useState<string | null>(null);
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
        if (cancelled) return;
        setIndexStatus(status);
        setActiveRoot(status.source?.root ?? null);
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

  function applyIndex(status: IndexStatus) {
    const nextRoot = status.source?.root ?? null;
    if (activeRoot && nextRoot && activeRoot !== nextRoot) {
      setMessages([]);
    }
    setActiveRoot(nextRoot);
    setIndexStatus(status);
  }

  async function indexRepo(source?: string) {
    if (indexing || busy) return;
    setIndexing(true);
    setError(null);
    try {
      const response = await fetch("/api/index", {
        method: "POST",
        headers: source ? { "Content-Type": "application/json" } : undefined,
        body: source ? JSON.stringify({ source }) : undefined,
      });
      const body = (await response.json()) as IndexStatus & { error?: string };
      if (!response.ok) throw new Error(body.error || "Indexing failed");
      applyIndex(body);
      if (source) setSourceDraft("");
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
            Point it at a folder or a GitHub repo. Answers cite that code.
          </p>
          <form
            className="source-bar"
            onSubmit={(event) => {
              event.preventDefault();
              const next = sourceDraft.trim();
              if (next) void indexRepo(next);
            }}
          >
            <label className="sr-only" htmlFor="repo-source">
              Repository path or GitHub URL
            </label>
            <input
              id="repo-source"
              className="source-input"
              value={sourceDraft}
              disabled={indexing || busy}
              placeholder="C:\path\to\repo  or  github.com/owner/repo"
              onChange={(event) => setSourceDraft(event.target.value)}
            />
            <button type="submit" disabled={indexing || busy || !sourceDraft.trim()}>
              Open
            </button>
          </form>
          <p className="source-current">
            {indexStatus?.source
              ? `${indexStatus.source.label} · ${indexStatus.source.remote ?? indexStatus.source.root}`
              : "Source · this project"}
          </p>
        </div>
        <div className="index-rail">
          <p>
            {indexing
              ? "Reading the repo…"
              : indexStatus === null
                ? "Checking index…"
                : indexStatus.ready
                  ? indexStatus.remaining
                    ? `${tally(indexStatus.files, "file", "files")} · ${tally(indexStatus.chunks, "chunk", "chunks")} · ${indexStatus.remaining} left`
                    : `${tally(indexStatus.files, "file", "files")} · ${tally(indexStatus.chunks, "chunk", "chunks")}`
                  : "Repo not indexed"}
          </p>
          <button
            type="button"
            onClick={() => void indexRepo()}
            disabled={indexing || busy}
          >
            {indexing
              ? "Indexing"
              : indexStatus?.remaining
                ? "Continue"
                : indexStatus?.ready
                  ? "Reindex"
                  : "Index repo"}
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
            Enter to send · Shift+Enter for a new line · Open a repo, then ask
            where something lives
          </p>
        </div>
      </section>
    </div>
  );
}
