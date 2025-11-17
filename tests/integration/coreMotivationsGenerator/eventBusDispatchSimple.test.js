/**
 * @file Simplified integration test to reproduce eventBus dispatch issue
 * @description Reproduces the exact error seen in production logs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import {
  ControllerLifecycleOrchestrator,
} from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { DOMElementManager } from '../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../src/characterBuilder/services/eventListenerRegistry.js';
import { AsyncUtilitiesToolkit } from '../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../src/characterBuilder/services/validationService.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

describe('CoreMotivationsGeneratorController - EventBus Dispatch Issue (Simplified)', () => {
  let controller;
  let mockEventBus;
  let dispatchedCalls;

  beforeEach(() => {
    // Create a mock eventBus that tracks calls
    dispatchedCalls = [];
    mockEventBus = {
      dispatch: jest.fn((...args) => {
        dispatchedCalls.push(args);

        // Simulate the real eventBus behavior:
        // If first arg is an object (wrong usage), it will cause issues
        const [firstArg, secondArg] = args;

        if (typeof firstArg === 'object' && firstArg !== null) {
          // This simulates the error that happens in production
          console.error('EventBus: Invalid event name provided.', firstArg);
          return Promise.resolve(false);
        }

        // Correct usage: eventName (string), payload (object)
        if (typeof firstArg === 'string') {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      }),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Mock services
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllCharacterConcepts: jest
        .fn()
        .mockResolvedValue([{ id: 'concept-1', concept: 'A brave warrior' }]),
      createCharacterConcept: jest.fn().mockResolvedValue('concept-id'),
      updateCharacterConcept: jest.fn().mockResolvedValue(true),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      getCharacterConcept: jest.fn().mockResolvedValue({
        id: 'concept-1',
        concept: 'A brave warrior',
      }),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([
        {
          direction: { id: 'direction-1', title: 'Heroic Journey' },
          concept: { id: 'concept-1', concept: 'A brave warrior' },
        },
      ]),
      hasClichesForDirection: jest.fn().mockResolvedValue(true),
    };

    const mockCoreMotivationsGenerator = {
      generate: jest.fn().mockResolvedValue([]),
    };

    const mockDisplayEnhancer = {
      createMotivationBlock: jest.fn(),
      formatMotivationsForExport: jest.fn(),
      formatSingleMotivation: jest.fn(),
    };

    const mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      getErrors: jest.fn().mockReturnValue([]),
      validateAgainstSchema: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
    };

    // Create DOM structure
    document.body.innerHTML = `
      <div id="empty-state" class="cb-empty-state"><p>Empty</p></div>
      <div id="loading-indicator" class="cb-loading-state"><p>Loading...</p></div>
      <div id="error-state" class="cb-error-state"><p class="error-message"></p></div>
      <div id="results-state" class="cb-results-state"></div>
      <select id="direction-selector"></select>
      <button id="generate-btn"></button>
      <button id="clear-all-btn"></button>
      <button id="export-btn"></button>
      <input id="motivation-search" />
      <select id="motivation-sort"><option value="newest">Newest</option></select>
      <div id="motivations-container"></div>
      <div id="direction-count"></div>
      <div id="search-count"></div>
      <div id="search-results-count"></div>
      <div id="no-directions-message"></div>
      <div id="confirmation-modal" style="display: none;">
        <button id="confirm-clear" type="button">Confirm</button>
        <button id="cancel-clear" type="button">Cancel</button>
      </div>
      <button id="back-btn"></button>
      <div id="sr-announcements"></div>
    `;

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Create controller
    const controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
      logger: mockLogger,
      eventBus: mockEventBus,
    });

    const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({
      logger: mockLogger,
    });

    const domElementManager = new DOMElementManager({
      logger: mockLogger,
      documentRef: document,
      performanceRef: performance,
      elementsRef: {},
      contextName: 'CoreMotivationsGeneratorController',
    });

    const eventListenerRegistry = new EventListenerRegistry({
      logger: mockLogger,
      asyncUtilities: {
        debounce: (...args) => asyncUtilitiesToolkit.debounce(...args),
        throttle: (...args) => asyncUtilitiesToolkit.throttle(...args),
      },
    });

    const performanceMonitor = new PerformanceMonitor({
      logger: mockLogger,
      eventBus: mockEventBus,
    });

    const memoryManager = new MemoryManager({ logger: mockLogger });

    const errorHandlingStrategy = new ErrorHandlingStrategy({
      logger: mockLogger,
      eventBus: mockEventBus,
      controllerName: 'CoreMotivationsGeneratorController',
      errorCategories: ERROR_CATEGORIES,
      errorSeverity: ERROR_SEVERITY,
    });

    const validationService = new ValidationService({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
      handleError: jest.fn(),
      errorCategories: ERROR_CATEGORIES,
    });

    controller = new CoreMotivationsGeneratorController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      coreMotivationsGenerator: mockCoreMotivationsGenerator,
      displayEnhancer: mockDisplayEnhancer,
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Current behavior (after fix)', () => {
    it('should call eventBus.dispatch with correct signature (eventName, payload)', async () => {
      // Spy on console.error to capture the error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act - Initialize the controller
      await controller.initialize();

      // Assert - Check how dispatch was called
      expect(mockEventBus.dispatch).toHaveBeenCalled();

      // The controller now calls dispatch correctly with two arguments
      const initCall = dispatchedCalls.find(
        ([eventName]) => eventName === 'core:core_motivations_ui_initialized'
      );
      expect(initCall).toBeDefined();
      expect(initCall.length).toBe(2); // Two arguments passed (correct)

      const [eventName, payload] = initCall;
      expect(typeof eventName).toBe('string');
      expect(typeof payload).toBe('object');
      expect(payload).toHaveProperty('conceptId');
      expect(payload).toHaveProperty('eligibleDirectionsCount');

      // No error should be triggered
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        'EventBus: Invalid event name provided.',
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
