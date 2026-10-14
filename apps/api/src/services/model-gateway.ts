/**
 * Autonomous Growth OS — Model Gateway
 *
 * Provider-agnostic abstraction for LLM completions.
 * Features:
 * - Supports OpenAI, Anthropic, Google AI, and a zero-credential Deterministic Simulator.
 * - Per-task budget cap ($0.50 default) and daily budget cap.
 * - Prompt injection detection and sanitisation.
 * - Automatic token cost calculation and audit ledger recording.
 * - When API keys are not supplied in development or test, uses a high-fidelity
 *   deterministic simulator so test suites and local verification run reliably.
 */

import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { query } from '../lib/db.js';
import { sanitiseExternalContent, detectPromptInjection, SafetyViolationError } from '../lib/safety.js';

export class ModelProviderError extends Error {
  public readonly code: 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE';
  constructor(message: string, code: 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE') {
    super(message);
    this.name = 'ModelProviderError';
    this.code = code;
  }
}

export interface ModelRequestOptions {
  task_id?: string;
  workspace_id?: string;
  brand_id?: string;
  system_prompt: string;
  user_content: string;
  untrusted_data?: string; // external data to be sanitised and delimited
  temperature?: number;
  max_tokens?: number;
  expected_json?: boolean;
}

export interface ModelResponse {
  text: string;
  model: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  is_simulated: boolean;
}

export class ModelGateway {
  private static readonly COST_PER_1K_PROMPT_USD = 0.0015;
  private static readonly COST_PER_1K_COMPLETION_USD = 0.0020;

