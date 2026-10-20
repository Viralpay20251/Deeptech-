import type { DomainConfig, BrandCluster } from '../config/domains.js';
import { renderInteractiveMultiplierHtml } from '../components/InteractiveMultipliers/SessionMultiplierFlow.js';
import { getOgDataUri, DISCOVER_ROBOTS_META } from '../../../../services/discover-igniter/src/discoverEngine.js';

export interface LeafPageRenderParams {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  domainConfig: DomainConfig;
  dimensionValues: Record<string, { slug: string; display_value: string; metadata?: Record<string, unknown> }>;
  ringNeighbors: Array<{ url: string; title: string }>;
  longDistanceLinks: Array<{ url: string; title: string }>;
  jsonLd: Record<string, unknown> | Array<Record<string, unknown>>;
  botWaveUrls?: string[];
  cacheControlHint?: string;
  ogImageUrl?: string;
}

export interface HubPageRenderParams {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  domainConfig: DomainConfig;
  breadcrumbs: Array<{ name: string; url: string }>;
  hubTitle: string;
  hubDescription: string;
  childLinks: Array<{ url: string; title: string; badge?: string; count?: number }>;
  botWaveUrls?: string[];
  cacheControlHint?: string;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getBrandColor(brand: BrandCluster): { primary: string; accent: string; bg: string; brandName: string } {
  switch (brand) {
    case 'chatr':
      return { primary: '#4f46e5', accent: '#6366f1', bg: '#f8fafc', brandName: 'Chatr' };
    case 'nutytales':
      return { primary: '#92400e', accent: '#b45309', bg: '#fffbeb', brandName: 'NutyTales' };
    case 'talentxcel':
    default:
      return { primary: '#0f172a', accent: '#2563eb', bg: '#f1f5f9', brandName: 'TalentXcel' };
  }
}

function renderHreflangTags(canonicalUrl: string, brand: BrandCluster): string {
  if (brand !== 'nutytales') return '';
  // Regional expansion hreflang tags for Nutytales
  const baseUrl = canonicalUrl.replace(/^https?:\/\/[^/]+/, '');
  return `
    <link rel="alternate" hreflang="x-default" href="https://nutytales.com${baseUrl}" />
    <link rel="alternate" hreflang="en-IN" href="https://nutytales.com${baseUrl}" />
    <link rel="alternate" hreflang="en-US" href="https://nri.nutytales.com${baseUrl}" />
    <link rel="alternate" hreflang="en-GB" href="https://gifting.nutytales.com${baseUrl}" />
    <link rel="alternate" hreflang="en-AE" href="https://travel.nutytales.com${baseUrl}" />
  `;
}

function getCommonCss(brand: BrandCluster): string {
  const theme = getBrandColor(brand);
  return `
    :root {
      --primary: ${theme.primary};
      --accent: ${theme.accent};
      --bg: ${theme.bg};
      --text: #1e293b;
      --text-muted: #64748b;
      --card-bg: #ffffff;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: var(--text); background: var(--bg); }
    header { background: #ffffff; border-bottom: 1px solid var(--border); padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; }
    header a.logo { font-size: 1.35rem; font-weight: 800; color: var(--primary); text-decoration: none; }
    main { max-width: 1100px; margin: 2rem auto; padding: 0 1.5rem; min-height: 70vh; }
    .breadcrumbs { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.5rem; }
    .breadcrumbs a { color: var(--accent); text-decoration: none; }
    h1 { font-size: 2.25rem; line-height: 1.25; margin-bottom: 1rem; color: var(--primary); letter-spacing: -0.02em; }
    .lead { font-size: 1.15rem; color: var(--text-muted); margin-bottom: 2rem; border-left: 4px solid var(--accent); padding-left: 1rem; }
    .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; }
    @media (max-width: 768px) { .content-grid { grid-template-columns: 1fr; } }
    .section-box { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .section-box h2 { font-size: 1.35rem; margin-bottom: 0.75rem; color: var(--primary); }
    .section-box p { margin-bottom: 0.85rem; }
    .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
    .links-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .link-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; text-decoration: none; color: var(--text); transition: border-color 0.15s ease, box-shadow 0.15s ease; display: block; }
    .link-card:hover { border-color: var(--accent); box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
    .link-card .title { font-weight: 600; color: var(--accent); }
    .sidebar-widget { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; }
    .sidebar-widget h3 { font-size: 1.1rem; margin-bottom: 0.85rem; color: var(--primary); }
    .sidebar-widget ul { list-style: none; }
    .sidebar-widget li { margin-bottom: 0.6rem; }
    .sidebar-widget a { color: var(--accent); text-decoration: none; font-size: 0.925rem; }
    .sidebar-widget a:hover { text-decoration: underline; }
    footer { border-top: 1px solid var(--border); background: #ffffff; padding: 2.5rem 1.5rem; margin-top: 4rem; }
    .footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2rem; }
    .footer-col h4 { font-size: 0.95rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary); }
    .footer-col ul { list-style: none; font-size: 0.875rem; }
    .footer-col li { margin-bottom: 0.5rem; }
    .footer-col a { color: var(--text-muted); text-decoration: none; }
    .footer-col a:hover { color: var(--accent); }
    .footer-bottom { text-align: center; font-size: 0.8rem; color: var(--text-muted); margin-top: 2rem; }
  `;
}

export function renderLeafPage(params: LeafPageRenderParams): string {
  const {
    title,
    metaDescription,
    canonicalUrl,
    domainConfig,
    dimensionValues,
    ringNeighbors,
    longDistanceLinks,
    jsonLd,
    botWaveUrls = [],
    cacheControlHint = 'public, s-maxage=2592000, stale-while-revalidate=86400',
    ogImageUrl,
  } = params;

  const brand = domainConfig.brand;
  const theme = getBrandColor(brand);
  const hreflangTags = renderHreflangTags(canonicalUrl, brand);
  const dimEntries = Object.entries(dimensionValues);

  const slug = canonicalUrl.split('/').filter(Boolean).pop() || 'overview';
  const effectiveOgImage = ogImageUrl || `https://${domainConfig.hostname}/og/${slug}.png`;

  // Formulate rich contextual content based on dimensions
  const dimSummaries = dimEntries.map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v.display_value)}`).join(' &bull; ');

  // Bot wave links injection for search bots
  const botLinksHtml = botWaveUrls.length > 0
    ? `<div style="display:none;" aria-hidden="true">${botWaveUrls
        .map((url) => `<a href="${escapeHtml(url)}">Index Node</a>`)
        .join(' ')}</div>`
    : '';

  const preloadBotHints = botWaveUrls.length > 0
    ? botWaveUrls.slice(0, 3).map((url) => `<link rel="next" href="${escapeHtml(url)}" />`).join('\n')
    : '';

  const interactiveMultiplierWidget = renderInteractiveMultiplierHtml(
    domainConfig.hostname,
    brand,
    dimensionValues['role']?.display_value || dimensionValues['product']?.display_value || dimensionValues['intent']?.display_value || title,
    dimensionValues['city']?.display_value || dimensionValues['region']?.display_value || 'bengaluru'
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Cache hint: ${cacheControlHint} -->
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(theme.brandName)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta name="robots" content="${DISCOVER_ROBOTS_META}" />
  
  <!-- OpenGraph with 1200x675 Discover Card -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(theme.brandName)}" />
  <meta property="og:image" content="${escapeHtml(effectiveOgImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="675" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(effectiveOgImage)}" />
  
  ${hreflangTags}
  ${preloadBotHints}

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
${getCommonCss(brand)}
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">${escapeHtml(theme.brandName)}</a>
    <nav style="font-size:0.9rem;">
      <a href="/" style="color:var(--text); text-decoration:none; margin-right: 1.25rem;">Directory Home</a>
      <a href="#related" style="color:var(--text); text-decoration:none;">Related Topics</a>
    </nav>
  </header>

  <main>
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> &gt; 
      <a href="${escapeHtml(domainConfig.pathPrefix)}">${escapeHtml(domainConfig.pathPrefix.replace(/\//g, ''))}</a> &gt; 
      <span>${escapeHtml(title)}</span>
    </nav>

    <article>
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">${escapeHtml(metaDescription)}</p>

      <!-- 6x Session Depth Interactive Tool Engine -->
      ${interactiveMultiplierWidget}

      <div style="margin-bottom: 1.5rem; font-size: 0.95rem; color: #475569;">
        ${dimSummaries}
      </div>

      <div class="content-grid">
        <section class="main-column">
          <div class="section-box">
            <h2>Comprehensive Analysis &amp; Overview</h2>
            <p>
              In today's dynamic ecosystem, navigating requirements around <strong>${escapeHtml(title)}</strong> requires precision data, verified protocols, and targeted contextual execution. Our automated knowledge graph collates primary benchmarks to deliver real-time operational insights.
            </p>
            <p>
              Whether evaluating market demands, compensation bands, or structural blueprints, having structured dimensional clarity across ${dimEntries.map(([_, v]) => escapeHtml(v.display_value)).join(', ')} ensures informed decision-making.
            </p>
          </div>

          <div class="section-box">
            <h2>Key Specifications &amp; Core Standards</h2>
            <p>
              Every parameter across this classification is vetted through continuous telemetry and multi-cluster validation:
            </p>
            <ul style="padding-left: 1.25rem; margin-bottom: 1rem;">
              ${dimEntries
                .map(([type, val]) => `<li><strong>${escapeHtml(type.toUpperCase())}:</strong> ${escapeHtml(val.display_value)} &mdash; verified in primary catalog.</li>`)
                .join('\n')}
              <li><strong>Verification Protocol:</strong> Real-time deterministic route routing.</li>
              <li><strong>Reliability Tier:</strong> Crawl Priority ${escapeHtml(domainConfig.crawlBudgetTier.toUpperCase())} (${domainConfig.sitemapPriority * 100}%).</li>
            </ul>
          </div>

          <div class="section-box">
            <h2>Next Steps &amp; Action Plan</h2>
            <p>
              Engage directly with the ecosystem resources below or review nearby related domains to expand your scope:
            </p>
            <div style="margin-top: 1rem;">
              <a href="${escapeHtml(domainConfig.pathPrefix)}" style="display:inline-block; background:var(--accent); color:#fff; padding:0.6rem 1.25rem; border-radius:6px; text-decoration:none; font-weight:600;">Explore Full Category</a>
            </div>
          </div>
        </section>

        <aside class="sidebar-column">
          ${
            ringNeighbors.length > 0
              ? `
          <div class="sidebar-widget">
            <h3>Nearby Ring Neighbors</h3>
            <ul>
              ${ringNeighbors
                .slice(0, 8)
                .map((neighbor) => `<li><a href="${escapeHtml(neighbor.url)}">${escapeHtml(neighbor.title)}</a></li>`)
                .join('\n')}
            </ul>
          </div>`
              : ''
          }

          ${
            longDistanceLinks.length > 0
              ? `
          <div class="sidebar-widget">
            <h3>Cross-Cluster Recommendations</h3>
            <ul>
              ${longDistanceLinks
                .map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a></li>`)
                .join('\n')}
            </ul>
          </div>`
              : ''
          }
        </aside>
      </div>

      <section id="related" style="margin-top: 3rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: var(--primary);">Explore Additional Related Pages</h2>
        <div class="links-grid">
          ${ringNeighbors
            .slice(8, 12)
            .map(
              (n) => `
            <a href="${escapeHtml(n.url)}" class="link-card">
              <div class="title">${escapeHtml(n.title)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">Explore details &rarr;</div>
            </a>
          `
            )
            .join('\n')}
        </div>
      </section>
    </article>
    ${botLinksHtml}
  </main>

  <footer>
    <div class="footer-inner">
      <div class="footer-col">
        <h4>${escapeHtml(theme.brandName)} Platform</h4>
        <ul>
          <li><a href="/">Directory Overview</a></li>
          <li><a href="/sitemap_index.xml">XML Sitemap Index</a></li>
          <li><a href="/robots.txt">Robots Directive</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Ecosystem</h4>
        <ul>
          <li><a href="https://${escapeHtml(domainConfig.hostname)}">${escapeHtml(domainConfig.hostname)}</a></li>
          <li><a href="https://${escapeHtml(domainConfig.hostname)}${escapeHtml(domainConfig.pathPrefix)}">Cluster Root</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Performance &amp; SLA</h4>
        <ul>
          <li>Deterministic Edge Router</li>
          <li>Sub-5ms Response Budget</li>
          <li>Zero-Latency Indexing</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      &copy; ${new Date().getFullYear()} ${escapeHtml(theme.brandName)} Autonomous Network. All rights reserved.
    </div>
  </footer>
