/**
 * Autonomous Growth OS — Search Intelligence Agent
 *
 * Combines Google Search Console query trend intelligence (inspired by DafinEdison)
 * and edge AEO / GEO deliverability auditing (inspired by Citeworthy) within a
 * safe, non-destructive diagnostic pipeline.
 */

import { BaseAgent, type AgentExecutionContext, type AgentExecutionOutput } from './base-agent.js';
import { AntiWordsFilter } from './anti-words.js';

export interface GscQueryRecord {
  query: string;
  pageUrl: string;
  impressions: number;
  clicks: number;
  ctr: number; // e.g. 0.03 = 3%
  position: number; // 1-indexed average SERP position
  previousPosition?: number;
  previousClicks?: number;
}

export type GscOpportunityCategory =
  | 'striking_distance'       // Position 11-20 with high impressions
  | 'high_impression_low_ctr' // Top 5 but underperforming CTR (rewrite title/snippet)
  | 'declining_query'         // Dropped >= 3 positions or lost >= 20% clicks
  | 'quick_win'               // Position 4-10 with healthy CTR (link injection candidate)
  | 'emerging_demand';

export interface ClassifiedOpportunity {
  query: string;
  pageUrl: string;
  category: GscOpportunityCategory;
  priorityScore: number; // 0 to 100
  rationale: string;
  recommendedAction: string;
}

export interface AeoAuditResult {
  url: string;
  isAiDeliverable: boolean;
  findings: Array<{
    rule: string;
    severity: 'critical' | 'high' | 'medium' | 'info';
    message: string;
  }>;
  wordCount: number;
  hasStructuredData: boolean;
}

export interface SearchContentBrief {
  targetQuery: string;
  category: GscOpportunityCategory;
  suggestedTitle: string;
  suggestedMetaDescription: string;
  keyTopicsToCover: string[];
  internalLinkTargets: string[];
  cleanlinessScore: number;
}

export class SearchIntelligenceAgent extends BaseAgent {
  constructor() {
    super({
      name: 'AegisSearch',
      agentType: 'search_intelligence',
      title: 'Autonomous Search & AEO Strategist',
      roleDescription:
        'Analyzes Google Search Console search performance, uncovers striking-distance queries, audits AEO/GEO crawler deliverability, and drafts high-utility content briefs.',
      toneGuidelines: [
        'Analytical, rigorous, and completely factual',
        'Prioritize user utility and depth over superficial keyword stuffing',
        'Adhere to Google Search Essentials and Scaled Content Abuse boundaries',
      ],
      allowedTools: ['gsc_query', 'sitemap_crawl', 'aeo_audit', 'content_brief'],
      prohibitedActions: [
        'publish_directly_to_production',
        'create_unverified_pbn_backlinks',
        'generate_thin_programmatic_spams',
      ],
    });
  }

