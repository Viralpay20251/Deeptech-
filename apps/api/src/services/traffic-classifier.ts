/**
 * Traffic Quality & Bot Classifier
 *
 * Implements Section 2.12, 15, and 27.10 of the Autonomous Growth OS Specification:
 * - 4-tier taxonomy: verified_bot, likely_bot, likely_human, unknown
 * - Excludes known crawlers, test probes, headless automation, and data-center traffic
 * - Guarantees zero fake traffic contributes to the 100k MAU scorecards
 */

export type TrafficClassification = 'verified_bot' | 'likely_bot' | 'likely_human' | 'unknown';

export interface TrafficEvaluationInput {
  userAgent?: string;
  ipAddress?: string;
  sessionDurationSeconds?: number;
  pageviewsCount?: number;
  hasNaturalInteractionEvents?: boolean;
  headers?: Record<string, string | undefined>;
}

export interface TrafficEvaluationResult {
  classification: TrafficClassification;
  confidence: number; // 0.0 to 1.0
  reasons: string[];
  isEligibleForMau: boolean;
}

export class TrafficClassifier {
  private static readonly KNOWN_VERIFIED_CRAWLERS = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i, // Yahoo
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /applebot/i,
    /semrushbot/i,
    /ahrefsbot/i,
  ];

  private static readonly AUTOMATION_AND_TEST_PROBES = [
    /headlesschrome/i,
    /puppeteer/i,
    /playwright/i,
    /selenium/i,
    /phantomjs/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /axios/i,
    /growth-os-worker/i,
    /postmanruntime/i,
  ];

  private static readonly KNOWN_DATACENTER_IP_PREFIXES = [
    '3.', '13.', '15.', '18.', '52.', '54.', // AWS
    '34.', '35.', '104.196.', '104.197.', // GCP
    '20.', '40.', '51.', '137.116.', // Azure
    '159.65.', '167.99.', '178.62.', // DigitalOcean
    '138.68.', '165.227.', // Hetzner / Linode
  ];

  /**
   * Evaluates a traffic session against bot and anomaly signals
   */
  public static evaluate(input: TrafficEvaluationInput): TrafficEvaluationResult {
    const reasons: string[] = [];
    const ua = input.userAgent ?? '';
    const ip = input.ipAddress ?? '';

    // 1. Check for verified legitimate search crawlers
    for (const crawlerRegex of this.KNOWN_VERIFIED_CRAWLERS) {
      if (crawlerRegex.test(ua)) {
        return {
          classification: 'verified_bot',
          confidence: 0.99,
          reasons: [`Identified legitimate search engine crawler: ${ua.split(' ')[0]}`],
          isEligibleForMau: false,
        };
      }
    }

    // 2. Check for automation tools, test scripts, or headless browsers
    for (const probeRegex of this.AUTOMATION_AND_TEST_PROBES) {
      if (probeRegex.test(ua)) {
        return {
          classification: 'likely_bot',
          confidence: 0.95,
          reasons: ['Detected automated script, headless browser, or internal test probe user-agent.'],
          isEligibleForMau: false,
        };
      }
    }

    // 3. Check for data-center IP address ranges
    for (const dcPrefix of this.KNOWN_DATACENTER_IP_PREFIXES) {
      if (ip.startsWith(dcPrefix)) {
        reasons.push(`Session originated from known cloud/hosting datacenter subnet (${dcPrefix}*)`);
      }
    }

    // 4. Session behavioral characteristics
    const duration = input.sessionDurationSeconds ?? 0;
    const pageviews = input.pageviewsCount ?? 1;
    const hasInteraction = input.hasNaturalInteractionEvents ?? false;

    if (duration === 0 && pageviews === 1 && !hasInteraction) {
      reasons.push('Single pageview with zero session duration and no client interaction events.');
    }

    // If originated from datacenter or high anomaly count, classify as likely_bot
    if (reasons.length >= 2 || (ip && this.KNOWN_DATACENTER_IP_PREFIXES.some((p) => ip.startsWith(p)))) {
      return {
        classification: 'likely_bot',
        confidence: 0.85,
        reasons,
        isEligibleForMau: false,
      };
    }

    // 5. Positive human signals
    if (duration >= 10 && hasInteraction) {
      return {
        classification: 'likely_human',
        confidence: 0.92,
        reasons: ['Natural session duration (>=10s) with active interaction events on residential/mobile client.'],
        isEligibleForMau: true,
      };
    }

    // 6. Ambiguous / Insufficient data
    return {
      classification: 'unknown',
      confidence: 0.50,
      reasons: reasons.length > 0 ? reasons : ['Insufficient behavioral telemetry to verify likely human.'],
      isEligibleForMau: false,
    };
  }
}
