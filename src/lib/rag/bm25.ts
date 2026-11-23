import type { IndexedChunk } from "./types";

const TOKEN_RE = /[A-Za-z_][A-Za-z0-9_]{1,}|[A-Z]{2,}(?![a-z])/g;

export function tokenize(text: string): string[] {
  const matches = text.match(TOKEN_RE) ?? [];
  return matches.map((token) => token.toLowerCase());
}

export type Bm25Index = {
  docCount: number;
  avgdl: number;
  /** term -> document frequency */
  df: Map<string, number>;
  /** chunk id -> term frequencies */
  tf: Map<string, Map<string, number>>;
  /** chunk id -> token count */
  lengths: Map<string, number>;
};

export function buildBm25Index(chunks: IndexedChunk[]): Bm25Index {
  const tf = new Map<string, Map<string, number>>();
  const lengths = new Map<string, number>();
  const df = new Map<string, number>();
  let totalLen = 0;

  for (const chunk of chunks) {
    const tokens = tokenize(`${chunk.path}\n${chunk.text}`);
    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    tf.set(chunk.id, counts);
    lengths.set(chunk.id, tokens.length);
    totalLen += tokens.length;
    for (const term of counts.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  return {
    docCount: chunks.length,
    avgdl: chunks.length === 0 ? 0 : totalLen / chunks.length,
    df,
    tf,
    lengths,
  };
}

/** Okapi BM25 score for a query against one document. */
export function bm25Score(
  queryTokens: string[],
  docId: string,
  index: Bm25Index,
  k1 = 1.5,
  b = 0.75,
): number {
  if (index.docCount === 0) return 0;
  const docTf = index.tf.get(docId);
  if (!docTf) return 0;
  const docLen = index.lengths.get(docId) ?? 0;
  let score = 0;

  for (const term of queryTokens) {
    const f = docTf.get(term) ?? 0;
    if (f === 0) continue;
    const n = index.df.get(term) ?? 0;
    const idf = Math.log(1 + (index.docCount - n + 0.5) / (n + 0.5));
    const denom = f + k1 * (1 - b + (b * docLen) / Math.max(index.avgdl, 1));
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

export function rankBm25(
  query: string,
  chunks: IndexedChunk[],
  index: Bm25Index,
): { id: string; score: number }[] {
  const queryTokens = tokenize(query);
  return chunks
    .map((chunk) => ({ id: chunk.id, score: bm25Score(queryTokens, chunk.id, index) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
}
