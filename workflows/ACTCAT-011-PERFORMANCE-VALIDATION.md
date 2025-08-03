# ACTCAT-011: Performance Validation and Optimization

## Overview

Conduct comprehensive performance validation of the action categorization system to ensure it meets performance targets and doesn't negatively impact the user experience. This includes benchmarking, optimization, and performance monitoring setup.

## Priority

**HIGH** - Critical for production readiness

## Dependencies

- **Blocks**: ACTCAT-005 (LLM prompt enhancement)
- **Blocks**: ACTCAT-009 (UI renderer refactoring)
- **Blocks**: ACTCAT-010 (Regression testing)

## Acceptance Criteria

- [ ] Performance benchmarks establish baseline and targets
- [ ] Service operations meet performance targets (<5ms overhead)
- [ ] UI rendering maintains current performance (±5%)
- [ ] LLM prompt generation overhead <10ms
- [ ] Memory usage stable (no leaks, <100KB overhead)
- [ ] Large dataset performance acceptable (50+ actions)
- [ ] Performance monitoring and alerting implemented
- [ ] Optimization recommendations documented

## Implementation Steps

### Step 1: Performance Benchmarking Suite

**File**: `tests/performance/actionCategorizationBenchmarks.test.js`

```javascript
/**
 * @file Action Categorization Performance Benchmarks
 * Comprehensive performance testing and validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';
import AIPromptContentProvider from '../../../src/prompting/AIPromptContentProvider.js';
import ActionButtonsRenderer from '../../../src/domUI/actionButtonsRenderer.js';
import { JSDOM } from 'jsdom';

describe('Action Categorization Performance Benchmarks', () => {
  let container;
  let service;
  let promptProvider;
  let uiRenderer;
  let dom;

  beforeEach(() => {
    // Set up JSDOM for UI testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body><div id="actions-container"></div></body></html>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    container = createTestContainerWithActionCategorization();
    service = container.resolve('IActionCategorizationService');

    promptProvider = new AIPromptContentProvider({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      promptStaticContentService: {
        getCoreTaskDescriptionText: () => 'Core task',
        getCharacterPortrayalGuidelines: () => 'Guidelines',
        getNc21ContentPolicyText: () => 'Policy',
        getFinalLlmInstructionText: () => 'Instructions',
      },
      perceptionLogFormatter: { format: () => 'Log' },
      gameStateValidationService: { validate: () => ({ isValid: true }) },
      actionCategorizationService: service,
    });

    uiRenderer = new ActionButtonsRenderer({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      documentContext: dom.window.document,
      validatedEventDispatcher: { dispatch: jest.fn(), subscribe: jest.fn() },
      domElementFactory: {
        createElement: (tag) => dom.window.document.createElement(tag),
        createButton: (text) => {
          const btn = dom.window.document.createElement('button');
          btn.textContent = text;
          return btn;
        },
      },
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: service,
    });
  });

  afterEach(() => {
    dom.window.close();
    if (container && container.dispose) {
      container.dispose();
    }
  });

  describe('Service Method Benchmarks', () => {
    it('should extract namespaces within performance targets', () => {
      const testCases = [
        'core:wait',
        'intimacy:kiss_passionately',
        'clothing:remove_all_clothing',
        'anatomy:examine_detailed',
        'sex:initiate_intimate_encounter',
        'unknown_namespace_with_long_name:complex_action_name',
      ];

      const iterations = 10000;
      const results = [];

      testCases.forEach((actionId) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          service.extractNamespace(actionId);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;
        results.push({ actionId, avgTime });

        expect(avgTime).toBeLessThan(0.01); // <0.01ms per extraction
      });

      console.log('Namespace extraction benchmarks:', results);
    });

    it('should make grouping decisions within performance targets', () => {
      const testDataSets = [
        {
          name: 'Small dataset (10 actions)',
          actions: Array.from({ length: 10 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 3}:action${i}`,
            commandString: `command ${i}`,
            description: `Description ${i}`,
          })),
        },
        {
          name: 'Medium dataset (25 actions)',
          actions: Array.from({ length: 25 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 6}:action${i}`,
            commandString: `command ${i}`,
            description: `Description ${i}`,
          })),
        },
        {
          name: 'Large dataset (50 actions)',
          actions: Array.from({ length: 50 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 10}:action${i}`,
            commandString: `command ${i}`,
            description: `Description ${i}`,
          })),
        },
      ];

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['namespace0', 'namespace1', 'namespace2'],
        showCounts: false,
      };

      const iterations = 1000;

      testDataSets.forEach((dataset) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          service.shouldUseGrouping(dataset.actions, config);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;

        expect(avgTime).toBeLessThan(2); // <2ms per decision
        console.log(
          `${dataset.name} grouping decision: ${avgTime.toFixed(4)}ms avg`
        );
      });
    });

    it('should group actions within performance targets', () => {
      const testDataSets = [
        {
          name: 'Typical game scenario (15 actions, 5 namespaces)',
          actions: Array.from({ length: 15 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 5}:action${i}`,
            commandString: `command ${i}`,
            description: `Description for action number ${i}`,
          })),
        },
        {
          name: 'Complex scenario (30 actions, 8 namespaces)',
          actions: Array.from({ length: 30 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 8}:action${i}`,
            commandString: `command ${i}`,
            description: `Description for action number ${i}`,
          })),
        },
        {
          name: 'Stress test (100 actions, 15 namespaces)',
          actions: Array.from({ length: 100 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 15}:action${i}`,
            commandString: `command ${i}`,
            description: `Description for action number ${i}`,
          })),
        },
      ];

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: [
          'namespace0',
          'namespace1',
          'namespace2',
          'namespace3',
          'namespace4',
        ],
        showCounts: false,
      };

      const iterations = 100;

      testDataSets.forEach((dataset) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          service.groupActionsByNamespace(dataset.actions, config);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;

        const maxTime = dataset.actions.length <= 30 ? 10 : 25; // Scale with complexity
        expect(avgTime).toBeLessThan(maxTime);
        console.log(`${dataset.name} grouping: ${avgTime.toFixed(4)}ms avg`);
      });
    });

    it('should sort namespaces efficiently', () => {
      const testCases = [
        {
          name: 'Small namespace set (5 namespaces)',
          namespaces: [
            'namespace4',
            'namespace1',
            'namespace0',
            'unknown',
            'namespace2',
          ],
        },
        {
          name: 'Medium namespace set (15 namespaces)',
          namespaces: Array.from(
            { length: 15 },
            (_, i) => `namespace${i}`
          ).reverse(),
        },
        {
          name: 'Large namespace set (50 namespaces)',
          namespaces: Array.from(
            { length: 50 },
            (_, i) => `namespace${i}`
          ).sort(() => Math.random() - 0.5),
        },
      ];

      const config = {
        namespaceOrder: [
          'namespace0',
          'namespace1',
          'namespace2',
          'namespace3',
          'namespace4',
        ],
      };

      const iterations = 1000;

      testCases.forEach((testCase) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          service.getSortedNamespaces(testCase.namespaces, config);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;

        expect(avgTime).toBeLessThan(1); // <1ms per sort
        console.log(`${testCase.name} sorting: ${avgTime.toFixed(4)}ms avg`);
      });
    });
  });

  describe('LLM Prompt Performance', () => {
    it('should generate prompts within performance targets', () => {
      const testGameStates = [
        {
          name: 'Typical scenario (12 actions)',
          gameState: {
            availableActions: Array.from({ length: 12 }, (_, i) => ({
              index: i + 1,
              actionId: `namespace${i % 4}:action${i}`,
              commandString: `command ${i}`,
              description: `Description for action ${i} with some detail about what it does.`,
            })),
          },
        },
        {
          name: 'Complex scenario (25 actions)',
          gameState: {
            availableActions: Array.from({ length: 25 }, (_, i) => ({
              index: i + 1,
              actionId: `namespace${i % 7}:action${i}`,
              commandString: `command ${i}`,
              description: `Detailed description for action ${i} explaining the full context and implications.`,
            })),
          },
        },
        {
          name: 'Large scenario (50 actions)',
          gameState: {
            availableActions: Array.from({ length: 50 }, (_, i) => ({
              index: i + 1,
              actionId: `namespace${i % 12}:action${i}`,
              commandString: `command ${i}`,
              description: `Comprehensive description for action ${i} with extensive detail about mechanics.`,
            })),
          },
        },
      ];

      const iterations = 50;

      testGameStates.forEach((test) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          promptProvider.getAvailableActionsInfoContent(test.gameState);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;

        const maxTime = test.gameState.availableActions.length <= 25 ? 15 : 30;
        expect(avgTime).toBeLessThan(maxTime);
        console.log(
          `${test.name} prompt generation: ${avgTime.toFixed(4)}ms avg`
        );
      });
    });

    it('should handle categorization overhead efficiently', () => {
      const gameState = {
        availableActions: Array.from({ length: 20 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 5}:action${i}`,
          commandString: `command ${i}`,
          description: `Description ${i}.`,
        })),
      };

      // Measure categorized vs non-categorized (simulated) overhead
      const iterations = 100;

      // Categorized format (current implementation)
      const categorizedStartTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        promptProvider.getAvailableActionsInfoContent(gameState);
      }
      const categorizedEndTime = performance.now();
      const categorizedAvgTime =
        (categorizedEndTime - categorizedStartTime) / iterations;

      // The overhead should be minimal
      expect(categorizedAvgTime).toBeLessThan(20); // <20ms total including categorization
      console.log(
        `Categorized prompt generation: ${categorizedAvgTime.toFixed(4)}ms avg`
      );
    });
  });

  describe('UI Rendering Performance', () => {
    it('should render actions within performance targets', () => {
      const testScenarios = [
        {
          name: 'Small action set (8 actions)',
          actions: Array.from({ length: 8 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 3}:action${i}`,
            commandString: `command ${i}`,
            description: `Description ${i}`,
          })),
        },
        {
          name: 'Medium action set (20 actions)',
          actions: Array.from({ length: 20 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 6}:action${i}`,
            commandString: `command ${i}`,
            description: `Description ${i}`,
          })),
        },
        {
          name: 'Large action set (40 actions)',
          actions: Array.from({ length: 40 }, (_, i) => ({
            index: i + 1,
            actionId: `namespace${i % 10}:action${i}`,
            commandString: `command ${i}`,
            description: `Description ${i}`,
          })),
        },
      ];

      const iterations = 20;

      testScenarios.forEach((scenario) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          // Clear container
          dom.window.document.getElementById('actions-container').innerHTML =
            '';

          // Render actions
          uiRenderer.renderActions(scenario.actions);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;

        const maxTime = scenario.actions.length <= 20 ? 25 : 50;
        expect(avgTime).toBeLessThan(maxTime);
        console.log(
          `${scenario.name} UI rendering: ${avgTime.toFixed(4)}ms avg`
        );
      });
    });

    it('should handle DOM manipulation efficiently', () => {
      const actions = Array.from({ length: 30 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 8}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Simulate real usage: clear and re-render
        dom.window.document.getElementById('actions-container').innerHTML = '';
        uiRenderer.renderActions(actions);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(40); // <40ms for 30 actions
      console.log(`DOM manipulation efficiency: ${avgTime.toFixed(4)}ms avg`);
    });
  });

  describe('Memory Performance', () => {
    it('should not create memory leaks during repeated operations', () => {
      const actions = Array.from({ length: 25 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 6}:action${i}`,
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

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform intensive operations
      for (let i = 0; i < 1000; i++) {
        service.shouldUseGrouping(actions, config);
        service.groupActionsByNamespace(actions, config);
        service.extractNamespace(actions[i % actions.length].actionId);

        if (i % 10 === 0) {
          const gameState = { availableActions: actions };
          promptProvider.getAvailableActionsInfoContent(gameState);
        }
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(1024 * 1024); // <1MB increase
      console.log(
        `Memory increase after 1000 operations: ${Math.round(memoryIncrease / 1024)}KB`
      );
    });

    it('should handle large datasets without excessive memory usage', () => {
      const largeActions = Array.from({ length: 200 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 20}:action${i}`,
        commandString: `command ${i}`,
        description: `Description for action number ${i} with detailed information`,
      }));

      if (global.gc) {
        global.gc();
      }

      const beforeMemory = process.memoryUsage().heapUsed;

      // Process large dataset
      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['namespace0', 'namespace1', 'namespace2'],
        showCounts: false,
      };

      const grouped = service.groupActionsByNamespace(largeActions, config);
      const gameState = { availableActions: largeActions };
      const prompt = promptProvider.getAvailableActionsInfoContent(gameState);

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryUsed = afterMemory - beforeMemory;

      expect(memoryUsed).toBeLessThan(5 * 1024 * 1024); // <5MB for 200 actions
      expect(grouped.size).toBeGreaterThan(0);
      expect(prompt).toBeTruthy();

      console.log(
        `Memory used for 200 actions: ${Math.round(memoryUsed / 1024)}KB`
      );
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle concurrent operations efficiently', () => {
      const actions = Array.from({ length: 15 }, (_, i) => ({
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

      const concurrentOperations = 100;
      const operations = [];

      const startTime = performance.now();

      // Create concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          Promise.resolve().then(() =>
            service.shouldUseGrouping(actions, config)
          ),
          Promise.resolve().then(() =>
            service.groupActionsByNamespace(actions, config)
          ),
          Promise.resolve().then(() =>
            promptProvider.getAvailableActionsInfoContent({
              availableActions: actions,
            })
          )
        );
      }

      return Promise.all(operations).then(() => {
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTimePerOperation = totalTime / (concurrentOperations * 3);

        expect(avgTimePerOperation).toBeLessThan(5); // <5ms per operation
        console.log(
          `Concurrent operations: ${avgTimePerOperation.toFixed(4)}ms avg per operation`
        );
      });
    });
  });
});
```

### Step 2: Performance Monitoring Integration

**File**: `src/entities/utils/actionCategorizationPerformanceMonitor.js`

```javascript
/**
 * @file Action Categorization Performance Monitor
 * Monitors and reports performance metrics for categorization operations
 */

