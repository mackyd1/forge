import { chunkSource } from "./chunk";
import { EMBED_DIMENSIONS, embedInBatches, getEmbedModel } from "./embed";
import { collectRepoFiles } from "./files";
import { indexSummary, writeIndex } from "./store";
import type { CodeIndex } from "./types";

export async function buildCodeIndex() {
  const files = await collectRepoFiles();
  const chunks = files.flatMap((file) => chunkSource(file.path, file.content));
  const embeddings = await embedInBatches(
    chunks.map((chunk) => `${chunk.path}\n${chunk.text}`),
    "RETRIEVAL_DOCUMENT",
  );

  const index: CodeIndex = {
    version: 1,
    model: getEmbedModel(),
    dimensions: EMBED_DIMENSIONS,
    createdAt: new Date().toISOString(),
    chunks: chunks.map((chunk, i) => ({
      ...chunk,
      id: `${chunk.path}:${chunk.startLine}-${chunk.endLine}`,
      embedding: embeddings[i],
    })),
  };

  await writeIndex(index);
  return indexSummary(index);
}
