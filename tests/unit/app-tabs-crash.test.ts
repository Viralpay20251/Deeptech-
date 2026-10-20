import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DomainRegistryView } from '../../apps/web/src/components/DomainRegistryView.js';
import { DurableQueueView } from '../../apps/web/src/components/DurableQueueView.js';
import { OmniPulseOverview } from '../../apps/web/src/pages/OmniPulseOverview.js';
import { SocialAccountsHealth } from '../../apps/web/src/pages/SocialAccountsHealth.js';
import { ContentQueueMonitor } from '../../apps/web/src/pages/ContentQueueMonitor.js';
import { PseoIntelligence } from '../../apps/web/src/pages/PseoIntelligence.js';
import { BacklinksCommander } from '../../apps/web/src/pages/BacklinksCommander.js';
import { PageviewVelocityMonitor } from '../../apps/web/src/components/dashboard/PageviewVelocityMonitor.js';

describe('Direct Component Crash Detection', () => {
  beforeEach(() => {
    (global as any).window = {
      location: { pathname: '/', search: '' },
      addEventListener: () => {},
      removeEventListener: () => {},
      history: { pushState: () => {}, replaceState: () => {} },
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
      fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }),
    };
    (global as any).localStorage = (global as any).window.localStorage;
  });

  it('renders DomainRegistryView', () => {
    const html = renderToString(React.createElement(DomainRegistryView));
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders DurableQueueView', () => {
    const html = renderToString(React.createElement(DurableQueueView));
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders OmniPulseOverview', () => {
    const html = renderToString(React.createElement(OmniPulseOverview));
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders SocialAccountsHealth', () => {
    const html = renderToString(React.createElement(SocialAccountsHealth));
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders ContentQueueMonitor', () => {
    const html = renderToString(React.createElement(ContentQueueMonitor));
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders PseoIntelligence', () => {
    const html = renderToString(React.createElement(PseoIntelligence));
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders BacklinksCommander', () => {
    const html = renderToString(React.createElement(BacklinksCommander));
    expect(html.length).toBeGreaterThan(0);
  });

  it('renders PageviewVelocityMonitor', () => {
    const html = renderToString(React.createElement(PageviewVelocityMonitor));
    expect(html.length).toBeGreaterThan(0);
  });
});

