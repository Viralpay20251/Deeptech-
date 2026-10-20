import { useState, useMemo } from 'react';
import {
  Globe,
  ExternalLink,
  Search,
  CheckCircle2,
  Ban,
  Clock,
  ShieldCheck,
  Layers,
} from 'lucide-react';

export type HostRole =
  | 'primary'
  | 'www_alias'
  | 'product_subdomain'
  | 'search_console_property'
  | 'deployment_host'
  | 'excluded'
  | 'proposed_addition';

export type DomainClassification =
  | 'active_listed'
  | 'excluded_legacy'
  | 'proposed_addition';

export interface HostnameEntry {
  id: number;
  hostname: string;
  brand: 'TalentXcel' | 'CHATR' | 'Nuty Tales';
  brandSlug: 'talentxcel' | 'chatr' | 'nutytales';
  hostRole: HostRole;
  classification: DomainClassification;
  purpose: string;
  urlFormula: string;
  gscPropertyUri: string | null;
  indexingIntent: 'indexable' | 'redirect_expected' | 'deployment_only' | 'noindex_expected' | 'pending_verification';
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFICIAL MASTER DOMAIN INVENTORY — EXACT 35 UNIQUE HOSTNAMES
// Breakdown:
// - 26 Existing Listed Active/Authoritative Hostnames (13 TX, 3 CHATR, 10 NT)
// - 3 Excluded Legacy References (Barred from crawl/index)
// - 6 Proposed Additions (Unverified / Roadmap)
// ─────────────────────────────────────────────────────────────────────────────
const MASTER_DOMAIN_INVENTORY: HostnameEntry[] = [
  // ── 1. TALENTXCEL — EXISTING .IN INVENTORY (13 Listed Hosts) ───────────────
  {
    id: 1,
    hostname: 'talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'primary',
    classification: 'active_listed',
    purpose: 'Primary apex domain; authoritative brand portal',
    urlFormula: '/',
    gscPropertyUri: 'sc-domain:talentxcel.in',
    indexingIntent: 'indexable',
    notes: 'Primary authoritative apex domain for TalentXcel ecosystem',
  },
  {
    id: 2,
    hostname: 'www.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'www_alias',
    classification: 'active_listed',
    purpose: 'WWW alias; expected 301 redirect to apex',
    urlFormula: '301 -> https://talentxcel.in',
    gscPropertyUri: null,
    indexingIntent: 'redirect_expected',
    notes: 'Preserves canonical authority on apex; 301 permanent redirect',
  },
  {
    id: 3,
    hostname: 'colleges.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'College partnerships & campus placement portal',
    urlFormula: '/college/[institution]-placement-[city]',
    gscPropertyUri: 'https://colleges.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'Premier engineering & management institutes placement data',
  },
  {
    id: 4,
    hostname: 'careers.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Career development & role pathway roadmap portal',
    urlFormula: '/career-path/[role]-roadmap-[level]',
    gscPropertyUri: 'https://careers.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'Structured career paths and skill progression blueprints',
  },
  {
    id: 5,
    hostname: 'salary.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Tech salary benchmarks & compensation index',
    urlFormula: '/salary/[role]-in-[city]-[experience]',
    gscPropertyUri: 'https://salary.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'Granular tech compensation intelligence by role, city, and YOE',
  },
  {
    id: 6,
    hostname: 'resume.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'AI resume builder & CV review tool',
    urlFormula: '/templates/[industry]-cv-format-[style]',
    gscPropertyUri: 'https://resume.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'ATS-optimized curriculum vitae templates and AI reviewer',
  },
  {
    id: 7,
    hostname: 'jobs.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Job listings & tech opportunities portal',
    urlFormula: '/job/[role]-in-[city]-with-[skill]',
    gscPropertyUri: 'https://jobs.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'Deep tech openings with Google JobPosting Schema.org injection',
  },
  {
    id: 8,
    hostname: 'employer.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Employer hiring portal (singular)',
    urlFormula: '/hiring/[industry]-solutions-[region]',
    gscPropertyUri: null,
    indexingIntent: 'indexable',
    notes: 'Direct B2B hiring solutions origin; singular hostname',
  },
  {
    id: 9,
    hostname: 'employers.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'search_console_property',
    classification: 'active_listed',
    purpose: 'Separate plural hostname; distinct enterprise talent pool',
    urlFormula: '/enterprise/[sector]-talent-pool',
    gscPropertyUri: 'https://employers.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'Verified GSC property; strictly isolated from employer.talentxcel.in',
  },
  {
    id: 10,
    hostname: 'government.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Public-sector and government career initiatives',
    urlFormula: '/schemes/[state]-employment-portal',
    gscPropertyUri: 'https://government.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'State-wise employment schemes and public sector career portals',
  },
  {
    id: 11,
    hostname: 'learning.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Learning, technical upskilling & tutorials',
    urlFormula: '/learn/[skill]-tutorial-for-[level]',
    gscPropertyUri: 'https://learning.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'Technical course syllabus with Google Course Schema.org markup',
  },
  {
    id: 12,
    hostname: 'passport.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Skills passport & verified credentialing portal',
    urlFormula: '/passport/[credential]-verification-[id]',
    gscPropertyUri: 'https://passport.talentxcel.in/',
    indexingIntent: 'indexable',
    notes: 'Cryptographic skills verification and talent credentials ledger',
  },
  {
    id: 13,
    hostname: 'career-pathways-ai-builder.vercel.app',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'deployment_host',
    classification: 'active_listed',
    purpose: 'Deployment host; non-canonical staging preview',
    urlFormula: 'Preview Deployment (noindex)',
    gscPropertyUri: null,
    indexingIntent: 'deployment_only',
    notes: 'Vercel staging origin; explicitly excluded from search indexation',
  },

  // ── 2. CHATR — EXISTING INVENTORY (3 Listed Hosts) ─────────────────────────
  {
    id: 14,
    hostname: 'chatr.chat',
    brand: 'CHATR',
    brandSlug: 'chatr',
    hostRole: 'primary',
    classification: 'active_listed',
    purpose: 'Primary CHATR domain; modern product & branding',
    urlFormula: '/agent/[intent]-workflow-[integration]',
    gscPropertyUri: 'sc-domain:chatr.chat',
    indexingIntent: 'indexable',
    notes: 'Primary global product origin with SoftwareApplication schema',
  },
  {
    id: 15,
    hostname: 'chatrchat.in',
    brand: 'CHATR',
    brandSlug: 'chatr',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Secondary domain; expected redirect to www.chatrchat.in',
    urlFormula: '301 -> https://www.chatrchat.in',
    gscPropertyUri: null,
    indexingIntent: 'redirect_expected',
    notes: 'Secondary regional host configured to redirect to canonical WWW',
  },
  {
    id: 16,
    hostname: 'www.chatrchat.in',
    brand: 'CHATR',
    brandSlug: 'chatr',
    hostRole: 'www_alias',
    classification: 'active_listed',
    purpose: 'Configured canonical host (Historical canonical host)',
    urlFormula: '/solutions/[use-case]-for-[industry]',
    gscPropertyUri: 'https://www.chatrchat.in/',
    indexingIntent: 'indexable',
    notes: 'Historical canonical host preserved without cross-domain auto-consolidation',
  },

  // ── 3. NUTY TALES — EXISTING INVENTORY (10 Listed Hosts) ───────────────────
  {
    id: 17,
    hostname: 'nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'primary',
    classification: 'active_listed',
    purpose: 'Primary e-commerce domain; flagship brand marketplace',
    urlFormula: '/store/[product]-organic-[origin]',
    gscPropertyUri: 'sc-domain:nutytales.com',
    indexingIntent: 'indexable',
    notes: 'Flagship organic marketplace; walnuts, saffron, and Himalayan goods',
  },
  {
    id: 18,
    hostname: 'www.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'www_alias',
    classification: 'active_listed',
    purpose: 'WWW alias; expected redirect to apex nutytales.com',
    urlFormula: '301 -> https://nutytales.com',
    gscPropertyUri: null,
    indexingIntent: 'redirect_expected',
    notes: 'WWW alias expected to 301 redirect to apex nutytales.com',
  },
  {
    id: 19,
    hostname: 'business.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'B2B supply, bulk procurement, and wholesale snacking',
    urlFormula: '/bulk/[category]-wholesale-supply',
    gscPropertyUri: 'https://business.nutytales.com/',
    indexingIntent: 'indexable',
    notes: 'Corporate procurement, bulk gourmet snacking, and institutional supply',
  },
  {
    id: 20,
    hostname: 'gifting.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Curated festive & corporate luxury gift hampers',
    urlFormula: '/gift/[occasion]-hamper-delivery-[location]',
    gscPropertyUri: 'https://gifting.nutytales.com/',
    indexingIntent: 'indexable',
    notes: 'Luxury gourmet hampers for Diwali, Eid, weddings, and corporate summits',
  },
  {
    id: 21,
    hostname: 'weddings.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Wedding gifts, bridal hampers, and custom favors',
    urlFormula: '/wedding/[ceremony]-favor-packing-[culture]',
    gscPropertyUri: 'https://weddings.nutytales.com/',
    indexingIntent: 'indexable',
    notes: 'Bespoke celebratory boxes and traditional artisanal dry-fruit giveaways',
  },
  {
    id: 22,
    hostname: 'crafts.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Handmade artisan crafts & Kashmiri walnut wood carvings',
    urlFormula: '/craft/[artisan]-handmade-[material]',
    gscPropertyUri: 'https://crafts.nutytales.com/',
    indexingIntent: 'indexable',
    notes: 'Heritage Kashmiri arts, papier-mâché, pashmina, and wood carvings',
  },
  {
    id: 23,
    hostname: 'stays.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Eco-friendly orchard stays & heritage hospitality',
    urlFormula: '/stay/[property]-heritage-homestay-[region]',
    gscPropertyUri: 'https://stays.nutytales.com/',
    indexingIntent: 'indexable',
    notes: 'Apple and walnut orchard retreats, valley homestays, and rustic cabins',
  },
  {
    id: 24,
    hostname: 'travel.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'Valley travel experiences & curated cultural tours',
    urlFormula: '/tour/[destination]-cultural-itinerary-[duration]',
    gscPropertyUri: 'https://travel.nutytales.com/',
    indexingIntent: 'indexable',
    notes: 'Experiential Kashmiri travel packages and alpine guided treks',
  },
  {
    id: 25,
    hostname: 'nri.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'product_subdomain',
    classification: 'active_listed',
    purpose: 'International customer offering & cross-border diaspora delivery',
    urlFormula: '/diaspora/[country]-home-delivery-[tradition]',
    gscPropertyUri: 'https://nri.nutytales.com/',
    indexingIntent: 'indexable',
    notes: 'Express worldwide delivery of valley delicacies to Indian diaspora',
  },
  {
    id: 26,
    hostname: 'nutytales.vercel.app',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'deployment_host',
    classification: 'active_listed',
    purpose: 'Deployment host; non-canonical staging preview',
    urlFormula: 'Preview Deployment (noindex)',
    gscPropertyUri: null,
    indexingIntent: 'deployment_only',
    notes: 'Vercel deployment host; non-canonical application preview',
  },

  // ── 4. EXCLUDED LEGACY REFERENCES (3 Hosts — Barred from Crawl) ─────────────
  {
    id: 27,
    hostname: 'www.talentxcel.net',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'excluded',
    classification: 'excluded_legacy',
    purpose: 'Excluded legacy reference; barred from active crawl/indexing',
    urlFormula: 'Barred (legacy reference)',
    gscPropertyUri: null,
    indexingIntent: 'noindex_expected',
    notes: 'Explicitly excluded legacy reference by owner. Barred from active crawl.',
  },
  {
    id: 28,
    hostname: 'auth.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'excluded',
    classification: 'excluded_legacy',
    purpose: 'Excluded authentication origin; barred from active crawl',
    urlFormula: 'Barred (auth boundary)',
    gscPropertyUri: null,
    indexingIntent: 'noindex_expected',
    notes: 'Explicitly excluded authentication origin by owner. Barred from active crawl.',
  },
  {
    id: 29,
    hostname: 'cdn.talentxcel.in',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'excluded',
    classification: 'excluded_legacy',
    purpose: 'Excluded CDN origin; static assets only',
    urlFormula: 'Barred (asset origin)',
    gscPropertyUri: null,
    indexingIntent: 'noindex_expected',
    notes: 'Explicitly excluded CDN asset origin by owner. Barred from active crawl.',
  },

  // ── 5. PROPOSED ADDITIONS — NOT YET VERIFIED ACTIVE (6 Hosts) ─────────────
  {
    id: 30,
    hostname: 'talentxcel.net',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'proposed_addition',
    classification: 'proposed_addition',
    purpose: 'TalentXcel .net business; proposed separate business entity from .in',
    urlFormula: '/platform/[feature]-for-[persona]',
    gscPropertyUri: 'Pending Verification',
    indexingIntent: 'pending_verification',
    notes: 'Proposed expansion; separate business from .in. Not yet verified live.',
  },
  {
    id: 31,
    hostname: 'academy.talentxcel.net',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'proposed_addition',
    classification: 'proposed_addition',
    purpose: 'TalentXcel Academy; engineering modules & practical tests',
    urlFormula: '/academy/module/[topic]-practice-[level]',
    gscPropertyUri: 'Pending Verification',
    indexingIntent: 'pending_verification',
    notes: 'Proposed learning academy. Not present in verified active inventory.',
  },
  {
    id: 32,
    hostname: 'ai.talentxcel.net',
    brand: 'TalentXcel',
    brandSlug: 'talentxcel',
    hostRole: 'proposed_addition',
    classification: 'proposed_addition',
    purpose: 'TalentXcel AI offering; AI utilities and generator tools',
    urlFormula: '/ai/tools/[utility]-generator-[use-case]',
    gscPropertyUri: 'Pending Verification',
    indexingIntent: 'pending_verification',
    notes: 'Proposed AI suite. Not present in verified active inventory.',
  },
  {
    id: 33,
    hostname: 'middleeast.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'proposed_addition',
    classification: 'proposed_addition',
    purpose: 'Nuty Tales regional offering; GCC & Middle East diaspora delivery',
    urlFormula: '/me/store/[product]-luxury-hamper',
    gscPropertyUri: 'Pending Verification',
    indexingIntent: 'pending_verification',
    notes: 'Proposed regional expansion. Requires hreflang to prevent duplication.',
  },
  {
    id: 34,
    hostname: 'europe.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'proposed_addition',
    classification: 'proposed_addition',
    purpose: 'Nuty Tales regional offering; UK & Europe organic dry fruit delivery',
    urlFormula: '/eu/store/[product]-organic-heritage',
    gscPropertyUri: 'Pending Verification',
    indexingIntent: 'pending_verification',
    notes: 'Proposed regional expansion. Requires hreflang to prevent duplication.',
  },
  {
    id: 35,
    hostname: 'america.nutytales.com',
    brand: 'Nuty Tales',
    brandSlug: 'nutytales',
    hostRole: 'proposed_addition',
    classification: 'proposed_addition',
    purpose: 'Nuty Tales regional offering; US & Canada North American distribution',
    urlFormula: '/us/store/[product]-gourmet-orchard',
    gscPropertyUri: 'Pending Verification',
    indexingIntent: 'pending_verification',
    notes: 'Proposed regional expansion. Requires hreflang to prevent duplication.',
  },
];

export function PseoIntelligence() {
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Counts based on exact specification
  const totalHostnames = MASTER_DOMAIN_INVENTORY.length; // 35
  const activeListedCount = MASTER_DOMAIN_INVENTORY.filter((h) => h.classification === 'active_listed').length; // 26
  const excludedLegacyCount = MASTER_DOMAIN_INVENTORY.filter((h) => h.classification === 'excluded_legacy').length; // 3
  const proposedAdditionsCount = MASTER_DOMAIN_INVENTORY.filter((h) => h.classification === 'proposed_addition').length; // 6

  // Filtering
  const filteredHostnames = useMemo(() => {
    return MASTER_DOMAIN_INVENTORY.filter((item) => {
      if (classificationFilter !== 'all' && item.classification !== classificationFilter) return false;
      if (brandFilter !== 'all' && item.brandSlug !== brandFilter) return false;
      if (
        searchQuery &&
        !item.hostname.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.purpose.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [classificationFilter, brandFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* ─── Top Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🗺️</span>
            <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              Multi-Domain Inventory & pSEO Registry Matrix
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', maxWidth: '900px' }}>
            Authoritative inventory covering all <strong>35 recorded hostnames</strong>: 26 active/listed domains across TalentXcel, CHATR, and Nuty Tales, 3 explicitly excluded legacy references, and 6 proposed roadmap additions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Classification Filter */}
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <option value="all">All Records (35 Hostnames)</option>
            <option value="active_listed">Existing Listed (26 Active/Authoritative)</option>
            <option value="excluded_legacy">Excluded Legacy (3 Barred)</option>
            <option value="proposed_addition">Proposed Additions (6 Unverified)</option>
          </select>

          {/* Brand Filter */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <option value="all">All Ecosystems (3 Brands)</option>
            <option value="talentxcel">TalentXcel (16 Hosts)</option>
            <option value="chatr">CHATR (3 Hosts)</option>
            <option value="nutytales">Nuty Tales (16 Hosts)</option>
          </select>
        </div>
      </div>

      {/* ─── Accurate Inventory Breakdown Cards ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active / Listed Hostnames</span>
            <CheckCircle2 size={16} color="var(--accent-green)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', color: 'var(--accent-green)' }}>
            {activeListedCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            13 TalentXcel • 3 CHATR • 10 Nuty Tales
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Excluded Legacy References</span>
            <Ban size={16} color="var(--accent-red)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', color: 'var(--accent-red)' }}>
            {excludedLegacyCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-red)', marginTop: '4px' }}>
            Strictly barred from crawling & indexing
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Proposed Additions</span>
            <Clock size={16} color="var(--accent-purple)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', color: 'var(--accent-purple)' }}>
            {proposedAdditionsCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            3 TalentXcel (.net) • 3 Nuty Tales (regional)
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Combined Total Inventory</span>
            <Layers size={16} color="var(--accent-blue)" />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', color: 'var(--accent-blue)' }}>
            {totalHostnames}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Combined inventory count across all tiers
          </div>
        </div>
      </div>

      {/* ─── Search Bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <Search size={18} color="var(--text-secondary)" />
        <input
          type="text"
          placeholder="Filter hostnames or purpose (e.g. colleges, salary, gifting, chatr, vercel, excluded)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '13px',
            width: '100%',
            outline: 'none',
          }}
        />
      </div>

      {/* ─── Authoritative Domain Inventory Table ───────────────────── */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: '40px' }}>#</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Domain Hostname</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Brand</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Recorded Purpose</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Inventory Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>pSEO URL Formula</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>GSC Property</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Sitemap</th>
            </tr>
          </thead>
          <tbody>
            {filteredHostnames.map((item) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor:
                    item.classification === 'excluded_legacy'
                      ? 'rgba(239, 68, 68, 0.03)'
                      : item.classification === 'proposed_addition'
                      ? 'rgba(168, 85, 247, 0.02)'
                      : 'transparent',
                }}
              >
                {/* ID */}
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  {item.id}
                </td>

                {/* Hostname */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe
                      size={14}
                      color={
                        item.classification === 'excluded_legacy'
                          ? 'var(--accent-red)'
                          : item.classification === 'proposed_addition'
                          ? 'var(--accent-purple)'
                          : 'var(--accent-blue)'
                      }
                    />
                    <span style={{ textDecoration: item.classification === 'excluded_legacy' ? 'line-through' : 'none' }}>
                      {item.hostname}
                    </span>
                  </div>
                </td>

                {/* Brand */}
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      fontWeight: 600,
                    }}
                  >
                    {item.brand}
                  </span>
                </td>

                {/* Purpose */}
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '280px' }}>
                  {item.purpose}
                </td>

                {/* Classification Status Badge */}
                <td style={{ padding: '12px 16px' }}>
                  {item.classification === 'active_listed' && item.hostRole === 'primary' && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)', fontWeight: 600 }}>
                      Primary Domain
                    </span>
                  )}
                  {item.classification === 'active_listed' && item.hostRole === 'www_alias' && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', fontWeight: 600 }}>
                      WWW Alias (301)
                    </span>
                  )}
                  {item.classification === 'active_listed' && item.hostRole === 'product_subdomain' && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-green)', fontWeight: 600 }}>
                      Active Subdomain
                    </span>
                  )}
                  {item.classification === 'active_listed' && item.hostRole === 'search_console_property' && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-green)', fontWeight: 600 }}>
                      GSC Plural Host
                    </span>
                  )}
                  {item.classification === 'active_listed' && item.hostRole === 'deployment_host' && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', fontWeight: 600 }}>
                      Deployment Only
                    </span>
                  )}
                  {item.classification === 'excluded_legacy' && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', fontWeight: 600 }}>
                      Excluded Legacy
                    </span>
                  )}
                  {item.classification === 'proposed_addition' && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', fontWeight: 600 }}>
                      Proposed Addition
                    </span>
                  )}
                </td>

                {/* URL Formula */}
                <td style={{ padding: '12px 16px' }}>
                  <code
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: item.classification === 'excluded_legacy' ? 'var(--text-secondary)' : 'var(--accent-blue)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {item.urlFormula}
                  </code>
                </td>

                {/* GSC Property */}
                <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {item.gscPropertyUri ? (
                    <span style={{ color: item.gscPropertyUri.startsWith('Pending') ? 'var(--accent-purple)' : 'var(--accent-green)', fontWeight: 500 }}>
                      {item.gscPropertyUri}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>—</span>
                  )}
                </td>

                {/* Sitemap Link */}
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {item.classification === 'active_listed' && item.indexingIntent === 'indexable' ? (
                    <a
                      href={`https://${item.hostname}/sitemap_index.xml`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--accent-blue)',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      sitemap.xml
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Architectural Truth Banner ─────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '16px 20px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={16} color="var(--accent-green)" />
          Architectural Invariants & Governance Rules
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          <li>
            <strong>Total Hostnames (35):</strong> A combined count of 26 listed active/authoritative domains, 3 excluded legacy references, and 6 proposed roadmap additions.
          </li>
          <li>
            <strong>Singular vs Plural Separation:</strong> <code>employer.talentxcel.in</code> (direct employer hiring) and <code>employers.talentxcel.in</code> (GSC property & enterprise talent pool) are maintained as separate origins with non-overlapping content.
          </li>
          <li>
            <strong>Excluded Origins:</strong> <code>www.talentxcel.net</code>, <code>auth.talentxcel.in</code>, and <code>cdn.talentxcel.in</code> are barred from crawling, parsing, and search submissions.
          </li>
          <li>
            <strong>Proposed Additions:</strong> <code>talentxcel.net</code>, <code>academy.talentxcel.net</code>, <code>ai.talentxcel.net</code>, and the 3 regional Nuty Tales subdomains are unverified proposals and excluded from verified active counts.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default PseoIntelligence;
