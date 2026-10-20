export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#0c1117] text-[#e8eef5]">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-24">
        <p className="font-mono text-sm tracking-[0.2em] text-[#7dd3c0] uppercase">
          Forge
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Ask your codebase. Get grounded answers.
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-[#9aa8b8]">
          An AI engineering workspace you build yourself — chat, RAG, APIs, and
          shipping practices used in modern software roles.
        </p>
        <p className="font-mono text-sm text-[#6b7a8c]">
          Milestone 0 — scaffold ready. Run{" "}
          <code className="rounded bg-[#1a2330] px-1.5 py-0.5 text-[#7dd3c0]">
            npm run dev
          </code>
        </p>
      </main>
    </div>
  );
}
