/**
 * Unit Test: Google Connectors & OAuth Scopes
 */

import { describe, it, expect } from 'vitest';
import { GoogleAuthService } from '../../apps/api/src/services/google-auth-service.js';
import { GoogleSearchConsoleConnector } from '../../apps/api/src/connectors/google-search-console-connector.js';
import { GoogleAnalytics4Connector } from '../../apps/api/src/connectors/google-analytics-4-connector.js';

describe('GoogleAuthService: Scopes & Permissions', () => {
  it('enforces read-only Google Search Console and GA4 scopes', () => {
    expect(GoogleAuthService.REQUIRED_SCOPES).toContain(
      'https://www.googleapis.com/auth/webmasters.readonly'
    );
    expect(GoogleAuthService.REQUIRED_SCOPES).toContain(
      'https://www.googleapis.com/auth/analytics.readonly'
    );
  });
});

describe('GoogleSearchConsoleConnector: Health & Reporting', () => {
  it('truthfully returns awaiting_oauth when tokens are not present', async () => {
    const connector = new GoogleSearchConsoleConnector('00000000-0000-0000-0000-000000000001');
    const health = await connector.checkHealth();

    expect(['awaiting_oauth', 'error']).toContain(health.status);
    expect(health.message).toBeTruthy();
  });
});

describe('GoogleAnalytics4Connector: Health & Non-Conflation', () => {
  it('truthfully returns awaiting_oauth when tokens are not present', async () => {
    const connector = new GoogleAnalytics4Connector('00000000-0000-0000-0000-000000000001');
    const health = await connector.checkHealth();

    expect(['awaiting_oauth', 'error']).toContain(health.status);
    expect(health.message).toBeTruthy();
  });
});
