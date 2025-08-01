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

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../services/characterBuilderService.js').CharacterBuilderService} CharacterBuilderService */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

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

  /** @private @type {Array<{element: HTMLElement, event: string, handler: Function, options?: object}>} */
  #eventListeners = [];

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
        requiredMethods: ['validateAgainstSchema'],
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
   * @private
   * @returns {object} Validation rules keyed by service name
   */
  #getAdditionalServiceValidationRules() {
    return {};
  }

  /**
   * Check if an additional service is available
   *
   * @private
   * @param {string} serviceName - Name of the service to check
   * @returns {boolean} True if service is available and validated
   */
  #hasService(serviceName) {
    return this.#additionalServices[serviceName] !== undefined;
  }

  /**
   * Get an additional service by name
   *
   * @private
   * @param {string} serviceName - Name of the service to retrieve
   * @returns {*} The service instance or undefined
   */
  #getService(serviceName) {
    return this.#additionalServices[serviceName];
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
    this.#elements = {};
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
      await this._executeLifecycleMethod('_preInitialize', 'pre-initialization');

      // Step 1: Cache DOM elements
      await this._executeLifecycleMethod('_cacheElements', 'element caching', true);

      // Step 2: Initialize services
      await this._executeLifecycleMethod('_initializeServices', 'service initialization');

      // Step 3: Set up event listeners
      await this._executeLifecycleMethod('_setupEventListeners', 'event listener setup', true);

      // Step 4: Load initial data
      await this._executeLifecycleMethod('_loadInitialData', 'initial data loading');

      // Step 5: Initialize UI state
      await this._executeLifecycleMethod('_initializeUIState', 'UI state initialization');

      // Post-initialization hook
      await this._executeLifecycleMethod('_postInitialize', 'post-initialization');

      // Set initialized state
      this._setInitializationState(false, true);

      const initTime = performance.now() - startTime;
      this.logger.info(
        `${this.constructor.name}: Initialization completed in ${initTime.toFixed(2)}ms`
      );

      // Dispatch initialization complete event
      if (this.eventBus) {
        this.eventBus.dispatch('CONTROLLER_INITIALIZED', {
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
      this.logger.debug(
        `${this.constructor.name}: Starting ${phaseName}`
      );

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
      const enhancedError = new Error(
        `${phaseName} failed: ${error.message}`
      );
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
    if (this.characterBuilderService && this.characterBuilderService.initialize) {
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
   * Initialize UI state - override in subclasses
   * Called after data is loaded
   *
   * @protected
   * @example
   * // In subclass:
   * _initializeUIState() {
   *   if (this._hasData()) {
   *     this._showState('results');
   *   } else {
   *     this._showState('empty');
   *   }
   * }
   */
  _initializeUIState() {
    // Default implementation - show empty state if _showState exists
    if (typeof this._showState === 'function') {
      this._showState('empty');
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
    const userMessage = 'Failed to initialize page. Please refresh and try again.';

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

  /**
   * Cleanup resources - call when controller is destroyed
   * Will be implemented in ticket #8
   *
   * @public
   */
  destroy() {
    throw new Error('destroy() will be implemented in ticket #8');
  }
}

export default BaseCharacterBuilderController;
