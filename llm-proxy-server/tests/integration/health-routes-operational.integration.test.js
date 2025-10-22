import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import request from 'supertest';

import {
  buildHealthRoutesApp,
  createAppConfigService,
  createOperationalLlmConfigService,
} from '../common/healthRoutesTestUtils.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

describe('healthRoutes operational endpoint integration', () => {
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

  it('exposes base liveness metadata with uptime and timestamps', async () => {
    const { app } = buildHealthRoutesApp({
      llmConfigService: createOperationalLlmConfigService(),
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UP',
      version: expect.any(String),
      details: expect.objectContaining({
        uptime: expect.any(Number),
        memory: expect.objectContaining({
          used: expect.any(Number),
          total: expect.any(Number),
        }),
      }),
    });
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('reports liveness using the real process identifier', async () => {
    const { app } = buildHealthRoutesApp();

    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UP',
      service: 'llm-proxy-server',
      pid: process.pid,
    });
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('surfaces detailed system metrics including environment snapshots from appConfigService', async () => {
    const appConfigService = createAppConfigService({
      nodeEnv: 'integration-test',
      proxyPort: 4810,
    });
    const { app } = buildHealthRoutesApp({
      appConfigService,
    });

    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'UP',
      service: 'llm-proxy-server',
      environment: {
        node_env: 'integration-test',
        proxy_port: '4810',
      },
    });
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.system).toEqual(
      expect.objectContaining({
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heap_used: expect.any(Number),
          heap_total: expect.any(Number),
          external: expect.any(Number),
        }),
        load_average: expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
        ]),
      })
    );
  });

  it('falls back to process environment details when appConfigService is absent', async () => {
    envManager.setEnvironment({
      NODE_ENV: 'fallback-test',
      PROXY_PORT: '4900',
    });

    const { app } = buildHealthRoutesApp();

    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body.environment).toEqual({
      node_env: 'fallback-test',
      proxy_port: '4900',
    });
  });
});
