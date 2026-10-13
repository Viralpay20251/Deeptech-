/**
 * Google OAuth 2.0 Route Handlers
 */

import { Router, type Request, type Response } from 'express';
import { GoogleAuthService } from '../services/google-auth-service.js';
import { query } from '../lib/db.js';

export const authGoogleRouter = Router();

/**
 * Initiate Google OAuth Flow: GET /api/v1/auth/google/authorize
 */
authGoogleRouter.get('/authorize', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    const authUrl = await GoogleAuthService.getAuthorizationUrl(workspaceId);
    if (req.query['redirect'] === 'true') {
      res.redirect(authUrl);
      return;
    }
    res.json({ success: true, url: authUrl });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'OAUTH_INITIATION_FAILED', message: (err as Error).message },
    });
  }
});

/**
 * Handle Google OAuth Callback: GET /api/v1/auth/google/callback
 * STRICT SECURITY: Validates HMAC-SHA256 signature and atomically consumes single-use nonce.
 * Zero fallback to default workspace!
 */
authGoogleRouter.get('/callback', async (req: Request, res: Response) => {
  const code = req.query['code'] as string | undefined;
  const stateRaw = req.query['state'] as string | undefined;

  if (!code) {
    res.status(400).send('OAuth callback error: Missing code parameter.');
    return;
  }

  if (!stateRaw) {
    res.status(403).send('OAuth callback error: Missing required state parameter (CSRF protection).');
    return;
  }

  try {
    // 1. Strictly verify HMAC signature, expiration, and consume single-use state nonce
    const verified = await GoogleAuthService.verifyAndConsumeState(stateRaw);

    // 2. Exchange code for tokens strictly bound to verified workspace and redirectUri
    await GoogleAuthService.exchangeCodeForTokens(code, verified.workspaceId, verified.redirectUri);
    res.redirect('/?oauth=google_success');
  } catch (err) {
    res.status(403).send(`OAuth security verification failed: ${(err as Error).message}`);
  }
});

/**
 * Google Connection Status: GET /api/v1/auth/google/status
 */
authGoogleRouter.get('/status', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    const resTokens = await query<{
      provider: string;
      scopes: string[];
      expires_at: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT provider, scopes, expires_at, created_at, updated_at
       FROM oauth_tokens
       WHERE workspace_id = $1 AND provider = 'google'`,
      [workspaceId]
    );

    if (resTokens.rows.length === 0) {
      res.json({
        success: true,
        data: {
          connected: false,
          status: 'awaiting_oauth',
          message: 'Google Search Console and GA4 are not yet authorized.',
        },
      });
      return;
    }

    const token = resTokens.rows[0]!;
    const isExpired = new Date(token.expires_at).getTime() <= Date.now();

    res.json({
      success: true,
      data: {
        connected: !isExpired,
        status: isExpired ? 'token_expired' : 'connected',
        scopes: token.scopes,
        expires_at: token.expires_at,
        last_updated: token.updated_at,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: (err as Error).message },
    });
  }
});
