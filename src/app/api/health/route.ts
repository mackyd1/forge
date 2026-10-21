import { connection } from "next/server";
import { logRequest } from "@/lib/log";

export async function GET() {
  await connection();
  const started = Date.now();
  logRequest("GET /api/health", 200, started);
  return Response.json({ ok: true });
}
