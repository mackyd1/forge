import { connection } from "next/server";
import { getThread } from "@/lib/db/threads";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  const record = getThread(id);
  if (!record) return Response.json({ error: "Thread not found" }, { status: 404 });
  return Response.json(record);
}
