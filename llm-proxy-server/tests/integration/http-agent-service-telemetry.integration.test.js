/**
 * @file http-agent-service-telemetry.integration.test.js
 * @description Integration suite focusing on HttpAgentService's connection telemetry and
 *              adaptive cleanup behaviour using real HTTP requests and configuration services.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import express from 'express';
import http from 'node:http';
import { EventEmitter } from 'node:events';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Creates an Express application that echoes JSON payloads.
 * @returns {Promise<{ port: number, close: () => Promise<void> }>} server helpers
 */
async function createEchoServer() {
  const app = express();
  app.use(express.json());
  app.post('/relay', (req, res) => {
    res.json({ received: req.body, headers: req.headers });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}

/**
 * Sends a JSON POST request to the echo server using the provided HttpAgentService.
 * @param {HttpAgentService} httpAgentService - Service under test
 * @param {number} port - Echo server port
 * @param {object} payload - Payload to send
 * @returns {Promise<any>} parsed JSON response
 */
async function sendJsonRequest(httpAgentService, port, payload) {
  const targetUrl = `http://127.0.0.1:${port}/relay`;
  const { agent } = httpAgentService.getFetchOptions(targetUrl);

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/relay',
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Id': payload.id,
        },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('error', reject);
    request.write(JSON.stringify(payload));
    request.end();
  });
}

const ORIGINAL_HTTP_AGENT_ENABLED = process.env.HTTP_AGENT_ENABLED;

describe('HttpAgentService connection telemetry integration', () => {
  let server;
  let httpAgentService;
  let logger;
  let activePort;

  beforeAll(async () => {
    server = await createEchoServer();
    activePort = server.port;
    process.env.HTTP_AGENT_ENABLED = 'true';
  });

  afterAll(async () => {
    if (server) {
      await server.close();
      server = null;
    }
    if (ORIGINAL_HTTP_AGENT_ENABLED === undefined) {
      delete process.env.HTTP_AGENT_ENABLED;
    } else {
      process.env.HTTP_AGENT_ENABLED = ORIGINAL_HTTP_AGENT_ENABLED;
    }
  });

  beforeEach(() => {
    resetAppConfigServiceInstance();
    logger = new ConsoleLogger();
    logger.isDebugEnabled = true;

    const appConfig = getAppConfigService(logger);
    httpAgentService = new HttpAgentService(logger, {
      ...appConfig.getHttpAgentConfig(),
      keepAlive: true,
      baseCleanupIntervalMs: 5000,
      minCleanupIntervalMs: 1000,
      maxCleanupIntervalMs: 10000,
      idleThresholdMs: 50,
      highLoadRequestsPerMin: 100,
      memoryThresholdMB: 0.0000001,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (httpAgentService) {
      httpAgentService.cleanup();
      httpAgentService = null;
    }
    resetAppConfigServiceInstance();
  });

  it('tracks socket lifecycle metrics and adaptive cleanup with real requests', async () => {
    const payloads = [
      { id: 'req-1', prompt: 'alpha' },
      { id: 'req-2', prompt: 'beta' },
      { id: 'req-3', prompt: 'gamma' },
    ];

    for (const payload of payloads) {
      const response = await sendJsonRequest(
        httpAgentService,
        activePort,
        payload
      );
      expect(response.received).toEqual(payload);
      expect(response.headers['x-test-id']).toBe(payload.id);
    }

    // Emit socket lifecycle events manually to ensure monitoring counters are exercised.
    const { agent } = httpAgentService.getFetchOptions(
      `http://127.0.0.1:${activePort}/relay`
    );
    const simulatedSocket = new EventEmitter();
    agent.emit('socket', simulatedSocket);
    simulatedSocket.emit('agentRemove');

    // Allow the agent to register free sockets after requests complete.
    await new Promise((resolve) => setTimeout(resolve, 30));

    const stats = httpAgentService.getStats();
    expect(stats.requestsServed).toBeGreaterThanOrEqual(payloads.length);
    expect(stats.socketsCreated).toBeGreaterThanOrEqual(1);
    expect(stats.socketsReused).toBeGreaterThanOrEqual(1);

    const detail = stats.agentDetails.find(
      (entry) => entry.port === String(activePort)
    );
    expect(detail).toBeDefined();
    expect(detail.freeSockets).toBeGreaterThanOrEqual(0);

    // Destroying an agent for an unused host should hit the graceful false branch.
    expect(httpAgentService.destroyAgent('http://127.0.0.1:6555/unused')).toBe(
      false
    );

    // Force adaptive cleanup in a simulated future to exercise cleanup branches.
    const now = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000);
    const cleanupSummary = httpAgentService.forceAdaptiveCleanup();
    nowSpy.mockRestore();

    expect(cleanupSummary.currentAgentCount).toBeGreaterThanOrEqual(0);
    expect(cleanupSummary.currentMemoryMB).toBeGreaterThanOrEqual(0);

    const enhancedStats = httpAgentService.getEnhancedStats();
    expect(enhancedStats.estimatedMemoryUsageMB).toBeGreaterThanOrEqual(0);
    expect(
      enhancedStats.adaptiveCleanup.cleanupOperations
    ).toBeGreaterThanOrEqual(1);
  });
});
