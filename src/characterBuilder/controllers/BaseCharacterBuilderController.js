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
   * @param {object} [dependencies.additionalServices] - Page-specific services
   */
  constructor({
    logger,
    characterBuilderService,
    eventBus,
    schemaValidator,
    controllerLifecycleOrchestrator = null,
    lifecycleHooks = {},
    ...additionalServices
  }) {
    try {
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

      this.#lifecycle =
        controllerLifecycleOrchestrator ??
        new ControllerLifecycleOrchestrator({
          logger: this.#logger,
          eventBus: this.#eventBus,
          hooks: lifecycleHooks,
        });

      this.#lifecycle.setControllerName(this.constructor.name);
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
    } catch (error) {
      // Re-throw validation errors - they already have detailed messages
      throw error;
    }
  }

  /**
   * Lazily instantiate the memory manager service.
   *
   * @private
   * @returns {MemoryManager}
   */
  #getMemoryManager() {
    if (!this.#memoryManager) {
      this.#memoryManager = new MemoryManager({
        logger: this.#logger,
        contextName: `${this.constructor.name}:MemoryManager`,
      });
    }

    return this.#memoryManager;
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
   * Lazy-loads the EventListenerRegistry instance.
   *
   * @private
   * @returns {EventListenerRegistry}
   */
  #getEventListenerRegistry() {
    if (!this.#eventListenerRegistry) {
      this.#eventListenerRegistry = new EventListenerRegistry({
        logger: this.#logger,
        asyncUtilities: this.#createAsyncUtilitiesAdapters(),
        contextName: this.constructor.name,
      });
    }

    return this.#eventListenerRegistry;
  }

  /**
   * Lazily instantiate toolkit so it can be shared across services.
   *
   * @private
   * @returns {AsyncUtilitiesToolkit}
   */
  #getAsyncUtilitiesToolkit() {
    if (!this.#asyncUtilitiesToolkit) {
      this.#asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({
        logger: this.#logger,
      });
      registerToolkitForOwner(this, this.#asyncUtilitiesToolkit);
    }

    return this.#asyncUtilitiesToolkit;
  }

  /**
   * Lazily instantiate the shared performance monitor.
   *
   * @private
   * @returns {PerformanceMonitor}
   */
  #getPerformanceMonitor() {
    if (!this.#performanceMonitor) {
      this.#performanceMonitor = new PerformanceMonitor({
        logger: this.#logger,
        eventBus: this.#eventBus,
        contextName: this.constructor.name,
      });
    }

    return this.#performanceMonitor;
  }

  /**
   * Build async utility adapters until BASCHACUICONREF-005 extracts the toolkit.
   *
   * @private
   * @returns {{ debounce: Function, throttle: Function }} Async adapters.
   */
  #createAsyncUtilitiesAdapters() {
    const toolkit = this.#getAsyncUtilitiesToolkit();
    return {
      debounce: toolkit.debounce.bind(toolkit),
      throttle: toolkit.throttle.bind(toolkit),
    };
  }

  /**
   * Provide subclasses with access to shared toolkit.
   *
   * @protected
   * @returns {AsyncUtilitiesToolkit}
   */
  _getAsyncUtilitiesToolkit() {
    return this.#getAsyncUtilitiesToolkit();
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
    return this.#getEventListenerRegistry();
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
    return this.#getPerformanceMonitor();
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
   * Get a cached element by key
   *
   * @protected
   * @param {string} key - Element key
   * @returns {HTMLElement|null} The cached element or null
   */
  _getElement(key) {
    return this._getDomManager().getElement(key);
  }

  /**
   * Check if an element is cached and available
   *
   * @protected
   * @param {string} key - Element key
   * @returns {boolean} True if element exists and is in DOM
   */
  _hasElement(key) {
    return this._getDomManager().hasElement(key);
  }

  /**
   * Get multiple cached elements by keys
   *
   * @protected
   * @param {string[]} keys - Array of element keys
   * @returns {object} Object with requested elements
   */
  _getElements(keys) {
    return this._getDomManager().getElements(keys);
  }

  /**
   * Refresh a cached element (re-query DOM)
   *
   * @protected
   * @param {string} key - Element key
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} The refreshed element
   */
  _refreshElement(key, selector) {
    return this._getDomManager().refreshElement(key, selector);
  }

  /**
   * Show an element
   *
   * @protected
   * @param {string} key - Element key
   * @param {string} [displayType] - CSS display type
   * @returns {boolean} True if element was shown
   */
  _showElement(key, displayType = 'block') {
    return this._getDomManager().showElement(key, displayType);
  }

  /**
   * Hide an element
   *
   * @protected
   * @param {string} key - Element key
   * @returns {boolean} True if element was hidden
   */
  _hideElement(key) {
    return this._getDomManager().hideElement(key);
  }

  /**
   * Toggle element visibility
   *
   * @protected
   * @param {string} key - Element key
   * @param {boolean} [visible] - Force visible state
   * @returns {boolean} New visibility state
   */
  _toggleElement(key, visible) {
    return this._getDomManager().toggleElement(key, visible);
  }

  /**
   * Enable/disable an element (for form controls)
   *
   * @protected
   * @param {string} key - Element key
   * @param {boolean} [enabled] - Whether to enable
   * @returns {boolean} True if state was changed
   */
  _setElementEnabled(key, enabled = true) {
    return this._getDomManager().setElementEnabled(key, enabled);
  }

  /**
   * Set text content of an element
   *
   * @protected
   * @param {string} key - Element key
   * @param {string} text - Text content
   * @returns {boolean} True if text was set
   */
  _setElementText(key, text) {
    return this._getDomManager().setElementText(key, text);
  }

  /**
   * Add CSS class to element
   *
   * @protected
   * @param {string} key - Element key
   * @param {string} className - CSS class name
   * @returns {boolean} True if class was added
   */
  _addElementClass(key, className) {
    return this._getDomManager().addElementClass(key, className);
  }

  /**
   * Remove CSS class from element
   *
   * @protected
   * @param {string} key - Element key
   * @param {string} className - CSS class name
   * @returns {boolean} True if class was removed
   */
  _removeElementClass(key, className) {
    return this._getDomManager().removeElementClass(key, className);
  }

  /**
   * Lazily create or retrieve DOMElementManager instance.
   *
   * @protected
   * @returns {DOMElementManager}
   */
  _getDomManager() {
    if (!this.#domElementManager) {
      // TODO(BASCHACUICONREF-010): Allow subclasses to inject DOMElementManager instances directly
      // once the remaining DOM helper wrappers are removed.
      this.#domElementManager = new DOMElementManager({
        logger: this.#logger,
        documentRef: document,
        performanceRef: performance,
        elementsRef: this.#elements,
        contextName: this.constructor.name,
      });
    }

    return this.#domElementManager;
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
        emptyState: this._getElement('emptyState'),
        loadingState: this._getElement('loadingState'),
        resultsState: this._getElement('resultsState'),
        errorState: this._getElement('errorState'),
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
      this._setElementEnabled(key, enabled);
    });

    // Also handle any buttons in the form
    const form = this._getElement('form');
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
  _addEventListener(elementOrKey, event, handler, options = {}) {
    const element = this.#resolveEventTarget(elementOrKey, event);
    if (!element) {
      return null;
    }

    const boundHandler = handler?.bind ? handler.bind(this) : handler;

    return this.#getEventListenerRegistry().addEventListener(
      element,
      event,
      boundHandler,
      {
        ...options,
        originalHandler: handler,
      }
    );
  }

  /**
   * Subscribe to application event with automatic cleanup
   *
   * @protected
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} handler - Event handler function
   * @param {object} [options] - Subscription options
   * @param {string} [options.id] - Unique identifier
   * @returns {string|null} Subscription ID, or null if failed
   * @example
   * // Subscribe to application event
   * this._subscribeToEvent('USER_LOGGED_IN', this._handleUserLogin.bind(this));
   *
   * // With options
   * this._subscribeToEvent('DATA_UPDATED', this._refreshDisplay.bind(this), {
   *   id: 'main-data-refresh'
   * });
   */
  _subscribeToEvent(eventType, handler, options = {}) {
    if (!this.#eventBus) {
      this.#logger.warn(
        `${this.constructor.name}: Cannot subscribe to '${eventType}' - eventBus not available`
      );
      return null;
    }

    const boundHandler = handler?.bind ? handler.bind(this) : handler;

    return this.#getEventListenerRegistry().subscribeToEvent(
      this.#eventBus,
      eventType,
      boundHandler,
      {
        ...options,
        originalHandler: handler,
      }
    );
  }

  /**
   * Add delegated event listener for dynamic content
   *
   * @protected
   * @param {HTMLElement|string} containerOrKey - Container element or key
   * @param {string} selector - CSS selector for target elements
   * @param {string} event - Event type
   * @param {Function} handler - Event handler (receives event and matched element)
   * @param {object} [options] - Listener options
   * @returns {string} Listener ID
   * @example
   * // Handle clicks on dynamically added buttons
   * this._addDelegatedListener('resultsContainer', '.delete-btn', 'click',
   *   (event, button) => {
   *     const itemId = button.dataset.itemId;
   *     this._deleteItem(itemId);
   *   }
   * );
   */
  _addDelegatedListener(
    containerOrKey,
    selector,
    event,
    handler,
    options = {}
  ) {
    const container = this._getContainer(containerOrKey);
    if (!container) {
      this.#logger.warn(
        `${this.constructor.name}: Cannot add delegated listener - container '${containerOrKey}' not found`
      );
      return null;
    }

    const boundHandler = handler?.bind ? handler.bind(this) : handler;

    return this.#getEventListenerRegistry().addDelegatedListener(
      container,
      selector,
      event,
      boundHandler,
      {
        ...options,
        originalHandler: handler,
      }
    );
  }

  /**
   * Helper to get container element
   *
   * @param containerOrKey
   * @private
   */
  _getContainer(containerOrKey) {
    if (typeof containerOrKey === 'string') {
      return this._getElement(containerOrKey);
    }
    return containerOrKey;
  }

  /**
   * Resolve a DOM event target, logging warnings when cache lookups fail.
   *
   * @private
   * @param {HTMLElement|string|EventTarget} elementOrKey - Cached key or direct element.
   * @param {string} eventName - Event type for logging context.
   * @returns {EventTarget|null} Resolved target or null.
   */
  #resolveEventTarget(elementOrKey, eventName) {
    if (typeof elementOrKey === 'string') {
      const element = this._getElement(elementOrKey);
      if (!element) {
        this.#logger.warn(
          `${this.constructor.name}: Cannot add ${eventName} listener - element '${elementOrKey}' not found`
        );
        return null;
      }
      return element;
    }

    if (
      elementOrKey instanceof HTMLElement ||
      (elementOrKey && typeof elementOrKey.addEventListener === 'function')
    ) {
      return elementOrKey;
    }

    throw new Error(
      `Invalid element provided to _addEventListener: ${elementOrKey}`
    );
  }

  /**
   * Add debounced event listener
   *
   * @protected
   * @param {HTMLElement|string} elementOrKey - Element or key
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {number} delay - Debounce delay in milliseconds
   * @param {object} [options] - Additional options
   * @returns {string} Listener ID
   * @example
   * // Debounce search input
   * this._addDebouncedListener('searchInput', 'input',
   *   this._handleSearch.bind(this),
   *   300
   * );
   */
  _addDebouncedListener(elementOrKey, event, handler, delay, options = {}) {
    const element = this.#resolveEventTarget(elementOrKey, event);
    if (!element) {
      return null;
    }

    const boundHandler = handler?.bind ? handler.bind(this) : handler;

    return this.#getEventListenerRegistry().addDebouncedListener(
      element,
      event,
      boundHandler,
      delay,
      {
        ...options,
        originalHandler: handler,
      }
    );
  }

  /**
   * Add throttled event listener
   *
   * @protected
   * @param {HTMLElement|string} elementOrKey - Element or key
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {number} limit - Throttle limit in milliseconds
   * @param {object} [options] - Additional options
   * @returns {string} Listener ID
   * @example
   * // Throttle scroll handler
   * this._addThrottledListener(window, 'scroll',
   *   this._handleScroll.bind(this),
   *   100
   * );
   */
  _addThrottledListener(elementOrKey, event, handler, limit, options = {}) {
    const element = this.#resolveEventTarget(elementOrKey, event);
    if (!element) {
      return null;
    }

    const boundHandler = handler?.bind ? handler.bind(this) : handler;

    return this.#getEventListenerRegistry().addThrottledListener(
      element,
      event,
      boundHandler,
      limit,
      {
        ...options,
        originalHandler: handler,
      }
    );
  }

  /**
   * Add click handler with loading state
   *
   * @protected
   * @param {HTMLElement|string} elementOrKey - Element or key
   * @param {Function} asyncHandler - Async handler function
   * @param {object} [options] - Options
   * @returns {string} Listener ID
   */
  _addAsyncClickHandler(elementOrKey, asyncHandler, options = {}) {
    const element = this.#resolveEventTarget(elementOrKey, 'click');
    if (!element) {
      return null;
    }

    const boundHandler = asyncHandler?.bind
      ? asyncHandler.bind(this)
      : asyncHandler;

    return this.#getEventListenerRegistry().addAsyncClickHandler(
      element,
      boundHandler,
      options
    );
  }

  /**
   * Remove specific event listener by ID
   *
   * @protected
   * @param {string} listenerId - Listener ID returned from add methods
   * @returns {boolean} True if listener was removed
   */
  _removeEventListener(listenerId) {
    return (
      this.#eventListenerRegistry?.removeEventListener(listenerId) || false
    );
  }

  /**
   * Remove all event listeners
   *
   * @protected
   */
  _removeAllEventListeners() {
    this.#eventListenerRegistry?.removeAllEventListeners();
  }

  /**
   * Get event listener statistics (for debugging)
   *
   * @protected
   * @returns {object} Listener statistics
   */
  _getEventListenerStats() {
    return (
      this.#eventListenerRegistry?.getEventListenerStats() || {
        total: 0,
        dom: 0,
        eventBus: 0,
        byEvent: {},
      }
    );
  }

  /**
   * Prevent default and stop propagation helper
   *
   * @protected
   * @param {Event} event - DOM event
   * @param {Function} handler - Handler to execute
   * @example
   * formElement.addEventListener('submit', (e) => {
   *   this._preventDefault(e, () => this._handleSubmit());
   * });
   */
  _preventDefault(event, handler) {
    const boundHandler = handler ? (evt) => handler.call(this, evt) : undefined;

    this.#getEventListenerRegistry().preventDefault(event, boundHandler);
  }

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
   * Lazily create or retrieve the shared ErrorHandlingStrategy instance.
   *
   * @private
   * @returns {ErrorHandlingStrategy}
   */
  #getErrorHandlingStrategy() {
    if (!this.#errorHandlingStrategy) {
      this.#errorHandlingStrategy = new ErrorHandlingStrategy({
        logger: this.#logger,
        eventBus: this.#eventBus,
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
    }

    return this.#errorHandlingStrategy;
  }

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
   * Lazily create the shared ValidationService instance.
   *
   * @private
   * @returns {ValidationService}
   */
  #getValidationService() {
    if (!this.#validationService) {
      this.#validationService = new ValidationService({
        schemaValidator: this.#schemaValidator,
        logger: this.#logger,
        handleError: this._handleError.bind(this),
        errorCategories: ERROR_CATEGORIES,
      });
    }

    return this.#validationService;
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
    return this.#getErrorHandlingStrategy().handleError(error, context);
  }

  /**
   * Build comprehensive error details
   *
   * @param error
   * @param context
   * @private
   */
  _buildErrorDetails(error, context) {
    return this.#getErrorHandlingStrategy().buildErrorDetails(error, context);
  }

  /**
   * Categorize error automatically
   *
   * @param error
   * @private
   */
  _categorizeError(error) {
    return this.#getErrorHandlingStrategy().categorizeError(error);
  }

  /**
   * Generate user-friendly error message
   *
   * @param error
   * @param context
   * @private
   */
  _generateUserMessage(error, context) {
    return this.#getErrorHandlingStrategy().generateUserMessage(error, context);
  }

  /**
   * Log error with appropriate level
   *
   * @param errorDetails
   * @private
   */
  _logError(errorDetails) {
    this.#getErrorHandlingStrategy().logError(errorDetails);
  }

  /**
   * Show error to user using existing UI state management infrastructure
   *
   * @param errorDetails
   * @private
   */
  _showErrorToUser(errorDetails) {
    this.#getErrorHandlingStrategy().showErrorToUser(errorDetails);
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
    return this.#getErrorHandlingStrategy().handleServiceError(
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
    return this.#getErrorHandlingStrategy().executeWithErrorHandling(
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
    return this.#getErrorHandlingStrategy().isRetryableError(error);
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

    return this.#getValidationService().validateData(
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
    return this.#getValidationService().formatValidationErrors(errors);
  }

  /**
   * Build user-friendly validation error message
   *
   * @param errors
   * @private
   */
  _buildValidationErrorMessage(errors) {
    return this.#getValidationService().buildValidationErrorMessage(errors);
  }

  /**
   * Determine if error is recoverable
   *
   * @param error
   * @param context
   * @private
   */
  _determineRecoverability(error, context) {
    return this.#getErrorHandlingStrategy().determineRecoverability(
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
    return this.#getErrorHandlingStrategy().isRecoverableError(errorDetails);
  }

  /**
   * Attempt to recover from error
   *
   * @param errorDetails
   * @private
   */
  _attemptErrorRecovery(errorDetails) {
    this.#getErrorHandlingStrategy().attemptErrorRecovery(errorDetails);
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
    return this.#getErrorHandlingStrategy().createError(
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
    return this.#getErrorHandlingStrategy().wrapError(error, context);
  }

  /**
   * Get last error details (for debugging)
   *
   * @protected
   * @returns {object|null} Last error details
   */
  get lastError() {
    return this.#getErrorHandlingStrategy().lastError || null;
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
    const toolkit = this.#getAsyncUtilitiesToolkit();
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
  _setTimeout(callback, delay) {
    return this.#getAsyncUtilitiesToolkit().setTimeout(callback, delay);
  }

  /**
   * Clear a timeout set with _setTimeout
   *
   * @protected
   * @param {number} timerId - Timer ID to clear
   */
  _clearTimeout(timerId) {
    this.#getAsyncUtilitiesToolkit().clearTimeout(timerId);
  }

  /**
   * Set an interval that will be automatically cleared on destruction
   *
   * @protected
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Interval ID
   */
  _setInterval(callback, delay) {
    return this.#getAsyncUtilitiesToolkit().setInterval(callback, delay);
  }

  /**
   * Clear an interval set with _setInterval
   *
   * @protected
   * @param {number} intervalId - Interval ID to clear
   */
  _clearInterval(intervalId) {
    this.#getAsyncUtilitiesToolkit().clearInterval(intervalId);
  }

  /**
   * Request an animation frame that will be automatically cancelled on destruction
   *
   * @protected
   * @param {Function} callback - Function to execute
   * @returns {number} Animation frame ID
   */
  _requestAnimationFrame(callback) {
    return this.#getAsyncUtilitiesToolkit().requestAnimationFrame(callback);
  }

  /**
   * Cancel an animation frame
   *
   * @protected
   * @param {number} frameId - Animation frame ID to cancel
   */
  _cancelAnimationFrame(frameId) {
    this.#getAsyncUtilitiesToolkit().cancelAnimationFrame(frameId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Performance Monitoring
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mark a performance timestamp
   *
   * @protected
   * @param {string} markName - Name of the performance mark
   * @returns {void}
   */
  _performanceMark(markName) {
    this.#getPerformanceMonitor().mark(markName);
  }

  /**
   * Measure time between two marks
   *
   * @protected
   * @param {string} measureName - Name for the measurement
   * @param {string} startMark - Start mark name
   * @param {string} [endMark] - End mark name (defaults to current time)
   * @returns {number|null} Duration in milliseconds or null if marks not found
   */
  _performanceMeasure(measureName, startMark, endMark = null) {
    const measurement = this.#getPerformanceMonitor().measure(
      measureName,
      startMark,
      endMark
    );

    return measurement ? measurement.duration : null;
  }

  /**
   * Get all performance measurements
   *
   * @protected
   * @returns {Map<string, {duration: number, startMark: string, endMark: string}>}
   */
  _getPerformanceMeasurements() {
    if (!this.#performanceMonitor) {
      return new Map();
    }

    return this.#performanceMonitor.getMeasurements();
  }

  /**
   * Clear performance marks and measurements
   *
   * @protected
   * @param {string} [prefix] - Clear only marks/measurements with this prefix
   */
  _clearPerformanceData(prefix = null) {
    if (!this.#performanceMonitor) {
      this.#logger.debug('Cleared performance data', { prefix });
      return;
    }

    this.#performanceMonitor.clearData(prefix);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Memory Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Store a weak reference to an object
   *
   * @protected
   * @param {object} key - Key object
   * @param {any} value - Value to store
   */
  _setWeakReference(key, value) {
    this.#getMemoryManager().setWeakReference(key, value);
  }

  /**
   * Get a weak reference
   *
   * @protected
   * @param {object} key - Key object
   * @returns {any} Stored value or undefined
   */
  _getWeakReference(key) {
    return this.#getMemoryManager().getWeakReference(key);
  }

  /**
   * Track an object in a WeakSet
   *
   * @protected
   * @param {object} obj - Object to track
   */
  _trackWeakly(obj) {
    this.#getMemoryManager().trackWeakly(obj);
  }

  /**
   * Check if an object is being tracked
   *
   * @protected
   * @param {object} obj - Object to check
   * @returns {boolean}
   */
  _isWeaklyTracked(obj) {
    return this.#getMemoryManager().isWeaklyTracked(obj);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Debounce and Throttle Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a debounced version of a function
   * Function will only execute after the specified delay with no new calls
   *
   * @protected
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @param {object} [options] - Debounce options
   * @param {boolean} [options.leading] - Execute on the leading edge
   * @param {boolean} [options.trailing] - Execute on the trailing edge
   * @param {number} [options.maxWait] - Maximum time to wait before forcing execution
   * @returns {Function} Debounced function with cancel() method
   */
  _debounce(fn, delay, options = {}) {
    return this.#getAsyncUtilitiesToolkit().debounce(fn, delay, options);
  }

  /**
   * Create a throttled version of a function
   * Function will execute at most once per specified interval
   *
   * @protected
   * @param {Function} fn - Function to throttle
   * @param {number} wait - Minimum time between executions in milliseconds
   * @param {object} [options] - Throttle options
   * @param {boolean} [options.leading] - Execute on the leading edge
   * @param {boolean} [options.trailing] - Execute on the trailing edge
   * @returns {Function} Throttled function with cancel() method
   */
  _throttle(fn, wait, options = {}) {
    return this.#getAsyncUtilitiesToolkit().throttle(fn, wait, options);
  }

  /**
   * Get or create a debounced handler
   *
   * @protected
   * @param {string} key - Unique key for the handler
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @param {object} [options] - Debounce options
   * @returns {Function} Debounced function
   */
  _getDebouncedHandler(key, fn, delay, options) {
    const boundFn = fn?.bind ? fn.bind(this) : fn;
    return this.#getAsyncUtilitiesToolkit().getDebouncedHandler(
      key,
      boundFn,
      delay,
      options
    );
  }

  /**
   * Get or create a throttled handler
   *
   * @protected
   * @param {string} key - Unique key for the handler
   * @param {Function} fn - Function to throttle
   * @param {number} wait - Wait time in milliseconds
   * @param {object} [options] - Throttle options
   * @returns {Function} Throttled function
   */
  _getThrottledHandler(key, fn, wait, options) {
    const boundFn = fn?.bind ? fn.bind(this) : fn;
    return this.#getAsyncUtilitiesToolkit().getThrottledHandler(
      key,
      boundFn,
      wait,
      options
    );
  }

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
