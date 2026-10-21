export type SourceChunk = {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
};

export type IndexedChunk = SourceChunk & {
  id: string;
  hash: string;
  embedding: number[];
};

export type CodeIndex = {
  version: 1;
  model: string;
  dimensions: number;
  createdAt: string;
  chunks: IndexedChunk[];
};

export type SourceRef = {
  path: string;
  startLine: number;
  endLine: number;
};