/**
 * Performance monitoring utility for action categorization
 */
export class ActionCategorizationPerformanceMonitor {
  #logger;
  #metrics;
  #config;

  constructor({ logger, config = {} }) {
    this.#logger = logger;
    this.#config = {
      enabled: config.enabled ?? false,
      slowOperationThreshold: config.slowOperationThreshold ?? 10, // ms
      memoryCheckInterval: config.memoryCheckInterval ?? 100, // operations
      reportInterval: config.reportInterval ?? 1000, // operations
      ...config,
    };

    this.#metrics = {
      operations: {
        extractNamespace: { count: 0, totalTime: 0, slowCount: 0 },
        shouldUseGrouping: { count: 0, totalTime: 0, slowCount: 0 },
        groupActionsByNamespace: { count: 0, totalTime: 0, slowCount: 0 },
        getSortedNamespaces: { count: 0, totalTime: 0, slowCount: 0 },
        formatNamespaceDisplayName: { count: 0, totalTime: 0, slowCount: 0 },
      },
      memory: {
        initialHeapUsed: process.memoryUsage().heapUsed,
        peakHeapUsed: process.memoryUsage().heapUsed,
        lastCheckHeapUsed: process.memoryUsage().heapUsed,
      },
      errors: {
        count: 0,
        lastError: null,
      },
    };
  }

  /**
   * Monitor a service operation
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Function to execute and monitor
   * @returns {*} Result of the operation
   */
  monitorOperation(operationName, operation) {
    if (!this.#config.enabled) {
      return operation();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.#recordOperation(operationName, duration);

      if (duration > this.#config.slowOperationThreshold) {
        this.#logger.warn(
          'ActionCategorizationPerformanceMonitor: Slow operation detected',
          {
            operation: operationName,
            duration: `${duration.toFixed(2)}ms`,
            threshold: `${this.#config.slowOperationThreshold}ms`,
          }
        );
      }

      this.#checkMemoryUsage(startMemory);
      return result;
    } catch (error) {
      this.#recordError(operationName, error);
      throw error;
    }
  }

  /**
   * Monitor an async operation
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Async function to execute and monitor
   * @returns {Promise<*>} Result of the operation
   */
  async monitorAsyncOperation(operationName, operation) {
    if (!this.#config.enabled) {
      return await operation();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.#recordOperation(operationName, duration);

      if (duration > this.#config.slowOperationThreshold) {
        this.#logger.warn(
          'ActionCategorizationPerformanceMonitor: Slow async operation detected',
          {
            operation: operationName,
            duration: `${duration.toFixed(2)}ms`,
            threshold: `${this.#config.slowOperationThreshold}ms`,
          }
        );
      }

      this.#checkMemoryUsage(startMemory);
      return result;
    } catch (error) {
      this.#recordError(operationName, error);
      throw error;
    }
  }

  /**
   * Record operation metrics
   * @private
   */
  #recordOperation(operationName, duration) {
    const metric = this.#metrics.operations[operationName];
    if (!metric) {
      this.#metrics.operations[operationName] = {
        count: 0,
        totalTime: 0,
        slowCount: 0,
      };
    }

    const op = this.#metrics.operations[operationName];
    op.count++;
    op.totalTime += duration;

    if (duration > this.#config.slowOperationThreshold) {
      op.slowCount++;
    }

    // Report periodically
    if (op.count % this.#config.reportInterval === 0) {
      this.#reportOperationMetrics(operationName, op);
    }
  }

  /**
   * Record error metrics
   * @private
   */
  #recordError(operationName, error) {
    this.#metrics.errors.count++;
    this.#metrics.errors.lastError = {
      operation: operationName,
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    this.#logger.error(
      'ActionCategorizationPerformanceMonitor: Operation error',
      {
        operation: operationName,
        error: error.message,
        totalErrors: this.#metrics.errors.count,
      }
    );
  }

  /**
   * Check memory usage
   * @private
   */
  #checkMemoryUsage(startMemory) {
    const currentMemory = process.memoryUsage().heapUsed;

    if (currentMemory > this.#metrics.memory.peakHeapUsed) {
      this.#metrics.memory.peakHeapUsed = currentMemory;
    }

    const memoryIncrease = currentMemory - startMemory;
    if (memoryIncrease > 1024 * 1024) {
      // 1MB increase in single operation
      this.#logger.warn(
        'ActionCategorizationPerformanceMonitor: High memory usage in operation',
        {
          memoryIncrease: `${Math.round(memoryIncrease / 1024)}KB`,
          currentHeapUsed: `${Math.round(currentMemory / 1024 / 1024)}MB`,
        }
      );
    }

    // Periodic memory check
    const totalOperations = Object.values(this.#metrics.operations).reduce(
      (sum, op) => sum + op.count,
      0
    );

    if (totalOperations % this.#config.memoryCheckInterval === 0) {
      this.#reportMemoryMetrics();
    }
  }

  /**
   * Report operation metrics
   * @private
   */
  #reportOperationMetrics(operationName, metrics) {
    const avgTime = metrics.totalTime / metrics.count;
    const slowPercentage = (metrics.slowCount / metrics.count) * 100;

    this.#logger.info(
      'ActionCategorizationPerformanceMonitor: Operation metrics',
      {
        operation: operationName,
        totalOperations: metrics.count,
        averageTime: `${avgTime.toFixed(2)}ms`,
        slowOperations: metrics.slowCount,
        slowPercentage: `${slowPercentage.toFixed(1)}%`,
      }
    );
  }

  /**
   * Report memory metrics
   * @private
   */
  #reportMemoryMetrics() {
    const current = process.memoryUsage().heapUsed;
    const peak = this.#metrics.memory.peakHeapUsed;
    const initial = this.#metrics.memory.initialHeapUsed;
    const increase = current - initial;

    this.#logger.info(
      'ActionCategorizationPerformanceMonitor: Memory metrics',
      {
        currentHeapUsed: `${Math.round(current / 1024 / 1024)}MB`,
        peakHeapUsed: `${Math.round(peak / 1024 / 1024)}MB`,
        memoryIncrease: `${Math.round(increase / 1024)}KB`,
        memoryIncreasePercentage: `${((increase / initial) * 100).toFixed(1)}%`,
      }
    );
  }

  /**
   * Get current performance metrics
   * @returns {Object} Performance metrics summary
   */
  getMetrics() {
    const summary = {
      operations: {},
      memory: {
        currentHeapUsed: process.memoryUsage().heapUsed,
        peakHeapUsed: this.#metrics.memory.peakHeapUsed,
        memoryIncrease:
          process.memoryUsage().heapUsed - this.#metrics.memory.initialHeapUsed,
      },
      errors: this.#metrics.errors,
    };

    // Calculate operation summaries
    for (const [name, metrics] of Object.entries(this.#metrics.operations)) {
      if (metrics.count > 0) {
        summary.operations[name] = {
          count: metrics.count,
          averageTime: metrics.totalTime / metrics.count,
          slowCount: metrics.slowCount,
          slowPercentage: (metrics.slowCount / metrics.count) * 100,
        };
      }
    }

    return summary;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.#metrics.operations = {
      extractNamespace: { count: 0, totalTime: 0, slowCount: 0 },
      shouldUseGrouping: { count: 0, totalTime: 0, slowCount: 0 },
      groupActionsByNamespace: { count: 0, totalTime: 0, slowCount: 0 },
      getSortedNamespaces: { count: 0, totalTime: 0, slowCount: 0 },
      formatNamespaceDisplayName: { count: 0, totalTime: 0, slowCount: 0 },
    };

    this.#metrics.memory = {
      initialHeapUsed: process.memoryUsage().heapUsed,
      peakHeapUsed: process.memoryUsage().heapUsed,
      lastCheckHeapUsed: process.memoryUsage().heapUsed,
    };

    this.#metrics.errors = {
      count: 0,
      lastError: null,
    };

    this.#logger.info('ActionCategorizationPerformanceMonitor: Metrics reset');
  }

  /**
   * Generate performance report
   * @returns {string} Formatted performance report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const report = [];

    report.push('=== Action Categorization Performance Report ===');
    report.push('');

    // Operations summary
    report.push('Operations:');
    for (const [name, op] of Object.entries(metrics.operations)) {
      report.push(`  ${name}:`);
      report.push(`    Count: ${op.count}`);
      report.push(`    Average Time: ${op.averageTime.toFixed(2)}ms`);
      report.push(
        `    Slow Operations: ${op.slowCount} (${op.slowPercentage.toFixed(1)}%)`
      );
    }

    report.push('');

    // Memory summary
    report.push('Memory:');
    report.push(
      `  Current Heap: ${Math.round(metrics.memory.currentHeapUsed / 1024 / 1024)}MB`
    );
    report.push(
      `  Peak Heap: ${Math.round(metrics.memory.peakHeapUsed / 1024 / 1024)}MB`
    );
    report.push(
      `  Memory Increase: ${Math.round(metrics.memory.memoryIncrease / 1024)}KB`
    );

    report.push('');

    // Errors summary
    report.push('Errors:');
    report.push(`  Total Errors: ${metrics.errors.count}`);
    if (metrics.errors.lastError) {
      report.push(
        `  Last Error: ${metrics.errors.lastError.operation} - ${metrics.errors.lastError.message}`
      );
    }

    return report.join('\n');
  }
}
```

### Step 3: Performance Integration Tests

**File**: `tests/performance/performanceIntegration.test.js`

```javascript
/**
 * @file Performance Integration Tests
 * Tests performance under realistic integration scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';
import { ActionCategorizationPerformanceMonitor } from '../../../src/entities/utils/actionCategorizationPerformanceMonitor.js';

describe('Performance Integration Tests', () => {
  let container;
  let service;
  let monitor;

  beforeEach(() => {
    container = createTestContainerWithActionCategorization();
    service = container.resolve('IActionCategorizationService');

    monitor = new ActionCategorizationPerformanceMonitor({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
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
            service.shouldUseGrouping(actions, config)
          );

          if (i % 3 === 0) {
            // Not every operation needs grouping
            monitor.monitorOperation('groupActionsByNamespace', () =>
              service.groupActionsByNamespace(actions, config)
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
      expect(metrics.memory.memoryIncrease).toBeLessThan(1024 * 1024); // <1MB
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
              service.shouldUseGrouping(actions, {
                ...config,
                showCounts: true,
              })
            )
          ),
          // LLM operation
          Promise.resolve().then(() =>
            monitor.monitorOperation('llm_groupActionsByNamespace', () =>
              service.groupActionsByNamespace(actions, {
                ...config,
                showCounts: false,
              })
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
            service.shouldUseGrouping(largeActions, config)
          );
        }

        if (i % 20 === 0) {
          monitor.monitorOperation('stress_groupActionsByNamespace', () =>
            service.groupActionsByNamespace(largeActions, config)
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
        service.shouldUseGrouping(baselineActions, config);
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
          service.shouldUseGrouping(testActions, config);
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
```

## Quality Gates

### Performance Targets

- [ ] Service method calls: <1ms average
- [ ] LLM prompt generation: <15ms overhead
- [ ] UI rendering: ±5% of baseline performance
- [ ] Memory usage: <100KB overhead, no leaks
- [ ] Large datasets (50+ actions): <50ms total

### Monitoring and Alerting

- [ ] Performance monitoring implemented
- [ ] Slow operation detection and logging
- [ ] Memory usage tracking
- [ ] Automated performance regression detection
- [ ] Performance metrics reporting

### Optimization

- [ ] Performance bottlenecks identified and addressed
- [ ] Memory usage optimized
- [ ] Caching strategies implemented where beneficial
- [ ] Concurrent operation handling optimized

## Files Created

- [ ] `tests/performance/actionCategorizationBenchmarks.test.js`
- [ ] `src/entities/utils/actionCategorizationPerformanceMonitor.js`
- [ ] `tests/performance/performanceIntegration.test.js`

## Files Modified

- None (pure addition of performance validation)

## Dependencies

- **Completes**: ACTCAT-005, ACTCAT-009, ACTCAT-010
- **Enables**: Production deployment

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Performance benchmarks established and met
- [ ] Performance monitoring implemented
- [ ] Memory usage validated
- [ ] Optimization recommendations documented
- [ ] Performance regression detection active
- [ ] Code review approved
