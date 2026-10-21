"use client";

export type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

type ThreadRailProps = {
  threads: ThreadSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function ThreadRail({ threads, activeId, onSelect, onCreate }: ThreadRailProps) {
  return (
    <aside className="thread-rail">
      <div className="rail-head">
        <p className="rail-mark">Forge</p>
        <button type="button" className="text-btn" onClick={onCreate}>
          New
        </button>
      </div>
      {threads.length === 0 ? (
        <p className="rail-empty">Threads show up after the first question.</p>
      ) : (
        <ul className="thread-list">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                data-active={thread.id === activeId ? "true" : undefined}
                onClick={() => onSelect(thread.id)}
              >
                {thread.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
