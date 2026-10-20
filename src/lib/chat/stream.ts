import type { ChatMessage } from "./types";

export async function streamChat(
  messages: Pick<ChatMessage, "role" | "content">[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Chat request failed (${response.status})`);
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
