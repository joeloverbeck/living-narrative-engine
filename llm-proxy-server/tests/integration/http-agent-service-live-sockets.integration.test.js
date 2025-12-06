/**
 * @file http-agent-service-live-sockets.integration.test.js
 * @description Integration tests exercising HttpAgentService with real HTTP sockets
 *              to cover memory estimation and agent destruction paths.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
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
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
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

function performHttpRequest(agent, port, path = '/live') {
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
        res.on('data', () => {});
        res.on('end', resolve);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('HttpAgentService live socket integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tracks socket reuse and memory estimations with real network requests', async () => {
    const logger = createTestLogger();
    const service = new HttpAgentService(logger);
    const server = await startEchoServer();

    const baseUrl = `http://127.0.0.1:${server.port}`;
    const totalRequests = 6;

    try {
      for (let i = 0; i < totalRequests; i += 1) {
        const { agent } = service.getFetchOptions(`${baseUrl}/live-${i % 2}`);
        await performHttpRequest(agent, server.port, `/live-${i % 2}`);
      }

      await delay(20);

      const stats = service.getEnhancedStats();
      expect(stats.activeAgents).toBeGreaterThanOrEqual(1);
      expect(stats.requestsServed).toBeGreaterThanOrEqual(totalRequests);
      expect(stats.socketsCreated).toBeGreaterThanOrEqual(0);
      expect(stats.adaptiveCleanup.enabled).toBe(true);
      expect(stats.requestRate).toBeGreaterThan(0);
      expect(stats.estimatedMemoryUsageMB).toBeGreaterThan(0);
      expect(
        stats.agentDetails.some(
          (detail) =>
            detail.requestCount >= totalRequests &&
            (detail.activeSockets > 0 || detail.freeSockets > 0)
        )
      ).toBe(true);

      const forcedCleanup = service.forceAdaptiveCleanup();
      expect(forcedCleanup.currentAgentCount).toBeGreaterThanOrEqual(0);
      expect(forcedCleanup.currentMemoryMB).toBeGreaterThanOrEqual(0);

      const httpNoPortUrl = 'http://localhost/resource';
      service.getFetchOptions(httpNoPortUrl);
      expect(service.destroyAgent(httpNoPortUrl)).toBe(true);

      const httpsUrl = 'https://example.com/path';
      service.getFetchOptions(httpsUrl);
      expect(service.destroyAgent(httpsUrl)).toBe(true);
      expect(service.destroyAgent(httpsUrl)).toBe(false);

      expect(service.destroyAgent('://malformed')).toBe(false);
    } finally {
      service.destroyAll();
      service.cleanup();
      await server.close();
    }
  });
});