</body>
</html>`;
}

export function renderHubPage(params: HubPageRenderParams): string {
  const {
    title,
    metaDescription,
    canonicalUrl,
    domainConfig,
    breadcrumbs,
    hubTitle,
    hubDescription,
    childLinks,
    botWaveUrls = [],
    cacheControlHint = 'public, s-maxage=86400, stale-while-revalidate=43200',
  } = params;

  const brand = domainConfig.brand;
  const theme = getBrandColor(brand);
  const hreflangTags = renderHreflangTags(canonicalUrl, brand);

  const botLinksHtml = botWaveUrls.length > 0
    ? `<div style="display:none;" aria-hidden="true">${botWaveUrls
        .map((url) => `<a href="${escapeHtml(url)}">Index Node</a>`)
        .join(' ')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Cache hint: ${cacheControlHint} -->
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(theme.brandName)} Directory</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta name="robots" content="${DISCOVER_ROBOTS_META}" />
  
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:type" content="website" />
  
  ${hreflangTags}

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${escapeHtml(hubTitle)}",
    "description": "${escapeHtml(hubDescription)}",
    "url": "${escapeHtml(canonicalUrl)}",
    "numberOfItems": ${childLinks.length}
  }
  </script>

  <style>
${getCommonCss(brand)}
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">${escapeHtml(theme.brandName)}</a>
    <nav style="font-size:0.9rem;">
      <a href="/" style="color:var(--text); text-decoration:none;">Directory Root</a>
    </nav>
  </header>

  <main>
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      ${breadcrumbs
        .map((b, idx) =>
          idx === breadcrumbs.length - 1
            ? `<span>${escapeHtml(b.name)}</span>`
            : `<a href="${escapeHtml(b.url)}">${escapeHtml(b.name)}</a> &gt; `
        )
        .join('')}
    </nav>

    <section>
      <h1>${escapeHtml(hubTitle)}</h1>
      <p class="lead">${escapeHtml(hubDescription)}</p>

      <div style="margin-bottom: 2rem; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size: 0.95rem; color: var(--text-muted);">
          Showing <strong>${childLinks.length}</strong> available resources
        </span>
      </div>

      <div class="links-grid">
        ${childLinks
          .map(
            (link) => `
          <a href="${escapeHtml(link.url)}" class="link-card">
            <div class="title">${escapeHtml(link.title)}</div>
            ${link.badge ? `<div style="margin-top:0.4rem;"><span class="badge">${escapeHtml(link.badge)}</span></div>` : ''}
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem;">Explore &rarr;</div>
          </a>
        `
          )
          .join('\n')}
      </div>
    </section>
    ${botLinksHtml}
  </main>

  <footer>
    <div class="footer-inner">
      <div class="footer-col">
        <h4>${escapeHtml(theme.brandName)}</h4>
        <ul>
          <li><a href="/">Directory Root</a></li>
          <li><a href="/sitemap_index.xml">Sitemaps</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Host</h4>
        <ul>
          <li>${escapeHtml(domainConfig.hostname)}</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      &copy; ${new Date().getFullYear()} ${escapeHtml(theme.brandName)} Autonomous Network.
    </div>
  </footer>
</body>
</html>`;
}
