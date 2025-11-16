/**
 * @file Base class for all character builder page controllers
 * @description Provides common functionality and standardized patterns
 * @see specs/base-character-builder-controller.spec.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  MissingDependencyError,
  InvalidDependencyError,
} from '../../errors/dependencyErrors.js';
import {
  UIStateManager,
  UI_STATES,
} from '../../shared/characterBuilder/uiStateManager.js';
import { DOMElementManager } from '../services/domElementManager.js';
import { EventListenerRegistry } from '../services/eventListenerRegistry.js';
import {
  ControllerLifecycleOrchestrator,
  LIFECYCLE_PHASES,
  DESTRUCTION_PHASES,
} from '../services/controllerLifecycleOrchestrator.js';
import { ErrorHandlingStrategy } from '../services/errorHandlingStrategy.js';
import {
  AsyncUtilitiesToolkit,
  registerToolkitForOwner,
  unregisterToolkitForOwner,
} from '../services/asyncUtilitiesToolkit.js';
import { PerformanceMonitor } from '../services/performanceMonitor.js';
import { ValidationService } from '../services/validationService.js';
import { MemoryManager } from '../services/memoryManager.js';

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../services/controllerLifecycleOrchestrator.js').ControllerLifecycleOrchestrator} ControllerLifecycleOrchestrator */

/**
 * Error categories for consistent handling
 *
 * @readonly
 * @enum {string}
 */
export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  SYSTEM: 'system',
  USER: 'user',
  PERMISSION: 'permission',
  NOT_FOUND: 'not_found',
};

/**
 * Error severity levels
 *
 * @readonly
 * @enum {string}
 */
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

/**
 * Base class for all character builder page controllers
 * Provides common functionality and standardized patterns
 *
 * @abstract
 */
export class BaseCharacterBuilderController {
  // Private fields - use getter methods for subclass access
  /** @private @type {ILogger} */
  #logger;

  /** @private @type {CharacterBuilderService} */
  #characterBuilderService;

  /** @private @type {ISafeEventDispatcher} */
  #eventBus;

  /** @private @type {ISchemaValidator} */
  #schemaValidator;

  /** @private @type {object} */
  #additionalServices;

  /** @private @type {object} */
  #elements = {};

  /** @private @type {DOMElementManager|null} */
  #domElementManager = null;

  /** @private @type {ControllerLifecycleOrchestrator} */
  #lifecycle;

  /** @private @type {EventListenerRegistry|null} */
  #eventListenerRegistry = null;

  /** @private @type {UIStateManager} */
  #uiStateManager = null;

  /** @private @type {AsyncUtilitiesToolkit|null} */
  #asyncUtilitiesToolkit = null;

  /** @private @type {PerformanceMonitor|null} */
  #performanceMonitor = null;

  /** @private @type {MemoryManager|null} */
  #memoryManager = null;

  /** @private @type {ErrorHandlingStrategy|null} */
  #errorHandlingStrategy = null;

