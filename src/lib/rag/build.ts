import { createHash } from "node:crypto";
import { chunkSource } from "./chunk";
import { EMBED_DIMENSIONS, embedInBatches, getEmbedModel } from "./embed";
import { collectRepoFiles } from "./files";
import { indexSummary, readIndex, writeIndex } from "./store";
import type { CodeIndex, IndexedChunk } from "./types";

function chunkHash(path: string, text: string) {
  return createHash("sha256").update(path).update("\0").update(text).digest("hex");
}

export async function buildCodeIndex() {
  const previous = await readIndex();
  const reusedVectors = new Map<string, number[]>();
  for (const chunk of previous?.chunks ?? []) {
    if (!chunk.embedding?.length) continue;
    const hash = chunk.hash || chunkHash(chunk.path, chunk.text);
    reusedVectors.set(hash, chunk.embedding);
  }

  const files = await collectRepoFiles();
  const chunks = files.flatMap((file) => chunkSource(file.path, file.content));
  const embeddings: number[][] = new Array(chunks.length);
  const pending: { index: number; text: string }[] = [];

  chunks.forEach((chunk, index) => {
    const hash = chunkHash(chunk.path, chunk.text);
    const existing = reusedVectors.get(hash);
    if (existing) {
      embeddings[index] = existing;
      return;
    }
    pending.push({ index, text: `${chunk.path}\n${chunk.text}` });
  });

  if (pending.length > 0) {
    const fresh = await embedInBatches(
      pending.map((item) => item.text),
      "RETRIEVAL_DOCUMENT",
    );
    pending.forEach((item, index) => {
      embeddings[item.index] = fresh[index];
    });
  }

  const indexed: IndexedChunk[] = chunks.map((chunk, index) => ({
    ...chunk,
    id: `${chunk.path}:${chunk.startLine}-${chunk.endLine}`,
    hash: chunkHash(chunk.path, chunk.text),
    embedding: embeddings[index],
  }));

  const index: CodeIndex = {
    version: 1,
    model: getEmbedModel(),
    dimensions: EMBED_DIMENSIONS,
    createdAt: new Date().toISOString(),
    chunks: indexed,
  };

  await writeIndex(index);
  return { ...indexSummary(index), embedded: pending.length };
}
