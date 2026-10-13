/**
 * Automated Verification Suite: Algorithm Benchmark Laboratory
 * Tests IR ranking metrics, Reciprocal Rank Fusion, Diversity Filtering & Drift Detection
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDCG,
  calculateIDCG,
  calculateNDCG,
  calculateRR,
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateAP,
  calculateILD,
  computeRankingMetrics,
  reciprocalRankFusion,
  linearWeightedFusion,
  applyDiversityFilter,
  AlgorithmBenchmarkLab,
  BENCHMARK_DATASET_V1,
  type BenchmarkDocument,
} from '../../packages/algorithm-lab/src/index.js';

describe('Algorithm Lab: IR & Ranking Metrics', () => {
  const groundTruth = {
    'doc-1': 3,
    'doc-2': 2,
    'doc-3': 1,
    'doc-4': 0,
  };

  it('calculates DCG, IDCG, and NDCG accurately', () => {
    // Ideal ranking: ['doc-1', 'doc-2', 'doc-3', 'doc-4']
    const idcg = calculateIDCG(groundTruth, 3);
    // doc-1 (rel 3) => (2^3 - 1) / log2(2) = 7 / 1 = 7
    // doc-2 (rel 2) => (2^2 - 1) / log2(3) = 3 / 1.58496 = 1.89279
    // doc-3 (rel 1) => (2^1 - 1) / log2(4) = 1 / 2 = 0.5
    // Sum = 7 + 1.89279 + 0.5 = 9.39279
    expect(idcg).toBeGreaterThan(9.39);
    expect(idcg).toBeLessThan(9.40);

    // Perfect ranking NDCG must equal 1.0
    const perfectNdcg = calculateNDCG(['doc-1', 'doc-2', 'doc-3', 'doc-4'], groundTruth, 3);
    expect(perfectNdcg).toBeCloseTo(1.0, 4);

    // Suboptimal ranking: ['doc-4', 'doc-3', 'doc-2', 'doc-1']
    const suboptimalNdcg = calculateNDCG(['doc-4', 'doc-3', 'doc-2', 'doc-1'], groundTruth, 3);
    expect(suboptimalNdcg).toBeLessThan(0.5);
  });

  it('calculates Reciprocal Rank (MRR component) correctly', () => {
    // First relevant doc (rel >= 1) is at rank 1
    expect(calculateRR(['doc-1', 'doc-4'], groundTruth)).toBe(1.0);
    // First relevant doc is at rank 2
    expect(calculateRR(['doc-4', 'doc-2', 'doc-1'], groundTruth)).toBe(0.5);
    // First relevant doc is at rank 3
    expect(calculateRR(['doc-4', 'doc-unknown', 'doc-3'], groundTruth)).toBeCloseTo(0.3333, 3);
    // No relevant docs found
    expect(calculateRR(['doc-4', 'doc-none'], groundTruth)).toBe(0);
  });

  it('calculates Precision@k and Recall@k', () => {
    // Relevant items: doc-1, doc-2, doc-3 (total 3)
    const retrieved = ['doc-1', 'doc-4', 'doc-2', 'doc-5'];

    // At k=2: retrieved doc-1 (rel) and doc-4 (not rel) => 1/2 = 0.5
    expect(calculatePrecisionAtK(retrieved, groundTruth, 2)).toBe(0.5);

    // At k=4: retrieved doc-1 (rel), doc-4, doc-2 (rel), doc-5 => 2/4 = 0.5
    expect(calculatePrecisionAtK(retrieved, groundTruth, 4)).toBe(0.5);

    // Recall at k=4: retrieved 2 out of 3 relevant => 2/3 = 0.6667
    expect(calculateRecallAtK(retrieved, groundTruth, 4)).toBeCloseTo(0.6667, 3);
  });

  it('calculates Average Precision (AP)', () => {
    // Relevant at ranks 1, 3:
    // rank 1: P=1/1 = 1.0
    // rank 2: irrelevant
    // rank 3: P=2/3 = 0.6667
    // Total relevant in ground truth = 3. Sum P = 1.6667 / 3 = 0.5556
    const retrieved = ['doc-1', 'doc-4', 'doc-2'];
    expect(calculateAP(retrieved, groundTruth)).toBeCloseTo(0.5556, 3);
  });
});

describe('Algorithm Lab: Hybrid Fusion & Diversity Reranking', () => {
  it('combines sparse and dense lists using Reciprocal Rank Fusion (k=60)', () => {
    const sparse = [
      { documentId: 'doc-A', score: 12.5 },
      { documentId: 'doc-B', score: 9.8 },
      { documentId: 'doc-C', score: 5.1 },
    ];
    const dense = [
      { documentId: 'doc-B', score: 0.88 },
      { documentId: 'doc-A', score: 0.82 },
      { documentId: 'doc-D', score: 0.75 },
    ];

    const fused = reciprocalRankFusion({ sparseRankList: sparse, denseRankList: dense }, 60);

    // doc-A: 1/(60+1) + 1/(60+2) = 0.016393 + 0.016129 = 0.032522
    // doc-B: 1/(60+2) + 1/(60+1) = 0.016129 + 0.016393 = 0.032522
    // Both doc-A and doc-B should be top-ranked above doc-C and doc-D
    expect(fused.length).toBe(4);
    expect(['doc-A', 'doc-B']).toContain(fused[0]!.documentId);
    expect(['doc-A', 'doc-B']).toContain(fused[1]!.documentId);
    expect(fused[0]!.score).toBeGreaterThan(fused[2]!.score);
  });

  it('performs linear weighted fusion', () => {
    const sparse = [
      { documentId: 'doc-A', score: 10 },
      { documentId: 'doc-B', score: 0 },
    ];
    const dense = [
      { documentId: 'doc-A', score: 0.2 },
      { documentId: 'doc-B', score: 1.0 },
    ];

    // If denseWeight is 0.9, doc-B should win because its dense score is maximum
    const fusedDenseDominant = linearWeightedFusion(
      { sparseRankList: sparse, denseRankList: dense },
      0.1,
      0.9
    );
    expect(fusedDenseDominant[0]!.documentId).toBe('doc-B');

    // If sparseWeight is 0.9, doc-A should win
    const fusedSparseDominant = linearWeightedFusion(
      { sparseRankList: sparse, denseRankList: dense },
      0.9,
      0.1
    );
    expect(fusedSparseDominant[0]!.documentId).toBe('doc-A');
  });

  it('enforces diversity filter limiting consecutive category dominance', () => {
    const docMap = new Map<string, BenchmarkDocument>([
      ['doc-1', { id: 'doc-1', title: 'T1', content: '', category: 'finance' }],
      ['doc-2', { id: 'doc-2', title: 'T2', content: '', category: 'finance' }],
      ['doc-3', { id: 'doc-3', title: 'T3', content: '', category: 'finance' }],
      ['doc-4', { id: 'doc-4', title: 'T4', content: '', category: 'engineering' }],
    ]);

    const initial = [
      { documentId: 'doc-1', score: 0.9, rank: 1 },
      { documentId: 'doc-2', score: 0.8, rank: 2 },
      { documentId: 'doc-3', score: 0.7, rank: 3 },
      { documentId: 'doc-4', score: 0.6, rank: 4 },
    ];

    // Max consecutive = 2. doc-1 and doc-2 are finance, so doc-4 (engineering) must be promoted to rank 3
    const diversified = applyDiversityFilter(initial, docMap, 2);
    expect(diversified[0]!.documentId).toBe('doc-1');
    expect(diversified[1]!.documentId).toBe('doc-2');
    expect(diversified[2]!.documentId).toBe('doc-4'); // Engineering injected
    expect(diversified[3]!.documentId).toBe('doc-3'); // 3rd finance pushed down
  });
});

describe('Algorithm Lab: Offline Evaluation & Drift Detection', () => {
  it('runs full evaluation report and detects drift when model degrades', async () => {
    const lab = new AlgorithmBenchmarkLab(BENCHMARK_DATASET_V1);

    // High performance strategy: prioritizes exact ground truth
    const highPerfStrategy = {
      name: 'HighQualityDualEncoder',
      rank: (queryText: string, docs: BenchmarkDocument[]) => {
        // Return documents matching the target brand topic
        if (queryText.includes('shoppable video')) {
          return ['doc-chatr-001', 'doc-chatr-002', 'doc-chatr-003'];
        }
        if (queryText.includes('live stream')) {
          return ['doc-chatr-002', 'doc-chatr-001', 'doc-distract-001'];
        }
        if (queryText.includes('salaries')) {
          return ['doc-talent-002', 'doc-talent-001', 'doc-talent-003'];
        }
        if (queryText.includes('bedtime audio')) {
          return ['doc-nuty-001', 'doc-nuty-002', 'doc-nuty-003'];
        }
        return docs.map((d) => d.id);
      },
    };

    const highReport = await lab.evaluateStrategy(highPerfStrategy);
    expect(highReport.totalQueriesEvaluated).toBe(4);
    expect(highReport.meanMetrics.ndcgAt10).toBeGreaterThanOrEqual(0.85);
    expect(highReport.meanMetrics.mrr).toBeGreaterThanOrEqual(0.9);
    expect(highReport.driftAssessment.isDrifting).toBe(false);

    // Degraded / Random strategy
    const degradedStrategy = {
      name: 'DegradedRandomRanker',
      rank: () => ['doc-distract-001', 'doc-chatr-003', 'doc-talent-003'],
    };

    const degradedReport = await lab.evaluateStrategy(degradedStrategy);
    expect(degradedReport.driftAssessment.isDrifting).toBe(true);
    expect(degradedReport.driftAssessment.thresholdViolations.length).toBeGreaterThan(0);
  });
});
