type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function buildStubReply(userText: string): string {
  const trimmed = userText.trim();
  const preview =
    trimmed.length > 160 ? `${trimmed.slice(0, 160).trimEnd()}…` : trimmed;

  return [
    "Milestone 1 stub — no model wired yet.",
    "",
    "You asked:",
    preview || "(empty message)",
    "",
    "Next: connect a real LLM (Milestone 2), then ground answers in your repo (Milestone 3).",
  ].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = (body as { messages?: ChatMessage[] })?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "Expected { messages: ChatMessage[] }" },
      { status: 400 },
    );
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const reply = buildStubReply(lastUser?.content ?? "");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Stream by small chunks so the UI can practice real token streaming.
      const chunkSize = 3;
      for (let i = 0; i < reply.length; i += chunkSize) {
        controller.enqueue(encoder.encode(reply.slice(i, i + chunkSize)));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
