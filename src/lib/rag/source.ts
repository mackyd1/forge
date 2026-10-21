import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type RepoSource = {
  id: string;
  kind: "local" | "github";
  label: string;
  root: string;
  remote: string | null;
};

type GithubRepo = {
  owner: string;
  repo: string;
  url: string;
};

const OWNER_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function forgeDir() {
  return path.join(process.cwd(), ".forge");
}

function activePath() {
  return path.join(forgeDir(), "active.json");
}

export function sourceId(root: string) {
  const resolved = path.resolve(root);
  const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function defaultSource(): RepoSource {
  const root = process.cwd();
  return {
    id: sourceId(root),
    kind: "local",
    label: "This project",
    root,
    remote: null,
  };
}

export async function getActiveSource(): Promise<RepoSource> {
  try {
    const parsed = JSON.parse(await readFile(activePath(), "utf8")) as RepoSource;
    if (parsed?.id && parsed.root && parsed.label) return parsed;
  } catch {
    // No saved source yet.
  }
  return defaultSource();
}

export async function openSource(input: string): Promise<RepoSource> {
  const trimmed = input.trim().replace(/[\\/]+$/, "");
  if (!trimmed) {
    throw new Error("Enter a folder path or a GitHub repo.");
  }

  const github = parseGithub(trimmed);
  const localCandidate = path.resolve(trimmed);
  const localExists = await isDirectory(localCandidate);

  if (github && !localExists) {
    const root = await checkoutGithub(github);
    return saveSource({
      id: sourceId(root),
      kind: "github",
      label: `${github.owner}/${github.repo}`,
      root,
      remote: github.url,
    });
  }

  if (localExists) {
    assertProjectFolder(localCandidate);
    return saveSource({
      id: sourceId(localCandidate),
      kind: "local",
      label: path.basename(localCandidate),
      root: localCandidate,
      remote: null,
    });
  }

  throw new Error(`Folder not found: ${trimmed}`);
}

export function parseGithub(input: string): GithubRepo | null {
  const ssh = input.match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (ssh) return toRepo(ssh[1], ssh[2]);

  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const url = new URL(input);
      if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      return toRepo(parts[0], parts[1].replace(/\.git$/, ""));
    } catch {
      return null;
    }
  }

  const bare = input.match(
    /^(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/,
  );
  if (bare) return toRepo(bare[1], bare[2].replace(/\.git$/, ""));

  const short = input.replace(/\.git$/, "");
  if (OWNER_REPO.test(short)) {
    const [owner, repo] = short.split("/");
    return toRepo(owner, repo);
  }

  return null;
}

function toRepo(owner: string, repo: string): GithubRepo {
  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}.git`,
  };
}

async function checkoutGithub(repo: GithubRepo): Promise<string> {
  const dest = path.join(forgeDir(), "checkouts", `${repo.owner}--${repo.repo}`);
  await mkdir(path.dirname(dest), { recursive: true });

  if (await isDirectory(path.join(dest, ".git"))) {
    await run("git", ["-C", dest, "fetch", "--depth", "1", "origin"]);
    await run("git", ["-C", dest, "reset", "--hard", "FETCH_HEAD"]);
    return dest;
  }

  await rm(dest, { recursive: true, force: true });
  try {
    await run("git", ["clone", "--depth", "1", repo.url, dest]);
  } catch (err) {
    await rm(dest, { recursive: true, force: true });
    try {
      await run("gh", ["repo", "clone", `${repo.owner}/${repo.repo}`, dest, "--", "--depth", "1"]);
    } catch (ghErr) {
      await rm(dest, { recursive: true, force: true });
      const reason = ghErr instanceof Error ? ghErr.message : "clone failed";
      const first = err instanceof Error ? err.message : reason;
      throw new Error(`Could not clone ${repo.owner}/${repo.repo}. ${first || reason}`);
    }
  }

  return dest;
}

async function saveSource(source: RepoSource): Promise<RepoSource> {
  await mkdir(forgeDir(), { recursive: true });
  await writeFile(activePath(), JSON.stringify(source, null, 2));
  return source;
}

function assertProjectFolder(root: string) {
  if (path.dirname(root) === root) {
    throw new Error("Pick a project folder, not a whole drive.");
  }
}

async function isDirectory(target: string) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().slice(0, 400) || `${command} exited ${code}`));
    });
  });
}
