/**
 * Unit Test: Google OAuth 2.0 Security & CSRF Defense
 * Tests cryptographic signing, single-use nonce consumption, replay defense, and workspace isolation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { GoogleAuthService } from '../../apps/api/src/services/google-auth-service.js';
import { env } from '../../apps/api/src/lib/env.js';
import { query } from '../../apps/api/src/lib/db.js';

describe('GoogleAuthService: Cryptographic OAuth State & CSRF Protection', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const customRedirectUri = 'https://deeptech-taupe.vercel.app/api/v1/auth/google/callback';
  let originalClientId: string | undefined;

  beforeEach(() => {
    originalClientId = env.GOOGLE_CLIENT_ID;
    (env as any).GOOGLE_CLIENT_ID = 'test-mock-client-id.apps.googleusercontent.com';
  });

  afterEach(async () => {
    (env as any).GOOGLE_CLIENT_ID = originalClientId;
    // Clean up test oauth_states
    await query(`DELETE FROM oauth_states WHERE workspace_id = $1`, [workspaceId]);
  });

  it('rejects generating authorization URL for non-existent workspace', async () => {
    const bogusWorkspaceId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    await expect(
      GoogleAuthService.getAuthorizationUrl(bogusWorkspaceId)
    ).rejects.toThrow(/Invalid workspace ID/);
  });

  it('generates a cryptographically signed authorization URL and stores state nonce in database', async () => {
    const authUrl = await GoogleAuthService.getAuthorizationUrl(workspaceId, customRedirectUri);
    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth?');

    const url = new URL(authUrl);
    expect(url.searchParams.get('client_id')).toBe('test-mock-client-id.apps.googleusercontent.com');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('redirect_uri')).toBe(customRedirectUri);

    const stateParam = url.searchParams.get('state');
    expect(stateParam).toBeTruthy();

    // Verify state structure
    const decoded = JSON.parse(Buffer.from(stateParam!, 'base64url').toString('utf8'));
    expect(decoded.p).toBeTruthy();
    expect(decoded.s).toBeTruthy();

    const payload = JSON.parse(decoded.p);
    expect(payload.workspaceId).toBe(workspaceId);
    expect(payload.nonce).toBeTruthy();
    expect(payload.redirectUri).toBe(customRedirectUri);

    // Verify row exists in DB
    const dbRes = await query<{ nonce: string }>(
      `SELECT nonce FROM oauth_states WHERE nonce = $1 AND workspace_id = $2`,
      [payload.nonce, workspaceId]
    );
    expect(dbRes.rows.length).toBe(1);
  });

  it('successfully verifies and consumes valid state nonce', async () => {
    const authUrl = await GoogleAuthService.getAuthorizationUrl(workspaceId, customRedirectUri);
    const url = new URL(authUrl);
    const stateParam = url.searchParams.get('state')!;

    const result = await GoogleAuthService.verifyAndConsumeState(stateParam);
    expect(result.workspaceId).toBe(workspaceId);
    expect(result.redirectUri).toBe(customRedirectUri);

    // Verify nonce was consumed (deleted) from database
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
    const payload = JSON.parse(decoded.p);
    const dbRes = await query(
      `SELECT nonce FROM oauth_states WHERE nonce = $1`,
      [payload.nonce]
    );
    expect(dbRes.rows.length).toBe(0);
  });

  it('prevents replay attacks: second consumption of the same state immediately fails', async () => {
    const authUrl = await GoogleAuthService.getAuthorizationUrl(workspaceId, customRedirectUri);
    const url = new URL(authUrl);
    const stateParam = url.searchParams.get('state')!;

    // First consumption succeeds
    await GoogleAuthService.verifyAndConsumeState(stateParam);

    // Second consumption (replay attack) MUST fail
    await expect(
      GoogleAuthService.verifyAndConsumeState(stateParam)
    ).rejects.toThrow(/OAuth state nonce was already consumed or does not exist/);
  });

  it('rejects tampered state signatures (CSRF defense)', async () => {
    const authUrl = await GoogleAuthService.getAuthorizationUrl(workspaceId, customRedirectUri);
    const url = new URL(authUrl);
    const stateParam = url.searchParams.get('state')!;

    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
    // Tamper with payload (e.g. attacker changing workspaceId)
    const payload = JSON.parse(decoded.p);
    payload.workspaceId = '11111111-1111-1111-1111-111111111111';
    const tamperedPayloadStr = JSON.stringify(payload);

    const tamperedState = Buffer.from(
      JSON.stringify({ p: tamperedPayloadStr, s: decoded.s })
    ).toString('base64url');

    await expect(
      GoogleAuthService.verifyAndConsumeState(tamperedState)
    ).rejects.toThrow(/OAuth state signature mismatch: CSRF forgery attempt detected/);
  });

  it('rejects expired state tokens', async () => {
    // Manually create an expired state token
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiredTime = Date.now() - 60 * 1000; // 1 minute in the past
    const payloadStr = JSON.stringify({
      nonce,
      workspaceId,
      expiresAt: expiredTime,
      redirectUri: customRedirectUri,
    });

    const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
    hmac.update(payloadStr);
    const signature = hmac.digest('hex');

    const expiredState = Buffer.from(
      JSON.stringify({ p: payloadStr, s: signature })
    ).toString('base64url');

    await expect(
      GoogleAuthService.verifyAndConsumeState(expiredState)
    ).rejects.toThrow(/OAuth state token has expired/);
  });

  it('rejects malformed or empty state strings', async () => {
    await expect(GoogleAuthService.verifyAndConsumeState('')).rejects.toThrow(/Missing OAuth state parameter/);
    await expect(GoogleAuthService.verifyAndConsumeState('not-base64-json!')).rejects.toThrow(/Malformed OAuth state parameter encoding/);
    await expect(GoogleAuthService.verifyAndConsumeState(Buffer.from('{}').toString('base64url'))).rejects.toThrow(/Invalid OAuth state structure/);
  });
});
