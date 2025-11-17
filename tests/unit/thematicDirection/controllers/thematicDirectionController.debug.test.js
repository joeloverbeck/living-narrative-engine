/**
 * @file Debug test for ThematicDirectionController initialization
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';
import { ControllerLifecycleOrchestrator } from '../../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { DOMElementManager } from '../../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../../src/characterBuilder/services/eventListenerRegistry.js';
import { AsyncUtilitiesToolkit } from '../../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../../src/characterBuilder/services/validationService.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

const renderControllerMarkup = () => {
  document.body.innerHTML = `
    <section id="thematic-direction-page">
      <form id="concept-form">
        <textarea id="concept-input"></textarea>
        <span class="char-count"></span>
        <div id="concept-error"></div>
        <button id="generate-btn" type="button">Generate</button>
      </form>
      <button id="retry-btn" type="button">Retry</button>
      <button id="back-to-menu-btn" type="button">Back</button>
      <div class="cb-form-group">
        <label for="concept-selector">Concept</label>
        <select id="concept-selector">
          <option value="">Select a concept</option>
        </select>
      </div>
      <div id="concept-selector-error"></div>
      <div id="selected-concept-display">
        <div id="concept-content"></div>
        <div id="concept-directions-count"></div>
        <div id="concept-created-date"></div>
      </div>
      <section id="ui-states">
        <div id="empty-state"></div>
        <div id="loading-state"></div>
        <div id="results-state">
          <div id="directions-results"></div>
        </div>
        <div id="error-state"></div>
        <div id="error-message-text"></div>
      </section>
      <div id="generated-directions"></div>
      <ul id="directions-list"></ul>
      <div id="generated-concept"></div>
      <div id="concept-text"></div>
      <div id="character-count"></div>
      <div id="timestamp"></div>
    </section>
  `;
};

describe('ThematicDirectionController - Debug', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let controllerDependencies;
  let validationHandleError;

  const buildControllerDependencies = () => {
    const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({
      logger: mockLogger,
    });

    const sharedOptions = {
      logger: mockLogger,
    };

    const controllerLifecycleOrchestrator =
      new ControllerLifecycleOrchestrator({
        logger: mockLogger,
        eventBus: mockEventBus,
      });

    return {
      controllerLifecycleOrchestrator,
      domElementManager: new DOMElementManager({
        ...sharedOptions,
        documentRef: document,
        performanceRef: performance,
        elementsRef: {},
        contextName: 'ThematicDirectionController:DOM',
      }),
      eventListenerRegistry: new EventListenerRegistry({
        ...sharedOptions,
        asyncUtilities: asyncUtilitiesToolkit,
      }),
      asyncUtilitiesToolkit,
      performanceMonitor: new PerformanceMonitor({
        ...sharedOptions,
        eventBus: mockEventBus,
        performanceRef: performance,
      }),
      memoryManager: new MemoryManager(sharedOptions),
      errorHandlingStrategy: new ErrorHandlingStrategy({
        ...sharedOptions,
        eventBus: mockEventBus,
        controllerName: 'ThematicDirectionController',
        errorCategories: ERROR_CATEGORIES,
        errorSeverity: ERROR_SEVERITY,
      }),
      validationService: new ValidationService({
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
        handleError: validationHandleError,
        errorCategories: ERROR_CATEGORIES,
      }),
    };
  };

  beforeEach(() => {
    renderControllerMarkup();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([
        {
          id: 'concept-1',
          concept: 'Explorer of hidden worlds',
          createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
        },
      ]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
      loadSchema: jest.fn().mockResolvedValue(true),
      hasSchema: jest.fn().mockReturnValue(true),
    };

    validationHandleError = jest.fn();
    controllerDependencies = buildControllerDependencies();
  });

  afterEach(() => {
    if (controller?.destroy) {
      controller.destroy();
    }
    controller = null;
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('should complete initialization without errors', async () => {
    // Create controller after all mocks are set up
    controller = new ThematicDirectionController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      controllerLifecycleOrchestrator:
        controllerDependencies.controllerLifecycleOrchestrator,
      domElementManager: controllerDependencies.domElementManager,
      eventListenerRegistry: controllerDependencies.eventListenerRegistry,
      asyncUtilitiesToolkit: controllerDependencies.asyncUtilitiesToolkit,
      performanceMonitor: controllerDependencies.performanceMonitor,
      memoryManager: controllerDependencies.memoryManager,
      errorHandlingStrategy: controllerDependencies.errorHandlingStrategy,
      validationService: controllerDependencies.validationService,
    });

    // Act
    await controller.initialize();

    // Assert
    expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
    expect(
      mockCharacterBuilderService.getAllCharacterConcepts
    ).toHaveBeenCalled();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        /ThematicDirectionController: Initialization completed in \d+\.\d+ms/
      )
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
