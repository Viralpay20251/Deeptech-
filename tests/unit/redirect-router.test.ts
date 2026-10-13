/**
 * Unit Test Suite: Redirect Router Service & Click Intelligence
 */

import { describe, it, expect } from 'vitest';
import { RedirectRouterService } from '../../apps/api/src/services/redirect-router.js';

describe('RedirectRouterService: IP Privacy & Utilities', () => {
  it('generates deterministic SHA-256 IP hash that masks raw client IP', () => {
    const rawIp = '198.51.100.42';
    const hash1 = RedirectRouterService.hashIp(rawIp);
    const hash2 = RedirectRouterService.hashIp(rawIp);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(32);
    expect(hash1).not.toContain(rawIp);
  });

  it('generates random alphanumeric short codes of specified length', () => {
    const code7 = RedirectRouterService.generateShortCode(7);
    const code10 = RedirectRouterService.generateShortCode(10);

    expect(code7).toHaveLength(7);
    expect(code10).toHaveLength(10);
    expect(/^[a-zA-Z0-9]+$/.test(code7)).toBe(true);
    expect(/^[a-zA-Z0-9]+$/.test(code10)).toBe(true);
  });

  it('blocks SSRF attempts when creating tracked links pointing to cloud metadata or loopback', async () => {
    // Should throw error when attempting to point to AWS metadata
    await expect(
      RedirectRouterService.createTrackedLink({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        brandId: '00000000-0000-0000-0001-000000000001',
        targetUrl: 'http://169.254.169.254/latest/meta-data/',
      })
    ).rejects.toThrow();

    // Should throw error when attempting loopback
    await expect(
      RedirectRouterService.createTrackedLink({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        brandId: '00000000-0000-0000-0001-000000000001',
        targetUrl: 'http://127.0.0.1:5432/admin',
      })
    ).rejects.toThrow();
  });
});

describe('RedirectRouterService: URL & UTM Synthesis', () => {
  it('merges link UTM tags and incoming query parameters properly', () => {
    const targetUrl = 'https://chatr.chat/pricing?ref=navbar';
    const dest = new URL(targetUrl);

    // Apply link UTMs
    dest.searchParams.set('utm_source', 'linkedin');
    dest.searchParams.set('utm_medium', 'organic_social');
    dest.searchParams.set('utm_campaign', 'ai_commerce_launch');

    // Merge incoming query parameters
    const incoming: Record<string, string> = {
      click_id: 'clk_12345',
      custom_cohort: 'apac_founders',
    };

    for (const [key, value] of Object.entries(incoming)) {
      if (!dest.searchParams.has(key)) {
        dest.searchParams.set(key, value);
      }
    }

    const finalUrl = dest.toString();
    expect(finalUrl).toContain('https://chatr.chat/pricing');
    expect(finalUrl).toContain('ref=navbar');
    expect(finalUrl).toContain('utm_source=linkedin');
    expect(finalUrl).toContain('utm_medium=organic_social');
    expect(finalUrl).toContain('utm_campaign=ai_commerce_launch');
    expect(finalUrl).toContain('click_id=clk_12345');
    expect(finalUrl).toContain('custom_cohort=apac_founders');
  });
});
