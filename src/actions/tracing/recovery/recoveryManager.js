/**
 * @file Recovery manager for action tracing system failures
 * @see ../errors/traceErrorHandler.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import {
  TraceErrorType,
  TraceErrorSeverity,
} from '../errors/traceErrorHandler.js';

/**
 * Recovery actions that can be taken
 */
export const RecoveryAction = {
  CONTINUE: 'continue', // Continue with degraded functionality
  RETRY: 'retry', // Retry the operation
  FALLBACK: 'fallback', // Use fallback mechanism
  DISABLE_COMPONENT: 'disable', // Disable the failing component
  RESTART_SERVICE: 'restart', // Restart the service
  EMERGENCY_STOP: 'emergency', // Emergency shutdown
};

/**
 * Manages recovery strategies for tracing system failures
 */
export class RecoveryManager {
  #logger;
  #config;
  #retryManager;
  #circuitBreakers;
  #fallbackModes;
  #errorCounts;
  #lastResetTimes;

  constructor({ logger, config, retryManager }) {
    ensureValidLogger(logger);

    this.#logger = logger;
    this.#config = config || {};
    this.#retryManager = retryManager;
    this.#circuitBreakers = new Map();
    this.#fallbackModes = new Map();
    this.#errorCounts = new Map();
    this.#lastResetTimes = new Map();
  }

