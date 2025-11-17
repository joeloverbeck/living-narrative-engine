/**
 * @file Base test class for CharacterBuilder controllers
 * @description Provides shared test infrastructure for character builder controllers
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from '../../../common/baseTestBed.js';
import {
  DEFAULT_DESTRUCTION_SEQUENCE,
  DEFAULT_INITIALIZATION_SEQUENCE,
  DESTRUCTION_PHASES,
  LIFECYCLE_PHASES,
} from '../../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';

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
    // Logger mock (ensure available before dependent mocks)
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

    // Controller lifecycle orchestrator mock
    if (!this.mocks.controllerLifecycleOrchestrator) {
      const lifecycleState = {
        isInitialized: false,
        isDestroyed: false,
        isInitializing: false,
        isDestroying: false,
      };
      const initializationHooks = new Map();
      const destructionHooks = new Map();

      const runHooksForPhase = async (map, phase) => {
        const hooks = map.get(phase) || [];
        for (const hook of hooks) {
          await hook();
        }
      };

      const registerHook = (phase, handler) => {
        if (typeof handler !== 'function') {
          return;
        }
        const targetMap = DEFAULT_INITIALIZATION_SEQUENCE.includes(phase) ||
          phase === LIFECYCLE_PHASES.INIT_ERROR
          ? initializationHooks
          : DEFAULT_DESTRUCTION_SEQUENCE.includes(phase)
            ? destructionHooks
            : null;

        if (!targetMap) {
          return;
        }
        if (!targetMap.has(phase)) {
          targetMap.set(phase, []);
        }
        targetMap.get(phase).push(handler);
      };

      this.mocks.controllerLifecycleOrchestrator = {
        initialize: jest.fn().mockImplementation(async () => {
          if (lifecycleState.isDestroyed) {
            throw new Error('Cannot initialize after destruction');
          }
          if (lifecycleState.isInitializing || lifecycleState.isInitialized) {
            return;
          }
          lifecycleState.isInitializing = true;
          for (const phase of DEFAULT_INITIALIZATION_SEQUENCE) {
            await runHooksForPhase(initializationHooks, phase);
          }
          lifecycleState.isInitializing = false;
          lifecycleState.isInitialized = true;
        }),
        destroy: jest.fn().mockImplementation(async () => {
          if (lifecycleState.isDestroyed || lifecycleState.isDestroying) {
            return;
          }
          lifecycleState.isDestroying = true;
          for (const phase of DEFAULT_DESTRUCTION_SEQUENCE) {
            await runHooksForPhase(destructionHooks, phase);
          }
          lifecycleState.isDestroying = false;
          lifecycleState.isDestroyed = true;
          lifecycleState.isInitialized = false;
        }),
        setControllerName: jest.fn(),
        registerHook: jest.fn((phase, handler) => registerHook(phase, handler)),
        createControllerMethodHook: jest.fn(
          (controller, methodName, phaseName, options = {}) => {
            const {
              synchronous = false,
              forwardArguments = false,
              required = false,
            } = options;

            const invoke = (...args) => {
              const method = controller?.[methodName];
              if (typeof method !== 'function') {
                if (required) {
                  throw new Error(
                    `${controller?.constructor?.name || 'Controller'} must implement ${methodName}()`
                  );
                }
                return undefined;
              }
              const invocationArgs = forwardArguments ? args : [];
              return method.apply(controller, invocationArgs);
            };

            if (synchronous) {
              return (...args) => invoke(...args);
            }

            return async (...args) => {
              await invoke(...args);
            };
          }
        ),
        reinitialize: jest.fn().mockImplementation(async () => {
          lifecycleState.isInitialized = false;
          await this.mocks.controllerLifecycleOrchestrator.initialize();
        }),
        resetInitializationState: jest.fn(),
        registerCleanupTask: jest.fn((task) => {
          registerHook(DESTRUCTION_PHASES.CLEANUP_TASKS, task);
        }),
        checkDestroyed: jest.fn().mockReturnValue(false),
        makeDestructionSafe: jest.fn((fn) => fn),
        get isInitialized() {
          return lifecycleState.isInitialized;
        },
        get isDestroyed() {
          return lifecycleState.isDestroyed;
        },
        get isInitializing() {
          return lifecycleState.isInitializing;
        },
        get isDestroying() {
          return lifecycleState.isDestroying;
        },
      };
    }

    // DOM element manager mock
    if (!this.mocks.domElementManager) {
      const resolveDomElement = (elementId) => {
        const byId = document.getElementById(elementId);
        if (byId) {
          return byId;
        }
        const kebabId = elementId.replace(/([A-Z])/g, '-$1').toLowerCase();
        return document.getElementById(kebabId);
      };

      this.mocks.domElementManager = {
        configure: jest.fn(),
        cacheElement: jest.fn(),
        getElement: jest.fn(resolveDomElement),
        addElementClass: jest.fn((elementId, className) => {
          const element = resolveDomElement(elementId);
          if (element) {
            element.classList.add(className);
          }
        }),
        removeElementClass: jest.fn((elementId, className) => {
          const element = resolveDomElement(elementId);
          if (element) {
            element.classList.remove(className);
          }
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
        addEventListener: jest.fn((element, eventType, handler) => {
          element?.addEventListener?.(eventType, handler);
        }),
        addDebouncedListener: jest.fn((element, eventType, handler) => {
          element?.addEventListener?.(eventType, handler);
        }),
        subscribeToEvent: jest.fn((eventBus, eventType, handler) => {
          eventBus?.subscribe?.(eventType, handler);
        }),
      };
    }

    // Async utilities toolkit mock
    if (!this.mocks.asyncUtilitiesToolkit) {
      this.mocks.asyncUtilitiesToolkit = (() => {
        const activeTimeouts = new Set();
        const activeIntervals = new Set();

        return {
          setTimeout: jest.fn((callback, delay) => {
            const id = global.setTimeout(callback, delay);
            activeTimeouts.add(id);
            return id;
          }),
          clearTimeout: jest.fn((id) => {
            global.clearTimeout(id);
            activeTimeouts.delete(id);
          }),
          setInterval: jest.fn((callback, delay) => {
            const id = global.setInterval(callback, delay);
            activeIntervals.add(id);
            return id;
          }),
          clearInterval: jest.fn((id) => {
            global.clearInterval(id);
            activeIntervals.delete(id);
          }),
          getTimerStats: jest.fn().mockReturnValue({
            timeouts: { count: activeTimeouts.size },
            intervals: { count: activeIntervals.size },
            animationFrames: { count: 0 },
          }),
          clearAllTimers: jest.fn(() => {
            activeTimeouts.forEach((id) => global.clearTimeout(id));
            activeIntervals.forEach((id) => global.clearInterval(id));
            activeTimeouts.clear();
            activeIntervals.clear();
          }),
        };
      })();
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
