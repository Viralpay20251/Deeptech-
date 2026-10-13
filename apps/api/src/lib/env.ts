/**
 * Environment configuration — validated at startup.
 * The application will refuse to start if required variables are missing.
 * Secrets must come from environment variables or a secrets manager.
 * NEVER hard-code secrets here or in any source file.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  DATABASE_SSL: z.coerce.boolean().default(false),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  INTERNAL_WORKSPACE_ID: z.string().uuid('INTERNAL_WORKSPACE_ID must be a valid UUID').optional(),

  MODEL_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'azure-openai', 'ollama']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2:latest'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().default(120000),

  MODEL_BUDGET_PER_TASK_USD: z.coerce.number().default(0.50),
  MODEL_BUDGET_DAILY_USD: z.coerce.number().default(10.00),

  QUEUE_DRIVER: z.enum(['memory', 'pg-boss']).default('memory'),
  QUEUE_MAX_CONCURRENCY: z.coerce.number().default(5),
  QUEUE_RETRY_LIMIT: z.coerce.number().default(3),

  // Public Publishing Surface (Strictly prohibits .internal domains)
  PUBLIC_PUBLISHING_DOMAIN: z
    .string()
    .default('https://deeptech-taupe.vercel.app')
    .refine((val) => !val.toLowerCase().includes('.internal'), {
      message: 'PUBLIC_PUBLISHING_DOMAIN cannot use .internal (ICANN reserved for private networks)',
    }),

  // Google OAuth, Search Console & GA4 (Stored securely; never committed)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GSC_PROPERTY_URL: z.string().optional(),
  GA4_PROPERTY_ID: z.string().optional(),

  // Feature flags — all OFF by default
  FEATURE_PAID_MEDIA: z.coerce.boolean().default(false),
  FEATURE_SAAS_ONBOARDING: z.coerce.boolean().default(false),
  FEATURE_LEVEL3_AUTONOMY: z.coerce.boolean().default(false),

  // Protected systems — comma-separated lists used by safety checks
  PROTECTED_DB_HOSTS: z.string().default(''),
  PROTECTED_PROJECT_IDS: z.string().default(''),
});

function loadEnv() {
  const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
  const isVercelBuild = process.env['VERCEL'] === '1' && !process.env['DATABASE_URL'];
  const rawEnv = {
    ...process.env,
    ...(isTest || isVercelBuild
      ? {
          DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://growth_os_test_user:test_secret@localhost:5432/growth_os_test_db',
          JWT_SECRET: process.env['JWT_SECRET'] ?? 'default_jwt_secret_must_be_at_least_32_characters_long_for_safety',
        }
      : {}),
  };

  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`❌ Environment configuration error:\n${issues}`);
  }
  return result.data;
}

export const env = loadEnv();

export type Env = z.infer<typeof envSchema>;

/** List of protected DB host strings — never write to these. */
export const PROTECTED_DB_HOSTS: string[] = env.PROTECTED_DB_HOSTS
  ? env.PROTECTED_DB_HOSTS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

/** List of protected project IDs — never deploy/connect to these. */
export const PROTECTED_PROJECT_IDS: string[] = env.PROTECTED_PROJECT_IDS
  ? env.PROTECTED_PROJECT_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
