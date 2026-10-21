import { getGeminiClient } from "@/lib/ai/gemini";

export const EMBED_DIMENSIONS = 768;

export function getEmbedModel(): string {
  return process.env.GEMINI_EMBED_MODEL?.trim() || "gemini-embedding-001";
}

export function explainAiError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Request failed";
  const quota =
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Quota exceeded") ||
    message.includes('"code":429') ||
    message.includes("429");
  if (!quota) return message;

  const retry = message.match(/retry in ([0-9.]+)s/i);
  const seconds = retry ? Math.ceil(Number(retry[1])) : 20;
  return `Free-tier embedding limit hit (100 requests per minute). Wait ${seconds}s, then try again.`;
}

function retryDelayMs(err: unknown): number | null {
  const message = err instanceof Error ? err.message : "";
  const quota =
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Quota exceeded") ||
    message.includes("429");
  if (!quota) return null;
  const retry = message.match(/retry in ([0-9.]+)s/i);
  const seconds = retry ? Math.min(Number(retry[1]), 30) : 16;
  return Math.ceil(seconds * 1000) + 400;
}

/** Turn text into vectors. Documents and questions use different task types so search ranks better. */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const ai = getGeminiClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestEmbeddings(ai, texts, taskType);
    } catch (err) {
      lastError = err;
      const wait = attempt === 0 ? retryDelayMs(err) : null;
      if (wait === null) break;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  throw new Error(explainAiError(lastError));
}

async function requestEmbeddings(
  ai: ReturnType<typeof getGeminiClient>,
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
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
