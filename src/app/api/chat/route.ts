import { streamGeminiReply, type ChatTurn } from "@/lib/ai/gemini";
import { explainAiError } from "@/lib/rag/embed";
import {
  buildGroundedInstruction,
  retrieve,
  toSourceRefs,
} from "@/lib/rag/retrieve";
import { getActiveSource } from "@/lib/rag/source";
import { logRequest } from "@/lib/log";

export async function POST(request: Request) {
  const started = Date.now();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    logRequest("POST /api/chat", 400, started, "Invalid JSON body");
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = (body as { messages?: ChatTurn[] })?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    logRequest("POST /api/chat", 400, started, "Missing messages");
    return Response.json(
      { error: "Expected { messages: ChatTurn[] }" },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    logRequest("POST /api/chat", 503, started, "Missing GEMINI_API_KEY");
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
    logRequest("POST /api/chat", status, started, message);
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
        logRequest("POST /api/chat", 200, started);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gemini request failed";
        logRequest("POST /api/chat", 502, started, message);
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
