import { connection } from "next/server";
import { buildCodeIndex } from "@/lib/rag/build";
import { readSummary } from "@/lib/rag/store";

export async function GET() {
  await connection();

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY in .env.local" },
      { status: 503 },
    );
  }

  return Response.json(await readSummary());
}

export async function POST() {
  await connection();

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY in .env.local" },
      { status: 503 },
    );
  }

  try {
    const summary = await buildCodeIndex();
    return Response.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
