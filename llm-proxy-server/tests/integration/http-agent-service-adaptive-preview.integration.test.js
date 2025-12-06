/**
 * @file http-agent-service-adaptive-preview.integration.test.js
 * @description Integration tests covering HttpAgentService diagnostic preview and
 *              fallback statistics handling using real HTTP agents.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

import HttpAgentService from '../../src/services/httpAgentService.js';

function createTestLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

async function startEchoServer() {
  const server = http.createServer((req, res) => {
    res.statusCode = 204;
    res.end();
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    port,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
      }),
  };
}

function performRequest(agent, port, path = '/') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        agent,
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
      },
      (res) => {
        res.resume();
        res.on('end', resolve);
      }
    );

    req.on('error', reject);
    req.end();
  });
}

describe('HttpAgentService adaptive preview integration', () => {
  let server;
  let logger;
  let service;
  let baseUrl;

  beforeAll(async () => {
    server = await startEchoServer();
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  afterEach(() => {
    if (service) {
      service.cleanup();
      service = undefined;
    }
    jest.restoreAllMocks();
  });

  it('provides branch coverage for stats fallbacks and preview overrides', async () => {
    logger = createTestLogger();
    service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 200,
      minCleanupIntervalMs: 50,
      maxCleanupIntervalMs: 400,
      highLoadRequestsPerMin: 1,
    });

    const trackedUrl = `${baseUrl}/adaptive`;
    const { agent } = service.getFetchOptions(trackedUrl);

    await performRequest(agent, server.port, '/adaptive');

    expect(service.hasAgent(trackedUrl)).toBe(true);
    expect(service.hasAgent('notaurl')).toBe(false);

    // Force agent socket maps to be undefined to exercise fallback statistics paths
    const originalSockets = agent.sockets;
    const originalFreeSockets = agent.freeSockets;
    agent.sockets = undefined;
    agent.freeSockets = undefined;

    const stats = service.getStats();
    expect(stats.agentDetails[0].activeSockets).toBe(0);
    expect(stats.agentDetails[0].freeSockets).toBe(0);

    const enhancedStats = service.getEnhancedStats();
    expect(enhancedStats.estimatedMemoryUsageMB).toBeGreaterThanOrEqual(0);

    // Restore socket maps so subsequent cleanup operations remain stable
    agent.sockets = originalSockets;
    agent.freeSockets = originalFreeSockets;

    const basePreview = service.getNextCleanupIntervalPreview();
    const overridePreview = service.getNextCleanupIntervalPreview({
      overrideAdaptiveCleanupEnabled: false,
    });
    expect(typeof basePreview).toBe('number');
    expect(typeof overridePreview).toBe('number');

    // Ensure adaptive cleanup mode is restored after override
    const restoredPreview = service.getNextCleanupIntervalPreview();
    expect(restoredPreview).toBe(basePreview);

    await delay(10);
    const cleanedCount = service.cleanupIdleAgents(0);
    expect(cleanedCount).toBeGreaterThanOrEqual(1);
    expect(service.hasAgent(trackedUrl)).toBe(false);
  });
});
