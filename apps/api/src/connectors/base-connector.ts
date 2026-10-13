/**
 * Autonomous Growth OS — Base Connector Interface
 *
 * Defines the contract that every connector adapter must fulfill.
 * Ensures uniform error handling, capability checking, and safety auditing.
 */

import type { ConnectorType, ConnectorCapability, ConnectorStatus } from '@growth-os/shared-types';

export interface ConnectorHealthCheckResult {
  status: ConnectorStatus;
  latency_ms: number;
  message: string;
}

export abstract class BaseConnector {
  abstract readonly type: ConnectorType;
  abstract readonly version: string;
  abstract readonly supportedCapabilities: ConnectorCapability[];

  /**
   * Run health check to confirm credentials, endpoint reachability, and quotas.
   */
  abstract checkHealth(): Promise<ConnectorHealthCheckResult>;

  /**
   * Check whether this connector instance supports the requested capability.
   */
  public hasCapability(cap: ConnectorCapability): boolean {
    return this.supportedCapabilities.includes(cap);
  }
}
