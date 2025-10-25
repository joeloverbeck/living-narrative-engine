/**
 * @file Consolidated service for event dispatching with various logging and error handling strategies.
 */

/**
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */
/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */
/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

import { createErrorDetails } from './errorDetails.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
import { ensureValidLogger } from './loggerUtils.js';
import { assertPresent } from './dependencyUtils.js';

/**
 * Error thrown when EventDispatchService receives an invalid dispatcher.
 */
export class InvalidDispatcherError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} [details] - Optional diagnostic details.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'InvalidDispatcherError';
    this.details = details;
  }
}

/**
 * Consolidated service for event dispatching with various logging and error handling strategies.
 */
export class EventDispatchService {
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {import('../actions/tracing/actionTraceFilter.js').ActionTraceFilter|null} */
  #actionTraceFilter;
  /** @type {import('../events/tracing/eventDispatchTracer.js').EventDispatchTracer|null} */
  #eventDispatchTracer;

  /**
   * Creates an instance of EventDispatchService.
   *
   * @param {object} dependencies - The required dependencies.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - The safe event dispatcher.
   * @param {ILogger} dependencies.logger - The logger instance.
   * @param {import('../actions/tracing/actionTraceFilter.js').ActionTraceFilter} [dependencies.actionTraceFilter] - Optional action trace filter for determining what to trace.
   * @param {import('../events/tracing/eventDispatchTracer.js').EventDispatchTracer} [dependencies.eventDispatchTracer] - Optional event dispatch tracer for recording traces.
   * @throws {Error} If required dependencies are missing.
   */
  constructor({
    safeEventDispatcher,
    logger,
    actionTraceFilter = null,
    eventDispatchTracer = null,
  }) {
    assertPresent(
      safeEventDispatcher,
      'EventDispatchService: safeEventDispatcher is required'
    );
    assertPresent(logger, 'EventDispatchService: logger is required');

    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger = logger;
    this.#actionTraceFilter = actionTraceFilter;
    this.#eventDispatchTracer = eventDispatchTracer;
  }

