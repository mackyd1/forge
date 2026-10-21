"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/chat/stream";
import type { ChatMessage, SourceRef } from "@/lib/chat/types";
import { Bench, shortPath } from "./bench";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import { ThreadRail, type ThreadSummary } from "./thread-rail";

type RepoSourceInfo = {
  id: string;
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

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json()) as T & { error?: string };
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
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = streamingId !== null;
  const source = indexStatus?.source;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingId]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/index")
      .then((response) => readJson<IndexStatus>(response))
      .then(async (status) => {
        if (cancelled) return;
        if (status.error) throw new Error(status.error);
        setIndexStatus(status);
        setActiveRoot(status.source?.root ?? null);
        if (status.source?.id) await loadThreads(status.source.id, true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not read index");
      });
    return () => {
      cancelled = true;
    };
    // Initial load only. Later source changes go through applyIndex.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadThreads(sourceId: string, openLatest: boolean) {
    const response = await fetch(`/api/threads?sourceId=${encodeURIComponent(sourceId)}`);
    const body = await readJson<{ threads: ThreadSummary[] }>(response);
    if (!response.ok) throw new Error(body.error || "Could not load threads");
    setThreads(body.threads);
    if (!openLatest) return;
    if (body.threads[0]) await openThread(body.threads[0].id);
    else {
      setThreadId(null);
      setMessages([]);
    }
  }

  async function openThread(id: string) {
    const response = await fetch(`/api/threads/${id}`);
    const body = await readJson<{ messages: ChatMessage[] }>(response);
    if (!response.ok) throw new Error(body.error || "Could not open thread");
    setThreadId(id);
    setMessages(
      body.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        sources: message.sources,
      })),
    );
  }

  async function applyIndex(status: IndexStatus) {
    const nextRoot = status.source?.root ?? null;
    const changed = Boolean(activeRoot && nextRoot && activeRoot !== nextRoot);
    setActiveRoot(nextRoot);
    setIndexStatus(status);
    if (changed) {
      setThreadId(null);
      setMessages([]);
    }
    if (status.source?.id) await loadThreads(status.source.id, changed || threads.length === 0);
  }

  async function indexRepo(nextSource?: string) {
    if (indexing || busy) return;
    setIndexing(true);
    setError(null);
    try {
      const response = await fetch("/api/index", {
        method: "POST",
        headers: nextSource ? { "Content-Type": "application/json" } : undefined,
        body: nextSource ? JSON.stringify({ source: nextSource }) : undefined,
      });
      const body = await readJson<IndexStatus>(response);
      if (!response.ok) throw new Error(body.error || "Indexing failed");
      await applyIndex(body);
      if (nextSource) setSourceDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setIndexing(false);
    }
  }

  async function ensureThread(title: string) {
    if (threadId) return threadId;
    if (!source) throw new Error("Open a repo before starting a thread.");
    const response = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: source.id,
        sourceLabel: source.label,
        title,
      }),
    });
    const thread = await readJson<ThreadSummary>(response);
    if (!response.ok) throw new Error(thread.error || "Could not save the thread");
    setThreadId(thread.id);
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
    return thread.id;
  }

  async function saveMessage(id: string, message: ChatMessage, sources?: SourceRef[]) {
    const response = await fetch(`/api/threads/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: message.id,
        role: message.role,
        content: message.content,
        sources: sources ?? message.sources ?? [],
      }),
    });
    if (!response.ok) {
      const body = await readJson<{ error?: string }>(response);
      throw new Error(body.error || "Could not save the message");
    }
  }

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;

    setError(null);
    setDraft("");

    const userMessage: ChatMessage = { id: newId(), role: "user", content };
    const assistantId = newId();
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "" };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setStreamingId(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantText = "";
    let cited: SourceRef[] = [];

    try {
      const id = await ensureThread(content);
      await saveMessage(id, userMessage);
      await streamChat(
        [...messages, userMessage].map(({ role, content: text }) => ({ role, content: text })),
        (delta) => {
          assistantText += delta;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: message.content + delta } : message,
            ),
          );
        },
        controller.signal,
        (sources) => {
          cited = sources;
          setMessages((prev) =>
            prev.map((message) => (message.id === assistantId ? { ...message, sources } : message)),
          );
        },
      );
      if (assistantText.trim()) {
        await saveMessage(id, { ...assistantMessage, content: assistantText }, cited);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.filter((message) => message.id !== assistantId || message.content.length > 0));
    } finally {
      setStreamingId(null);
      abortRef.current = null;
    }
  }

  const statusText = indexing
    ? "Reading the repo…"
    : indexStatus === null
      ? "Checking index…"
      : indexStatus.ready
        ? indexStatus.remaining
          ? `${tally(indexStatus.files, "file", "files")} · ${tally(indexStatus.chunks, "chunk", "chunks")} · ${indexStatus.remaining} left`
          : `${tally(indexStatus.files, "file", "files")} · ${tally(indexStatus.chunks, "chunk", "chunks")}`
        : "Not indexed";

  const actionLabel = indexing
    ? "Indexing"
    : indexStatus?.remaining
      ? "Continue"
      : indexStatus?.ready
        ? "Reindex"
        : "Index";

  return (
    <div className="app-frame">
      <ThreadRail
        threads={threads}
        activeId={threadId}
        onSelect={(id) => {
          if (!busy) void openThread(id).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Could not open thread");
          });
        }}
        onCreate={() => {
          if (busy) return;
          setThreadId(null);
          setMessages([]);
          setError(null);
        }}
      />
      <div className="workspace">
        <Bench
          label={source?.label ?? "This project"}
          path={
            source
              ? shortPath(source.kind, source.root, source.remote)
              : "Choose a folder or a GitHub repo"
          }
          status={statusText}
          indexing={indexing}
          busy={busy}
          actionLabel={actionLabel}
          draft={sourceDraft}
          onDraft={setSourceDraft}
          onOpen={() => void indexRepo(sourceDraft.trim())}
          onReindex={() => void indexRepo()}
        />
        <section className="chat-stage" aria-label="Conversation">
          <div className="chat-scroll">
            <MessageList messages={messages} streamingId={streamingId} />
            <div ref={bottomRef} />
          </div>
          <div className="chat-dock">
            {error ? <p className="chat-error">{error}</p> : null}
            <Composer value={draft} disabled={busy} onChange={setDraft} onSubmit={send} />
            <p className="chat-hint">Enter to send · Shift+Enter for a new line</p>
          </div>
        </section>
      </div>
    </div>
  );
}
