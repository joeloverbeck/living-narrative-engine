/**
 * @file CentralErrorHandler - Centralized error handler for coordinating all service errors
 * @description Processes all service errors, classifies them, and coordinates with the monitoring system
 * @see baseError.js - Foundation error class used for classification
 * @see MonitoringCoordinator.js - Monitoring system integration
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import BaseError from './baseError.js'; // Note: lowercase 'b' in baseError.js

/**
 * Central error handler that processes all service errors, classifies them,
 * and coordinates with the monitoring system
 *
 * @class
 */
class CentralErrorHandler {
  #logger;
  #eventBus;
  #errorRegistry;
  #recoveryStrategies;
  #errorTransforms;
  #metrics;

  constructor({ logger, eventBus, monitoringCoordinator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'error', 'warn', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch', 'subscribe']
    });
    validateDependency(monitoringCoordinator, 'IMonitoringCoordinator', logger, {
      requiredMethods: ['executeMonitored', 'getStats', 'getPerformanceMonitor']
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#errorRegistry = new Map();
    this.#recoveryStrategies = new Map();
    this.#errorTransforms = new Map();
    this.#metrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      errorsByType: new Map()
    };

    this.#registerEventListeners();
  }

  // Main error handling method
  async handle(error, context = {}) {
    const errorInfo = this.#classifyError(error, context);

    // Track metrics
    this.#updateMetrics(errorInfo);

    // Log error with classification
    this.#logError(errorInfo);

    // Dispatch error event
    this.#notifyError(errorInfo);

    // Attempt recovery if possible
    if (errorInfo.recoverable) {
      try {
        const result = await this.#attemptRecovery(errorInfo);
        if (result.success) {
          return result.data;
        }
      } catch (recoveryError) {
        this.#logger.error('Recovery failed', {
          originalError: errorInfo,
          recoveryError: recoveryError.message
        });
      }
    }

    // Enhance and throw if recovery failed or not recoverable
    throw this.#enhanceError(error, errorInfo);
  }

  // Synchronous error handling
  handleSync(error, context = {}) {
    const errorInfo = this.#classifyError(error, context);
    this.#updateMetrics(errorInfo);
    this.#logError(errorInfo);
    this.#notifyError(errorInfo);

    if (errorInfo.recoverable && this.#hasSyncRecoveryStrategy(errorInfo.type)) {
      const fallback = this.#getSyncFallback(errorInfo);
      if (fallback !== undefined) {
        return fallback;
      }
    }

    throw this.#enhanceError(error, errorInfo);
  }

  // Register recovery strategy
  registerRecoveryStrategy(errorType, strategy) {
    this.#recoveryStrategies.set(errorType, strategy);
    this.#logger.debug(`Registered recovery strategy for ${errorType}`);
  }

  // Register error transform
  registerErrorTransform(errorType, transform) {
    this.#errorTransforms.set(errorType, transform);
    this.#logger.debug(`Registered error transform for ${errorType}`);
  }

  // Get fallback value for operation
  getFallbackValue(operation, _errorType) {
    const fallbacks = {
      'fetch': null,
      'parse': {},
      'validate': false,
      'generate': '',
      'calculate': 0
    };
    return fallbacks[operation] ?? null;
  }

  // Private methods
  #classifyError(error, context) {
    const isBaseError = error instanceof BaseError;

    return {
      id: error.correlationId || this.#generateErrorId(),
      type: error.constructor.name,
      code: isBaseError ? error.code : 'UNKNOWN_ERROR',
      message: error.message,
      severity: isBaseError ? error.severity : 'error',
      recoverable: isBaseError ? error.recoverable : false,
      context: {
        ...context,
        ...(isBaseError ? error.context : {}),
        timestamp: Date.now(),
        stack: error.stack
      },
      originalError: error
    };
  }

  #enhanceError(error, errorInfo) {
    if (error instanceof BaseError) {
      // Add additional context
      error.addContext('handledBy', 'CentralErrorHandler');
      error.addContext('handledAt', Date.now());
      error.addContext('recoveryAttempted', errorInfo.recoverable);
      return error;
    }

    // Wrap non-BaseError in BaseError
    const enhancedError = new BaseError(
      error.message,
      'WRAPPED_ERROR',
      errorInfo.context
    );
    enhancedError.cause = error;
    return enhancedError;
  }


  async #attemptRecovery(errorInfo) {
    const strategy = this.#recoveryStrategies.get(errorInfo.type);
    if (!strategy) {
      return { success: false };
    }

    try {
      const result = await strategy(errorInfo);
      this.#metrics.recoveredErrors++;
      return { success: true, data: result };
    } catch (error) {
      this.#metrics.failedRecoveries++;
      throw error;
    }
  }

  #generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  #logError(errorInfo) {
    const logData = {
      errorId: errorInfo.id,
      type: errorInfo.type,
      code: errorInfo.code,
      severity: errorInfo.severity,
      recoverable: errorInfo.recoverable,
      message: errorInfo.message,
      context: errorInfo.context
    };

    // Log based on severity
    switch (errorInfo.severity) {
      case 'critical':
        this.#logger.error('Critical error occurred', logData);
        break;
      case 'error':
        this.#logger.error('Error occurred', logData);
        break;
      case 'warning':
        this.#logger.warn('Warning occurred', logData);
        break;
      default:
        this.#logger.info('Error handled', logData);
    }
  }

  #notifyError(errorInfo) {
    this.#eventBus.dispatch({
      type: 'ERROR_OCCURRED',
      payload: {
        errorId: errorInfo.id,
        errorType: errorInfo.type,
        severity: errorInfo.severity,
        recoverable: errorInfo.recoverable,
        message: errorInfo.message,
        timestamp: errorInfo.context.timestamp
      }
    });
  }

  #hasSyncRecoveryStrategy(errorType) {
    return this.#recoveryStrategies.has(errorType) &&
           this.#recoveryStrategies.get(errorType).sync === true;
  }

  #getSyncFallback(errorInfo) {
    const strategy = this.#recoveryStrategies.get(errorInfo.type);
    if (strategy && strategy.fallback) {
      return strategy.fallback(errorInfo);
    }
    return undefined;
  }

  #updateMetrics(errorInfo) {
    this.#metrics.totalErrors++;

    const typeCount = this.#metrics.errorsByType.get(errorInfo.type) || 0;
    this.#metrics.errorsByType.set(errorInfo.type, typeCount + 1);

    // Register in error registry
    this.#errorRegistry.set(errorInfo.id, {
      ...errorInfo,
      registeredAt: Date.now()
    });

    // Clean old entries (keep last 1000)
    if (this.#errorRegistry.size > 1000) {
      const firstKey = this.#errorRegistry.keys().next().value;
      this.#errorRegistry.delete(firstKey);
    }
  }

  #registerEventListeners() {
    // Listen for domain-specific error events
    this.#eventBus.subscribe('CLOTHING_ERROR_OCCURRED', (event) => {
      this.handle(event.payload.error, event.payload.context);
    });

    this.#eventBus.subscribe('ANATOMY_ERROR_OCCURRED', (event) => {
      this.handle(event.payload.error, event.payload.context);
    });
  }

  // Public API
  getMetrics() {
    return {
      ...this.#metrics,
      errorsByType: Object.fromEntries(this.#metrics.errorsByType),
      registrySize: this.#errorRegistry.size,
      recoveryRate: this.#metrics.totalErrors > 0
        ? this.#metrics.recoveredErrors / this.#metrics.totalErrors
        : 0
    };
  }

  getErrorHistory(limit = 10) {
    const entries = Array.from(this.#errorRegistry.values());
    return entries.slice(-limit);
  }

  clearMetrics() {
    this.#metrics.totalErrors = 0;
    this.#metrics.recoveredErrors = 0;
    this.#metrics.failedRecoveries = 0;
    this.#metrics.errorsByType.clear();
    this.#errorRegistry.clear();
  }
}

export default CentralErrorHandler;