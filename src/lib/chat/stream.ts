import type { ChatMessage, SourceRef } from "./types";

export async function streamChat(
  messages: Pick<ChatMessage, "role" | "content">[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  onSources?: (sources: SourceRef[]) => void,
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let message = detail || `Chat request failed (${response.status})`;
    try {
      const parsed = JSON.parse(detail) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      // keep raw body text
    }
    throw new Error(message);
  }

  const sourceHeader = response.headers.get("x-forge-sources");
  if (sourceHeader && onSources) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sourceHeader)) as SourceRef[];
      if (Array.isArray(parsed) && parsed.length > 0) onSources(parsed);
    } catch {
      // Citations are optional; the reply can still stream.
    }
  }

  if (!response.body) {
    throw new Error("No response body from /api/chat");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }

  onDelta(decoder.decode());
}