  /**
   * Classify GSC queries into high-conviction growth opportunities.
   */
  public classifyQueries(records: GscQueryRecord[]): ClassifiedOpportunity[] {
    this.assertToolAllowed('gsc_query');

    const opportunities: ClassifiedOpportunity[] = [];

    for (const record of records) {
      // 1. Striking Distance: Ranks 11 - 20 with significant search impression volume
      if (record.position >= 11 && record.position <= 20 && record.impressions >= 100) {
        opportunities.push({
          query: record.query,
          pageUrl: record.pageUrl,
          category: 'striking_distance',
          priorityScore: Math.min(95, 70 + Math.floor(record.impressions / 100)),
          rationale: `Query "${record.query}" ranks on page 2 (pos ${record.position.toFixed(1)}) with ${record.impressions} impressions. Targeted content depth will push it into the top 10.`,
          recommendedAction: 'Expand page depth with original data, update schema markup, and add internal links.',
        });
      }

      // 2. High Impression, Low CTR: Ranks in top 5, but CTR < 2.5%
      else if (record.position <= 5 && record.ctr < 0.025 && record.impressions >= 250) {
        opportunities.push({
          query: record.query,
          pageUrl: record.pageUrl,
          category: 'high_impression_low_ctr',
          priorityScore: 88,
          rationale: `High ranking (pos ${record.position.toFixed(1)}) with ${record.impressions} impressions but low CTR (${(record.ctr * 100).toFixed(1)}%). SERP snippet is not compelling.`,
          recommendedAction: 'Rewrite meta title and description without changing URL or core ranking content.',
        });
      }

      // 3. Declining Query: Dropped >= 3 positions or lost clicks
      else if (
        record.previousPosition &&
        record.position - record.previousPosition >= 3.0
      ) {
        opportunities.push({
          query: record.query,
          pageUrl: record.pageUrl,
          category: 'declining_query',
          priorityScore: 82,
          rationale: `Query dropped from pos ${record.previousPosition.toFixed(1)} to ${record.position.toFixed(1)}. Risk of losing steady traffic.`,
          recommendedAction: 'Inspect competitor gains, refresh outdated factual references, and verify core web vitals.',
        });
      }

      // 4. Quick Win: Ranks 4 - 10 with strong CTR
      else if (record.position >= 4 && record.position <= 10 && record.ctr >= 0.04) {
        opportunities.push({
          query: record.query,
          pageUrl: record.pageUrl,
          category: 'quick_win',
          priorityScore: 78,
          rationale: `Solid CTR on page 1 (pos ${record.position.toFixed(1)}). Small ranking bump produces immediate click multiplier.`,
          recommendedAction: 'Acquire high-quality internal contextual anchor links from top authority pages.',
        });
      }
    }

    return opportunities.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Audit page content for AI Answer Engine (AEO / GEO) crawler deliverability (inspired by Citeworthy).
   */
  public auditAeo(html: string, pageUrl: string): AeoAuditResult {
    this.assertToolAllowed('aeo_audit');

    const findings: AeoAuditResult['findings'] = [];

    // Strip HTML tags to estimate visible plain text length
    const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    // Check 1: Empty or thin body text (often caused by client-side React/Vue SPAs serving empty shells)
    if (plainText.length < 200) {
      findings.push({
        rule: 'ai_page_body_empty',
        severity: 'critical',
        message: 'Delivered HTML contains under 200 characters of readable text. Non-JavaScript AI crawlers (GPTBot, ClaudeBot, PerplexityBot) see an empty page.',
      });
    }

    // Check 2: Missing JSON-LD structured data
    const hasStructuredData = /<script\s+type=["']application\/ld\+json["']/i.test(html);
    if (!hasStructuredData) {
      findings.push({
        rule: 'missing_structured_data',
        severity: 'medium',
        message: 'No schema.org JSON-LD found. Search engines and AI scrapers cannot disambiguate entity relationships.',
      });
    }

    // Check 3: Missing or short meta description
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    if (!metaDescMatch || metaDescMatch[1]!.length < 50) {
      findings.push({
        rule: 'meta_description_too_short',
        severity: 'high',
        message: 'Meta description is missing or below 50 characters.',
      });
    }

    const isAiDeliverable = findings.filter((f) => f.severity === 'critical').length === 0;

    return {
      url: pageUrl,
      isAiDeliverable,
      findings,
      wordCount,
      hasStructuredData,
    };
  }

  /**
   * Generate an anti-slop, evidence-grounded content brief.
   */
  public generateBrief(
    opportunity: ClassifiedOpportunity,
    context: AgentExecutionContext
  ): SearchContentBrief {
    this.assertToolAllowed('content_brief');

    const rawTitle = `How ${context.brandName} Solves ${opportunity.query}: Engineering Guide`;
    const rawDescription = `A comprehensive technical guide to ${opportunity.query} for ${context.brandName} users, featuring benchmarks and practical workflows.`;

    // Verify anti-words quality
    const titleAudit = AntiWordsFilter.check(rawTitle);
    const descAudit = AntiWordsFilter.check(rawDescription);
    const cleanlinessScore = Math.min(titleAudit.cleanlinessScore, descAudit.cleanlinessScore);

    return {
      targetQuery: opportunity.query,
      category: opportunity.category,
      suggestedTitle: AntiWordsFilter.sanitize(rawTitle),
      suggestedMetaDescription: AntiWordsFilter.sanitize(rawDescription),
      keyTopicsToCover: [
        `Core Technical Principles of ${opportunity.query}`,
        `Common Failure Modes & Anti-Patterns`,
        `Real-World Implementation Walkthrough`,
        `Direct Integration with ${context.brandName}`,
      ],
      internalLinkTargets: [opportunity.pageUrl],
      cleanlinessScore,
    };
  }
}
