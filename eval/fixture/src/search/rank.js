/**
 * Rank documents by a simple TF score for the query terms.
 */
export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_]+/g) || []).filter(
    (token) => token.length > 1,
  );
}

export function scoreDocument(query, document) {
  const queryTerms = new Set(tokenize(query));
  const docTerms = tokenize(document);
  let score = 0;
  for (const term of docTerms) {
    if (queryTerms.has(term)) score += 1;
  }
  return score;
}

export function rankDocuments(query, documents, topK = 5) {
  return documents
    .map((document, index) => ({
      index,
      score: scoreDocument(query, document),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function reciprocalRankFusion(rankedLists, k = 60) {
  const fused = new Map();
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      const contrib = 1 / (k + rank + 1);
      fused.set(id, (fused.get(id) || 0) + contrib);
    });
  }
  return [...fused.entries()].sort((a, b) => b[1] - a[1]);
}
