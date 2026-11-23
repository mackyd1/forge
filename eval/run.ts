import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chunkSource, chunkSourceLineWindows } from "../src/lib/rag/chunk";
import { rankChunks, type RetrieveMode } from "../src/lib/rag/retrieve";
import type { IndexedChunk, SourceChunk } from "../src/lib/rag/types";
import { localEmbed } from "./localEmbed";

type LineRange = { path: string; start: number; end: number };

type EvalCase = {
  id: string;
  query: string;
  expectedPaths: string[];
  expectedLineRanges?: LineRange[];
};

type ModeResult = {
  mode: string;
  recallAtK: number;
  citationHitRate: number;
  hits: number;
  citationHits: number;
  total: number;
};

const FIXTURE_ROOT = path.join(__dirname, "fixture");
const CASES_PATH = path.join(__dirname, "cases.json");
const TOP_K = 4;

async function collectFixtureFiles(root: string) {
  const files: { path: string; content: string }[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      const content = await readFile(absolute, "utf8");
      files.push({ path: relative, content });
    }
  }

  await walk(path.join(root, "src"));
  return files;
}

function toIndexed(chunks: SourceChunk[]): IndexedChunk[] {
  return chunks.map((chunk) => {
    const text = `${chunk.path}\n${chunk.text}`;
    return {
      ...chunk,
      id: `${chunk.path}:${chunk.startLine}-${chunk.endLine}`,
      hash: createHash("sha256").update(text).digest("hex"),
      embedding: localEmbed(text),
    };
  });
}

function pathHit(retrieved: IndexedChunk[], expectedPaths: string[]): boolean {
  const paths = new Set(retrieved.map((chunk) => chunk.path.replace(/\\/g, "/")));
  return expectedPaths.some((expected) => paths.has(expected));
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function citationHit(
  retrieved: IndexedChunk[],
  expected: LineRange[] | undefined,
  expectedPaths: string[],
): boolean {
  if (!expected || expected.length === 0) {
    return pathHit(retrieved, expectedPaths);
  }
  return expected.some((range) =>
    retrieved.some(
      (chunk) =>
        chunk.path.replace(/\\/g, "/") === range.path &&
        rangesOverlap(chunk.startLine, chunk.endLine, range.start, range.end),
    ),
  );
}

async function buildCorpus(
  files: { path: string; content: string }[],
  strategy: "line" | "ast",
): Promise<IndexedChunk[]> {
  const chunks: SourceChunk[] = [];
  for (const file of files) {
    if (strategy === "line") {
      chunks.push(...chunkSourceLineWindows(file.path, file.content));
    } else {
      chunks.push(...(await chunkSource(file.path, file.content)));
    }
  }
  return toIndexed(chunks);
}

function evaluate(
  label: string,
  cases: EvalCase[],
  chunks: IndexedChunk[],
  mode: RetrieveMode,
): ModeResult {
  let hits = 0;
  let citationHits = 0;

  for (const testCase of cases) {
    const queryVector = mode === "bm25" ? null : localEmbed(testCase.query);
    const retrieved = rankChunks(testCase.query, chunks, queryVector, mode, TOP_K);
    if (pathHit(retrieved, testCase.expectedPaths)) hits += 1;
    if (citationHit(retrieved, testCase.expectedLineRanges, testCase.expectedPaths)) {
      citationHits += 1;
    }
  }

  const total = cases.length;
  return {
    mode: label,
    recallAtK: hits / total,
    citationHitRate: citationHits / total,
    hits,
    citationHits,
    total,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  const cases = JSON.parse(await readFile(CASES_PATH, "utf8")) as EvalCase[];
  const files = await collectFixtureFiles(FIXTURE_ROOT);

  console.log(`Fixture files: ${files.length}`);
  console.log(`Cases: ${cases.length}`);

  const lineChunks = await buildCorpus(files, "line");
  const astChunks = await buildCorpus(files, "ast");
  console.log(`Line-window chunks: ${lineChunks.length}`);
  console.log(`Tree-sitter chunks: ${astChunks.length}`);

  const results: ModeResult[] = [
    evaluate("line+vector", cases, lineChunks, "vector"),
    evaluate("line+bm25", cases, lineChunks, "bm25"),
    evaluate("line+hybrid", cases, lineChunks, "hybrid"),
    evaluate("ast+vector", cases, astChunks, "vector"),
    evaluate("ast+bm25", cases, astChunks, "bm25"),
    evaluate("ast+hybrid", cases, astChunks, "hybrid"),
  ];

  console.log("\nResults (offline local embeddings + BM25):");
  console.log("mode".padEnd(14), "recall@4".padEnd(10), "citation@4");
  for (const row of results) {
    console.log(
      row.mode.padEnd(14),
      pct(row.recallAtK).padEnd(10),
      pct(row.citationHitRate),
    );
  }

  const baseline = results.find((row) => row.mode === "line+vector")!;
  const best = results.find((row) => row.mode === "ast+hybrid")!;

  const outDir = path.join(__dirname, "results");
  await mkdir(outDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    topK: TOP_K,
    cases: cases.length,
    lineChunks: lineChunks.length,
    astChunks: astChunks.length,
    results,
    headline: {
      baselineRecall: baseline.recallAtK,
      baselineCitation: baseline.citationHitRate,
      astHybridRecall: best.recallAtK,
      astHybridCitation: best.citationHitRate,
    },
  };
  await writeFile(path.join(outDir, "latest.json"), JSON.stringify(payload, null, 2));
  console.log(`\nWrote eval/results/latest.json`);
  console.log(
    `Headline: line+vector recall ${pct(baseline.recallAtK)} → ast+hybrid ${pct(best.recallAtK)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
