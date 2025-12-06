import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import http from 'node:http';

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
    // eslint-disable-next-line no-await-in-loop
    await delay(stepMs);
  }
};

const createTestLogger = () => {
  const entries = [];
  const push = (level) => (message, context) =>
    entries.push({ level, message, context });
  return {
    logger: {
      debug: jest.fn(push('debug')),
      info: jest.fn(push('info')),
      warn: jest.fn(push('warn')),
      error: jest.fn(push('error')),
      get isDebugEnabled() {
        return true;
      },
    },
    entries,
  };
};

const createTestServer = () => {
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/slow')) {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('slow');
      }, 200);
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

  return server;
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
        path: parsed.pathname + parsed.search,
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

describe('HttpAgentService mixed socket diagnostics integration', () => {
  /** @type {http.Server} */
  let server;
  /** @type {string} */
  let baseUrl;

  beforeEach(async () => {
    server = createTestServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address && typeof address !== 'string') {
      baseUrl = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error('Failed to bind test server');
    }
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('surfaces live and idle socket metrics while coordinating adaptive cleanup decisions', async () => {
    const { logger, entries } = createTestLogger();
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 500,
      minCleanupIntervalMs: 100,
      maxCleanupIntervalMs: 1000,
      idleThresholdMs: 50,
      highLoadRequestsPerMin: 1,
      memoryThresholdMB: 0.00001,
    });

    try {
      const slowPromise = sendRequestThroughService(service, `${baseUrl}/slow`);
      await delay(20);

      await sendRequestThroughService(service, `${baseUrl}/fast-a`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      });
      await sendRequestThroughService(service, `${baseUrl}/fast-b`);

      await waitForCondition(() => {
        const stats = service.getStats();
        const detail = stats.agentDetails[0];
        return Boolean(detail && detail.activeSockets >= 1);
      });

      const activeSnapshot = service.getEnhancedStats();
      expect(activeSnapshot.estimatedMemoryUsageMB).toBeGreaterThan(0);
      expect(activeSnapshot.adaptiveCleanup.enabled).toBe(true);

      expect(service.hasAgent(`${baseUrl}/fast-b`)).toBe(true);
      expect(service.hasAgent('://bad-url')).toBe(false);

      const previewInterval = service.getNextCleanupIntervalPreview({
        overrideAdaptiveCleanupEnabled: false,
      });
      expect(previewInterval).toBe(500);

      await slowPromise;
      await waitForCondition(() => {
        const stats = service.getStats();
        const detail = stats.agentDetails[0];
        return Boolean(detail && detail.freeSockets >= 1);
      });

      const idleSnapshot = service.getEnhancedStats();
      expect(idleSnapshot.estimatedMemoryUsageMB).toBeGreaterThan(0);

      await delay(15);
      const cleaned = service.cleanupIdleAgents(5);
      expect(cleaned).toBeGreaterThanOrEqual(1);

      expect(
        entries.some((entry) =>
          entry.message?.includes('Cleaned up idle agent')
        )
      ).toBe(true);
      expect(service.hasAgent(`${baseUrl}/fast-a`)).toBe(false);

      service.getFetchOptions(`${baseUrl}/recreated`);
      const forced = service.forceAdaptiveCleanup();
      expect(forced.currentAgentCount).toBe(service.getActiveAgentCount());
      expect(forced.currentMemoryMB).toBeGreaterThanOrEqual(0);
    } finally {
      service.cleanup();
    }
  });
});
