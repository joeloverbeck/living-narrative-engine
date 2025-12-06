/**
 * @file http-agent-service-fixed-interval.integration.test.js
 * @description Integration coverage focused on HttpAgentService when adaptive cleanup is disabled.
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';
import express from 'express';
import http from 'http';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import HttpAgentService from '../../src/services/httpAgentService.js';

/**
 * Spins up an express server with a delayed endpoint to keep sockets active.
 * @param {number} delayMs
 * @returns {Promise<{ port: number, close: () => Promise<void>, stats: { active: number } }>} server helpers
 */
async function createDelayedServer(delayMs = 120) {
  const app = express();
  const stats = { active: 0 };

  app.get('/slow', (req, res) => {
    stats.active += 1;
    setTimeout(() => {
      stats.active -= 1;
      res.json({ ok: true, delayMs });
    }, delayMs);
  });

  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    port,
    stats,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/**
 * Waits until the supplied predicate returns true or the timeout elapses.
 * @param {() => boolean} predicate
 * @param {number} timeoutMs
 * @param {number} intervalMs
 */
async function waitForCondition(predicate, timeoutMs = 500, intervalMs = 10) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Condition not met within timeout');
}

let serverHandle;

beforeAll(async () => {
  serverHandle = await createDelayedServer(600);
});

afterAll(async () => {
  if (serverHandle) {
    await serverHandle.close();
  }
});

describe('HttpAgentService integration in fixed-interval cleanup mode', () => {
  test('tracks sockets and cleans idle agents when adaptive cleanup is disabled', async () => {
    const logger = new ConsoleLogger();
    const service = new HttpAgentService(logger, {
      keepAlive: true,
      maxSockets: 4,
      idleThresholdMs: 200,
      baseCleanupIntervalMs: 1000,
      adaptiveCleanupEnabled: false,
      timeout: 500,
      freeSocketTimeout: 200,
    });

    const url = `http://127.0.0.1:${serverHandle.port}/slow`;

    try {
      const agent = service.getAgent(url);
      const responsePromise = new Promise((resolve, reject) => {
        const req = http.request(url, { agent, method: 'GET' }, (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode, body: raw });
          });
        });
        req.on('error', reject);
        req.end();
      });

      await waitForCondition(() => serverHandle.stats.active > 0, 400, 5);
      await waitForCondition(
        () => Object.keys(agent.sockets ?? {}).length > 0,
        400,
        5
      );
      expect(Object.keys(agent.sockets ?? {})).not.toHaveLength(0);
      const statsDuringRequest = service.getStats();
      expect(statsDuringRequest.activeAgents).toBe(1);
      expect(statsDuringRequest.agentDetails[0].activeSockets).toBeGreaterThan(
        0
      );

      const enhancedDuringRequest = service.getEnhancedStats();
      expect(enhancedDuringRequest.estimatedMemoryUsageMB).toBeGreaterThan(0);

      const response = await responsePromise;
      expect(response.status).toBe(200);

      const parsedBody = JSON.parse(response.body);
      expect(parsedBody.ok).toBe(true);

      await waitForCondition(
        () => Object.keys(agent.freeSockets ?? {}).length > 0,
        400,
        5
      );
      expect(Object.keys(agent.freeSockets ?? {})).not.toHaveLength(0);
      const statsAfterRequest = service.getStats();
      expect(statsAfterRequest.agentDetails[0].freeSockets).toBeGreaterThan(0);

      const future = Date.now() + 60000;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => future);
      try {
        const cleanupResult = service.forceAdaptiveCleanup();
        expect(cleanupResult.agentsRemoved).toBeGreaterThanOrEqual(1);
        expect(cleanupResult.currentAgentCount).toBe(0);
      } finally {
        nowSpy.mockRestore();
      }

      const enhancedStats = service.getEnhancedStats();
      expect(
        enhancedStats.adaptiveCleanup.cleanupOperations
      ).toBeGreaterThanOrEqual(0);

      expect(service.getActiveAgentCount()).toBe(0);
    } finally {
      service.cleanup();
    }
  });
});