  /**
   * Attempt to recover from an error
   *
   * @param {object} errorInfo - Information about the error
   * @returns {Promise<object>} Recovery result
   */
  async attemptRecovery(errorInfo) {
    const componentName = errorInfo.context?.componentName || 'unknown';

    // Track error count for this component
    this.#trackComponentError(componentName);

    // Check if circuit breaker should be opened
    if (this.#shouldOpenCircuit(componentName)) {
      this.#openCircuitBreaker(componentName);
    }

    let strategy = this.#selectRecoveryStrategy(errorInfo);

    // Allow components to provide explicit recovery overrides when they
    // have additional context about what action is safest.
    const override =
      errorInfo.recoveryStrategyOverride ||
      errorInfo.context?.recoveryStrategyOverride;
    if (override?.action) {
      strategy = {
        ...strategy,
        ...override,
        action: override.action,
      };
    }

    this.#logger.info(`Attempting recovery with strategy: ${strategy.action}`, {
      errorId: errorInfo.id,
      component: errorInfo.context?.componentName,
    });

    try {
      const customHandler =
        this.#config.customRecoveryHandlers?.[strategy.action];
      if (typeof customHandler === 'function') {
        return await customHandler(errorInfo, strategy);
      }

      switch (strategy.action) {
        case RecoveryAction.CONTINUE:
          return this.#handleContinue(errorInfo, strategy);

        case RecoveryAction.RETRY:
          return await this.#handleRetry(errorInfo, strategy);

        case RecoveryAction.FALLBACK:
          return await this.#handleFallback(errorInfo, strategy);

        case RecoveryAction.DISABLE_COMPONENT:
          return await this.#handleDisableComponent(errorInfo, strategy);

        case RecoveryAction.RESTART_SERVICE:
          return await this.#handleRestartService(errorInfo, strategy);

        case RecoveryAction.EMERGENCY_STOP:
          return await this.#handleEmergencyStop(errorInfo, strategy);

        default:
          return this.#handleContinue(errorInfo, strategy);
      }
    } catch (recoveryError) {
      this.#logger.error('Recovery attempt failed', {
        originalError: errorInfo.id,
        recoveryError: recoveryError.message,
      });

      // If recovery fails, fall back to safest option
      return {
        action: RecoveryAction.DISABLE_COMPONENT,
        shouldContinue: false,
        fallbackMode: 'disabled',
        success: false,
      };
    }
  }

  /**
   * Register a fallback mode for a specific component
   *
   * @param {string} componentName - Name of the component
   * @param {Function} fallbackHandler - Function to handle fallback mode
   */
  registerFallbackMode(componentName, fallbackHandler) {
    this.#fallbackModes.set(componentName, fallbackHandler);
  }

  /**
   * Check if a component is in circuit breaker open state
   *
   * @param {string} componentName - Name of the component
   * @returns {boolean} True if circuit is open
   */
  isCircuitOpen(componentName) {
    const breaker = this.#circuitBreakers.get(componentName);
    if (!breaker) return false;

    // Check if circuit should be reset based on reset timeout
    const resetTimeout = this.#config.circuitBreaker?.resetTimeout || 60000;
    const timeSinceOpen = Date.now() - (breaker.openTime || 0);

    if (timeSinceOpen >= resetTimeout) {
      // Circuit should be reset - remove it and reset error count
      this.#circuitBreakers.delete(componentName);
      this.#errorCounts.set(componentName, 0);
      return false;
    }

    // Check if breaker has isOpen method
    if (typeof breaker.isOpen === 'function') {
      return breaker.isOpen();
    }

    // Circuit is still open
    return true;
  }

  #selectRecoveryStrategy(errorInfo) {
    const { type, severity, context } = errorInfo;
    const componentName = context?.componentName || 'unknown';

    // If circuit breaker is open, disable the component
    if (this.isCircuitOpen(componentName)) {
      return { action: RecoveryAction.DISABLE_COMPONENT, priority: 1 };
    }

    // Critical errors trigger emergency procedures
    if (severity === TraceErrorSeverity.CRITICAL) {
      if (type === TraceErrorType.MEMORY) {
        return { action: RecoveryAction.EMERGENCY_STOP, priority: 1 };
      }
      return { action: RecoveryAction.DISABLE_COMPONENT, priority: 1 };
    }

    // High severity errors need strong action
    if (severity === TraceErrorSeverity.HIGH) {
      if (type === TraceErrorType.FILE_SYSTEM) {
        return { action: RecoveryAction.FALLBACK, priority: 2 };
      }
      return { action: RecoveryAction.DISABLE_COMPONENT, priority: 2 };
    }

    // Medium severity errors can often be retried
    if (severity === TraceErrorSeverity.MEDIUM) {
      if (this.#shouldRetry(errorInfo)) {
        return { action: RecoveryAction.RETRY, priority: 3, maxRetries: 3 };
      }
      return { action: RecoveryAction.FALLBACK, priority: 3 };
    }

    // Low severity errors just continue with logging
    return { action: RecoveryAction.CONTINUE, priority: 4 };
  }

  #shouldRetry(errorInfo) {
    const retryableErrors = [
      TraceErrorType.NETWORK,
      TraceErrorType.TIMEOUT,
      TraceErrorType.FILE_SYSTEM,
    ];

    return retryableErrors.includes(errorInfo.type);
  }

  #handleContinue(errorInfo, strategy) {
    return {
      action: RecoveryAction.CONTINUE,
      shouldContinue: true,
      fallbackMode: null,
      success: true,
    };
  }

  async #handleRetry(errorInfo, strategy) {
    const componentName = errorInfo.context?.componentName || 'unknown';
    const maxRetries = strategy.maxRetries || 3;

    // If we have a retry manager, attempt to retry
    if (this.#retryManager && typeof this.#retryManager.retry === 'function') {
      try {
        // Create a function that represents the operation to retry
        // Since we don't have the original operation, we'll create a placeholder
        // that can be overridden by registering retry handlers
        const retryOperation = async () => {
          // This is a placeholder - in a real scenario, we'd need to store
          // and replay the original operation
          return 'retry-success';
        };

        const retryResult = await this.#retryManager.retry(retryOperation, {
          maxAttempts: maxRetries,
          delay: 1000,
          exponentialBackoff: true,
          maxDelay: 10000,
        });

        return {
          action: RecoveryAction.RETRY,
          shouldContinue: true,
          fallbackMode: null,
          success: true,
          retryResult,
        };
      } catch (retryError) {
        this.#logger.warn('Retry failed, falling back to fallback strategy', {
          component: componentName,
          error: retryError.message,
        });

        // If retry fails, fall back to fallback strategy
        return await this.#handleFallback(errorInfo, strategy);
      }
    }

    // No retry manager available, fall back to fallback strategy
    return await this.#handleFallback(errorInfo, strategy);
  }

  async #handleFallback(errorInfo, strategy) {
    const componentName = errorInfo.context?.componentName || 'unknown';
    const fallbackHandler = this.#fallbackModes.get(componentName);

    if (fallbackHandler) {
      try {
        await fallbackHandler(errorInfo);
        return {
          action: RecoveryAction.FALLBACK,
          shouldContinue: true,
          fallbackMode: 'enabled',
          success: true,
        };
      } catch (fallbackError) {
        this.#logger.error('Fallback handler failed', {
          component: componentName,
          error: fallbackError.message,
        });
      }
    }

    // No fallback available or fallback failed
    return {
      action: RecoveryAction.FALLBACK,
      shouldContinue: true,
      fallbackMode: 'no-op', // Continue but with no-op tracing
      success: false,
    };
  }

  async #handleDisableComponent(errorInfo, strategy) {
    const componentName = errorInfo.context?.componentName || 'unknown';

    // Create circuit breaker for this component
    this.#circuitBreakers.set(componentName, {
      isOpen: () => true,
      openTime: Date.now(),
    });

    this.#logger.warn(`Component disabled due to errors: ${componentName}`, {
      errorId: errorInfo.id,
    });

    return {
      action: RecoveryAction.DISABLE_COMPONENT,
      shouldContinue: false,
      fallbackMode: 'disabled',
      success: true,
    };
  }

  async #handleRestartService(errorInfo, strategy) {
    const componentName = errorInfo.context?.componentName || 'unknown';

    // This would trigger a service restart through the container
    // Implementation depends on specific service restart mechanism

    return {
      action: RecoveryAction.RESTART_SERVICE,
      shouldContinue: false,
      fallbackMode: 'restarting',
      success: true,
    };
  }

  async #handleEmergencyStop(errorInfo, strategy) {
    this.#logger.error('Emergency stop triggered for action tracing system', {
      errorId: errorInfo.id,
      severity: errorInfo.severity,
    });

    // Disable all tracing components
    for (const componentName of this.#fallbackModes.keys()) {
      this.#circuitBreakers.set(componentName, {
        isOpen: () => true,
        openTime: Date.now(),
      });
    }

    return {
      action: RecoveryAction.EMERGENCY_STOP,
      shouldContinue: false,
      fallbackMode: 'emergency_disabled',
      success: true,
    };
  }

  async #executeOriginalOperation(errorInfo) {
    // This would re-execute the original operation that failed
    // Implementation depends on the specific operation context
    throw new Error('Original operation re-execution not implemented');
  }

  #trackComponentError(componentName) {
    const now = Date.now();

    // Increment error count first
    const currentCount = this.#errorCounts.get(componentName) || 0;
    const newCount = currentCount + 1;

    // Reset counter if more than 5 minutes have passed
    const lastReset = this.#lastResetTimes.get(componentName) || now;
    if (now - lastReset > 300000) {
      // 5 minutes
      this.#errorCounts.set(componentName, 1); // Set to 1 since we're counting this error
      this.#lastResetTimes.set(componentName, now);
    } else {
      // Within time window, use incremented count
      this.#errorCounts.set(componentName, newCount);
    }
  }

  #shouldOpenCircuit(componentName) {
    const errorCount = this.#errorCounts.get(componentName) || 0;
    // Use configured threshold or default to 5
    const threshold = this.#config.circuitBreaker?.threshold || 5;
    // Open circuit if error count reaches threshold
    return errorCount >= threshold;
  }

  #openCircuitBreaker(componentName) {
    if (!this.#circuitBreakers.has(componentName)) {
      this.#circuitBreakers.set(componentName, {
        isOpen: () => true,
        openTime: Date.now(),
      });

      this.#logger.warn(
        `Circuit breaker opened for component: ${componentName}`,
        {
          errorCount: this.#errorCounts.get(componentName),
        }
      );
    }
  }

  /**
   * @description Exposes internal utilities to support focused unit testing.
   * @returns {object} Helper functions for invoking private recovery flows.
   */
  getTestUtils() {
    return {
      invokeRestartService: (errorInfo, strategy) =>
        this.#handleRestartService(errorInfo, strategy),
      invokeEmergencyStop: (errorInfo, strategy) =>
        this.#handleEmergencyStop(errorInfo, strategy),
      invokeExecuteOriginalOperation: (errorInfo) =>
        this.#executeOriginalOperation(errorInfo),
      trackComponentError: (componentName) =>
        this.#trackComponentError(componentName),
      setCircuitBreaker: (componentName, breaker) =>
        this.#circuitBreakers.set(componentName, breaker),
      getCircuitBreaker: (componentName) =>
        this.#circuitBreakers.get(componentName),
      setLastResetTime: (componentName, timestamp) =>
        this.#lastResetTimes.set(componentName, timestamp),
      getErrorCount: (componentName) =>
        this.#errorCounts.get(componentName),
    };
  }
}
