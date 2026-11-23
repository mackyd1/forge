# Forge

Ask questions about a codebase and get answers grounded in real files — with citations.

Forge indexes a repository, retrieves relevant snippets with hybrid search, and streams grounded responses from Gemini.

## Features

- **Tree-sitter chunking** for TypeScript, JavaScript, and Python (function/class boundaries), with line-window fallback for other languages
- **Hybrid retrieval** — Gemini embeddings + BM25 fused with Reciprocal Rank Fusion ([docs/retrieval.md](docs/retrieval.md))
- **Cited answers** — responses reference file paths and line ranges
- **Incremental indexing** — unchanged chunks reuse cached embeddings in SQLite
- **Offline eval** — `npm run eval` reports recall@4 / citation hit rate on a fixed fixture suite

### Retrieval quality (offline fixture, 22 cases)

| Mode | recall@4 | citation@4 |
| --- | --- | --- |
| Line windows + vector | 90.9% | 90.9% |
| AST chunks + hybrid | **100%** | 90.9% |

## Stack

- Next.js (App Router), TypeScript, React, Tailwind CSS
- Gemini (chat + embeddings), SQLite (threads + index metadata)
- Docker for a stateful local/production run

## Quick start

```bash
npm install
cp .env.example .env.local
```

1. Create a Gemini API key at [Google AI Studio](https://aistudio.google.com/apikey)
2. Set `GEMINI_API_KEY=...` in `.env.local`
3. Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker compose up --build
```

Serves http://localhost:3000. `GET /api/health` returns `{ "ok": true }`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run eval` | Retrieval eval harness |
