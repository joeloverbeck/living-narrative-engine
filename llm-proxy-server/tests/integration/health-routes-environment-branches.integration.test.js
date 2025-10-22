/**
 * @file Integration tests targeting environment branch coverage for healthRoutes
 * @description Verifies that appConfigService accessors are prioritized over environment variables
 * and that fallback logic is respected when accessor functions are missing.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import request from 'supertest';

import {
  buildHealthRoutesApp,
  createOperationalLlmConfigService,
} from '../common/healthRoutesTestUtils.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

describe('healthRoutes environment detail coverage', () => {
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

  it('prioritizes appConfigService accessors over process environment defaults', async () => {
    envManager.setEnvironment({
      NODE_ENV: 'should-not-appear',
      PROXY_PORT: '9999',
    });

    const customAppConfigService = {
      getNodeEnv: () => 'integration-env',
      getProxyPort: () => 8142,
    };

    const { app } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
      appConfigService: customAppConfigService,
    });

    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body.environment).toEqual({
      node_env: 'integration-env',
      proxy_port: '8142',
    });
  });

  it('falls back to process environment when accessor functions are absent', async () => {
    envManager.setEnvironment({
      NODE_ENV: 'fallback-env',
      PROXY_PORT: '6150',
    });

    const partialAppConfigService = {
      getNodeEnv: undefined,
      getProxyPort: null,
    };

    const { app } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
      appConfigService: partialAppConfigService,
    });

    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body.environment).toEqual({
      node_env: 'fallback-env',
      proxy_port: '6150',
    });
  });
});
