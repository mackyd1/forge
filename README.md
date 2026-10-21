# Forge

AI-assisted engineering workspace — ask questions about a codebase and get answers grounded in real files.

Built as a portfolio + learning project for modern software engineering: full-stack web, APIs, and production AI patterns (RAG, tools, evaluation).

## What it does (eventually)

1. Index a codebase
2. Ask questions in natural language
3. Answer with citations from the actual code
4. Suggest useful changes (explain, refactor, find bugs)

## Stack

- **Next.js** (App Router) + **TypeScript** + **React**
- **Tailwind CSS** for UI
- Later: database, embeddings / vector search, LLM APIs, auth, Docker

## Getting started

```bash
npm install
cp .env.example .env.local
```

1. Get a **free** Gemini API key: [Google AI Studio](https://aistudio.google.com/apikey)
2. Put it in `.env.local` as `GEMINI_API_KEY=...`
3. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command         | Purpose              |
| --------------- | -------------------- |
| `npm run dev`   | Local development    |
| `npm run build` | Production build     |
| `npm run start` | Run production build |
| `npm run lint`  | ESLint               |

## Learning path

See [docs/LEARNING.md](docs/LEARNING.md) for milestones and concepts.

## Repo workflow (how we work)

We treat this like a real SWE project:

- Feature branches for bigger changes
- Small, clear commits
- Push to GitHub regularly
- PRs when a milestone is ready to “merge”

## Status

**Milestone 3** — local RAG. Open a folder path or a GitHub repo, then answers cite the files that were retrieved.
