# Retrieval

Forge indexes a repository into overlapping or AST-bounded chunks, embeds them with Gemini, and answers with citations.

## Chunking

- **TypeScript / JavaScript / Python:** Tree-sitter (`web-tree-sitter` + `tree-sitter-wasms`) prefers function and class bodies. Oversized classes are split into methods. Oversized nodes fall back to line windows inside that span.
- **Everything else:** overlapping line windows (`MAX_CHARS` / `MAX_LINES` in `src/lib/rag/chunk.ts`).
- Unchanged chunk text reuses cached embeddings via SHA-256 hashes in `buildCodeIndex`.

## Hybrid ranking

`retrieve()` fuses two ranked lists with **Reciprocal Rank Fusion (RRF)**:

1. **Dense:** cosine similarity against Gemini query embeddings (`RETRIEVAL_QUERY`).
2. **Sparse:** Okapi BM25 over path + chunk text (`src/lib/rag/bm25.ts`).

```
score(d) = Σ_lists 1 / (60 + rank_list(d))
```

RRF is used instead of a weighted sum so BM25 and cosine do not need score calibration. Production default mode is `hybrid`; eval can compare `vector`, `bm25`, and `hybrid`.

## Eval

```bash
npm run eval
```

Runs the fixture suite under `eval/` and prints recall@k / citation hit rate for line-window vs Tree-sitter + hybrid. See README for the latest measured numbers.
