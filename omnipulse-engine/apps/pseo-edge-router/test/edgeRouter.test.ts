import assert from 'node:assert';
import {
  encodePageId,
  decodePageId,
  totalPages,
  getRingNeighbors,
  getLongDistanceLinks,
  buildPageUrl,
  getSitemapShard,
} from '../src/lib/combinatorialIndex.js';
import { DOMAIN_CONFIGS, BOT_UA_PATTERNS } from '../src/config/domains.js';
import {
  buildJobPostingSchema,
  buildCourseSchema,
  buildArticleSchema,
  buildSoftwareApplicationSchema,
  buildJsonLdForDomain,
} from '../src/lib/jsonLdBuilders.js';
import { renderLeafPage, renderHubPage } from '../src/lib/htmlRenderer.js';
import { getCompiledPattern } from '../src/routes/leafPage.js';
import { app } from '../src/server.js';

console.log('🧪 Starting pSEO Edge Router Test Suite...\n');

// 1. Test Combinatorial Index Bijective Math
console.log('Test 1: Bijective Combinatorial Index...');
const dims = { counts: [50, 20, 10] }; // 10,000 permutations
const total = totalPages(dims);
assert.strictEqual(total, 10000n, 'Total pages should be 10,000');

// Encode and decode test across range of addresses
const testAddresses = [
  { indices: [0, 0, 0] },
  { indices: [49, 19, 9] },
  { indices: [25, 10, 5] },
  { indices: [1, 2, 3] },
];

for (const addr of testAddresses) {
  const id = encodePageId(addr, dims);
  const decoded = decodePageId(id, dims);
  assert.deepStrictEqual(decoded.indices, addr.indices, `Bijective encode/decode mismatch for ${JSON.stringify(addr)}`);
}

// Out of bounds check
assert.throws(() => encodePageId({ indices: [50, 0, 0] }, dims), /out of range/);

// Ring neighbors
const neighbors = getRingNeighbors(9995n, dims, 12);
assert.strictEqual(neighbors.length, 12);
assert.strictEqual(neighbors[0], 9996n);
assert.strictEqual(neighbors[5], 1n); // wraps around 10000n

// Long distance links
const longLinks = getLongDistanceLinks(42n, dims, 5);
assert.strictEqual(longLinks.length, 5);

// Sitemap shard assignment
assert.strictEqual(getSitemapShard(0n), 0);
assert.strictEqual(getSitemapShard(49999n), 0);
assert.strictEqual(getSitemapShard(50000n), 1);
assert.strictEqual(getSitemapShard(125000n), 2);

// buildPageUrl
const url1 = buildPageUrl('/job/', '-in-', ['react-dev', 'bangalore', 'typescript']);
assert.strictEqual(url1, '/job/react-dev-in-bangalore-typescript');
console.log('✅ Bijective Combinatorial Index verified successfully.');

// 2. Test Domain Configurations
console.log('\nTest 2: Domain Registry Verification...');
const domains = Object.keys(DOMAIN_CONFIGS);
assert.strictEqual(domains.length, 22, `Expected 22 domains, got ${domains.length}`);

for (const [hostname, cfg] of Object.entries(DOMAIN_CONFIGS)) {
  assert.strictEqual(cfg.hostname, hostname);
  assert.ok(cfg.dimensions.length >= 1, `Dimensions empty for ${hostname}`);
  assert.ok(cfg.pathPrefix.startsWith('/'), `PathPrefix must start with / for ${hostname}`);
  assert.ok(cfg.sitemapPriority > 0 && cfg.sitemapPriority <= 1.0);
}

// Bot UA regex patterns check
const googlebotUa = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const isBot = BOT_UA_PATTERNS.some((p) => p.test(googlebotUa));
assert.strictEqual(isBot, true, 'Googlebot must be detected');

const humanUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const isHumanBot = BOT_UA_PATTERNS.some((p) => p.test(humanUa));
assert.strictEqual(isHumanBot, false, 'Human browser must not be flagged as bot');
console.log('✅ Domain Registry & Bot Patterns verified successfully.');

