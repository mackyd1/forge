import { streamGeminiReply, type ChatTurn } from "@/lib/ai/gemini";
import { explainAiError } from "@/lib/rag/embed";
import {
  buildGroundedInstruction,
  retrieve,
  toSourceRefs,
} from "@/lib/rag/retrieve";
import { getActiveSource } from "@/lib/rag/source";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = (body as { messages?: ChatTurn[] })?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "Expected { messages: ChatTurn[] }" },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          "Missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/apikey then add it to .env.local and restart npm run dev.",
      },
      { status: 503 },
    );
  }

  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  let sources: ReturnType<typeof toSourceRefs> = [];
  let systemInstruction: string | undefined;

  try {
    const source = await getActiveSource();
    const retrieved = lastUser ? await retrieve(lastUser.content) : [];
    sources = toSourceRefs(retrieved);
    systemInstruction = buildGroundedInstruction(retrieved, source.label);
  } catch (err) {
    const message = explainAiError(err);
    const status = message.startsWith("Free-tier embedding") ? 429 : 502;
    return Response.json({ error: message }, { status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamGeminiReply(
          messages,
          (delta) => {
            controller.enqueue(encoder.encode(delta));
          },
          systemInstruction,
        );
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gemini request failed";
        controller.error(new Error(message));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Forge-Sources": encodeURIComponent(JSON.stringify(sources)),
    },
  });
}
