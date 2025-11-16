/**
 * @file Base test class for CharacterBuilder controllers
 * @description Provides shared test infrastructure for character builder controllers
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from '../../../common/baseTestBed.js';

/**
 * Base test class for CharacterBuilder controllers
 * Provides common setup for controller testing
 */
export class BaseCharacterBuilderControllerTestBase extends BaseTestBed {
  constructor() {
    super();
    this.domElements = new Map();
  }

  /**
   * Setup before each test
   * @returns {Promise<void>}
   */
  async setup() {
    await super.setup();

    // Initialize character builder-specific mocks
    this._initializeCharacterBuilderMocks();

    // Expose mocks as mockDependencies for compatibility with existing tests
    this.mockDependencies = this.mocks;
  }

  /**
   * Initialize mocks specific to character builder controllers
   * @private
   */
  _initializeCharacterBuilderMocks() {
    // Controller lifecycle orchestrator mock
    if (!this.mocks.controllerLifecycleOrchestrator) {
      const lifecycleState = {
        isInitialized: false,
        isDestroyed: false,
        isInitializing: false,
        isDestroying: false,
      };
      
      this.mocks.controllerLifecycleOrchestrator = {
        initialize: jest.fn().mockImplementation(async () => {
          lifecycleState.isInitialized = true;
        }),
        destroy: jest.fn().mockImplementation(() => {
          lifecycleState.isDestroyed = true;
        }),
        setControllerName: jest.fn(),
        registerHook: jest.fn(),
        createControllerMethodHook: jest.fn((controller, methodName) => async () => {
          if (typeof controller[methodName] === 'function') {
            await controller[methodName]();
          }
        }),
        reinitialize: jest.fn().mockResolvedValue(undefined),
        resetInitializationState: jest.fn(),
        registerCleanupTask: jest.fn(),
        checkDestroyed: jest.fn().mockReturnValue(false),
        makeDestructionSafe: jest.fn((fn) => fn),
        get isInitialized() { return lifecycleState.isInitialized; },
        get isDestroyed() { return lifecycleState.isDestroyed; },
        get isInitializing() { return lifecycleState.isInitializing; },
        get isDestroying() { return lifecycleState.isDestroying; },
      };
    }

    // DOM element manager mock
    if (!this.mocks.domElementManager) {
      this.mocks.domElementManager = {
        configure: jest.fn(),
        cacheElement: jest.fn(),
        getElement: jest.fn((elementId) => {
          // Return actual DOM element by ID or data attribute
          const byId = document.getElementById(elementId);
          if (byId) return byId;

          // Try with kebab-case conversion (e.g., directionsResults -> directions-results)
          const kebabId = elementId.replace(/([A-Z])/g, '-$1').toLowerCase();
          return document.getElementById(kebabId);
        }),
        clearCache: jest.fn(),
        validateElementCache: jest.fn(),
        getElementsSnapshot: jest.fn().mockReturnValue({}),
        cacheElementsFromMap: jest.fn(),
        normalizeElementConfig: jest.fn(),
        validateElement: jest.fn(),
        setElementEnabled: jest.fn(),
        showElement: jest.fn(),
        hideElement: jest.fn(),
      };
    }

    // Event listener registry mock
    if (!this.mocks.eventListenerRegistry) {
      this.mocks.eventListenerRegistry = {
        setContextName: jest.fn(),
        detachEventBusListeners: jest.fn(),
        destroy: jest.fn(),
      };
    }

    // Async utilities toolkit mock
    if (!this.mocks.asyncUtilitiesToolkit) {
      this.mocks.asyncUtilitiesToolkit = {
        getTimerStats: jest.fn().mockReturnValue({
          timeouts: { count: 0 },
          intervals: { count: 0 },
          animationFrames: { count: 0 },
        }),
        clearAllTimers: jest.fn(),
      };
    }

    // Performance monitor mock
    if (!this.mocks.performanceMonitor) {
      this.mocks.performanceMonitor = {
        configure: jest.fn(),
        clearData: jest.fn(),
      };
    }

    // Memory manager mock
    if (!this.mocks.memoryManager) {
      this.mocks.memoryManager = {
        setContextName: jest.fn(),
        clear: jest.fn(),
      };
    }

    // Error handling strategy mock
    if (!this.mocks.errorHandlingStrategy) {
      this.mocks.errorHandlingStrategy = {
        configureContext: jest.fn(),
        handleError: jest.fn(),
        buildErrorDetails: jest.fn(),
        categorizeError: jest.fn(),
        generateUserMessage: jest.fn(),
        logError: jest.fn(),
        showErrorToUser: jest.fn(),
        handleServiceError: jest.fn(),
        executeWithErrorHandling: jest.fn(),
        isRetryableError: jest.fn(),
        determineRecoverability: jest.fn(),
        isRecoverableError: jest.fn(),
        attemptErrorRecovery: jest.fn(),
        createError: jest.fn(),
        wrapError: jest.fn(),
        resetLastError: jest.fn(),
      };
    }

    // Validation service mock
    if (!this.mocks.validationService) {
      this.mocks.validationService = {
        configure: jest.fn(),
        validateData: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
        formatValidationErrors: jest.fn(),
        buildValidationErrorMessage: jest.fn(),
      };
    }
    // Character builder service mock
    if (!this.mocks.characterBuilderService) {
      this.mocks.characterBuilderService = {
        initialize: jest.fn().mockResolvedValue(true),
        getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
        createCharacterConcept: jest.fn().mockResolvedValue('concept-id'),
        updateCharacterConcept: jest.fn().mockResolvedValue(true),
        deleteCharacterConcept: jest.fn().mockResolvedValue(true),
        getCharacterConcept: jest.fn().mockResolvedValue(null),
        generateThematicDirections: jest.fn().mockResolvedValue([]),
        getThematicDirections: jest.fn().mockResolvedValue([]),
        getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([]),
        getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
        getOrphanedThematicDirections: jest.fn().mockResolvedValue([]),
        saveCoreMotivations: jest.fn().mockResolvedValue([]),
        getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
        removeCoreMotivationItem: jest.fn().mockResolvedValue(true),
        clearCoreMotivationsForDirection: jest.fn().mockResolvedValue(0),
      };
    }

    // Logger mock
    if (!this.mocks.logger) {
      this.mocks.logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
      };
    }

    // Event bus mock
    if (!this.mocks.eventBus) {
      this.mocks.eventBus = {
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };
    }

    // Schema validator mock
    if (!this.mocks.schemaValidator) {
      this.mocks.schemaValidator = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      };
    }
  }

  /**
   * Add DOM element for testing
   * @param {string} html - HTML content to add to document
   */
  addDOMElement(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    this.domElements.set(container, true);
  }

  /**
   * Cleanup after each test
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Remove all DOM elements
    for (const element of this.domElements.keys()) {
      element.remove();
    }
    this.domElements.clear();

    // Clear document body
    document.body.innerHTML = '';

    await super.cleanup();
  }
}
