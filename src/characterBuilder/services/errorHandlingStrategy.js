/**
 * @file ErrorHandlingStrategy service centralizes error creation, logging, and recovery.
 */

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../shared/characterBuilder/uiStateManager.js').UIStateManager} UIStateManager */

/**
 * @typedef {object} ErrorHandlingStrategyDependencies
 * @property {ILogger} logger
 * @property {ISafeEventDispatcher} [eventBus]
 * @property {UIStateManager} [uiStateManager]
 * @property {Function} [showError]
 * @property {Function} [showState]
 * @property {Function} [dispatchErrorEvent]
 * @property {string} controllerName
 * @property {Record<string, string>} errorCategories
 * @property {Record<string, string>} errorSeverity
 * @property {Record<string, Function>} [recoveryHandlers]
 */

/**
 * @typedef {object} ExecuteWithErrorHandlingOptions
 * @property {string} [userErrorMessage]
 * @property {number} [retries]
 * @property {number} [retryDelay]
 */

/**
 * Centralizes BaseCharacterBuilderController error handling responsibilities.
 */
export class ErrorHandlingStrategy {
  /** @type {ILogger} */
  #logger;

  /** @type {ISafeEventDispatcher|null} */
  #eventBus;

  /** @type {UIStateManager|null} */
  #uiStateManager;

  /** @type {Function|null} */
  #showError;

  /** @type {Function|null} */
  #showState;

  /** @type {Function|null} */
  #dispatchErrorEvent;

  /** @type {string} */
  #controllerName;

  /** @type {Record<string, string>} */
  #errorCategories;

  /** @type {Record<string, string>} */
  #errorSeverity;

  /** @type {object|null} */
  #lastError = null;

  /** @type {Map<string, Function>} */
  #recoveryHandlers = new Map();

  /**
   * @param {ErrorHandlingStrategyDependencies} dependencies
   */
  constructor({
    logger,
    eventBus = null,
    uiStateManager = null,
    showError = null,
    showState = null,
    dispatchErrorEvent = null,
    controllerName,
    errorCategories,
    errorSeverity,
    recoveryHandlers = {},
  }) {
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#uiStateManager = uiStateManager;
    this.#showError = showError;
    this.#showState = showState;
    this.#dispatchErrorEvent = dispatchErrorEvent;
    this.#controllerName = controllerName;
    this.#errorCategories = errorCategories;
    this.#errorSeverity = errorSeverity;
    this.registerRecoveryHandlers(recoveryHandlers);
  }

  /**
   * Update controller-specific context such as UI handlers.
   *
   * @param {Partial<ErrorHandlingStrategyDependencies>} context
   * @returns {void}
   */
  configureContext(context = {}) {
    if ('uiStateManager' in context) {
      this.#uiStateManager = context.uiStateManager ?? null;
    }

    if ('showError' in context) {
      this.#showError =
        typeof context.showError === 'function' ? context.showError : null;
    }

    if ('showState' in context) {
      this.#showState =
        typeof context.showState === 'function' ? context.showState : null;
    }

    if ('dispatchErrorEvent' in context) {
      this.#dispatchErrorEvent =
        typeof context.dispatchErrorEvent === 'function'
          ? context.dispatchErrorEvent
          : null;
    }

    if (context.controllerName) {
      this.#controllerName = context.controllerName;
    }

    if (context.errorCategories) {
      this.#errorCategories = { ...context.errorCategories };
    }

    if (context.errorSeverity) {
      this.#errorSeverity = { ...context.errorSeverity };
    }

    if (context.recoveryHandlers) {
      this.registerRecoveryHandlers(context.recoveryHandlers);
    }
  }

  /**
   * Handle an error using the shared strategy.
   *
   * @param {Error|string} error
   * @param {object} [context]
   * @returns {object}
   */
  handleError(error, context = {}) {
    const errorDetails = this.buildErrorDetails(error, context);
    this.#lastError = errorDetails;

    this.logError(errorDetails);

    if (context.showToUser !== false) {
      this.showErrorToUser(errorDetails);
    }

    this.dispatchErrorEvent(errorDetails);

    if (this.isRecoverableError(errorDetails)) {
      this.attemptErrorRecovery(errorDetails);
    }

    return errorDetails;
  }

  /**
   * Handle service level errors and rethrow for callers.
   *
   * @param {Error} error
   * @param {string} operation
   * @param {string} [userMessage]
   * @returns {never}
   */
  handleServiceError(error, operation, userMessage) {
    this.handleError(error, {
      operation,
      category: this.#errorCategories.SYSTEM,
      userMessage,
      showToUser: true,
    });

    throw error;
  }