  /** @private @type {ValidationService|null} */
  #validationService = null;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator
   * @param {ControllerLifecycleOrchestrator} dependencies.controllerLifecycleOrchestrator - Lifecycle orchestrator (required)
   * @param dependencies.lifecycleHooks
   * @param {object} [dependencies.additionalServices] - Page-specific services
   * @param {DOMElementManager} dependencies.domElementManager - DOM helper service (required)
   * @param {EventListenerRegistry} dependencies.eventListenerRegistry - Event listener registry service (required)
   * @param {AsyncUtilitiesToolkit} dependencies.asyncUtilitiesToolkit - Async toolkit (required)
   * @param {PerformanceMonitor} dependencies.performanceMonitor - Performance monitor (required)
   * @param {MemoryManager} dependencies.memoryManager - Memory helper (required)
   * @param {ErrorHandlingStrategy} dependencies.errorHandlingStrategy - Shared error handler (required)
   * @param {ValidationService} dependencies.validationService - Validation helper (required)
   */
  constructor({
    logger,
    characterBuilderService,
    eventBus,
    schemaValidator,
    controllerLifecycleOrchestrator,
    lifecycleHooks = {},
    domElementManager,
    eventListenerRegistry,
    asyncUtilitiesToolkit,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
    ...additionalServices
  }) {
    // Validate required dependencies
    this.#validateCoreDependencies({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
    });

    // Store validated core dependencies
    this.#logger = logger;
    this.#characterBuilderService = characterBuilderService;
    this.#eventBus = eventBus;
    this.#schemaValidator = schemaValidator;

    // Validate and store additional services
    // Subclasses can override #getAdditionalServiceValidationRules()
    const validationRules = this.#getAdditionalServiceValidationRules();
    this.#additionalServices = this.#validateAdditionalServices(
      additionalServices,
      validationRules
    );

    // Validate required service dependencies
    this.#validateRequiredServices({
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    });

    this.#lifecycle = controllerLifecycleOrchestrator;
    this.#lifecycle.setControllerName(this.constructor.name);
    this.#applyLifecycleHookConfiguration(lifecycleHooks);

    this.#configureInjectedServices({
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    });

    this.#configureLifecycleHooks();

    // Log successful initialization
    this.#logger.info(
      `${this.constructor.name}: Successfully created with dependencies`,
      {
        coreServices: [
          'logger',
          'characterBuilderService',
          'eventBus',
          'schemaValidator',
        ],
        additionalServices: Object.keys(this.#additionalServices),
      }
    );
  }

  /**
   * Validate required service dependencies.
   *
   * @private
   * @param {object} services
   * @throws {MissingDependencyError} If any required service is missing
   */
  #validateRequiredServices(services) {
    const {
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    } = services;

    const requiredServices = {
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    };

    for (const [serviceName, service] of Object.entries(requiredServices)) {
      if (!service) {
        throw new MissingDependencyError(
          serviceName,
          this.constructor.name,
          `${serviceName} must be injected via DI. Register it in the dependency injection container.`
        );
      }
    }
  }

  /**
   * Configure injected services so they adopt the controller context.
   *
   * @private
   * @param {object} services
   */
  #configureInjectedServices(services) {
    const {
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    } = services;

    const documentRef = typeof document !== 'undefined' ? document : null;
    const performanceRef =
      typeof performance !== 'undefined' ? performance : null;

    try {
      domElementManager.configure?.({
        documentRef: documentRef ?? undefined,
        performanceRef: performanceRef ?? undefined,
        elementsRef: this.#elements,
        contextName: `${this.constructor.name}:DOMElementManager`,
      });
    } catch (error) {
      this.#logger.warn(
        `${this.constructor.name}: Failed to configure injected DOMElementManager`,
        error
      );
    }
    this.#domElementManager = domElementManager;

    eventListenerRegistry.setContextName?.(
      `${this.constructor.name}:EventListeners`
    );
    this.#eventListenerRegistry = eventListenerRegistry;

    this.#asyncUtilitiesToolkit = asyncUtilitiesToolkit;
    registerToolkitForOwner(this, asyncUtilitiesToolkit);

    performanceMonitor.configure?.({
      contextName: `${this.constructor.name}:PerformanceMonitor`,
      eventBus: this.#eventBus,
    });
    this.#performanceMonitor = performanceMonitor;

    memoryManager.setContextName?.(
      `${this.constructor.name}:MemoryManager`
    );
    this.#memoryManager = memoryManager;

    errorHandlingStrategy.configureContext?.({
      uiStateManager: this.#uiStateManager,
      showError:
        typeof this._showError === 'function'
          ? (message, details) => this._showError(message, details)
          : null,
      showState:
        typeof this._showState === 'function'
          ? (state, payload) => this._showState(state, payload)
          : null,
      dispatchErrorEvent:
        typeof this._dispatchErrorEvent === 'function'
          ? (details) => this._dispatchErrorEvent(details)
          : null,
      controllerName: this.constructor.name,
      errorCategories: ERROR_CATEGORIES,
      errorSeverity: ERROR_SEVERITY,
      recoveryHandlers: this.#buildDefaultRecoveryHandlers(),
    });
    this.#errorHandlingStrategy = errorHandlingStrategy;

    validationService.configure?.({
      handleError: this._handleError.bind(this),
      errorCategories: ERROR_CATEGORIES,
    });
    this.#validationService = validationService;
  }

  /**
   * Apply lifecycle hook configuration when orchestrator injected.
   *
   * @private
   * @param {Record<string, Function|Function[]>} hooks
   */
  #applyLifecycleHookConfiguration(hooks) {
    if (!hooks || typeof hooks !== 'object') {
      return;
    }

    Object.entries(hooks).forEach(([phase, value]) => {
      if (!value) {
        return;
      }

      const hookList = Array.isArray(value) ? value : [value];
      hookList.forEach((hook) => {
        if (typeof hook === 'function') {
          this.#lifecycle.registerHook(phase, hook);
        }
      });
    });
  }

  /**
   * Configure lifecycle orchestrator bridges.
   *
   * @private
   */
  #configureLifecycleHooks() {
    const createAsyncHook = (methodName, phaseName, options = {}) =>
      this.#lifecycle.createControllerMethodHook(
        this,
        methodName,
        phaseName,
        options
      );

    const createSyncHook = (methodName, phaseName) =>
      this.#lifecycle.createControllerMethodHook(this, methodName, phaseName, {
        synchronous: true,
      });

    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.PRE_INIT,
      createAsyncHook('_preInitialize', 'pre-initialization')
    );
    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.CACHE_ELEMENTS,
      createAsyncHook('_cacheElements', 'element caching', { required: true })
    );
    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.INIT_SERVICES,
      createAsyncHook('_initializeServices', 'service initialization')
    );
    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.SETUP_EVENT_LISTENERS,
      createAsyncHook('_setupEventListeners', 'event listener setup', {
        required: true,
      })
    );
    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.LOAD_DATA,
      createAsyncHook('_loadInitialData', 'initial data loading')
    );
    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.INIT_UI,
      createAsyncHook('_initializeUIState', 'UI state initialization')
    );
    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.POST_INIT,
      createAsyncHook('_postInitialize', 'post-initialization')
    );
    this.#lifecycle.registerHook(
      LIFECYCLE_PHASES.INIT_ERROR,
      createAsyncHook(
        '_handleInitializationError',
        'initialization error handling',
        { forwardArguments: true }
      )
    );

    this.#lifecycle.registerHook(
      DESTRUCTION_PHASES.PRE_DESTROY,
      createSyncHook('_preDestroy', 'pre-destruction')
    );
    this.#lifecycle.registerHook(
      DESTRUCTION_PHASES.CANCEL_OPERATIONS,
      createSyncHook(
        '_cancelPendingOperations',
        'pending operations cancellation'
      )
    );
    this.#lifecycle.registerHook(
      DESTRUCTION_PHASES.REMOVE_LISTENERS,
      createSyncHook('_removeAllEventListeners', 'event listener removal')
    );
    this.#lifecycle.registerHook(
      DESTRUCTION_PHASES.CLEANUP_SERVICES,
      createSyncHook('_cleanupServices', 'service cleanup')
    );
    this.#lifecycle.registerHook(
      DESTRUCTION_PHASES.CLEAR_ELEMENTS,
      createSyncHook('_clearElementCache', 'element cache clearing')
    );
    this.#lifecycle.registerHook(
      DESTRUCTION_PHASES.CLEAR_REFERENCES,
      createSyncHook('_clearReferences', 'reference clearing')
    );
    this.#lifecycle.registerHook(
      DESTRUCTION_PHASES.POST_DESTROY,
      createSyncHook('_postDestroy', 'post-destruction')
    );
  }

  /**
   * Validate core dependencies required by all character builder controllers
   *
   * @private
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {CharacterBuilderService} dependencies.characterBuilderService
   * @param {ISafeEventDispatcher} dependencies.eventBus
   * @param {ISchemaValidator} dependencies.schemaValidator
   * @throws {MissingDependencyError|InvalidDependencyError} If any required dependency is missing or invalid
   */
  #validateCoreDependencies(dependencies) {
    const validationStartTime = performance.now();

    const { logger, characterBuilderService, eventBus, schemaValidator } =
      dependencies;

    // First validate logger since other validations depend on it
    if (!logger) {
      throw new MissingDependencyError('logger', this.constructor.name);
    }

    // Validate logger interface
    try {
      // Note: validateDependency uses a third parameter for the logger,
      // but during logger validation we can't use it for logging
      validateDependency(logger, 'ILogger', null, {
        requiredMethods: ['debug', 'info', 'warn', 'error'],
      });
    } catch (error) {
      throw new InvalidDependencyError(
        'logger',
        this.constructor.name,
        `${error.message} Logger must be provided for error reporting and debugging.`
      );
    }

    // Validate CharacterBuilderService
    try {
      validateDependency(
        characterBuilderService,
        'CharacterBuilderService',
        logger,
        {
          requiredMethods: [
            'initialize',
            'getAllCharacterConcepts',
            'createCharacterConcept',
            'updateCharacterConcept',
            'deleteCharacterConcept',
            'getCharacterConcept',
            'generateThematicDirections',
            'getThematicDirections',
          ],
        }
      );
    } catch (error) {
      throw new InvalidDependencyError(
        'characterBuilderService',
        this.constructor.name,
        `${error.message} Ensure the service implements all required methods for character concept management.`
      );
    }

    // Validate EventBus
    try {
      validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
        requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
      });
    } catch (error) {
      throw new InvalidDependencyError(
        'eventBus',
        this.constructor.name,
        `${error.message} EventBus is required for application-wide event communication.`
      );
    }

    // Validate SchemaValidator
    try {
      validateDependency(schemaValidator, 'ISchemaValidator', logger, {
        requiredMethods: ['validate'],
      });
    } catch (error) {
      throw new InvalidDependencyError(
        'schemaValidator',
        this.constructor.name,
        `${error.message} SchemaValidator is required for validating data against JSON schemas.`
      );
    }

    const validationTime = performance.now() - validationStartTime;
    logger.debug(
      `${this.constructor.name}: Core dependency validation completed in ${validationTime.toFixed(
        2
      )}ms`
    );
  }

  /**
   * Validate additional page-specific services
   *
   * @private
   * @param {object} services - Additional services to validate
   * @param {object} [validationRules] - Validation rules for each service
   * @returns {object} Validated services
   * @example
   * // In subclass constructor:
   * this.#validateAdditionalServices(
   *   { myService },
   *   { myService: { requiredMethods: ['doSomething'] } }
   * );
   */
  #validateAdditionalServices(services, validationRules = {}) {
    const validatedServices = {};

    for (const [serviceName, service] of Object.entries(services)) {
      if (service === undefined || service === null) {
        this.#logger.warn(
          `${this.constructor.name}: Optional service '${serviceName}' is null/undefined`
        );
        continue;
      }

      // Check if validation rules exist for this service
      const rules = validationRules[serviceName];
      if (rules) {
        try {
          validateDependency(service, serviceName, this.#logger, rules);
          validatedServices[serviceName] = service;
          this.#logger.debug(
            `${this.constructor.name}: Validated additional service '${serviceName}'`
          );
        } catch (error) {
          this.#logger.error(
            `${this.constructor.name}: Invalid additional service '${serviceName}'`,
            error
          );
          throw new InvalidDependencyError(
            serviceName,
            this.constructor.name,
            error.message
          );
        }
      } else {
        // No validation rules - just store the service
        validatedServices[serviceName] = service;
        this.#logger.debug(
          `${this.constructor.name}: Accepted additional service '${serviceName}' without validation`
        );
      }
    }

    return validatedServices;
  }

  /**
   * Get validation rules for additional services
   * Override in subclasses to provide custom validation rules
   *
   * @protected
   * @returns {object} Validation rules keyed by service name
   */
  _getAdditionalServiceValidationRules() {
    return {};
  }

  /**
   * Internal method to get validation rules (calls protected method)
   *
   * @private
   * @returns {object} Validation rules keyed by service name
   */
  #getAdditionalServiceValidationRules() {
    return this._getAdditionalServiceValidationRules();
  }

  /**
   * Provide subclasses with access to shared toolkit.
   *
   * @protected
   * @returns {AsyncUtilitiesToolkit}
   */
  _getAsyncUtilitiesToolkit() {
    return this.#asyncUtilitiesToolkit;
  }

  /**
   * Get initialization status
   *
   * @public
   * @returns {boolean}
   */
  get isInitialized() {
    return this.#lifecycle?.isInitialized ?? false;
  }

  /**
   * Get cached elements (for testing)
   * Creates a shallow copy to prevent external modification
   *
   * @public
   * @returns {object}
   */
  get elements() {
    return this._getDomManager().getElementsSnapshot();
  }

  /**
   * Provides access to the shared event listener registry.
   *
   * @protected
   * @returns {EventListenerRegistry}
   */
  get eventRegistry() {
    return this.#eventListenerRegistry;
  }

  /**
   * Get logger instance (for subclasses)
   *
   * @protected
   * @returns {ILogger}
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Get event bus instance (for subclasses)
   *
   * @protected
   * @returns {ISafeEventDispatcher}
   */
  get eventBus() {
    return this.#eventBus;
  }

  /**
   * Detach the controller from the event bus and unsubscribe tracked listeners
   *
   * @protected
   * @returns {void}
   */
  _detachEventBus() {
    if (!this.#eventBus) {
      return;
    }

    const registry = this.#eventListenerRegistry;
    const detachedCount = registry ? registry.detachEventBusListeners() : 0;

    this.#logger.debug(
      `${this.constructor.name}: Detached from event bus after unsubscribing ${detachedCount} listener(s)`
    );

    this.#eventBus = null;
  }

  /**
   * Get character builder service instance (for subclasses)
   *
   * @protected
   * @returns {CharacterBuilderService}
   */
  get characterBuilderService() {
    return this.#characterBuilderService;
  }

  /**
   * Get schema validator instance (for subclasses)
   *
   * @protected
   * @returns {ISchemaValidator}
   */
  get schemaValidator() {
    return this.#schemaValidator;
  }

  /**
   * Access the shared performance monitor service.
   *
   * @protected
   * @returns {PerformanceMonitor}
   */
  get performanceMonitor() {
    return this.#performanceMonitor;
  }

  /**
   * Get additional services (for subclasses)
   *
   * @protected
   * @returns {object} Copy of additional services
   */
  get additionalServices() {
    return { ...this.#additionalServices };
  }

  /**
   * Get UI states enum (for subclasses)
   *
   * @protected
   * @returns {object} UI states enum
   */
  get UI_STATES() {
    return UI_STATES;
  }

  /**
   * Check if controller is currently initializing
   *
   * @protected
   * @returns {boolean}
   */
  get isInitializing() {
    return this.#lifecycle?.isInitializing ?? false;
  }

  /**
   * Reset initialization state (for re-initialization)
   *
   * @protected
   */
  _resetInitializationState() {
    this.#lifecycle?.resetInitializationState(() => {
      this._clearElementCache();
    });
  }

  /**
   * Clear all cached element references (enhances existing _resetInitializationState)
   *
   * @protected
   */
  _clearElementCache() {
    this._getDomManager().clearCache();
  }

  /**
   * Validate all cached elements still exist in DOM
   *
   * @protected
   * @returns {object} Validation results
   */
  _validateElementCache() {
    return this._getDomManager().validateElementCache();
  }

  /**
   * Cache a single DOM element with validation (helper for subclass _cacheElements)
   *
   * @protected
   * @param {string} key - Key to store element under in this.#elements
   * @param {string} selector - CSS selector or element ID
   * @param {boolean} [required] - Whether element is required
   * @returns {HTMLElement|null} The cached element or null if not found
   * @throws {Error} If required element is not found
   * @example
   * // In subclass _cacheElements() method:
   * // Cache by ID (preferred for performance)
   * this._cacheElement('submitBtn', '#submit-button');
   *
   * // Cache by selector
   * this._cacheElement('errorMsg', '.error-message');
   *
   * // Cache optional element
   * this._cacheElement('tooltip', '#tooltip', false);
   */
  _cacheElement(key, selector, required = true) {
    return this._getDomManager().cacheElement(key, selector, required);
  }

  /**
   * Validate a cached element
   *
   * @private
   * @param {HTMLElement} element - Element to validate
   * @param {string} key - Element key for error messages
   * @throws {Error} If element is invalid
   */
  _validateElement(element, key) {
    this._getDomManager().validateElement(element, key);
  }

  /**
   * Cache multiple DOM elements from a mapping configuration
   * Enhances the existing pattern from CharacterConceptsManagerController
   *
   * @protected
   * @param {object} elementMap - Map of key -> selector or config object
   * @param {object} [options] - Caching options
   * @param {boolean} [options.continueOnError] - Continue if optional elements missing
   * @param {boolean} [options.stopOnFirstError] - Stop processing on first error
   * @returns {object} Object with cached elements and any errors
   * @example
   * // In subclass _cacheElements() method:
   * // Simple mapping
   * const results = this._cacheElementsFromMap({
   *   form: '#my-form',
   *   submitBtn: '#submit-btn',
   *   cancelBtn: '#cancel-btn'
   * });
   *
   * // With configuration (building on existing patterns)
   * this._cacheElementsFromMap({
   *   form: { selector: '#my-form', required: true },
   *   tooltip: { selector: '.tooltip', required: false },
   *   errorMsg: { selector: '#error', required: true, validate: (el) => el.classList.contains('error') }
   * });
   */
  _cacheElementsFromMap(elementMap, options = {}) {
    return this._getDomManager().cacheElementsFromMap(elementMap, options);
  }

  /**
   * Normalize element configuration
   *
   * @private
   * @param {string|object} config - Element configuration
   * @returns {object} Normalized configuration
   */
  _normalizeElementConfig(config) {
    return this._getDomManager().normalizeElementConfig(config);
  }

  /**
   * Get DOMElementManager instance for subclass access.
   * Subclasses should use this to access DOM manipulation methods directly.
   *
   * @protected
   * @returns {DOMElementManager}
   * @example
   * // In subclass method:
   * const element = this._getDomManager().getElement('myElement');
   * this._getDomManager().showElement('myElement');
   */
  _getDomManager() {
    return this.#domElementManager;
  }

  /**
   * Get a cached DOM element
   *
   * @param {string} elementName - Name of the element to retrieve
   * @returns {HTMLElement|null} The requested element or null if not found
   * @protected
   */
  _getElement(elementName) {
    return this.#domElementManager.getElement(elementName);
  }

  /**
   * Refresh a cached DOM element
   *
   * @param {string} elementName - Name of the element to refresh
   * @param {string} selector - CSS selector to re-query the element
   * @returns {HTMLElement|null} The refreshed element or null if not found
   * @protected
   */
  _refreshElement(elementName, selector) {
    return this.#domElementManager.refreshElement(elementName, selector);
  }

  /**
   * Set text content of a cached DOM element
   *
   * @param {string} elementName - Name of the element to update
   * @param {string} text - Text content to set
   * @returns {boolean} True if element was found and updated, false otherwise
   * @protected
   */
  _setElementText(elementName, text) {
    return this.#domElementManager.setElementText(elementName, text);
  }

  /**
   * Register an event listener for a DOM element
   *
   * @param {string} elementName - Name of the cached element
   * @param {string} eventType - Type of event to listen for
   * @param {Function} handler - Event handler function
   * @protected
   */
  _addEventListener(elementName, eventType, handler) {
    const element = this._getDomManager().getElement(elementName);
    if (element) {
      this.#eventListenerRegistry.addEventListener(element, eventType, handler);
    }
  }

  /**
   * Add debounced event listener to cached element
   *
   * @param {string} elementName - Name of the cached element
   * @param {string} eventType - Type of event to listen for
   * @param {Function} handler - Event handler function
   * @param {number} delay - Debounce delay in milliseconds
   * @protected
   */
  _addDebouncedListener(elementName, eventType, handler, delay) {
    const element = this._getDomManager().getElement(elementName);
    if (element) {
      this.#eventListenerRegistry.addDebouncedListener(
        element,
        eventType,
        handler,
        delay
      );
    }
  }

  /**
   * Subscribe to event bus event
   *
   * @param {string} eventType - Type of event to listen for
   * @param {Function} handler - Event handler function
   * @protected
   */
  _subscribeToEvent(eventType, handler) {
    this.#eventListenerRegistry.subscribeToEvent(
      this.#eventBus,
      eventType,
      handler
    );
  }

  /**
   * Set timeout using async utilities
   *
   * @param {Function} callback - Function to call after delay
   * @param {number} [delay] - Delay in milliseconds
   * @returns {number} Timer ID
   * @protected
   */
  _setTimeout(callback, delay) {
    return this.#asyncUtilitiesToolkit.setTimeout(callback, delay);
  }

  /**
   * Set interval using async utilities
   *
   * @param {Function} callback - Function to call repeatedly
   * @param {number} [delay] - Delay between calls in milliseconds
   * @returns {number} Interval ID
   * @protected
   */
  _setInterval(callback, delay) {
    return this.#asyncUtilitiesToolkit.setInterval(callback, delay);
  }

  /**
   * Clear timeout using async utilities
   *
   * @param {number} timerId - Timer ID to clear
   * @protected
   */
  _clearTimeout(timerId) {
    this.#asyncUtilitiesToolkit.clearTimeout(timerId);
  }

  /**
   * Clear interval using async utilities
   *
   * @param {number} intervalId - Interval ID to clear
   * @protected
   */
  _clearInterval(intervalId) {
    this.#asyncUtilitiesToolkit.clearInterval(intervalId);
  }

  /**
   * Prevent default event behavior
   *
   * @param {Event} event - Event to prevent default on
   * @param {Function} [callback] - Optional callback to call after preventing default
   * @protected
   */
  _preventDefault(event, callback) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (callback && typeof callback === 'function') {
      callback();
    }
  }

  /**
   * Initialize UI state manager with cached elements
   * Called during the standard initialization sequence
   *
   * @protected
   * @returns {Promise<void>}
   */
  async _initializeUIStateManager() {
    try {
      // Get required state elements
      const stateElements = {
        emptyState: this._getDomManager().getElement('emptyState'),
        loadingState: this._getDomManager().getElement('loadingState'),
        resultsState: this._getDomManager().getElement('resultsState'),
        errorState: this._getDomManager().getElement('errorState'),
      };

      // Validate required elements exist
      const missingElements = Object.entries(stateElements)
        .filter(([key, element]) => !element)
        .map(([key]) => key);

      if (missingElements.length > 0) {
        this.#logger.warn(
          `${this.constructor.name}: Missing state elements: ${missingElements.join(', ')}`
        );
        return; // Skip UI state manager initialization
      }

      // Create UIStateManager instance
      this.#uiStateManager = new UIStateManager(stateElements);
      this.#errorHandlingStrategy?.configureContext({
        uiStateManager: this.#uiStateManager,
      });

      this.#logger.debug(
        `${this.constructor.name}: UIStateManager initialized successfully`
      );
    } catch (error) {
      this.#logger.error(
        `${this.constructor.name}: Failed to initialize UIStateManager`,
        error
      );
      // Don't throw - allow controller to continue without state management
    }
  }

  /**
   * Show UI state using integrated UIStateManager
   *
   * @protected
   * @param {string} state - State to show (empty, loading, results, error)
   * @param {object} [options] - State options
   * @param {string} [options.message] - Message for loading/error states
   * @param {any} [options.data] - Additional data for state
   * @example
   * // Show loading state
   * this._showState('loading');
   *
   * // Show error with message
   * this._showState('error', { message: 'Failed to load data' });
   *
   * // Show results
   * this._showState('results');
   */
  _showState(state, options = {}) {
    const { message, data } = options;

    // Validate state
    const validStates = Object.values(UI_STATES);
    if (!validStates.includes(state)) {
      this.#logger.warn(
        `${this.constructor.name}: Invalid state '${state}', using 'empty' instead`
      );
      state = UI_STATES.EMPTY;
    }

    if (!this.#uiStateManager) {
      this.#logger.warn(
        `${this.constructor.name}: UIStateManager not initialized, cannot show state '${state}'`
      );
      return;
    }

    const previousState = this.#uiStateManager.getCurrentState();

    this.#logger.debug(
      `${this.constructor.name}: State transition: ${previousState || 'none'} → ${state}`
    );

    try {
      // Call pre-transition hook
      this._beforeStateChange(previousState, state, options);

      // Use UIStateManager to handle state transition
      this.#uiStateManager.showState(state, message);

      // Handle state-specific logic
      this._handleStateChange(state, { message, data, previousState });

      // Call post-transition hook
      this._afterStateChange(previousState, state, options);

      // Dispatch state change event
      if (this.#eventBus) {
        this.#eventBus.dispatch('core:ui_state_changed', {
          controller: this.constructor.name,
          previousState,
          currentState: state,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.#logger.error(
        `${this.constructor.name}: State transition failed`,
        error
      );
      // Try to show error state as fallback
      if (state !== UI_STATES.ERROR && this.#uiStateManager) {
        this.#uiStateManager.showError(
          'An error occurred while updating the display'
        );
      }
    }
  }

  /**
   * Hook called before state change
   *
   * @protected
   * @param {string} fromState - Previous state
   * @param {string} toState - New state
   * @param {object} options - Transition options
   */
  _beforeStateChange(fromState, toState, options) {
    // Default implementation - no-op
    // Subclasses can override for custom behavior
  }

  /**
   * Handle state change - override in subclasses for custom behavior
   *
   * @protected
   * @param {string} state - The new state
   * @param {object} data - State data including message, data, previousState
   * @example
   * // In subclass:
   * _handleStateChange(state, data) {
   *   switch (state) {
   *     case this.UI_STATES.LOADING:
   *       this._setFormControlsEnabled(false);
   *       break;
   *     case this.UI_STATES.RESULTS:
   *       this._setFormControlsEnabled(true);
   *       this._displayResults(data.data);
   *       break;
   *     case this.UI_STATES.ERROR:
   *       this._setFormControlsEnabled(true);
   *       break;
   *   }
   * }
   */
  _handleStateChange(state, data) {
    // Default implementation handles common form control states
    switch (state) {
      case UI_STATES.LOADING:
        this._setFormControlsEnabled(false);
        break;
      case UI_STATES.RESULTS:
      case UI_STATES.ERROR:
      case UI_STATES.EMPTY:
        this._setFormControlsEnabled(true);
        break;
    }

    // Subclasses can override for additional state-specific behavior
  }

  /**
   * Hook called after state change
   *
   * @protected
   * @param {string} fromState - Previous state
   * @param {string} toState - New state
   * @param {object} options - Transition options
   */
  _afterStateChange(fromState, toState, options) {
    // Default implementation - no-op
    // Subclasses can override for custom behavior
  }

  /**
   * Enable/disable form controls based on state
   *
   * @private
   * @param {boolean} enabled - Whether to enable controls
   */
  _setFormControlsEnabled(enabled) {
    // Common form control selectors
    const controlKeys = [
      'submitBtn',
      'submitButton',
      'saveBtn',
      'cancelBtn',
      'form',
    ];

    controlKeys.forEach((key) => {
      this._getDomManager().setElementEnabled(key, enabled);
    });

    // Also handle any buttons in the form
    const form = this._getDomManager().getElement('form');
    if (form) {
      const buttons = form.querySelectorAll('button, input[type="submit"]');
      buttons.forEach((button) => {
        button.disabled = !enabled;
      });
    }
  }

  /**
   * Show error state with message
   *
   * @protected
   * @param {string|Error} error - Error message or Error object
   * @param {object} [options] - Additional options
   */
  _showError(error, options = {}) {
    const message = typeof error === 'string' ? error : error.message;

    this._showState(UI_STATES.ERROR, {
      ...options,
      message,
    });

    this.#logger.error(`${this.constructor.name}: Showing error state`, {
      message,
      error,
    });
  }

  /**
   * Show loading state with optional message
   *
   * @protected
   * @param {string} [message] - Loading message
   */
  _showLoading(message = 'Loading...') {
    this._showState(UI_STATES.LOADING, { message });
  }

  /**
   * Show results state with data
   *
   * @protected
   * @param {any} [data] - Results data
   */
  _showResults(data) {
    this._showState(UI_STATES.RESULTS, { data });
  }

  /**
   * Show empty state
   *
   * @protected
   */
  _showEmpty() {
    this._showState(UI_STATES.EMPTY);
  }

  /**
   * Get current UI state from UIStateManager
   *
   * @protected
   * @returns {string|null} Current state or null if UIStateManager not initialized
   */
  get currentState() {
    return this.#uiStateManager?.getCurrentState() || null;
  }

  /**
   * Check if controller is in a specific state
   *
   * @protected
   * @param {string} state - State to check
   * @returns {boolean} True if in the specified state
   */
  _isInState(state) {
    return this.currentState === state;
  }

  /**
   * Add event listener with automatic tracking for cleanup
   *
   * @protected
   * @param {HTMLElement|string} elementOrKey - Element or element key from cache
   * @param {string} event - Event type (e.g., 'click', 'submit')
   * @param {Function} handler - Event handler function
   * @param {object} [options] - Event listener options
   * @param {boolean} [options.capture] - Use capture phase
   * @param {boolean} [options.once] - Remove after first call
   * @param {boolean} [options.passive] - Passive listener (can't preventDefault)
   * @param {string} [options.id] - Unique identifier for this listener
   * @returns {string|null} Listener ID for later removal, or null if failed
   * @example
   * // Using cached element key
   * this._addEventListener('submitBtn', 'click', this._handleSubmit.bind(this));
   *
   * // Using element directly
   * this._addEventListener(formElement, 'submit', (e) => {
   *   e.preventDefault();
   *   this._handleFormSubmit();
   * });
   *
   * // With options
   * this._addEventListener('input', 'input', this._handleInput.bind(this), {
   *   passive: true,
   *   id: 'main-input-handler'
   * });
   */

  /**
   * Cache DOM elements - must be implemented by subclasses
   *
   * @abstract
   * @protected
   * @throws {Error} Always throws - must be overridden
   */
  _cacheElements() {
    throw new Error(
      `${this.constructor.name} must implement _cacheElements() method`
    );
  }

  /**
   * Set up event listeners - must be implemented by subclasses
   *
   * @abstract
   * @protected
   * @throws {Error} Always throws - must be overridden
   */
  _setupEventListeners() {
    throw new Error(
      `${this.constructor.name} must implement _setupEventListeners() method`
    );
  }

  /**
   * Template method for controller initialization
   * Defines the standard initialization sequence with customization hooks
   *
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize() {
    await this.#lifecycle.initialize({
      controllerName: this.constructor.name,
    });
  }

  /**
   * Pre-initialization hook - override in subclasses for custom setup
   * Called before any other initialization steps
   *
   * @protected
   * @returns {Promise<void>}
   * @example
   * // In subclass:
   * async _preInitialize() {
   *   await this._loadUserPreferences();
   *   this._configureFeatureFlags();
   * }
   */
  async _preInitialize() {
    // Default implementation - no-op
    // Subclasses can override for custom pre-initialization logic
  }

  /**
   * Initialize services - template method with default implementation
   *
   * @protected
   * @returns {Promise<void>}
   */
  async _initializeServices() {
    // Initialize character builder service
    if (
      this.characterBuilderService &&
      this.characterBuilderService.initialize
    ) {
      this.logger.debug(
        `${this.constructor.name}: Initializing CharacterBuilderService`
      );

      await this.characterBuilderService.initialize();

      this.logger.debug(
        `${this.constructor.name}: CharacterBuilderService initialized`
      );
    }

    // Initialize additional services
    await this._initializeAdditionalServices();
  }

  /**
   * Initialize additional page-specific services - override in subclasses
   *
   * @protected
   * @returns {Promise<void>}
   * @example
   * // In subclass:
   * async _initializeAdditionalServices() {
   *   if (this.additionalServices?.analyticsService) {
   *     await this.additionalServices.analyticsService.initialize();
   *   }
   * }
   */
  async _initializeAdditionalServices() {
    // Default implementation - no-op
    // Subclasses can override to initialize page-specific services
  }

  /**
   * Load initial data - override in subclasses
   * Called after services are initialized and event listeners are set up
   *
   * @protected
   * @returns {Promise<void>}
   * @example
   * // In subclass:
   * async _loadInitialData() {
   *   const concepts = await this.characterBuilderService.getAllCharacterConcepts();
   *   this._processCharacterConcepts(concepts);
   * }
   */
  async _loadInitialData() {
    // Default implementation - no-op
    // Subclasses can override to load page-specific data
  }

  /**
   * Initialize UI state - enhanced to use UIStateManager
   * Called after data is loaded in the standard initialization sequence
   *
   * @protected
   * @example
   * // In subclass:
   * async _initializeUIState() {
   *   await super._initializeUIState(); // Initialize UIStateManager first
   *   if (this._hasData()) {
   *     this._showState('results');
   *   } else {
   *     this._showState('empty');
   *   }
   * }
   */
  async _initializeUIState() {
    // Initialize UIStateManager first
    if (typeof this._initializeUIStateManager === 'function') {
      await this._initializeUIStateManager();
    }

    // Default implementation - show empty state if UIStateManager is available
    if (this.#uiStateManager) {
      this._showState(UI_STATES.EMPTY);
    } else {
      this.#logger.warn(
        `${this.constructor.name}: UIStateManager not available, skipping initial state`
      );
    }
  }

  /**
   * Post-initialization hook - override in subclasses for custom finalization
   * Called after all initialization steps are complete
   *
   * @protected
   * @returns {Promise<void>}
   * @example
   * // In subclass:
   * async _postInitialize() {
   *   await this._startBackgroundSync();
   *   this._trackInitializationMetrics();
   * }
   */
  async _postInitialize() {
    // Default implementation - no-op
    // Subclasses can override for custom post-initialization logic
  }

  /**
   * Handle initialization errors with consistent logging and user feedback
   *
   * @protected
   * @param {Error} error - The error that occurred during initialization
   * @returns {Promise<void>}
   */
  async _handleInitializationError(error) {
    const userMessage =
      'Failed to initialize page. Please refresh and try again.';

    // Show error UI if available
    if (typeof this._showError === 'function') {
      this._showError(userMessage);
    } else if (typeof this._showState === 'function') {
      this._showState('error', { message: userMessage });
    }

    // Dispatch error event for monitoring/logging
    if (this.eventBus) {
      this.eventBus.dispatch('SYSTEM_ERROR_OCCURRED', {
        error: error.message,
        context: `${this.constructor.name} initialization`,
        phase: error.phase || 'unknown',
        timestamp: new Date().toISOString(),
        stack: error.stack,
      });
    }

    // Allow subclasses to handle initialization errors
    if (typeof this._onInitializationError === 'function') {
      await this._onInitializationError(error);
    }
  }

  /**
   * Hook for subclasses to handle initialization errors
   *
   * @protected
   * @param {Error} error - The initialization error
   * @returns {Promise<void>}
   */
  async _onInitializationError(error) {
    // Default implementation - no-op
    // Subclasses can override for custom error handling
  }

  /**
   * Force re-initialization (use with caution)
   *
   * @protected
   * @returns {Promise<void>}
   */
  async _reinitialize() {
    await this.#lifecycle.reinitialize({
      controllerName: this.constructor.name,
      onReset: () => this._clearElementCache(),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling Framework (Added in ticket #7)
  // ─────────────────────────────────────────────────────────────────────────


  /**
   * Default recovery handlers wrapping controller callbacks.
   *
   * @private
   * @returns {Record<string, Function>}
   */
  #buildDefaultRecoveryHandlers() {
    return {
      [ERROR_CATEGORIES.NETWORK]: (errorDetails) => {
        setTimeout(() => {
          try {
            this._retryLastOperation();
          } catch (error) {
            this.#logger.error(
              `${this.constructor.name}: Recovery retry failed`,
              error
            );
          }
        }, 5000);
        return errorDetails;
      },
      [ERROR_CATEGORIES.SYSTEM]: (errorDetails) => {
        if (errorDetails.operation === 'initialization') {
          setTimeout(() => {
            try {
              this._reinitialize();
            } catch (error) {
              this.#logger.error(
                `${this.constructor.name}: Recovery reinitialize failed`,
                error
              );
            }
          }, 2000);
        }
        return errorDetails;
      },
    };
  }


  /**
   * Handle errors with consistent logging and user feedback
   *
   * @protected
   * @param {Error|string} error - The error that occurred
   * @param {object} [context] - Error context
   * @param {string} [context.operation] - Operation that failed
   * @param {string} [context.category] - Error category
   * @param {string} [context.severity] - Error severity
   * @param {string} [context.userMessage] - Custom user message
   * @param {boolean} [context.showToUser] - Whether to show error to user
   * @param {object} [context.metadata] - Additional error metadata
   * @returns {object} Error details for further handling
   * @example
   * // Handle service error
   * this._handleError(error, {
   *   operation: 'loadCharacterConcepts',
   *   category: ERROR_CATEGORIES.NETWORK,
   *   userMessage: 'Failed to load character concepts. Please try again.'
   * });
   *
   * // Handle validation error
   * this._handleError(validationError, {
   *   operation: 'saveCharacter',
   *   category: ERROR_CATEGORIES.VALIDATION,
   *   severity: ERROR_SEVERITY.WARNING
   * });
   */
  _handleError(error, context = {}) {
    return this.#errorHandlingStrategy.handleError(error, context);
  }

  /**
   * Build comprehensive error details
   *
   * @param error
   * @param context
   * @private
   */
  _buildErrorDetails(error, context) {
    return this.#errorHandlingStrategy.buildErrorDetails(error, context);
  }

  /**
   * Categorize error automatically
   *
   * @param error
   * @private
   */
  _categorizeError(error) {
    return this.#errorHandlingStrategy.categorizeError(error);
  }

  /**
   * Generate user-friendly error message
   *
   * @param error
   * @param context
   * @private
   */
  _generateUserMessage(error, context) {
    return this.#errorHandlingStrategy.generateUserMessage(error, context);
  }

  /**
   * Log error with appropriate level
   *
   * @param errorDetails
   * @private
   */
  _logError(errorDetails) {
    this.#errorHandlingStrategy.logError(errorDetails);
  }

  /**
   * Show error to user using existing UI state management infrastructure
   *
   * @param errorDetails
   * @private
   */
  _showErrorToUser(errorDetails) {
    this.#errorHandlingStrategy.showErrorToUser(errorDetails);
  }

  /**
   * Dispatch error event for monitoring using existing event bus infrastructure
   *
   * @param errorDetails
   * @private
   */
  _dispatchErrorEvent(errorDetails) {
    // Use existing eventBus integration (BaseCharacterBuilderController already has this)
    if (this.eventBus) {
      // Follow existing SYSTEM_ERROR_OCCURRED event pattern used throughout the codebase
      this.eventBus.dispatch('SYSTEM_ERROR_OCCURRED', {
        error: errorDetails.message,
        context: errorDetails.operation,
        category: errorDetails.category,
        severity: errorDetails.severity,
        controller: errorDetails.controller,
        timestamp: errorDetails.timestamp,
        stack: errorDetails.stack,
        metadata: errorDetails.metadata,
      });
    }
  }

  /**
   * Handle service errors with consistent logging and user feedback
   *
   * @protected
   * @param {Error} error - The error that occurred
   * @param {string} operation - Description of the operation that failed
   * @param {string} [userMessage] - Custom user-friendly message
   * @throws {Error} Re-throws the error after handling
   */
  _handleServiceError(error, operation, userMessage) {
    return this.#errorHandlingStrategy.handleServiceError(
      error,
      operation,
      userMessage
    );
  }

  /**
   * Execute operation with error handling
   *
   * @protected
   * @param {Function} operation - Async operation to execute
   * @param {string} operationName - Name for logging
   * @param {object} [options] - Options
   * @param {string} [options.userErrorMessage] - Custom error message
   * @param {number} [options.retries] - Number of retries for transient failures
   * @param {number} [options.retryDelay] - Delay between retries in ms
   * @returns {Promise<any>} Operation result
   * @example
   * const data = await this._executeWithErrorHandling(
   *   () => this._characterBuilderService.getData(),
   *   'loadData',
   *   {
   *     userErrorMessage: 'Failed to load data',
   *     retries: 3
   *   }
   * );
   */
  async _executeWithErrorHandling(operation, operationName, options = {}) {
    return this.#errorHandlingStrategy.executeWithErrorHandling(
      operation,
      operationName,
      options
    );
  }

  /**
   * Check if error is retryable
   *
   * @param error
   * @private
   */
  _isRetryableError(error) {
    return this.#errorHandlingStrategy.isRetryableError(error);
  }

  /**
   * Validate data against schema with error handling
   * NOTE: This is a wrapper around the existing AjvSchemaValidator.validate() method
   * The validateAgainstSchema utility throws errors, so we use validate() directly for non-throwing validation
   *
   * @protected
   * @param {object} data - Data to validate
   * @param {string} schemaId - Schema ID for validation
   * @param {object} [context] - Validation context options for enhanced error handling
   * @returns {{isValid: boolean, errors?: Array, errorMessage?: string}} Validation result
   */
  _validateData(data, schemaId, context = {}) {
    const validationContext = {
      ...context,
      controllerName: context.controllerName || this.constructor.name,
    };

    return this.#validationService.validateData(
      data,
      schemaId,
      validationContext
    );
  }

  /**
   * Format validation errors for display
   *
   * @param errors
   * @private
   */
  _formatValidationErrors(errors) {
    return this.#validationService.formatValidationErrors(errors);
  }

  /**
   * Build user-friendly validation error message
   *
   * @param errors
   * @private
   */
  _buildValidationErrorMessage(errors) {
    return this.#validationService.buildValidationErrorMessage(errors);
  }

  /**
   * Determine if error is recoverable
   *
   * @param error
   * @param context
   * @private
   */
  _determineRecoverability(error, context) {
    return this.#errorHandlingStrategy.determineRecoverability(
      error,
      context
    );
  }

  /**
   * Check if error is recoverable
   *
   * @param errorDetails
   * @private
   */
  _isRecoverableError(errorDetails) {
    return this.#errorHandlingStrategy.isRecoverableError(errorDetails);
  }

  /**
   * Attempt to recover from error
   *
   * @param errorDetails
   * @private
   */
  _attemptErrorRecovery(errorDetails) {
    this.#errorHandlingStrategy.attemptErrorRecovery(errorDetails);
  }

  /**
   * Retry last operation (override in subclasses)
   *
   * @protected
   */
  _retryLastOperation() {
    // Default implementation - no-op
    // Subclasses can override to implement retry logic
  }

  /**
   * Create a standardized error
   *
   * @protected
   * @param {string} message - Error message
   * @param {string} [category] - Error category
   * @param {object} [metadata] - Additional metadata
   * @returns {Error} Standardized error
   */
  _createError(message, category, metadata) {
    return this.#errorHandlingStrategy.createError(
      message,
      category,
      metadata
    );
  }

  /**
   * Wrap error with additional context
   *
   * @protected
   * @param {Error} error - Original error
   * @param {string} context - Additional context
   * @returns {Error} Wrapped error
   */
  _wrapError(error, context) {
    return this.#errorHandlingStrategy.wrapError(error, context);
  }

  /**
   * Get last error details (for debugging)
   *
   * @protected
   * @returns {object|null} Last error details
   */
  get lastError() {
    return this.#errorHandlingStrategy.lastError || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle Hooks
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hook called before destruction begins
   * Override in subclasses to perform custom pre-destruction logic
   *
   * @protected
   * @abstract
   */
  _preDestroy() {
    // Default implementation - no-op
    // Subclasses can override to add custom logic
  }

  /**
   * Hook called after destruction completes
   * Override in subclasses to perform custom post-destruction logic
   *
   * @protected
   * @abstract
   */
  _postDestroy() {
    // Default implementation - no-op
    // Subclasses can override to add custom logic
  }

  /**
   * Hook for canceling custom operations during destruction
   * Override in subclasses that have custom async operations
   *
   * @protected
   * @abstract
   */
  _cancelCustomOperations() {
    // Default implementation - no-op
    // Subclasses can override to cancel custom operations
  }

  /**
   * Hook for cleaning up core services
   * Override only if core services need special cleanup
   *
   * @protected
   * @abstract
   */
  _cleanupCoreServices() {
    // Default implementation - no-op
    // Core services typically don't need cleanup
  }

  /**
   * Hook for cleaning up additional services
   * Override in subclasses to cleanup page-specific services
   *
   * @protected
   * @abstract
   */
  _cleanupAdditionalServices() {
    // Default implementation - no-op
    // Subclasses should override to cleanup their services
  }

  /**
   * Hook for clearing cached data
   * Override in subclasses that maintain caches
   *
   * @protected
   * @abstract
   */
  _clearCachedData() {
    // Default implementation - no-op
    // Subclasses can override to clear custom caches
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Destruction Implementation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cancel all pending operations (timers, intervals, animation frames)
   *
   * @protected
   */
  _cancelPendingOperations() {
    const toolkit = this.#asyncUtilitiesToolkit;
    const stats = toolkit.getTimerStats();

    if (stats.timeouts.count > 0) {
      this.#logger.debug(
        `${this.constructor.name}: Cancelled ${stats.timeouts.count} pending timers`
      );
    }

    if (stats.intervals.count > 0) {
      this.#logger.debug(
        `${this.constructor.name}: Cancelled ${stats.intervals.count} pending intervals`
      );
    }

    if (stats.animationFrames.count > 0) {
      this.#logger.debug(
        `${this.constructor.name}: Cancelled ${stats.animationFrames.count} pending animation frames`
      );
    }

    toolkit.clearAllTimers();

    // Call custom cancellation hook
    this._cancelCustomOperations();
  }

  /**
   * Clean up all services
   *
   * @protected
   */
  _cleanupServices() {
    // Clean up additional services first
    this._cleanupAdditionalServices();

    // Clean up core services if needed
    this._cleanupCoreServices();

    // Clear service references
    this.#additionalServices = {};
  }

  /**
   * Clear remaining references
   *
   * @protected
   */
  _clearReferences() {
    // Clear UI state manager
    this.#uiStateManager = null;

    // Clear error tracking
    if (this.#errorHandlingStrategy) {
      this.#errorHandlingStrategy.resetLastError();
      this.#errorHandlingStrategy.configureContext?.({
        uiStateManager: null,
        showError: null,
        showState: null,
        dispatchErrorEvent: null,
        recoveryHandlers: {},
      });
      this.#errorHandlingStrategy = null;
    }

    // Clear event registry state
    if (this.#eventListenerRegistry) {
      this.#eventListenerRegistry.destroy();
      this.#eventListenerRegistry = null;
    }

    if (this.#asyncUtilitiesToolkit) {
      this.#asyncUtilitiesToolkit.clearAllTimers();
      unregisterToolkitForOwner(this);
      this.#asyncUtilitiesToolkit = null;
    }

    // Clear performance data
    if (this.#performanceMonitor) {
      this.#performanceMonitor.clearData();
      this.#performanceMonitor = null;
    }

    // Clear weak references via memory manager
    if (this.#memoryManager) {
      this.#memoryManager.clear();
    }

    if (this.#validationService) {
      this.#validationService.configure?.({
        handleError: () => {},
        errorCategories: ERROR_CATEGORIES,
      });
      this.#validationService = null;
    }

    // Clear custom cached data
    this._clearCachedData();

    this.#logger.debug(`${this.constructor.name}: Cleared all references`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pending Operations Management
  // ─────────────────────────────────────────────────────────────────────────

  // TODO(BASCHACUICONREF-010): Remove these controller-level delegates once
  // the AsyncUtilitiesToolkit is injected directly into all downstream services.

  /**
   * Set a timeout that will be automatically cleared on destruction
   *
   * @protected
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID
   */

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup Task Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a cleanup task to be executed during destruction
   * Tasks are executed in LIFO order (last registered, first executed)
   *
   * @protected
   * @param {Function} task - Cleanup task to execute
   * @param {string} [description] - Description for logging
   */
  _registerCleanupTask(task, description = 'Cleanup task') {
    if (typeof task !== 'function') {
      throw new TypeError('Cleanup task must be a function');
    }

    const boundTask = (...args) => task.apply(this, args);
    this.#lifecycle?.registerCleanupTask(boundTask, description);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Destruction Guards
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if the controller has been destroyed
   *
   * @protected
   * @param {string} [operation] - Operation being attempted
   * @returns {boolean} True if destroyed
   * @throws {Error} If operation provided and controller is destroyed
   */
  _checkDestroyed(operation) {
    return this.#lifecycle?.checkDestroyed(operation) ?? false;
  }

  /**
   * Get whether the controller has been destroyed
   *
   * @public
   * @returns {boolean}
   */
  get isDestroyed() {
    return this.#lifecycle?.isDestroyed ?? false;
  }

  /**
   * Get whether the controller is currently being destroyed
   *
   * @public
   * @returns {boolean}
   */
  get isDestroying() {
    return this.#lifecycle?.isDestroying ?? false;
  }

  /**
   * Make a method destruction-safe by wrapping it
   *
   * @protected
   * @param {Function} method - Method to wrap
   * @param {string} methodName - Name for error messages
   * @returns {Function} Wrapped method
   */
  _makeDestructionSafe(method, methodName) {
    const boundMethod = (...args) => method.apply(this, args);
    return this.#lifecycle.makeDestructionSafe(boundMethod, methodName);
  }

  /**
   * Destroy the controller instance
   * Cleans up event listeners, timers, and references
   *
   * @public
   * @returns {void}
   */
  destroy() {
    this.#lifecycle.destroy({ controllerName: this.constructor.name });
  }
}

export default BaseCharacterBuilderController;
