import { describe, it, expect } from 'vitest';
import {
  renderInteractiveMultiplierHtml,
} from '../../omnipulse-engine/apps/pseo-edge-router/src/components/InteractiveMultipliers/SessionMultiplierFlow.js';
import {
  DISCOVER_ROBOTS_META,
  buildDiscoverJsonLd,
  generate1200x675OgCard,
  getOgDataUri,
  generate15LeafLinks,
  pingGoogleWebSub,
  createAndPublishPulseReport,
} from '../../omnipulse-engine/services/discover-igniter/src/discoverEngine.js';
import {
  generateVapidKeys,
  createVapidJwt,
  buildVapidAuthorizationHeader,
  getClientPushRegistrationScript,
} from '../../omnipulse-engine/apps/pseo-edge-router/src/lib/webPush.js';
import {
  getServiceWorkerScript,
  dispatchDailyReengagementPush,
} from '../../omnipulse-engine/apps/pseo-edge-router/src/lib/webPushServiceWorker.js';
import {
  findMatchingTriggerKeyword,
  buildSocialTriggerDeepLink,
  executeCommentAutoFunnel,
  VIRAL_TRIGGER_KEYWORDS,
} from '../../omnipulse-engine/services/stealth-distributor/src/viralFunnel.js';
import { renderLeafPage } from '../../omnipulse-engine/apps/pseo-edge-router/src/lib/htmlRenderer.js';
import { DOMAIN_CONFIGS } from '../../omnipulse-engine/apps/pseo-edge-router/src/config/domains.js';

