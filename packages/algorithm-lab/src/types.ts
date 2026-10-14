/**
 * @growth-os/algorithm-lab: Core Types
 * Benchmarking, Retrieval Evaluation, Ranking Metrics & Drift Monitoring
 */

export type QueryIntent = 'informational' | 'commercial' | 'navigational' | 'transactional';

export interface BenchmarkDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  embeddingVector?: number[];
  lexicalTokens?: string[];
  features?: {
    readingLevel?: number;
    wordCount?: number;
    authorityScore?: number;
    freshnessDays?: number;
  };
}

export interface GroundTruthRelevance {
  [documentId: string]: number; // 0 = irrelevant, 1 = marginally relevant, 2 = relevant, 3 = highly authoritative/exact
}

export interface BenchmarkQuery {
  id: string;
  text: string;
  intent: QueryIntent;
  targetBrand: 'chatr' | 'talentxcel' | 'nutytales';
  groundTruth: GroundTruthRelevance;
}

export interface BenchmarkDataset {
  id: string;
  name: string;
  version: string;
  description: string;
  queries: BenchmarkQuery[];
  documentPool: BenchmarkDocument[];
  lineage: {
    createdAt: string;
    curator: string;
    samplingMethod: string;
    notes: string;
  };
}

export interface RankedResult {
  documentId: string;
  score: number;
  rank: number;
}

export interface RankingMetrics {
  ndcgAt5: number;
  ndcgAt10: number;
  mrr: number;
  precisionAt5: number;
  precisionAt10: number;
  recallAt10: number;
  map: number;
  intraListDistance?: number | undefined;
}

export interface EvaluationReport {
  datasetId: string;
  datasetVersion: string;
  modelOrStrategyName: string;
  totalQueriesEvaluated: number;
  meanMetrics: RankingMetrics;
  perQueryResults: Array<{
    queryId: string;
    queryText: string;
    intent: QueryIntent;
    metrics: RankingMetrics;
  }>;
  latencyMs: {
    totalMs: number;
    avgMsPerQuery: number;
    p95MsPerQuery: number;
  };
  driftAssessment: {
    isDrifting: boolean;
    degradedMetrics: string[];
    thresholdViolations: string[];
  };
  timestamp: string;
}
