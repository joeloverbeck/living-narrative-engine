/**
 * @file Performance Integration Tests
 * Tests performance under realistic integration scenarios
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../src/logging/consoleLogger.js';
import { ActionCategorizationPerformanceMonitor } from '../../src/utils/monitoring/actionCategorizationPerformanceMonitor.js';

describe('Performance Integration Tests', () => {
  let container;
  let service;
  let monitor;

  beforeEach(() => {
    // Create container with action categorization support
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Register logger first (required by action categorization service)
    const appLogger = new ConsoleLogger(LogLevel.ERROR); // Use ERROR level to reduce noise
    registrar.instance(tokens.ILogger, appLogger);

    // Register required dependencies for base container
    container.register(
      tokens.ISafeEventDispatcher,
      { dispatch: jest.fn() },
      { lifecycle: 'singleton' }
    );

    container.register(
      tokens.IValidatedEventDispatcher,
      { dispatch: jest.fn() },
      { lifecycle: 'singleton' }
    );

    // Configure base container which includes action categorization
    configureBaseContainer(container, {
      includeGameSystems: false, // Minimal setup for testing
      includeUI: false,
      includeCharacterBuilder: false,
    });

    service = container.resolve(tokens.IActionCategorizationService);

    monitor = new ActionCategorizationPerformanceMonitor({
      logger: appLogger,
      config: {
        enabled: true,
        slowOperationThreshold: 5,
        memoryCheckInterval: 50,
        reportInterval: 100,
      },
    });
  });

  afterEach(() => {
    if (container && container.dispose) {
      container.dispose();
    }
  });

  describe('Real-World Performance Scenarios', () => {
    it('should handle typical game session performance', () => {
      // Simulate a typical game session with varying action counts
      const scenarios = [
        { actionCount: 3, iterations: 50 }, // Early game
        { actionCount: 8, iterations: 100 }, // Mid game
        { actionCount: 15, iterations: 75 }, // Late game
        { actionCount: 25, iterations: 25 }, // Complex scenarios
      ];

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['core', 'intimacy', 'clothing', 'anatomy'],
        showCounts: false,
      };

      let totalOperations = 0;
      const startTime = performance.now();

      scenarios.forEach((scenario) => {
        const actions = Array.from(
          { length: scenario.actionCount },
          (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 4}:action${i}`,
            commandString: `command ${i}`,
            description: `Description ${i}`,
          })
        );

        for (let i = 0; i < scenario.iterations; i++) {
          monitor.monitorOperation('shouldUseGrouping', () =>
            service.shouldUseGrouping(actions)
          );

          if (i % 3 === 0) {
            // Not every operation needs grouping
            monitor.monitorOperation('groupActionsByNamespace', () =>
              service.groupActionsByNamespace(actions)
            );
          }

          totalOperations++;
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerOperation = totalTime / totalOperations;

      expect(avgTimePerOperation).toBeLessThan(10); // <10ms per operation
      console.log(
        `Game session simulation: ${avgTimePerOperation.toFixed(2)}ms avg per operation`
      );

      const metrics = monitor.getMetrics();
      expect(metrics.memory.memoryIncrease).toBeLessThan(5 * 1024 * 1024); // <5MB (test environment)
    });

    it('should handle concurrent user interactions efficiently', () => {
      const actions = Array.from({ length: 12 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 5}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['namespace0', 'namespace1', 'namespace2'],
        showCounts: false,
      };

      // Simulate concurrent operations (UI + LLM processing)
      const concurrentOperations = 50;
      const operations = [];

      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          // UI operation
          Promise.resolve().then(() =>
            monitor.monitorOperation('ui_shouldUseGrouping', () =>
              service.shouldUseGrouping(actions)
            )
          ),
          // LLM operation
          Promise.resolve().then(() =>
            monitor.monitorOperation('llm_groupActionsByNamespace', () =>
              service.groupActionsByNamespace(actions)
            )
          )
        );
      }

      return Promise.all(operations).then(() => {
        const metrics = monitor.getMetrics();

        // Both UI and LLM operations should be fast
        expect(
          metrics.operations.ui_shouldUseGrouping?.averageTime || 0
        ).toBeLessThan(5);
        expect(
          metrics.operations.llm_groupActionsByNamespace?.averageTime || 0
        ).toBeLessThan(15);
      });
    });

    it('should maintain performance under stress conditions', () => {
      // Stress test with large action sets and rapid operations
      const largeActions = Array.from({ length: 100 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 20}:action${i}`,
        commandString: `command ${i}`,
        description: `Detailed description for action ${i} with comprehensive information about the action mechanics and context.`,
      }));

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: Array.from({ length: 10 }, (_, i) => `namespace${i}`),
        showCounts: false,
      };

      const stressIterations = 200;
      const startTime = performance.now();

      for (let i = 0; i < stressIterations; i++) {
        if (i % 10 === 0) {
          monitor.monitorOperation('stress_shouldUseGrouping', () =>
            service.shouldUseGrouping(largeActions)
          );
        }

        if (i % 20 === 0) {
          monitor.monitorOperation('stress_groupActionsByNamespace', () =>
            service.groupActionsByNamespace(largeActions)
          );
        }

        // Simulate other operations
        monitor.monitorOperation('stress_extractNamespace', () =>
          service.extractNamespace(
            largeActions[i % largeActions.length].actionId
          )
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(5000); // <5 seconds total
      console.log(`Stress test completed in: ${totalTime.toFixed(2)}ms`);

      const metrics = monitor.getMetrics();
      expect(metrics.errors.count).toBe(0);
      expect(metrics.memory.memoryIncrease).toBeLessThan(5 * 1024 * 1024); // <5MB
    });
  });

  describe('Performance Degradation Detection', () => {
    it('should detect performance degradation patterns', () => {
      const baselineActions = Array.from({ length: 10 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 3}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['namespace0', 'namespace1', 'namespace2'],
        showCounts: false,
      };

      // Establish baseline
      const baselineIterations = 100;
      const baselineTimes = [];

      for (let i = 0; i < baselineIterations; i++) {
        const startTime = performance.now();
        service.shouldUseGrouping(baselineActions);
        const endTime = performance.now();
        baselineTimes.push(endTime - startTime);
      }

      const baselineAvg =
        baselineTimes.reduce((sum, time) => sum + time, 0) /
        baselineTimes.length;

      // Test with progressively larger datasets
      const testCases = [15, 25, 50, 100];

      testCases.forEach((actionCount) => {
        const testActions = Array.from({ length: actionCount }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 6}:action${i}`,
          commandString: `command ${i}`,
          description: `Description ${i}`,
        }));

        const testIterations = 50;
        const testTimes = [];

        for (let i = 0; i < testIterations; i++) {
          const startTime = performance.now();
          service.shouldUseGrouping(testActions);
          const endTime = performance.now();
          testTimes.push(endTime - startTime);
        }

        const testAvg =
          testTimes.reduce((sum, time) => sum + time, 0) / testTimes.length;
        const degradationRatio = testAvg / baselineAvg;

        // Performance should scale reasonably
        expect(degradationRatio).toBeLessThan((actionCount / 10) * 2); // Reasonable scaling
        console.log(
          `${actionCount} actions: ${testAvg.toFixed(2)}ms avg (${degradationRatio.toFixed(2)}x baseline)`
        );
      });
    });
  });
});
