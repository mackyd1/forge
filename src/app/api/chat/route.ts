import { streamGeminiReply, type ChatTurn } from "@/lib/ai/gemini";

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamGeminiReply(messages, (delta) => {
          controller.enqueue(encoder.encode(delta));
        });
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
    },
  });
}
