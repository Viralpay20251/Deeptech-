/**
 * Autonomous Growth OS — Authentication & RBAC Middleware
 *
 * Implements Section 11 of Master Remediation Plan:
 * - Server-authenticated operator identity for every mutation, approval, policy change, and worker control
 * - Role-based access control (RBAC): workspace_admin, operator, reviewer, publisher, analyst, viewer
 * - Workspace tenant isolation: strictly prevents cross-tenant access even if client sends foreign workspace_id
 * - Timing-safe CRON_SECRET verification for worker endpoints
 * - Strict: Never silently infers an operator from a workspace's user records. Unauthenticated requests are rejected.
 */

import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { env } from '../lib/env.js';
import { query } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'workspace_admin' | 'operator' | 'reviewer' | 'publisher' | 'analyst' | 'viewer';
  workspace_id: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Generate a signed JWT for an operator (for CLI, test suites, or session bootstrap)
 */
export function generateOperatorToken(user: {
  id: string;
  email: string;
  role: string;
  workspace_id: string;
}): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      workspace_id: user.workspace_id,
    },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Authenticate incoming request via JWT Bearer token or registered operator ID header.
 * Attaches verified req.user.
 * Fails closed: unauthenticated requests are rejected with 401.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as {
          sub: string;
          email?: string;
          role?: string;
          workspace_id?: string;
        };

        // Validate user exists in DB
        const userRes = await query<{ id: string; email: string; role: string; workspace_id: string }>(
          `SELECT id, email, role, workspace_id FROM users WHERE id = $1`,
          [decoded.sub]
        );

        if (userRes.rows.length && userRes.rows[0]) {
          const u = userRes.rows[0];
          req.user = {
            id: u.id,
            email: u.email,
            role: u.role as any,
            workspace_id: u.workspace_id,
          };
          return next();
        }
      } catch (jwtErr) {
        // JWT invalid or expired — reject immediately with 401
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: `Authentication token is invalid or expired: ${(jwtErr as Error).message}`,
          },
        });
        return;
      }
    }

    // Service credential authentication (x-operator-id with cryptographic x-service-key)
    const operatorId = req.headers['x-operator-id'] as string | undefined;
    const serviceKey =
      (req.headers['x-service-key'] as string | undefined) ||
      (req.headers['x-service-secret'] as string | undefined);

    if (operatorId) {
      // Require cryptographic service proof — a user ID is an identifier, not proof of identity
      const internalSecret = process.env['INTERNAL_WORKSPACE_SECRET'];
      if (!serviceKey || !internalSecret) {
        res.status(401).json({
          success: false,
          error: {
            code: 'FORGED_OR_UNSIGNED_IDENTITY',
            message: 'x-operator-id is an identifier, not proof of identity. A cryptographically authenticated service credential (x-service-key) or Authorization: Bearer <token> is required.',
          },
        });
        return;
      }

      const expectedBuf = Buffer.from(internalSecret, 'utf8');
      const actualBuf = Buffer.from(String(serviceKey), 'utf8');
      const isKeyValid = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);

      if (!isKeyValid) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_SERVICE_KEY',
            message: 'Service credential verification failed.',
          },
        });
        return;
      }

      const userRes = await query<{ id: string; email: string; role: string; workspace_id: string }>(
        `SELECT id, email, role, workspace_id FROM users WHERE id = $1`,
        [operatorId]
      );
      if (userRes.rows.length && userRes.rows[0]) {
        const u = userRes.rows[0];
        const requestedWorkspace = (req.headers['x-workspace-id'] as string) || (req.body?.workspace_id as string);
        if (requestedWorkspace && u.workspace_id !== requestedWorkspace) {
          res.status(403).json({
            success: false,
            error: { code: 'TENANT_ISOLATION_VIOLATION', message: 'Operator does not belong to specified workspace.' },
          });
          return;
        }
        req.user = {
          id: u.id,
          email: u.email,
          role: u.role as any,
          workspace_id: u.workspace_id,
        };
        return next();
      } else {
        res.status(401).json({
          success: false,
          error: { code: 'OPERATOR_NOT_FOUND', message: `No registered user found for x-operator-id: ${operatorId}` },
        });
        return;
      }
    }

    // Unauthenticated requests are rejected — no silent inference or fallback
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required. Provide Authorization: Bearer <token> or valid x-service-key with x-operator-id.',
      },
    });
  } catch (err) {
    logger.error({ err }, 'Authentication middleware failure');
    res.status(500).json({
      success: false,
      error: { code: 'AUTH_INTERNAL_ERROR', message: (err as Error).message },
    });
  }
}

/**
 * Require one of the specified roles.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required before role check.' },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Role "${req.user.role}" does not have permission for this action. Required: ${allowedRoles.join(', ')}.`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Guard that enforces workspace scoping: caller can only operate on their own workspace.
 */
export function requireWorkspaceScope(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    return;
  }

  const requestedWorkspace =
    (req.headers['x-workspace-id'] as string) ||
    (req.params['workspace_id'] as string) ||
    (req.query['workspace_id'] as string) ||
    req.body?.workspace_id;

  if (requestedWorkspace && requestedWorkspace !== req.user.workspace_id) {
    res.status(403).json({
      success: false,
      error: {
        code: 'TENANT_ISOLATION_VIOLATION',
        message: 'Access denied: cannot operate on or query cross-workspace resources.',
      },
    });
    return;
  }

  next();
}

/**
 * Timing-safe CRON_SECRET verification for scheduled worker triggers.
 * Accepts both GET and POST requests.
 */
export function verifyCronSecret(req: Request, res: Response, next: NextFunction): void {
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret) {
    if (process.env['NODE_ENV'] === 'production') {
      res.status(503).json({
        success: false,
        error: {
          code: 'CRON_NOT_CONFIGURED',
          message: 'CRON_SECRET is not configured in production. Worker trigger disabled.',
        },
      });
      return;
    }
    // Allow in test/dev
    return next();
  }

  const supplied =
    req.headers['x-cron-secret'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  const expectedBuf = Buffer.from(cronSecret, 'utf8');
  const actualBuf = Buffer.from(String(supplied ?? ''), 'utf8');

  const safe = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);

  if (!safe) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing CRON_SECRET.' },
    });
    return;
  }

  next();
}
