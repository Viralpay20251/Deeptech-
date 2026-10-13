/**
 * Autonomous Growth OS — Base Specialist Agent Framework
 *
 * Implements the Agent Persona Model inspired by AdClaw's SOUL architecture
 * while strictly adhering to Autonomous Growth OS security, tenant scoping,
 * and deterministic quality guardrails.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { AntiWordsFilter, type AntiWordsCheckResult } from './anti-words.js';
import type { AgentType, UUID } from '@growth-os/shared-types';

export interface AgentPersona {
  name: string;
  agentType: AgentType;
  title: string;
  roleDescription: string;
  toneGuidelines: string[];
  allowedTools: string[];
  prohibitedActions: string[];
}

export interface AgentExecutionContext {
  workspaceId: UUID;
  brandId: UUID;
  brandName: string;
  locale?: string;
  empiricalEvidence?: {
    metricName?: string;
    metricValue?: string | number;
    sourceUrl?: string;
  };
}

export interface AgentExecutionOutput<T = unknown> {
  agentName: string;
  agentType: AgentType;
  executionId: string;
  success: boolean;
  data: T;
  antiWordsAudit: AntiWordsCheckResult;
  timestamp: string;
  modelTokensUsed?: number;
  notes?: string;
}

export abstract class BaseAgent {
  public readonly persona: AgentPersona;

  constructor(persona: AgentPersona) {
    this.persona = persona;
  }

  /**
   * Validate that the agent is allowed to invoke the given tool.
   */
  protected assertToolAllowed(toolName: string): void {
    if (!this.persona.allowedTools.includes(toolName)) {
      throw new Error(
        `Security boundary violation: Agent "${this.persona.name}" (${this.persona.agentType}) is not permitted to use tool "${toolName}". Permitted tools: [${this.persona.allowedTools.join(', ')}]`
      );
    }
  }

  /**
   * Execute anti-words quality verification on generated copy.
   */
  protected verifyCopyQuality(text: string): AntiWordsCheckResult {
    return AntiWordsFilter.check(text);
  }

  /**
   * Format agent prompt with persona constraints and anti-words warning.
   */
  protected constructSystemPrompt(context: AgentExecutionContext): string {
    return [
      `You are ${this.persona.name}, a specialist ${this.persona.title} for brand "${context.brandName}".`,
      `Role: ${this.persona.roleDescription}`,
      `Tone & Style Guidelines:`,
      ...this.persona.toneGuidelines.map((g) => `- ${g}`),
      `Strict Boundaries:`,
      ...this.persona.prohibitedActions.map((p) => `- DO NOT: ${p}`),
      `- DO NOT use generic AI filler words ("delve", "game-changer", "tapestry", "unleash", "seamlessly"). Ground all claims in factual data.`,
    ].join('\n');
  }
}