// 3. Test Pattern Compilation for Leaf Routes
console.log('\nTest 3: Dynamic Pattern Compiler...');
const jobPattern = getCompiledPattern('/job/:role-in-:city-with-:skill');
const jobMatch = '/job/senior-dev-in-mumbai-with-node'.match(jobPattern.regex);
assert.ok(jobMatch, 'Should match job pattern');
assert.strictEqual(jobMatch[1], 'senior-dev');
assert.strictEqual(jobMatch[2], 'mumbai');
assert.strictEqual(jobMatch[3], 'node');

const entPattern = getCompiledPattern('/enterprise/:sector-talent-pool');
const entMatch = '/enterprise/fintech-talent-pool'.match(entPattern.regex);
assert.ok(entMatch, 'Should match enterprise pattern');
assert.strictEqual(entMatch[1], 'fintech');

const learnPattern = getCompiledPattern('/learn/:skill-tutorial-for-:level');
const learnMatch = '/learn/docker-tutorial-for-advanced'.match(learnPattern.regex);
assert.ok(learnMatch, 'Should match learn pattern');
assert.strictEqual(learnMatch[1], 'docker');
assert.strictEqual(learnMatch[2], 'advanced');
console.log('✅ Pattern Compiler verified successfully.');

// 4. Test JSON-LD Builders
console.log('\nTest 4: JSON-LD Schemas...');
const jobJsonLd = buildJobPostingSchema({
  title: 'Full Stack Engineer in Delhi',
  description: 'Top job posting for engineer',
  canonicalUrl: 'https://jobs.talentxcel.in/job/full-stack-engineer-in-delhi-with-typescript',
  brand: 'talentxcel',
  role: 'Full Stack Engineer',
  city: 'Delhi',
  skill: 'TypeScript',
});
assert.strictEqual(jobJsonLd['@type'], 'JobPosting');
assert.strictEqual(jobJsonLd['skills'], 'TypeScript');

const courseJsonLd = buildCourseSchema({
  title: 'Python for Beginners',
  description: 'Comprehensive Python training',
  canonicalUrl: 'https://learning.talentxcel.in/learn/python-tutorial-for-beginners',
  brand: 'talentxcel',
  skillOrTopic: 'Python',
  level: 'Beginners',
});
assert.strictEqual(courseJsonLd['@type'], 'Course');

const appJsonLd = buildSoftwareApplicationSchema({
  title: 'CRM Automation Agent',
  description: 'AI workflow agent for CRM',
  canonicalUrl: 'https://chatr.chat/agent/crm-lead-qualification',
  brand: 'chatr',
});
assert.strictEqual(appJsonLd['@type'], 'SoftwareApplication');

const articleJsonLd = buildArticleSchema({
  title: 'Kashmiri Saffron Harvesting Guide',
  description: 'Organic farming in Pampore',
  canonicalUrl: 'https://nutytales.com/store/saffron-organic-kashmir',
  brand: 'nutytales',
});
assert.strictEqual(articleJsonLd['@type'], 'Article');
console.log('✅ JSON-LD Builders verified successfully.');

// 5. Test SSR HTML Rendering
console.log('\nTest 5: HTML Rendering...');
const sampleConfig = DOMAIN_CONFIGS['jobs.talentxcel.in'];
const leafHtml = renderLeafPage({
  title: 'React Architect in Bangalore with TypeScript',
  metaDescription: 'Verified job requirements for React Architect in Bangalore.',
  canonicalUrl: 'https://jobs.talentxcel.in/job/react-architect-in-bangalore-with-typescript',
  domainConfig: sampleConfig,
  dimensionValues: {
    role: { slug: 'react-architect', display_value: 'React Architect' },
    city: { slug: 'bangalore', display_value: 'Bangalore' },
    skill: { slug: 'typescript', display_value: 'TypeScript' },
  },
  ringNeighbors: [{ url: '/job/react-dev-in-pune-with-node', title: 'React Dev in Pune' }],
  longDistanceLinks: [{ url: '/job/devops-in-hyderabad-with-aws', title: 'DevOps in Hyderabad' }],
  jsonLd: jobJsonLd,
  botWaveUrls: ['https://jobs.talentxcel.in/job/cloud-architect-in-delhi-with-gcp'],
});

