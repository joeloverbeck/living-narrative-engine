/**
 * @file Action Categorization Performance Regression Tests
 * Validates performance characteristics after implementation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('Action Categorization Performance Regression', () => {
  let container;
  let service;
  let promptProvider;

  beforeEach(async () => {
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
    await configureBaseContainer(container, {
      includeGameSystems: false, // Minimal setup for testing
      includeUI: false,
      includeCharacterBuilder: false,
    });

    service = container.resolve(tokens.IActionCategorizationService);

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
      characterDataXmlBuilder: { buildCharacterDataXml: () => '<character/>' },
      modActionMetadataProvider: { getMetadataForMod: () => null },
    });
  });

  describe('Service Performance', () => {
    it('should extract namespaces efficiently', () => {
      const actionIds = Array.from(
        { length: 1000 },
        (_, i) => `namespace${i % 10}:action${i}`
      );

      const startTime = performance.now();
      for (const actionId of actionIds) {
        service.extractNamespace(actionId);
      }
      const endTime = performance.now();

      const avgTime = (endTime - startTime) / actionIds.length;
      expect(avgTime).toBeLessThan(0.01); // <0.01ms per extraction
    });

    it('should handle grouping decisions efficiently', () => {
      const actions = Array.from({ length: 50 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 8}:action${i}`,
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

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        service.shouldUseGrouping(actions, config);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1); // <1ms per decision
    });

    it('should group actions efficiently', () => {
      const actions = Array.from({ length: 30 }, (_, i) => ({
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

      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        service.groupActionsByNamespace(actions, config);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(5); // <5ms per grouping
    });
  });

  describe('LLM Prompt Performance', () => {
    it('should format prompts with minimal overhead', () => {
      const gameState = {
        availableActions: Array.from({ length: 20 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 5}:action${i}`,
          commandString: `command ${i}`,
          description: `Description for action ${i}.`,
        })),
      };

      const iterations = 20;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        promptProvider.getAvailableActionsInfoContent(gameState);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(10); // <10ms per prompt generation
    });

    it('should handle large action sets within reasonable time', () => {
      const gameState = {
        availableActions: Array.from({ length: 100 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 15}:action${i}`,
          commandString: `command ${i}`,
          description: `Description for action number ${i}.`,
        })),
      };

      const startTime = performance.now();
      const result = promptProvider.getAvailableActionsInfoContent(gameState);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // <50ms for 100 actions
      expect(result).toBeTruthy();
    });
  });

  describe('Memory Usage', () => {
    it('should not create memory leaks in repeated operations', () => {
      const actions = Array.from({ length: 20 }, (_, i) => ({
        index: i + 1,
        actionId: `test:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['test'],
        showCounts: false,
      };

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        service.shouldUseGrouping(actions, config);
        service.groupActionsByNamespace(actions, config);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (increased threshold for test environment)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // <10MB
    });
  });
});