  /**
   * Dispatches an event and logs the outcome.
   *
   * @description
   * Calls `.dispatch()` on the provided dispatcher and logs a debug message on
   * success or an error message on failure. The promise resolves either way and
   * errors are not re-thrown.
   * @param {string} eventName - Event name to dispatch.
   * @param {object} payload - Event payload.
   * @param {string} [identifierForLog] - Optional identifier appended to log messages.
   * @param {object} [options] - Options forwarded to the dispatch call.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async dispatchWithLogging(
    eventName,
    payload,
    identifierForLog = '',
    options = {}
  ) {
    const context = identifierForLog ? ` for ${identifierForLog}` : '';

    return this.#safeEventDispatcher
      .dispatch(eventName, payload, options)
      .then(() => {
        this.#logger.debug(`Dispatched '${eventName}'${context}.`);
      })
      .catch((e) => {
        this.#logger.error(
          `Failed dispatching '${eventName}' event${context}.`,
          e
        );
      });
  }

  /**
   * Dispatches an event using the provided dispatcher and logs the outcome.
   *
   * @description
   * Mimics the error handling behavior originally embedded in CommandProcessor.
   * On success, a debug message is logged. When the dispatcher returns `false`, a
   * warning is logged. On exception, a system error event is dispatched and the
   * function returns `false`. Optionally creates traces if tracing is enabled.
   * @param {string} eventName - Name of the event to dispatch.
   * @param {object} payload - Payload for the event.
   * @param {string} context - Contextual identifier used in log messages.
   * @returns {Promise<boolean>} `true` if the dispatcher reported success, `false` otherwise.
   */
  async dispatchWithErrorHandling(eventName, payload, context) {
    const shouldTrace = this.#shouldTrace(eventName, payload);
    let eventTrace = null;

    // Create trace if enabled
    if (shouldTrace && this.#eventDispatchTracer) {
      try {
        eventTrace = this.#eventDispatchTracer.createTrace({
          eventName,
          payload: this.#sanitizePayload(payload),
          context,
          timestamp: Date.now(),
        });
        eventTrace.captureDispatchStart();
      } catch (traceError) {
        this.#logger.warn('Failed to create event dispatch trace', traceError);
      }
    }

    const startTime = performance.now();

    this.#logger.debug(
      `dispatchWithErrorHandling: Attempting dispatch: ${context} ('${eventName}')`
    );

    try {
      const success = await this.#safeEventDispatcher.dispatch(
        eventName,
        payload
      );
      const duration = performance.now() - startTime;

      if (eventTrace) {
        eventTrace.captureDispatchSuccess({ success, duration });
        this.#writeTraceAsync(eventTrace);
      }

      if (success) {
        this.#logger.debug(
          `dispatchWithErrorHandling: Dispatch successful for ${context}.`
        );
      } else {
        this.#logger.warn(
          `dispatchWithErrorHandling: SafeEventDispatcher reported failure for ${context}`
        );
      }
      return success;
    } catch (error) {
      const duration = performance.now() - startTime;

      if (eventTrace) {
        eventTrace.captureDispatchError(error, { duration, context });
        this.#writeTraceAsync(eventTrace);
      }

      this.#logger.error(
        `dispatchWithErrorHandling: CRITICAL - Error during dispatch for ${context}`,
        error
      );
      this.dispatchSystemError(
        'System error during event dispatch.',
        createErrorDetails(
          `Exception in dispatch for ${eventName}`,
          error?.stack || new Error().stack
        )
      );
      return false;
    }
  }

  /**
   * Safely dispatches an event using the provided dispatcher.
   *
   * @param {string} eventId - Identifier of the event to dispatch.
   * @param {object} payload - Payload for the event.
   * @param {object} [options] - Optional dispatcher configuration (e.g. schema overrides).
   * @returns {Promise<void>} Resolves when the dispatch attempt completes.
   */
  async safeDispatchEvent(eventId, payload, options) {
    if (
      !this.#safeEventDispatcher ||
      typeof this.#safeEventDispatcher.dispatch !== 'function'
    ) {
      this.#logger.warn(`SafeEventDispatcher unavailable for ${eventId}`);
      return;
    }

    try {
      if (typeof options === 'undefined') {
        await this.#safeEventDispatcher.dispatch(eventId, payload);
      } else {
        await this.#safeEventDispatcher.dispatch(eventId, payload, options);
      }
      const metadata =
        typeof options === 'undefined' ? { payload } : { payload, options };
      this.#logger.debug(`Dispatched ${eventId}`, metadata);
    } catch (error) {
      this.#logger.error(`Failed to dispatch ${eventId}`, error);
    }
  }

  /**
   * Dispatches a system error event with consistent payload structure.
   * Supports both synchronous and asynchronous dispatching.
   *
   * @param {string} message - Human readable error message.
   * @param {object} [details] - Additional structured details for debugging.
   * @param {object} [options] - Options for dispatching.
   * @param {boolean} [options.async] - Whether to dispatch asynchronously.
   * @param {boolean} [options.throwOnInvalidDispatcher] - Whether to throw if dispatcher is invalid.
   * @returns {void|Promise<void>} Returns void for sync, Promise<void> for async.
   * @throws {InvalidDispatcherError} If the dispatcher is missing or invalid and throwOnInvalidDispatcher is true.
   */
  dispatchSystemError(message, details = {}, options = {}) {
    const { async = false, throwOnInvalidDispatcher = false } = options;

    const hasDispatch =
      this.#safeEventDispatcher &&
      typeof this.#safeEventDispatcher.dispatch === 'function';
    if (!hasDispatch) {
      const errorMsg =
        "Invalid or missing method 'dispatch' on dependency 'EventDispatchService: safeEventDispatcher'.";
      this.#logger.error(errorMsg);
      if (throwOnInvalidDispatcher) {
        throw new InvalidDispatcherError(errorMsg, {
          functionName: 'dispatchSystemError',
        });
      }
      return;
    }

    const payload = { message, details };

    if (async) {
      try {
        const result = this.#safeEventDispatcher.dispatch(
          SYSTEM_ERROR_OCCURRED_ID,
          payload
        );
        // Handle both Promise and non-Promise returns defensively
        if (result && typeof result.catch === 'function') {
          return result.catch((error) => {
            // If we can't dispatch the error event, at least log it
            this.#logger.error(
              `Failed to dispatch system error event: ${message}`,
              {
                originalDetails: details,
                dispatchError: error,
              }
            );
          });
        }
        // If not a Promise, wrap in resolved Promise for consistency
        return Promise.resolve();
      } catch (error) {
        // Handle synchronous errors
        this.#logger.error(
          `Failed to dispatch system error event: ${message}`,
          {
            originalDetails: details,
            dispatchError: error,
          }
        );
        return Promise.resolve();
      }
    } else {
      try {
        this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, payload);
      } catch (error) {
        this.#logger.error(
          `Failed to dispatch system error event: ${message}`,
          {
            originalDetails: details,
            dispatchError: error,
          }
        );
      }
    }
  }

  /**
   * Dispatches a validation error and returns a standardized result object.
   *
   * @param {string} message - Human readable error message.
   * @param {object} [details] - Additional structured details for debugging.
   * @returns {{ ok: false, error: string, details?: object }} Result object for validation failures.
   */
  dispatchValidationError(message, details) {
    this.dispatchSystemError(message, details, {
      throwOnInvalidDispatcher: true,
    });
    return details !== undefined
      ? { ok: false, error: message, details }
      : { ok: false, error: message };
  }

  /**
   * Determines whether an event should be traced based on filtering rules
   *
   * @param {string} eventName - Name of the event
   * @param {object} payload - Event payload
   * @returns {boolean} True if the event should be traced
   * @private
   */
  #shouldTrace(eventName, payload) {
    if (!this.#actionTraceFilter || !this.#eventDispatchTracer) {
      return false;
    }

    if (!this.#actionTraceFilter.isEnabled()) {
      return false;
    }

    // For action events, check action ID
    if (eventName === 'ATTEMPT_ACTION_ID' && payload?.action?.definitionId) {
      return this.#actionTraceFilter.shouldTrace(payload.action.definitionId);
    }

    // For other events, check event name
    return this.#actionTraceFilter.shouldTrace(eventName);
  }

  /**
   * Sanitizes payload to remove sensitive information for tracing
   *
   * @param {object} payload - Original payload
   * @returns {object} Sanitized payload safe for tracing
   * @private
   */
  #sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };
    const sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'credential',
    ];

    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Writes a trace asynchronously without blocking execution
   *
   * @param {import('../events/tracing/eventDispatchTracer.js').EventDispatchTrace} eventTrace - Trace to write
   * @private
   */
  #writeTraceAsync(eventTrace) {
    if (!this.#eventDispatchTracer) return;

    this.#eventDispatchTracer.writeTrace(eventTrace).catch((error) => {
      this.#logger.warn('Failed to write event dispatch trace', error);
    });
  }
}
