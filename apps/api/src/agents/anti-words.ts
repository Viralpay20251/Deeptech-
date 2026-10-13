/**
 * Autonomous Growth OS — Anti-Words & Anti-Slop Lexicon
 *
 * Implements clean-room deterministic quality filtering to eliminate overused,
 * repetitive AI filler words and cliches that trigger Google's Helpful Content
 * classifier demotions and reduce conversion across human readers.
 */

export const BANNED_AI_WORDS: readonly string[] = [
  'delve',
  'delving',
  'testament to',
  'tapestry',
  'game-changer',
  'game changer',
  'unleash',
  'unleashing',
  'elevate',
  'elevating',
  'beacon',
  'beacon of',
  'dive deep',
  'dive into',
  'deep dive',
  'ever-evolving',
  'plethora',
  'myriad of',
  'crucial',
  'paramount',
  'seamless',
  'seamlessly',
  'groundbreaking',
  'revolutionary',
  'in a world where',
  'in today\'s fast-paced',
  'it goes without saying',
  'needless to say',
  'foster',
  'fostering',
  'harness',
  'harnessing',
  'embark',
  'embarking',
  'journey of',
  'testament',
  'supercharge',
  'unlock',
  'unlocking',
  'revolutionize',
  'redefining',
  'holistic',
  'synergy',
  'cutting-edge',
  'state-of-the-art',
  'pivotal',
  'cornerstone',
  'vibrant',
  'spearhead',
  'boasts',
  'boasting',
  'realm of',
  'landscape of',
  'demystify',
  'transformative',
];

export interface AntiWordsCheckResult {
  hasBannedWords: boolean;
  bannedWordsFound: string[];
  cleanlinessScore: number; // 0 to 100 (100 = completely clean)
  remediationSuggestions: string[];
}

export class AntiWordsFilter {
  /**
   * Scan text for banned superficial AI cliches and calculate a cleanliness score.
   */
  public static check(text: string): AntiWordsCheckResult {
    if (!text || text.trim().length === 0) {
      return {
        hasBannedWords: false,
        bannedWordsFound: [],
        cleanlinessScore: 100,
        remediationSuggestions: [],
      };
    }

    const lower = text.toLowerCase();
    const found: string[] = [];

    for (const phrase of BANNED_AI_WORDS) {
      // Word boundary regex to prevent false matches inside regular words
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(lower)) {
        found.push(phrase);
      }
    }

    // Cleanliness score penalty: 15 points per unique banned phrase found
    const penalty = found.length * 15;
    const cleanlinessScore = Math.max(0, 100 - penalty);

    const remediationSuggestions = found.map(
      (word) => `Replace generic AI cliche "${word}" with concrete, factual data or domain-specific language.`
    );

    return {
      hasBannedWords: found.length > 0,
      bannedWordsFound: found,
      cleanlinessScore,
      remediationSuggestions,
    };
  }

  /**
   * Remove or substitute common superficial AI cliches with direct equivalents.
   */
  public static sanitize(text: string): string {
    let sanitized = text;

    const replacements: Record<string, string> = {
      'delve into': 'examine',
      'deep dive': 'detailed analysis',
      'seamlessly': 'directly',
      'game-changer': 'significant improvement',
      'game changer': 'significant improvement',
      'testament to': 'evidence of',
      'plethora of': 'multiple',
      'myriad of': 'numerous',
      'in today\'s fast-paced world': 'today',
      'cutting-edge': 'modern',
      'state-of-the-art': 'modern',
      'supercharge': 'improve',
      'unlock': 'access',
    };

    for (const [cliche, replacement] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${cliche}\\b`, 'gi');
      sanitized = sanitized.replace(regex, replacement);
    }

    return sanitized;
  }
}
