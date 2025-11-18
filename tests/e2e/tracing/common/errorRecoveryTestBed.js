/**
 * @file Error Recovery Test Bed
 * @description Specialized test infrastructure for error recovery workflow testing
 */

import { createMockFacades } from '../../../common/facades/testingFacadeRegistrations.js';
import { TraceErrorHandler } from '../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { RecoveryManager } from '../../../../src/actions/tracing/recovery/recoveryManager.js';
import { RetryManager } from '../../../../src/actions/tracing/resilience/retryManager.js';
import { ResilientServiceWrapper } from '../../../../src/actions/tracing/resilience/resilientServiceWrapper.js';
import { ErrorMetricsService } from '../../../../src/actions/tracing/metrics/errorMetricsService.js';
import { ErrorClassifier } from '../../../../src/actions/tracing/errorClassification.js';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';

/**
 * Test bed for comprehensive error recovery workflow testing
 */
export class ErrorRecoveryTestBed {
  constructor() {
    // Core facades
    this.facades = null;
    this.logger = null;

    // Error recovery components
    this.errorHandler = null;
    this.recoveryManager = null;
    this.retryManager = null;
    this.errorMetrics = null;
    this.errorClassifier = null;
    this.resilientWrappers = new Map();

    // Trace components
    this.traceFactory = null;

    // Error tracking
    this.capturedErrors = [];
    this.recoveryAttempts = [];
    this.circuitBreakerStates = new Map();
    this.componentStates = new Map();
    this.errorHistory = [];

    // Metrics tracking with bounds to prevent memory leaks
    this.performanceMetrics = {
      errorClassificationTimes: [],
      recoveryAttemptTimes: [],
      retryDelays: [],
      maxEntries: 100, // Prevent unbounded growth
    };

    // Configuration
    this.config = {
      circuitBreaker: {
        threshold: 5,
        timeout: 30000,
        resetTimeout: 60000,
      },
      retry: {
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: true,
        maxDelay: 30000,
        jitter: true,
      },
      errorThresholds: {
        disableAfter: 5,
        timeWindow: 300000, // 5 minutes
      },
    };

    this.initialized = false;
  }

  /**
   * Initialize the error recovery test bed
   *
   * @param customConfig
   */
  async initialize(customConfig = {}) {
    // Always merge custom config, even if already initialized
    this.config = { ...this.config, ...customConfig };

    if (this.initialized) {
      // If already initialized, just update the config in components that need it
      if (this.recoveryManager && customConfig.circuitBreaker) {
        // Update recovery manager's circuit breaker config
        this.recoveryManager = new RecoveryManager({
          logger: this.logger,
          config: this.config,
          retryManager: this.retryManager,
        });
      }
      if (
        this.errorHandler &&
        (customConfig.circuitBreaker || customConfig.errorThresholds)
      ) {
        // Update error handler's config
        this.errorHandler = new TraceErrorHandler({
          logger: this.logger,
          errorMetrics: this.errorMetrics,
          recoveryManager: this.recoveryManager,
          config: this.config,
        });
        // Re-setup monitoring with new components
        this.#setupMonitoring();
      }
      return;
    }

    // Create facades
    // eslint-disable-next-line no-undef
    this.facades = createMockFacades({}, jest.fn);
    this.logger = this.facades.logger;

    // Initialize error recovery components
    this.#initializeErrorComponents();

    // Initialize trace components
    this.#initializeTraceComponents();

    // Setup error injection hooks
    this.#setupErrorInjection();

    // Setup monitoring
    this.#setupMonitoring();

    this.initialized = true;
  }

  /**
   * Initialize error recovery components
   *
   * @private
   */
  #initializeErrorComponents() {
    // Create error metrics service
    this.errorMetrics = new ErrorMetricsService({
      logger: this.logger,
    });

    // Create retry manager
    this.retryManager = new RetryManager();

    // Create recovery manager
    this.recoveryManager = new RecoveryManager({
      logger: this.logger,
      config: this.config,
      retryManager: this.retryManager,
    });

    // Create error handler
    this.errorHandler = new TraceErrorHandler({
      logger: this.logger,
      errorMetrics: this.errorMetrics,
      recoveryManager: this.recoveryManager,
      config: this.config,
    });

