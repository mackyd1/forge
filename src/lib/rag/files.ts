import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const INCLUDE = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".css",
  ".md",
  ".json",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
  ".yml",
  ".yaml",
  ".toml",
  ".sql",
  ".html",
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".forge",
  "public",
  "coverage",
]);
const SKIP_FILES = new Set([
  "package-lock.json",
  "credentials.json",
  "secrets.json",
]);
const MAX_FILE_BYTES = 80_000;
const MAX_FILES = 100;

export type RepoFile = {
  path: string;
  content: string;
};

export async function collectRepoFiles(
  root = process.cwd(),
): Promise<{ files: RepoFile[]; truncated: boolean }> {
  const files: RepoFile[] = [];
  let truncated = false;

  async function walk(dir: string) {
    if (files.length >= MAX_FILES) {
      truncated = true;
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }
      if (entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(absolute);
        continue;
      }
      if (!entry.isFile() || SKIP_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const base = entry.name.toLowerCase();
      const namedText = base === "readme" || base === "license" || base === "dockerfile" || base === "makefile";
      if ((!INCLUDE.has(ext) && !namedText) || ext === ".pem" || ext === ".key") continue;

      const raw = await readFile(absolute);
      if (raw.byteLength > MAX_FILE_BYTES) continue;
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      files.push({ path: relative, content: raw.toString("utf8") });
    }
  }

  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, truncated };
}
