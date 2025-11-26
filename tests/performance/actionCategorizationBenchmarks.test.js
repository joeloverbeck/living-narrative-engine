/**
 * @file Action Categorization Performance Benchmarks
 * Comprehensive performance testing and validation
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
import { UI_CATEGORIZATION_CONFIG } from '../../src/entities/utils/actionCategorizationConfig.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { Registrar } from '../../src/utils/registrarHelpers.js';
import ConsoleLogger, { LogLevel } from '../../src/logging/consoleLogger.js';
import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import { ActionButtonsRenderer } from '../../src/domUI/actionButtonsRenderer.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import { JSDOM } from 'jsdom';

describe('Action Categorization Performance Benchmarks', () => {
  let container;
  let service;
  let promptProvider;
  let uiRenderer;
  let dom;
  let documentContext;

  beforeEach(async () => {
    // Set up JSDOM for UI testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body><div id="actions-container"></div></body></html>
    `);
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    documentContext = new DocumentContext(dom.window.document);

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

    // Resolve the service from container - this will have UI_CATEGORIZATION_CONFIG
    service = container.resolve(tokens.IActionCategorizationService);

    // Use the service from container which has the correct UI configuration
    promptProvider = new AIPromptContentProvider({
      logger: appLogger,
      promptStaticContentService: {
        getCoreTaskDescriptionText: () => 'Core task',
        getCharacterPortrayalGuidelines: () => 'Guidelines',
        getNc21ContentPolicyText: () => 'Policy',
        getFinalLlmInstructionText: () => 'Instructions',
      },
      perceptionLogFormatter: { format: () => 'Log' },
      gameStateValidationService: { validate: () => ({ isValid: true }) },
      actionCategorizationService: service, // This now has UI_CATEGORIZATION_CONFIG
      characterDataXmlBuilder: { buildCharacterDataXml: () => '<character/>' },
      modActionMetadataProvider: { getMetadataForMod: () => null },
    });

    const domElementFactory = new DomElementFactory(documentContext);

    // Use the service from container which has the correct UI configuration
    uiRenderer = new ActionButtonsRenderer({
      logger: appLogger,
      documentContext: documentContext,
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn().mockReturnValue(() => {}),
        unsubscribe: jest.fn(),
      },
      domElementFactory: domElementFactory,
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: service, // This now has UI_CATEGORIZATION_CONFIG
    });
  });

  afterEach(() => {
    if (uiRenderer && uiRenderer.dispose) {
      uiRenderer.dispose();
    }
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

      // Note: The service uses UI_CATEGORIZATION_CONFIG internally
      // which has showCounts: true and the same thresholds
      const iterations = 1000;

      testDataSets.forEach((dataset) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          service.shouldUseGrouping(dataset.actions);
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

      // Note: The service uses UI_CATEGORIZATION_CONFIG internally
      const iterations = 100;

      testDataSets.forEach((dataset) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          service.groupActionsByNamespace(dataset.actions);
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

      // Note: The service uses UI_CATEGORIZATION_CONFIG internally
      const iterations = 1000;

      testCases.forEach((testCase) => {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          service.getSortedNamespaces(testCase.namespaces);
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
    it('should render actions within performance targets', async () => {
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

      for (const scenario of testScenarios) {
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          // Clear container
          dom.window.document.getElementById('actions-container').innerHTML =
            '';

          // Render actions using public API
          uiRenderer.availableActions = scenario.actions;
          await uiRenderer.renderList();
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;

        const maxTime = scenario.actions.length <= 20 ? 25 : 50;
        expect(avgTime).toBeLessThan(maxTime);
        console.log(
          `${scenario.name} UI rendering: ${avgTime.toFixed(4)}ms avg`
        );
      }
    });

    it('should handle DOM manipulation efficiently', async () => {
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
        uiRenderer.availableActions = actions;
        await uiRenderer.renderList();
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

      // Note: The service uses UI_CATEGORIZATION_CONFIG internally
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform intensive operations
      for (let i = 0; i < 1000; i++) {
        service.shouldUseGrouping(actions);
        service.groupActionsByNamespace(actions);
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

      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // <10MB increase (test environment)
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
      // Note: The service uses UI_CATEGORIZATION_CONFIG internally
      const grouped = service.groupActionsByNamespace(largeActions);
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

      // Note: The service uses UI_CATEGORIZATION_CONFIG internally
      const concurrentOperations = 100;
      const operations = [];

      const startTime = performance.now();

      // Create concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          Promise.resolve().then(() => service.shouldUseGrouping(actions)),
          Promise.resolve().then(() =>
            service.groupActionsByNamespace(actions)
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
