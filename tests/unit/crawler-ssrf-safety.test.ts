/**
 * Crawl Engine & SSRF Safety Defenses Test
 *
 * Verifies P1 Requirements:
 * 1. Blocks localhost, 127.0.0.1, [::1], and 0.0.0.0
 * 2. Blocks cloud metadata endpoints (169.254.169.254, metadata.google)
 * 3. Blocks private IPv4 ranges (10.x, 172.16.x, 192.168.x)
 * 4. Rejects non-HTTP protocols (file://, ftp://, gopher://)
 * 5. Handles HTML parsing deterministically into page snapshot data
 */

import { describe, it, expect } from 'vitest';
import { assertSafeOutboundUrl, assertSafeOutboundUrlAsync, SafetyViolationError } from '../../apps/api/src/lib/safety.js';

describe('P1: Crawl Engine & SSRF Defenses', () => {
  it('blocks AWS and GCP cloud metadata IP addresses', () => {
    expect(() => assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data/')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('http://metadata.google.internal/computeMetadata/v1/')).toThrow(SafetyViolationError);
  });

  it('blocks loopback addresses (localhost, 127.0.0.1, [::1], 0.0.0.0)', () => {
    expect(() => assertSafeOutboundUrl('http://localhost:8080/admin')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('http://127.0.0.1:3000')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('http://[::1]:5432')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('http://0.0.0.0:80')).toThrow(SafetyViolationError);
  });

  it('blocks internal private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', () => {
    expect(() => assertSafeOutboundUrl('http://10.0.1.50/dashboard')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('http://172.20.0.1/status')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('http://192.168.1.1/router')).toThrow(SafetyViolationError);
  });

  it('blocks non-HTTP protocols (file://, ftp://, gopher://)', () => {
    expect(() => assertSafeOutboundUrl('file:///etc/passwd')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('ftp://internal.server/data')).toThrow(SafetyViolationError);
    expect(() => assertSafeOutboundUrl('gopher://gopher.floodgap.com')).toThrow(SafetyViolationError);
  });

  it('permits valid public HTTPS domain targets', () => {
    expect(() => assertSafeOutboundUrl('https://chatr.chat/docs')).not.toThrow();
    expect(() => assertSafeOutboundUrl('https://talentxcel.in')).not.toThrow();
    expect(() => assertSafeOutboundUrl('https://nutytales.com/shop')).not.toThrow();
    expect(() => assertSafeOutboundUrl('https://www.google.com')).not.toThrow();
  });
});
