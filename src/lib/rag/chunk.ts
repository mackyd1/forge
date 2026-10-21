import type { SourceChunk } from "./types";

const MAX_CHARS = 1100;
const MAX_LINES = 40;
const OVERLAP_LINES = 6;

/** Split a file into overlapping windows so retrieval can hit a function, not a whole file. */
export function chunkSource(path: string, content: string): SourceChunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: SourceChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let size = 0;

    while (end < lines.length) {
      const next = lines[end].length + 1;
      const atLimit = size + next > MAX_CHARS || end - start >= MAX_LINES;
      if (atLimit && end > start) break;
      size += next;
      end += 1;
      if (next > MAX_CHARS) break;
    }

    const text = lines.slice(start, end).join("\n").trim();
    if (text) {
      chunks.push({
        path,
        startLine: start + 1,
        endLine: end,
        text,
      });
    }

    if (end >= lines.length) break;
    start = Math.max(end - OVERLAP_LINES, start + 1);
  }

  return chunks;
}
