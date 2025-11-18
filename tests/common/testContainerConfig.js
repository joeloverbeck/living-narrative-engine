/**
 * @file Lightweight container configuration for testing
 * @description Provides optimized dependency injection setup for test environments
 */

import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../src/logging/consoleLogger.js';
import { SafeEventDispatcher } from '../../src/events/safeEventDispatcher.js';
import { AsyncUtilitiesToolkit } from '../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { DOMElementManager } from '../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../src/characterBuilder/services/eventListenerRegistry.js';
import { ControllerLifecycleOrchestrator } from '../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { ErrorHandlingStrategy } from '../../src/characterBuilder/services/errorHandlingStrategy.js';
import { PerformanceMonitor } from '../../src/characterBuilder/services/performanceMonitor.js';
import { ValidationService } from '../../src/characterBuilder/services/validationService.js';
import { MemoryManager } from '../../src/characterBuilder/services/memoryManager.js';

const ERROR_CATEGORIES = Object.freeze({
  VALIDATION: 'validation',
  NETWORK: 'network',
  SYSTEM: 'system',
  USER: 'user',
  PERMISSION: 'permission',
  NOT_FOUND: 'not_found',
});

const ERROR_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
});

/**
 * Creates a lightweight container configuration optimized for testing
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.enableLogging - Whether to enable detailed logging (default: false)
 * @param {object} options.mockServices - Additional mock services to register
 * @returns {Promise<AppContainer>}
 */
export async function createTestContainer(options = {}) {
  const { enableLogging = false, mockServices = {} } = options;

  const container = new AppContainer();

  // Create minimal logger (silent by default for performance)
  const logLevel = enableLogging ? LogLevel.DEBUG : LogLevel.ERROR;
  const logger = new ConsoleLogger(logLevel);
  container.register(tokens.ILogger, () => logger);

  // Create mock validated event dispatcher
  const mockValidatedDispatcher = {
    dispatch: jest.fn().mockImplementation((eventType, payload) => {
      // Immediately call subscribers
      if (mockValidatedDispatcher._subscribers[eventType]) {
        mockValidatedDispatcher._subscribers[eventType].forEach((callback) => {
          setImmediate(() => callback({ type: eventType, payload }));
        });
      }
    }),
    subscribe: jest.fn().mockImplementation((eventType, callback) => {
      if (!mockValidatedDispatcher._subscribers[eventType]) {
        mockValidatedDispatcher._subscribers[eventType] = [];
      }
      mockValidatedDispatcher._subscribers[eventType].push(callback);

      // Return unsubscribe function
      return () => {
        const index =
          mockValidatedDispatcher._subscribers[eventType].indexOf(callback);
        if (index > -1) {
          mockValidatedDispatcher._subscribers[eventType].splice(index, 1);
        }
      };
    }),
    unsubscribe: jest.fn().mockImplementation((eventType, callback) => {
      if (mockValidatedDispatcher._subscribers[eventType]) {
        const index =
          mockValidatedDispatcher._subscribers[eventType].indexOf(callback);
        if (index > -1) {
          mockValidatedDispatcher._subscribers[eventType].splice(index, 1);
        }
      }
    }),
    _subscribers: {},
  };

  // Create safe event dispatcher
  const eventBus = new SafeEventDispatcher({
    validatedEventDispatcher: mockValidatedDispatcher,
    logger,
  });
  container.register(tokens.ISafeEventDispatcher, () => eventBus);
  container.register(tokens.IEventDispatcher, () => eventBus);

  // Register minimal schema validator mock
  const mockSchemaValidator = {
    validate: () => ({ isValid: true, errors: [] }),
    validateAgainstSchema: () => ({ isValid: true, errors: [] }),
    addSchema: () => {},
    removeSchema: () => {},
    listSchemas: () => [],
    getSchema: () => null,
  };
  container.register(tokens.ISchemaValidator, () => mockSchemaValidator);

  // Register controller infrastructure dependencies added by base controller refactor
  container.register(
    tokens.AsyncUtilitiesToolkit,
    () =>
      new AsyncUtilitiesToolkit({
        logger,
        defaultWait: 1,
        instrumentation: { logTimerEvents: false },
      }),
    { lifecycle: 'transient' }
  );

  container.register(
    tokens.DOMElementManager,
    () =>
      new DOMElementManager({
        logger,
        documentRef: document,
        performanceRef: performance,
        contextName: 'TestDOMElementManager',
      }),
    { lifecycle: 'transient' }
  );

  container.register(
    tokens.EventListenerRegistry,
    () =>
      new EventListenerRegistry({
        logger,
        asyncUtilities: container.resolve(tokens.AsyncUtilitiesToolkit),
        contextName: 'TestEventListenerRegistry',
      }),
    { lifecycle: 'transient' }
  );

  container.register(
    tokens.ControllerLifecycleOrchestrator,
    () =>
      new ControllerLifecycleOrchestrator({
        logger,
        eventBus,
      }),
    { lifecycle: 'transient' }
  );

  container.register(
    tokens.PerformanceMonitor,
    () =>
      new PerformanceMonitor({
        logger,
        eventBus,
        threshold: 25,
        contextName: 'TestPerformanceMonitor',
      }),
    { lifecycle: 'transient' }
  );

  container.register(
    tokens.MemoryManager,
    () =>
      new MemoryManager({
        logger,
        contextName: 'TestMemoryManager',
      }),
    { lifecycle: 'transient' }
  );

  container.register(
    tokens.ErrorHandlingStrategy,
    () =>
      new ErrorHandlingStrategy({
        logger,
        eventBus,
        controllerName: 'TestController',
        errorCategories: ERROR_CATEGORIES,
        errorSeverity: ERROR_SEVERITY,
        recoveryHandlers: {},
      }),
    { lifecycle: 'transient' }
  );

  container.register(
    tokens.ValidationService,
    () =>
      new ValidationService({
        schemaValidator: container.resolve(tokens.ISchemaValidator),
        logger,
        handleError: (error) => logger.error('Validation error', error),
        errorCategories: ERROR_CATEGORIES,
      }),
    { lifecycle: 'transient' }
  );

  // Register any additional mock services
  for (const [token, service] of Object.entries(mockServices)) {
    container.register(token, () => service);
  }

  return container;
}

