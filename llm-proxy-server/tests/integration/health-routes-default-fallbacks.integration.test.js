/**
 * @file Integration tests for healthRoutes default environment fallbacks
 * @description Ensures the detailed health endpoint gracefully falls back to production defaults
 * when no appConfigService or environment metadata is provided.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import request from 'supertest';

import {
  buildHealthRoutesApp,
  createOperationalLlmConfigService,
} from '../common/healthRoutesTestUtils.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

describe('healthRoutes default environment fallbacks', () => {
  let envManager;

  beforeEach(() => {
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment();
  });

  afterEach(() => {
    if (envManager) {
      envManager.restoreEnvironment();
    }
  });

  it('returns production defaults when no environment metadata is present', async () => {
    const { app } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
      appConfigService: null,
    });

    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'UP',
        service: 'llm-proxy-server',
        environment: {
          node_env: 'production',
          proxy_port: '',
        },
      })
    );
    expect(typeof response.body.timestamp).toBe('string');
    expect(typeof response.body.uptime).toBe('number');
  });
});
