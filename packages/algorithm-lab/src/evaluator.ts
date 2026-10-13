/**
 * @growth-os/algorithm-lab: Evaluation Harness & Drift Detector
 * Runs offline evaluations, benchmarks latency, and detects model degradation/drift.
 */

import type {
  BenchmarkDataset,
  EvaluationReport,
  RankingMetrics,
  BenchmarkDocument,
} from './types.js';
import { computeRankingMetrics } from './metrics.js';

export interface RankingStrategy {
  name: string;
  rank(queryText: string, documents: BenchmarkDocument[]): Promise<string[]> | string[];
}

export interface DriftThresholds {
  minNdcgAt10: number;
  minMrr: number;
  minPrecisionAt5: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  minNdcgAt10: 0.70,
  minMrr: 0.65,
  minPrecisionAt5: 0.40,
};

export class AlgorithmBenchmarkLab {
  private documentMap: Map<string, BenchmarkDocument>;

  constructor(private dataset: BenchmarkDataset) {
    this.documentMap = new Map();
    for (const doc of dataset.documentPool) {
      this.documentMap.set(doc.id, doc);
    }
  }

  /**
   * Executes full offline evaluation for a given ranking strategy against the dataset
   */
  async evaluateStrategy(
    strategy: RankingStrategy,
    thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS
  ): Promise<EvaluationReport> {
    const startTime = performance.now();
    const queryLatencies: number[] = [];
    const perQueryResults: EvaluationReport['perQueryResults'] = [];

    const metricAccumulator = {
      ndcgAt5: 0,
      ndcgAt10: 0,
      mrr: 0,
      precisionAt5: 0,
      precisionAt10: 0,
      recallAt10: 0,
      map: 0,
      intraListDistance: 0,
    };

    for (const query of this.dataset.queries) {
      const qStart = performance.now();
      const rankedDocIds = await strategy.rank(query.text, this.dataset.documentPool);
      const qDuration = performance.now() - qStart;
      queryLatencies.push(qDuration);

      const metrics = computeRankingMetrics(rankedDocIds, query.groundTruth, this.documentMap);

      metricAccumulator.ndcgAt5 += metrics.ndcgAt5;
      metricAccumulator.ndcgAt10 += metrics.ndcgAt10;
      metricAccumulator.mrr += metrics.mrr;
      metricAccumulator.precisionAt5 += metrics.precisionAt5;
      metricAccumulator.precisionAt10 += metrics.precisionAt10;
      metricAccumulator.recallAt10 += metrics.recallAt10;
      metricAccumulator.map += metrics.map;
      if (metrics.intraListDistance !== undefined) {
        metricAccumulator.intraListDistance += metrics.intraListDistance;
      }

      perQueryResults.push({
        queryId: query.id,
        queryText: query.text,
        intent: query.intent,
        metrics,
      });
    }

    const totalDuration = performance.now() - startTime;
    const queryCount = this.dataset.queries.length;

    const meanMetrics: RankingMetrics = {
      ndcgAt5: Number((metricAccumulator.ndcgAt5 / queryCount).toFixed(4)),
      ndcgAt10: Number((metricAccumulator.ndcgAt10 / queryCount).toFixed(4)),
      mrr: Number((metricAccumulator.mrr / queryCount).toFixed(4)),
      precisionAt5: Number((metricAccumulator.precisionAt5 / queryCount).toFixed(4)),
      precisionAt10: Number((metricAccumulator.precisionAt10 / queryCount).toFixed(4)),
      recallAt10: Number((metricAccumulator.recallAt10 / queryCount).toFixed(4)),
      map: Number((metricAccumulator.map / queryCount).toFixed(4)),
      intraListDistance: Number((metricAccumulator.intraListDistance / queryCount).toFixed(4)),
    };

    // Calculate p95 latency
    const sortedLatencies = [...queryLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies[p95Index] ?? 0;

    // Check drift thresholds
    const degradedMetrics: string[] = [];
    const thresholdViolations: string[] = [];

    if (meanMetrics.ndcgAt10 < thresholds.minNdcgAt10) {
      degradedMetrics.push('ndcgAt10');
      thresholdViolations.push(`NDCG@10 (${meanMetrics.ndcgAt10}) < threshold (${thresholds.minNdcgAt10})`);
    }

    if (meanMetrics.mrr < thresholds.minMrr) {
      degradedMetrics.push('mrr');
      thresholdViolations.push(`MRR (${meanMetrics.mrr}) < threshold (${thresholds.minMrr})`);
    }

    if (meanMetrics.precisionAt5 < thresholds.minPrecisionAt5) {
      degradedMetrics.push('precisionAt5');
      thresholdViolations.push(`Precision@5 (${meanMetrics.precisionAt5}) < threshold (${thresholds.minPrecisionAt5})`);
    }

    return {
      datasetId: this.dataset.id,
      datasetVersion: this.dataset.version,
      modelOrStrategyName: strategy.name,
      totalQueriesEvaluated: queryCount,
      meanMetrics,
      perQueryResults,
      latencyMs: {
        totalMs: Number(totalDuration.toFixed(2)),
        avgMsPerQuery: Number((totalDuration / queryCount).toFixed(2)),
        p95MsPerQuery: Number(p95Latency.toFixed(2)),
      },
      driftAssessment: {
        isDrifting: thresholdViolations.length > 0,
        degradedMetrics,
        thresholdViolations,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
