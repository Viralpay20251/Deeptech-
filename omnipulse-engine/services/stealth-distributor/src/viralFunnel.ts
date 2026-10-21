export interface TriggerKeywordConfig {
  keyword: string;
  targetDomain: string;
  pathFormula: string;
  replyTemplate: string;
  replyTemplates?: string[];
  dmMessageTemplate: string;
  dmTemplates?: string[];
  brandCluster: 'talentxcel' | 'chatr' | 'nutytales';
}

export const VIRAL_TRIGGER_KEYWORDS: Record<string, TriggerKeywordConfig> = {
  CTC: {
    keyword: 'CTC',
    targetDomain: 'salary.talentxcel.in',
    pathFormula: '/salary/senior-software-engineer-in-bengaluru-5-8',
    replyTemplate: 'Sent you the exact 2026 In-Hand CTC & New Tax Slabs calculator link directly in your DMs! 🚀 Check your inbox.',
    replyTemplates: [
      'Sent you the exact 2026 In-Hand CTC & New Tax Slabs calculator link directly in your DMs! 🚀 Check your inbox.',
      'Just dropped the in-hand salary breakdown link in your DMs! 📩 Compare city take-home in seconds.',
      'DMed you the interactive 2026 CTC & tax regime comparator! Check your messages 💼',
      'Link sent to your DMs! See your real in-hand pay vs gross package with live tax slabs 📊',
      'Check your inbox! Sent the direct tool to calculate in-hand take-home & skill bonuses 🎯',
    ],
    dmMessageTemplate: 'Here is your direct access to the 2026 In-Hand CTC & Tax Regime Comparator: {url} — compare Bengaluru vs Noida vs Gurugram take-home in 30 seconds!',
    dmTemplates: [
      'Here is your direct access to the 2026 In-Hand CTC & Tax Regime Comparator: {url} — compare Bengaluru vs Noida vs Gurugram take-home in 30 seconds!',
      'Here is the exact in-hand salary & tax breakdown calculator: {url} — toggle Old vs New regime instantly.',
      'Access your personalized 2026 CTC calculator: {url} — includes city cost-of-living and skill adder.',
    ],
    brandCluster: 'talentxcel',
  },
  SALARY: {
    keyword: 'SALARY',
    targetDomain: 'salary.talentxcel.in',
    pathFormula: '/salary/software-engineer-in-bengaluru-3-5',
    replyTemplate: 'Check your DMs! Sent you the full breakdown of in-hand take-home & skill premiums.',
    replyTemplates: [
      'Check your DMs! Sent you the full breakdown of in-hand take-home & skill premiums.',
      'Sent the interactive salary calculator link to your DMs! Includes the +22% skill adder 🚀',
      'DMed you the benchmark tool! See how your compensation stacks up across tech hubs 📈',
      'Link is in your inbox! Explore live salary bands and take-home pay estimates 💡',
      'Sent! Check your DMs for the full role-by-role compensation report 🎯',
    ],
    dmMessageTemplate: 'Here is the interactive salary & skill premium estimator: {url} — includes live +22% Kubernetes / GenAI adder!',
    dmTemplates: [
      'Here is the interactive salary & skill premium estimator: {url} — includes live +22% Kubernetes / GenAI adder!',
      'Compare your package against live market benchmarks: {url} — explore salary bands for 2026.',
    ],
    brandCluster: 'talentxcel',
  },
  RESUME: {
    keyword: 'RESUME',
    targetDomain: 'resume.talentxcel.in',
    pathFormula: '/templates/technology-cv-format-modern',
    replyTemplate: 'Sent you the free ATS keyword scanner & LaTeX template download link in your DMs! 📄',
    replyTemplates: [
      'Sent you the free ATS keyword scanner & LaTeX template download link in your DMs! 📄',
      'Check your inbox! DMed the live ATS compliance grader and modern tech resume templates ✨',
      'DMed you the scanner link! See your match percentage against live job openings 🔍',
      'Sent to your DMs! Check out the keyword gap analyzer to boost your callback rate 📋',
      'Just sent the resume grader link to your DMs! Let me know what score you get 🚀',
    ],
    dmMessageTemplate: 'Scan your resume against live job descriptions and check your ATS compliance grade here: {url}',
    dmTemplates: [
      'Scan your resume against live job descriptions and check your ATS compliance grade here: {url}',
      'Here is your free ATS diagnostic scanner & modern template: {url} — scan for missing skills in 10s.',
    ],
    brandCluster: 'talentxcel',
  },
  AGENT: {
    keyword: 'AGENT',
    targetDomain: 'chatr.chat',
    pathFormula: '/agent/support-triage-workflow-slack',
    replyTemplate: 'Sent you the interactive autonomous agent sandbox link in your DMs! 🤖 Test it live.',
    replyTemplates: [
      'Sent you the interactive autonomous agent sandbox link in your DMs! 🤖 Test it live.',
      'Check your DMs! DMed the sandbox where you can test multi-turn agent workflows in real-time ⚡',
      'Sent the agent playground link! Simulate Slack & CRM workflow integrations in your inbox 📨',
      'DMed! Test out the autonomous workforce simulator and calculate team FTE savings 💡',
      'Check your inbox! Sent you direct access to the live AI agent intent builder 🛠️',
    ],
    dmMessageTemplate: 'Test your multi-turn autonomous agent workflow and calculate your team FTE savings here: {url}',
    dmTemplates: [
      'Test your multi-turn autonomous agent workflow and calculate your team FTE savings here: {url}',
      'Here is your access to the live CHATR autonomous agent sandbox: {url} — test workflow automations live.',
    ],
    brandCluster: 'chatr',
  },
  HAMPER: {
    keyword: 'HAMPER',
    targetDomain: 'gifting.nutytales.com',
    pathFormula: '/gift/diwali-hamper-delivery-delhi',
    replyTemplate: 'DMed you our 2026 GI-Certified Saffron & Walnut Hamper wholesale builder link! 🎁',
    replyTemplates: [
      'DMed you our 2026 GI-Certified Saffron & Walnut Hamper wholesale builder link! 🎁',
      'Check your DMs! Sent you the custom royal gift hamper builder with live pricing ✨',
      'Sent the luxury hamper customizer link to your inbox! Explore walnut wood boxes and saffron 🌾',
      'DMed you the catalog and wholesale discount configurator! Check your messages 🎀',
      'Just sent the link in your DMs! Customize your bespoke Kashmiri gift box in 60 seconds 🌿',
    ],
    dmMessageTemplate: 'Configure your custom artisan hamper with hand-carved walnut wood and pure Pampore saffron: {url}',
    dmTemplates: [
      'Configure your custom artisan hamper with hand-carved walnut wood and pure Pampore saffron: {url}',
      'Here is the bespoke hamper configurator: {url} — select GI-tagged Pampore saffron and artisan walnut boxes.',
    ],
    brandCluster: 'nutytales',
  },
  KASHMIR: {
    keyword: 'KASHMIR',
    targetDomain: 'stays.nutytales.com',
    pathFormula: '/stay/orchard-cottage-heritage-homestay-pahalgam',
    replyTemplate: 'DMed you the seasonal valley itinerary & heritage orchard stay booking estimator! 🏔️',
    replyTemplates: [
      'DMed you the seasonal valley itinerary & heritage orchard stay booking estimator! 🏔️',
      'Check your inbox! Sent the private pine orchard cottage planner and shikara trail guide 🚣',
      'Sent the stay estimator link to your DMs! Explore authentic heritage homestays in Pahalgam 🌲',
      'DMed you the autumn valley itinerary and direct booking details! Have an amazing trip 🍂',
      'Check your DMs! Sent you the full local guide to heritage orchard stays & excursions 🗺️',
    ],
    dmMessageTemplate: 'Explore private pine orchard cottages and authentic shikara trails in Kashmir: {url}',
    dmTemplates: [
      'Explore private pine orchard cottages and authentic shikara trails in Kashmir: {url}',
      'Here is the Kashmir heritage stay and orchard cottage estimator: {url} — plan your itinerary directly.',
    ],
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
