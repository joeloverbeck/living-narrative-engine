/**
 * @file Centralized error handler for clothing system with recovery strategies
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { 
  ClothingAccessibilityError,
  CoverageAnalysisError,
  PriorityCalculationError,
  ClothingServiceError,
  ClothingValidationError
} from './clothingErrors.js';

/**
 * Centralized error handler with recovery strategies for clothing system
 */
export class ClothingErrorHandler {
  #logger;
  #eventBus;
  #recoveryStrategies;
  #errorMetrics;

  /**
   * @param {object} deps - Dependencies
   * @param {object} deps.logger - Logger instance
   * @param {object} deps.eventBus - Event bus for error notifications
   */
  constructor({ logger, eventBus }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['error', 'warn', 'info', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch']
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#recoveryStrategies = new Map();
    this.#errorMetrics = new Map();
    
    this.#initializeRecoveryStrategies();
  }

  /**
   * Generate unique error ID
   * @private
   * @returns {string} Error ID
   */
  #generateErrorId() {
    return `clothing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle clothing-related errors with appropriate recovery strategy
   * @param {Error} error - The error to handle
   * @param {object} context - Additional context for error handling
   * @returns {object} Recovery result with fallback data if applicable
   */
  handleError(error, context = {}) {
    const errorId = this.#generateErrorId();
    
    // Log error with full context
    this.#logError(error, context, errorId);
    
    // Update error metrics
    this.#updateErrorMetrics(error);
    
    // Dispatch error event for monitoring
    this.#dispatchErrorEvent(error, context, errorId);
    
    // Attempt recovery
    const recovery = this.#attemptRecovery(error, context);
    
    return {
      errorId,
      recovered: recovery.success,
      fallbackData: recovery.data,
      recoveryStrategy: recovery.strategy
    };
  }

  /**
   * Log error with context
   * @private
   */
  #logError(error, context, errorId) {
    const logContext = {
      errorId,
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorContext: error.context || {},
      handlerContext: context,
      stack: error.stack
    };

    // Check for clothing-specific error types
    const clothingErrorTypes = [
      'ClothingAccessibilityError',
      'CoverageAnalysisError',
      'PriorityCalculationError',
      'ClothingServiceError',
      'ClothingValidationError'
    ];

    if (clothingErrorTypes.includes(error.constructor.name)) {
      this.#logger.error('Clothing system error occurred', logContext);
    } else {
      this.#logger.error('Unexpected error in clothing system', logContext);
    }
  }

  /**
   * Attempt to recover from error
   * @private
   */
  #attemptRecovery(error, context) {
    const strategy = this.#recoveryStrategies.get(error.constructor.name);
    
    if (!strategy) {
      this.#logger.warn(`No recovery strategy for error type: ${error.constructor.name}`);
      return { success: false, data: null, strategy: 'none' };
    }

    try {
      const recoveryResult = strategy(error, context);
      this.#logger.info(`Error recovery successful: ${strategy.name}`, {
        errorType: error.constructor.name,
        strategy: strategy.name
      });
      return { success: true, data: recoveryResult, strategy: strategy.name };
    } catch (recoveryError) {
      this.#logger.error('Error recovery failed', {
        originalError: error.message,
        recoveryError: recoveryError.message,
        strategy: strategy.name
      });
      return { success: false, data: null, strategy: strategy.name };
    }
  }

  /**
   * Initialize recovery strategies for different error types
   * @private
   */
  #initializeRecoveryStrategies() {
    // Recovery strategy for accessibility service failures
    this.#recoveryStrategies.set('ClothingServiceError', (error, context) => {
      if (error.serviceName === 'ClothingAccessibilityService') {
        return this.#fallbackToLegacyClothingLogic(context);
      }
      return null;
    });

    // Recovery strategy for coverage analysis failures
    this.#recoveryStrategies.set('CoverageAnalysisError', (error, context) => {
      return this.#fallbackToLayerPriorityOnly(context);
    });

    // Recovery strategy for priority calculation failures
    this.#recoveryStrategies.set('PriorityCalculationError', (error, context) => {
      return this.#fallbackToDefaultPriorities(context);
    });

    // Recovery strategy for validation errors
    this.#recoveryStrategies.set('ClothingValidationError', (error, context) => {
      return this.#sanitizeAndRetry(error, context);
    });

    // Recovery strategy for accessibility errors
    this.#recoveryStrategies.set('ClothingAccessibilityError', (error, context) => {
      return this.#fallbackToSimpleAccessibility(context);
    });
  }

  /**
   * Fallback to legacy clothing logic
   * @private
   */
  #fallbackToLegacyClothingLogic(context) {
    this.#logger.warn('Falling back to legacy clothing logic');
    // Return simple item list without advanced features
    return { mode: 'legacy', items: [], accessible: true };
  }

  /**
   * Fallback to layer-only priority calculation
   * @private
   */
  #fallbackToLayerPriorityOnly(context) {
    this.#logger.warn('Coverage analysis failed, using layer priority only');
    // Return simplified priority without coverage blocking
    return { mode: 'layer_only', blockingDisabled: true };
  }

  /**
   * Fallback to default priority values
   * @private
   */
  #fallbackToDefaultPriorities(context) {
    this.#logger.warn('Priority calculation failed, using default priorities');
    // Use hardcoded priority values
    return { 
      mode: 'default_priorities',
      priorities: {
        outer: 1,
        base: 2,
        underwear: 3,
        accessories: 4
      }
    };
  }

  /**
   * Sanitize data and retry operation
   * @private
   */
  #sanitizeAndRetry(error, context) {
    this.#logger.warn('Validation error, attempting data sanitization');
    // Return sanitized data structure
    return { 
      mode: 'sanitized', 
      retryable: true,
      sanitizedField: error.field,
      sanitizedValue: null
    };
  }

  /**
   * Fallback to simple accessibility check
   * @private
   */
  #fallbackToSimpleAccessibility(context) {
    this.#logger.warn('Accessibility check failed, using simple fallback');
    // Return all items as accessible
    return { 
      mode: 'simple_accessibility',
      allAccessible: true
    };
  }

  /**
   * Dispatch error event to event bus
   * @private
   */
  #dispatchErrorEvent(error, context, errorId) {
    this.#eventBus.dispatch({
      type: 'CLOTHING_ERROR_OCCURRED',
      payload: {
        errorId,
        errorType: error.constructor.name,
        message: error.message,
        context: error.context || context,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Update error metrics
   * @private
   */
  #updateErrorMetrics(error) {
    const errorType = error.constructor.name;
    const current = this.#errorMetrics.get(errorType) || { count: 0, lastOccurrence: null };
    
    this.#errorMetrics.set(errorType, {
      count: current.count + 1,
      lastOccurrence: new Date().toISOString()
    });
  }

  /**
   * Get error metrics for monitoring
   * @returns {object} Error metrics by type
   */
  getErrorMetrics() {
    return Object.fromEntries(this.#errorMetrics);
  }

  /**
   * Clear error metrics (useful for testing)
   */
  clearMetrics() {
    this.#errorMetrics.clear();
  }
}

export default ClothingErrorHandler;