/**
 * @file Event dispatch tracing implementation
 * @description Provides tracing capabilities for event dispatch operations through the layered event system
 */

import { assertPresent } from '../../utils/dependencyUtils.js';

/**
 * Service responsible for creating and writing event dispatch traces
 */
export class EventDispatchTracer {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {import('../../actions/tracing/actionTraceOutputService.js').ActionTraceOutputService} */
  #outputService;

  /**
   * @param {object} dependencies - Required dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @param {import('../../actions/tracing/actionTraceOutputService.js').ActionTraceOutputService} dependencies.outputService - Output service for writing traces
   */
  constructor({ logger, outputService }) {
    assertPresent(logger, 'EventDispatchTracer: logger is required');
    assertPresent(
      outputService,
      'EventDispatchTracer: outputService is required'
    );

    this.#logger = logger;
    this.#outputService = outputService;
  }

  /**
   * Creates a new event dispatch trace instance
   *
   * @param {object} context - Trace context information
   * @param {string} context.eventName - Name of the event being dispatched
   * @param {object} context.payload - Event payload (should be sanitized)
   * @param {string} context.context - Contextual identifier for the dispatch
   * @param {number} context.timestamp - Timestamp when trace was created
   * @returns {EventDispatchTrace} New trace instance
   */
  createTrace(context) {
    return new EventDispatchTrace(context);
  }

  /**
   * Writes a trace to the output service asynchronously
   *
   * @param {EventDispatchTrace} trace - Trace instance to write
   * @returns {Promise<void>} Promise that resolves when write completes
   */
  async writeTrace(trace) {
    try {
      await this.#outputService.writeTrace(trace);
      this.#logger.debug('Event dispatch trace written successfully');
    } catch (error) {
      this.#logger.error('Failed to write event dispatch trace', error);
      throw error;
    }
  }
}

/**
 * Individual event dispatch trace instance
 * Captures timing and outcome information for a single event dispatch
 */
export class EventDispatchTrace {
  /** @type {string} */
  #eventName;
  /** @type {object} */
  #payload;
  /** @type {string} */
  #context;
  /** @type {number} */
  #timestamp;
  /** @type {object} */
  #traceData;

  /**
   * @param {object} context - Initial trace context
   * @param {string} context.eventName - Name of the event being dispatched
   * @param {object} context.payload - Event payload (should be sanitized)
   * @param {string} context.context - Contextual identifier for the dispatch
   * @param {number} context.timestamp - Timestamp when trace was created
   */
  constructor({ eventName, payload, context, timestamp }) {
    this.#eventName = eventName;
    this.#payload = payload;
    this.#context = context;
    this.#timestamp = timestamp;
    this.#traceData = {
      dispatchStart: null,
      dispatchEnd: null,
      duration: null,
      success: null,
      error: null,
    };
  }

  /**
   * Captures the start of event dispatch
   */
  captureDispatchStart() {
    this.#traceData.dispatchStart = performance.now();
  }

  /**
   * Captures successful dispatch completion
   *
   * @param {object} result - Dispatch result information
   * @param {boolean} result.success - Whether dispatch was successful
   * @param {number} result.duration - Duration of the dispatch in milliseconds
   */
  captureDispatchSuccess({ success, duration }) {
    this.#traceData.dispatchEnd = performance.now();
    this.#traceData.duration = duration;
    this.#traceData.success = success;
  }

  /**
   * Captures dispatch error
   *
   * @param {Error} error - Error that occurred during dispatch
   * @param {object} additional - Additional error context
   * @param {number} additional.duration - Duration before error occurred
   * @param {string} additional.context - Additional context information
   */
  captureDispatchError(error, { duration, context }) {
    this.#traceData.dispatchEnd = performance.now();
    this.#traceData.duration = duration;
    this.#traceData.success = false;
    this.#traceData.error = {
      message: error.message,
      type: error.constructor.name,
      context,
    };
  }

  /**
   * Serializes the trace for output
   *
   * @returns {object} Serialized trace data
   */
  toJSON() {
    return {
      metadata: {
        traceType: 'event_dispatch',
        eventName: this.#eventName,
        context: this.#context,
        timestamp: this.#timestamp,
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
      dispatch: {
        startTime: this.#traceData.dispatchStart,
        endTime: this.#traceData.dispatchEnd,
        duration: this.#traceData.duration,
        success: this.#traceData.success,
        error: this.#traceData.error,
      },
      payload: this.#payload,
    };
  }
}