  /**
   * Execute an async operation with standardized error handling.
   *
   * @param {Function} operation
   * @param {string} operationName
   * @param {ExecuteWithErrorHandlingOptions} [options]
   * @returns {Promise<any>}
   */
  async executeWithErrorHandling(operation, operationName, options = {}) {
    const { userErrorMessage, retries = 0, retryDelay = 1000 } = options;
    let lastError;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        this.#logger.debug(
          `${this.#controllerName}: Executing ${operationName} (attempt ${attempt + 1}/${retries + 1})`
        );
        const result = await operation();

        if (attempt > 0) {
          this.#logger.info(
            `${this.#controllerName}: ${operationName} succeeded after ${attempt} retries`
          );
        } else {
          // Only reset lastError if operation succeeded on first attempt
          this.resetLastError();
        }

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        const isRetryable = this.isRetryableError(error) && attempt <= retries;

        this.handleError(error, {
          operation: operationName,
          userMessage: userErrorMessage,
          showToUser: !isRetryable,
          metadata: {
            attempt,
            maxRetries: retries,
            isRetrying: isRetryable,
          },
        });

        if (isRetryable) {
          this.#logger.info(
            `${this.#controllerName}: Retrying ${operationName} after ${retryDelay}ms`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * attempt)
          );
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Categorize errors using heuristics.
   *
   * @param {Error|string} error
   * @returns {string}
   */
  categorizeError(error) {
    const message = (error?.message || error?.toString() || '').toLowerCase();

    if (message.includes('validation') || message.includes('invalid')) {
      return this.#errorCategories.VALIDATION;
    }
    if (message.includes('network') || message.includes('fetch')) {
      return this.#errorCategories.NETWORK;
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return this.#errorCategories.PERMISSION;
    }
    if (message.includes('not found') || message.includes('404')) {
      return this.#errorCategories.NOT_FOUND;
    }

    return this.#errorCategories.SYSTEM;
  }

  /**
   * Build full error details payload.
   *
   * @param {Error|string} error
   * @param {object} context
   * @returns {object}
   */
  buildErrorDetails(error, context = {}) {
    const isErrorObject = error instanceof Error;

    return {
      message: isErrorObject ? error.message : String(error),
      stack: isErrorObject ? error.stack : new Error().stack,
      name: isErrorObject ? error.name : 'Error',
      timestamp: new Date().toISOString(),
      controller: this.#controllerName,
      operation: context.operation || 'unknown',
      category: context.category || this.categorizeError(error),
      severity: context.severity || this.#errorSeverity.ERROR,
      userMessage:
        context.userMessage || this.generateUserMessage(error, context),
      metadata: {
        ...context.metadata,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
      isRecoverable: this.determineRecoverability(error, context),
    };
  }

  /**
   * Generate a user friendly message.
   *
   * @param {Error|string} error
   * @param {object} context
   * @returns {string}
   */
  generateUserMessage(error, context = {}) {
    if (context.userMessage) {
      return context.userMessage;
    }

    switch (context.category || this.categorizeError(error)) {
      case this.#errorCategories.VALIDATION:
        return 'Please check your input and try again.';
      case this.#errorCategories.NETWORK:
        return 'Connection error. Please check your internet and try again.';
      case this.#errorCategories.PERMISSION:
        return "You don't have permission to perform this action.";
      case this.#errorCategories.NOT_FOUND:
        return 'The requested resource was not found.';
      default:
        return 'An error occurred. Please try again or contact support.';
    }
  }

  /**
   * Log error information with severity awareness.
   *
   * @param {object} errorDetails
   */
  logError(errorDetails) {
    const logData = {
      message: errorDetails.message,
      operation: errorDetails.operation,
      category: errorDetails.category,
      metadata: errorDetails.metadata,
    };

    switch (errorDetails.severity) {
      case this.#errorSeverity.INFO:
        this.#logger.info(
          `${this.#controllerName}: ${errorDetails.operation} info`,
          logData
        );
        break;
      case this.#errorSeverity.WARNING:
        this.#logger.warn(
          `${this.#controllerName}: ${errorDetails.operation} warning`,
          logData
        );
        break;
      case this.#errorSeverity.CRITICAL:
        this.#logger.error(
          `${this.#controllerName}: CRITICAL ERROR in ${errorDetails.operation}`,
          errorDetails
        );
        break;
      default:
        this.#logger.error(
          `${this.#controllerName}: Error in ${errorDetails.operation}`,
          logData
        );
    }
  }

  /**
   * Display error details using controller hooks.
   *
   * @param {object} errorDetails
   */
  showErrorToUser(errorDetails) {
    if (typeof this.#showError === 'function') {
      this.#showError(errorDetails.userMessage, errorDetails);
      return;
    }

    if (typeof this.#showState === 'function') {
      this.#showState('error', {
        message: errorDetails.userMessage,
        category: errorDetails.category,
        severity: errorDetails.severity,
      });
      return;
    }

    if (this.#uiStateManager) {
      this.#uiStateManager.showState('error', errorDetails.userMessage);
      return;
    }

    // eslint-disable-next-line no-console
    console.error('Error display not available:', errorDetails.userMessage);
  }

  /**
   * Emit error events for observers.
   *
   * @param {object} errorDetails
   */
  dispatchErrorEvent(errorDetails) {
    if (typeof this.#dispatchErrorEvent === 'function') {
      this.#dispatchErrorEvent(errorDetails);
      return;
    }

    if (this.#eventBus) {
      this.#eventBus.dispatch('SYSTEM_ERROR_OCCURRED', {
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
   * Determine whether the error is recoverable.
   *
   * @param {Error|string} error
   * @param {object} context
   * @returns {boolean}
   */
  determineRecoverability(error, context = {}) {
    if (context.category === this.#errorCategories.NETWORK) {
      return true;
    }

    if (error?.message && error.message.includes('temporary')) {
      return true;
    }

    if (
      [
        this.#errorCategories.VALIDATION,
        this.#errorCategories.PERMISSION,
      ].includes(context.category)
    ) {
      return false;
    }

    return false;
  }

  /**
   * Check if an error should be considered recoverable.
   *
   * @param {object} errorDetails
   * @returns {boolean}
   */
  isRecoverableError(errorDetails) {
    return (
      errorDetails.isRecoverable &&
      errorDetails.severity !== this.#errorSeverity.CRITICAL
    );
  }

  /**
   * Register a recovery handler.
   *
   * @param {string} category
   * @param {Function} handler
   */
  registerRecoveryHandler(category, handler) {
    if (typeof handler === 'function') {
      this.#recoveryHandlers.set(category, handler);
    }
  }

  /**
   * Register multiple recovery handlers.
   *
   * @param {Record<string, Function>} handlers
   */
  registerRecoveryHandlers(handlers = {}) {
    Object.entries(handlers).forEach(([category, handler]) => {
      this.registerRecoveryHandler(category, handler);
    });
  }

  /**
   * Attempt to recover based on error details.
   *
   * @param {object} errorDetails
   */
  attemptErrorRecovery(errorDetails) {
    this.#logger.info(
      `${this.#controllerName}: Attempting recovery from ${errorDetails.category} error`
    );

    const handler = this.#recoveryHandlers.get(errorDetails.category);
    if (typeof handler === 'function') {
      try {
        handler(errorDetails);
      } catch (error) {
        this.#logger.error(
          `${this.#controllerName}: Recovery handler failed`,
          error
        );
      }
    }
  }

  /**
   * Determine if an error qualifies for retry.
   *
   * @param {Error} error
   * @returns {boolean}
   */
  isRetryableError(error) {
    const retryableMessages = [
      'network',
      'timeout',
      'fetch',
      'temporary',
      'unavailable',
    ];
    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableMessages.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Create a standardized error instance.
   *
   * @param {string} message
   * @param {string} [category]
   * @param {object} [metadata]
   * @returns {Error}
   */
  createError(message, category, metadata) {
    const error = new Error(message);
    error.category = category;
    error.metadata = metadata;
    error.controller = this.#controllerName;
    return error;
  }

  /**
   * Wrap an error with extra context.
   *
   * @param {Error} error
   * @param {string} context
   * @returns {Error}
   */
  wrapError(error, context) {
    const wrappedError = new Error(`${context}: ${error.message}`);
    wrappedError.originalError = error;
    wrappedError.stack = error.stack;
    return wrappedError;
  }

  /**
   * Reset tracked last error state.
   */
  resetLastError() {
    this.#lastError = null;
  }

  /**
   * Last error accessor.
   *
   * @returns {object|null}
   */
  get lastError() {
    return this.#lastError;
  }
}

export default ErrorHandlingStrategy;