assert.ok(leafHtml.includes('<!DOCTYPE html>'));
assert.ok(leafHtml.includes('<title>React Architect in Bangalore with TypeScript | TalentXcel</title>'));
assert.ok(leafHtml.includes('<link rel="canonical" href="https://jobs.talentxcel.in/job/react-architect-in-bangalore-with-typescript" />'));
assert.ok(leafHtml.includes('application/ld+json'));
assert.ok(leafHtml.includes('Nearby Ring Neighbors'));
assert.ok(leafHtml.includes('Cross-Cluster Recommendations'));
assert.ok(leafHtml.includes('<link rel="next" href="https://jobs.talentxcel.in/job/cloud-architect-in-delhi-with-gcp" />'));

const hubHtml = renderHubPage({
  title: 'TalentXcel Job Categories',
  metaDescription: 'Browse top engineering and technical job categories.',
  canonicalUrl: 'https://jobs.talentxcel.in/',
  domainConfig: sampleConfig,
  breadcrumbs: [{ name: 'Home', url: '/' }],
  hubTitle: 'Software Engineering Jobs Directory',
  hubDescription: 'Verified opportunities across top locations.',
  childLinks: [{ url: '/frontend-developer', title: 'Frontend Developer', badge: 'ENGINEERING' }],
});
assert.ok(hubHtml.includes('<h1>Software Engineering Jobs Directory</h1>'));
assert.ok(hubHtml.includes('href="/frontend-developer"'));
console.log('✅ HTML Renderer verified successfully.');

// 6. Test Server HTTP Endpoints
console.log('\nTest 6: HTTP Server Endpoints...');
async function runHttpTests() {
  // Health
  const resHealth = await app.request('/health');
  assert.strictEqual(resHealth.status, 200);
  const jsonHealth = await resHealth.json();
  assert.strictEqual(jsonHealth.status, 'ok');

  // Robots.txt
  const resRobots = await app.request('/robots.txt', {
    headers: { host: 'jobs.talentxcel.in' },
  });
  assert.strictEqual(resRobots.status, 200);
  const textRobots = await resRobots.text();
  assert.ok(textRobots.includes('Sitemap: https://jobs.talentxcel.in/sitemap_index.xml'));

  // Sitemap Index
  const resSitemapIdx = await app.request('/sitemap_index.xml', {
    headers: { host: 'jobs.talentxcel.in' },
  });
  assert.strictEqual(resSitemapIdx.status, 200);
  assert.strictEqual(resSitemapIdx.headers.get('content-type'), 'application/xml; charset=utf-8');
  const textSitemapIdx = await resSitemapIdx.text();
  assert.ok(textSitemapIdx.includes('<sitemapindex'));
  assert.ok(textSitemapIdx.includes('https://jobs.talentxcel.in/sitemaps/shard-0.xml'));

  // Sitemap Shard 0
  const resShard0 = await app.request('/sitemaps/shard-0.xml', {
    headers: { host: 'jobs.talentxcel.in' },
  });
  assert.strictEqual(resShard0.status, 200);
  assert.strictEqual(resShard0.headers.get('content-type'), 'application/xml; charset=utf-8');
  const textShard0 = await resShard0.text();
  assert.ok(textShard0.includes('<urlset'));

  // Directory Hub Root
  const resHub = await app.request('/', {
    headers: { host: 'jobs.talentxcel.in' },
  });
  assert.strictEqual(resHub.status, 200);
  const textHub = await resHub.text();
  assert.ok(textHub.includes('TalentXcel Directory &amp; Resource Center'));

  // Dynamic 1200x675 OG PNG Endpoint
  const resOg = await app.request('/og/software-engineer-in-bengaluru.png', {
    headers: { host: 'salary.talentxcel.in' },
  });
  assert.strictEqual(resOg.status, 200);
  assert.strictEqual(resOg.headers.get('content-type'), 'image/png');
  assert.strictEqual(resOg.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const ogArrayBuffer = await resOg.arrayBuffer();
  assert.ok(ogArrayBuffer.byteLength > 1000, 'Rendered PNG must be over 1000 bytes');
  console.log(`✅ Dynamic 1200x675 OG PNG rasterizer verified (${ogArrayBuffer.byteLength} bytes).`);

  // 404 Fallback for unknown path
  const res404 = await app.request('/non-existent-random-page-12345', {
    headers: { host: 'unknown-domain.com' },
  });
  assert.strictEqual(res404.status, 404);

  console.log('✅ Server HTTP Endpoints verified successfully.');
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runHttpTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
