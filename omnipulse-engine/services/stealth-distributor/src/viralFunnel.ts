export interface TriggerKeywordConfig {
  keyword: string;
  targetDomain: string;
  pathFormula: string;
  replyTemplate: string;
  dmMessageTemplate: string;
  brandCluster: 'talentxcel' | 'chatr' | 'nutytales';
}

export const VIRAL_TRIGGER_KEYWORDS: Record<string, TriggerKeywordConfig> = {
  CTC: {
    keyword: 'CTC',
    targetDomain: 'salary.talentxcel.in',
    pathFormula: '/salary/senior-software-engineer-in-bengaluru-5-8',
    replyTemplate: 'Sent you the exact 2026 In-Hand CTC & New Tax Slabs calculator link directly in your DMs! 🚀 Check your inbox.',
    dmMessageTemplate: 'Here is your direct access to the 2026 In-Hand CTC & Tax Regime Comparator: {url} — compare Bengaluru vs Noida vs Gurugram take-home in 30 seconds!',
    brandCluster: 'talentxcel',
  },
  SALARY: {
    keyword: 'SALARY',
    targetDomain: 'salary.talentxcel.in',
    pathFormula: '/salary/software-engineer-in-bengaluru-3-5',
    replyTemplate: 'Check your DMs! Sent you the full breakdown of in-hand take-home & skill premiums.',
    dmMessageTemplate: 'Here is the interactive salary & skill premium estimator: {url} — includes live +22% Kubernetes / GenAI adder!',
    brandCluster: 'talentxcel',
  },
  RESUME: {
    keyword: 'RESUME',
    targetDomain: 'resume.talentxcel.in',
    pathFormula: '/templates/technology-cv-format-modern',
    replyTemplate: 'Sent you the free ATS keyword scanner & LaTeX template download link in your DMs! 📄',
    dmMessageTemplate: 'Scan your resume against live job descriptions and check your ATS compliance grade here: {url}',
    brandCluster: 'talentxcel',
  },
  AGENT: {
    keyword: 'AGENT',
    targetDomain: 'chatr.chat',
    pathFormula: '/agent/support-triage-workflow-slack',
    replyTemplate: 'Sent you the interactive autonomous agent sandbox link in your DMs! 🤖 Test it live.',
    dmMessageTemplate: 'Test your multi-turn autonomous agent workflow and calculate your team FTE savings here: {url}',
    brandCluster: 'chatr',
  },
  HAMPER: {
    keyword: 'HAMPER',
    targetDomain: 'gifting.nutytales.com',
    pathFormula: '/gift/diwali-hamper-delivery-delhi',
    replyTemplate: 'DMed you our 2026 GI-Certified Saffron & Walnut Hamper wholesale builder link! 🎁',
    dmMessageTemplate: 'Configure your custom artisan hamper with hand-carved walnut wood and pure Pampore saffron: {url}',
    brandCluster: 'nutytales',
  },
  KASHMIR: {
    keyword: 'KASHMIR',
    targetDomain: 'stays.nutytales.com',
    pathFormula: '/stay/orchard-cottage-heritage-homestay-pahalgam',
    replyTemplate: 'DMed you the seasonal valley itinerary & heritage orchard stay booking estimator! 🏔️',
    dmMessageTemplate: 'Explore private pine orchard cottages and authentic shikara trails in Kashmir: {url}',
    brandCluster: 'nutytales',
  },
};

export interface SocialCommentEvent {
  platform: 'youtube' | 'instagram' | 'facebook' | 'linkedin' | 'twitter';
  postId: string;
  commentId: string;
  authorUsername: string;
  commentText: string;
  createdAt: Date;
}

export interface FunnelExecutionResult {
  matchedKeyword: string;
  replyPosted: boolean;
  dmSent: boolean;
  deepLink: string;
}

/**
 * Builds high-conversion deep link with social trigger UTM tags
 */
export function buildSocialTriggerDeepLink(domain: string, path: string, platform: string, keyword: string): string {
  const url = new URL(`https://${domain}${path}`);
  url.searchParams.set('utm_source', 'social_trigger');
  url.searchParams.set('utm_medium', 'auto_dm');
  url.searchParams.set('utm_campaign', `${platform}_${keyword.toLowerCase()}`);
  return url.toString();
}

/**
 * Parses comment text against viral trigger dictionary
 */
export function findMatchingTriggerKeyword(commentText: string): TriggerKeywordConfig | null {
  const upper = commentText.toUpperCase();
  for (const [key, cfg] of Object.entries(VIRAL_TRIGGER_KEYWORDS)) {
    // Exact word boundary match
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(upper)) {
      return cfg;
    }
  }
  return null;
}

/**
 * Executes zero-click-friction comment auto-reply and direct message funnel
 */
export async function executeCommentAutoFunnel(
  event: SocialCommentEvent
): Promise<FunnelExecutionResult | null> {
  const match = findMatchingTriggerKeyword(event.commentText);
  if (!match) {
    return null;
  }

  const deepLink = buildSocialTriggerDeepLink(match.targetDomain, match.pathFormula, event.platform, match.keyword);
  const replyMessage = `@${event.authorUsername} ${match.replyTemplate}`;
  const dmMessage = match.dmMessageTemplate.replace('{url}', deepLink);

  console.log(`[AutoFunnel] [${event.platform.toUpperCase()}] Trigger "${match.keyword}" detected from @${event.authorUsername}`);
  console.log(`[AutoFunnel] -> Reply: ${replyMessage}`);
  console.log(`[AutoFunnel] -> Direct Link DM: ${dmMessage}`);

  // In production, invokes platform-specific comment API / headless stealth automation
  return {
    matchedKeyword: match.keyword,
    replyPosted: true,
    dmSent: true,
    deepLink,
  };
}
