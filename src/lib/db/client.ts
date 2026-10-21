import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { forgeDb?: DatabaseSync };

function openDatabase() {
  const dir = path.join(process.cwd(), ".forge");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "forge.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_label TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id)
    );
    CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages (thread_id, created_at);
  `);
  return db;
}

export function getDb() {
  if (!globalForDb.forgeDb) globalForDb.forgeDb = openDatabase();
  return globalForDb.forgeDb;
}
