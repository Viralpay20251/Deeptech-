import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../../apps/web/src/App.js';

describe('App Component Rendering', () => {
  it('renders without throwing when activeTab is omnipulse', () => {
    // Setup window mocks
    (global as any).window = {
      location: { pathname: '/omnipulse', search: '' },
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

    const tabs = [
      'omnipulse',
      'omnipulse_velocity',
      'omnipulse_accounts',
      'omnipulse_queue',
      'omnipulse_pseo',
      'omnipulse_backlinks',
      'domains',
      'scorecards',
      'queue',
      'approvals',
      'opportunities',
      'workflows',
      'crawler',
      'seo',
      'meta_studio',
      'connectors',
      'evidence',
    ];

    for (const tab of tabs) {
      (global as any).window.location.pathname = '/' + tab;
      expect(() => {
        const html = renderToString(React.createElement(App));
        console.log(`Rendered tab ${tab}: ${html.length} bytes`);
      }).not.toThrow();
    }
  });
});

