/**
 * @file Memory tests for ActionCategorizationService
 * @description Tests memory usage patterns of action categorization operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('ActionCategorizationService - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  let container;
  let categorizationService;

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();

    // Set up container and service
    container = new AppContainer();
    const registrar = new Registrar(container);

    // Register logger first (required by action categorization service)
    const appLogger = new ConsoleLogger(LogLevel.ERROR);
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
      includeGameSystems: false,
      includeUI: false,
      includeCharacterBuilder: false,
    });

    categorizationService = container.resolve(
      tokens.IActionCategorizationService
    );
  });

  afterEach(async () => {
    // Clean up references
    categorizationService = null;
    container = null;

    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('memory efficiency during repeated operations', () => {
    it('should not leak memory during repeated categorization operations', async () => {
      const actionCount = global.memoryTestUtils.isCI() ? 15 : 20;
      const iterationCount = global.memoryTestUtils.isCI() ? 800 : 1000;

      // Create test actions
      const actions = Array.from({ length: actionCount }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 5}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Perform many operations to test for memory leaks
      for (let i = 0; i < iterationCount; i++) {
        categorizationService.shouldUseGrouping(actions);
        if (i % 2 === 0) {
          categorizationService.groupActionsByNamespace(actions);
        }
        categorizationService.extractNamespace(
          actions[i % actions.length].actionId
        );
      }

      // Allow memory to stabilize after operations
      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Clear references and force cleanup
      actions.length = 0;
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate memory metrics
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryRetained = Math.max(0, finalMemory - baselineMemory);
      const memoryThreshold = global.memoryTestUtils.getMemoryThreshold(5); // 5MB base threshold for container setup

      // Memory growth should be minimal
      expect(memoryGrowth).toBeLessThan(memoryThreshold);

      // Memory should be properly released after cleanup
      expect(memoryRetained).toBeLessThan(memoryThreshold * 0.2); // Max 20% retention

      // Log memory metrics for debugging
      if (process.env.DEBUG_MEMORY) {
        console.log('Memory metrics:', {
          baselineMemory: `${(baselineMemory / 1024 / 1024).toFixed(2)}MB`,
          peakMemory: `${(peakMemory / 1024 / 1024).toFixed(2)}MB`,
          finalMemory: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
          memoryGrowth: `${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
          memoryRetained: `${(memoryRetained / 1024 / 1024).toFixed(2)}MB`,
          threshold: `${(memoryThreshold / 1024 / 1024).toFixed(2)}MB`,
        });
      }
    });

    it('should maintain consistent memory usage with varying action counts', async () => {
      const testConfigs = [
        { actionCount: 5, iterations: 200 },
        { actionCount: 10, iterations: 200 },
        { actionCount: 20, iterations: 200 },
        { actionCount: 50, iterations: 200 },
      ];

      const memoryUsagePerAction = [];

      for (const config of testConfigs) {
        // Create test actions
        const actions = Array.from({ length: config.actionCount }, (_, i) => ({
          index: i + 1,
          actionId: `mod${i % 7}:action${i}`,
          commandString: `cmd${i}`,
          description: `Description ${i}`,
        }));

        // Establish baseline
        await global.memoryTestUtils.forceGCAndWait();
        const baseline = await global.memoryTestUtils.getStableMemoryUsage();

        // Perform operations
        for (let i = 0; i < config.iterations; i++) {
          categorizationService.shouldUseGrouping(actions);
          categorizationService.groupActionsByNamespace(actions);
        }

        // Measure peak usage
        const peak = await global.memoryTestUtils.getStableMemoryUsage();
        const totalGrowth = peak - baseline;
        const growthPerAction = totalGrowth / config.actionCount;

        memoryUsagePerAction.push(growthPerAction);

        // Cleanup
        actions.length = 0;
        await global.memoryTestUtils.forceGCAndWait();
      }

      // Memory usage per action should be relatively consistent
      const avgMemoryPerAction =
        memoryUsagePerAction.reduce((a, b) => a + b) /
        memoryUsagePerAction.length;

      memoryUsagePerAction.forEach((usage) => {
        const deviation = Math.abs(usage - avgMemoryPerAction);
        const deviationPercent = (deviation / avgMemoryPerAction) * 100;

        // Memory usage per action should not vary by more than 75%
        // This is higher tolerance due to container initialization overhead
        expect(deviationPercent).toBeLessThan(75);
      });
    });
  });
});