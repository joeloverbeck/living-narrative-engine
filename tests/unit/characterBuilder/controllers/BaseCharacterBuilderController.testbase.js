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
    this._conceptCounter = 0;
    this._directionCounter = 0;
  }

  /**
   * Setup before each test
   * @returns {Promise<void>}
   */
  async setup() {
    await super.setup();

    // Initialize character builder-specific mocks
    this._initializeCharacterBuilderMocks();

    this.mocks.controllerLifecycleOrchestrator?.resetInitializationState?.();

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

      const resetLifecycleState = () => {
        lifecycleState.isInitialized = false;
        lifecycleState.isDestroyed = false;
        lifecycleState.isInitializing = false;
        lifecycleState.isDestroying = false;
        initializationHooks.clear();
        destructionHooks.clear();
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
        resetInitializationState: jest.fn(() => {
          resetLifecycleState();
        }),
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
      let documentRef = document;
      let elementsRef = Object.create(null);

      const resolveDomElement = (elementId) => {
        if (!documentRef) {
          return null;
        }
        const byId = documentRef.getElementById(elementId);
        if (byId) {
          return byId;
        }
        const kebabId = elementId
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase();
        return documentRef.getElementById(kebabId);
      };

      const resolveBySelector = (selector) => {
        if (!selector || !documentRef) {
          return null;
        }
        if (selector.startsWith('#') && !selector.includes(' ')) {
          return documentRef.getElementById(selector.slice(1));
        }
        return documentRef.querySelector(selector);
      };

      const normalizeElementConfig = (config) => {
        if (typeof config === 'string') {
          return { selector: config, required: true, validate: null };
        }
        return {
          selector: config.selector,
          required: config.required !== false,
          validate: config.validate || null,
        };
      };

      const storeElement = (key, element) => {
        elementsRef[key] = element || null;
        return elementsRef[key];
      };

      const getCachedElement = (key) => {
        if (Object.prototype.hasOwnProperty.call(elementsRef, key)) {
          const cached = elementsRef[key];
          if (cached && !documentRef.body.contains(cached)) {
            elementsRef[key] = null;
            return null;
          }
          return cached;
        }
        return resolveDomElement(key);
      };

      this.mocks.domElementManager = {
        configure: jest.fn((config = {}) => {
          if (config.documentRef) {
            documentRef = config.documentRef;
          }
          if (config.elementsRef) {
            elementsRef = config.elementsRef;
          }
        }),
        cacheElement: jest.fn((key, selector, required = true) => {
          const element = resolveBySelector(selector);
          if (!element && required) {
            throw new Error(`Element not found for selector '${selector}'`);
          }
          return storeElement(key, element || null);
        }),
        cacheElementsFromMap: jest.fn((elementMap = {}, options = {}) => {
          const { continueOnError = true, stopOnFirstError = false } = options;
          const results = {
            cached: {},
            errors: [],
            stats: { total: 0, cached: 0, failed: 0, optional: 0 },
          };

          for (const [key, config] of Object.entries(elementMap)) {
            results.stats.total++;
            const normalized = normalizeElementConfig(config);
            try {
              const element = normalized.selector
                ? resolveBySelector(normalized.selector)
                : resolveDomElement(key);

              if (!element && normalized.required) {
                throw new Error(
                  `Element not found for selector '${normalized.selector}'`
                );
              }

              if (element && normalized.validate) {
                const isValid = normalized.validate(element);
                if (!isValid) {
                  throw new Error(
                    `Custom validation failed for element '${key}'`
                  );
                }
              }

              storeElement(key, element || null);

              if (element) {
                results.cached[key] = element;
                results.stats.cached++;
              } else {
                results.stats.optional++;
              }
            } catch (error) {
              results.stats.failed++;
              results.errors.push({
                key,
                error: error.message,
                selector:
                  typeof config === 'string' ? config : config.selector || key,
              });

              const shouldHalt =
                stopOnFirstError || (!continueOnError && normalized.required);

              if (shouldHalt) {
                const batchError = new Error(
                  `Element caching failed for '${key}': ${error.message}`
                );
                batchError.results = results;
                throw batchError;
              }
            }
          }

          return results;
        }),
        normalizeElementConfig: jest.fn(normalizeElementConfig),
        getElement: jest.fn((elementId) => getCachedElement(elementId)),
        addElementClass: jest.fn((elementId, className) => {
          const element = getCachedElement(elementId);
          if (element) {
            element.classList.add(className);
          }
        }),
        removeElementClass: jest.fn((elementId, className) => {
          const element = getCachedElement(elementId);
          if (element) {
            element.classList.remove(className);
          }
        }),
        clearCache: jest.fn(() => {
          const keys = Object.keys(elementsRef);
          for (const key of keys) {
            delete elementsRef[key];
          }
          return keys.length;
        }),
        validateElementCache: jest.fn(() => {
          const results = { valid: [], invalid: [], total: 0 };
          for (const [key, element] of Object.entries(elementsRef)) {
            results.total++;
            if (element && documentRef.body.contains(element)) {
              results.valid.push(key);
            } else {
              results.invalid.push(key);
            }
          }
          return results;
        }),
        getElementsSnapshot: jest
          .fn()
          .mockImplementation(() => ({ ...elementsRef })),
        validateElement: jest.fn((element, key) => {
          if (!element || !documentRef.body.contains(element)) {
            throw new Error(`Element '${key}' is not attached to the DOM`);
          }
          return true;
        }),
        setElementEnabled: jest.fn((elementId, enabled = true) => {
          const element = getCachedElement(elementId);
          if (element && 'disabled' in element) {
            element.disabled = !enabled;
            return true;
          }
          return false;
        }),
        showElement: jest.fn((elementId) => {
          const element = getCachedElement(elementId);
          if (element) {
            element.style.display = 'block';
            return true;
          }
          return false;
        }),
        hideElement: jest.fn((elementId) => {
          const element = getCachedElement(elementId);
          if (element) {
            element.style.display = 'none';
            return true;
          }
          return false;
        }),
        setElementText: jest.fn((elementId, text) => {
          const element = getCachedElement(elementId);
          if (element) {
            element.textContent = text;
            return true;
          }
          return false;
        }),
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
        executeWithErrorHandling: jest.fn(async (operation) => {
          if (typeof operation === 'function') {
            return await operation();
          }
          return undefined;
        }),
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
        deleteThematicDirection: jest.fn().mockResolvedValue(true),
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
   * Build a character concept test fixture
   * @param {object} [overrides]
   * @returns {object}
   */
  buildCharacterConcept(overrides = {}) {
    this._conceptCounter += 1;
    const timestamp = new Date(Date.now() - this._conceptCounter * 1000).toISOString();

    const defaults = {
      id: `concept-${this._conceptCounter}`,
      concept: `Test concept idea ${this._conceptCounter}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'draft',
      thematicDirections: [],
      metadata: {},
    };

    return {
      ...defaults,
      ...overrides,
      thematicDirections:
        overrides.thematicDirections ?? defaults.thematicDirections,
      metadata: overrides.metadata ?? defaults.metadata,
    };
  }

  /**
   * Build a thematic direction test fixture
   * @param {object} [overrides]
   * @returns {object}
   */
  buildThematicDirection(overrides = {}) {
    this._directionCounter += 1;
    const defaults = {
      id: `direction-${this._directionCounter}`,
      title: `Direction ${this._directionCounter}`,
      description: `Sample direction description ${this._directionCounter}`,
      themes: ['courage', 'growth'],
      tone: 'dramatic',
      coreTension: 'internal vs external',
      uniqueTwist: 'hidden lineage revealed',
      narrativePotential: 'epic franchise',
    };

    return {
      ...defaults,
      ...overrides,
      themes: overrides.themes ?? defaults.themes,
    };
  }

  /**
   * Dispatch a click event against a selector or element.
   * @param {string|Element} target
   * @returns {Element}
   */
  click(target) {
    const element =
      typeof target === 'string' ? document.querySelector(target) : target;

    if (!element) {
      throw new Error(`Unable to find element for selector '${target}'`);
    }

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return element;
  }

  /**
   * Await a simple timeout to allow async DOM flows to settle.
   * @param {number} durationMs
   * @returns {Promise<void>}
   */
  async wait(durationMs = 0) {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
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
