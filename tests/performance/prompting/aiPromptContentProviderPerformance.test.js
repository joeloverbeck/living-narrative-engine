/**
 * @file AIPromptContentProvider Performance Tests
 * @description Performance benchmarks for prompt content formatting and generation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('AIPromptContentProvider Performance', () => {
  let container;
  let promptContentProvider;
  let mockLogger;

  beforeEach(async () => {
    container = new AppContainer();
    const registrar = new Registrar(container);

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Register logger first (required by services)
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
    // MUST be called BEFORE resolving IActionCategorizationService
    await configureBaseContainer(container, {
      includeGameSystems: false, // Minimal setup for testing
      includeUI: false,
      includeCharacterBuilder: false,
    });

    // Create provider with all dependencies
    // Now IActionCategorizationService is available after configureBaseContainer
    promptContentProvider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: {
        getCoreTaskDescriptionText: jest.fn(() => 'Core task'),
        getCharacterPortrayalGuidelines: jest.fn(() => 'Guidelines'),
        getNc21ContentPolicyText: jest.fn(() => 'Policy'),
        getFinalLlmInstructionText: jest.fn(() => 'Instructions'),
      },
      perceptionLogFormatter: {
        format: jest.fn(() => 'Formatted log'),
      },
      gameStateValidationService: {
        validate: jest.fn(() => ({ isValid: true })),
      },
      actionCategorizationService: container.resolve(
        tokens.IActionCategorizationService
      ),
      characterDataXmlBuilder: {
        buildCharacterDataXml: jest.fn(() => '<character/>'),
      },
    });
  });

  afterEach(() => {
    if (container && typeof container.reset === 'function') {
      container.reset();
    }
    container = null;
    jest.clearAllMocks();
  });

  /**
   * Test: Performance of formatting large action sets
   * Verifies that formatting completes within acceptable time limits
   */
  it('should format large action sets efficiently', () => {
    const actions = Array.from({ length: 50 }, (_, i) => ({
      index: i + 1,
      actionId: `namespace${i % 10}:action${i}`,
      commandString: `command ${i}`,
      description: `Description for action ${i}.`,
    }));

    const gameState = { availableActions: actions };

    const startTime = performance.now();
    const result =
      promptContentProvider.getAvailableActionsInfoContent(gameState);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(50); // 50ms threshold
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  /**
   * Test: Performance metrics logging
   * Verifies that performance metrics are properly logged for categorized formatting
   */
  it('should log performance metrics for categorized formatting', () => {
    const gameState = {
      availableActions: Array.from({ length: 20 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 5}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}.`,
      })),
    };

    promptContentProvider.getAvailableActionsInfoContent(gameState);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'AIPromptContentProvider: Categorized formatting completed',
      expect.objectContaining({
        duration: expect.stringMatching(/\d+\.\d+ms/),
        namespaceCount: expect.any(Number),
        totalActions: 20,
      })
    );
  });

  /**
   * Test: Performance scaling with different action counts
   * Verifies linear or better scaling as action count increases
   */
  it('should scale efficiently with increasing action counts', () => {
    const testCases = [10, 25, 50, 100, 200];
    const timings = [];

    // Perform multiple runs to get statistical measurements
    const runsPerCase = 3;

    for (const count of testCases) {
      const actions = Array.from({ length: count }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 15}:action${i}`,
        commandString: `command ${i}`,
        description: `Description for action ${i}.`,
      }));

      const gameState = { availableActions: actions };
      const runTimes = [];

      // Run multiple times to reduce timing variance
      for (let run = 0; run < runsPerCase; run++) {
        const startTime = performance.now();
        promptContentProvider.getAvailableActionsInfoContent(gameState);
        const endTime = performance.now();
        runTimes.push(endTime - startTime);
      }

      // Use median time to reduce outlier impact
      runTimes.sort((a, b) => a - b);
      const medianTime = runTimes[Math.floor(runTimes.length / 2)];

      timings.push({
        count,
        time: medianTime,
        allRuns: runTimes,
      });
    }

    // Verify reasonable scaling - time should not increase exponentially
    for (let i = 1; i < timings.length; i++) {
      const ratio = timings[i].time / timings[i - 1].time;
      const countRatio = timings[i].count / timings[i - 1].count;

      // Time increase should be at most linear with count increase
      // Increased tolerance to 3.0 to account for JavaScript timing variability
      expect(ratio).toBeLessThan(countRatio * 3.0);
    }

    // All operations should complete within reasonable bounds
    timings.forEach(({ count, time }) => {
      // Base threshold + linear component based on count
      const threshold = 20 + count * 0.5; // 20ms base + 0.5ms per action
      expect(time).toBeLessThan(threshold);
    });
  });

  /**
   * Test: Performance with complex action descriptions
   * Verifies efficiency when processing actions with long descriptions
   */
  it('should handle complex action descriptions efficiently', () => {
    const longDescription =
      'This is a very detailed action description. '.repeat(10);

    const actions = Array.from({ length: 30 }, (_, i) => ({
      index: i + 1,
      actionId: `namespace${i % 8}:action${i}`,
      commandString: `complex command ${i} with multiple parameters`,
      description: longDescription + ` Action variant ${i}.`,
    }));

    const gameState = { availableActions: actions };

    const startTime = performance.now();
    const result =
      promptContentProvider.getAvailableActionsInfoContent(gameState);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // 100ms threshold for complex data
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  /**
   * Test: Performance with very large action sets (extracted from integration test)
   * Verifies that processing 100 actions completes within 100ms threshold
   */
  it('should handle very large action sets efficiently', () => {
    const largeActionSet = Array.from({ length: 100 }, (_, i) => ({
      index: i + 1,
      actionId: `namespace${i % 10}:action${i}`,
      commandString: `command ${i}`,
      description: `Description for action number ${i}.`,
    }));

    const gameState = { availableActions: largeActionSet };

    const startTime = performance.now();
    const result =
      promptContentProvider.getAvailableActionsInfoContent(gameState);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    expect(result).toBeTruthy();
    expect(result).toContain('## Available Actions');
  });
});
