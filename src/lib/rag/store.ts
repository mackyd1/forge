import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { EMBED_DIMENSIONS, getEmbedModel } from "./embed";
import { getActiveSource, sourceId } from "./source";
import type { CodeIndex } from "./types";

function forgeDir() {
  return path.join(process.cwd(), ".forge");
}

async function indexPaths() {
  const source = await getActiveSource();
  const dir = path.join(forgeDir(), "indexes", source.id);
  return {
    source,
    dir,
    index: path.join(dir, "index.json"),
    meta: path.join(dir, "meta.json"),
  };
}

async function migrateLegacyIndex(sourceRoot: string, sourceKey: string, nextIndex: string) {
  if (sourceKey !== sourceId(process.cwd())) return;
  if (path.resolve(sourceRoot).toLowerCase() !== path.resolve(process.cwd()).toLowerCase()) return;

  try {
    await readFile(nextIndex, "utf8");
    return;
  } catch {
    // Copy the original single-repo index forward once.
  }

  const legacy = path.join(forgeDir(), "index.json");
  const legacyMeta = path.join(forgeDir(), "meta.json");
  try {
    await mkdir(path.dirname(nextIndex), { recursive: true });
    await copyFile(legacy, nextIndex);
    await copyFile(legacyMeta, path.join(path.dirname(nextIndex), "meta.json"));
  } catch {
    // Nothing to migrate.
  }
}

export async function readIndex(): Promise<CodeIndex | null> {
  try {
    const paths = await indexPaths();
    await migrateLegacyIndex(paths.source.root, paths.source.id, paths.index);
    const raw = await readFile(paths.index, "utf8");
    const parsed = JSON.parse(raw) as CodeIndex;
    if (parsed.version !== 1 || !Array.isArray(parsed.chunks)) return null;
    if (parsed.model !== getEmbedModel()) return null;
    if (parsed.dimensions !== EMBED_DIMENSIONS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeIndex(
  index: CodeIndex,
  extra?: { remaining: number; truncated: boolean },
): Promise<void> {
  const paths = await indexPaths();
  await mkdir(paths.dir, { recursive: true });
  const tmp = `${paths.index}.tmp`;
  await writeFile(tmp, JSON.stringify(index));
  await rename(tmp, paths.index);
  await writeFile(
    paths.meta,
    JSON.stringify({ ...indexSummary(index), remaining: extra?.remaining ?? 0, truncated: extra?.truncated ?? false }),
  );
}

export async function readSummary() {
  const empty = { ...indexSummary(null), remaining: 0, truncated: false };
  try {
    const paths = await indexPaths();
    await migrateLegacyIndex(paths.source.root, paths.source.id, paths.index);
    const raw = await readFile(paths.meta, "utf8");
    const parsed = JSON.parse(raw) as ReturnType<typeof indexSummary> & {
      remaining?: number;
      truncated?: boolean;
    };
    if (parsed?.ready && typeof parsed.chunks === "number") {
      return {
        ...parsed,
        remaining: parsed.remaining ?? 0,
        truncated: parsed.truncated ?? false,
      };
    }
  } catch {
    // Fall through to the empty summary.
  }
  return empty;
}

export function indexSummary(index: CodeIndex | null) {
  if (!index) {
    return { ready: false as const, files: 0, chunks: 0, updatedAt: null };
  }
  const files = new Set(index.chunks.map((chunk) => chunk.path)).size;
  return {
    ready: true as const,
    files,
    chunks: index.chunks.length,
    updatedAt: index.createdAt,
  };
}
