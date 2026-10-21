import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const INCLUDE = new Set([".ts", ".tsx", ".css", ".md", ".mjs", ".json"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".forge",
  "public",
  "coverage",
]);
const SKIP_FILES = new Set(["package-lock.json"]);
const MAX_FILE_BYTES = 80_000;

export type RepoFile = {
  path: string;
  content: string;
};

export async function collectRepoFiles(root = process.cwd()): Promise<RepoFile[]> {
  const files: RepoFile[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(absolute);
        continue;
      }
      if (!entry.isFile() || SKIP_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name);
      if (!INCLUDE.has(ext)) continue;

      const raw = await readFile(absolute);
      if (raw.byteLength > MAX_FILE_BYTES) continue;
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      files.push({ path: relative, content: raw.toString("utf8") });
    }
  }

  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}
