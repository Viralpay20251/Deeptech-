/**
 * @growth-os/algorithm-lab: Hybrid Retrieval & Fusion Engine
 * Implements:
 * 1. Reciprocal Rank Fusion (RRF, Cormack et al. 2009, k=60)
 * 2. Linear Score Fusion (Min-Max Normalized)
 * 3. Diversity / Visibility Reranking (Modeled after x-algorithm filters)
 */

import type { RankedResult, BenchmarkDocument } from './types.js';

export interface FusionInput {
  sparseRankList: Array<{ documentId: string; score: number }>;
  denseRankList: Array<{ documentId: string; score: number }>;
}

/**
 * Computes Reciprocal Rank Fusion (RRF) across sparse and dense candidate rank lists.
 * Standard RRF formula: RRF_score(d) = sum_{m in M} 1 / (k + rank_m(d))
 * where rank_m(d) is 1-indexed.
 */
export function reciprocalRankFusion(
  inputs: FusionInput,
  k = 60
): RankedResult[] {
  const scoreMap = new Map<string, number>();

  // Process sparse rank list
  inputs.sparseRankList.forEach((item, index) => {
    const rank = index + 1; // 1-indexed
    const rrfScore = 1 / (k + rank);
    scoreMap.set(item.documentId, (scoreMap.get(item.documentId) ?? 0) + rrfScore);
  });

  // Process dense rank list
  inputs.denseRankList.forEach((item, index) => {
    const rank = index + 1; // 1-indexed
    const rrfScore = 1 / (k + rank);
    scoreMap.set(item.documentId, (scoreMap.get(item.documentId) ?? 0) + rrfScore);
  });

  // Sort candidates by combined RRF score descending
  const sorted = Array.from(scoreMap.entries())
    .map(([documentId, score]) => ({ documentId, score }))
    .sort((a, b) => b.score - a.score);

  return sorted.map((item, index) => ({
    documentId: item.documentId,
    score: Number(item.score.toFixed(6)),
    rank: index + 1,
  }));
}

/**
 * Normalizes scores to [0, 1] range using min-max scaling
 */
function minMaxNormalize(items: Array<{ documentId: string; score: number }>): Map<string, number> {
  const normMap = new Map<string, number>();
  if (items.length === 0) return normMap;

  let min = items[0]!.score;
  let max = items[0]!.score;

  for (const item of items) {
    if (item.score < min) min = item.score;
    if (item.score > max) max = item.score;
  }

  const range = max - min;
  for (const item of items) {
    const norm = range === 0 ? 1 : (item.score - min) / range;
    normMap.set(item.documentId, norm);
  }

  return normMap;
}

/**
 * Weighted Linear Fusion of Sparse and Dense scores
 */
export function linearWeightedFusion(
  inputs: FusionInput,
  sparseWeight = 0.4,
  denseWeight = 0.6
): RankedResult[] {
  const normSparse = minMaxNormalize(inputs.sparseRankList);
  const normDense = minMaxNormalize(inputs.denseRankList);

  const allDocIds = new Set([
    ...inputs.sparseRankList.map((x) => x.documentId),
    ...inputs.denseRankList.map((x) => x.documentId),
  ]);

  const results: Array<{ documentId: string; score: number }> = [];

  for (const docId of allDocIds) {
    const s = normSparse.get(docId) ?? 0;
    const d = normDense.get(docId) ?? 0;
    const combined = sparseWeight * s + denseWeight * d;
    results.push({ documentId: docId, score: combined });
  }

  results.sort((a, b) => b.score - a.score);

  return results.map((item, index) => ({
    documentId: item.documentId,
    score: Number(item.score.toFixed(4)),
    rank: index + 1,
  }));
}

/**
 * Diversity Reranker / Visibility Filter
 * Modeled after x-algorithm & LinkedIn sequential filters:
 * Prevents consecutive items from the same category/author dominating the top ranks.
 */
export function applyDiversityFilter(
  rankedList: RankedResult[],
  documentMap: Map<string, BenchmarkDocument>,
  maxConsecutivePerCategory = 2
): RankedResult[] {
  const reranked: RankedResult[] = [];
  const remaining = [...rankedList];
  let lastCategory = '';
  let consecutiveCount = 0;

  while (remaining.length > 0) {
    // Find the highest ranked item that does not violate consecutive category limits
    let chosenIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const doc = documentMap.get(candidate.documentId);
      const cat = doc?.category ?? 'default';

      if (cat === lastCategory && consecutiveCount >= maxConsecutivePerCategory) {
        // Skip candidate for now to inject diversity
        continue;
      }

      chosenIndex = i;
      break;
    }

    // If all remaining candidates match the same category, take the next available
    if (chosenIndex === -1) {
      chosenIndex = 0;
    }

    const [selected] = remaining.splice(chosenIndex, 1);
    const selDoc = documentMap.get(selected!.documentId);
    const selCat = selDoc?.category ?? 'default';

    if (selCat === lastCategory) {
      consecutiveCount++;
    } else {
      lastCategory = selCat;
      consecutiveCount = 1;
    }

    reranked.push({
      documentId: selected!.documentId,
      score: selected!.score,
      rank: reranked.length + 1,
    });
  }

  return reranked;
}
