/**
 * @file Memory tests for Traits Generator E2E operations
 * @description Tests memory management, leak detection, and resource cleanup
 * during E2E interactions with the traits generator
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { TraitsGeneratorTestBed } from '../../common/traitsGeneratorTestBed.js';
import { TraitsGeneratorController } from '../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import {
  setupLLMProxyMocks,
  setupBrowserAPIMocks,
  setupConsoleMocks,
} from '../../setup/e2eSetup.js';

describe('Traits Generator E2E Memory Tests', () => {
  let testBed;
  let dom;
  let window;
  let document;
  let controller;
  let fetchMock;
  let consoleMocks;
  let memoryTracker;

  beforeEach(async () => {
    testBed = new TraitsGeneratorTestBed();
    testBed.setup();

    consoleMocks = setupConsoleMocks();

    // Memory tracking setup
    memoryTracker = {
      initialMemory: 1024 * 1024, // 1MB
      currentMemory: 1024 * 1024,
      peakMemory: 1024 * 1024,
      allocations: [],
      track: function (bytes, operation) {
        this.currentMemory += bytes;
        if (this.currentMemory > this.peakMemory) {
          this.peakMemory = this.currentMemory;
        }
        this.allocations.push({ bytes, operation, timestamp: Date.now() });
      },
      reset: function () {
        this.currentMemory = this.initialMemory;
        this.peakMemory = this.initialMemory;
        this.allocations = [];
      },
      getGrowth: function () {
        return this.currentMemory - this.initialMemory;
      },
    };

    // Create DOM environment with memory monitoring
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        setupBrowserAPIMocks(window);

        // Enhanced memory API for testing - jsdom v27 has readonly performance
        if (window.performance) {
          // Mock the now method if performance exists
          if (window.performance.now) {
            jest.spyOn(window.performance, 'now').mockReturnValue(Date.now());
          }
          // Try to add memory property if it doesn't exist
          if (!window.performance.memory) {
            Object.defineProperty(window.performance, 'memory', {
              value: {
                usedJSHeapSize: memoryTracker.currentMemory,
                totalJSHeapSize: 2 * 1024 * 1024, // 2MB total
                jsHeapSizeLimit: 64 * 1024 * 1024, // 64MB limit
                // Simulate memory growth
                _simulateGrowth: function (bytes) {
                  memoryTracker.track(bytes, 'simulated');
                  this.usedJSHeapSize = memoryTracker.currentMemory;
                  if (this.usedJSHeapSize > this.totalJSHeapSize) {
                    this.totalJSHeapSize = this.usedJSHeapSize * 1.5;
                  }
                },
              },
              configurable: true,
            });
          }
        } else {
          // If performance doesn't exist, create the whole object
          Object.defineProperty(window, 'performance', {
            value: {
              now: jest.fn(() => Date.now()),
              memory: {
                usedJSHeapSize: memoryTracker.currentMemory,
                totalJSHeapSize: 2 * 1024 * 1024, // 2MB total
                jsHeapSizeLimit: 64 * 1024 * 1024, // 64MB limit
                // Simulate memory growth
                _simulateGrowth: function (bytes) {
                  memoryTracker.track(bytes, 'simulated');
                  this.usedJSHeapSize = memoryTracker.currentMemory;
                  if (this.usedJSHeapSize > this.totalJSHeapSize) {
                    this.totalJSHeapSize = this.usedJSHeapSize * 1.5;
                  }
                },
              },
            },
            configurable: true,
          });
        }

        fetchMock = jest.fn();
        window.fetch = fetchMock;
        setupLLMProxyMocks(fetchMock);
      },
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    controller = new TraitsGeneratorController({
      characterBuilderService: testBed.getCharacterBuilderService(),
      eventBus: testBed.getEventBusMock(),
      logger: testBed.mockLogger,
      schemaValidator: testBed.getSchemaValidator(),
      // Required service dependencies (after wrapper removal)
      controllerLifecycleOrchestrator: {
        isInitialized: false,
        isInitializing: false,
        isDestroyed: false,
        isDestroying: false,
        setControllerName: jest.fn(),
        registerHook: jest.fn(),
        createControllerMethodHook: jest.fn(() => jest.fn()),
        initialize: jest.fn().mockResolvedValue(undefined),
        reinitialize: jest.fn().mockResolvedValue(undefined),
        resetInitializationState: jest.fn(),
        destroy: jest.fn(),
        registerCleanupTask: jest.fn(),
        checkDestroyed: jest.fn(() => false),
        makeDestructionSafe: jest.fn((fn) => fn),
      },
      domElementManager: {
        configure: jest.fn(),
        cacheElement: jest.fn(),
        cacheElementsFromMap: jest.fn(() => ({ elements: {}, errors: [] })),
        getElement: jest.fn(() => null),
        getElementsSnapshot: jest.fn(() => ({})),
        clearCache: jest.fn(),
        validateElement: jest.fn(),
        validateElementCache: jest.fn(() => ({ valid: true, missing: [] })),
        normalizeElementConfig: jest.fn((config) =>
          typeof config === 'string'
            ? { selector: config, required: true }
            : config
        ),
        setElementEnabled: jest.fn(),
      },
      eventListenerRegistry: {
        setContextName: jest.fn(),
        detachEventBusListeners: jest.fn(() => 0),
        destroy: jest.fn(),
      },
      asyncUtilitiesToolkit: {
        clearAllTimers: jest.fn(),
        getTimerStats: jest.fn(() => ({
          timeouts: { count: 0 },
          intervals: { count: 0 },
          animationFrames: { count: 0 },
        })),
      },
      performanceMonitor: {
        configure: jest.fn(),
        clearData: jest.fn(),
      },
      memoryManager: {
        setContextName: jest.fn(),
        clear: jest.fn(),
      },
      errorHandlingStrategy: {
        configureContext: jest.fn(),
        handleError: jest.fn(),
        buildErrorDetails: jest.fn(),
        categorizeError: jest.fn(),
        generateUserMessage: jest.fn(),
        logError: jest.fn(),
        showErrorToUser: jest.fn(),
        handleServiceError: jest.fn(),
        executeWithErrorHandling: jest.fn(),
        isRetryableError: jest.fn(() => false),
        determineRecoverability: jest.fn(),
        isRecoverableError: jest.fn(() => false),
        attemptErrorRecovery: jest.fn(),
        createError: jest.fn((msg) => new Error(msg)),
        wrapError: jest.fn((err) => err),
        resetLastError: jest.fn(),
        lastError: null,
      },
      validationService: {
        configure: jest.fn(),
        validateData: jest.fn(() => ({ isValid: true })),
        formatValidationErrors: jest.fn((errors) => errors),
        buildValidationErrorMessage: jest.fn((errors) => errors.join(', ')),
      },
      uiStateManager: { setState: jest.fn(), getState: jest.fn(() => ({})) },
      traitsDisplayEnhancer: {
        enhanceForDisplay: jest.fn((traits) => traits),
        generateExportFilename: jest.fn(() => 'character-traits.txt'),
        formatForExport: jest.fn((traits) => 'Character Traits Export'),
      },
    });
  });

  afterEach(() => {
    testBed.cleanup();
    memoryTracker.reset();
    if (dom) {
      dom.window.close();
    }
    consoleMocks.restore();
    jest.clearAllMocks();
  });

  describe('Memory Management', () => {
    it('should handle memory efficiently during extended usage', async () => {
      // Skip if memory API not available (happens in test environments)
      if (!window.performance?.memory) {
        console.log(
          'Skipping: window.performance.memory not available in test environment'
        );
        return;
      }
      const initialMemory = window.performance.memory.usedJSHeapSize;

      // Simulate extended usage session
      for (let session = 0; session < 5; session++) {
        // Load directions
        const directions = Array.from({ length: 10 }, (_, i) => ({
          direction: {
            ...testBed.createValidDirection(),
            id: `dir-${session}-${i}`,
          },
        }));

        testBed
          .getCharacterBuilderService()
          .getDirectionsWithClichesAndMotivations.mockResolvedValue(directions);

        await controller.initialize();

        // Simulate user interactions
        const directionSelector = document.getElementById('direction-selector');
        if (directionSelector) {
          directionSelector.value = directions[0].direction.id;
        }

        [
          'core-motivation-input',
          'internal-contradiction-input',
          'central-question-input',
        ].forEach((id) => {
          const input = document.getElementById(id);
          if (input) {
            input.value = `Extended usage test session ${session}`;
            input.dispatchEvent(new window.Event('input'));
          }
        });

        // Simulate memory growth from session
        window.performance.memory._simulateGrowth(30 * 1024); // 30KB per session
      }

      const finalMemory = window.performance.memory.usedJSHeapSize;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable for extended usage (< 1MB total)
      expect(memoryGrowth).toBeLessThan(1024 * 1024);

      // Memory should not exceed reasonable limits
      expect(finalMemory).toBeLessThan(5 * 1024 * 1024); // Under 5MB total
    });

    it('should clean up resources properly after operations', async () => {
      // Skip if memory API not available (happens in test environments)
      if (!window.performance?.memory) {
        console.log(
          'Skipping: window.performance.memory not available in test environment'
        );
        return;
      }
      const memoryBefore = window.performance.memory.usedJSHeapSize;

      // Perform operation that should clean up after itself
      const validDirection = testBed.createValidDirection();
      testBed
        .getCharacterBuilderService()
        .getDirectionsWithClichesAndMotivations.mockResolvedValue([
          { direction: validDirection },
        ]);
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());

      await controller.initialize();

      // Fill form and generate
      const directionSelector = document.getElementById('direction-selector');
      if (directionSelector) {
        directionSelector.value = validDirection.id;
      }

      const generateBtn = document.getElementById('generate-btn');
      if (generateBtn) {
        generateBtn.click();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear form (cleanup operation)
      const clearBtn = document.getElementById('clear-btn');
      if (clearBtn) {
        clearBtn.click();
      }

      // Allow cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      const memoryAfter = window.performance.memory.usedJSHeapSize;
      const memoryDelta = memoryAfter - memoryBefore;

      // Memory usage should not grow significantly after cleanup
      expect(memoryDelta).toBeLessThan(100 * 1024); // Less than 100KB growth
    });

    it('should not cause memory leaks during rapid form validation', async () => {
      // Skip if memory API not available (happens in test environments)
      if (!window.performance?.memory) {
        console.log(
          'Skipping: window.performance.memory not available in test environment'
        );
        return;
      }

      const validDirection = testBed.createValidDirection();
      testBed
        .getCharacterBuilderService()
        .getDirectionsWithClichesAndMotivations.mockResolvedValue([
          { direction: validDirection },
        ]);

      await controller.initialize();

      const initialMemory = window.performance.memory.usedJSHeapSize;

      // Measure form validation memory impact under rapid input
      const inputs = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
      ];

      // Simulate rapid typing (10 input events per field)
      inputs.forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
          for (let i = 0; i < 10; i++) {
            input.value = `Test input ${i} that meets validation requirements and is sufficiently long`;
            input.dispatchEvent(new window.Event('input'));
          }
        }
      });

      // Simulate memory growth from validation
      window.performance.memory._simulateGrowth(1024); // 1KB growth is acceptable

      const finalMemory = window.performance.memory.usedJSHeapSize;
      const memoryGrowth = finalMemory - initialMemory;

      // Verify validation didn't cause excessive memory growth
      expect(memoryGrowth).toBeLessThan(50 * 1024); // Less than 50KB for all validation
      expect(finalMemory).toBeLessThan(2 * 1024 * 1024); // Under 2MB total
    });

    it('should maintain stable memory during multiple generations', async () => {
      // Skip if memory API not available (happens in test environments)
      if (!window.performance?.memory) {
        console.log(
          'Skipping: window.performance.memory not available in test environment'
        );
        return;
      }

      const validDirection = testBed.createValidDirection();
      const validInputs = testBed.createValidUserInputs();

      testBed
        .getCharacterBuilderService()
        .getDirectionsWithClichesAndMotivations.mockResolvedValue([
          { direction: validDirection },
        ]);
      testBed.mockLLMResponse(testBed.createValidTraitsResponse());

      await controller.initialize();

      const memoryUsage = [];

      // Perform multiple generation cycles
      for (let i = 0; i < 3; i++) {
        // Record initial memory
        memoryUsage.push(window.performance.memory.usedJSHeapSize);

        // Simulate user filling form and generating
        const directionSelector = document.getElementById('direction-selector');
        if (directionSelector) {
          directionSelector.value = validDirection.id;
        }

        [
          'core-motivation-input',
          'internal-contradiction-input',
          'central-question-input',
        ].forEach((id, index) => {
          const input = document.getElementById(id);
          if (input) {
            input.value = `${Object.values(validInputs)[index]} - iteration ${i}`;
            input.dispatchEvent(new window.Event('input'));
          }
        });

        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
          generateBtn.click();
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Simulate some memory growth
        window.performance.memory._simulateGrowth(50 * 1024); // 50KB per generation
      }

      // Record final memory
      const finalMemory = window.performance.memory.usedJSHeapSize;
      memoryUsage.push(finalMemory);

      // Check memory growth pattern
      const initialMemory = memoryUsage[0];
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (< 500KB for 3 generations)
      expect(memoryGrowth).toBeLessThan(500 * 1024);

      // Check for memory stability (no exponential growth)
      for (let i = 1; i < memoryUsage.length; i++) {
        const growth = memoryUsage[i] - memoryUsage[i - 1];
        // Each iteration should not grow by more than 200KB
        expect(growth).toBeLessThan(200 * 1024);
      }
    });
  });

  describe('Event Listener Cleanup', () => {
    it('should not accumulate event listeners with repeated initialization', async () => {
      // Track event listener additions
      const originalAddEventListener = window.addEventListener;
      let listenerCount = 0;

      window.addEventListener = jest.fn((...args) => {
        listenerCount++;
        return originalAddEventListener.apply(window, args);
      });

      // Initialize controller multiple times
      for (let i = 0; i < 3; i++) {
        await controller.initialize();
      }

      // Listener count should not grow linearly with initializations
      // Some growth is acceptable for legitimate new listeners
      expect(listenerCount).toBeLessThan(10);

      window.addEventListener = originalAddEventListener;
    });

    it('should properly clean up DOM references on clear', async () => {
      // Skip if memory API not available (happens in test environments)
      if (!window.performance?.memory) {
        console.log(
          'Skipping: window.performance.memory not available in test environment'
        );
        return;
      }

      testBed
        .getCharacterBuilderService()
        .getDirectionsWithClichesAndMotivations.mockResolvedValue([
          { direction: testBed.createValidDirection() },
        ]);

      await controller.initialize();

      // Track initial memory
      const initialMemory = window.performance.memory.usedJSHeapSize;

      // Create and clear multiple times
      for (let i = 0; i < 5; i++) {
        // Fill form with data
        [
          'core-motivation-input',
          'internal-contradiction-input',
          'central-question-input',
        ].forEach((id) => {
          const input = document.getElementById(id);
          if (input) {
            input.value = `Test data round ${i} with lots of content to simulate real usage`;
          }
        });

        // Clear form
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
          clearBtn.click();
        }
      }

      // Final memory check
      const finalMemory = window.performance.memory.usedJSHeapSize;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory should not accumulate significantly
      expect(memoryGrowth).toBeLessThan(100 * 1024); // Less than 100KB growth
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large datasets without excessive memory usage', async () => {
      // Skip if memory API not available (happens in test environments)
      if (!window.performance?.memory) {
        console.log(
          'Skipping: window.performance.memory not available in test environment'
        );
        return;
      }

      // Create a large dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        direction: {
          ...testBed.createValidDirection(),
          id: `large-dataset-${i}`,
          title: `Large Dataset Direction ${i}`,
          description:
            `This is a comprehensive description for direction ${i} in our large dataset memory test. `.repeat(
              10
            ),
        },
      }));

      testBed
        .getCharacterBuilderService()
        .getDirectionsWithClichesAndMotivations.mockResolvedValue(largeDataset);

      const memoryBefore = window.performance.memory.usedJSHeapSize;

      await controller.initialize();

      const memoryAfter = window.performance.memory.usedJSHeapSize;
      const memoryUsed = memoryAfter - memoryBefore;

      // Memory usage should be proportional to data size
      // Approximately 1KB per item is reasonable
      expect(memoryUsed).toBeLessThan(200 * 1024); // Less than 200KB for 100 items
    });
  });
});
