import { connection } from "next/server";
import { addMessage, getThread } from "@/lib/db/threads";
import type { SourceRef } from "@/lib/chat/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  if (!getThread(id)) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  let body: {
    id?: unknown;
    role?: unknown;
    content?: unknown;
    sources?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.role !== "user" && body.role !== "assistant") {
    return Response.json({ error: "role must be user or assistant" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const sources = Array.isArray(body.sources) ? (body.sources as SourceRef[]) : [];
  const message = addMessage({
    threadId: id,
    id: typeof body.id === "string" ? body.id : undefined,
    role: body.role,
    content: body.content,
    sources,
  });
  return Response.json(message, { status: 201 });
}
