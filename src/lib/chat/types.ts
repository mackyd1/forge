export type Role = "user" | "assistant";

export type SourceRef = {
  path: string;
  startLine: number;
  endLine: number;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  sources?: SourceRef[];
};
