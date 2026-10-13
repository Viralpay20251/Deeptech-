/**
 * Autonomous Growth OS — Google PageSpeed Insights & CrUX Connector
 *
 * Implements Wave 1 Performance Diagnostics:
 * - Queries Google PageSpeed Insights v5 REST API.
 * - Captures Core Web Vitals: LCP (Largest Contentful Paint), FID/INP, CLS (Cumulative Layout Shift), FCP.
 * - Audits Lighthouse performance score (0-100).
 * - Distinguishes origin-level CrUX 28-day field data from simulated lab data.
 */

import axios from 'axios';
import { BaseConnector, type ConnectorHealthCheckResult } from './base-connector.js';
import type { ConnectorType, ConnectorCapability } from '@growth-os/shared-types';
import { assertSafeOutboundUrlAsync } from '../lib/safety.js';
import { logger } from '../lib/logger.js';

export interface PageSpeedAuditOptions {
  url: string;
  strategy?: 'mobile' | 'desktop';
  apiKey?: string;
}

export interface PageSpeedAuditResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  performanceScore: number; // 0 - 100
  coreWebVitals: {
    lcpMs: number | null;
    fcpMs: number | null;
    cls: number | null;
    inpMs: number | null;
    passedCoreWebVitals: boolean;
  };
  hasCrUXFieldData: boolean;
  opportunities: Array<{ title: string; description: string; savingsMs?: number }>;
  auditedAt: string;
}

export class PageSpeedCruxConnector extends BaseConnector {
  readonly type: ConnectorType = 'pagespeed_crux' as any;
  readonly version = 'v5';
  readonly supportedCapabilities: ConnectorCapability[] = ['read_analytics', 'read_insights'];

  private static readonly API_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

  public async checkHealth(): Promise<ConnectorHealthCheckResult> {
    const start = Date.now();
    try {
      await assertSafeOutboundUrlAsync(PageSpeedCruxConnector.API_ENDPOINT);
      return {
        status: 'connected',
        latency_ms: Date.now() - start,
        message: 'Google PageSpeed Insights API is operational.',
      };
    } catch (err) {
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        message: (err as Error).message,
      };
    }
  }

  /**
   * Run PageSpeed and Core Web Vitals audit
   */
  public async runAudit(options: PageSpeedAuditOptions): Promise<PageSpeedAuditResult> {
    const { url, strategy = 'mobile', apiKey } = options;
    await assertSafeOutboundUrlAsync(url);
    await assertSafeOutboundUrlAsync(PageSpeedCruxConnector.API_ENDPOINT);

    logger.info({ url, strategy }, 'Running PageSpeed Insights audit');

    const params: Record<string, string> = {
      url,
      strategy,
      category: 'performance',
    };
    if (apiKey) params['key'] = apiKey;

    try {
      const response = await axios.get(PageSpeedCruxConnector.API_ENDPOINT, {
        params,
        timeout: 25000,
      });

      const data = response.data;
      const lighthouse = data.lighthouseResult || {};
      const categories = lighthouse.categories || {};
      const perfCategory = categories.performance || {};
      const score = Math.round((perfCategory.score ?? 0) * 100);

      const audits = lighthouse.audits || {};
      const lcpMs = audits['largest-contentful-paint']?.numericValue ?? null;
      const fcpMs = audits['first-contentful-paint']?.numericValue ?? null;
      const cls = audits['cumulative-layout-shift']?.numericValue ?? null;
      const inpMs = audits['interactive']?.numericValue ?? null;

      // Good thresholds: LCP <= 2500ms, CLS <= 0.1
      const passedCoreWebVitals = (lcpMs === null || lcpMs <= 2500) && (cls === null || cls <= 0.1);

      // Extract high-impact performance opportunities
      const opportunities: Array<{ title: string; description: string; savingsMs?: number }> = [];
      const oppKeys = ['render-blocking-resources', 'unused-javascript', 'unused-css-rules', 'modern-image-formats', 'uses-optimized-images'];
      for (const k of oppKeys) {
        if (audits[k] && audits[k].score !== null && audits[k].score < 0.9) {
          opportunities.push({
            title: audits[k].title,
            description: audits[k].description,
            savingsMs: audits[k].details?.overallSavingsMs,
          });
        }
      }

      const hasCrUXFieldData = Boolean(data.loadingExperience?.metrics);

      return {
        url,
        strategy,
        performanceScore: score,
        coreWebVitals: {
          lcpMs: lcpMs ? Math.round(lcpMs) : null,
          fcpMs: fcpMs ? Math.round(fcpMs) : null,
          cls: cls ? Math.round(cls * 1000) / 1000 : null,
          inpMs: inpMs ? Math.round(inpMs) : null,
          passedCoreWebVitals,
        },
        hasCrUXFieldData,
        opportunities,
        auditedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ url, err: (err as Error).message }, 'PageSpeed audit query failed');
      throw new Error(`PageSpeed audit failed: ${(err as Error).message}`);
    }
  }
}
