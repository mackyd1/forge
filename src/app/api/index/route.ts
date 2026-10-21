import { connection } from "next/server";
import { buildCodeIndex } from "@/lib/rag/build";
import { explainAiError } from "@/lib/rag/embed";
import { getActiveSource, openSource } from "@/lib/rag/source";
import { readSummary } from "@/lib/rag/store";

async function payload() {
  const [summary, source] = await Promise.all([readSummary(), getActiveSource()]);
  return { ...summary, source };
}

export async function GET() {
  await connection();

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY in .env.local" },
      { status: 503 },
    );
  }

  return Response.json(await payload());
}

export async function POST(request: Request) {
  await connection();

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY in .env.local" },
      { status: 503 },
    );
  }

  try {
    const text = await request.text();
    if (text.trim()) {
      let body: { source?: unknown };
      try {
        body = JSON.parse(text) as { source?: unknown };
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (typeof body.source === "string" && body.source.trim()) {
        await openSource(body.source);
      }
    }

    const summary = await buildCodeIndex();
    const source = await getActiveSource();
    return Response.json({ ...summary, source });
  } catch (err) {
    const message = explainAiError(err);
    const status = message.startsWith("Free-tier embedding") ? 429 : 502;
    return Response.json({ error: message }, { status });
  }
}
