import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { EMBED_DIMENSIONS, getEmbedModel } from "./embed";
import type { CodeIndex } from "./types";

function forgeDir() {
  return path.join(process.cwd(), ".forge");
}

function indexPath() {
  return path.join(forgeDir(), "index.json");
}

function metaPath() {
  return path.join(forgeDir(), "meta.json");
}

export async function readIndex(): Promise<CodeIndex | null> {
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw) as CodeIndex;
    if (parsed.version !== 1 || !Array.isArray(parsed.chunks)) return null;
    if (parsed.model !== getEmbedModel()) return null;
    if (parsed.dimensions !== EMBED_DIMENSIONS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeIndex(index: CodeIndex): Promise<void> {
  const file = indexPath();
  await mkdir(forgeDir(), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(index));
  await rename(tmp, file);
  await writeFile(metaPath(), JSON.stringify(indexSummary(index)));
}

export async function readSummary() {
  try {
    const raw = await readFile(metaPath(), "utf8");
    const parsed = JSON.parse(raw) as ReturnType<typeof indexSummary>;
    if (parsed?.ready && typeof parsed.chunks === "number") return parsed;
  } catch {
    // Fall through to the empty summary.
  }
  return indexSummary(null);
}

export function indexSummary(index: CodeIndex | null) {
  if (!index) {
    return { ready: false as const, files: 0, chunks: 0, updatedAt: null };
  }
  const files = new Set(index.chunks.map((chunk) => chunk.path)).size;
  return {
    ready: true as const,
    files,
    chunks: index.chunks.length,
    updatedAt: index.createdAt,
  };
}
