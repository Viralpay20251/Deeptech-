/**
 * Structured logger using Pino.
 * - Secrets are NEVER logged (redactPaths enforced).
 * - Log level controlled by environment.
 * - In production, logs are structured JSON for ingestion by log management tools.
 */

import pino from 'pino';
import { env } from './env.js';

const pinoOptions: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'credential',
      'credential_reference',
      'secret',
      'token',
      'access_token',
      'refresh_token',
      'api_key',
      'password',
      'authorization',
      'cookie',
      'set-cookie',
      '*.credential',
      '*.secret',
      '*.token',
      '*.api_key',
      '*.password',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  base: {
    app: 'autonomous-growth-os',
    version: process.env['APP_VERSION'] ?? '0.1.0',
    env: env.NODE_ENV,
  },
};

if (env.NODE_ENV === 'development') {
  pinoOptions.transport = { target: 'pino-pretty', options: { colorize: true } };
}

export const logger = pino(pinoOptions);

export type Logger = typeof logger;
