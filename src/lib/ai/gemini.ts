import { GoogleGenAI } from "@google/genai";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_INSTRUCTION = [
  "You are Forge, an engineering workspace assistant.",
  "Be direct, practical, and concise — like a strong senior teammate.",
  "Prefer clear explanations, concrete examples, and honest tradeoffs.",
  "When code is involved, use short fenced blocks and name languages.",
  "You do not yet have the user's repo indexed; say so if they ask about specific private files.",
].join(" ");

/** Free-tier friendly default; override with GEMINI_MODEL in .env.local */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
}

function toGeminiContents(messages: ChatTurn[]) {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

export async function streamGeminiReply(
  messages: ChatTurn[],
  onDelta: (text: string) => void,
): Promise<void> {
  const ai = getGeminiClient();
  const model = getGeminiModel();
  const contents = toGeminiContents(messages);

  if (contents.length === 0) {
    throw new Error("No messages to send");
  }

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) onDelta(text);
  }
}
