import { buildBm25Index, rankBm25 } from "./bm25";
import { embedTexts } from "./embed";
import { readIndex } from "./store";
import type { IndexedChunk, SourceRef } from "./types";

export const TOP_K = 4;
const RRF_K = 60;
const CANDIDATE_POOL = 24;

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

export type RetrieveMode = "vector" | "bm25" | "hybrid";

function rrfFuse(
  rankedLists: { id: string; score: number }[][],
): Map<string, number> {
  const fused = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((row, rank) => {
      const contrib = 1 / (RRF_K + rank + 1);
      fused.set(row.id, (fused.get(row.id) ?? 0) + contrib);
    });
  }
  return fused;
}

/** Rank chunks with vector / BM25 / hybrid (RRF). Used by production retrieve and eval. */
export function rankChunks(
  query: string,
  chunks: IndexedChunk[],
  queryVector: number[] | null,
  mode: RetrieveMode = "hybrid",
  topK = TOP_K,
): RetrievedChunk[] {
  if (chunks.length === 0) return [];

  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const bm25Index = buildBm25Index(chunks);
  const bm25Ranked = rankBm25(query, chunks, bm25Index).slice(0, CANDIDATE_POOL);

  const vectorRanked =
    queryVector && mode !== "bm25"
      ? chunks
          .map((chunk) => ({
            id: chunk.id,
            score: cosine(queryVector, chunk.embedding),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, CANDIDATE_POOL)
      : [];

  let fused: Map<string, number>;
  if (mode === "bm25") {
    fused = new Map(bm25Ranked.map((row) => [row.id, row.score]));
  } else if (mode === "vector") {
    fused = new Map(vectorRanked.map((row) => [row.id, row.score]));
  } else {
    const lists = [];
    if (vectorRanked.length > 0) lists.push(vectorRanked);
    if (bm25Ranked.length > 0) lists.push(bm25Ranked);
    fused = lists.length > 0 ? rrfFuse(lists) : new Map();
  }

  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .flatMap(([id, score]) => {
      const chunk = byId.get(id);
      if (!chunk) return [];
      return [{ ...chunk, score }];
    });
}

export async function retrieve(
  query: string,
  mode: RetrieveMode = "hybrid",
): Promise<RetrievedChunk[]> {
  const index = await readIndex();
  if (!index || index.chunks.length === 0) return [];

  let queryVector: number[] | null = null;
  if (mode !== "bm25") {
    const [vector] = await embedTexts([query], "RETRIEVAL_QUERY");
    queryVector = vector ?? null;
  }

  return rankChunks(query, index.chunks, queryVector, mode, TOP_K);
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
