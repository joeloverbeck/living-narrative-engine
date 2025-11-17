/**
 * @file Integration tests for BaseCharacterBuilderController lifecycle and error handling
 */

import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import { SafeEventDispatcher } from '../../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../../src/events/eventBus.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import BaseCharacterBuilderController, {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { DOMElementManager } from '../../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../../src/characterBuilder/services/eventListenerRegistry.js';
import { AsyncUtilitiesToolkit } from '../../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import {
  ControllerLifecycleOrchestrator,
} from '../../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { PerformanceMonitor } from '../../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../../src/characterBuilder/services/validationService.js';

class MinimalCharacterBuilderService {
  constructor(logger) {
    this.logger = logger;
  }

  async initialize() {
    this.logger.debug('Minimal service initialized');
  }

  async getAllCharacterConcepts() {
    return [];
  }

  async getCharacterConcept() {
    return null;
  }

  async createCharacterConcept() {
    return { id: 'generated-id' };
  }

  async updateCharacterConcept() {
    return { id: 'updated-id' };
  }

  async deleteCharacterConcept() {
    return true;
  }

  async generateThematicDirections() {
    return [];
  }

  async getThematicDirections() {
    return [];
  }
}

class LifecycleTestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.initializationCount = 0;
    this.onInitializationErrorCount = 0;
    this.retryInvocations = 0;
    this.reinitializeInvocations = 0;
    this.lastInitializationError = null;
    this._postInitializeError = null;
    this._shouldSkipCaching = false;
  }

  setPostInitializeError(error) {
    this._postInitializeError = error;
  }

  skipCaching() {
    this._shouldSkipCaching = true;
  }

  cacheStateElements() {
    this._cacheElement('emptyState', '#empty-state');
    this._cacheElement('loadingState', '#loading-state');
    this._cacheElement('errorState', '#error-state');
    this._cacheElement('resultsState', '#results-state');
  }

  async exposeInitializeUIState() {
    await this._initializeUIState();
  }

  async exposeHandleInitializationError(error) {
    await this._handleInitializationError(error);
  }

  async exposeExecuteWithErrorHandling(operation, name, options) {
    return this._executeWithErrorHandling(operation, name, options);
  }

  validateDataExposed(data, schemaId, context) {
    return this._validateData(data, schemaId, context);
  }

  attemptRecoveryExposed(details) {
    return this._attemptErrorRecovery(details);
  }

  createErrorExposed(message, category, metadata) {
    return this._createError(message, category, metadata);
  }

  wrapErrorExposed(error, context) {
    return this._wrapError(error, context);
  }

  async forceReinitialize() {
    await super._reinitialize();
  }

  async _cacheElements() {
    if (this._shouldSkipCaching) {
      return;
    }
    this.cacheStateElements();
  }

  async _initializeServices() {}

  async _setupEventListeners() {}

  async _loadInitialData() {}

  async _postInitialize() {
    this.initializationCount += 1;
    if (this._postInitializeError) {
      throw this._postInitializeError;
    }
  }

  async _onInitializationError(error) {
    this.onInitializationErrorCount += 1;
    this.lastInitializationError = error;
  }

  _retryLastOperation() {
    this.retryInvocations += 1;
  }

  async _reinitialize() {
    this.reinitializeInvocations += 1;
    await super._reinitialize();
  }
}

function setupDOM() {
  document.body.innerHTML = `
    <div class="cb-app">
      <div id="empty-state" class="state-container" style="display: none;">Empty</div>
      <div id="loading-state" class="state-container" style="display: none;">Loading</div>
      <div id="error-state" class="state-container" style="display: none;">
        <span class="error-message-text"></span>
      </div>
      <div id="results-state" class="state-container" style="display: none;">Results</div>
    </div>
  `;
}