    // Create error classifier
    this.errorClassifier = new ErrorClassifier({
      logger: this.logger,
    });
  }

  /**
   * Initialize trace components
   *
   * @private
   */
  #initializeTraceComponents() {
    this.traceFactory = new ActionExecutionTraceFactory({
      logger: this.logger,
    });
  }

  /**
   * Setup error injection capabilities
   *
   * @private
   */
  #setupErrorInjection() {
    this.errorInjector = {
      nextError: null,
      errorSequence: [],
      sequenceIndex: 0,

      injectError: (error) => {
        this.errorInjector.nextError = error;
      },

      injectErrorSequence: (errors) => {
        this.errorInjector.errorSequence = errors;
        this.errorInjector.sequenceIndex = 0;
      },

      getNextError: () => {
        if (this.errorInjector.nextError) {
          const error = this.errorInjector.nextError;
          this.errorInjector.nextError = null;
          return error;
        }

        if (this.errorInjector.errorSequence.length > 0) {
          const error =
            this.errorInjector.errorSequence[this.errorInjector.sequenceIndex];
          this.errorInjector.sequenceIndex =
            (this.errorInjector.sequenceIndex + 1) %
            this.errorInjector.errorSequence.length;
          return error;
        }

        return null;
      },
    };
  }

  /**
   * Setup monitoring and tracking
   *
   * @private
   */
  #setupMonitoring() {
    // Override error handler to capture errors
    const originalHandleError = this.errorHandler.handleError.bind(
      this.errorHandler
    );
    this.errorHandler.handleError = async (error, context, errorType) => {
      const startTime = Date.now();

      // Capture error with debugging info
      this.capturedErrors.push({
        error,
        context,
        errorType,
        timestamp: Date.now(),
      });

      // Add debugging output for hanging investigation
      if (process.env.NODE_ENV === 'test' || process.env.DEBUG_E2E) {
        console.log(
          `[DEBUG] Error captured: ${error?.message}, type: ${errorType}, context: ${JSON.stringify(context)}`
        );
      }

      // Classify error
      const classificationStart = Date.now();
      const classification = this.errorClassifier.classifyError(error, context);
      this.#addBoundedMetric(
        'errorClassificationTimes',
        Date.now() - classificationStart
      );

      // Handle error
      const result = await originalHandleError(error, context, errorType);

      // Track recovery attempt
      this.recoveryAttempts.push({
        error: error ? error.message : 'Unknown error',
        errorType,
        recoveryAction: result.recoveryAction,
        shouldContinue: result.shouldContinue,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });

      // Add debugging output for recovery tracking
      if (process.env.NODE_ENV === 'test' || process.env.DEBUG_E2E) {
        console.log(
          `[DEBUG] Recovery attempt: ${result.recoveryAction}, continue: ${result.shouldContinue}, duration: ${Date.now() - startTime}ms`
        );
      }

      return result;
    };

    // Override recovery manager to track attempts
    const originalAttemptRecovery = this.recoveryManager.attemptRecovery.bind(
      this.recoveryManager
    );
    this.recoveryManager.attemptRecovery = async (errorInfo) => {
      const startTime = Date.now();
      const result = await originalAttemptRecovery(errorInfo);

      this.#addBoundedMetric('recoveryAttemptTimes', Date.now() - startTime);

      return result;
    };
  }

  /**
   * Create a resilient wrapper for a service
   *
   * @param serviceName
   * @param service
   */
  createResilientService(serviceName, service) {
    const wrapper = new ResilientServiceWrapper({
      service,
      errorHandler: this.errorHandler,
      logger: this.logger,
      serviceName,
    });

    this.resilientWrappers.set(serviceName, wrapper);
    return wrapper.createResilientProxy();
  }

  /**
   * Execute an action with error recovery
   *
   * @param action
   * @param context
   */
  async executeActionWithRecovery(action, context = {}) {
    // Reduced timeout for E2E tests - faster failure detection
    const timeout = context.timeout || 5000; // 5-second default timeout
    return this.#withTimeout(
      this.#executeActionWithRecoveryInternal(action, context),
      timeout
    );
  }

  /**
   * Internal implementation without timeout wrapper
   *
   * @param action
   * @param context
   * @private
   */
  async #executeActionWithRecoveryInternal(action, context = {}) {
    // Create a proper turnAction object for tracing
    const turnAction = {
      actionDefinitionId: action.id,
      parameters: context.parameters || {},
      targets: context.targets || [],
      commandString: context.commandString || `execute ${action.id}`,
    };

    // Create trace for the action
    const trace = this.traceFactory.createTrace({
      actionId: action.id,
      actorId: context.actorId || 'test-actor',
      turnAction,
    });

    // Start trace with proper dispatch
    trace.captureDispatchStart();

    // Wrap action execution in a retryable function
    const executeWithRetry = async (attemptNumber = 1) => {
      try {
        // Execute action (it will throw its own error if needed)
        const result = await action.execute(context);

        // Capture successful result (this ends the dispatch)
        trace.captureDispatchResult({ success: true, result });

        return {
          success: true,
          result,
          trace: trace.toJSON(),
        };
      } catch (error) {
        // Handle error with recovery
        const recoveryResult = await this.errorHandler.handleError(
          error,
          {
            actionId: action.id,
            componentName: action.id, // Use action ID as component name for circuit breaker
            ...context,
          },
          action.metadata?.errorType
        );

        // If recovery says to retry and we have a retry manager
        if (
          recoveryResult.recoveryAction === 'retry' &&
          this.retryManager &&
          attemptNumber < 3
        ) {
          // Wait with exponential backoff if configured
          if (this.config.retry?.exponentialBackoff) {
            const delay = Math.min(
              this.config.retry.delay * Math.pow(2, attemptNumber - 1),
              this.config.retry.maxDelay || 30000
            );

            // Use Jest-compatible timer implementation
            await this.#waitForDelay(delay);
          }

          // Retry the action
          return await executeWithRetry(attemptNumber + 1);
        }

        // Record error in trace (this ends the dispatch)
        trace.captureError(error, {
          actionId: action.id,
          actorId: context.actorId || 'test-actor',
        });

        return {
          success: false,
          error,
          recoveryResult,
          trace: trace.toJSON(),
        };
      }
    };

    return await executeWithRetry();
  }

  /**
   * Simulate an error storm
   *
   * @param errors
   * @param delayBetween
   */
  async simulateErrorStorm(errors, delayBetween = 0) {
    // Optimized timeout for E2E tests - much faster execution
    const stormTimeout = Math.max(10000, errors.length * 200); // Max 10 seconds, or 200ms per error

    return this.#withTimeout(
      this.#simulateErrorStormInternal(errors, delayBetween),
      stormTimeout
    );
  }

  /**
   * Internal error storm simulation without timeout wrapper
   *
   * @param errors
   * @param delayBetween
   * @private
   */
  async #simulateErrorStormInternal(errors, delayBetween) {
    const results = [];

    for (const error of errors) {
      const result = await this.#executeActionWithRecoveryInternal(
        {
          id: `storm-action-${error.index}`,
          execute: () => {
            // Simply throw the error
            throw error.error;
          },
          metadata: {
            errorType: error.errorType,
          },
        },
        { timeout: 2000 }
      ); // 2-second timeout per error action

      results.push(result);

      if (delayBetween > 0) {
        await this.#waitForDelay(delayBetween);
      }
    }

    return results;
  }

  /**
   * Check if circuit breaker is open for a component
   *
   * @param componentName
   */
  isCircuitBreakerOpen(componentName) {
    return this.recoveryManager.isCircuitOpen(componentName);
  }

  /**
   * Check if component is disabled
   *
   * @param componentName
   */
  isComponentDisabled(componentName) {
    return this.errorHandler.shouldDisableComponent(componentName);
  }

  /**
   * Get error metrics
   */
  getErrorMetrics() {
    return {
      metrics: this.errorMetrics.getMetrics(),
      capturedErrors: this.capturedErrors.length,
      recoveryAttempts: this.recoveryAttempts.length,
      averageClassificationTime: this.#calculateAverage(
        this.performanceMetrics.errorClassificationTimes
      ),
      averageRecoveryTime: this.#calculateAverage(
        this.performanceMetrics.recoveryAttemptTimes
      ),
    };
  }

  /**
   * Reset test bed state
   */
  reset() {
    this.capturedErrors = [];
    this.recoveryAttempts = [];
    this.circuitBreakerStates.clear();
    this.componentStates.clear();
    this.errorHistory = [];
    this.performanceMetrics = {
      errorClassificationTimes: [],
      recoveryAttemptTimes: [],
      retryDelays: [],
      maxEntries: 100,
    };
    this.errorInjector.nextError = null;
    this.errorInjector.errorSequence = [];
    this.errorInjector.sequenceIndex = 0;

    // Clear any pending timers if they exist
    this.#clearPendingTimers();
  }

  /**
   * Cleanup test bed
   */
  async cleanup() {
    this.reset();
    this.resilientWrappers.clear();
    this.initialized = false;
  }

  /**
   * Calculate average of an array of numbers
   *
   * @param numbers
   * @private
   */
  #calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Wait for circuit breaker to reset
   *
   * @param componentName
   * @param maxWait
   */
  async waitForCircuitBreakerReset(componentName, maxWait = 5000) {
    // Add timeout protection to prevent infinite waiting
    return this.#withTimeout(
      this.#waitForCircuitBreakerResetInternal(componentName, maxWait),
      maxWait + 1000
    );
  }

  /**
   * Internal circuit breaker reset waiting without timeout wrapper
   *
   * @param componentName
   * @param maxWait
   * @private
   */
  async #waitForCircuitBreakerResetInternal(componentName, maxWait) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (!this.isCircuitBreakerOpen(componentName)) {
        return true;
      }
      await this.#waitForDelay(100);
    }

    return false;
  }

  /**
   * Jest-compatible delay implementation optimized for E2E tests
   *
   * @param ms
   * @private
   */
  #waitForDelay(ms) {
    // For E2E tests, always prefer fake timers if Jest is available
    // This dramatically speeds up tests that use exponential backoff
    if (typeof jest !== 'undefined') {
      // Check if fake timers are active by examining setTimeout
      const isFakeTimer =
        jest.isMockFunction && jest.isMockFunction(setTimeout);

      if (isFakeTimer) {
        // Return a promise that resolves immediately when fake timers advance
        return Promise.resolve();
      }

      // Even with real timers, use minimal delays in test environment
      if (process.env.NODE_ENV === 'test') {
        return new Promise((resolve) => {
          const timer = setTimeout(resolve, Math.min(ms, 10)); // Max 10ms in tests
          if (typeof timer === 'object' && timer.unref) {
            timer.unref();
          }
        });
      }
    }

    // Fallback to real timers with original delay
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (typeof timer === 'object' && timer.unref) {
        timer.unref();
      }
    });
  }

  /**
   * Add metric with bounds to prevent memory leaks
   *
   * @param metricName
   * @param value
   * @private
   */
  #addBoundedMetric(metricName, value) {
    const metrics = this.performanceMetrics[metricName];
    if (metrics && Array.isArray(metrics)) {
      metrics.push(value);

      // Enforce bounds to prevent unbounded growth
      const maxEntries = this.performanceMetrics.maxEntries || 100;
      if (metrics.length > maxEntries) {
        metrics.splice(0, metrics.length - maxEntries);
      }
    }
  }

  /**
   * Clear any pending timers to prevent hangs
   *
   * @private
   */
  #clearPendingTimers() {
    // This is a placeholder for more sophisticated timer tracking if needed
    // For now, Jest fake timers should handle cleanup automatically
  }

  /**
   * Wrap a promise with a timeout to prevent hanging
   *
   * @param promise
   * @param timeoutMs
   * @private
   */
  #withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        if (process.env.NODE_ENV === 'test' || process.env.DEBUG_E2E) {
          console.log(
            `[DEBUG] Operation timed out after ${elapsed}ms (limit: ${timeoutMs}ms)`
          );
        }
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          if (process.env.DEBUG_E2E) {
            console.debug(`[DEBUG] Operation completed in ${elapsed}ms`);
          }
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          if (process.env.DEBUG_E2E) {
            console.log(
              `[DEBUG] Operation failed in ${elapsed}ms: ${error.message}`
            );
          }
          reject(error);
        });
    });
  }
}
