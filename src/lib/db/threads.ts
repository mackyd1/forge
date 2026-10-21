import { randomUUID } from "node:crypto";
import { getDb } from "./client";
import type { SourceRef } from "@/lib/chat/types";

export type ThreadSummary = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  updatedAt: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceRef[];
  createdAt: string;
};

type ThreadRow = {
  id: string;
  source_id: string;
  source_label: string;
  title: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources_json: string | null;
  created_at: string;
};

function toThread(row: ThreadRow): ThreadSummary {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceLabel: row.source_label,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

export function listThreads(sourceId: string): ThreadSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT id, source_id, source_label, title, updated_at
       FROM threads
       WHERE source_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(sourceId) as ThreadRow[];
  return rows.map(toThread);
}

export function createThread(input: {
  sourceId: string;
  sourceLabel: string;
  title: string;
}): ThreadSummary {
  const now = new Date().toISOString();
  const thread: ThreadSummary = {
    id: randomUUID(),
    sourceId: input.sourceId,
    sourceLabel: input.sourceLabel,
    title: input.title.trim().slice(0, 80) || "New thread",
    updatedAt: now,
  };
  getDb()
    .prepare(
      `INSERT INTO threads (id, source_id, source_label, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(thread.id, thread.sourceId, thread.sourceLabel, thread.title, now, now);
  return thread;
}

export function getThread(id: string): { thread: ThreadSummary; messages: StoredMessage[] } | null {
  const row = getDb()
    .prepare(
      `SELECT id, source_id, source_label, title, updated_at
       FROM threads WHERE id = ?`,
    )
    .get(id) as ThreadRow | undefined;
  if (!row) return null;

  const messages = getDb()
    .prepare(
      `SELECT id, role, content, sources_json, created_at
       FROM messages WHERE thread_id = ? ORDER BY created_at ASC`,
    )
    .all(id) as MessageRow[];

  return {
    thread: toThread(row),
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources_json ? (JSON.parse(message.sources_json) as SourceRef[]) : [],
      createdAt: message.created_at,
    })),
  };
}

export function addMessage(input: {
  threadId: string;
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
}): StoredMessage {
  const message: StoredMessage = {
    id: input.id ?? randomUUID(),
    role: input.role,
    content: input.content,
    sources: input.sources ?? [],
    createdAt: new Date().toISOString(),
  };
  const db = getDb();
  db.prepare(
    `INSERT INTO messages (id, thread_id, role, content, sources_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    message.id,
    input.threadId,
    message.role,
    message.content,
    message.sources.length > 0 ? JSON.stringify(message.sources) : null,
    message.createdAt,
  );
  db.prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`).run(
    message.createdAt,
    input.threadId,
  );
  return message;
}
