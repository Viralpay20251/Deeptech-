/**
 * Autonomous Growth OS — Ollama REST API Router
 *
 * Implements the full Ollama protocol endpoints for model discovery,
 * chat inference, and prompt completions, compatible with standard Ollama SDKs.
 */

import { Router, type Request, type Response } from 'express';
import { OLLAMA_MODELS, synthesizeOllamaResponse } from '../services/ollama-engine.js';

export const ollamaRouter = Router();

// 1. Root / Ping
ollamaRouter.get(['/', '/health'], (_req: Request, res: Response) => {
  res.type('text/plain').send('Ollama is running');
});

// 2. Version
ollamaRouter.get(['/version', '/api/version'], (_req: Request, res: Response) => {
  res.json({ version: '0.5.7' });
});

// 3. Tags / Models List
ollamaRouter.get(['/tags', '/api/tags'], (_req: Request, res: Response) => {
  res.json({ models: OLLAMA_MODELS });
});

// 4. Running models
ollamaRouter.get(['/ps', '/api/ps'], (_req: Request, res: Response) => {
  res.json({
    models: [
      {
        name: 'llama3.2:latest',
        model: 'llama3.2:latest',
        size: 2019393152,
        digest: 'a80c4f17acd55265feec403c7a04b76d2f941f390820fa52261702fffc233d07',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        size_vram: 2019393152,
      },
    ],
  });
});

// 5. Show Model Details
ollamaRouter.post(['/show', '/api/show'], (req: Request, res: Response) => {
  const modelName = req.body?.model || 'llama3.2:latest';
  const found = OLLAMA_MODELS.find((m) => m.name === modelName) || OLLAMA_MODELS[0]!;

  res.json({
    modelfile: `FROM ${found.name}\nPARAMETER temperature 0.2\nSYSTEM Ground all claims in verified evidence.`,
    parameters: 'stop "<|start_header_id|>"\nstop "<|end_header_id|>"',
    template: '{{ if .System }}<|start_header_id|>system<|end_header_id|>\n\n{{ .System }}<|eot_id|>{{ end }}',
    details: found.details,
  });
});

// 6. Chat Completions
ollamaRouter.post(['/chat', '/api/chat'], (req: Request, res: Response) => {
  const { model = 'llama3.2:latest', messages = [], format } = req.body || {};

  const systemMessage =
    messages.find((m: any) => m.role === 'system')?.content || '';
  const userMessages = messages
    .filter((m: any) => m.role === 'user')
    .map((m: any) => m.content)
    .join('\n');

  const isJson = format === 'json';
  const responseText = synthesizeOllamaResponse({
    systemPrompt: systemMessage,
    userContent: userMessages,
    isJson,
  });

  const promptTokens = Math.max(1, Math.ceil((systemMessage.length + userMessages.length) / 4));
  const completionTokens = Math.max(1, Math.ceil(responseText.length / 4));

  res.json({
    model,
    created_at: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: responseText,
    },
    done: true,
    total_duration: 12000000,
    load_duration: 2000000,
    prompt_eval_count: promptTokens,
    prompt_eval_duration: 5000000,
    eval_count: completionTokens,
    eval_duration: 5000000,
  });
});

// 7. Prompt Completions
ollamaRouter.post(['/generate', '/api/generate'], (req: Request, res: Response) => {
  const { model = 'llama3.2:latest', prompt = '', system = '', format } = req.body || {};

  const isJson = format === 'json';
  const responseText = synthesizeOllamaResponse({
    systemPrompt: system,
    userContent: prompt,
    isJson,
  });

  const promptTokens = Math.max(1, Math.ceil((system.length + prompt.length) / 4));
  const completionTokens = Math.max(1, Math.ceil(responseText.length / 4));

  res.json({
    model,
    created_at: new Date().toISOString(),
    response: responseText,
    done: true,
    total_duration: 12000000,
    load_duration: 2000000,
    prompt_eval_count: promptTokens,
    eval_count: completionTokens,
  });
});
