import { getGeminiClient } from "@/lib/ai/gemini";

export const EMBED_DIMENSIONS = 768;

export function getEmbedModel(): string {
  return process.env.GEMINI_EMBED_MODEL?.trim() || "gemini-embedding-001";
}

/** Turn text into vectors. Documents and questions use different task types so search ranks better. */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const ai = getGeminiClient();
  const response = await ai.models.embedContent({
    model: getEmbedModel(),
    contents: texts,
    config: {
      taskType,
      outputDimensionality: EMBED_DIMENSIONS,
    },
  });

  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings, got ${embeddings.length}`,
    );
  }

  return embeddings.map((embedding, index) => {
    const values = embedding.values;
    if (!values?.length) {
      throw new Error(`Empty embedding for item ${index}`);
    }
    return values;
  });
}

export async function embedInBatches(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  batchSize = 16,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embedded = await embedTexts(batch, taskType);
    vectors.push(...embedded);
  }
  return vectors;
}
