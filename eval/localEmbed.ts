import { tokenize } from "../src/lib/rag/bm25";

const DIM = 96;

/** Deterministic bag-of-tokens embedding so eval runs offline without Gemini. */
export function localEmbed(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  for (const token of tokenize(text)) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = h >>> 0;
    vec[idx % DIM] += 1;
    vec[(idx >>> 8) % DIM] += 0.5;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}
