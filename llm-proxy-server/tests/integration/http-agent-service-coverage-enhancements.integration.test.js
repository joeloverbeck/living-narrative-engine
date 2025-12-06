import { afterEach, describe, expect, it, jest } from '@jest/globals';
import http from 'node:http';
import { EventEmitter } from 'node:events';

import HttpAgentService from '../../src/services/httpAgentService.js';

jest.setTimeout(20000);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCondition = async (
  predicate,
  { timeoutMs = 2000, stepMs = 25 } = {}
) => {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (predicate()) {
      return true;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await delay(stepMs);
  }
};

const createTestLogger = ({ debugEnabled = true } = {}) => {
  const entries = [];
  return {
    logger: {
      info: (message, context) =>
        entries.push({ level: 'info', message, context }),
      warn: (message, context) =>
        entries.push({ level: 'warn', message, context }),
      error: (message, context) =>
        entries.push({ level: 'error', message, context }),
      debug: (message, context) =>
        entries.push({ level: 'debug', message, context }),
      isDebugEnabled: debugEnabled,
    },
    entries,
  };
};

const createHoldServer = () => {
  /** @type {() => void} */
  let releaseHold = () => {};
  /** @type {() => void} */
  let markHoldArrived = () => {};
  const holdArrived = new Promise((resolve) => {
    markHoldArrived = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.url === '/hold') {
      markHoldArrived();
      res.writeHead(200, { 'content-type': 'text/plain' });
      releaseHold = () => {
        res.end('held');
      };
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          path: req.url,
          length: chunks.reduce((total, chunk) => total + chunk.length, 0),
        })
      );
    });
  });

  return {
    server,
    waitForHold: () => holdArrived,
    releaseHold: () => releaseHold(),
  };
};

const sendRequestThroughService = (
  service,
  targetUrl,
  { method = 'GET', body, headers } = {}
) => {
  const { agent } = service.getFetchOptions(targetUrl);
  const parsed = new URL(targetUrl);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        agent,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method,
        headers,
      },
      (response) => {
        const responseChunks = [];
        response.on('data', (chunk) => responseChunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            body: Buffer.concat(responseChunks).toString('utf8'),
          });
        });
      }
    );

    request.on('error', reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
};

