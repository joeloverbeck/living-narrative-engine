import { describe, beforeEach, afterEach, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import healthRoutes from '../../src/routes/healthRoutes.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

/**
 * Creates an express application wired with the real health routes.
 * @returns {import('express').Express} Configured express application instance.
 */
function createHealthApp() {
  const app = express();
  app.use('/health', healthRoutes);
  return app;
}

describe('healthRoutes operational endpoint integration', () => {
  let app;
  let envManager;

  beforeEach(() => {
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    app = createHealthApp();
  });

  afterEach(() => {
    if (envManager) {
      envManager.restoreEnvironment();
    }
  });

  it('exposes base health metadata with uptime and timestamps', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'llm-proxy-server',
    });
    expect(typeof response.body.timestamp).toBe('string');
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('reports liveness using the real process identifier', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'alive',
      service: 'llm-proxy-server',
    });
    expect(response.body.pid).toBe(process.pid);
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('surfaces detailed system metrics including environment snapshots', async () => {
    envManager.setEnvironment({
      NODE_ENV: 'test',
      PROXY_PORT: '4800',
    });

    const response = await request(app).get('/health/detailed');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'llm-proxy-server',
      environment: {
        node_env: 'test',
        proxy_port: '4800',
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
      })
    );
    expect(Array.isArray(response.body.system.load_average)).toBe(true);
    expect(response.body.system.load_average).toHaveLength(3);
  });
});