/**
 *
 * @param container
 */
export function resolveControllerDependencies(container) {
  return {
    schemaValidator: container.resolve(tokens.ISchemaValidator),
    controllerLifecycleOrchestrator: container.resolve(
      tokens.ControllerLifecycleOrchestrator
    ),
    domElementManager: container.resolve(tokens.DOMElementManager),
    eventListenerRegistry: container.resolve(tokens.EventListenerRegistry),
    asyncUtilitiesToolkit: container.resolve(tokens.AsyncUtilitiesToolkit),
    performanceMonitor: container.resolve(tokens.PerformanceMonitor),
    memoryManager: container.resolve(tokens.MemoryManager),
    errorHandlingStrategy: container.resolve(tokens.ErrorHandlingStrategy),
    validationService: container.resolve(tokens.ValidationService),
  };
}

/**
 * Creates a mock character builder service with fast async operations
 *
 * @param {object} options - Mock service options
 * @param {Array} options.existingConcepts - Pre-existing concepts to return
 * @returns {object} Mock character builder service
 */
export function createMockCharacterBuilderService(options = {}) {
  const { existingConcepts = [] } = options;

  let concepts = [...existingConcepts];
  let nextId = 1000;

  return {
    // Core required methods with immediate resolution
    getAllCharacterConcepts: jest
      .fn()
      .mockImplementation(() => Promise.resolve([...concepts])),

    createCharacterConcept: jest.fn().mockImplementation((conceptText) => {
      const newConcept = {
        id: `concept-${nextId++}`,
        concept: conceptText,
        created: Date.now(),
        updated: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      concepts.push(newConcept);
      return Promise.resolve(newConcept);
    }),

    updateCharacterConcept: jest.fn().mockImplementation((id, conceptText) => {
      const concept = concepts.find((c) => c.id === id);
      if (concept) {
        concept.concept = conceptText;
        concept.updated = Date.now();
        concept.updatedAt = Date.now();
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }),

    deleteCharacterConcept: jest.fn().mockImplementation((id) => {
      const index = concepts.findIndex((c) => c.id === id);
      if (index >= 0) {
        concepts.splice(index, 1);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }),

    getCharacterConcept: jest.fn().mockImplementation((id) => {
      const concept = concepts.find((c) => c.id === id);
      return Promise.resolve(concept || null);
    }),

    // Additional methods for compatibility
    getThematicDirections: jest.fn().mockResolvedValue([]),
    generateThematicDirections: jest.fn().mockResolvedValue([]),
    updateThematicDirection: jest
      .fn()
      .mockImplementation((directionId, updates = {}) =>
        Promise.resolve({ id: directionId, ...updates })
      ),
    initialize: jest.fn().mockResolvedValue(undefined),

    // Test utility methods
    _testHelpers: {
      getConcepts: () => [...concepts],
      setConcepts: (newConcepts) => {
        concepts = [...newConcepts];
      },
      clearConcepts: () => {
        concepts = [];
      },
    },
  };
}

/**
 * Creates a fast-resolving IndexedDB mock for testing
 *
 * @returns {object} Mock IndexedDB implementation
 */
export function createFastIndexedDBMock() {
  const mockDB = {
    createObjectStore: jest.fn(() => ({
      createIndex: jest.fn(),
    })),
    objectStoreNames: {
      contains: jest.fn(() => false),
    },
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => ({
        put: jest.fn(() => {
          const request = { onsuccess: null, onerror: null };
          // Resolve immediately instead of using setTimeout
          setImmediate(() => request.onsuccess?.());
          return request;
        }),
        get: jest.fn(() => {
          const request = { onsuccess: null, onerror: null, result: null };
          setImmediate(() => request.onsuccess?.());
          return request;
        }),
        getAll: jest.fn(() => {
          const request = { onsuccess: null, onerror: null, result: [] };
          setImmediate(() => request.onsuccess?.());
          return request;
        }),
        delete: jest.fn(() => {
          const request = { onsuccess: null, onerror: null };
          setImmediate(() => request.onsuccess?.());
          return request;
        }),
        index: jest.fn(() => ({
          getAll: jest.fn(() => {
            const request = { onsuccess: null, onerror: null, result: [] };
            setImmediate(() => request.onsuccess?.());
            return request;
          }),
        })),
      })),
      oncomplete: null,
      onerror: null,
    })),
  };

  const mockRequest = {
    result: mockDB,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  const mockIndexedDB = {
    open: jest.fn().mockReturnValue(mockRequest),
    deleteDatabase: jest.fn(),
  };

  // Trigger callbacks immediately instead of using setTimeout
  setImmediate(() => {
    if (mockRequest.onupgradeneeded) {
      mockRequest.onupgradeneeded({ target: { result: mockDB } });
    }
    if (mockRequest.onsuccess) {
      mockRequest.onsuccess();
    }
  });

  return mockIndexedDB;
}