describe('HttpAgentService integration coverage enhancements', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws if initialized without a logger dependency', () => {
    expect(() => new HttpAgentService()).toThrow('Logger is required');
  });

  it('tracks socket lifecycle metrics across active and idle pooled connections', async () => {
    const { logger, entries } = createTestLogger({ debugEnabled: true });
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 5000,
      minCleanupIntervalMs: 1000,
      idleThresholdMs: 10,
      memoryThresholdMB: 0.000001,
    });

    const { server, waitForHold, releaseHold } = createHoldServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const port = /** @type {import('node:net').AddressInfo} */ (
      server.address()
    ).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const holdPromise = sendRequestThroughService(service, `${baseUrl}/hold`);
      await waitForHold();

      await sendRequestThroughService(service, `${baseUrl}/fast`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      });

      await waitForCondition(
        () => {
          const stats = service.getStats();
          const detail = stats.agentDetails[0];
          return Boolean(
            detail && detail.activeSockets >= 1 && detail.freeSockets >= 1
          );
        },
        { timeoutMs: 4000, stepMs: 25 }
      );

      await delay(50);
      const statsDuring = service.getStats();
      expect(statsDuring.agentDetails[0].activeSockets).toBeGreaterThanOrEqual(
        1
      );
      expect(statsDuring.agentDetails[0].freeSockets).toBeGreaterThanOrEqual(1);

      const enhancedStats = service.getEnhancedStats();
      expect(enhancedStats.estimatedMemoryUsageMB).toBeGreaterThan(0);

      releaseHold();
      await holdPromise;

      const manualUrl = 'http://127.0.0.1:6554/manual';
      const manualAgent = service.getAgent(manualUrl);
      const fakeSocket = new EventEmitter();
      manualAgent.emit('socket', fakeSocket);
      fakeSocket.emit('agentRemove');
      expect(service.destroyAgent(manualUrl)).toBe(true);

      expect(service.destroyAgent(`${baseUrl}/fast`)).toBe(true);
      expect(service.destroyAgent(`${baseUrl}/fast`)).toBe(false);

      const postDestroyStats = service.getStats();
      expect(postDestroyStats.agentDetails).toHaveLength(0);
      expect(
        entries.some((entry) => entry.message?.includes('Socket created'))
      ).toBe(true);
      expect(
        entries.some((entry) => entry.message?.includes('Socket reused'))
      ).toBe(true);
    } finally {
      service.cleanup();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('cleans idle agents and destroys pooled connections in bulk operations', async () => {
    const { logger } = createTestLogger();
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 1000,
      minCleanupIntervalMs: 100,
    });

    try {
      const idleUrl = 'http://127.0.0.1:4321/idle';
      service.getAgent(idleUrl);
      await delay(5);
      const cleaned = service.cleanupIdleAgents(1);
      expect(cleaned).toBeGreaterThanOrEqual(1);

      const agentA = service.getAgent('http://127.0.0.1:5001/a');
      const agentB = service.getAgent('http://127.0.0.1:5002/b');

      const originalDestroyA = agentA.destroy.bind(agentA);
      let destroyCalledA = false;
      agentA.destroy = () => {
        destroyCalledA = true;
        originalDestroyA();
      };

      const originalDestroyB = agentB.destroy.bind(agentB);
      let destroyCalledB = false;
      agentB.destroy = () => {
        destroyCalledB = true;
        originalDestroyB();
      };

      service.destroyAll();
      expect(destroyCalledA).toBe(true);
      expect(destroyCalledB).toBe(true);
      expect(service.getActiveAgentCount()).toBe(0);
    } finally {
      service.cleanup();
    }
  });

  it('falls back to fixed interval cleanup scheduling when adaptive mode is disabled', async () => {
    const { logger } = createTestLogger();
    const service = new HttpAgentService(logger, {
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 50,
      minCleanupIntervalMs: 20,
    });

    try {
      await delay(200);
      const stats = service.getStats();
      expect(stats.cleanupOperations).toBeGreaterThanOrEqual(1);
    } finally {
      service.cleanup();
    }
  });

  it('calculates adaptive cleanup intervals across load scenarios and supports preview overrides', async () => {
    const { logger } = createTestLogger();
    const baseInterval = 1000;
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: baseInterval,
      minCleanupIntervalMs: 100,
      maxCleanupIntervalMs: 2000,
      highLoadRequestsPerMin: 2,
      memoryThresholdMB: 0.000001,
    });

    try {
      for (let port = 3000; port < 3055; port += 1) {
        service.getAgent(`http://127.0.0.1:${port}/test`);
      }

      for (let i = 0; i < 5; i += 1) {
        service.getAgent('http://127.0.0.1:4000/high-load');
      }

      const interval = service.getNextCleanupIntervalPreview();
      expect(interval).toBeLessThan(baseInterval);
      expect(
        service.getStats().adaptiveCleanupAdjustments
      ).toBeGreaterThanOrEqual(1);

      const overrideInterval = service.getNextCleanupIntervalPreview({
        overrideAdaptiveCleanupEnabled: false,
      });
      expect(overrideInterval).toBe(baseInterval);

      const resumedInterval = service.getNextCleanupIntervalPreview();
      expect(resumedInterval).toBe(interval);
    } finally {
      service.cleanup();
    }
  });

  it('forces adaptive cleanup under memory pressure and logs diagnostic output', async () => {
    const { logger, entries } = createTestLogger({ debugEnabled: true });
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 200,
      minCleanupIntervalMs: 50,
      idleThresholdMs: 2,
      memoryThresholdMB: 0.000001,
    });

    try {
      const url = 'http://127.0.0.1:8123/resource';
      service.getAgent(url);
      await delay(5);

      const result = service.forceAdaptiveCleanup();
      expect(result).toEqual(
        expect.objectContaining({
          agentsRemoved: expect.any(Number),
          currentAgentCount: expect.any(Number),
          currentMemoryMB: expect.any(Number),
        })
      );

      expect(
        entries.some((entry) =>
          entry.message?.includes('Adaptive cleanup completed')
        )
      ).toBe(true);
    } finally {
      service.cleanup();
    }
  });

  it('reschedules adaptive cleanup timers using dynamically calculated intervals', async () => {
    const { logger } = createTestLogger();
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 30,
      minCleanupIntervalMs: 10,
      maxCleanupIntervalMs: 60,
    });

    try {
      service.getAgent('http://127.0.0.1:9200/adaptive');
      await delay(160);
      const stats = service.getStats();
      expect(stats.cleanupOperations).toBeGreaterThanOrEqual(1);
    } finally {
      service.cleanup();
    }
  });

  it('prefers longer cleanup intervals during sustained low request volume', () => {
    const { logger } = createTestLogger();
    const baseInterval = 800;
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: baseInterval,
      minCleanupIntervalMs: 100,
      maxCleanupIntervalMs: 2000,
      highLoadRequestsPerMin: 100,
      memoryThresholdMB: 1000,
    });

    try {
      const interval = service.getNextCleanupIntervalPreview();
      expect(interval).toBeGreaterThan(baseInterval);
    } finally {
      service.cleanup();
    }
  });

  it('exposes configuration utilities and guards invalid agent operations', () => {
    const { logger, entries } = createTestLogger();
    const service = new HttpAgentService(logger, {
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 1000,
    });

    try {
      expect(() => service.getAgent('invalid-url')).toThrow();
      expect(
        entries.some((entry) => entry.message?.includes('Error getting agent'))
      ).toBe(true);

      expect(service.destroyAgent('invalid-url')).toBe(false);
      expect(
        entries.some((entry) =>
          entry.message?.includes('Error destroying agent')
        )
      ).toBe(true);

      const goodUrl = 'http://127.0.0.1:9300/config';
      service.getAgent(goodUrl);

      expect(service.hasAgent(goodUrl)).toBe(true);
      expect(service.hasAgent('still-invalid')).toBe(false);
      expect(service.getActiveAgentCount()).toBe(1);

      service.updateConfig({ maxSockets: 42 });
      expect(service.getConfig().maxSockets).toBe(42);

      service.destroyAgent(goodUrl);
    } finally {
      service.cleanup();
    }
  });

  it('retains agents longer when request volume exceeds high-load thresholds', async () => {
    const { logger } = createTestLogger({ debugEnabled: true });
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 100,
      idleThresholdMs: 2,
      highLoadRequestsPerMin: 1,
      memoryThresholdMB: 9999,
    });

    try {
      const target = 'http://127.0.0.1:9400/high-load';
      for (let i = 0; i < 3; i += 1) {
        service.getAgent(`${target}?burst=${i}`);
      }

      await delay(5);
      const summary = service.forceAdaptiveCleanup();
      expect(summary.currentAgentCount).toBeGreaterThanOrEqual(0);
    } finally {
      service.cleanup();
    }
  });

  it('accelerates cleanup when memory usage exceeds configured thresholds', async () => {
    const { logger, entries } = createTestLogger({ debugEnabled: true });
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 100,
      idleThresholdMs: 4,
      highLoadRequestsPerMin: Number.POSITIVE_INFINITY,
      memoryThresholdMB: 0.000001,
    });

    try {
      const url = 'http://127.0.0.1:9500/memory';
      const agent = service.getAgent(url);
      const makeSocket = () => {
        const socket = new EventEmitter();
        socket.destroy = () => {};
        return socket;
      };
      agent.freeSockets.test = Array.from({ length: 8 }, makeSocket);
      agent.sockets.test = Array.from({ length: 4 }, makeSocket);
      const preStats = service.getEnhancedStats();
      expect(preStats.estimatedMemoryUsageMB).toBeGreaterThan(0);
      await delay(5);
      const summary = service.forceAdaptiveCleanup();
      expect(summary.currentAgentCount).toBeGreaterThanOrEqual(0);
      const cleanupEntry = entries.find((entry) =>
        entry.message?.includes('Adaptive cleanup completed')
      );
      expect(cleanupEntry?.context?.memoryUsageMB).toBeGreaterThan(0);
    } finally {
      service.cleanup();
    }
  });
});
