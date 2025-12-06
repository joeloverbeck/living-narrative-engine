import { describe, expect, it, jest } from '@jest/globals';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

import HttpAgentService from '../../src/services/httpAgentService.js';

/**
 * Creates a capturing logger for assertions.
 * @returns {{
 *   logger: import('../../src/interfaces/coreServices.js').ILogger & { isDebugEnabled: boolean },
 *   entries: Array<{ level: string, message: string, context?: object }>
 * }}
 */
const createCapturingLogger = () => {
  const entries = [];
  return {
    entries,
    logger: {
      info: (message, context) =>
        entries.push({ level: 'info', message, context }),
      warn: (message, context) =>
        entries.push({ level: 'warn', message, context }),
      error: (message, context) =>
        entries.push({ level: 'error', message, context }),
      debug: (message, context) =>
        entries.push({ level: 'debug', message, context }),
      isDebugEnabled: true,
    },
  };
};

describe('HttpAgentService integration edge coverage', () => {
  it('requires a logger instance for construction', () => {
    expect(() => {
      // @ts-expect-error intentional invalid usage to exercise guard clause
      return new HttpAgentService();
    }).toThrow('Logger is required');
  });

  it('manages real sockets, adaptive previews, and cleanup orchestration', async () => {
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('Connection', 'keep-alive');
      res.end('ok');
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = /** @type {{ port: number }} */ (server.address());
    const targetUrl = `http://127.0.0.1:${port}/resource`;

    const { logger, entries } = createCapturingLogger();
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: 200,
      minCleanupIntervalMs: 50,
      maxCleanupIntervalMs: 800,
      idleThresholdMs: 50,
      memoryThresholdMB: 0.001,
      highLoadRequestsPerMin: 2,
    });

    try {
      const executeRequest = () =>
        new Promise((resolve, reject) => {
          const request = http.request(
            targetUrl,
            {
              ...service.getFetchOptions(targetUrl),
              method: 'GET',
              headers: {
                Connection: 'keep-alive',
              },
            },
            (response) => {
              response.on('error', reject);
              response.resume();
              response.on('end', resolve);
            }
          );

          request.on('error', reject);
          request.end();
        });

      await executeRequest();
      await executeRequest();

      for (let burst = 0; burst < 5; burst += 1) {
        service.getAgent(targetUrl);
      }

      await delay(20); // allow agent bookkeeping to settle

      const agent = service.getAgent(targetUrl);
      const freePoolKeys = Object.keys(agent.freeSockets || {});
      expect(freePoolKeys.length).toBeGreaterThan(0);
      const reuseCandidate = agent.freeSockets[freePoolKeys[0]]?.[0];
      expect(reuseCandidate).toBeDefined();
      const monitorListener = agent
        .listeners('socket')
        .find((listener) => typeof listener === 'function');
      expect(monitorListener).toBeDefined();
      monitorListener?.(reuseCandidate);
      reuseCandidate.emit('agentRemove');

      agent.sockets = agent.sockets || Object.create(null);
      agent.sockets[`active:${freePoolKeys[0]}`] = [reuseCandidate];

      const stats = service.getStats();
      expect(stats.agentDetails[0].freeSockets).toBeGreaterThanOrEqual(1);
      expect(stats.socketsReused).toBeGreaterThanOrEqual(1);

      expect(
        entries.some(
          (entry) =>
            entry.level === 'debug' &&
            typeof entry.message === 'string' &&
            entry.message.includes('Socket reused')
        )
      ).toBe(true);

      const enhancedStats = service.getEnhancedStats();
      expect(enhancedStats.estimatedMemoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(
        enhancedStats.agentDetails[0].activeSockets
      ).toBeGreaterThanOrEqual(1);

      const basePreview = service.getNextCleanupIntervalPreview({
        overrideAdaptiveCleanupEnabled: false,
      });
      expect(basePreview).toBe(service.getConfig().baseCleanupIntervalMs);

      for (let index = 0; index < 55; index += 1) {
        const extraPort = 41000 + index;
        service.getAgent(`http://127.0.0.1:${extraPort}/synthetic-${index}`);
      }

      const adjustedPreview = service.getNextCleanupIntervalPreview();
      expect(typeof adjustedPreview).toBe('number');
      expect(
        entries.some(
          (entry) =>
            entry.level === 'debug' &&
            typeof entry.message === 'string' &&
            entry.message.includes('many-agents') &&
            entry.message.includes('high-load') &&
            entry.message.includes('high-memory')
        )
      ).toBe(true);

      expect(service.destroyAgent(targetUrl)).toBe(true);
      expect(service.destroyAgent(targetUrl)).toBe(false);
      expect(service.destroyAgent('invalid-url')).toBe(false);

      service.getAgent('http://127.0.0.1:6553/final-check');
      service.destroyAll();
      expect(service.getActiveAgentCount()).toBe(0);
    } finally {
      service.cleanup();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('falls back to interval-based cleanup when adaptive mode is disabled', async () => {
    const { logger } = createCapturingLogger();
    const intervalSpy = jest.spyOn(global, 'setInterval');
    const service = new HttpAgentService(logger, {
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 5,
      minCleanupIntervalMs: 5,
      maxCleanupIntervalMs: 10,
    });

    try {
      const preview = service.getNextCleanupIntervalPreview();
      expect(preview).toBe(5);
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5);
      await delay(25);
    } finally {
      service.cleanup();
      intervalSpy.mockRestore();
    }
  });
});