/**
 * Creates a minimal DOM setup for modal testing
 *
 * @param {object} options - DOM setup options
 * @param {boolean} options.includeSearchElements - Include search-related elements
 * @param {boolean} options.includeStatsElements - Include statistics elements
 * @returns {string} HTML string for DOM setup
 */
export function createMinimalModalDOM(options = {}) {
  const { includeSearchElements = true, includeStatsElements = true } = options;

  let html = `
    <div id="character-concepts-manager-container">
      <div id="concepts-container"></div>
      <div id="concepts-results"></div>
      <div id="empty-state"></div>
      <div id="loading-state" style="display: none;"></div>
      <div id="error-state" style="display: none;"></div>
      <div id="results-state" style="display: none;"></div>
      <div id="error-message-text"></div>
      <button id="create-concept-btn">Create Concept</button>
      <button id="create-first-btn">Create First</button>
      <button id="retry-btn">Retry</button>
      <button id="back-to-menu-btn">Back</button>
  `;

  if (includeSearchElements) {
    html += `<input id="concept-search" type="text" />`;
  }

  if (includeStatsElements) {
    html += `
      <div class="stats-display"></div>
      <span id="total-concepts">0</span>
      <span id="concepts-with-directions">0</span>
      <span id="total-directions">0</span>
    `;
  }

  html += `
      <!-- Create/Edit Modal -->
      <div id="concept-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <h2 id="concept-modal-title">Create Character Concept</h2>
          <form id="concept-form">
            <textarea id="concept-text" required minlength="10"></textarea>
            <span id="char-count">0/1000</span>
            <div id="concept-help" class="input-help">Describe your character concept</div>
            <div id="concept-error"></div>
            <button id="save-concept-btn" type="submit">Save Concept</button>
            <button id="cancel-concept-btn" type="button">Cancel</button>
            <button id="close-concept-modal" type="button">×</button>
          </form>
        </div>
      </div>
      
      <!-- Delete Modal -->
      <div id="delete-confirmation-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <h2 id="delete-modal-title">Confirm Deletion</h2>
          <div id="delete-modal-message"></div>
          <button id="confirm-delete-btn">Delete</button>
          <button id="cancel-delete-btn">Cancel</button>
          <button id="close-delete-modal">×</button>
        </div>
      </div>
    </div>
  `;

  return html;
}

/**
 * Sets up fast form validation with reduced debounce for testing
 *
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 50)
 * @returns {object} Mock form validation helper
 */
export function createFastFormValidation(debounceMs = 50) {
  return {
    validateTextInput: (value, minLength = 0, maxLength = Infinity) => {
      if (!value || typeof value !== 'string') {
        return { isValid: false, error: 'Input is required' };
      }

      const trimmedValue = value.trim();
      const length = trimmedValue.length;

      if (length < minLength) {
        return {
          isValid: false,
          error: `Input must be at least ${minLength} characters`,
        };
      }

      if (length > maxLength) {
        return {
          isValid: false,
          error: `Input must be no more than ${maxLength} characters`,
        };
      }

      return { isValid: true };
    },

    setupValidation: function (textarea, saveButton, options = {}) {
      const { debounceMs: customDebounce = debounceMs } = options;
      let timeoutId;

      const validateInput = () => {
        const validation = this.validateTextInput(textarea.value, 50, 3000);
        saveButton.disabled = !validation.isValid;
      };

      textarea.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(validateInput, customDebounce);
      });

      // Initial validation
      validateInput();
    },
  };
}
