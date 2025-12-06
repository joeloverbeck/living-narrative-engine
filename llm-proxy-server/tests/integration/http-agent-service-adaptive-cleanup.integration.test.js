/**
 * @file http-agent-service-adaptive-cleanup.integration.test.js
 * @description Additional integration coverage for HttpAgentService focusing on
 *              adaptive cleanup heuristics and fixed-interval fallbacks.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';

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

function drainTimers() {
  jest.runOnlyPendingTimers();
  jest.clearAllTimers();
}

describe('HttpAgentService adaptive cleanup integration depth', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('tightens cleanup cadence under sustained load with many pooled agents', async () => {
    jest.useFakeTimers();
    const logger = createTestLogger();
    const service = new HttpAgentService(logger, {
      keepAlive: true,
      baseCleanupIntervalMs: 50,
      minCleanupIntervalMs: 10,
      maxCleanupIntervalMs: 200,
      idleThresholdMs: 500,
      highLoadRequestsPerMin: 5,
      memoryThresholdMB: 0.00001,
    });

    try {
      const basePort = 4100;
      for (let i = 0; i < 55; i += 1) {
        service.getFetchOptions(`http://127.0.0.1:${basePort + i}/resource`);
      }

      for (let i = 0; i < 10; i += 1) {
        service.getFetchOptions(`http://127.0.0.1:${basePort}/resource`);
      }

      jest.advanceTimersByTime(60);
      await Promise.resolve();

      const adjustmentCall = logger.debug.mock.calls.find(([message]) =>
        message.includes('Adaptive cleanup interval adjusted')
      );

      expect(adjustmentCall).toBeDefined();
      expect(adjustmentCall[0]).toContain('high-load');
      expect(adjustmentCall[0]).toContain('high-memory');
      expect(adjustmentCall[0]).toContain('many-agents');

      const forced = service.forceAdaptiveCleanup();
      expect(forced.currentAgentCount).toBe(service.getActiveAgentCount());
      expect(forced.agentsRemoved).toBeGreaterThanOrEqual(0);
    } finally {
      service.cleanup();
      drainTimers();
    }
  });

  it('extends cleanup interval when load is light and agent pool is sparse', async () => {
    jest.useFakeTimers();
    const logger = createTestLogger();
    const service = new HttpAgentService(logger, {
      keepAlive: true,
      baseCleanupIntervalMs: 80,
      minCleanupIntervalMs: 20,
      maxCleanupIntervalMs: 200,
      idleThresholdMs: 5,
      highLoadRequestsPerMin: 100,
      memoryThresholdMB: 999,
    });

    try {
      const basePort = 5100;
      for (let i = 0; i < 2; i += 1) {
        service.getFetchOptions(`http://localhost:${basePort + i}/status`);
      }

      jest.advanceTimersByTime(90);
      await Promise.resolve();

      const adjustmentCall = logger.debug.mock.calls.find(([message]) =>
        message.includes('Adaptive cleanup interval adjusted')
      );

      expect(adjustmentCall).toBeDefined();
      expect(adjustmentCall[0]).toContain('low-load');
      expect(adjustmentCall[0]).toContain('few-agents');

      const cleaned = service.cleanupIdleAgents(0);
      expect(cleaned).toBeGreaterThanOrEqual(0);
    } finally {
      service.cleanup();
      drainTimers();
    }
  });

  it('falls back to fixed scheduling and manual lifecycle controls when adaptive cleanup is disabled', () => {
    jest.useFakeTimers();
    const logger = createTestLogger();
    const service = new HttpAgentService(logger, {
      keepAlive: true,
      baseCleanupIntervalMs: 50,
      adaptiveCleanupEnabled: false,
    });

    try {
      service.getFetchOptions('http://localhost:6200/a');
      service.getFetchOptions('http://localhost:6201/b');

      jest.advanceTimersByTime(60);

      expect(service.getActiveAgentCount()).toBeGreaterThanOrEqual(2);

      service.destroyAll();
      expect(service.getActiveAgentCount()).toBe(0);
      expect(
        logger.info.mock.calls.some(([message]) =>
          message.includes('Destroyed all')
        )
      ).toBe(true);

      expect(service.destroyAgent('://not-a-url')).toBe(false);
      expect(service.hasAgent('://still-not-a-url')).toBe(false);

      service.cleanup();
      expect(
        logger.info.mock.calls.some(([message]) =>
          message.includes('Cleared adaptive cleanup timer')
        )
      ).toBe(true);
    } finally {
      drainTimers();
    }
  });
});
