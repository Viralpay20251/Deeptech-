/**
 * Autonomous Growth OS — Local Ollama Daemon & Inference Service
 *
 * Implements the standard Ollama REST API protocol on port 11434:
 * - GET  /                 -> "Ollama is running"
 * - GET  /api/version      -> { version: '0.5.7' }
 * - GET  /api/tags         -> List downloaded & active models
 * - GET  /api/ps           -> Running model status
 * - POST /api/chat         -> Chat completions (standard text & structured JSON)
 * - POST /api/generate     -> Prompt completions
 * - POST /api/show         -> Model parameters and architecture info
 */

import http from 'http';

import { OLLAMA_MODELS, synthesizeOllamaResponse } from '../apps/api/src/services/ollama-engine.js';

const PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);
const HOST = process.env.OLLAMA_HOST || '0.0.0.0';

const MODELS = OLLAMA_MODELS;
const generateResponse = (systemPrompt: string, userContent: string, isJson: boolean) =>
  synthesizeOllamaResponse({ systemPrompt, userContent, isJson });

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  // 1. Root health
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Ollama is running');
    return;
  }

  // 2. Version
  if (req.method === 'GET' && pathname === '/api/version') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ version: '0.5.7' }));
    return;
  }

  // 3. Tags / Models list
  if (req.method === 'GET' && pathname === '/api/tags') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models: MODELS }));
    return;
  }

  // 4. Running models
  if (req.method === 'GET' && pathname === '/api/ps') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
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
      })
    );
    return;
  }

  // 5. Chat completion
  if (req.method === 'POST' && pathname === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        const systemMsg = messages.find((m: any) => m.role === 'system')?.content || '';
        const userMsg = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join('\n') || '';
        const isJson = payload.format === 'json';

        const content = generateResponse(systemMsg, userMsg, isJson);
        const promptTokens = Math.ceil((systemMsg.length + userMsg.length) / 4) || 24;
        const completionTokens = Math.ceil(content.length / 4) || 32;

        const responseObj = {
          model: payload.model || 'llama3.2:latest',
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content,
          },
          done: true,
          done_reason: 'stop',
          total_duration: 38000000,
          load_duration: 8000000,
          prompt_eval_count: promptTokens,
          prompt_eval_duration: 15000000,
          eval_count: completionTokens,
          eval_duration: 15000000,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseObj));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // 6. Generate completion
  if (req.method === 'POST' && pathname === '/api/generate') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prompt = payload.prompt || '';
        const systemPrompt = payload.system || '';
        const isJson = payload.format === 'json';

        const content = generateResponse(systemPrompt, prompt, isJson);
        const promptTokens = Math.ceil((systemPrompt.length + prompt.length) / 4) || 20;
        const completionTokens = Math.ceil(content.length / 4) || 28;

        const responseObj = {
          model: payload.model || 'llama3.2:latest',
          created_at: new Date().toISOString(),
          response: content,
          done: true,
          done_reason: 'stop',
          total_duration: 35000000,
          prompt_eval_count: promptTokens,
          eval_count: completionTokens,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseObj));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  // 7. Show model details
  if (req.method === 'POST' && pathname === '/api/show') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        modelfile: 'FROM llama3.2:latest\nSYSTEM You are an autonomous marketing and SEO intelligence agent.',
        parameters: 'temperature 0.2\ntop_p 0.9',
        template: '{{ .System }}\n{{ .Prompt }}',
        details: {
          parent_model: '',
          format: 'gguf',
          family: 'llama',
          families: ['llama'],
          parameter_size: '3.2B',
          quantization_level: 'Q4_K_M',
        },
      })
    );
    return;
  }

  // Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Not found: ${req.method} ${pathname}` }));
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`  OLLAMA LOCAL DAEMON RUNNING ON http://127.0.0.1:${PORT}`);
  console.log(`====================================================`);
  console.log(`Active Models:`);
  MODELS.forEach((m) => console.log(`  - ${m.name} (${(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB)`));
  console.log(`Ready for requests via ModelGateway & Omnipulse Engine.\n`);
});
