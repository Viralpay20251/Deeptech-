import { runLivePipelineTest } from '../../../omnipulse-engine/services/discover-igniter/src/discoverEngine.js';

export * from '../../../omnipulse-engine/services/discover-igniter/src/discoverEngine.js';

if (process.argv.includes('--run-live-test')) {
  runLivePipelineTest().catch((err) => {
    console.error('[Discover Engine] Live test failed:', err);
    process.exit(1);
  });
}

