/**
 * @file http-agent-service-preview-modes.integration.test.js
 * @description Integration tests for HttpAgentService preview calculations when toggling
 *              adaptive cleanup behaviour, ensuring temporary overrides interact with
 *              live HTTP traffic and that timers are restored correctly afterwards.
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
import express from 'express';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import HttpAgentService from '../../src/services/httpAgentService.js';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_HTTP_AGENT_ENABLED = process.env.HTTP_AGENT_ENABLED;

/**
 * Spins up an HTTP server that responds immediately so the agent transitions sockets
 * through active and free pools while we collect statistics.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>} utilities for the server
 */
async function createBurstServer() {
  const app = express();
  app.get('/burst', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    port,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.HTTP_AGENT_ENABLED = 'true';
});

afterAll(() => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }

  if (ORIGINAL_HTTP_AGENT_ENABLED === undefined) {
    delete process.env.HTTP_AGENT_ENABLED;
  } else {
    process.env.HTTP_AGENT_ENABLED = ORIGINAL_HTTP_AGENT_ENABLED;
  }
});

describe('HttpAgentService cleanup preview integration', () => {
  /** @type {(() => void) | null} */
  let restoreTimers = null;

  afterEach(() => {
    if (restoreTimers) {
      restoreTimers();
      restoreTimers = null;
    }
  });

  it('temporarily toggles adaptive cleanup for preview calculations while preserving the original mode', async () => {
    const logger = new ConsoleLogger();
    const { port, close } = await createBurstServer();

    const recordedIntervals = [];
    const originalSetInterval = global.setInterval;
    const originalClearTimeout = global.clearTimeout;
    const scheduledIntervals = [];
    global.setInterval = (handler, interval, ...args) => {
      recordedIntervals.push(interval);
      const intervalId = originalSetInterval(handler, interval, ...args);
      scheduledIntervals.push(intervalId);
      return intervalId;
    };
    const clearTimeoutSpy = jest.fn();
    global.clearTimeout = (id) => {
      clearTimeoutSpy(id);
      return originalClearTimeout(id);
    };
    restoreTimers = () => {
      while (scheduledIntervals.length > 0) {
        const intervalId = scheduledIntervals.pop();
        originalClearTimeout(intervalId);
      }
      global.setInterval = originalSetInterval;
      global.clearTimeout = originalClearTimeout;
    };

    const baseInterval = 120;
    const service = new HttpAgentService(logger, {
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: baseInterval,
      minCleanupIntervalMs: 30,
      maxCleanupIntervalMs: 400,
      keepAlive: true,
    });

    expect(recordedIntervals).toHaveLength(1);
    expect(recordedIntervals[0]).toBe(baseInterval);

    const burstUrl = `http://127.0.0.1:${port}/burst`;
    // Issue several requests so that request statistics are populated before previewing intervals.
    for (let i = 0; i < 3; i += 1) {
      await new Promise((resolve, reject) => {
        const req = http.request(
          burstUrl,
          { agent: service.getAgent(burstUrl), method: 'GET' },
          (res) => {
            res.setEncoding('utf8');
            res.on('data', () => {});
            res.on('end', resolve);
          }
        );
        req.on('error', reject);
        req.end();
      });
    }

    const previewWithBaseMode = service.getNextCleanupIntervalPreview();
    expect(previewWithBaseMode).toBe(baseInterval);

    const adaptivePreview = service.getNextCleanupIntervalPreview({
      overrideAdaptiveCleanupEnabled: true,
    });
    expect(adaptivePreview).toBeGreaterThan(baseInterval);
    expect(adaptivePreview).toBeLessThanOrEqual(400);

    const statsAfterPreview = service.getEnhancedStats();
    expect(statsAfterPreview.adaptiveCleanup.enabled).toBe(false);
    expect(service.getNextCleanupIntervalPreview()).toBe(baseInterval);

    service.cleanup();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    await close();
  });
});
