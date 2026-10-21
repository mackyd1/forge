import { connection } from "next/server";
import { createThread, listThreads } from "@/lib/db/threads";

export async function GET(request: Request) {
  await connection();
  const sourceId = new URL(request.url).searchParams.get("sourceId")?.trim();
  if (!sourceId) {
    return Response.json({ error: "sourceId is required" }, { status: 400 });
  }
  return Response.json({ threads: listThreads(sourceId) });
}

export async function POST(request: Request) {
  await connection();
  let body: { sourceId?: unknown; sourceLabel?: unknown; title?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.sourceId !== "string" || !body.sourceId.trim()) {
    return Response.json({ error: "sourceId is required" }, { status: 400 });
  }

  const thread = createThread({
    sourceId: body.sourceId.trim(),
    sourceLabel: typeof body.sourceLabel === "string" ? body.sourceLabel : "Repo",
    title: typeof body.title === "string" ? body.title : "New thread",
  });
  return Response.json(thread, { status: 201 });
}