  /**
   * Execute a model completion with budget, safety and cost accounting.
   */
  public static async complete(options: ModelRequestOptions): Promise<ModelResponse> {
    const {
      task_id,
      workspace_id,
      brand_id,
      system_prompt,
      user_content,
      untrusted_data,
      temperature = 0.2,
      max_tokens = 2000,
      expected_json = false,
    } = options;

    // 1. Safety & Prompt Injection Check on untrusted data
    let assembledContent = user_content;
    if (untrusted_data) {
      const injectionFindings = detectPromptInjection(untrusted_data);
      if (injectionFindings.length > 0) {
        logger.warn(
          { task_id, findings: injectionFindings },
          'Untrusted data contains potential prompt injection sequences; sanitising'
        );
      }
      assembledContent += `\n\n${sanitiseExternalContent(untrusted_data)}`;
    }

    // 2. Budget verification for the task
    const estimatedCost = this.estimateCost(system_prompt.length + assembledContent.length, max_tokens);
    if (estimatedCost > env.MODEL_BUDGET_PER_TASK_USD) {
      throw new SafetyViolationError(
        `Estimated model call cost ($${estimatedCost.toFixed(4)}) exceeds task budget cap ($${env.MODEL_BUDGET_PER_TASK_USD.toFixed(2)})`,
        'BUDGET_CAP_EXCEEDED',
        { estimatedCost, budgetCap: env.MODEL_BUDGET_PER_TASK_USD }
      );
    }

    // 3. Provider invocation or deterministic simulation
    let result: ModelResponse;
    const isTestMode = env.NODE_ENV === 'test' && process.env['TEST_LIVE_OLLAMA'] !== 'true';
    const hasLiveProvider =
      !isTestMode &&
      ((env.MODEL_PROVIDER === 'openai' && !!env.OPENAI_API_KEY) ||
        (env.MODEL_PROVIDER === 'anthropic' && !!env.ANTHROPIC_API_KEY) ||
        (env.MODEL_PROVIDER === 'google' && !!env.GOOGLE_AI_API_KEY) ||
        env.MODEL_PROVIDER === 'ollama');

    if (hasLiveProvider) {
      result = await this.callLiveProvider(options, assembledContent);
    } else {
      // Production must never silently fall back to simulator
      const isTest = env.NODE_ENV === 'test' && process.env['TEST_LIVE_OLLAMA'] !== 'true';
      if (!isTest) {
        throw new ModelProviderError(
          `PROVIDER_NOT_CONFIGURED: MODEL_PROVIDER=${env.MODEL_PROVIDER} has no valid API key configured. ` +
          `Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or configure a reachable OLLAMA_BASE_URL.`,
          'PROVIDER_NOT_CONFIGURED'
        );
      }
      result = this.callDeterministicSimulator(options, assembledContent);
    }

    // 4. Record cost in database ledger if workspace/task is supplied
    if (workspace_id) {
      try {
        await query(
          `INSERT INTO model_cost_records
           (workspace_id, brand_id, task_id, provider, model, prompt_tokens, completion_tokens, cost_usd)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            workspace_id,
            brand_id ?? null,
            task_id ?? null,
            result.provider,
            result.model,
            result.prompt_tokens,
            result.completion_tokens,
            result.cost_usd,
          ]
        );
      } catch (err) {
        logger.warn({ err }, 'Failed to record model cost record in DB (non-fatal)');
      }
    }

    return result;
  }

  private static estimateCost(inputChars: number, maxTokens: number): number {
    if (env.MODEL_PROVIDER === 'ollama') {
      return 0; // Local execution incurs zero external API monetary cost
    }
    const estPromptTokens = Math.ceil(inputChars / 4);
    const estCompTokens = Math.ceil(maxTokens / 2);
    return (
      (estPromptTokens / 1000) * this.COST_PER_1K_PROMPT_USD +
      (estCompTokens / 1000) * this.COST_PER_1K_COMPLETION_USD
    );
  }

  private static async callLiveProvider(
    options: ModelRequestOptions,
    content: string
  ): Promise<ModelResponse> {
    // Local Ollama instance
    if (env.MODEL_PROVIDER === 'ollama') {
      return await this.callOllama(options, content);
    }

    // OpenAI implementation if key is present
    if (env.MODEL_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
      const { OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const params: any = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: options.system_prompt },
          { role: 'user', content: content },
        ],
        temperature: options.temperature,
      };
      if (options.expected_json) {
        params.response_format = { type: 'json_object' };
      }
      const completion = await client.chat.completions.create(params);

      const choice = completion.choices[0];
      const pTokens = completion.usage?.prompt_tokens ?? 100;
      const cTokens = completion.usage?.completion_tokens ?? 50;
      const cost = (pTokens / 1000) * 0.00015 + (cTokens / 1000) * 0.0006;

      return {
        text: choice?.message.content ?? '',
        model: 'gpt-4o-mini',
        provider: 'openai',
        prompt_tokens: pTokens,
        completion_tokens: cTokens,
        cost_usd: cost,
        is_simulated: false,
      };
    }

    // Anthropic implementation
    if (env.MODEL_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: options.max_tokens ?? 2000,
        system: options.system_prompt,
        messages: [{ role: 'user', content }],
      });
      const pTokens = msg.usage.input_tokens;
      const cTokens = msg.usage.output_tokens;
      const cost = (pTokens / 1000) * 0.00025 + (cTokens / 1000) * 0.00125;
      return {
        text: msg.content[0]?.type === 'text' ? msg.content[0].text : '',
        model: msg.model,
        provider: 'anthropic',
        prompt_tokens: pTokens,
        completion_tokens: cTokens,
        cost_usd: cost,
        is_simulated: false,
      };
    }

    // Google AI implementation via standard REST API
    if (env.MODEL_PROVIDER === 'google' && env.GOOGLE_AI_API_KEY) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GOOGLE_AI_API_KEY}`;
      const payload = {
        contents: [{ parts: [{ text: options.system_prompt + '\n\n' + content }] }],
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new ModelProviderError(`Google AI API error HTTP ${response.status}: ${errText}`, 'PROVIDER_UNAVAILABLE');
      }
      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const pTokens = data.usageMetadata?.promptTokenCount ?? 100;
      const cTokens = data.usageMetadata?.candidatesTokenCount ?? 50;
      const cost = (pTokens / 1000) * 0.000075 + (cTokens / 1000) * 0.0003;
      return {
        text,
        model: 'gemini-1.5-flash',
        provider: 'google',
        prompt_tokens: pTokens,
        completion_tokens: cTokens,
        cost_usd: cost,
        is_simulated: false,
      };
    }

    // No live provider matched — throw instead of silently simulating
    throw new ModelProviderError(
      `PROVIDER_NOT_CONFIGURED: MODEL_PROVIDER=${env.MODEL_PROVIDER} is configured but has no matching implementation or missing API key.`,
      'PROVIDER_NOT_CONFIGURED'
    );
  }

  /**
   * Execute model completion via local Ollama daemon
   */
  private static async callOllama(
    options: ModelRequestOptions,
    content: string
  ): Promise<ModelResponse> {
    const baseUrl = env.OLLAMA_BASE_URL.replace(/\/+$/, '');
    const model = env.OLLAMA_MODEL;

    interface OllamaChatPayload {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      options: {
        temperature: number;
        num_predict: number;
      };
      format?: string;
    }

    const requestBody: OllamaChatPayload = {
      model,
      messages: [
        { role: 'system', content: options.system_prompt },
        { role: 'user', content: content },
      ],
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        num_predict: options.max_tokens ?? 2000,
      },
    };

    if (options.expected_json) {
      requestBody.format = 'json';
    }

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama responded with HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        model?: string;
        message?: { content: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      const text = data.message?.content ?? '';
      const promptTokens =
        data.prompt_eval_count ?? Math.ceil((options.system_prompt.length + content.length) / 4);
      const completionTokens = data.eval_count ?? Math.ceil(text.length / 4);

      return {
        text,
        model: data.model ?? model,
        provider: 'ollama',
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: 0.0,
        is_simulated: false,
      };
    } catch (err) {
      throw new ModelProviderError(
        `PROVIDER_UNAVAILABLE: Ollama at ${baseUrl} failed for model ${model}: ${(err as Error).message}`,
        'PROVIDER_UNAVAILABLE'
      );
    }
  }

  /**
   * High-fidelity simulator for zero-credential testing and local builds.
   * Produces structured JSON or markdown matching agent requirements.
   */
  private static callDeterministicSimulator(
    options: ModelRequestOptions,
    content: string
  ): ModelResponse {
    logger.debug('ModelGateway executing in deterministic simulated mode');

    let textResponse = '';

    if (options.expected_json) {
      if (options.system_prompt.includes('Opportunity Scorer')) {
        textResponse = JSON.stringify({
          demand_evidence: 8.5,
          brand_relevance: 9.0,
          intent_strength: 8.0,
          content_gap: 7.5,
          potential_value: 8.5,
          freshness: 9.0,
          fulfilment_capability: 8.5,
          expected_effort: 3.0,
          cost: 2.0,
          uncertainty: 2.5,
          policy_risk: 1.0,
          rationale: 'High search demand verified with strong intent alignment to brand capabilities. Clear content gap and minimal policy risk.',
          evidence_refs: ['verified_public_sitemap', 'industry_query_trend_2026']
        });
      } else if (options.system_prompt.includes('Audience Classifier')) {
        textResponse = JSON.stringify({
          audience_segment: 'Tech-forward professionals & workflow architects',
          intent_type: 'informational',
          trend_type: 'emerging',
          funnel_stage: 'top_of_funnel_solution_discovery',
          relevance_score: 0.92
        });
      } else {
        textResponse = JSON.stringify({
          status: 'success',
          summary: 'Simulated structured output based on validated schema.',
          recommendation: 'Proceed with controlled execution.'
        });
      }
    } else {
      const topicMatch = options.user_content.match(/on:\s*([^\n]+)/i);
      const topic = topicMatch ? topicMatch[1]!.trim() : 'Technical Architecture & Implementation Guide';
      textResponse =
        `# Comprehensive Guide: ${topic}\n\n` +
        `An in-depth, verified engineering guide providing practical implementation frameworks for modern teams.\n\n` +
        `## 1. Architectural Principles & Core Mechanisms\n` +
        `- Production-tested benchmarks and latency-sensitive patterns.\n` +
        `- Zero fabricated claims; grounded strictly in verified empirical telemetry.\n\n` +
        `## 2. Implementation Walkthrough & Best Practices\n` +
        `Practical workflows designed for high-concurrency environments with clean separation of concerns.\n` +
        `Detailed architectural guidelines ensure predictable performance under sustained workload.\n\n` +
        `## 3. Verified Next Steps & Onward Path\n` +
        `Review the official implementation repository and documentation at the verified canonical endpoint.`;
    }

    return {
      text: textResponse,
      model: 'simulator-v1',
      provider: 'local-deterministic',
      prompt_tokens: 150,
      completion_tokens: 120,
      cost_usd: 0.0000,
      is_simulated: true,
    };
  }
}
