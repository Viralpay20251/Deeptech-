/**
 * @growth-os/algorithm-lab: Curated Benchmark Datasets
 * Versioned ground-truth evaluation datasets for CHATR, TalentXcel, and Nuty Tales
 */

import type { BenchmarkDataset } from './types.js';

export const BENCHMARK_DATASET_V1: BenchmarkDataset = {
  id: 'ds-growth-benchmark-v1',
  name: 'Autonomous Growth OS Discovery & Ranking Benchmark',
  version: '1.0.0',
  description: 'Curated evaluation queries and candidate document pool covering CHATR, TalentXcel, and Nuty Tales',
  lineage: {
    createdAt: '2026-10-13T00:00:00.000Z',
    curator: 'Growth OS Evaluation Lead',
    samplingMethod: 'Stratified query intent sampling with domain expert relevance labels',
    notes: 'Ground truth relevance: 3=authoritative/exact, 2=relevant, 1=marginal, 0=irrelevant',
  },
  documentPool: [
    // --- CHATR Documents ---
    {
      id: 'doc-chatr-001',
      title: 'Shoppable Video AI: Converting Social Views into Immediate Checkout',
      content: 'In-depth guide on automated product tagging in interactive video commerce. Demonstrates zero-latency checkout overlays.',
      category: 'video_commerce',
      features: { readingLevel: 11, wordCount: 1450, authorityScore: 0.88, freshnessDays: 14 },
    },
    {
      id: 'doc-chatr-002',
      title: 'AI Conversational Commerce: Live Stream Product Discovery Architecture',
      content: 'Technical architecture for real-time natural language commerce bots operating inside high-volume live streams.',
      category: 'conversational_ai',
      features: { readingLevel: 12, wordCount: 2100, authorityScore: 0.92, freshnessDays: 28 },
    },
    {
      id: 'doc-chatr-003',
      title: 'Generic Video Marketing Trends 2026',
      content: 'Broad overview of video marketing without technical depth or direct checkout mechanics.',
      category: 'general_marketing',
      features: { readingLevel: 8, wordCount: 600, authorityScore: 0.40, freshnessDays: 60 },
    },
    // --- TalentXcel Documents ---
    {
      id: 'doc-talent-001',
      title: 'Executive Search Analytics: Evaluating Tech Leadership with Algorithmic Screening',
      content: 'Data-driven executive recruitment handbook. Uncovers bias reduction, structured talent scoring, and board-level hiring frameworks.',
      category: 'executive_search',
      features: { readingLevel: 13, wordCount: 1800, authorityScore: 0.91, freshnessDays: 10 },
    },
    {
      id: 'doc-talent-002',
      title: 'Compensation Intelligence for AI and Deep-Tech Engineers in 2026',
      content: 'Empirical benchmark report analyzing total compensation, equity vesting, and retention packages for principal researchers.',
      category: 'compensation_intel',
      features: { readingLevel: 11, wordCount: 2400, authorityScore: 0.95, freshnessDays: 7 },
    },
    {
      id: 'doc-talent-003',
      title: 'How to Write a Standard Job Description',
      content: 'Introductory HR advice on writing standard bulleted job specs.',
      category: 'hr_basics',
      features: { readingLevel: 7, wordCount: 500, authorityScore: 0.35, freshnessDays: 90 },
    },
    // --- Nuty Tales Documents ---
    {
      id: 'doc-nuty-001',
      title: 'Personalized Audio Storytelling: Neurodevelopmental Benefits for Early Childhood',
      content: 'Clinical and pedagogical research on bedtime audio storytelling, cognitive vocabulary expansion, and screen-free routines.',
      category: 'child_education',
      features: { readingLevel: 10, wordCount: 1650, authorityScore: 0.89, freshnessDays: 20 },
    },
    {
      id: 'doc-nuty-002',
      title: 'Interactive Bedtime Tales: Screen-Free Audio Adventures for Ages 3-8',
      content: 'Curated audio library overview with immersive sound effects and customizable moral fables for toddlers and young readers.',
      category: 'audio_stories',
      features: { readingLevel: 9, wordCount: 1200, authorityScore: 0.85, freshnessDays: 15 },
    },
    {
      id: 'doc-nuty-003',
      title: 'Top 10 Children Toys for Holiday Gift Giving',
      content: 'Affiliate compilation of plastic toys and seasonal discounts.',
      category: 'commercial_toys',
      features: { readingLevel: 6, wordCount: 750, authorityScore: 0.30, freshnessDays: 45 },
    },
    // --- Control Distractors ---
    {
      id: 'doc-distract-001',
      title: 'Low Quality Aggregator: Download Free PDFs Online',
      content: 'Keyword-stuffed directory page with thin content and repetitive anchor text.',
      category: 'spam_distractor',
      features: { readingLevel: 5, wordCount: 200, authorityScore: 0.05, freshnessDays: 120 },
    },
  ],
  queries: [
    {
      id: 'query-chatr-01',
      text: 'interactive shoppable video commerce software',
      intent: 'commercial',
      targetBrand: 'chatr',
      groundTruth: {
        'doc-chatr-001': 3,
        'doc-chatr-002': 2,
        'doc-chatr-003': 1,
        'doc-talent-001': 0,
        'doc-distract-001': 0,
      },
    },
    {
      id: 'query-chatr-02',
      text: 'how to integrate checkout into live stream video',
      intent: 'informational',
      targetBrand: 'chatr',
      groundTruth: {
        'doc-chatr-002': 3,
        'doc-chatr-001': 2,
        'doc-chatr-003': 0,
        'doc-distract-001': 0,
      },
    },
    {
      id: 'query-talent-01',
      text: 'executive search benchmark deep tech engineering salaries',
      intent: 'commercial',
      targetBrand: 'talentxcel',
      groundTruth: {
        'doc-talent-002': 3,
        'doc-talent-001': 2,
        'doc-talent-003': 0,
        'doc-chatr-001': 0,
        'doc-distract-001': 0,
      },
    },
    {
      id: 'query-nuty-01',
      text: 'screen free bedtime audio stories for toddlers vocabulary',
      intent: 'informational',
      targetBrand: 'nutytales',
      groundTruth: {
        'doc-nuty-001': 3,
        'doc-nuty-002': 3,
        'doc-nuty-003': 0,
        'doc-distract-001': 0,
      },
    },
  ],
};
