/**
 * Autonomous Growth OS — IndexNow Protocol Connector
 *
 * Implements Wave 1 Search Integration:
 * - Submits updated or newly published URLs immediately to IndexNow (Bing, Yandex, Seznam).
 * - Enforces hostname ownership: submitted URLs must match the host of the keyLocation.
 * - Enforces batch size constraints (up to 10,000 URLs per call).
 * - SSRF safe: validates target endpoint before dispatch.
 */

import axios from 'axios';
import { BaseConnector, type ConnectorHealthCheckResult } from './base-connector.js';
import type { ConnectorType, ConnectorCapability } from '@growth-os/shared-types';
import { assertSafeOutboundUrlAsync } from '../lib/safety.js';
import { logger } from '../lib/logger.js';

export interface IndexNowSubmitOptions {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

export interface IndexNowSubmitResult {
  success: boolean;
  statusCode: number;
  submittedCount: number;
  message: string;
  timestamp: string;
}

export class IndexNowConnector extends BaseConnector {
  readonly type: ConnectorType = 'indexnow' as any;
  readonly version = '1.0.0';
  readonly supportedCapabilities: ConnectorCapability[] = ['publish_post'];

  private static readonly INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

  public async checkHealth(): Promise<ConnectorHealthCheckResult> {
    const start = Date.now();
    try {
      await assertSafeOutboundUrlAsync(IndexNowConnector.INDEXNOW_ENDPOINT);
      return {
        status: 'connected',
        latency_ms: Date.now() - start,
        message: 'IndexNow endpoint is reachable and operational.',
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
   * Submit a batch of URLs to the IndexNow protocol
   */
  public async submitUrls(options: IndexNowSubmitOptions): Promise<IndexNowSubmitResult> {
    const { host, key, keyLocation, urlList } = options;

    if (!urlList || urlList.length === 0) {
      throw new Error('IndexNow submission requires at least one URL');
    }

    if (urlList.length > 10000) {
      throw new Error('IndexNow protocol limits submissions to 10,000 URLs per batch');
    }

    // Validate that all URLs belong to the stated host
    for (const url of urlList) {
      await assertSafeOutboundUrlAsync(url);
      const parsed = new URL(url);
      if (parsed.hostname !== host && !parsed.hostname.endsWith(`.${host}`)) {
        throw new Error(`URL "${url}" does not match declared host "${host}"`);
      }
    }

    await assertSafeOutboundUrlAsync(IndexNowConnector.INDEXNOW_ENDPOINT);

    const payload = {
      host,
      key,
      keyLocation: keyLocation || `https://${host}/${key}.txt`,
      urlList,
    };

    logger.info({ host, count: urlList.length }, 'Submitting URLs to IndexNow protocol');

    try {
      const response = await axios.post(IndexNowConnector.INDEXNOW_ENDPOINT, payload, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        timeout: 10000,
        validateStatus: () => true, // Don't throw automatically on 202/200/400
      });

      const isSuccess = response.status === 200 || response.status === 202;

      return {
        success: isSuccess,
        statusCode: response.status,
        submittedCount: isSuccess ? urlList.length : 0,
        message: isSuccess
          ? `Successfully submitted ${urlList.length} URLs to IndexNow (HTTP ${response.status}).`
          : `IndexNow submission returned HTTP ${response.status}: ${JSON.stringify(response.data)}`,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err }, 'IndexNow submission failed');
      throw new Error(`IndexNow submission failed: ${(err as Error).message}`);
    }
  }
}
