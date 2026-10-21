import { embedTexts } from "./embed";
import { readIndex } from "./store";
import type { IndexedChunk, SourceRef } from "./types";

const TOP_K = 4;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export type RetrievedChunk = IndexedChunk & { score: number };

export async function retrieve(query: string): Promise<RetrievedChunk[]> {
  const index = await readIndex();
  if (!index || index.chunks.length === 0) return [];

  const [queryVector] = await embedTexts([query], "RETRIEVAL_QUERY");
  return index.chunks
    .map((chunk) => ({ ...chunk, score: cosine(queryVector, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

export function toSourceRefs(chunks: RetrievedChunk[]): SourceRef[] {
  return chunks.map(({ path, startLine, endLine }) => ({
    path,
    startLine,
    endLine,
  }));
}

export function buildGroundedInstruction(
  chunks: RetrievedChunk[],
  repoLabel: string,
): string {
  const base = [
    "You are Forge, an engineering workspace assistant.",
    "Be direct, practical, and concise — like a strong senior teammate.",
    "Prefer clear explanations and honest tradeoffs.",
    "When code is involved, use short fenced blocks and name languages.",
    `The active repository is ${repoLabel}.`,
  ];

  if (chunks.length === 0) {
    return [
      ...base,
      "This workspace has no indexed snippets for the question.",
      "Say that the repo is not indexed, or that nothing relevant was retrieved, instead of inventing file contents.",
    ].join(" ");
  }

  const snippets = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.path}:${chunk.startLine}-${chunk.endLine}\n${chunk.text}`,
    )
    .join("\n\n");

  return [
    ...base,
    "Retrieved snippets from the user's repository are included below.",
    "Use them when they answer the question, and cite them inline as [1], [2], and so on.",
    "If they do not contain the answer, say so instead of inventing code.",
    "",
    snippets,
  ].join("\n");
}
