import { describe, expect, it } from '@jest/globals';

import HttpAgentService from '../../src/services/httpAgentService.js';

const createTestLogger = () => {
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
      isDebugEnabled: false,
    },
    entries,
  };
};

describe('HttpAgentService integration neutral balance coverage', () => {
  it('maintains base cleanup intervals when load and memory metrics stay neutral', () => {
    const { logger } = createTestLogger();
    const baseInterval = 60_000;
    const service = new HttpAgentService(logger, {
      baseCleanupIntervalMs: baseInterval,
      minCleanupIntervalMs: 15_000,
      maxCleanupIntervalMs: 120_000,
      highLoadRequestsPerMin: 100,
      memoryThresholdMB: 1_000,
    });

    try {
      const trackedPorts = [];
      for (let port = 8300; port < 8312; port += 1) {
        trackedPorts.push(port);
        service.getAgent(`http://127.0.0.1:${port}/neutral`);
      }

      for (let i = 0; i < 18; i += 1) {
        const port = trackedPorts[i % trackedPorts.length];
        service.getAgent(`http://127.0.0.1:${port}/reuse-${i}`);
      }

      const neutralStats = service.getStats();
      expect(neutralStats.activeAgents).toBeGreaterThanOrEqual(
        trackedPorts.length
      );

      const idleCleaned = service.cleanupIdleAgents(Number.MAX_SAFE_INTEGER);
      expect(idleCleaned).toBe(0);

      expect(service.hasAgent('definitely-not-a-url')).toBe(false);

      const previewInterval = service.getNextCleanupIntervalPreview();
      expect(previewInterval).toBe(baseInterval);

      const statsAfterPreview = service.getStats();
      expect(statsAfterPreview.adaptiveCleanupAdjustments).toBe(0);

      service.cleanup();
    } finally {
      service.cleanup();
    }
  });
});
