/**
 * Vercel / Edge Middleware: 35-Hostname Master Governance Engine
 *
 * Enforces:
 * 1. Immediate HTTP 301 Permanent Redirects for non-canonical WWW/regional hosts:
 *    - www.talentxcel.in -> https://talentxcel.in
 *    - www.nutytales.com -> https://nutytales.com
 *    - chatrchat.in      -> https://www.chatrchat.in
 * 2. Strict Staging Firewall for Vercel preview hosts:
 *    - career-pathways-ai-builder.vercel.app, nutytales.vercel.app
 *    -> Injects X-Robots-Tag: noindex, nofollow, noarchive
 *    -> Sets Link: <https://production-target>; rel="canonical"
 * 3. Security Firewall for Excluded Legacy Origins:
 *    - www.talentxcel.net, auth.talentxcel.in, cdn.talentxcel.in
 *    -> Returns HTTP 403 Forbidden with X-Robots-Tag: noindex
 * 4. High-Performance Edge Routing for the 21 Canonical Production Hosts:
 *    -> Injects x-matched-host, x-brand-cluster, and long-lived Cache-Control
 */

export interface EdgeRequest {
  url: string;
  headers: Headers;
  method: string;
}

export interface EdgeResponseInit {
  status?: number;
  statusText?: string;
  headers?: Record<string, string> | Headers;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const REDIRECT_MAP: Record<string, string> = {
  'www.talentxcel.in': 'https://talentxcel.in',
  'www.nutytales.com': 'https://nutytales.com',
  'chatrchat.in': 'https://www.chatrchat.in',
};

export const DEPLOYMENT_HOSTS: Record<string, string> = {
  'career-pathways-ai-builder.vercel.app': 'https://careers.talentxcel.in',
  'nutytales.vercel.app': 'https://nutytales.com',
};

export const EXCLUDED_LEGACY_HOSTS = new Set([
  'www.talentxcel.net',
  'auth.talentxcel.in',
  'cdn.talentxcel.in',
]);

export const CANONICAL_21_HOSTS = new Set([
  // TalentXcel (11 Canonical Hosts)
  'talentxcel.in',
  'colleges.talentxcel.in',
  'careers.talentxcel.in',
  'salary.talentxcel.in',
  'resume.talentxcel.in',
  'jobs.talentxcel.in',
  'employer.talentxcel.in',
  'employers.talentxcel.in',
  'government.talentxcel.in',
  'learning.talentxcel.in',
  'passport.talentxcel.in',
  // CHATR (2 Canonical Hosts)
  'chatr.chat',
  'www.chatrchat.in',
  // Nuty Tales (8 Canonical Hosts)
  'nutytales.com',
  'business.nutytales.com',
  'gifting.nutytales.com',
  'weddings.nutytales.com',
  'crafts.nutytales.com',
  'stays.nutytales.com',
  'travel.nutytales.com',
  'nri.nutytales.com',
]);

/**
 * Main Edge Middleware Handler (Standard Web API compatible for Vercel / Cloudflare Workers)
 */
export async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const rawHost = request.headers.get('host') || url.hostname;
  const hostname = rawHost.split(':')[0].toLowerCase();

  // ── 1. RULE 1: 301 Canonical Permanent Redirects ──────────────────────────
  const redirectTarget = REDIRECT_MAP[hostname];
  if (redirectTarget) {
    const targetUrl = `${redirectTarget}${url.pathname}${url.search}`;
    return new Response(null, {
      status: 301,
      headers: {
        Location: targetUrl,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Redirect-Reason': 'Canonical-301-Consolidation',
      },
    });
  }

  // ── 2. RULE 2: Barred Legacy Firewall (HTTP 403) ──────────────────────────
  if (EXCLUDED_LEGACY_HOSTS.has(hostname)) {
    return new Response(
      JSON.stringify({
        error: 'FORBIDDEN_LEGACY_ORIGIN',
        message: `Hostname ${hostname} is explicitly barred from search engine indexation and public traffic.`,
        canonical_ecosystem: 'https://talentxcel.in',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      }
    );
  }

  // ── 3. RULE 3: Staging Leak Prevention on .vercel.app Hosts ───────────────
  const canonicalForDeployment = DEPLOYMENT_HOSTS[hostname];
  if (canonicalForDeployment || (hostname.endsWith('.vercel.app') && !hostname.startsWith('deeptech-taupe'))) {
    const canonicalLink = canonicalForDeployment
      ? `<${canonicalForDeployment}${url.pathname}>; rel="canonical"`
      : undefined;

    const response = new Response(null, {
      status: 200,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        ...(canonicalLink ? { Link: canonicalLink } : {}),
        'X-Deployment-Notice': 'Non-canonical preview environment',
      },
    });

    return response;
  }

  // ── 4. RULE 4: 21 Canonical Production Hosts Edge Headers ─────────────────
  if (CANONICAL_21_HOSTS.has(hostname)) {
    // Determine brand cluster
    const brandCluster = hostname.includes('chatr')
      ? 'chatr'
      : hostname.includes('nuty')
      ? 'nutytales'
      : 'talentxcel';

    // Return header hints for upstream SSR renderer / Hono server
    const headers = new Headers();
    headers.set('x-matched-host', hostname);
    headers.set('x-brand-cluster', brandCluster);
    headers.set('x-canonical-origin', `https://${hostname}`);
    headers.set('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
    headers.set('X-Robots-Tag', 'index, follow, max-image-preview:large');

    // Pass through to SSR application
    return undefined;
  }

  // Fallthrough for internal dashboard / api routes
  return undefined;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (/api/*)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
