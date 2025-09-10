/**
 * @file Integration tests for ActionTraceConfigLoader dependency injection
 * Optimized for performance using lightweight container setup
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createActionTraceConfigTestContainer,
  resetContainerForNextTest,
  createPerformanceMonitor,
  validateActionTraceConfigLoaderBasics,
  PERFORMANCE_THRESHOLDS,
} from '../../common/configuration/actionTraceConfigTestHelpers.js';

describe('ActionTraceConfigLoader - DI Integration', () => {
  let container;
  let performanceMonitor;
  let suiteStartTime;

  beforeAll(async () => {
    // Track total suite performance
    suiteStartTime = process.hrtime.bigint();

    // Create optimized container once for all tests
    performanceMonitor = createPerformanceMonitor();
    performanceMonitor.start();

    container = await createActionTraceConfigTestContainer();

    const setupTime = performanceMonitor.end();

    // Store setup time for validation in tests
    global.testSetupTime = setupTime;

    // Validate basic functionality
    validateActionTraceConfigLoaderBasics(container);

    console.debug(
      `[Test Setup] Container configured in ${setupTime.toFixed(2)}ms`
    );
  });

  beforeEach(() => {
    // Reset state between tests (much faster than recreation)
    resetContainerForNextTest(container);
  });

  afterAll(() => {
    // Report total suite performance
    const suiteEndTime = process.hrtime.bigint();
    const totalTime = Number(suiteEndTime - suiteStartTime) / 1_000_000;

    // Store total time for validation in tests
    global.testSuiteTime = totalTime;

    console.debug(`[Test Suite] Completed in ${totalTime.toFixed(2)}ms`);

    // Cleanup
    container = null;
    performanceMonitor = null;
  });

  describe('Container Resolution', () => {
    it('should resolve IActionTraceConfigLoader from DI container', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Act
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Assert performance
      const resolutionTime = monitor.end();
      expect(resolutionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SERVICE_RESOLUTION_MS
      );

      // Assert functionality
      expect(actionTraceConfigLoader).toBeDefined();
      expect(actionTraceConfigLoader).not.toBeNull();
      expect(typeof actionTraceConfigLoader.loadConfig).toBe('function');
      expect(typeof actionTraceConfigLoader.isEnabled).toBe('function');
      expect(typeof actionTraceConfigLoader.shouldTraceAction).toBe('function');
    });

    it('should resolve ITraceConfigLoader from DI container', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Act
      const traceConfigLoader = container.resolve(tokens.ITraceConfigLoader);

      // Assert performance
      const resolutionTime = monitor.end();
      expect(resolutionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SERVICE_RESOLUTION_MS
      );

      // Assert functionality
      expect(traceConfigLoader).toBeDefined();
      expect(traceConfigLoader).not.toBeNull();
      expect(typeof traceConfigLoader.loadConfig).toBe('function');
    });

    it('should resolve the same singleton instance on multiple calls', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Act
      const instance1 = container.resolve(tokens.IActionTraceConfigLoader);
      const instance2 = container.resolve(tokens.IActionTraceConfigLoader);

      // Assert performance (should be very fast due to singleton caching)
      const resolutionTime = monitor.end();
      expect(resolutionTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SERVICE_RESOLUTION_MS
      );

      // Assert functionality
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Dependencies', () => {
    it('should initialize ActionTraceConfigLoader with correct dependencies', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Act
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);

      // Assert functionality
      // The loader should be properly initialized without throwing errors
      expect(() => actionTraceConfigLoader.getStatistics()).not.toThrow();
      expect(typeof actionTraceConfigLoader.resetStatistics).toBe('function');
    });

    it('should have all required dependencies available', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Act & Assert - These should all resolve without throwing
      expect(() => container.resolve(tokens.ITraceConfigLoader)).not.toThrow();
      expect(() => container.resolve(tokens.ISchemaValidator)).not.toThrow();
      expect(() => container.resolve(tokens.ILogger)).not.toThrow();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);
    });
  });

  describe('Configuration Loading Integration', () => {
    it('should load configuration via DI-resolved dependencies', async () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const configResult = await actionTraceConfigLoader.loadConfig();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);

      // Assert functionality
      expect(configResult).toBeDefined();
      // Should not throw errors even if config file doesn't exist
      // (it should return default configuration)
    });

    it('should check if tracing is enabled via DI', async () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const isEnabled = await actionTraceConfigLoader.isEnabled();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);

      // Assert functionality
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should validate patterns using DI-resolved dependencies', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act & Assert
      expect(() =>
        actionTraceConfigLoader.testPattern('core:*', 'core:action')
      ).not.toThrow();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);
    });
  });

  describe('Performance and Monitoring Integration', () => {
    it('should provide statistics via DI integration', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const stats = actionTraceConfigLoader.getStatistics();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);

      // Assert functionality
      expect(stats).toBeDefined();
      expect(typeof stats.exactMatches).toBe('number');
      expect(typeof stats.wildcardMatches).toBe('number');
      expect(typeof stats.totalLookups).toBe('number');
    });

    it('should provide cache info via DI integration', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act
      const stats = actionTraceConfigLoader.getStatistics();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);

      // Assert functionality
      expect(stats).toBeDefined();
      expect(stats.cacheTtl).toBeDefined();
      expect(typeof stats.cacheStatus).toBe('string');
      expect(typeof stats.cacheAge).toBe('number');
    });
  });

  describe('Error Handling with DI', () => {
    it('should handle configuration loading errors gracefully', async () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Arrange
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );

      // Act & Assert
      // Should not throw even with invalid configuration attempts
      await expect(actionTraceConfigLoader.loadConfig()).resolves.toBeDefined();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);
    });

    it('should handle dependency failures gracefully during resolution', () => {
      // Performance monitoring
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Act & Assert
      // The container should resolve the service even if some dependencies have issues
      expect(() =>
        container.resolve(tokens.IActionTraceConfigLoader)
      ).not.toThrow();

      // Assert performance
      const operationTime = monitor.end();
      expect(operationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_TEST_MS);
    });
  });
});
