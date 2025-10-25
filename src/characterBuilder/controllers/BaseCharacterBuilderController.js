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
import { CHARACTER_BUILDER_EVENTS } from '../services/characterBuilderService.js';

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

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

  /** @private @type {boolean} */
  #isInitialized = false;

  /** @private @type {boolean} */
  #isInitializing = false;

  /**
   * Enhanced event listener tracking with comprehensive metadata
   *
   * @private
   * @type {Array<{
   *   type: 'dom'|'eventBus',
   *   element?: HTMLElement,
   *   event: string,
   *   handler: Function,
   *   originalHandler?: Function,
   *   options?: object,
   *   id?: string,
   *   unsubscribe?: Function
   * }>}
   */
  #eventListeners = [];

  /** @private @type {number} */
  #eventListenerIdCounter = 0;

  /** @private @type {Map<string, Function>} */
  #debouncedHandlers = new Map();

  /** @private @type {Map<string, Function>} */
  #throttledHandlers = new Map();

  /** @private @type {UIStateManager} */
  #uiStateManager = null;

  /** @private @type {object|null} */
  #lastError = null;

  /** @private @type {boolean} */
  #isDestroyed = false;

  /** @private @type {boolean} */
  #isDestroying = false;

  /** @private @type {Array<{task: Function, description: string}>} */
  #cleanupTasks = [];

  /** @private @type {Set<number>} */
  #pendingTimers = new Set();

  /** @private @type {Set<number>} */
  #pendingIntervals = new Set();

  /** @private @type {Set<number>} */
  #pendingAnimationFrames = new Set();

  /** @private @type {Map<string, number>} */
  #performanceMarks = new Map();

  /** @private @type {Map<string, {duration: number, startMark: string, endMark: string}>} */
  #performanceMeasurements = new Map();

  /** @private @type {WeakMap<object, any>} */
  #weakReferences = new WeakMap();

  /** @private @type {WeakSet<object>} */
  #weakTracking = new WeakSet();

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
   * Get initialization status
   *
   * @public
   * @returns {boolean}
   */
  get isInitialized() {
    return this.#isInitialized;
  }

  /**
   * Get cached elements (for testing)
   * Creates a shallow copy to prevent external modification
   *
   * @public
   * @returns {object}
   */
  get elements() {
    return { ...this.#elements };
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

    const listenersToRestore = [];
    let detachedCount = 0;

    while (this.#eventListeners.length > 0) {
      const listener = this.#eventListeners.pop();

      if (listener.type === 'eventBus' && listener.unsubscribe) {
        try {
          listener.unsubscribe();
          detachedCount += 1;
        } catch (error) {
          this.#logger.error(
            `${this.constructor.name}: Error detaching event bus listener`,
            error
          );
        }
      } else {
        listenersToRestore.push(listener);
      }
    }

    listenersToRestore.reverse().forEach((listener) => {
      this.#eventListeners.push(listener);
    });

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
    return this.#isInitializing;
  }

  /**
   * Set initialization state
   *
   * @protected
   * @param {boolean} initializing
   * @param {boolean} initialized
   */
  _setInitializationState(initializing, initialized = false) {
    this.#isInitializing = initializing;
    this.#isInitialized = initialized;
  }

  /**
   * Reset initialization state (for re-initialization)
   *
   * @protected
   */
  _resetInitializationState() {
    this.#isInitialized = false;
    this.#isInitializing = false;
    this._clearElementCache();
  }

  /**
   * Clear all cached element references (enhances existing _resetInitializationState)
   *
   * @protected
   */
  _clearElementCache() {
    const count = Object.keys(this.#elements).length;
    this.#elements = {};

    this.#logger.debug(
      `${this.constructor.name}: Cleared ${count} cached element references`
    );
  }

  /**
   * Validate all cached elements still exist in DOM
   *
   * @protected
   * @returns {object} Validation results
   */
  _validateElementCache() {
    const results = {
      valid: [],
      invalid: [],
      total: 0,
    };

    for (const [key, element] of Object.entries(this.#elements)) {
      results.total++;

      if (element && document.body.contains(element)) {
        results.valid.push(key);
      } else {
        results.invalid.push(key);
        this.#logger.warn(
          `${this.constructor.name}: Cached element '${key}' no longer in DOM`
        );
      }
    }

    return results;
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
    if (!key || typeof key !== 'string') {
      throw new Error(
        `${this.constructor.name}: Invalid element key provided: ${key}`
      );
    }

    if (!selector || typeof selector !== 'string') {
      throw new Error(
        `${this.constructor.name}: Invalid selector provided for key '${key}': ${selector}`
      );
    }

    const startTime = performance.now();
    let element = null;

    try {
      // Optimize for ID selectors
      if (selector.startsWith('#') && !selector.includes(' ')) {
        const id = selector.slice(1);
        element = document.getElementById(id);

        if (!element && required) {
          throw new Error(`Required element with ID '${id}' not found in DOM`);
        }
      } else {
        // Use querySelector for complex selectors
        element = document.querySelector(selector);

        if (!element && required) {
          throw new Error(
            `Required element matching selector '${selector}' not found in DOM`
          );
        }
      }

      // Validate element if found
      if (element) {
        this._validateElement(element, key);
      }

      // Cache the element (even if null for optional elements)
      this.#elements[key] = element;

      const cacheTime = performance.now() - startTime;

      if (element) {
        this.#logger.debug(
          `${this.constructor.name}: Cached element '${key}' ` +
            `(${element.tagName}${element.id ? '#' + element.id : ''}) ` +
            `in ${cacheTime.toFixed(2)}ms`
        );
      } else {
        this.#logger.debug(
          `${this.constructor.name}: Optional element '${key}' not found ` +
            `(selector: ${selector})`
        );
      }

      return element;
    } catch (error) {
      const enhancedError = new Error(
        `${this.constructor.name}: Failed to cache element '${key}'. ${error.message}`
      );
      enhancedError.originalError = error;
      enhancedError.elementKey = key;
      enhancedError.selector = selector;

      this.#logger.error(
        `${this.constructor.name}: Element caching failed`,
        enhancedError
      );

      if (required) {
        throw enhancedError;
      }

      // For optional elements, just return null
      return null;
    }
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
    // Check if element is actually an HTMLElement
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Element '${key}' is not a valid HTMLElement`);
    }

    // Check if element is attached to DOM
    if (!document.body.contains(element)) {
      this.#logger.warn(
        `${this.constructor.name}: Element '${key}' is not attached to DOM`
      );
    }

    // Additional validation can be added here
    // e.g., check for specific attributes, element types, etc.
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
    const { continueOnError = true, stopOnFirstError = false } = options;
    const results = {
      cached: {},
      errors: [],
      stats: {
        total: 0,
        cached: 0,
        failed: 0,
        optional: 0,
      },
    };

    const startTime = performance.now();

    for (const [key, config] of Object.entries(elementMap)) {
      results.stats.total++;

      try {
        // Normalize config
        const elementConfig = this._normalizeElementConfig(config);
        const { selector, required, validate } = elementConfig;

        // Cache the element
        const element = this._cacheElement(key, selector, required);

        if (element) {
          // Run custom validation if provided
          if (validate && typeof validate === 'function') {
            if (!validate(element)) {
              throw new Error(`Custom validation failed for element '${key}'`);
            }
          }

          results.cached[key] = element;
          results.stats.cached++;
        } else if (!required) {
          results.stats.optional++;
        }
      } catch (error) {
        results.stats.failed++;
        results.errors.push({
          key,
          error: error.message,
          selector: typeof config === 'string' ? config : config.selector,
        });

        if (
          stopOnFirstError ||
          (!continueOnError && config.required !== false)
        ) {
          const batchError = new Error(
            `Element caching failed for '${key}': ${error.message}`
          );
          batchError.results = results;
          throw batchError;
        }

        this.#logger.warn(
          `${this.constructor.name}: Failed to cache element '${key}': ${error.message}`
        );
      }
    }

    const cacheTime = performance.now() - startTime;

    this.#logger.info(
      `${this.constructor.name}: Cached ${results.stats.cached}/${results.stats.total} elements ` +
        `(${results.stats.optional} optional, ${results.stats.failed} failed) ` +
        `in ${cacheTime.toFixed(2)}ms`
    );

    if (results.errors.length > 0) {
      this.#logger.warn(
        `${this.constructor.name}: Element caching errors:`,
        results.errors
      );
    }

    return results;
  }

  /**
   * Normalize element configuration
   *
   * @private
   * @param {string|object} config - Element configuration
   * @returns {object} Normalized configuration
   */
  _normalizeElementConfig(config) {
    if (typeof config === 'string') {
      return {
        selector: config,
        required: true,
        validate: null,
      };
    }

    return {
      selector: config.selector,
      required: config.required !== false,
      validate: config.validate || null,
    };
  }

  /**
   * Get a cached element by key
   *
   * @protected
   * @param {string} key - Element key
   * @returns {HTMLElement|null} The cached element or null
   */
  _getElement(key) {
    return this.#elements[key] || null;
  }

  /**
   * Check if an element is cached and available
   *
   * @protected
   * @param {string} key - Element key
   * @returns {boolean} True if element exists and is in DOM
   */
  _hasElement(key) {
    const element = this.#elements[key];
    return !!(element && document.body.contains(element));
  }

  /**
   * Get multiple cached elements by keys
   *
   * @protected
   * @param {string[]} keys - Array of element keys
   * @returns {object} Object with requested elements
   */
  _getElements(keys) {
    const elements = {};
    for (const key of keys) {
      elements[key] = this._getElement(key);
    }
    return elements;
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
    this.#logger.debug(`${this.constructor.name}: Refreshing element '${key}'`);

    // Remove from cache
    delete this.#elements[key];

    // Re-cache
    return this._cacheElement(key, selector, false);
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
    const element = this._getElement(key);
    if (element) {
      element.style.display = displayType;
      return true;
    }
    return false;
  }

  /**
   * Hide an element
   *
   * @protected
   * @param {string} key - Element key
   * @returns {boolean} True if element was hidden
   */
  _hideElement(key) {
    const element = this._getElement(key);
    if (element) {
      element.style.display = 'none';
      return true;
    }
    return false;
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
    const element = this._getElement(key);
    if (!element) return false;

    if (visible === undefined) {
      visible = element.style.display === 'none';
    }

    element.style.display = visible ? 'block' : 'none';
    return visible;
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
    const element = this._getElement(key);
    if (element && 'disabled' in element) {
      element.disabled = !enabled;
      return true;
    }
    return false;
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
    const element = this._getElement(key);
    if (element) {
      element.textContent = text;
      return true;
    }
    return false;
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
    const element = this._getElement(key);
    if (element) {
      element.classList.add(className);
      return true;
    }
    return false;
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
    const element = this._getElement(key);
    if (element) {
      element.classList.remove(className);
      return true;
    }
    return false;
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
    // Resolve element
    let element;
    if (typeof elementOrKey === 'string') {
      element = this._getElement(elementOrKey);
      if (!element) {
        this.#logger.warn(
          `${this.constructor.name}: Cannot add ${event} listener - element '${elementOrKey}' not found`
        );
        return null;
      }
    } else if (elementOrKey instanceof HTMLElement) {
      element = elementOrKey;
    } else {
      throw new Error(
        `Invalid element provided to _addEventListener: ${elementOrKey}`
      );
    }

    // Generate unique ID
    const listenerId =
      options.id || `listener-${++this.#eventListenerIdCounter}`;

    // Check for duplicate
    if (options.id && this.#eventListeners.some((l) => l.id === options.id)) {
      this.#logger.warn(
        `${this.constructor.name}: Listener with ID '${options.id}' already exists`
      );
      return listenerId;
    }

    // Bind handler to this context if needed
    const boundHandler = handler.bind ? handler.bind(this) : handler;

    // Add the event listener
    const listenerOptions = {
      capture: options.capture || false,
      once: options.once || false,
      passive: options.passive !== false, // Default to true for better performance
    };

    element.addEventListener(event, boundHandler, listenerOptions);

    // Track for cleanup
    this.#eventListeners.push({
      type: 'dom',
      element,
      event,
      handler: boundHandler,
      originalHandler: handler,
      options: listenerOptions,
      id: listenerId,
    });

    this.#logger.debug(
      `${this.constructor.name}: Added ${event} listener to ${element.tagName}#${element.id || 'no-id'} [${listenerId}]`
    );

    return listenerId;
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

    const subscriptionId =
      options.id || `sub-${++this.#eventListenerIdCounter}`;
    const boundHandler = handler.bind ? handler.bind(this) : handler;

    // Subscribe to event (EventBus.subscribe only takes eventType and handler)
    const unsubscribe = this.#eventBus.subscribe(eventType, boundHandler);

    if (!unsubscribe) {
      this.#logger.error(
        `${this.constructor.name}: Failed to subscribe to event '${eventType}'`
      );
      return null;
    }

    // Track for cleanup
    this.#eventListeners.push({
      type: 'eventBus',
      event: eventType,
      handler: boundHandler,
      originalHandler: handler,
      unsubscribe,
      id: subscriptionId,
    });

    this.#logger.debug(
      `${this.constructor.name}: Subscribed to event '${eventType}' [${subscriptionId}]`
    );

    return subscriptionId;
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
    const delegatedHandler = (e) => {
      // Find the target element that matches the selector
      const matchedElement = e.target.closest(selector);

      if (
        matchedElement &&
        this._getContainer(containerOrKey).contains(matchedElement)
      ) {
        handler.call(this, e, matchedElement);
      }
    };

    return this._addEventListener(containerOrKey, event, delegatedHandler, {
      ...options,
      id: options.id || `delegated-${selector}-${event}`,
    });
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
    const debouncedHandler = this._debounce(handler, delay);
    const listenerId = `debounced-${event}-${delay}`;

    // Store for cleanup
    this.#debouncedHandlers.set(listenerId, debouncedHandler);

    return this._addEventListener(elementOrKey, event, debouncedHandler, {
      ...options,
      id: options.id || listenerId,
    });
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
    const throttledHandler = this._throttle(handler, limit);
    const listenerId = `throttled-${event}-${limit}`;

    // Store for cleanup
    this.#throttledHandlers.set(listenerId, throttledHandler);

    return this._addEventListener(elementOrKey, event, throttledHandler, {
      ...options,
      id: options.id || listenerId,
    });
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
    const handler = async (event) => {
      const element = event.currentTarget;
      const originalText = element.textContent;
      const wasDisabled = element.disabled;

      try {
        // Show loading state
        element.disabled = true;
        if (options.loadingText) {
          element.textContent = options.loadingText;
        }
        element.classList.add('is-loading');

        // Execute handler
        await asyncHandler.call(this, event);
      } catch (error) {
        this.#logger.error(
          `${this.constructor.name}: Async click handler failed`,
          error
        );
        if (options.onError) {
          options.onError(error);
        }
      } finally {
        // Restore state
        element.disabled = wasDisabled;
        element.textContent = originalText;
        element.classList.remove('is-loading');
      }
    };

    return this._addEventListener(elementOrKey, 'click', handler, options);
  }

  /**
   * Remove specific event listener by ID
   *
   * @protected
   * @param {string} listenerId - Listener ID returned from add methods
   * @returns {boolean} True if listener was removed
   */
  _removeEventListener(listenerId) {
    const index = this.#eventListeners.findIndex((l) => l.id === listenerId);

    if (index === -1) {
      this.#logger.warn(
        `${this.constructor.name}: Listener '${listenerId}' not found`
      );
      return false;
    }

    const listener = this.#eventListeners[index];

    // Remove the listener
    if (listener.type === 'dom') {
      listener.element.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
    } else if (listener.type === 'eventBus' && listener.unsubscribe) {
      listener.unsubscribe();
    }

    // Remove from tracking
    this.#eventListeners.splice(index, 1);

    this.#logger.debug(
      `${this.constructor.name}: Removed listener '${listenerId}'`
    );

    return true;
  }

  /**
   * Remove all event listeners
   *
   * @protected
   */
  _removeAllEventListeners() {
    const count = this.#eventListeners.length;

    // Remove in reverse order to handle dependencies
    while (this.#eventListeners.length > 0) {
      const listener = this.#eventListeners.pop();

      try {
        if (listener.type === 'dom') {
          listener.element.removeEventListener(
            listener.event,
            listener.handler,
            listener.options
          );
        } else if (listener.type === 'eventBus' && listener.unsubscribe) {
          listener.unsubscribe();
        }
      } catch (error) {
        this.#logger.error(
          `${this.constructor.name}: Error removing listener`,
          error
        );
      }
    }

    // Clear debounced/throttled handlers
    this.#debouncedHandlers.clear();
    this.#throttledHandlers.clear();

    this.#logger.debug(
      `${this.constructor.name}: Removed ${count} event listeners`
    );
  }

  /**
   * Get event listener statistics (for debugging)
   *
   * @protected
   * @returns {object} Listener statistics
   */
  _getEventListenerStats() {
    const stats = {
      total: this.#eventListeners.length,
      dom: 0,
      eventBus: 0,
      byEvent: {},
    };

    this.#eventListeners.forEach((listener) => {
      if (listener.type === 'dom') stats.dom++;
      if (listener.type === 'eventBus') stats.eventBus++;

      const eventKey = `${listener.type}:${listener.event}`;
      stats.byEvent[eventKey] = (stats.byEvent[eventKey] || 0) + 1;
    });

    return stats;
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
    event.preventDefault();
    event.stopPropagation();

    if (handler) {
      handler.call(this, event);
    }
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
    if (this.isInitialized) {
      this.logger.warn(
        `${this.constructor.name}: Already initialized, skipping re-initialization`
      );
      return;
    }

    if (this.isInitializing) {
      this.logger.warn(
        `${this.constructor.name}: Initialization already in progress, skipping concurrent initialization`
      );
      return;
    }

    const startTime = performance.now();

    try {
      // Set initializing state
      this._setInitializationState(true, false);

      this.logger.info(`${this.constructor.name}: Starting initialization`);

      // Pre-initialization hook
      await this._executeLifecycleMethod(
        '_preInitialize',
        'pre-initialization'
      );

      // Step 1: Cache DOM elements
      await this._executeLifecycleMethod(
        '_cacheElements',
        'element caching',
        true
      );

      // Step 2: Initialize services
      await this._executeLifecycleMethod(
        '_initializeServices',
        'service initialization'
      );

      // Step 3: Set up event listeners
      await this._executeLifecycleMethod(
        '_setupEventListeners',
        'event listener setup',
        true
      );

      // Step 4: Load initial data
      await this._executeLifecycleMethod(
        '_loadInitialData',
        'initial data loading'
      );

      // Step 5: Initialize UI state
      await this._executeLifecycleMethod(
        '_initializeUIState',
        'UI state initialization'
      );

      // Post-initialization hook
      await this._executeLifecycleMethod(
        '_postInitialize',
        'post-initialization'
      );

      // Set initialized state
      this._setInitializationState(false, true);

      const initTime = performance.now() - startTime;
      this.logger.info(
        `${this.constructor.name}: Initialization completed in ${initTime.toFixed(2)}ms`
      );

      // Dispatch initialization complete event
      if (this.eventBus) {
        this.eventBus.dispatch('core:controller_initialized', {
          controllerName: this.constructor.name,
          initializationTime: initTime,
        });
      }
    } catch (error) {
      const initTime = performance.now() - startTime;
      this.logger.error(
        `${this.constructor.name}: Initialization failed after ${initTime.toFixed(2)}ms`,
        error
      );

      // Reset initializing state on error
      this._setInitializationState(false, false);

      await this._handleInitializationError(error);
      throw error;
    }
  }

  /**
   * Execute a lifecycle method with error handling and logging
   *
   * @private
   * @param {string} methodName - Name of the method to execute
   * @param {string} phaseName - Human-readable name of the phase
   * @param {boolean} [required] - Whether this method must be implemented
   * @returns {Promise<void>}
   * @throws {Error} If required method is not implemented or execution fails
   */
  async _executeLifecycleMethod(methodName, phaseName, required = false) {
    const startTime = performance.now();

    try {
      this.logger.debug(`${this.constructor.name}: Starting ${phaseName}`);

      // Check if method exists
      if (typeof this[methodName] !== 'function') {
        if (required) {
          throw new Error(
            `${this.constructor.name} must implement ${methodName}() method`
          );
        }
        // Optional method not implemented - skip
        this.logger.debug(
          `${this.constructor.name}: Skipping ${phaseName} (method not implemented)`
        );
        return;
      }

      // Execute the method
      await this[methodName]();

      const duration = performance.now() - startTime;
      this.logger.debug(
        `${this.constructor.name}: Completed ${phaseName} in ${duration.toFixed(2)}ms`
      );
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error(
        `${this.constructor.name}: Failed ${phaseName} after ${duration.toFixed(2)}ms`,
        error
      );

      // Re-throw with more context
      const enhancedError = new Error(`${phaseName} failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.phase = phaseName;
      enhancedError.methodName = methodName;
      throw enhancedError;
    }
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
    this.logger.warn(
      `${this.constructor.name}: Force re-initialization requested`
    );

    // Reset initialization state
    this._resetInitializationState();

    // Re-run initialization
    await this.initialize();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling Framework (Added in ticket #7)
  // ─────────────────────────────────────────────────────────────────────────

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
    const errorDetails = this._buildErrorDetails(error, context);

    // Track last error
    this.#lastError = errorDetails;

    // Log the error
    this._logError(errorDetails);

    // Show to user if appropriate
    if (context.showToUser !== false) {
      this._showErrorToUser(errorDetails);
    }

    // Dispatch error event for monitoring
    this._dispatchErrorEvent(errorDetails);

    // Check if recoverable
    if (this._isRecoverableError(errorDetails)) {
      this._attemptErrorRecovery(errorDetails);
    }

    return errorDetails;
  }

  /**
   * Build comprehensive error details
   *
   * @param error
   * @param context
   * @private
   */
  _buildErrorDetails(error, context) {
    const isErrorObject = error instanceof Error;

    return {
      message: isErrorObject ? error.message : String(error),
      stack: isErrorObject ? error.stack : new Error().stack,
      name: isErrorObject ? error.name : 'Error',
      timestamp: new Date().toISOString(),
      controller: this.constructor.name,
      operation: context.operation || 'unknown',
      category: context.category || this._categorizeError(error),
      severity: context.severity || ERROR_SEVERITY.ERROR,
      userMessage:
        context.userMessage || this._generateUserMessage(error, context),
      metadata: {
        ...context.metadata,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
      isRecoverable: this._determineRecoverability(error, context),
    };
  }

  /**
   * Categorize error automatically
   *
   * @param error
   * @private
   */
  _categorizeError(error) {
    const message = error.message || error.toString();

    if (message.includes('validation') || message.includes('invalid')) {
      return ERROR_CATEGORIES.VALIDATION;
    }
    if (message.includes('network') || message.includes('fetch')) {
      return ERROR_CATEGORIES.NETWORK;
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return ERROR_CATEGORIES.PERMISSION;
    }
    if (message.includes('not found') || message.includes('404')) {
      return ERROR_CATEGORIES.NOT_FOUND;
    }

    return ERROR_CATEGORIES.SYSTEM;
  }

  /**
   * Generate user-friendly error message
   *
   * @param error
   * @param context
   * @private
   */
  _generateUserMessage(error, context) {
    // If custom message provided, use it
    if (context.userMessage) {
      return context.userMessage;
    }

    // Generate based on category
    switch (context.category || this._categorizeError(error)) {
      case ERROR_CATEGORIES.VALIDATION:
        return 'Please check your input and try again.';
      case ERROR_CATEGORIES.NETWORK:
        return 'Connection error. Please check your internet and try again.';
      case ERROR_CATEGORIES.PERMISSION:
        return "You don't have permission to perform this action.";
      case ERROR_CATEGORIES.NOT_FOUND:
        return 'The requested resource was not found.';
      default:
        return 'An error occurred. Please try again or contact support.';
    }
  }

  /**
   * Log error with appropriate level
   *
   * @param errorDetails
   * @private
   */
  _logError(errorDetails) {
    const logData = {
      message: errorDetails.message,
      operation: errorDetails.operation,
      category: errorDetails.category,
      metadata: errorDetails.metadata,
    };

    switch (errorDetails.severity) {
      case ERROR_SEVERITY.INFO:
        this.#logger.info(
          `${this.constructor.name}: ${errorDetails.operation} info`,
          logData
        );
        break;
      case ERROR_SEVERITY.WARNING:
        this.#logger.warn(
          `${this.constructor.name}: ${errorDetails.operation} warning`,
          logData
        );
        break;
      case ERROR_SEVERITY.CRITICAL:
        this.#logger.error(
          `${this.constructor.name}: CRITICAL ERROR in ${errorDetails.operation}`,
          errorDetails
        );
        break;
      default:
        this.#logger.error(
          `${this.constructor.name}: Error in ${errorDetails.operation}`,
          logData
        );
    }
  }

  /**
   * Show error to user using existing UI state management infrastructure
   *
   * @param errorDetails
   * @private
   */
  _showErrorToUser(errorDetails) {
    // Use existing UIStateManager integration (already implemented in BaseCharacterBuilderController)
    // The controller already has sophisticated error display via _showError method
    if (typeof this._showError === 'function') {
      // Use existing _showError implementation that integrates with UIStateManager
      this._showError(errorDetails.userMessage);
    } else {
      // Fallback to existing error state display if _showError not available
      // Use existing UI_STATES.ERROR from UIStateManager integration
      if (typeof this._showState === 'function') {
        this._showState('error', {
          message: errorDetails.userMessage,
          category: errorDetails.category,
          severity: errorDetails.severity,
        });
      } else {
        // Final fallback to console (should not happen in production)
        console.error('Error display not available:', errorDetails.userMessage);
      }
    }
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
    this._handleError(error, {
      operation,
      category: ERROR_CATEGORIES.SYSTEM,
      userMessage,
      showToUser: true,
    });

    // Re-throw for caller to handle if needed
    throw error;
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
    const { userErrorMessage, retries = 0, retryDelay = 1000 } = options;

    let lastError;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        this.#logger.debug(
          `${this.constructor.name}: Executing ${operationName} (attempt ${attempt + 1}/${retries + 1})`
        );

        const result = await operation();

        if (attempt > 0) {
          this.#logger.info(
            `${this.constructor.name}: ${operationName} succeeded after ${attempt} retries`
          );
        }

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        const isRetryable = this._isRetryableError(error) && attempt <= retries;

        this._handleError(error, {
          operation: operationName,
          userMessage: userErrorMessage,
          showToUser: !isRetryable, // Don't show to user if we're retrying
          metadata: {
            attempt,
            maxRetries: retries,
            isRetrying: isRetryable,
          },
        });

        if (isRetryable) {
          this.#logger.info(
            `${this.constructor.name}: Retrying ${operationName} after ${retryDelay}ms`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * attempt)
          );
        } else {
          break;
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Check if error is retryable
   *
   * @param error
   * @private
   */
  _isRetryableError(error) {
    const retryableMessages = [
      'network',
      'timeout',
      'fetch',
      'temporary',
      'unavailable',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some((msg) => errorMessage.includes(msg));
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
    try {
      // Note: The schemaValidator interface expects validate() to return a ValidationResult object
      // The validateAgainstSchema utility from schemaValidationUtils.js handles the context but throws on error
      // So we need to use the validator's validate() method directly for non-throwing validation
      const validationResult = this.schemaValidator.validate(schemaId, data);

      if (validationResult.isValid) {
        return { isValid: true };
      }

      const failureMessage = `${this.constructor.name}: Validation failed for schema '${schemaId}' with ${
        validationResult.errors?.length || 0
      } error(s)`;
      this.#logger.warn(failureMessage, {
        operation: context.operation || 'validateData',
        schemaId,
      });

      // Format the validation errors from the result
      const formattedErrors = this._formatValidationErrors(
        validationResult.errors
      );

      return {
        isValid: false,
        errors: formattedErrors,
        errorMessage: this._buildValidationErrorMessage(formattedErrors),
        failureMessage,
      };
    } catch (error) {
      // Handle schema loading errors or validation system failures
      this._handleError(error, {
        operation: context.operation || 'validateData',
        category: ERROR_CATEGORIES.SYSTEM,
        userMessage: 'Validation failed. Please check your input.',
        metadata: { schemaId, dataKeys: Object.keys(data || {}) },
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        errorMessage: 'Unable to validate data. Please try again.',
      };
    }
  }

  /**
   * Format validation errors for display
   *
   * @param errors
   * @private
   */
  _formatValidationErrors(errors) {
    if (!Array.isArray(errors)) {
      return ['Invalid data format'];
    }

    return errors.map((error) => {
      if (typeof error === 'string') {
        return error;
      }

      // Handle AJV error format
      if (error.instancePath && error.message) {
        const field = error.instancePath.replace(/^\//, '').replace(/\//g, '.');
        return field ? `${field}: ${error.message}` : error.message;
      }

      return error.message || 'Unknown validation error';
    });
  }

  /**
   * Build user-friendly validation error message
   *
   * @param errors
   * @private
   */
  _buildValidationErrorMessage(errors) {
    if (errors.length === 1) {
      return errors[0];
    }

    return `Please fix the following errors:\n${errors.map((e) => `• ${e}`).join('\n')}`;
  }

  /**
   * Determine if error is recoverable
   *
   * @param error
   * @param context
   * @private
   */
  _determineRecoverability(error, context) {
    // Network errors are often recoverable
    if (context.category === ERROR_CATEGORIES.NETWORK) {
      return true;
    }

    // Some system errors might be transient
    if (error.message && error.message.includes('temporary')) {
      return true;
    }

    // Validation and permission errors are not recoverable
    if (
      [ERROR_CATEGORIES.VALIDATION, ERROR_CATEGORIES.PERMISSION].includes(
        context.category
      )
    ) {
      return false;
    }

    return false;
  }

  /**
   * Check if error is recoverable
   *
   * @param errorDetails
   * @private
   */
  _isRecoverableError(errorDetails) {
    return (
      errorDetails.isRecoverable &&
      errorDetails.severity !== ERROR_SEVERITY.CRITICAL
    );
  }

  /**
   * Attempt to recover from error
   *
   * @param errorDetails
   * @private
   */
  _attemptErrorRecovery(errorDetails) {
    this.#logger.info(
      `${this.constructor.name}: Attempting recovery from ${errorDetails.category} error`
    );

    switch (errorDetails.category) {
      case ERROR_CATEGORIES.NETWORK:
        // Retry after delay
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
        break;

      case ERROR_CATEGORIES.SYSTEM:
        // Attempt to reinitialize
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
        break;

      default:
        // No automatic recovery
        break;
    }
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
    const error = new Error(message);
    error.category = category;
    error.metadata = metadata;
    error.controller = this.constructor.name;
    return error;
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
    const wrappedError = new Error(`${context}: ${error.message}`);
    wrappedError.originalError = error;
    wrappedError.stack = error.stack;
    return wrappedError;
  }

  /**
   * Get last error details (for debugging)
   *
   * @protected
   * @returns {object|null} Last error details
   */
  get lastError() {
    return this.#lastError || null;
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
   * Execute a destruction phase with error handling
   *
   * @private
   * @param {string} phaseName - Name of the phase
   * @param {Function} phaseFunction - Function to execute
   */
  _executePhase(phaseName, phaseFunction) {
    try {
      this.#logger.debug(`${this.constructor.name}: Executing ${phaseName}`);
      phaseFunction.call(this);
    } catch (error) {
      this.#logger.error(
        `${this.constructor.name}: Error in ${phaseName}`,
        error
      );
      // Continue with destruction even if a phase fails
    }
  }

  /**
   * Cancel all pending operations (timers, intervals, animation frames)
   *
   * @protected
   */
  _cancelPendingOperations() {
    // Cancel timers
    const timerCount = this.#pendingTimers.size;
    if (timerCount > 0) {
      this.#pendingTimers.forEach((timerId) => clearTimeout(timerId));
      this.#pendingTimers.clear();
      this.#logger.debug(
        `${this.constructor.name}: Cancelled ${timerCount} pending timers`
      );
    }

    // Cancel intervals
    const intervalCount = this.#pendingIntervals.size;
    if (intervalCount > 0) {
      this.#pendingIntervals.forEach((intervalId) => clearInterval(intervalId));
      this.#pendingIntervals.clear();
      this.#logger.debug(
        `${this.constructor.name}: Cancelled ${intervalCount} pending intervals`
      );
    }

    // Cancel animation frames
    const animationCount = this.#pendingAnimationFrames.size;
    if (animationCount > 0) {
      this.#pendingAnimationFrames.forEach((frameId) =>
        cancelAnimationFrame(frameId)
      );
      this.#pendingAnimationFrames.clear();
      this.#logger.debug(
        `${this.constructor.name}: Cancelled ${animationCount} pending animation frames`
      );
    }

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
   * Execute all registered cleanup tasks in LIFO order
   *
   * @protected
   */
  _executeCleanupTasks() {
    const taskCount = this.#cleanupTasks.length;
    if (taskCount === 0) return;

    this.#logger.debug(
      `${this.constructor.name}: Executing ${taskCount} cleanup tasks`
    );

    // Execute in reverse order (LIFO)
    while (this.#cleanupTasks.length > 0) {
      const { task, description } = this.#cleanupTasks.pop();
      try {
        this.#logger.debug(
          `${this.constructor.name}: Executing cleanup task: ${description}`
        );
        task();
      } catch (error) {
        this.#logger.error(
          `${this.constructor.name}: Cleanup task failed: ${description}`,
          error
        );
        // Continue with other tasks
      }
    }
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
    this.#lastError = null;

    // Clear debounced/throttled handlers
    this.#debouncedHandlers.clear();
    this.#throttledHandlers.clear();

    // Clear performance data
    this._clearPerformanceData();

    // Clear weak references (they will be garbage collected)
    // Note: WeakMap and WeakSet don't need explicit clearing

    // Clear custom cached data
    this._clearCachedData();

    this.#logger.debug(`${this.constructor.name}: Cleared all references`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pending Operations Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set a timeout that will be automatically cleared on destruction
   *
   * @protected
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID
   */
  _setTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      this.#pendingTimers.delete(timerId);
      callback();
    }, delay);
    this.#pendingTimers.add(timerId);
    return timerId;
  }

  /**
   * Clear a timeout set with _setTimeout
   *
   * @protected
   * @param {number} timerId - Timer ID to clear
   */
  _clearTimeout(timerId) {
    if (this.#pendingTimers.has(timerId)) {
      clearTimeout(timerId);
      this.#pendingTimers.delete(timerId);
    }
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
    const intervalId = setInterval(callback, delay);
    this.#pendingIntervals.add(intervalId);
    return intervalId;
  }

  /**
   * Clear an interval set with _setInterval
   *
   * @protected
   * @param {number} intervalId - Interval ID to clear
   */
  _clearInterval(intervalId) {
    if (this.#pendingIntervals.has(intervalId)) {
      clearInterval(intervalId);
      this.#pendingIntervals.delete(intervalId);
    }
  }

  /**
   * Request an animation frame that will be automatically cancelled on destruction
   *
   * @protected
   * @param {Function} callback - Function to execute
   * @returns {number} Animation frame ID
   */
  _requestAnimationFrame(callback) {
    const frameId = requestAnimationFrame((timestamp) => {
      this.#pendingAnimationFrames.delete(frameId);
      callback(timestamp);
    });
    this.#pendingAnimationFrames.add(frameId);
    return frameId;
  }

  /**
   * Cancel an animation frame
   *
   * @protected
   * @param {number} frameId - Animation frame ID to cancel
   */
  _cancelAnimationFrame(frameId) {
    if (this.#pendingAnimationFrames.has(frameId)) {
      cancelAnimationFrame(frameId);
      this.#pendingAnimationFrames.delete(frameId);
    }
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
    try {
      const timestamp = performance.now();
      this.#performanceMarks.set(markName, timestamp);
      performance.mark(markName);

      this.#logger.debug(`Performance mark: ${markName}`, { timestamp });
    } catch (error) {
      this.#logger.warn(
        `Failed to create performance mark: ${markName}`,
        error
      );
    }
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
    try {
      if (!endMark) {
        // Create end mark if not provided
        endMark = `${measureName}-end`;
        this._performanceMark(endMark);
      }

      const startTime = this.#performanceMarks.get(startMark);
      const endTime = this.#performanceMarks.get(endMark);

      if (!startTime || !endTime) {
        this.#logger.warn(
          `Performance marks not found for measurement: ${measureName}`,
          {
            startMark,
            endMark,
            hasStartMark: !!startTime,
            hasEndMark: !!endTime,
          }
        );
        return null;
      }

      const duration = endTime - startTime;

      // Store measurement
      this.#performanceMeasurements.set(measureName, {
        duration,
        startMark,
        endMark,
      });

      // Use native Performance API if available
      try {
        performance.measure(measureName, startMark, endMark);
      } catch (e) {
        // Native API might fail if marks don't exist, but we have our own tracking
      }

      this.#logger.debug(`Performance measurement: ${measureName}`, {
        duration: `${duration.toFixed(2)}ms`,
        startMark,
        endMark,
      });

      // Dispatch performance event if duration exceeds threshold
      if (duration > 100) {
        this.eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING,
          {
            controller: this.constructor.name,
            measurement: measureName,
            duration,
            threshold: 100,
          }
        );
      }

      return duration;
    } catch (error) {
      this.#logger.warn(`Failed to measure performance: ${measureName}`, error);
      return null;
    }
  }

  /**
   * Get all performance measurements
   *
   * @protected
   * @returns {Map<string, {duration: number, startMark: string, endMark: string}>}
   */
  _getPerformanceMeasurements() {
    return new Map(this.#performanceMeasurements);
  }

  /**
   * Clear performance marks and measurements
   *
   * @protected
   * @param {string} [prefix] - Clear only marks/measurements with this prefix
   */
  _clearPerformanceData(prefix = null) {
    if (prefix) {
      // Clear specific marks and measurements with prefix
      for (const [key] of this.#performanceMarks) {
        if (key.startsWith(prefix)) {
          this.#performanceMarks.delete(key);
          try {
            performance.clearMarks(key);
          } catch (e) {
            // Ignore if mark doesn't exist
          }
        }
      }

      for (const [key] of this.#performanceMeasurements) {
        if (key.startsWith(prefix)) {
          this.#performanceMeasurements.delete(key);
          try {
            performance.clearMeasures(key);
          } catch (e) {
            // Ignore if measure doesn't exist
          }
        }
      }
    } else {
      // Clear all
      this.#performanceMarks.clear();
      this.#performanceMeasurements.clear();
      try {
        performance.clearMarks();
        performance.clearMeasures();
      } catch (e) {
        // Ignore errors
      }
    }

    this.#logger.debug('Cleared performance data', { prefix });
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
    if (typeof key !== 'object' || key === null) {
      throw new TypeError('WeakMap key must be an object');
    }
    this.#weakReferences.set(key, value);
  }

  /**
   * Get a weak reference
   *
   * @protected
   * @param {object} key - Key object
   * @returns {any} Stored value or undefined
   */
  _getWeakReference(key) {
    return this.#weakReferences.get(key);
  }

  /**
   * Track an object in a WeakSet
   *
   * @protected
   * @param {object} obj - Object to track
   */
  _trackWeakly(obj) {
    if (typeof obj !== 'object' || obj === null) {
      throw new TypeError('WeakSet value must be an object');
    }
    this.#weakTracking.add(obj);
  }

  /**
   * Check if an object is being tracked
   *
   * @protected
   * @param {object} obj - Object to check
   * @returns {boolean}
   */
  _isWeaklyTracked(obj) {
    return this.#weakTracking.has(obj);
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
    const { leading = false, trailing = true, maxWait } = options;

    let timerId = null;
    let maxTimerId = null;
    let lastCallTime = null;
    let lastExecuteTime = null;
    let lastArgs = null;
    let lastThis = null;
    let result;

    const executeFunction = () => {
      const args = lastArgs;
      const thisArg = lastThis;

      lastArgs = null;
      lastThis = null;
      lastExecuteTime = Date.now();

      result = fn.apply(thisArg, args);
      return result;
    };

    const startTimer = (wait) => {
      return this._setTimeout(() => {
        timerId = null;
        maxTimerId = null;

        if (trailing && lastArgs) {
          executeFunction();
        }
      }, wait);
    };

    const debounced = function (...args) {
      lastArgs = args;
      lastThis = this;
      lastCallTime = Date.now();

      const shouldExecuteNow = leading && !timerId;

      // Clear existing timer
      if (timerId) {
        this._clearTimeout(timerId);
      }

      // Handle maxWait
      if (maxWait && !maxTimerId) {
        const timeToMaxWait = maxWait - (lastCallTime - (lastExecuteTime || 0));

        if (timeToMaxWait <= 0) {
          // Max wait exceeded, execute immediately
          if (timerId) {
            this._clearTimeout(timerId);
            timerId = null;
          }
          executeFunction();
        } else {
          // Set max wait timer
          maxTimerId = this._setTimeout(() => {
            if (timerId) {
              this._clearTimeout(timerId);
              timerId = null;
            }
            maxTimerId = null;
            executeFunction();
          }, timeToMaxWait);
        }
      }

      timerId = startTimer(delay);

      if (shouldExecuteNow) {
        executeFunction();
      }

      return result;
    }.bind(this);

    // Add cancel method
    debounced.cancel = () => {
      if (timerId) {
        this._clearTimeout(timerId);
        timerId = null;
      }
      if (maxTimerId) {
        this._clearTimeout(maxTimerId);
        maxTimerId = null;
      }
      lastArgs = null;
      lastThis = null;
      lastCallTime = null;
      lastExecuteTime = null;
    };

    // Add flush method
    debounced.flush = () => {
      if (timerId) {
        this._clearTimeout(timerId);
        timerId = null;
      }
      if (maxTimerId) {
        this._clearTimeout(maxTimerId);
        maxTimerId = null;
      }
      if (lastArgs) {
        executeFunction();
      }
    };

    // Add pending check
    debounced.pending = () => {
      return !!timerId;
    };

    // Store for cleanup
    const key = `debounce_${fn.name || 'anonymous'}_${delay}`;
    this.#debouncedHandlers.set(key, debounced);

    return debounced;
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
    const { leading = true, trailing = true } = options;

    let timerId = null;
    let lastExecuteTime = 0;
    let lastArgs = null;
    let lastThis = null;
    let result;

    const executeFunction = () => {
      const args = lastArgs;
      const thisArg = lastThis;

      lastArgs = null;
      lastThis = null;
      lastExecuteTime = Date.now();

      result = fn.apply(thisArg, args);
      return result;
    };

    const throttled = function (...args) {
      const now = Date.now();
      const timeSinceLastExecute = now - lastExecuteTime;

      lastArgs = args;
      lastThis = this;

      const shouldExecuteNow = leading && timeSinceLastExecute >= wait;

      if (shouldExecuteNow) {
        // Execute immediately
        if (timerId) {
          this._clearTimeout(timerId);
          timerId = null;
        }
        executeFunction();
      } else if (!timerId && trailing) {
        // Schedule execution
        const delay = wait - timeSinceLastExecute;
        timerId = this._setTimeout(
          () => {
            timerId = null;
            if (lastArgs) {
              executeFunction();
            }
          },
          delay > 0 ? delay : wait
        );
      }

      return result;
    }.bind(this);

    // Add cancel method
    throttled.cancel = () => {
      if (timerId) {
        this._clearTimeout(timerId);
        timerId = null;
      }
      lastArgs = null;
      lastThis = null;
    };

    // Add flush method
    throttled.flush = () => {
      if (timerId) {
        this._clearTimeout(timerId);
        timerId = null;
      }
      if (lastArgs) {
        executeFunction();
      }
    };

    // Store for cleanup
    const key = `throttle_${fn.name || 'anonymous'}_${wait}`;
    this.#throttledHandlers.set(key, throttled);

    return throttled;
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
    if (!this.#debouncedHandlers.has(key)) {
      this.#debouncedHandlers.set(key, this._debounce(fn, delay, options));
    }
    return this.#debouncedHandlers.get(key);
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
    if (!this.#throttledHandlers.has(key)) {
      this.#throttledHandlers.set(key, this._throttle(fn, wait, options));
    }
    return this.#throttledHandlers.get(key);
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

    this.#cleanupTasks.push({ task, description });
    this.#logger.debug(
      `${this.constructor.name}: Registered cleanup task: ${description}`
    );
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
    if (this.#isDestroyed) {
      if (operation) {
        throw new Error(
          `${this.constructor.name}: Cannot ${operation} - controller is destroyed`
        );
      }
      return true;
    }
    return false;
  }

  /**
   * Get whether the controller has been destroyed
   *
   * @public
   * @returns {boolean}
   */
  get isDestroyed() {
    return this.#isDestroyed;
  }

  /**
   * Get whether the controller is currently being destroyed
   *
   * @public
   * @returns {boolean}
   */
  get isDestroying() {
    return this.#isDestroying;
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
    return (...args) => {
      this._checkDestroyed(`call ${methodName}`);
      return method.apply(this, args);
    };
  }

  /**
   * Destroy the controller instance
   * Cleans up event listeners, timers, and references
   *
   * @public
   * @returns {void}
   */
  destroy() {
    const startTime = performance.now();

    // Check if already destroyed
    if (this.#isDestroyed) {
      this.#logger.warn(
        `${this.constructor.name}: Already destroyed, skipping destruction`
      );
      return;
    }

    // Check if destruction in progress
    if (this.#isDestroying) {
      this.#logger.warn(
        `${this.constructor.name}: Destruction already in progress`
      );
      return;
    }

    this.#isDestroying = true;
    this.#logger.info(`${this.constructor.name}: Starting destruction`);

    try {
      // Phase 1: Pre-destruction hook
      this._executePhase('pre-destruction', () => this._preDestroy());

      // Phase 2: Cancel pending operations
      this._executePhase('pending operations cancellation', () =>
        this._cancelPendingOperations()
      );

      // Phase 3: Remove all event listeners
      this._executePhase('event listener removal', () =>
        this._removeAllEventListeners()
      );

      // Phase 4: Cleanup services
      this._executePhase('service cleanup', () => this._cleanupServices());

      // Phase 5: Clear element caches
      this._executePhase('element cache clearing', () =>
        this._clearElementCache()
      );

      // Phase 6: Execute registered cleanup tasks
      this._executePhase('cleanup task execution', () =>
        this._executeCleanupTasks()
      );

      // Phase 7: Clear remaining references
      this._executePhase('reference clearing', () => this._clearReferences());

      // Phase 8: Post-destruction hook
      this._executePhase('post-destruction', () => this._postDestroy());

      // Mark as destroyed
      this.#isDestroyed = true;
      this.#isDestroying = false;

      const duration = performance.now() - startTime;
      this.#logger.info(
        `${this.constructor.name}: Destruction completed in ${duration.toFixed(2)}ms`
      );

      // Dispatch destruction event
      if (this.#eventBus) {
        try {
          this.#eventBus.dispatch('CONTROLLER_DESTROYED', {
            controllerName: this.constructor.name,
            destructionTime: duration,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          // Log but don't throw - destruction should complete
          this.#logger.error(
            `${this.constructor.name}: Failed to dispatch destruction event`,
            error
          );
        }
      }
    } catch (error) {
      this.#logger.error(
        `${this.constructor.name}: Error during destruction`,
        error
      );
      // Still mark as destroyed even if there were errors
      this.#isDestroyed = true;
      this.#isDestroying = false;
      throw error;
    }
  }
}

export default BaseCharacterBuilderController;
