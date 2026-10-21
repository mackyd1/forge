"use client";

type BenchProps = {
  label: string;
  path: string;
  status: string;
  indexing: boolean;
  busy: boolean;
  actionLabel: string;
  draft: string;
  onDraft: (value: string) => void;
  onOpen: () => void;
  onReindex: () => void;
};

export function Bench({
  label,
  path,
  status,
  indexing,
  busy,
  actionLabel,
  draft,
  onDraft,
  onOpen,
  onReindex,
}: BenchProps) {
  const locked = indexing || busy;

  return (
    <header className="bench">
      <div className="bench-top">
        <div className="bench-identity">
          <p className="bench-label">{label}</p>
          <p className="bench-path" title={path}>
            {path}
          </p>
        </div>
        <div className="bench-actions">
          <p className="bench-count">{status}</p>
          <button type="button" className="text-btn" onClick={onReindex} disabled={locked}>
            {actionLabel}
          </button>
        </div>
      </div>
      <form
        className="bench-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && draft.trim()) onOpen();
        }}
      >
        <label className="sr-only" htmlFor="repo-source">
          Repository path or GitHub URL
        </label>
        <input
          id="repo-source"
          value={draft}
          disabled={locked}
          placeholder="Folder path or github.com/owner/repo"
          onChange={(event) => onDraft(event.target.value)}
        />
        <button type="submit" disabled={locked || !draft.trim()}>
          Open
        </button>
      </form>
    </header>
  );
}

export function shortPath(kind: "local" | "github", root: string, remote: string | null) {
  if (remote) return remote.replace(/^https?:\/\//, "").replace(/\.git$/, "");
  if (kind === "github") return root;
  const parts = root.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return root;
  const sep = root.includes("\\") ? "\\" : "/";
  return `…${sep}${parts.slice(-3).join(sep)}`;
}