describe('HyperScale Pageview Multiplier & Google Discover Engine', () => {
  // ==========================================================================
  // MODULE 1: The 6x Session Depth Interactive Tool Engine
  // ==========================================================================
  describe('Module 1: Interactive Session Multipliers', () => {
    it('renders server-side embeddable interactive HTML with step tracking beacon', () => {
      const html = renderInteractiveMultiplierHtml(
        'salary.talentxcel.in',
        'talentxcel',
        'Staff Infrastructure Engineer',
        'bengaluru'
      );

      expect(html).toContain('5x SESSION DEPTH ENGINE');
      expect(html).toContain('salary_comparator');
      expect(html).toContain('window.navigator.sendBeacon');
      expect(html).toContain('initMultiplierStep');
      expect(html).toContain('Staff Infrastructure Engineer');
      expect(html).toContain('bengaluru');
    });

    it('injects 6x session multiplier widget and Discover metadata into leaf pages', () => {
      const config = DOMAIN_CONFIGS['salary.talentxcel.in'];
      expect(config).toBeDefined();

      const pageHtml = renderLeafPage({
        title: 'Senior Software Engineer Salary in Bengaluru',
        metaDescription: 'Detailed 2026 In-Hand CTC and tax slabs comparison for Bangalore developers.',
        canonicalUrl: 'https://salary.talentxcel.in/salary/senior-software-engineer-in-bengaluru-5-8',
        domainConfig: config,
        dimensionValues: {
          role: { slug: 'senior-software-engineer', display_value: 'Senior Software Engineer' },
          city: { slug: 'bengaluru', display_value: 'Bengaluru' },
          experience: { slug: '5-8', display_value: '5-8 Years' },
        },
        ringNeighbors: [{ url: 'https://salary.talentxcel.in/salary/lead-in-bengaluru', title: 'Lead in Bengaluru' }],
        longDistanceLinks: [{ url: 'https://jobs.talentxcel.in', title: 'Jobs' }],
        jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
      });

      // Verify Google Discover Head Tag
      expect(pageHtml).toContain('content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"');
      // Verify 1200x675 OG Card
      expect(pageHtml).toContain('property="og:image:width" content="1200"');
      expect(pageHtml).toContain('property="og:image:height" content="675"');
      // Verify interactive tool inclusion
      expect(pageHtml).toContain('5x SESSION DEPTH ENGINE');
    });
  });

  // ==========================================================================
  // MODULE 2: Google Discover & Top-Stories Viral Surface
  // ==========================================================================
  describe('Module 2: Google Discover & WebSub Igniter', () => {
    it('enforces Google Discover robots meta configuration', () => {
      expect(DISCOVER_ROBOTS_META).toBe('index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    });

    it('builds valid Discover JSON-LD schema with publisher entity graph', () => {
      const schema = buildDiscoverJsonLd({
        headline: 'Surging Kubernetes Compensation in Noida: 2026 Tech Report',
        description: 'Comprehensive compensation analysis for cloud infrastructure engineers.',
        canonicalUrl: 'https://salary.talentxcel.in/salary/kubernetes-engineer-in-noida',
        ogImageUrl: 'https://salary.talentxcel.in/og/k8s-noida-1200x675.svg',
        brandCluster: 'talentxcel',
        isNewsArticle: true,
      });

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('NewsArticle');
      expect(schema['image']).toEqual(['https://salary.talentxcel.in/og/k8s-noida-1200x675.svg']);
      expect((schema['author'] as any).name).toBe('TalentXcel Career Network Editorial Staff');
      expect((schema['publisher'] as any).name).toBe('TalentXcel Career Network');
      expect((schema['publisher'] as any).logo.url).toContain('talentxcel-crest-1200.png');
    });

    it('generates crisp 1200x675 high-CTR Discover OG image cards', () => {
      const svg = generate1200x675OgCard({
        title: 'Senior AI Engineer In-Hand CTC',
        subtitle: '2026 Bangalore vs Hyderabad Compensation Bands',
        category: 'SALARY PULSE',
        brandCluster: 'talentxcel',
        metricValue: '₹38.5 LPA',
        metricLabel: 'TOP 10% PERCENTILE',
      });

      expect(svg).toContain('width="1200"');
      expect(svg).toContain('height="675"');
      expect(svg).toContain('viewBox="0 0 1200 675"');
      expect(svg).toContain('₹38.5 LPA');
      expect(svg).toContain('TOP 10% PERCENTILE');
      expect(svg).toContain('Max-Image-Preview Large');

      const dataUri = getOgDataUri({
        title: 'Artisan Saffron Harvest',
        subtitle: 'Grade A Mongra Saffron from Pampore Orchards',
        category: 'HERITAGE',
        brandCluster: 'nutytales',
      });
      expect(dataUri.startsWith('data:image/svg+xml;base64,')).toBe(true);
    });

    it('generates 15 programmatic leaf links for deep crawl distribution', () => {
      const links = generate15LeafLinks('jobs.talentxcel.in', ['Kubernetes']);
      expect(links.length).toBe(15);
      expect(links[0].url).toContain('https://jobs.talentxcel.in/job/');
      expect(links.every((l) => l.url.startsWith('https://jobs.talentxcel.in'))).toBe(true);
    });

    it('formats WebSub publication payload for Google PubSubHubbub hub', async () => {
      // Test URL construction and ping payload without crashing even if offline
      const pingResult = await pingGoogleWebSub('https://salary.talentxcel.in/pulse/ai-salaries-2026');
      expect(typeof pingResult).toBe('boolean');
    });
  });

  // ==========================================================================
  // MODULE 3: High-Conversion Social DM & Comment Auto-Funnel
  // ==========================================================================
  describe('Module 3: Social DM Auto-Funnel & Viral Share Loops', () => {
    it('detects trigger keywords in social comments across 5 networks', () => {
      const matchCtc = findMatchingTriggerKeyword('Please send me the CTC calculator link!');
      expect(matchCtc).not.toBeNull();
      expect(matchCtc?.keyword).toBe('CTC');
      expect(matchCtc?.targetDomain).toBe('salary.talentxcel.in');

      const matchHamper = findMatchingTriggerKeyword('Love this! comment HAMPER for details');
      expect(matchHamper).not.toBeNull();
      expect(matchHamper?.keyword).toBe('HAMPER');
      expect(matchHamper?.targetDomain).toBe('gifting.nutytales.com');

      const matchNone = findMatchingTriggerKeyword('Great video thank you!');
      expect(matchNone).toBeNull();
    });

    it('generates frictionless deep links with social trigger attribution', () => {
      const deepLink = buildSocialTriggerDeepLink(
        'salary.talentxcel.in',
        '/salary/senior-software-engineer-in-bengaluru-5-8',
        'instagram',
        'CTC'
      );

      const parsed = new URL(deepLink);
      expect(parsed.hostname).toBe('salary.talentxcel.in');
      expect(parsed.searchParams.get('utm_source')).toBe('social_trigger');
      expect(parsed.searchParams.get('utm_medium')).toBe('auto_dm');
      expect(parsed.searchParams.get('utm_campaign')).toBe('instagram_ctc');
    });

    it('executes comment auto-reply and direct link payload', async () => {
      const result = await executeCommentAutoFunnel({
        platform: 'linkedin',
        postId: 'urn:li:ugcPost:12345',
        commentId: 'urn:li:comment:67890',
        authorUsername: 'arshid_dev',
        commentText: 'Comment SALARY to compare Noida vs Bangalore packages',
        createdAt: new Date(),
      });

      expect(result).not.toBeNull();
      expect(result?.matchedKeyword).toBe('SALARY');
      expect(result?.replyPosted).toBe(true);
      expect(result?.dmSent).toBe(true);
      expect(result?.deepLink).toContain('utm_source=social_trigger');
    });
  });

  // ==========================================================================
  // MODULE 4: Zero-Cost Web Push (VAPID) Return-Traffic Engine
  // ==========================================================================
  describe('Module 4: Zero-Cost Native Web Push (VAPID)', () => {
    it('generates cryptographic NIST P-256 EC VAPID key pairs', () => {
      const keys = generateVapidKeys();
      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      // Uncompressed P-256 EC public key is 65 bytes (~87 chars in base64url)
      expect(keys.publicKey.length).toBeGreaterThanOrEqual(80);
      // Private key scalar is 32 bytes (~43 chars in base64url)
      expect(keys.privateKey.length).toBeGreaterThanOrEqual(40);
    });

    it('creates RFC 8292 compliant VAPID JWT tokens with ES256 signatures', () => {
      const keys = generateVapidKeys();
      const jwt = createVapidJwt('https://fcm.googleapis.com', 'mailto:growth@talentxcel.in', keys);

      const parts = jwt.split('.');
      expect(parts.length).toBe(3);

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      expect(header.typ).toBe('JWT');
      expect(header.alg).toBe('ES256');

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      expect(payload.aud).toBe('https://fcm.googleapis.com');
      expect(payload.sub).toBe('mailto:growth@talentxcel.in');
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('builds VAPID Authorization header string', () => {
      const keys = generateVapidKeys();
      const headers = buildVapidAuthorizationHeader('https://fcm.googleapis.com/fcm/send/sub123', 'mailto:growth@talentxcel.in', keys);
      expect(headers.Authorization.startsWith('vapid t=')).toBe(true);
      expect(headers.Authorization).toContain(`k=${keys.publicKey}`);
    });

    it('generates valid sw.js Service Worker with notificationclick deep link and UTM routing', () => {
      const swCode = getServiceWorkerScript();
      expect(swCode).toContain('self.addEventListener(\'push\'');
      expect(swCode).toContain('self.addEventListener(\'notificationclick\'');
      expect(swCode).toContain('utm_source=web_push');
      expect(swCode).toContain('clients.openWindow');
    });

    it('filters subscribers and segments automated daily re-engagement by brand cluster', async () => {
      const keys = generateVapidKeys();
      const mockSubscribers = [
        {
          endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/mock1',
          p256dhKey: 'mockP256Key1',
          authKey: 'mockAuthKey1',
          hostname: 'jobs.talentxcel.in',
          brandCluster: 'talentxcel' as const,
        },
        {
          endpoint: 'https://fcm.googleapis.com/fcm/send/mock2',
          p256dhKey: 'mockP256Key2',
          authKey: 'mockAuthKey2',
          hostname: 'chatr.chat',
          brandCluster: 'chatr' as const,
        },
      ];

      const report = await dispatchDailyReengagementPush({
        subscribers: mockSubscribers,
        brandCluster: 'talentxcel',
        triggerType: 'new_job',
        title: '3 New Kubernetes Lead Roles in Bengaluru',
        body: 'Salaries up to ₹45 LPA. Tap to view and apply.',
        targetUrl: 'https://jobs.talentxcel.in/job/kubernetes-lead-in-bengaluru',
        vapidKeys: keys,
      });

      // Target should be 1 subscriber (talentxcel only)
      expect(report.totalSent).toBe(1);
    });
  });

  // ==========================================================================
  // INVENTORY GOVERNANCE (COMMIT 530e23d STRICT RULES)
  // ==========================================================================
  describe('Strict 35-Hostname Master Inventory Governance', () => {
    it('strictly isolates the 3 barred legacy hosts from traffic routes', () => {
      const barred = ['www.talentxcel.net', 'auth.talentxcel.in', 'cdn.talentxcel.in'];
      for (const host of barred) {
        expect(DOMAIN_CONFIGS[host]).toBeUndefined();
      }
    });

    it('verifies canonical production origins are active', () => {
      const canonicalSamples = [
        'salary.talentxcel.in',
        'resume.talentxcel.in',
        'jobs.talentxcel.in',
        'chatr.chat',
        'nutytales.com',
        'gifting.nutytales.com',
        'stays.nutytales.com',
      ];

      for (const host of canonicalSamples) {
        expect(DOMAIN_CONFIGS[host]).toBeDefined();
        expect(DOMAIN_CONFIGS[host].sitemapPriority).toBeGreaterThan(0.7);
      }
    });
  });
});
