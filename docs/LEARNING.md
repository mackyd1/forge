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

## Milestone 2 — Connect a real LLM

- Env vars / secrets (never commit keys)
- Call OpenAI or Anthropic
- Basic prompt design

**Concepts:** API keys, server vs client, cost & rate limits

---

## Milestone 3 — Index a small codebase (RAG)

- Split files into chunks
- Embeddings + store vectors
- Retrieve relevant chunks before answering

**Concepts:** RAG, embeddings, vector search, grounding / citations

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
