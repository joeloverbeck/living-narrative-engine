import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

/**
 * Additional coverage for PerformanceMonitor's browser-compatible fallback behavior.
 */
describe('PerformanceMonitor environment fallbacks', () => {
  let originalProcess;

  beforeEach(() => {
    originalProcess = global.process;
    delete global.process;
    jest.resetModules();
  });

  afterEach(() => {
    if (originalProcess) {
      global.process = originalProcess;
    } else {
      delete global.process;
    }
    jest.resetModules();
  });

  it('should use fallback memoryUsage implementation when process is unavailable', async () => {
    const logger = createMockLogger();

    await jest.isolateModulesAsync(async () => {
      const { default: PerformanceMonitor } = await import(
        '../../../../src/entities/monitoring/PerformanceMonitor.js'
      );
      const monitor = new PerformanceMonitor({ logger });

      expect(() => monitor.checkMemoryUsage()).not.toThrow();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(monitor.getMetrics().memoryUsageWarnings).toBe(0);
    });
  });
});
