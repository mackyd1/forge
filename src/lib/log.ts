type Level = "info" | "error";

export function log(
  level: Level,
  event: string,
  fields: Record<string, string | number | boolean | null> = {},
) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function logRequest(
  route: string,
  status: number,
  startedAt: number,
  error?: string,
) {
  log(error ? "error" : "info", "request", {
    route,
    status,
    ms: Date.now() - startedAt,
    ...(error ? { error } : {}),
  });
}
