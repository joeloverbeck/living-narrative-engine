/**
 * @file Complete Action Categorization Workflow Performance Tests
 * Tests performance characteristics of the complete action categorization workflow
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
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';

describe('Complete Action Categorization Workflow Performance', () => {
  let container;
  let actionCategorizationService;
  let promptProvider;

  beforeEach(async () => {
    // Create container with required services
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

    // Get the action categorization service
    actionCategorizationService = container.resolve(
      tokens.IActionCategorizationService
    );

    // Create prompt provider
    promptProvider = new AIPromptContentProvider({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      promptStaticContentService: {
        getCoreTaskDescriptionText: () =>
          'You are playing an interactive narrative game.',
        getCharacterPortrayalGuidelines: () =>
          'Portray characters realistically.',
        getNc21ContentPolicyText: () => 'Follow content guidelines.',
        getFinalLlmInstructionText: () => 'Choose an action by its index.',
      },
      perceptionLogFormatter: { format: (log) => `Formatted: ${log}` },
      gameStateValidationService: {
        validate: (state) => ({ isValid: true, errors: [] }),
      },
      actionCategorizationService: actionCategorizationService,
      characterDataXmlBuilder: { buildCharacterDataXml: () => '<character/>' },
      modActionMetadataProvider: { getMetadataForMod: () => null },
    });
  });

  afterEach(() => {
    if (container && container.dispose) {
      container.dispose();
    }
  });

  describe('Performance Under Load', () => {
    it('should maintain performance under realistic load', () => {
      const largeGameState = {
        availableActions: Array.from({ length: 50 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 12}:action${i}`,
          commandString: `command ${i}`,
          description: `Description for action number ${i} with some detail.`,
          params: {},
        })),
      };

      // Test LLM performance
      const llmStartTime = performance.now();
      const llmOutput =
        promptProvider.getAvailableActionsInfoContent(largeGameState);
      const llmEndTime = performance.now();

      expect(llmEndTime - llmStartTime).toBeLessThan(50); // 50ms threshold
      expect(llmOutput).toBeTruthy();
    });

    it('should handle concurrent operations efficiently', () => {
      const gameState = {
        availableActions: Array.from({ length: 20 }, (_, i) => ({
          index: i + 1,
          actionId: `namespace${i % 6}:action${i}`,
          commandString: `command ${i}`,
          description: `Description ${i}.`,
          params: {},
        })),
      };

      const operations = [];

      // Simulate concurrent LLM operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          Promise.resolve(
            promptProvider.getAvailableActionsInfoContent(gameState)
          )
        );
      }

      return Promise.all(operations).then((results) => {
        expect(results.length).toBe(10);

        // All results should be valid
        results.forEach((result) => {
          expect(result).toBeTruthy();
          expect(result).toContain('Actions');
        });
      });
    });
  });
});
