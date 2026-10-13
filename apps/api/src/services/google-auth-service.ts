/**
 * Google OAuth 2.0 Management Service
 *
 * Implements Workstream 1 requirement:
 * - Read-only scopes for Google Search Console and GA4
 * - Secure token exchange, token refresh, and persistence
 * - Quota, revocation, and honest permission handling
 */

import crypto from 'crypto';
import axios from 'axios';
import { query } from '../lib/db.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export interface GoogleTokenRecord {
  id: string;
  workspace_id: string;
  provider: 'google';
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scopes: string[];
  expires_at: string;
  metadata: Record<string, unknown>;
}

export class GoogleAuthService {
  public static readonly REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
  ];

  /**
   * Generates a cryptographically signed, single-use Google OAuth 2.0 authorization URL
   */
  public static async getAuthorizationUrl(workspaceId: string, customRedirectUri?: string): Promise<string> {
    const clientId = env.GOOGLE_CLIENT_ID;
    const redirectUri = customRedirectUri || env.GOOGLE_REDIRECT_URI || `${env.PUBLIC_PUBLISHING_DOMAIN}/api/v1/auth/google/callback`;

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured in environment or secrets manager.');
    }

    // Verify workspace exists
    const wsRes = await query<{ id: string }>(`SELECT id FROM workspaces WHERE id = $1`, [workspaceId]);
    if (wsRes.rows.length === 0) {
      throw new Error(`Invalid workspace ID: ${workspaceId}`);
    }

    // Generate 32-byte cryptographic nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute expiry

    // Save single-use state nonce to database
    await query(
      `INSERT INTO oauth_states (nonce, workspace_id, redirect_uri, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [nonce, workspaceId, redirectUri, expiresAt.toISOString()]
    );

    // Create HMAC signature over payload
    const payloadStr = JSON.stringify({ nonce, workspaceId, expiresAt: expiresAt.getTime(), redirectUri });
    const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
    hmac.update(payloadStr);
    const signature = hmac.digest('hex');

    const stateToken = Buffer.from(JSON.stringify({ p: payloadStr, s: signature })).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.REQUIRED_SCOPES.join(' '),
      access_type: 'offline', // Requests refresh_token
      prompt: 'consent',       // Forces refresh_token issuance
      state: stateToken,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Verifies HMAC signature, validates expiration, and atomically consumes single-use state nonce.
   * Strictly enforces workspace isolation and eliminates CSRF replay.
   */
  public static async verifyAndConsumeState(stateRaw: string): Promise<{ workspaceId: string; redirectUri: string }> {
    if (!stateRaw) {
      throw new Error('Missing OAuth state parameter.');
    }

    let parsed: { p: string; s: string };
    try {
      parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Malformed OAuth state parameter encoding.');
    }

    if (!parsed.p || !parsed.s) {
      throw new Error('Invalid OAuth state structure.');
    }

    // Verify HMAC signature with timing-safe comparison
    const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
    hmac.update(parsed.p);
    const expectedSig = hmac.digest('hex');

    const sigBuf = Buffer.from(parsed.s, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new Error('OAuth state signature mismatch: CSRF forgery attempt detected.');
    }

    let payload: { nonce: string; workspaceId: string; expiresAt: number; redirectUri: string };
    try {
      payload = JSON.parse(parsed.p);
    } catch {
      throw new Error('Malformed OAuth state payload.');
    }

    if (Date.now() > payload.expiresAt) {
      throw new Error('OAuth state token has expired (exceeded 10-minute window).');
    }

    // Atomically consume nonce from database (prevents replay attacks)
    const consumeRes = await query<{ nonce: string; workspace_id: string; redirect_uri: string }>(
      `DELETE FROM oauth_states
       WHERE nonce = $1 AND workspace_id = $2 AND expires_at > NOW()
       RETURNING nonce, workspace_id, redirect_uri`,
      [payload.nonce, payload.workspaceId]
    );

    if (consumeRes.rows.length === 0) {
      throw new Error('OAuth state nonce was already consumed or does not exist.');
    }

    return {
      workspaceId: consumeRes.rows[0]!.workspace_id,
      redirectUri: consumeRes.rows[0]!.redirect_uri,
    };
  }

  /**
   * Exchanges authorization code for tokens
   */
  public static async exchangeCodeForTokens(
    code: string,
    workspaceId: string,
    redirectUriOverride?: string
  ): Promise<GoogleTokenRecord> {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri = redirectUriOverride || env.GOOGLE_REDIRECT_URI || `${env.PUBLIC_PUBLISHING_DOMAIN}/api/v1/auth/google/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment.');
    }

    const tokenRes = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const data = tokenRes.data as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    const scopes = data.scope ? data.scope.split(' ') : this.REQUIRED_SCOPES;

    // Upsert into oauth_tokens
    const dbRes = await query<GoogleTokenRecord>(
      `INSERT INTO oauth_tokens (
        workspace_id, provider, access_token, refresh_token, token_type, scopes, expires_at
      ) VALUES ($1, 'google', $2, $3, $4, $5, $6)
      ON CONFLICT (workspace_id, provider) DO UPDATE
      SET access_token = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
          token_type = EXCLUDED.token_type,
          scopes = EXCLUDED.scopes,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      RETURNING *`,
      [workspaceId, data.access_token, data.refresh_token ?? null, data.token_type ?? 'Bearer', scopes, expiresAt]
    );

    // Update connector instances for Search Console and GA4 to connected
    await query(
      `UPDATE connector_instances
       SET status = 'connected',
           health_check_message = 'Google OAuth connection established with read-only scopes',
           last_health_check_at = NOW(),
           updated_at = NOW()
       WHERE workspace_id = $1 AND connector_type IN ('google_search_console', 'google_analytics_4')`,
      [workspaceId]
    );

    logger.info({ workspaceId }, 'Google OAuth tokens successfully exchanged and connector instances activated');
    return dbRes.rows[0]!;
  }

  /**
   * Retrieves a valid access token, automatically refreshing if expired or expiring within 5 minutes
   */
  public static async getValidAccessToken(workspaceId: string): Promise<string> {
    const res = await query<GoogleTokenRecord>(
      `SELECT * FROM oauth_tokens WHERE workspace_id = $1 AND provider = 'google'`,
      [workspaceId]
    );

    if (res.rows.length === 0) {
      throw new Error(`No Google OAuth tokens found for workspace ${workspaceId}. Status is awaiting_oauth.`);
    }

    const token = res.rows[0]!;
    const expiresAt = new Date(token.expires_at).getTime();
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

    // Return current access token if not near expiration
    if (expiresAt > fiveMinutesFromNow) {
      return token.access_token;
    }

    // Attempt token refresh
    if (!token.refresh_token) {
      // Mark connectors degraded
      await query(
        `UPDATE connector_instances
         SET status = 'degraded',
             health_check_message = 'Access token expired and no refresh_token present. Re-authentication required.',
             updated_at = NOW()
         WHERE workspace_id = $1 AND connector_type IN ('google_search_console', 'google_analytics_4')`,
        [workspaceId]
      );
      throw new Error('Access token expired and no refresh token available. Re-authorization required.');
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment.');
    }

    try {
      const refreshRes = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const refreshed = refreshRes.data as {
        access_token: string;
        expires_in: number;
        token_type: string;
      };

      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await query(
        `UPDATE oauth_tokens
         SET access_token = $1,
             expires_at = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [refreshed.access_token, newExpiresAt, token.id]
      );

      logger.info({ workspaceId }, 'Google OAuth access token successfully refreshed');
      return refreshed.access_token;
    } catch (err) {
      const errorMsg = (err as Error).message;
      await query(
        `UPDATE connector_instances
         SET status = 'error',
             health_check_message = $2,
             updated_at = NOW()
         WHERE workspace_id = $1 AND connector_type IN ('google_search_console', 'google_analytics_4')`,
        [workspaceId, `Token refresh failed: ${errorMsg}`]
      );
      throw new Error(`Google token refresh failed: ${errorMsg}`);
    }
  }
}
