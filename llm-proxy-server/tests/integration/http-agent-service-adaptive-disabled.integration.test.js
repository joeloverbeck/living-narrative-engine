/**
 * @file http-agent-service-adaptive-disabled.integration.test.js
 * @description Integration tests covering HttpAgentService behaviour when adaptive cleanup
 *              is explicitly disabled, ensuring socket statistics and cleanup orchestration
 *              remain accurate while collaborating with real HTTP servers.
 */

import {
  afterEach,
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import http from 'node:http';
import express from 'express';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_HTTP_AGENT_ENABLED = process.env.HTTP_AGENT_ENABLED;

/**
 * Creates an HTTP server with a deliberately slow endpoint so active sockets remain
 * registered on the agent while statistics are captured.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>} server helpers
 */
async function createSlowServer() {
  const app = express();
  app.get('/slow', (_req, res) => {
    // Delay the response so that the underlying socket stays in the active map.
    setTimeout(() => {
      res.status(200).json({ ok: true });
    }, 75);
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

describe('HttpAgentService adaptive cleanup disabled integration', () => {
  /** @type {(() => void) | null} */
  let restoreTimers = null;

  afterEach(() => {
    if (restoreTimers) {
      restoreTimers();
      restoreTimers = null;
    }
    resetAppConfigServiceInstance();
  });

  it('schedules fixed cleanup intervals and reports socket utilisation metrics', async () => {
    const logger = new ConsoleLogger();
    const { port, close } = await createSlowServer();

    const recordedTimers = [];
    const originalSetInterval = global.setInterval;
    const originalClearTimeout = global.clearTimeout;
    global.setInterval = (handler, interval) => {
      recordedTimers.push({ handler, interval });
      // Return the handler itself to make clearTimeout a no-op friendly token.
      return handler;
    };
    const clearTimeoutMock = jest.fn();
    global.clearTimeout = clearTimeoutMock;
    restoreTimers = () => {
      global.setInterval = originalSetInterval;
      global.clearTimeout = originalClearTimeout;
    };

    const appConfig = getAppConfigService(logger);
    const service = new HttpAgentService(logger, {
      ...appConfig.getHttpAgentConfig(),
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 50,
      minCleanupIntervalMs: 25,
      maxCleanupIntervalMs: 120,
      keepAlive: true,
    });

    expect(recordedTimers).toHaveLength(1);
    expect(recordedTimers[0].interval).toBe(50);

    const slowUrl = `http://127.0.0.1:${port}/slow`;
    const activeRequest = new Promise((resolve, reject) => {
      const req = http.request(
        slowUrl,
        { agent: service.getAgent(slowUrl), method: 'GET' },
        (res) => {
          res.setEncoding('utf8');
          res.on('data', () => {});
          res.on('end', resolve);
        }
      );
      req.on('error', reject);
      req.end();
    });

    // Wait briefly so the request is in-flight but not yet completed.
    await new Promise((resolve) => setTimeout(resolve, 15));

    const statsDuringRequest = service.getStats();
    expect(statsDuringRequest.activeAgents).toBe(1);
    expect(statsDuringRequest.agentDetails[0].activeSockets).toBeGreaterThan(0);

    await activeRequest;
    // Allow the agent to transition the socket into the free pool.
    await new Promise((resolve) => setImmediate(resolve));

    const statsAfterReuse = service.getStats();
    expect(statsAfterReuse.agentDetails[0].freeSockets).toBeGreaterThanOrEqual(
      1
    );

    const enhancedStats = service.getEnhancedStats();
    expect(enhancedStats.adaptiveCleanup.enabled).toBe(false);
    expect(enhancedStats.estimatedMemoryUsageMB).toBeGreaterThanOrEqual(0);

    const cleanupSummary = service.forceAdaptiveCleanup();
    expect(cleanupSummary).toEqual(
      expect.objectContaining({
        agentsRemoved: expect.any(Number),
        memoryFreedMB: expect.any(Number),
        currentAgentCount: expect.any(Number),
        currentMemoryMB: expect.any(Number),
      })
    );

    service.cleanup();
    expect(clearTimeoutMock).toHaveBeenCalled();
    await close();
  });
});
