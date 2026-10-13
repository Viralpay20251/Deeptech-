/**
 * @growth-os/algorithm-lab: Mathematical Ranking Metrics
 * Implements standard IR & recommender metrics:
 * - NDCG@k (Normalized Discounted Cumulative Gain)
 * - MRR (Mean Reciprocal Rank)
 * - Precision@k
 * - Recall@k
 * - MAP (Mean Average Precision)
 * - Intra-List Distance (ILD for diversity)
 */

import type { RankedResult, GroundTruthRelevance, RankingMetrics, BenchmarkDocument } from './types.js';

/**
 * Calculates Discounted Cumulative Gain (DCG) at rank k
 * Formula: sum_{i=1}^k (2^{rel_i} - 1) / log2(i + 1)
 */
export function calculateDCG(rankedDocIds: string[], groundTruth: GroundTruthRelevance, k: number): number {
  let dcg = 0;
  const limit = Math.min(rankedDocIds.length, k);

  for (let i = 0; i < limit; i++) {
    const docId = rankedDocIds[i]!;
    const rel = groundTruth[docId] ?? 0;
    const numerator = Math.pow(2, rel) - 1;
    const denominator = Math.log2(i + 2); // i=0 => rank 1 => log2(2) = 1
    dcg += numerator / denominator;
  }

  return dcg;
}

/**
 * Calculates Ideal DCG (IDCG) at rank k
 */
export function calculateIDCG(groundTruth: GroundTruthRelevance, k: number): number {
  const sortedRelevances = Object.values(groundTruth).sort((a, b) => b - a);
  let idcg = 0;
  const limit = Math.min(sortedRelevances.length, k);

  for (let i = 0; i < limit; i++) {
    const rel = sortedRelevances[i]!;
    const numerator = Math.pow(2, rel) - 1;
    const denominator = Math.log2(i + 2);
    idcg += numerator / denominator;
  }

  return idcg;
}

/**
 * Calculates Normalized Discounted Cumulative Gain (NDCG) at rank k
 */
export function calculateNDCG(rankedDocIds: string[], groundTruth: GroundTruthRelevance, k: number): number {
  const idcg = calculateIDCG(groundTruth, k);
  if (idcg === 0) return 0;
  const dcg = calculateDCG(rankedDocIds, groundTruth, k);
  return Math.min(1, Math.max(0, dcg / idcg));
}

/**
 * Calculates Reciprocal Rank (RR) for the first relevant document (rel >= minRelevance)
 */
export function calculateRR(rankedDocIds: string[], groundTruth: GroundTruthRelevance, minRelevance = 1): number {
  for (let i = 0; i < rankedDocIds.length; i++) {
    const docId = rankedDocIds[i]!;
    const rel = groundTruth[docId] ?? 0;
    if (rel >= minRelevance) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Calculates Precision at rank k (rel >= minRelevance)
 */
export function calculatePrecisionAtK(
  rankedDocIds: string[],
  groundTruth: GroundTruthRelevance,
  k: number,
  minRelevance = 1
): number {
  if (k <= 0) return 0;
  const limit = Math.min(rankedDocIds.length, k);
  let relevantCount = 0;

  for (let i = 0; i < limit; i++) {
    const docId = rankedDocIds[i]!;
    const rel = groundTruth[docId] ?? 0;
    if (rel >= minRelevance) {
      relevantCount++;
    }
  }

  return relevantCount / k;
}

/**
 * Calculates Recall at rank k (rel >= minRelevance)
 */
export function calculateRecallAtK(
  rankedDocIds: string[],
  groundTruth: GroundTruthRelevance,
  k: number,
  minRelevance = 1
): number {
  const totalRelevant = Object.values(groundTruth).filter((r) => r >= minRelevance).length;
  if (totalRelevant === 0) return 1; // Trivially 1 if no relevant docs exist

  const limit = Math.min(rankedDocIds.length, k);
  let relevantRetrieved = 0;

  for (let i = 0; i < limit; i++) {
    const docId = rankedDocIds[i]!;
    const rel = groundTruth[docId] ?? 0;
    if (rel >= minRelevance) {
      relevantRetrieved++;
    }
  }

  return Math.min(1, relevantRetrieved / totalRelevant);
}

/**
 * Calculates Average Precision (AP) for a single query
 */
export function calculateAP(rankedDocIds: string[], groundTruth: GroundTruthRelevance, minRelevance = 1): number {
  const totalRelevant = Object.values(groundTruth).filter((r) => r >= minRelevance).length;
  if (totalRelevant === 0) return 0;

  let cumulativeRelevant = 0;
  let sumPrecision = 0;

  for (let i = 0; i < rankedDocIds.length; i++) {
    const docId = rankedDocIds[i]!;
    const rel = groundTruth[docId] ?? 0;
    if (rel >= minRelevance) {
      cumulativeRelevant++;
      sumPrecision += cumulativeRelevant / (i + 1);
    }
  }

  return sumPrecision / totalRelevant;
}

/**
 * Calculates Intra-List Distance (ILD) across top-k items
 * Uses category distance: 0 if same category, 1 if different category
 */
export function calculateILD(
  rankedDocIds: string[],
  documentMap: Map<string, BenchmarkDocument>,
  k = 10
): number {
  const limit = Math.min(rankedDocIds.length, k);
  if (limit <= 1) return 0;

  let totalDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < limit; i++) {
    const docA = documentMap.get(rankedDocIds[i]!);
    for (let j = i + 1; j < limit; j++) {
      const docB = documentMap.get(rankedDocIds[j]!);
      if (docA && docB) {
        // Distance is 1 if categories differ, 0 if identical
        const distance = docA.category === docB.category ? 0 : 1;
        totalDistance += distance;
        pairCount++;
      }
    }
  }

  return pairCount === 0 ? 0 : Number((totalDistance / pairCount).toFixed(4));
}

/**
 * Computes the full suite of ranking metrics for a ranked list
 */
export function computeRankingMetrics(
  rankedDocIds: string[],
  groundTruth: GroundTruthRelevance,
  documentMap?: Map<string, BenchmarkDocument>
): RankingMetrics {
  return {
    ndcgAt5: Number(calculateNDCG(rankedDocIds, groundTruth, 5).toFixed(4)),
    ndcgAt10: Number(calculateNDCG(rankedDocIds, groundTruth, 10).toFixed(4)),
    mrr: Number(calculateRR(rankedDocIds, groundTruth, 1).toFixed(4)),
    precisionAt5: Number(calculatePrecisionAtK(rankedDocIds, groundTruth, 5, 1).toFixed(4)),
    precisionAt10: Number(calculatePrecisionAtK(rankedDocIds, groundTruth, 10, 1).toFixed(4)),
    recallAt10: Number(calculateRecallAtK(rankedDocIds, groundTruth, 10, 1).toFixed(4)),
    map: Number(calculateAP(rankedDocIds, groundTruth, 1).toFixed(4)),
    intraListDistance: documentMap ? calculateILD(rankedDocIds, documentMap, 10) : undefined,
  };
}
