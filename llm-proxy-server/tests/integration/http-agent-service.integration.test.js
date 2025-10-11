/**
 * @file http-agent-service.integration.test.js
 * @description Integration tests verifying HttpAgentService behavior with real HTTP requests and adaptive cleanup.
 */

import http from 'http';
import { jest } from '@jest/globals';
import HttpAgentService from '../../src/services/httpAgentService.js';

/**
 * @description Creates a lightweight logger compatible with HttpAgentService expectations.
 * @returns {object} Logger implementation used for assertions.
 */
function createTestLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  // The service checks this flag before logging verbose information.
  logger.isDebugEnabled = true;
  return logger;
}

describe('HttpAgentService integration', () => {
  /** @type {http.Server} */
  let server;
  let baseUrl;
  let requestCounter = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requestCounter += 1;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          path: req.url,
          requestId: requestCounter,
        })
      );
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new Error('Failed to start HTTP test server');
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

  beforeEach(() => {
    requestCounter = 0;
  });

  it('reuses HTTP agents across real requests and exposes lifecycle utilities', async () => {
    const logger = createTestLogger();
    const httpAgentService = new HttpAgentService(logger, {
      keepAlive: true,
      maxSockets: 4,
      maxFreeSockets: 2,
      timeout: 2000,
      freeSocketTimeout: 1000,
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 50,
    });

    const url = `${baseUrl}/pooled`;

    const responses = [];
    for (let i = 0; i < 3; i += 1) {
      const agent = httpAgentService.getAgent(url);
      const res = await fetch(url, { agent });
      const payload = await res.json();
      responses.push(payload.requestId);
    }

    expect(new Set(responses).size).toBe(3);
    expect(httpAgentService.getActiveAgentCount()).toBe(1);

    const stats = httpAgentService.getStats();
    expect(stats.activeAgents).toBe(1);
    expect(stats.requestsServed).toBe(3);
    expect(stats.agentDetails[0].requestCount).toBe(3);

    const options = httpAgentService.getFetchOptions(url);
    expect(options.agent).toBeDefined();

    const initialConfig = httpAgentService.getConfig();
    expect(initialConfig.maxSockets).toBe(4);

    httpAgentService.updateConfig({ maxSockets: 8 });
    const updatedConfig = httpAgentService.getConfig();
    expect(updatedConfig.maxSockets).toBe(8);
    expect(initialConfig.maxSockets).toBe(4);

    expect(httpAgentService.hasAgent(url)).toBe(true);
    expect(httpAgentService.hasAgent('not-a-valid-url')).toBe(false);

    expect(httpAgentService.destroyAgent('https://missing.example.com')).toBe(
      false
    );

    const destroyed = httpAgentService.destroyAgent(url);
    expect(destroyed).toBe(true);
    expect(httpAgentService.hasAgent(url)).toBe(false);

    // Recreate an agent to ensure destroyAll is exercised with active agents.
    httpAgentService.getAgent(url);
    expect(httpAgentService.getActiveAgentCount()).toBe(1);

    httpAgentService.cleanup();
    expect(httpAgentService.getActiveAgentCount()).toBe(0);

    httpAgentService.destroyAll();
    expect(httpAgentService.getActiveAgentCount()).toBe(0);
  });

  it('performs adaptive cleanup based on request rate and memory pressure', async () => {
    jest.useFakeTimers();

    const highLoadLogger = createTestLogger();
    const highLoadService = new HttpAgentService(highLoadLogger, {
      keepAlive: true,
      baseCleanupIntervalMs: 20,
      minCleanupIntervalMs: 5,
      maxCleanupIntervalMs: 40,
      idleThresholdMs: 5,
      memoryThresholdMB: 0.00001,
      highLoadRequestsPerMin: 1,
    });

    const highLoadUrl = `${baseUrl}/high-load`;
    for (let i = 0; i < 3; i += 1) {
      const agent = highLoadService.getAgent(highLoadUrl);
      const res = await fetch(highLoadUrl, { agent });
      await res.json();
    }

    expect(highLoadService.getActiveAgentCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(25);

    const highLoadStats = highLoadService.getEnhancedStats();
    expect(highLoadStats.activeAgents).toBe(0);
    expect(highLoadStats.adaptiveCleanup.adjustments).toBeGreaterThan(0);
    expect(highLoadStats.adaptiveCleanup.cleanupOperations).toBeGreaterThan(0);

    const cleanupSummary = highLoadService.forceAdaptiveCleanup();
    expect(cleanupSummary.currentAgentCount).toBe(0);
    expect(cleanupSummary.agentsRemoved).toBe(0);

    highLoadService.cleanup();

    const lowLoadLogger = createTestLogger();
    const lowLoadService = new HttpAgentService(lowLoadLogger, {
      keepAlive: true,
      baseCleanupIntervalMs: 30,
      minCleanupIntervalMs: 5,
      maxCleanupIntervalMs: 60,
      idleThresholdMs: 5,
      highLoadRequestsPerMin: 1000,
    });

    const lowLoadUrl = `${baseUrl}/low-load`;
    const lowLoadAgent = lowLoadService.getAgent(lowLoadUrl);
    const lowLoadResponse = await fetch(lowLoadUrl, { agent: lowLoadAgent });
    await lowLoadResponse.json();

    await jest.advanceTimersByTimeAsync(35);

    const lowLoadStats = lowLoadService.getEnhancedStats();
    expect(lowLoadStats.activeAgents).toBe(0);
    expect(lowLoadStats.adaptiveCleanup.adjustments).toBeGreaterThan(0);
    expect(lowLoadStats.requestRate).toBeLessThan(10);

    lowLoadService.cleanup();
    jest.useRealTimers();
  });
});