function createControllerDependencies() {
  const logger = new ConsoleLogger('DEBUG');
  logger.setLogLevel('DEBUG');

  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });
  const eventBus = new EventBus({ logger });
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });
  const characterBuilderService = new MinimalCharacterBuilderService(logger);
  const controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
    logger,
    eventBus: safeDispatcher,
  });
  const domElementManager = new DOMElementManager({
    logger,
    documentRef: document,
    performanceRef:
      typeof performance !== 'undefined'
        ? performance
        : {
            now: () => Date.now(),
          },
    elementsRef: {},
  });
  const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({ logger });
  const eventListenerRegistry = new EventListenerRegistry({
    logger,
    asyncUtilities: asyncUtilitiesToolkit,
  });
  const performanceMonitor = new PerformanceMonitor({
    logger,
    eventBus: safeDispatcher,
  });
  const memoryManager = new MemoryManager({ logger });
  const errorHandlingStrategy = new ErrorHandlingStrategy({
    logger,
    eventBus: safeDispatcher,
    controllerName: 'LifecycleTestController',
    errorCategories: ERROR_CATEGORIES,
    errorSeverity: ERROR_SEVERITY,
  });
  const validationService = new ValidationService({
    schemaValidator,
    logger,
    handleError: errorHandlingStrategy.handleError.bind(errorHandlingStrategy),
    errorCategories: ERROR_CATEGORIES,
  });

  return {
    logger,
    schemaValidator,
    eventBus: safeDispatcher,
    characterBuilderService,
    controllerLifecycleOrchestrator,
    domElementManager,
    eventListenerRegistry,
    asyncUtilitiesToolkit,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
  };
}

function setupController({ cacheElements = true } = {}) {
  setupDOM();
  const dependencies = createControllerDependencies();
  const controller = new LifecycleTestController(dependencies);
  if (cacheElements) {
    controller.cacheStateElements();
  }
  return { controller, dependencies };
}

