# Forge learning path

Each milestone builds a skill used in real software engineering / AI product work.

## Milestone 0 — Scaffold (done)

- Git + GitHub
- Next.js / TypeScript project layout
- README and local `npm run dev`

**Concepts:** repos, remotes, commits, package managers, frontend frameworks

---

## Milestone 1 — Chat UI + API route (done)

- Chat workspace UI (`ChatShell`)
- `POST /api/chat` streams a stub reply (text/plain)
- Client reads the stream and updates the assistant message live

**Concepts:** HTTP APIs, request/response, React state, streaming

**Try it:** `npm run dev` → type a question → watch the reply stream in.

---

## Milestone 2 — Connect a real LLM (done)

- Free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey)
- `GEMINI_API_KEY` in `.env.local` (never commit)
- `POST /api/chat` streams real model tokens via `@google/genai`
- Default model: `gemini-3.5-flash-lite` (override with `GEMINI_MODEL`)

**Concepts:** API keys, server vs client, cost & rate limits, system prompts

**Setup:**
1. Create a key at AI Studio
2. Copy `.env.example` → `.env.local` and paste the key
3. Restart `npm run dev`

---

## Milestone 3 — Index a small codebase (RAG) (done)

- `POST /api/index` walks this repo, chunks files, and embeds them with Gemini
- Vectors live in `.forge/index.json` (gitignored — regenerated locally)
- Each chat question embeds the query, finds the closest chunks, and cites them
- Reindex reuses vectors for unchanged chunks. The free tier allows about 100 embedding requests per minute.

**Concepts:** RAG, embeddings, vector search, grounding / citations

**Try it:** click **Index repo**, then ask “Where does chat streaming happen?”

---

## Milestone 4 — Persistence + structure

- Save projects / chats (database)
- Clean service layer (not everything in route handlers)

**Concepts:** data modeling, services vs controllers, migrations

---

## Milestone 5 — Ship it

- Docker
- Deploy (e.g. Vercel or a VPS)
- Basic logging / error handling

**Concepts:** environments, containers, observability

---

## How to use this with Auto

At the start of a session, say which milestone you want next. We’ll implement it, then pause so you understand *why* each piece exists before moving on.
