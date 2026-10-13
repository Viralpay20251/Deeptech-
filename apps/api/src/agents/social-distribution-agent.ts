/**
 * Autonomous Growth OS — Social Distribution Agent
 *
 * Implements cross-channel distribution planning with platform-specific
 * constraint validation (inspired by Social Agent AI) and Multi-Armed Bandit
 * creative hook generation for continuous learning.
 */

import { BaseAgent, type AgentExecutionContext } from './base-agent.js';
import { AntiWordsFilter, type AntiWordsCheckResult } from './anti-words.js';

export type SupportedSocialChannel = 'twitter' | 'linkedin' | 'instagram' | 'youtube_shorts' | 'tiktok';

export interface ChannelLimits {
  maxCharacters: number;
  maxHashtags: number;
  recommendedHookLength: number;
}

export const CHANNEL_CONSTRAINTS: Record<SupportedSocialChannel, ChannelLimits> = {
  twitter: {
    maxCharacters: 280,
    maxHashtags: 4,
    recommendedHookLength: 60,
  },
  linkedin: {
    maxCharacters: 3000,
    maxHashtags: 5,
    recommendedHookLength: 120,
  },
  instagram: {
    maxCharacters: 2200,
    maxHashtags: 30,
    recommendedHookLength: 80,
  },
  youtube_shorts: {
    maxCharacters: 5000,
    maxHashtags: 15,
    recommendedHookLength: 90,
  },
  tiktok: {
    maxCharacters: 2200,
    maxHashtags: 10,
    recommendedHookLength: 70,
  },
};

export interface SocialPostCandidate {
  channel: SupportedSocialChannel;
  text: string;
  hashtags: string[];
  destinationTrackedUrl: string;
  mediaUrl?: string;
  hookStyle: 'data_driven' | 'contrarian' | 'problem_solution';
}

export interface SocialValidationResult {
  isValid: boolean;
  channel: SupportedSocialChannel;
  characterCount: number;
  maxCharactersAllowed: number;
  hashtagCount: number;
  maxHashtagsAllowed: number;
  errors: string[];
  antiWordsAudit: AntiWordsCheckResult;
}

export interface CreativeHookVariant {
  hookStyle: 'data_driven' | 'contrarian' | 'problem_solution';
  headline: string;
  estimatedCuriosityScore: number; // 0 - 100
}

export class SocialDistributionAgent extends BaseAgent {
  constructor() {
    super({
      name: 'PulseDistribution',
      agentType: 'distribution_planner',
      title: 'Autonomous Cross-Channel Social Distribution Planner',
      roleDescription:
        'Adapts educational content and product announcements into platform-tailored social assets, enforces channel rate and length boundaries, and generates creative variants for bandit optimization.',
      toneGuidelines: [
        'Engaging, authentic, and platform-native',
        'Avoid engagement-baiting and ungrounded viral claims',
        'Direct readers toward verified first-party destinations via tracked links',
      ],
      allowedTools: ['format_payload', 'validate_constraints', 'generate_hooks', 'bandit_selection'],
      prohibitedActions: [
        'publish_without_approval',
        'spam_unsolicited_mentions',
        'exceed_platform_rate_limits',
      ],
    });
  }

  /**
   * Validate a social post candidate against platform character, hashtag, and anti-words constraints.
   */
  public validatePost(candidate: SocialPostCandidate): SocialValidationResult {
    this.assertToolAllowed('validate_constraints');

    const limits = CHANNEL_CONSTRAINTS[candidate.channel];
    const fullText = candidate.text + (candidate.hashtags.length > 0 ? '\n\n' + candidate.hashtags.join(' ') : '');
    const characterCount = fullText.length;
    const hashtagCount = candidate.hashtags.length;
    const errors: string[] = [];

    // Length check
    if (characterCount > limits.maxCharacters) {
      errors.push(
        `Character count ${characterCount} exceeds ${candidate.channel} limit of ${limits.maxCharacters} characters.`
      );
    }

    // Hashtag check
    if (hashtagCount > limits.maxHashtags) {
      errors.push(
        `Hashtag count ${hashtagCount} exceeds ${candidate.channel} maximum of ${limits.maxHashtags}.`
      );
    }

    // Must include tracked destination link
    if (!candidate.destinationTrackedUrl || !candidate.destinationTrackedUrl.startsWith('http')) {
      errors.push('Post candidate missing valid first-party destination tracked URL.');
    }

    // Anti-words anti-slop verification
    const antiWordsAudit = this.verifyCopyQuality(candidate.text);
    if (antiWordsAudit.hasBannedWords) {
      errors.push(
        `Post contains ${antiWordsAudit.bannedWordsFound.length} banned AI cliches: ${antiWordsAudit.bannedWordsFound.join(', ')}`
      );
    }

    return {
      isValid: errors.length === 0,
      channel: candidate.channel,
      characterCount,
      maxCharactersAllowed: limits.maxCharacters,
      hashtagCount,
      maxHashtagsAllowed: limits.maxHashtags,
      errors,
      antiWordsAudit,
    };
  }

  /**
   * Generate 3 differentiated hook styles for multi-armed bandit exploration.
   */
  public generateHookVariants(topic: string, context: AgentExecutionContext): CreativeHookVariant[] {
    this.assertToolAllowed('generate_hooks');

    return [
      {
        hookStyle: 'data_driven',
        headline: `Recent benchmarks across ${context.brandName} data show that ${topic} improves conversion by up to 34%. Here is the breakdown:`,
        estimatedCuriosityScore: 88,
      },
      {
        hookStyle: 'contrarian',
        headline: `Most teams approach ${topic} backward. Here is why ${context.brandName} took a fundamentally different architecture and what actually works:`,
        estimatedCuriosityScore: 92,
      },
      {
        hookStyle: 'problem_solution',
        headline: `Struggling to scale ${topic} without burning engineering hours? Here is the exact framework we deployed for ${context.brandName}:`,
        estimatedCuriosityScore: 85,
      },
    ];
  }
}
