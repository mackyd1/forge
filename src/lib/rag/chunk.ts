import { createRequire } from "node:module";
import path from "node:path";
import type { SourceChunk } from "./types";

export const MAX_CHARS = 1100;
export const MAX_LINES = 40;
const OVERLAP_LINES = 6;

const DEFINITION_TYPES = new Set([
  "function_declaration",
  "generator_function_declaration",
  "function_definition",
  "method_definition",
  "class_declaration",
  "class_definition",
  "abstract_class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
]);

const CLASS_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "abstract_class_declaration",
]);

type GrammarId = "typescript" | "tsx" | "javascript" | "python";

type SyntaxNode = {
  type: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildCount: number;
  namedChild: (index: number) => SyntaxNode | null;
};

type TreeSitterParser = {
  setLanguage: (language: unknown) => void;
  parse: (input: string) => { rootNode: SyntaxNode } | null;
};

const require = createRequire(path.join(process.cwd(), "package.json"));
const treeSitter = require(path.join(process.cwd(), "src/lib/rag/treeSitter.cjs")) as {
  createParser: () => Promise<TreeSitterParser>;
  loadLanguage: (grammar: GrammarId) => Promise<unknown>;
};

function grammarForPath(filePath: string): GrammarId | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ts") return "typescript";
  if (ext === ".tsx") return "tsx";
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs") return "javascript";
  if (ext === ".py") return "python";
  return null;
}

/** Split a file into overlapping windows so retrieval can hit a function, not a whole file. */
export function chunkSourceLineWindows(filePath: string, content: string): SourceChunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: SourceChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let size = 0;

    while (end < lines.length) {
      const next = lines[end].length + 1;
      const atLimit = size + next > MAX_CHARS || end - start >= MAX_LINES;
      if (atLimit && end > start) break;
      size += next;
      end += 1;
      if (next > MAX_CHARS) break;
    }

    const text = lines.slice(start, end).join("\n").trim();
    if (text) {
      chunks.push({
        path: filePath,
        startLine: start + 1,
        endLine: end,
        text,
      });
    }

    if (end >= lines.length) break;
    start = Math.max(end - OVERLAP_LINES, start + 1);
  }

  return chunks;
}

function nodeToChunk(filePath: string, content: string, node: SyntaxNode): SourceChunk | null {
  const text = content.slice(node.startIndex, node.endIndex).trim();
  if (!text) return null;
  return {
    path: filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    text,
  };
}

function collectDefinitionNodes(root: SyntaxNode): SyntaxNode[] {
  const found: SyntaxNode[] = [];

  function visit(node: SyntaxNode, insideClass: boolean) {
    // Python @dataclass / decorators wrap the real class/function node.
    if (node.type === "decorated_definition") {
      for (let i = 0; i < node.namedChildCount; i += 1) {
        const child = node.namedChild(i);
        if (child) visit(child, insideClass);
      }
      return;
    }

    if (DEFINITION_TYPES.has(node.type)) {
      if (CLASS_TYPES.has(node.type)) {
        const methods: SyntaxNode[] = [];
        for (let i = 0; i < node.namedChildCount; i += 1) {
          const child = node.namedChild(i);
          if (!child) continue;
          if (
            child.type === "method_definition" ||
            child.type === "function_definition" ||
            child.type === "class_declaration" ||
            child.type === "class_definition"
          ) {
            methods.push(child);
          }
        }
        const selfTextLen = node.endIndex - node.startIndex;
        if (methods.length > 1 || (methods.length > 0 && selfTextLen > MAX_CHARS)) {
          for (const method of methods) visit(method, true);
          return;
        }
        found.push(node);
        return;
      }

      if (!insideClass || node.type === "method_definition" || node.type === "function_definition") {
        found.push(node);
        return;
      }
    }

    for (let i = 0; i < node.namedChildCount; i += 1) {
      const child = node.namedChild(i);
      if (child) visit(child, insideClass || CLASS_TYPES.has(node.type));
    }
  }

  visit(root, false);
  return found;
}

function splitOversized(
  filePath: string,
  content: string,
  chunk: SourceChunk,
): SourceChunk[] {
  if (chunk.text.length <= MAX_CHARS && chunk.endLine - chunk.startLine + 1 <= MAX_LINES) {
    return [chunk];
  }
  const lines = content.split(/\r?\n/);
  const slice = lines.slice(chunk.startLine - 1, chunk.endLine).join("\n");
  return chunkSourceLineWindows(filePath, slice).map((part) => ({
    ...part,
    startLine: chunk.startLine + part.startLine - 1,
    endLine: chunk.startLine + part.endLine - 1,
  }));
}

async function chunkWithTreeSitter(
  filePath: string,
  content: string,
  grammar: GrammarId,
): Promise<SourceChunk[]> {
  const parser = await treeSitter.createParser();
  const language = await treeSitter.loadLanguage(grammar);
  parser.setLanguage(language);
  const tree = parser.parse(content);
  if (!tree) return [];

  const definitions = collectDefinitionNodes(tree.rootNode);
  const chunks: SourceChunk[] = [];
  let cursor = 0;

  for (const node of definitions) {
    if (node.startIndex > cursor) {
      const preamble = content.slice(cursor, node.startIndex).trim();
      if (preamble.length > 40) {
        const startLine = content.slice(0, cursor).split(/\r?\n/).length;
        const endLine = content.slice(0, node.startIndex).split(/\r?\n/).length;
        chunks.push(
          ...splitOversized(filePath, content, {
            path: filePath,
            startLine,
            endLine,
            text: preamble,
          }),
        );
      }
    }
    const chunk = nodeToChunk(filePath, content, node);
    if (chunk) chunks.push(...splitOversized(filePath, content, chunk));
    cursor = Math.max(cursor, node.endIndex);
  }

  if (cursor < content.length) {
    const rest = content.slice(cursor).trim();
    if (rest.length > 40) {
      const startLine = content.slice(0, cursor).split(/\r?\n/).length;
      const endLine = content.split(/\r?\n/).length;
      chunks.push(
        ...splitOversized(filePath, content, {
          path: filePath,
          startLine,
          endLine,
          text: rest,
        }),
      );
    }
  }

  return chunks;
}

/**
 * Prefer Tree-sitter function/class boundaries for TS/JS/Python.
 * Falls back to overlapping line windows for other languages or parse failures.
 */
export async function chunkSource(filePath: string, content: string): Promise<SourceChunk[]> {
  const grammar = grammarForPath(filePath);
  if (!grammar) return chunkSourceLineWindows(filePath, content);

  try {
    const chunks = await chunkWithTreeSitter(filePath, content, grammar);
    if (chunks.length > 0) return chunks;
  } catch (err) {
    if (process.env.FORGE_DEBUG_CHUNK === "1") {
      console.error(`[chunk] tree-sitter failed for ${filePath}:`, err);
    }
  }
  return chunkSourceLineWindows(filePath, content);
}

/** Sync entry for eval A/B — line windows only. */
export function chunkSourceSync(filePath: string, content: string): SourceChunk[] {
  return chunkSourceLineWindows(filePath, content);
}