describe('BaseCharacterBuilderController lifecycle and error handling (integration)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes UI state manager and shows empty state by default', async () => {
    const { controller } = setupController();

    await controller.exposeInitializeUIState();

    const emptyState = document.getElementById('empty-state');
    expect(emptyState.style.display).not.toBe('none');
    expect(controller.isInitialized).toBe(false);

    controller.destroy();
  });

  it('warns when UI state manager cannot be initialized due to missing DOM structure', async () => {
    const { controller, dependencies } = setupController({ cacheElements: false });
    const warnSpy = jest.spyOn(dependencies.logger, 'warn');

    await controller.exposeInitializeUIState();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Missing state elements')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('UIStateManager not available')
    );

    warnSpy.mockRestore();
    controller.destroy();
  });

  it('handles initialization failures by surfacing UI feedback, dispatching events, and invoking hooks', async () => {
    const { controller, dependencies } = setupController();
    controller.setPostInitializeError(new Error('post-initialize failure'));

    const errorEvents = [];
    const unsubscribe = controller.eventBus.subscribe(
      'SYSTEM_ERROR_OCCURRED',
      ({ payload }) => errorEvents.push(payload)
    );

    await expect(controller.initialize()).rejects.toThrow('post-initialize failure');

    expect(controller.onInitializationErrorCount).toBe(1);
    expect(controller.lastInitializationError).toBeInstanceOf(Error);
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      context: expect.stringContaining('initialization'),
      phase: 'post-initialization',
    });

    const errorState = document.getElementById('error-state');
    expect(errorState.style.display).not.toBe('none');
    expect(controller.isInitialized).toBe(false);
    expect(controller.isInitializing).toBe(false);

    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }

    controller.destroy();
  });

  it('executes operations with retry logic, records last error details, and exposes error helpers', async () => {
    const { controller } = setupController();
    jest.useFakeTimers();

    let attempt = 0;
    const errorEvents = [];
    const unsubscribe = controller.eventBus.subscribe(
      'SYSTEM_ERROR_OCCURRED',
      ({ payload }) => errorEvents.push(payload)
    );

    const operation = jest.fn(() => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('network failure while loading');
      }
      return 'operation-success';
    });

    const resultPromise = controller.exposeExecuteWithErrorHandling(
      operation,
      'loadData',
      {
        retries: 1,
        retryDelay: 50,
        userErrorMessage: 'Unable to load data',
      }
    );

    jest.advanceTimersByTime(50);
    await expect(resultPromise).resolves.toBe('operation-success');

    expect(operation).toHaveBeenCalledTimes(2);
    expect(errorEvents).toHaveLength(1);
    expect(controller.lastError).toMatchObject({
      operation: 'loadData',
      userMessage: 'Unable to load data',
      metadata: expect.objectContaining({
        attempt: 1,
        isRetrying: true,
      }),
    });

    const createdError = controller.createErrorExposed(
      'Custom problem',
      ERROR_CATEGORIES.USER,
      { source: 'test' }
    );
    expect(createdError).toBeInstanceOf(Error);
    expect(createdError.category).toBe(ERROR_CATEGORIES.USER);
    expect(createdError.metadata).toEqual({ source: 'test' });

    const originalError = new Error('database offline');
    const wrapped = controller.wrapErrorExposed(
      originalError,
      'While saving character'
    );
    expect(wrapped.message).toBe('While saving character: database offline');
    expect(wrapped.originalError).toBe(originalError);

    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }

    controller.destroy();
  });

  it('validates data against schemas and handles validator failures gracefully', async () => {
    const { controller, dependencies } = setupController();

    await dependencies.schemaValidator.addSchema(
      {
        $id: 'schema://integration/tests/simple-character',
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      },
      'schema://integration/tests/simple-character'
    );

    const invalidResult = controller.validateDataExposed(
      {},
      'schema://integration/tests/simple-character'
    );
    // _validateData formats Ajv error objects into human-readable strings, so assertions
    // need to inspect the string content instead of object fields.
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors[0]).toContain('name');
    expect(invalidResult.errorMessage).toContain("must have required property 'name'");

    const validResult = controller.validateDataExposed(
      { name: 'Hero' },
      'schema://integration/tests/simple-character'
    );
    expect(validResult).toEqual({ isValid: true });

    const errorEvents = [];
    const unsubscribe = controller.eventBus.subscribe(
      'SYSTEM_ERROR_OCCURRED',
      ({ payload }) => errorEvents.push(payload)
    );

    const validateSpy = jest
      .spyOn(dependencies.schemaValidator, 'validate')
      .mockImplementation(() => {
        throw new Error('schema registry offline');
      });

    const failureResult = controller.validateDataExposed(
      { name: 'Hero' },
      'schema://integration/tests/simple-character',
      { operation: 'customValidation' }
    );

    expect(failureResult.isValid).toBe(false);
    expect(failureResult.errorMessage).toBe(
      'Unable to validate data. Please try again.'
    );
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      context: 'customValidation',
      category: ERROR_CATEGORIES.SYSTEM,
    });

    validateSpy.mockRestore();
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }

    controller.destroy();
  });

  it('attempts recovery for retryable errors and re-initializes after system failures', async () => {
    const { controller } = setupController();
    jest.useFakeTimers();

    controller.attemptRecoveryExposed({
      category: ERROR_CATEGORIES.NETWORK,
      operation: 'loadData',
    });
    jest.advanceTimersByTime(5000);
    expect(controller.retryInvocations).toBe(1);

    controller.setPostInitializeError(null);
    const reinitializeEvent = new Promise((resolve) => {
      controller.eventBus.subscribe('core:controller_initialized', () =>
        resolve(true)
      );
    });

    controller.attemptRecoveryExposed({
      category: ERROR_CATEGORIES.SYSTEM,
      operation: 'initialization',
    });

    jest.advanceTimersByTime(2000);
    await reinitializeEvent;

    expect(controller.reinitializeInvocations).toBeGreaterThanOrEqual(1);
    expect(controller.initializationCount).toBeGreaterThanOrEqual(1);

    controller.destroy();
  });
});
