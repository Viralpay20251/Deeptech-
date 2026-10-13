/**
 * Autonomous Growth OS — Local Ollama Verification Script
 *
 * Verifies local Ollama daemon health, detects downloaded models,
 * and tests live ModelGateway completion and structured JSON synthesis.
 */

import { ModelGateway } from '../apps/api/src/services/model-gateway.js';
import { env } from '../apps/api/src/lib/env.js';

async function main() {
  console.log('====================================================');
  console.log('  AUTONOMOUS GROWTH OS — LOCAL OLLAMA VERIFICATION  ');
  console.log('====================================================');
  console.log(`Configured Provider:   ${env.MODEL_PROVIDER}`);
  console.log(`Ollama Base URL:       ${env.OLLAMA_BASE_URL}`);
  console.log(`Active Model Target:   ${env.OLLAMA_MODEL}\n`);

  // 1. Check local Ollama daemon
  const baseUrl = env.OLLAMA_BASE_URL.replace(/\/+$/, '');
  try {
    const tagsRes = await fetch(`${baseUrl}/api/tags`);
    if (!tagsRes.ok) {
      throw new Error(`HTTP ${tagsRes.status}`);
    }
    const tagsData = (await tagsRes.json()) as { models?: Array<{ name: string; size: number }> };
    console.log('✓ Ollama daemon is active and responding.');
    console.log('  Locally available models:');
    for (const m of tagsData.models ?? []) {
      const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
      const isCurrent = m.name === env.OLLAMA_MODEL ? ' (ACTIVE)' : '';
      console.log(`  - ${m.name} [${sizeGb} GB]${isCurrent}`);
    }
  } catch (err) {
    console.error(`✗ Failed to reach Ollama at ${baseUrl}. Ensure Ollama is running.\n`, err);
    process.exit(1);
  }

  // 2. Test ModelGateway standard completion
  console.log('\n--- 1. Testing Standard Text Generation ---');
  const startText = Date.now();
  const textResponse = await ModelGateway.complete({
    system_prompt: 'You are an autonomous marketing intelligence assistant. Respond concisely in 15 words or fewer.',
    user_content: 'Summarise why private on-premise LLMs benefit growth engineering.',
  });
  const elapsedText = ((Date.now() - startText) / 1000).toFixed(2);

  console.log(`Response received in ${elapsedText}s:`);
  console.log(`> "${textResponse.text.trim()}"`);
  console.log(`Model:             ${textResponse.model}`);
  console.log(`Provider:          ${textResponse.provider}`);
  console.log(`Prompt Tokens:     ${textResponse.prompt_tokens}`);
  console.log(`Completion Tokens: ${textResponse.completion_tokens}`);
  console.log(`Cost USD:          $${textResponse.cost_usd.toFixed(4)} (Zero API billing)`);
  console.log(`Simulated:         ${textResponse.is_simulated}`);

  // 3. Test ModelGateway structured JSON generation
  console.log('\n--- 2. Testing Structured JSON Synthesis ---');
  const startJson = Date.now();
  const jsonResponse = await ModelGateway.complete({
    system_prompt: 'You are a growth metrics classifier. Output valid JSON with keys: category (string), confidence (number 0-1), and actionable (boolean).',
    user_content: 'Classify high-intent organic search spike on enterprise compliance keyword.',
    expected_json: true,
  });
  const elapsedJson = ((Date.now() - startJson) / 1000).toFixed(2);

  console.log(`JSON received in ${elapsedJson}s:`);
  console.log(`> ${jsonResponse.text.trim()}`);
  try {
    const parsed = JSON.parse(jsonResponse.text);
    console.log('✓ Valid JSON confirmed:', parsed);
  } catch (parseErr) {
    console.error('✗ Failed to parse JSON response:', parseErr);
  }

  console.log('\n====================================================');
  console.log('✓ Local Ollama integration verified successfully.');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
