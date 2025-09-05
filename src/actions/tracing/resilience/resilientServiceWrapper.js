/**
 * @file Resilient wrapper for tracing services
 * Provides error handling, retry logic, and fallback mechanisms
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import { TraceErrorType } from '../errors/traceErrorHandler.js';

/**
 * Wrapper that adds resilience to any tracing service
 */
export class ResilientServiceWrapper {
  #wrappedService;
  #errorHandler;
  #logger;
  #serviceName;
  #enabled;
  #fallbackMode;
  #errorCount;
  #lastErrorReset;

  constructor({ service, errorHandler, logger, serviceName }) {
    validateDependency(errorHandler, 'ITraceErrorHandler', logger, {
      requiredMethods: [
        'handleError',
        'shouldDisableComponent',
        'getErrorStatistics',
      ],
    });
    ensureValidLogger(logger);

    this.#wrappedService = service;
    this.#errorHandler = errorHandler;
    this.#logger = logger;
    this.#serviceName = serviceName;
    this.#enabled = true;
    this.#fallbackMode = null;
    this.#errorCount = 0;
    this.#lastErrorReset = Date.now();
  }

  /**
   * Create a proxy that intercepts all method calls
   *
   * @returns {Proxy} Proxied service with error handling
   */
  createResilientProxy() {
    return new Proxy(this.#wrappedService, {
      get: (target, prop) => {
        if (typeof target[prop] === 'function') {
          return this.#createResilientMethod(target, prop);
        }
        return target[prop];
      },
    });
  }

  /**
   * Check if service is currently enabled
   *
   * @returns {boolean} True if service is enabled
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Get current fallback mode
   *
   * @returns {string|null} Current fallback mode or null
   */
  getFallbackMode() {
    return this.#fallbackMode;
  }

  /**
   * Manually disable the service
   *
   * @param {string} reason - Reason for disabling
   */
  disable(reason) {
    this.#enabled = false;
    this.#logger.warn(`Service disabled: ${this.#serviceName}`, { reason });
  }

  /**
   * Re-enable the service
   */
  enable() {
    this.#enabled = true;
    this.#fallbackMode = null;
    this.#logger.info(`Service re-enabled: ${this.#serviceName}`);
  }

  #createResilientMethod(target, methodName) {
    return async (...args) => {
      // Check if service is disabled
      if (!this.#enabled) {
        return this.#handleDisabledService(methodName, args);
      }

      // Check if component should be disabled due to error patterns or circuit breaker
      if (this.#errorHandler.shouldDisableComponent(this.#serviceName)) {
        this.disable('Error pattern threshold exceeded');
        return this.#handleDisabledService(methodName, args);
      }

      try {
        // Execute the original method
        const result = await target[methodName].apply(target, args);

        // Reset fallback mode on successful execution
        if (this.#fallbackMode) {
          this.#fallbackMode = null;
          this.#logger.info(
            `Service recovered from fallback mode: ${this.#serviceName}`
          );
        }

        return result;
      } catch (error) {
        return await this.#handleMethodError(error, methodName, args, target);
      }
    };
  }

  async #handleMethodError(error, methodName, args, target) {
    // Track error count and check if we should disable
    this.#trackError();

    const context = {
      componentName: this.#serviceName,
      methodName,
      argumentCount: args.length,
    };

    // Classify error type based on error characteristics
    const errorType = this.#classifyError(error);

    // Handle the error through the error handler
    const recoveryResult = await this.#errorHandler.handleError(
      error,
      context,
      errorType
    );

    // Check if we've exceeded error threshold (5 errors in 5 minutes)
    if (this.#shouldDisableBasedOnErrors()) {
      this.disable('Error threshold exceeded');
      return this.#handleDisabledService(methodName, args);
    }

    // Apply recovery action
    switch (recoveryResult.recoveryAction) {
      case 'continue':
        return this.#createFallbackResult(methodName, args, target);

      case 'retry':
        // If retry is recommended, attempt to retry the operation with exponential backoff
        if (recoveryResult.shouldContinue && target) {
          const maxRetries = 3;
          let lastError = error;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // Exponential backoff with jitter
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
              const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
              await this.#waitForDelay(jitteredDelay);

              // Attempt the operation
              const result = await target[methodName].apply(target, args);

              // Success - clear fallback mode
              if (this.#fallbackMode) {
                this.#fallbackMode = null;
              }

              return result;
            } catch (retryError) {
              lastError = retryError;
              // Continue to next retry attempt
            }
          }

          // All retries failed, return fallback
          return this.#createFallbackResult(methodName, args, target);
        }
        return recoveryResult.shouldContinue
          ? this.#createFallbackResult(methodName, args, target)
          : undefined;

      case 'fallback':
        this.#fallbackMode = recoveryResult.fallbackMode;
        return this.#createFallbackResult(methodName, args, target);

      case 'disable':
        this.disable('Error handler requested disable');
        return this.#handleDisabledService(methodName, args);

      default:
        return this.#createFallbackResult(methodName, args, target);
    }
  }

  #classifyError(error) {
    if (error.name === 'ValidationError') {
      return TraceErrorType.VALIDATION;
    }

    if (
      error.code === 'ENOENT' ||
      error.code === 'EACCES' ||
      error.code === 'ENOSPC'
    ) {
      return TraceErrorType.FILE_SYSTEM;
    }

    if (error.name === 'SyntaxError' || error.name === 'TypeError') {
      return TraceErrorType.SERIALIZATION;
    }

    if (
      error.name === 'TimeoutError' ||
      error.code === 'ETIMEOUT' ||
      (error.message && error.message.toLowerCase().includes('timeout'))
    ) {
      return TraceErrorType.TIMEOUT;
    }

    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      (error.message && error.message.toLowerCase().includes('network'))
    ) {
      return TraceErrorType.NETWORK;
    }

    if (error.message && error.message.includes('memory')) {
      return TraceErrorType.MEMORY;
    }

    return TraceErrorType.UNKNOWN;
  }

  #handleDisabledService(methodName, args) {
    // First check if the service has a fallback method
    if (this.#wrappedService && typeof this.#wrappedService.getFallbackData === 'function') {
      try {
        return this.#wrappedService.getFallbackData.apply(this.#wrappedService, args);
      } catch (fallbackError) {
        this.#logger.error('Fallback method failed for disabled service', {
          service: this.#serviceName,
          method: methodName,
          error: fallbackError.message,
        });
      }
    }
    
    // Return appropriate fallback based on method type
    if (methodName === 'writeTrace' || methodName === 'outputTrace') {
      return Promise.resolve(); // No-op for write methods
    }

    if (methodName === 'shouldTrace' || methodName === 'isEnabled') {
      return false; // Conservative response for boolean methods
    }

    if (methodName === 'getConfig' || methodName === 'getInclusionConfig') {
      return {}; // Empty config for config methods
    }

    // Default fallback
    return undefined;
  }

  #createFallbackResult(methodName, args, target) {
    // Check if the service has a getFallbackData method
    if (target && typeof target.getFallbackData === 'function') {
      try {
        // Use the fallback data method
        return target.getFallbackData.apply(target, args);
      } catch (fallbackError) {
        this.#logger.error('Fallback method also failed', {
          service: this.#serviceName,
          method: methodName,
          error: fallbackError.message,
        });
      }
    }
    
    // Standard fallbacks for common methods
    if (methodName === 'writeTrace' || methodName === 'outputTrace') {
      return Promise.resolve(); // No-op for write methods
    }

    if (methodName === 'shouldTrace') {
      return false; // Don't trace when in fallback mode
    }

    if (methodName === 'isEnabled') {
      return false; // Report as disabled in fallback mode
    }

    if (methodName === 'processData') {
      // Return a default fallback value for processData method
      return Promise.resolve('fallback-data');
    }

    return undefined; // Default fallback result
  }

  #trackError() {
    // Reset counter if more than 5 minutes have passed
    const now = Date.now();
    if (now - this.#lastErrorReset > 300000) {
      // 5 minutes
      this.#errorCount = 0;
      this.#lastErrorReset = now;
    }

    this.#errorCount++;
  }

  #shouldDisableBasedOnErrors() {
    // Disable if more than 5 errors in the current 5-minute window
    return this.#errorCount > 5;
  }
  
  /**
   * Jest-compatible delay implementation
   *
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>} Promise that resolves after the delay
   * @private
   */
  #waitForDelay(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      if (typeof timer === 'object' && timer.unref) {
        timer.unref();
      }
    });
  }
}
