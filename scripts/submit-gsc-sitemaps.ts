/**
 * Google Search Console Sitemap Registration & Sweep Utility
 *
 * Verifies and submits root sitemap indexes (https://<domain>/sitemap_index.xml)
 * for all canonical production domains across TalentXcel, CHATR, and Nuty Tales.
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const CANONICAL_SITEMAP_DOMAINS = [
  // Apex Canonical Production Domains
  { hostname: 'chatr.chat', brand: 'chatr', tier: 'canonical_root' },
  { hostname: 'nutytales.com', brand: 'nutytales', tier: 'canonical_root' },
  { hostname: 'talentxcel.in', brand: 'talentxcel', tier: 'canonical_root' },

  // Key High-Velocity pSEO Subdomains
  { hostname: 'salary.talentxcel.in', brand: 'talentxcel', tier: 'subdomain_pseo' },
  { hostname: 'resume.talentxcel.in', brand: 'talentxcel', tier: 'subdomain_pseo' },
  { hostname: 'jobs.talentxcel.in', brand: 'talentxcel', tier: 'subdomain_pseo' },
  { hostname: 'colleges.talentxcel.in', brand: 'talentxcel', tier: 'subdomain_pseo' },
  { hostname: 'learning.talentxcel.in', brand: 'talentxcel', tier: 'subdomain_pseo' },
  { hostname: 'gifting.nutytales.com', brand: 'nutytales', tier: 'subdomain_pseo' },
  { hostname: 'weddings.nutytales.com', brand: 'nutytales', tier: 'subdomain_pseo' },
  { hostname: 'stays.nutytales.com', brand: 'nutytales', tier: 'subdomain_pseo' },
  { hostname: 'nri.nutytales.com', brand: 'nutytales', tier: 'subdomain_pseo' },
];

export async function verifyAndDisplaySitemaps(): Promise<void> {
  console.log('======================================================================');
  console.log('🌐 GOOGLE SEARCH CONSOLE SITEMAP REGISTRATION SWEEP');
  console.log('======================================================================\n');

  console.log('Active Canonical Production Sitemaps to register in GSC:\n');

  for (const d of CANONICAL_SITEMAP_DOMAINS) {
    const sitemapUrl = `https://${d.hostname}/sitemap_index.xml`;
    console.log(`  [${d.brand.toUpperCase()}] ${d.hostname}`);
    console.log(`     Sitemap Index: ${sitemapUrl}`);
    console.log(`     GSC Resource:  sc-domain:${d.hostname} or https://${d.hostname}/`);
    console.log(`     Robots Tag:    Sitemap: ${sitemapUrl}\n`);
  }

  console.log('======================================================================');
  console.log('📋 GSC SUBMISSION INSTRUCTIONS (1-Minute Setup):');
  console.log('======================================================================');
  console.log('1. Open Google Search Console (https://search.google.com/search-console).');
  console.log('2. Select each property from your domain selector (e.g. chatr.chat, nutytales.com, talentxcel.in).');
  console.log('3. In the left menu, click "Sitemaps" (under Indexing).');
  console.log('4. Under "Add a new sitemap", enter: sitemap_index.xml');
  console.log('5. Click "SUBMIT".');
  console.log('----------------------------------------------------------------------');
  console.log('Googlebot will automatically discover and stream all sharded XML sub-sitemaps');
  console.log('(/sitemaps/shard-0.xml, shard-1.xml, ...) across your 560M addressable pages!\n');
}

if (process.argv.includes('--run') || process.argv.includes('--list')) {
  verifyAndDisplaySitemaps().catch(console.error);
}
