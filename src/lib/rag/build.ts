import { createHash } from "node:crypto";
import { chunkSource } from "./chunk";
import { EMBED_DIMENSIONS, embedInBatches, getEmbedModel } from "./embed";
import { collectRepoFiles } from "./files";
import { getActiveSource } from "./source";
import { indexSummary, readIndex, writeIndex } from "./store";
import type { CodeIndex, IndexedChunk } from "./types";

const MAX_NEW_EMBEDDINGS = 32;

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

  const source = await getActiveSource();
  const collected = await collectRepoFiles(source.root);
  const chunks = collected.files.flatMap((file) => chunkSource(file.path, file.content));
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

  const batch = pending.slice(0, MAX_NEW_EMBEDDINGS);
  const remaining = pending.length - batch.length;

  if (batch.length > 0) {
    const fresh = await embedInBatches(
      batch.map((item) => item.text),
      "RETRIEVAL_DOCUMENT",
    );
    batch.forEach((item, index) => {
      embeddings[item.index] = fresh[index];
    });
  }

  const indexed: IndexedChunk[] = chunks.flatMap((chunk, index) => {
    const embedding = embeddings[index];
    if (!embedding) return [];
    return [
      {
        ...chunk,
        id: `${chunk.path}:${chunk.startLine}-${chunk.endLine}`,
        hash: chunkHash(chunk.path, chunk.text),
        embedding,
      },
    ];
  });

  const index: CodeIndex = {
    version: 1,
    model: getEmbedModel(),
    dimensions: EMBED_DIMENSIONS,
    createdAt: new Date().toISOString(),
    chunks: indexed,
  };

  await writeIndex(index, { remaining, truncated: collected.truncated });
  return {
    ...indexSummary(index),
    embedded: batch.length,
    remaining,
    truncated: collected.truncated,
  };
}
