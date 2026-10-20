import type { Context, Next } from 'hono';
import { DOMAIN_CONFIGS, type DomainConfig, BOT_UA_PATTERNS } from '../config/domains.js';

declare module 'hono' {
  interface ContextVariableMap {
    domainConfig: DomainConfig | null;
    hostname: string;
    isBot: boolean;
    canonicalBase: string;
    botWaveUrls?: string[];
  }
}

export async function hostnameMiddleware(c: Context, next: Next) {
  // Extract hostname from X-Forwarded-Host or Host header (strip port)
  const hostHeader = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? '';
  const hostname = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();

  // Look up domain config
  const config = DOMAIN_CONFIGS[hostname] ?? null;

  // Detect bot user-agent
  const ua = c.req.header('user-agent') ?? '';
  const isBot = BOT_UA_PATTERNS.some((pattern) => pattern.test(ua));

  // Set canonical base URL
  const canonicalBase = hostname ? `https://${hostname}` : '';

  c.set('domainConfig', config);
  c.set('hostname', hostname);
  c.set('isBot', isBot);
  c.set('canonicalBase', canonicalBase);

  await next();
}
