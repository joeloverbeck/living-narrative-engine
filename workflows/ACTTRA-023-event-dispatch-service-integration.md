# ACTTRA-023: Integrate with EventDispatchService

## Summary

Enhance the EventDispatchService to provide deeper integration with the action execution tracing system, capturing detailed event dispatch information, performance metrics, error handling, and success/failure analytics. This integration will extend tracing visibility into the core event dispatching mechanism, providing comprehensive insights into event processing, handler execution, and system-wide event flow patterns.

## Status

- **Type**: Enhancement
- **Priority**: Medium
- **Complexity**: Medium
- **Estimated Time**: 2 hours
- **Dependencies**: ACTTRA-019 (ActionExecutionTrace), ACTTRA-020 (CommandProcessor integration), ACTTRA-021 (Timing)

## Objectives

### Primary Goals

1. **Event Dispatch Tracing** - Capture detailed information about event dispatching process
2. **Handler Execution Tracking** - Monitor individual event handler performance and results
3. **Event Flow Analysis** - Provide insights into event propagation and processing chains
4. **Error Context Enhancement** - Capture event-specific error information for better debugging
5. **Performance Metrics** - Measure event dispatch performance and identify bottlenecks
6. **Backward Compatibility** - Maintain existing EventDispatchService functionality

### Success Criteria

- [ ] EventDispatchService captures event dispatch timing and success/failure rates
- [ ] Individual event handler execution is tracked with performance metrics
- [ ] Event payload information is captured with appropriate sanitization
- [ ] Error information includes event context and handler details
- [ ] Tracing integration is optional and doesn't impact performance when disabled
- [ ] Event dispatch patterns can be analyzed for optimization opportunities
- [ ] Integration maintains backward compatibility with existing event handlers

## Technical Specification

### 1. EventDispatchService Tracing Enhancement

#### File: `src/events/eventDispatchService.js` (Enhanced)

```javascript
/**
 * @file Enhanced EventDispatchService with action execution tracing
 * Provides detailed tracing for event dispatching and handler execution
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Enhanced EventDispatchService with comprehensive tracing capabilities
 */
export class EventDispatchService {
  #eventBus;
  #logger;
  #actionTraceFilter;
  #eventDispatchTracer;
  #performanceMonitor;

  constructor({
    eventBus,
    logger,
    actionTraceFilter = null,
    eventDispatchTracer = null,
    performanceMonitor = null,
  }) {
    validateDependency(eventBus, 'IEventBus');
    validateDependency(logger, 'ILogger');

    this.#eventBus = eventBus;
    this.#logger = logger;

    // Optional tracing dependencies
    this.#actionTraceFilter = actionTraceFilter;
    this.#eventDispatchTracer = eventDispatchTracer;
    this.#performanceMonitor = performanceMonitor;

    if (actionTraceFilter) {
      validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
        requiredMethods: ['isEnabled', 'shouldTrace'],
      });
    }

    if (eventDispatchTracer) {
      validateDependency(eventDispatchTracer, 'IEventDispatchTracer', null, {
        requiredMethods: ['traceEventDispatch', 'traceHandlerExecution'],
      });
    }

    if (performanceMonitor) {
      validateDependency(performanceMonitor, 'IPerformanceMonitor', null, {
        requiredMethods: ['startTiming', 'endTiming', 'recordMetric'],
      });
    }
  }

  /**
   * Dispatch event with error handling and optional tracing
   * @param {string} eventType - Type of event to dispatch
   * @param {Object} payload - Event payload
   * @param {string} context - Context description for logging
   * @returns {Promise<boolean>} True if dispatch succeeded
   */
  async dispatchWithErrorHandling(eventType, payload, context) {
    const traceContext = this.#createTraceContext(eventType, payload, context);
    let eventTrace = null;

    // Create event dispatch trace if enabled
    if (this.#shouldTrace(eventType, payload)) {
      try {
        eventTrace = await this.#createEventTrace(traceContext);
      } catch (traceError) {
        this.#logger.warn('Failed to create event dispatch trace', {
          error: traceError.message,
          eventType,
          context,
        });
      }
    }

    // Start performance monitoring
    let performanceTimer = null;
    if (this.#performanceMonitor) {
      performanceTimer = this.#performanceMonitor.startTiming(
        'event_dispatch',
        {
          eventType,
          context,
        }
      );
    }

    try {
      this.#logger.debug(`EventDispatchService: Dispatching ${eventType}`, {
        context,
        payloadKeys: Object.keys(payload || {}),
      });

      // Trace dispatch start
      if (eventTrace) {
        eventTrace.captureDispatchStart(traceContext);
      }

      // Dispatch the event
      const dispatchResult = await this.#dispatchEventWithTracing(
        eventType,
        payload,
        eventTrace
      );

      // Trace dispatch completion
      if (eventTrace) {
        eventTrace.captureDispatchSuccess({
          handlerCount: dispatchResult.handlerCount,
          totalDuration: dispatchResult.totalDuration,
          handlerResults: dispatchResult.handlerResults,
        });
      }

      // Record performance metrics
      if (performanceTimer) {
        this.#performanceMonitor.endTiming(performanceTimer, {
          success: true,
          handlerCount: dispatchResult.handlerCount,
        });
      }

      this.#logger.debug(
        `EventDispatchService: Successfully dispatched ${eventType}`,
        {
          handlerCount: dispatchResult.handlerCount,
          duration: dispatchResult.totalDuration,
        }
      );

      // Write trace asynchronously
      if (eventTrace) {
        this.#writeEventTrace(eventTrace, eventType);
      }

      return true;
    } catch (error) {
      // Trace dispatch error
      if (eventTrace) {
        eventTrace.captureDispatchError(error, {
          eventType,
          context,
          payload: this.#sanitizePayload(payload),
        });
      }

      // Record error metrics
      if (performanceTimer) {
        this.#performanceMonitor.endTiming(performanceTimer, {
          success: false,
          error: error.constructor.name,
        });
      }

      this.#logger.error(
        `EventDispatchService: Error dispatching ${eventType}:`,
        error
      );

      // Write error trace asynchronously
      if (eventTrace) {
        this.#writeEventTrace(eventTrace, eventType);
      }

      return false;
    }
  }

  /**
   * Dispatch event with detailed handler tracing
   * @private
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @param {EventDispatchTrace} eventTrace - Optional event trace
   * @returns {Promise<Object>} Dispatch result with handler details
   */
  async #dispatchEventWithTracing(eventType, payload, eventTrace) {
    const startTime = performance.now();
    const handlerResults = [];
    let handlerCount = 0;

    // Get handlers for the event type
    const handlers = this.#eventBus.getHandlers(eventType);

    if (!handlers || handlers.length === 0) {
      this.#logger.debug(`No handlers registered for event type: ${eventType}`);
      return {
        handlerCount: 0,
        totalDuration: performance.now() - startTime,
        handlerResults: [],
      };
    }

    // Execute each handler with individual tracing
    for (const handler of handlers) {
      handlerCount++;
      const handlerResult = await this.#executeHandlerWithTracing(
        handler,
        eventType,
        payload,
        eventTrace,
        handlerCount
      );

      handlerResults.push(handlerResult);
    }

    const totalDuration = performance.now() - startTime;

    return {
      handlerCount,
      totalDuration,
      handlerResults,
    };
  }

  /**
   * Execute individual handler with tracing
   * @private
   * @param {Function} handler - Event handler function
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @param {EventDispatchTrace} eventTrace - Optional event trace
   * @param {number} handlerIndex - Handler index for identification
   * @returns {Promise<Object>} Handler execution result
   */
  async #executeHandlerWithTracing(
    handler,
    eventType,
    payload,
    eventTrace,
    handlerIndex
  ) {
    const handlerName = handler.name || `handler_${handlerIndex}`;
    const startTime = performance.now();

    // Trace handler start
    if (eventTrace) {
      eventTrace.captureHandlerStart(handlerName, handlerIndex, {
        eventType,
        handlerName,
      });
    }

    try {
      // Execute handler
      const result = await this.#executeHandler(handler, eventType, payload);
      const duration = performance.now() - startTime;

      // Trace handler success
      if (eventTrace) {
        eventTrace.captureHandlerSuccess(handlerName, {
          duration,
          result: this.#sanitizeHandlerResult(result),
        });
      }

      return {
        handlerName,
        index: handlerIndex,
        success: true,
        duration,
        result: result,
        error: null,
      };
    } catch (handlerError) {
      const duration = performance.now() - startTime;

      // Trace handler error
      if (eventTrace) {
        eventTrace.captureHandlerError(handlerName, handlerError, {
          duration,
          eventType,
          handlerIndex,
        });
      }

      this.#logger.warn(
        `Handler ${handlerName} failed for event ${eventType}:`,
        handlerError
      );

      return {
        handlerName,
        index: handlerIndex,
        success: false,
        duration,
        result: null,
        error: {
          message: handlerError.message,
          type: handlerError.constructor.name,
          stack: handlerError.stack,
        },
      };
    }
  }

  /**
   * Execute handler with proper error boundary
   * @private
   * @param {Function} handler - Handler function
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<*>} Handler result
   */
  async #executeHandler(handler, eventType, payload) {
    // Create event object for handler
    const event = {
      type: eventType,
      payload: payload || {},
      timestamp: Date.now(),
    };

    // Call handler (may be sync or async)
    const result = handler(event);

    // Handle promise results
    if (result && typeof result.then === 'function') {
      return await result;
    }

    return result;
  }

  /**
   * Check if event should be traced
   * @private
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @returns {boolean} True if should trace
   */
  #shouldTrace(eventType, payload) {
    // No tracing infrastructure
    if (!this.#actionTraceFilter || !this.#eventDispatchTracer) {
      return false;
    }

    // Check if tracing is globally enabled
    if (!this.#actionTraceFilter.isEnabled()) {
      return false;
    }

    // For action events, check if the action should be traced
    if (eventType === 'ATTEMPT_ACTION_ID' && payload?.action?.definitionId) {
      return this.#actionTraceFilter.shouldTrace(payload.action.definitionId);
    }

    // For other events, check if event type should be traced
    return this.#actionTraceFilter.shouldTrace(eventType);
  }

  /**
   * Create trace context
   * @private
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @param {string} context - Context description
   * @returns {Object} Trace context
   */
  #createTraceContext(eventType, payload, context) {
    return {
      eventType,
      payload: this.#sanitizePayload(payload),
      context,
      timestamp: Date.now(),
      requestId: this.#generateRequestId(),
    };
  }

  /**
   * Create event dispatch trace
   * @private
   * @param {Object} traceContext - Trace context
   * @returns {Promise<EventDispatchTrace>} Event trace instance
   */
  async #createEventTrace(traceContext) {
    if (!this.#eventDispatchTracer) {
      return null;
    }

    return this.#eventDispatchTracer.createTrace(traceContext);
  }

  /**
   * Write event trace asynchronously
   * @private
   * @param {EventDispatchTrace} eventTrace - Event trace to write
   * @param {string} eventType - Event type for logging
   */
  #writeEventTrace(eventTrace, eventType) {
    if (!this.#eventDispatchTracer) {
      return;
    }

    // Fire and forget - don't wait for trace writing
    this.#eventDispatchTracer.writeTrace(eventTrace).catch((writeError) => {
      this.#logger.warn('Failed to write event dispatch trace', {
        error: writeError.message,
        eventType,
        traceId: eventTrace.getId?.() || 'unknown',
      });
    });
  }

  /**
   * Sanitize payload for tracing
   * @private
   * @param {Object} payload - Payload to sanitize
   * @returns {Object} Sanitized payload
   */
  #sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };

    // Remove sensitive fields
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

    // Limit size of large objects
    const maxSize = 10000; // 10KB
    const jsonString = JSON.stringify(sanitized);
    if (jsonString.length > maxSize) {
      sanitized._truncated = true;
      sanitized._originalSize = jsonString.length;
      sanitized._note = 'Payload truncated due to size';
    }

    return sanitized;
  }

  /**
   * Sanitize handler result for tracing
   * @private
   * @param {*} result - Handler result to sanitize
   * @returns {*} Sanitized result
   */
  #sanitizeHandlerResult(result) {
    // Keep result simple for tracing - just record type and basic info
    if (result === null || result === undefined) {
      return result;
    }

    if (typeof result === 'object') {
      return {
        type: result.constructor.name,
        keys: Object.keys(result).slice(0, 10), // Limit to first 10 keys
        hasData: Object.keys(result).length > 0,
      };
    }

    return {
      type: typeof result,
      value: String(result).slice(0, 100), // Limit string length
    };
  }

  /**
   * Generate unique request ID for tracing
   * @private
   * @returns {string} Unique request ID
   */
  #generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 2. EventDispatchTracer Implementation

#### File: `src/events/tracing/eventDispatchTracer.js`

```javascript
/**
 * @file Event dispatch tracing implementation
 * Provides detailed tracing for event dispatching and handler execution
 */

import { validateDependency } from '../../utils/validationUtils.js';

/**
 * Event dispatch tracer for capturing detailed event processing information
 */
export class EventDispatchTracer {
  #logger;
  #outputService;
  #performanceAnalyzer;

  constructor({ logger, outputService, performanceAnalyzer = null }) {
    validateDependency(logger, 'ILogger');
    validateDependency(outputService, 'ITraceOutputService');

    this.#logger = logger;
    this.#outputService = outputService;
    this.#performanceAnalyzer = performanceAnalyzer;
  }

  /**
   * Create new event dispatch trace
   * @param {Object} traceContext - Trace context information
   * @returns {EventDispatchTrace} New trace instance
   */
  createTrace(traceContext) {
    return new EventDispatchTrace({
      eventType: traceContext.eventType,
      payload: traceContext.payload,
      context: traceContext.context,
      requestId: traceContext.requestId,
      timestamp: traceContext.timestamp,
    });
  }

  /**
   * Write trace to output service
   * @param {EventDispatchTrace} trace - Trace to write
   * @returns {Promise<void>}
   */
  async writeTrace(trace) {
    try {
      // Add to performance analysis if available
      if (this.#performanceAnalyzer) {
        this.#performanceAnalyzer.addEventTrace(trace);
      }

      // Write trace to output service
      await this.#outputService.writeTrace(trace);
    } catch (error) {
      this.#logger.error('Failed to write event dispatch trace', error);
      throw error;
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    if (!this.#performanceAnalyzer) {
      return null;
    }

    return this.#performanceAnalyzer.getStats();
  }
}

/**
 * Event dispatch trace data structure
 */
export class EventDispatchTrace {
  #eventType;
  #payload;
  #context;
  #requestId;
  #startTimestamp;
  #traceData;
  #handlers;

  constructor({ eventType, payload, context, requestId, timestamp }) {
    this.#eventType = eventType;
    this.#payload = payload;
    this.#context = context;
    this.#requestId = requestId;
    this.#startTimestamp = timestamp;

    this.#traceData = {
      dispatchStart: null,
      dispatchEnd: null,
      dispatchDuration: null,
      dispatchSuccess: null,
      dispatchError: null,
      totalHandlers: 0,
      successfulHandlers: 0,
      failedHandlers: 0,
    };

    this.#handlers = new Map();
  }

  /**
   * Get trace ID
   * @returns {string} Trace ID
   */
  getId() {
    return this.#requestId;
  }

  /**
   * Capture dispatch start
   * @param {Object} context - Dispatch context
   */
  captureDispatchStart(context = {}) {
    this.#traceData.dispatchStart = performance.now();
    this.#traceData.startContext = context;
  }

  /**
   * Capture successful dispatch completion
   * @param {Object} result - Dispatch result
   */
  captureDispatchSuccess(result) {
    this.#traceData.dispatchEnd = performance.now();
    this.#traceData.dispatchDuration =
      this.#traceData.dispatchEnd - this.#traceData.dispatchStart;
    this.#traceData.dispatchSuccess = true;
    this.#traceData.totalHandlers = result.handlerCount;

    // Process handler results
    if (result.handlerResults) {
      this.#traceData.successfulHandlers = result.handlerResults.filter(
        (h) => h.success
      ).length;
      this.#traceData.failedHandlers = result.handlerResults.filter(
        (h) => !h.success
      ).length;
    }
  }

  /**
   * Capture dispatch error
   * @param {Error} error - Dispatch error
   * @param {Object} context - Error context
   */
  captureDispatchError(error, context = {}) {
    this.#traceData.dispatchEnd = performance.now();
    this.#traceData.dispatchDuration =
      this.#traceData.dispatchEnd - this.#traceData.dispatchStart;
    this.#traceData.dispatchSuccess = false;
    this.#traceData.dispatchError = {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack,
      context,
    };
  }

  /**
   * Capture handler start
   * @param {string} handlerName - Handler name
   * @param {number} handlerIndex - Handler index
   * @param {Object} context - Handler context
   */
  captureHandlerStart(handlerName, handlerIndex, context = {}) {
    if (!this.#handlers.has(handlerName)) {
      this.#handlers.set(handlerName, {
        name: handlerName,
        index: handlerIndex,
        startTime: performance.now(),
        endTime: null,
        duration: null,
        success: null,
        result: null,
        error: null,
        context,
      });
    }
  }

  /**
   * Capture handler success
   * @param {string} handlerName - Handler name
   * @param {Object} result - Handler result
   */
  captureHandlerSuccess(handlerName, result) {
    const handler = this.#handlers.get(handlerName);
    if (handler) {
      handler.endTime = performance.now();
      handler.duration = handler.endTime - handler.startTime;
      handler.success = true;
      handler.result = result.result || null;
    }
  }

  /**
   * Capture handler error
   * @param {string} handlerName - Handler name
   * @param {Error} error - Handler error
   * @param {Object} context - Error context
   */
  captureHandlerError(handlerName, error, context = {}) {
    const handler = this.#handlers.get(handlerName);
    if (handler) {
      handler.endTime = performance.now();
      handler.duration = handler.endTime - handler.startTime;
      handler.success = false;
      handler.error = {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
        context,
      };
    }
  }

  /**
   * Get handler execution data
   * @returns {Array} Handler execution data
   */
  getHandlerData() {
    return Array.from(this.#handlers.values());
  }

  /**
   * Convert trace to JSON for serialization
   * @returns {Object} Serializable trace data
   */
  toJSON() {
    return {
      metadata: {
        traceId: this.#requestId,
        traceType: 'event_dispatch',
        eventType: this.#eventType,
        context: this.#context,
        startTimestamp: this.#startTimestamp,
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
      dispatch: {
        startTime: this.#traceData.dispatchStart,
        endTime: this.#traceData.dispatchEnd,
        duration: this.#traceData.dispatchDuration,
        success: this.#traceData.dispatchSuccess,
        error: this.#traceData.dispatchError,
        totalHandlers: this.#traceData.totalHandlers,
        successfulHandlers: this.#traceData.successfulHandlers,
        failedHandlers: this.#traceData.failedHandlers,
      },
      payload: this.#payload,
      handlers: this.getHandlerData().map((handler) => ({
        name: handler.name,
        index: handler.index,
        startTime: handler.startTime,
        endTime: handler.endTime,
        duration: handler.duration,
        success: handler.success,
        result: handler.result,
        error: handler.error,
        context: handler.context,
      })),
    };
  }

  /**
   * Create human-readable summary
   * @returns {string} Human-readable trace summary
   */
  toSummary() {
    const status = this.#traceData.dispatchSuccess ? 'SUCCESS' : 'FAILED';
    const duration = this.#traceData.dispatchDuration
      ? `${this.#traceData.dispatchDuration.toFixed(2)}ms`
      : 'incomplete';
    const handlers = `${this.#traceData.successfulHandlers}/${this.#traceData.totalHandlers} handlers`;

    return `Event: ${this.#eventType} | Status: ${status} | Duration: ${duration} | Handlers: ${handlers}`;
  }

  /**
   * Check if trace is complete
   * @returns {boolean} True if trace is complete
   */
  isComplete() {
    return this.#traceData.dispatchEnd !== null;
  }

  /**
   * Check if dispatch was successful
   * @returns {boolean} True if successful
   */
  isSuccess() {
    return this.#traceData.dispatchSuccess === true;
  }

  /**
   * Get dispatch duration
   * @returns {number|null} Duration in milliseconds or null if incomplete
   */
  getDuration() {
    return this.#traceData.dispatchDuration;
  }
}
```

### 3. Performance Analysis for Event Dispatching

#### File: `src/events/tracing/eventPerformanceAnalyzer.js`

```javascript
/**
 * @file Performance analysis for event dispatching
 * Analyzes event dispatch patterns and performance metrics
 */

/**
 * Event performance analyzer for statistical analysis
 */
export class EventPerformanceAnalyzer {
  #eventStats;
  #handlerStats;
  #recentTraces;
  #maxRecentTraces;

  constructor({ maxRecentTraces = 1000 } = {}) {
    this.#eventStats = new Map();
    this.#handlerStats = new Map();
    this.#recentTraces = [];
    this.#maxRecentTraces = maxRecentTraces;
  }

  /**
   * Add event trace for analysis
   * @param {EventDispatchTrace} trace - Event trace to analyze
   */
  addEventTrace(trace) {
    if (!trace.isComplete()) {
      return; // Skip incomplete traces
    }

    // Add to recent traces
    this.#recentTraces.push({
      eventType: trace.toJSON().metadata.eventType,
      duration: trace.getDuration(),
      success: trace.isSuccess(),
      handlerCount: trace.getHandlerData().length,
      timestamp: Date.now(),
    });

    // Maintain size limit
    if (this.#recentTraces.length > this.#maxRecentTraces) {
      this.#recentTraces.shift();
    }

    // Update event statistics
    this.#updateEventStats(trace);

    // Update handler statistics
    this.#updateHandlerStats(trace);
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getStats() {
    return {
      events: this.#getEventStats(),
      handlers: this.#getHandlerStats(),
      overall: this.#getOverallStats(),
    };
  }

  /**
   * Get slow events above threshold
   * @param {number} threshold - Threshold in milliseconds
   * @returns {Array} Slow events
   */
  getSlowEvents(threshold = 100) {
    return this.#recentTraces
      .filter((trace) => trace.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get error patterns
   * @returns {Array} Error patterns
   */
  getErrorPatterns() {
    const failedEvents = this.#recentTraces.filter((trace) => !trace.success);
    const eventCounts = {};

    failedEvents.forEach((trace) => {
      eventCounts[trace.eventType] = (eventCounts[trace.eventType] || 0) + 1;
    });

    return Object.entries(eventCounts)
      .map(([eventType, count]) => ({ eventType, failureCount: count }))
      .sort((a, b) => b.failureCount - a.failureCount);
  }

  /**
   * Update event statistics
   * @private
   * @param {EventDispatchTrace} trace - Event trace
   */
  #updateEventStats(trace) {
    const traceData = trace.toJSON();
    const eventType = traceData.metadata.eventType;

    if (!this.#eventStats.has(eventType)) {
      this.#eventStats.set(eventType, {
        totalDispatches: 0,
        successfulDispatches: 0,
        failedDispatches: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        totalHandlers: 0,
        lastSeen: null,
      });
    }

    const stats = this.#eventStats.get(eventType);
    stats.totalDispatches++;
    stats.lastSeen = Date.now();

    if (trace.isSuccess()) {
      stats.successfulDispatches++;
    } else {
      stats.failedDispatches++;
    }

    const duration = trace.getDuration();
    if (duration !== null) {
      stats.totalDuration += duration;
      stats.minDuration = Math.min(stats.minDuration, duration);
      stats.maxDuration = Math.max(stats.maxDuration, duration);
    }

    stats.totalHandlers += traceData.dispatch.totalHandlers || 0;
  }

  /**
   * Update handler statistics
   * @private
   * @param {EventDispatchTrace} trace - Event trace
   */
  #updateHandlerStats(trace) {
    const handlerData = trace.getHandlerData();

    handlerData.forEach((handler) => {
      const handlerName = handler.name;

      if (!this.#handlerStats.has(handlerName)) {
        this.#handlerStats.set(handlerName, {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          lastSeen: null,
        });
      }

      const stats = this.#handlerStats.get(handlerName);
      stats.totalExecutions++;
      stats.lastSeen = Date.now();

      if (handler.success) {
        stats.successfulExecutions++;
      } else {
        stats.failedExecutions++;
      }

      if (handler.duration !== null) {
        stats.totalDuration += handler.duration;
        stats.minDuration = Math.min(stats.minDuration, handler.duration);
        stats.maxDuration = Math.max(stats.maxDuration, handler.duration);
      }
    });
  }

  /**
   * Get event statistics
   * @private
   * @returns {Object} Event statistics
   */
  #getEventStats() {
    const stats = {};

    this.#eventStats.forEach((eventStats, eventType) => {
      stats[eventType] = {
        ...eventStats,
        averageDuration: eventStats.totalDuration / eventStats.totalDispatches,
        successRate:
          (eventStats.successfulDispatches / eventStats.totalDispatches) * 100,
        averageHandlers: eventStats.totalHandlers / eventStats.totalDispatches,
      };
    });

    return stats;
  }

  /**
   * Get handler statistics
   * @private
   * @returns {Object} Handler statistics
   */
  #getHandlerStats() {
    const stats = {};

    this.#handlerStats.forEach((handlerStats, handlerName) => {
      stats[handlerName] = {
        ...handlerStats,
        averageDuration:
          handlerStats.totalDuration / handlerStats.totalExecutions,
        successRate:
          (handlerStats.successfulExecutions / handlerStats.totalExecutions) *
          100,
      };
    });

    return stats;
  }

  /**
   * Get overall statistics
   * @private
   * @returns {Object} Overall statistics
   */
  #getOverallStats() {
    if (this.#recentTraces.length === 0) {
      return {
        totalEvents: 0,
        successRate: 0,
        averageDuration: 0,
        totalHandlers: 0,
      };
    }

    const successful = this.#recentTraces.filter((t) => t.success).length;
    const totalDuration = this.#recentTraces.reduce(
      (sum, t) => sum + t.duration,
      0
    );
    const totalHandlers = this.#recentTraces.reduce(
      (sum, t) => sum + t.handlerCount,
      0
    );

    return {
      totalEvents: this.#recentTraces.length,
      successRate: (successful / this.#recentTraces.length) * 100,
      averageDuration: totalDuration / this.#recentTraces.length,
      totalHandlers,
    };
  }

  /**
   * Clear all analysis data
   */
  clear() {
    this.#eventStats.clear();
    this.#handlerStats.clear();
    this.#recentTraces = [];
  }
}
```

## Implementation Tasks

### Phase 1: EventDispatchService Enhancement (1 hour)

1. **Modify EventDispatchService constructor**
   - [ ] Add optional tracing dependencies
   - [ ] Implement dependency validation
   - [ ] Add initialization logging for tracing status
   - [ ] Maintain backward compatibility

2. **Enhance dispatchWithErrorHandling method**
   - [ ] Add event trace creation logic
   - [ ] Implement performance monitoring integration
   - [ ] Add detailed handler execution tracing
   - [ ] Integrate error capture with event context

### Phase 2: Event Dispatch Tracer Implementation (45 minutes)

1. **Create EventDispatchTracer class**
   - [ ] Implement trace creation and management
   - [ ] Add integration with output services
   - [ ] Create performance analysis integration
   - [ ] Add trace serialization methods

2. **Implement EventDispatchTrace class**
   - [ ] Create trace data structure
   - [ ] Add handler execution tracking
   - [ ] Implement dispatch lifecycle capture
   - [ ] Add JSON serialization and reporting

### Phase 3: Performance Analysis and Integration (15 minutes)

1. **Create EventPerformanceAnalyzer**
   - [ ] Implement statistical analysis for events
   - [ ] Add handler performance tracking
   - [ ] Create error pattern analysis
   - [ ] Generate performance reports

2. **Add dependency injection integration**
   - [ ] Register new tracing components
   - [ ] Configure optional dependencies
   - [ ] Add service initialization
   - [ ] Update container configuration

## Code Examples

### Example 1: EventDispatchService with Tracing

```javascript
// EventDispatchService with tracing enabled
const eventDispatchService = new EventDispatchService({
  eventBus: container.resolve(tokens.IEventBus),
  logger: container.resolve(tokens.ILogger),
  actionTraceFilter: container.resolve(actionTracingTokens.IActionTraceFilter),
  eventDispatchTracer: container.resolve(
    eventTracingTokens.IEventDispatchTracer
  ),
  performanceMonitor: container.resolve(tokens.IPerformanceMonitor),
});

// Dispatch event (tracing happens automatically if configured)
const success = await eventDispatchService.dispatchWithErrorHandling(
  'ATTEMPT_ACTION_ID',
  { action: { definitionId: 'core:go' } },
  'Action execution'
);
```

### Example 2: Event Trace Analysis

```javascript
// Analyze event dispatch performance
const analyzer = new EventPerformanceAnalyzer();

// Traces are added automatically by EventDispatchTracer
const stats = analyzer.getStats();

console.log(`Total events: ${stats.overall.totalEvents}`);
console.log(`Success rate: ${stats.overall.successRate}%`);
console.log(`Average duration: ${stats.overall.averageDuration}ms`);

// Find slow events
const slowEvents = analyzer.getSlowEvents(100); // >100ms
slowEvents.forEach((event) => {
  console.log(`Slow event: ${event.eventType} (${event.duration}ms)`);
});

// Identify error patterns
const errorPatterns = analyzer.getErrorPatterns();
errorPatterns.forEach((pattern) => {
  console.log(
    `Error pattern: ${pattern.eventType} failed ${pattern.failureCount} times`
  );
});
```

### Example 3: Handler Performance Analysis

```javascript
// Get detailed handler statistics
const stats = analyzer.getStats();

Object.entries(stats.handlers).forEach(([handlerName, handlerStats]) => {
  console.log(`Handler: ${handlerName}`);
  console.log(`  Executions: ${handlerStats.totalExecutions}`);
  console.log(`  Success rate: ${handlerStats.successRate.toFixed(1)}%`);
  console.log(
    `  Average duration: ${handlerStats.averageDuration.toFixed(2)}ms`
  );
  console.log(`  Max duration: ${handlerStats.maxDuration.toFixed(2)}ms`);
});
```

## Testing Requirements

### Unit Tests

#### File: `tests/unit/events/eventDispatchService.tracing.test.js`

```javascript
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { EventDispatchService } from '../../../src/events/eventDispatchService.js';
import { createMockEventBus } from '../../common/mocks/mockEventBus.js';
import { createMockLogger } from '../../common/mocks/mockLogger.js';
import { createMockActionTraceFilter } from '../../common/mocks/mockActionTraceFilter.js';
import { createMockEventDispatchTracer } from '../../common/mocks/mockEventDispatchTracer.js';

describe('EventDispatchService - Tracing Integration', () => {
  let eventDispatchService;
  let mockEventBus;
  let mockLogger;
  let mockActionTraceFilter;
  let mockEventDispatchTracer;
  let mockEventTrace;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    mockLogger = createMockLogger();
    mockActionTraceFilter = createMockActionTraceFilter();
    mockEventDispatchTracer = createMockEventDispatchTracer();
    mockEventTrace = createMockEventDispatchTrace();

    // Set up default mocks
    mockActionTraceFilter.isEnabled.mockReturnValue(true);
    mockActionTraceFilter.shouldTrace.mockReturnValue(false); // Default to no tracing
    mockEventDispatchTracer.createTrace.mockReturnValue(mockEventTrace);
    mockEventDispatchTracer.writeTrace.mockResolvedValue();

    eventDispatchService = new EventDispatchService({
      eventBus: mockEventBus,
      logger: mockLogger,
      actionTraceFilter: mockActionTraceFilter,
      eventDispatchTracer: mockEventDispatchTracer,
    });
  });

  describe('Event Tracing', () => {
    it('should not create trace when tracing is disabled globally', async () => {
      mockActionTraceFilter.isEnabled.mockReturnValue(false);
      mockEventBus.getHandlers.mockReturnValue([]);

      await eventDispatchService.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(mockEventDispatchTracer.createTrace).not.toHaveBeenCalled();
      expect(mockEventDispatchTracer.writeTrace).not.toHaveBeenCalled();
    });

    it('should not create trace when event is not marked for tracing', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(false);
      mockEventBus.getHandlers.mockReturnValue([]);

      await eventDispatchService.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(mockEventDispatchTracer.createTrace).not.toHaveBeenCalled();
    });

    it('should create and write trace when event is marked for tracing', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
      mockEventBus.getHandlers.mockReturnValue([
        jest.fn().mockResolvedValue('handler result'),
      ]);

      await eventDispatchService.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(mockEventDispatchTracer.createTrace).toHaveBeenCalled();
      expect(mockEventTrace.captureDispatchStart).toHaveBeenCalled();
      expect(mockEventTrace.captureDispatchSuccess).toHaveBeenCalled();
      expect(mockEventDispatchTracer.writeTrace).toHaveBeenCalledWith(
        mockEventTrace
      );
    });
  });

  describe('Handler Tracing', () => {
    it('should trace individual handler execution', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
      const handler1 = jest.fn().mockResolvedValue('result1');
      const handler2 = jest.fn().mockResolvedValue('result2');
      mockEventBus.getHandlers.mockReturnValue([handler1, handler2]);

      await eventDispatchService.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(mockEventTrace.captureHandlerStart).toHaveBeenCalledTimes(2);
      expect(mockEventTrace.captureHandlerSuccess).toHaveBeenCalledTimes(2);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should capture handler errors without failing dispatch', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
      const handler1 = jest.fn().mockResolvedValue('result1');
      const handler2 = jest.fn().mockRejectedValue(new Error('Handler error'));
      mockEventBus.getHandlers.mockReturnValue([handler1, handler2]);

      const result = await eventDispatchService.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(result).toBe(true); // Dispatch should still succeed
      expect(mockEventTrace.captureHandlerSuccess).toHaveBeenCalledTimes(1);
      expect(mockEventTrace.captureHandlerError).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should continue execution when trace creation fails', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
      mockEventDispatchTracer.createTrace.mockImplementation(() => {
        throw new Error('Trace creation failed');
      });
      mockEventBus.getHandlers.mockReturnValue([]);

      const result = await eventDispatchService.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(result).toBe(true); // Should continue execution
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to create event dispatch trace',
        expect.any(Object)
      );
    });

    it('should capture dispatch errors in trace', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
      const error = new Error('Event dispatch error');
      mockEventBus.getHandlers.mockImplementation(() => {
        throw error;
      });

      const result = await eventDispatchService.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(result).toBe(false);
      expect(mockEventTrace.captureDispatchError).toHaveBeenCalledWith(
        error,
        expect.any(Object)
      );
      expect(mockEventDispatchTracer.writeTrace).toHaveBeenCalledWith(
        mockEventTrace
      );
    });
  });

  describe('Performance Integration', () => {
    it('should integrate with performance monitoring', async () => {
      const mockPerformanceMonitor = {
        startTiming: jest.fn().mockReturnValue('timer-id'),
        endTiming: jest.fn(),
      };

      const serviceWithPerf = new EventDispatchService({
        eventBus: mockEventBus,
        logger: mockLogger,
        performanceMonitor: mockPerformanceMonitor,
      });

      mockEventBus.getHandlers.mockReturnValue([]);

      await serviceWithPerf.dispatchWithErrorHandling(
        'TEST_EVENT',
        { data: 'test' },
        'test context'
      );

      expect(mockPerformanceMonitor.startTiming).toHaveBeenCalledWith(
        'event_dispatch',
        expect.any(Object)
      );
      expect(mockPerformanceMonitor.endTiming).toHaveBeenCalledWith(
        'timer-id',
        expect.any(Object)
      );
    });
  });
});
```

### Integration Tests

#### File: `tests/integration/events/eventDispatchTracing.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventDispatchTracingTestBed } from '../../common/testbeds/eventDispatchTracingTestBed.js';

describe('Event Dispatch Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EventDispatchTracingTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should create complete trace for traced event dispatch', async () => {
    // Configure to trace specific events
    testBed.configureTracing(['ATTEMPT_ACTION_ID']);

    // Register test handlers
    testBed.registerEventHandler('ATTEMPT_ACTION_ID', async (event) => {
      return { success: true, actionId: event.payload.action.definitionId };
    });

    // Dispatch event
    const success =
      await testBed.eventDispatchService.dispatchWithErrorHandling(
        'ATTEMPT_ACTION_ID',
        {
          action: { definitionId: 'core:go' },
          actor: { id: 'player-1' },
          timestamp: Date.now(),
        },
        'Action execution test'
      );

    // Verify dispatch succeeded
    expect(success).toBe(true);

    // Verify trace was created and written
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    const trace = traces[0];
    expect(trace.metadata.eventType).toBe('ATTEMPT_ACTION_ID');
    expect(trace.dispatch.success).toBe(true);
    expect(trace.dispatch.totalHandlers).toBe(1);
    expect(trace.handlers).toHaveLength(1);
    expect(trace.handlers[0].success).toBe(true);
  });

  it('should handle multiple event handlers with mixed results', async () => {
    testBed.configureTracing(['MULTI_HANDLER_EVENT']);

    // Register multiple handlers with different outcomes
    testBed.registerEventHandler('MULTI_HANDLER_EVENT', async () => 'success1');
    testBed.registerEventHandler('MULTI_HANDLER_EVENT', async () => {
      throw new Error('Handler 2 failed');
    });
    testBed.registerEventHandler('MULTI_HANDLER_EVENT', async () => 'success3');

    const success =
      await testBed.eventDispatchService.dispatchWithErrorHandling(
        'MULTI_HANDLER_EVENT',
        { data: 'test' },
        'Multi-handler test'
      );

    expect(success).toBe(true); // Overall dispatch succeeds despite handler failure

    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    const trace = traces[0];
    expect(trace.dispatch.totalHandlers).toBe(3);
    expect(trace.dispatch.successfulHandlers).toBe(2);
    expect(trace.dispatch.failedHandlers).toBe(1);
    expect(trace.handlers).toHaveLength(3);

    // Verify individual handler results
    expect(trace.handlers[0].success).toBe(true);
    expect(trace.handlers[1].success).toBe(false);
    expect(trace.handlers[2].success).toBe(true);
    expect(trace.handlers[1].error.message).toBe('Handler 2 failed');
  });

  it('should integrate with performance analysis', async () => {
    testBed.configureTracing(['PERFORMANCE_TEST']);
    testBed.enablePerformanceAnalysis();

    // Register handlers with different performance characteristics
    testBed.registerEventHandler('PERFORMANCE_TEST', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'fast';
    });
    testBed.registerEventHandler('PERFORMANCE_TEST', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'slow';
    });

    await testBed.eventDispatchService.dispatchWithErrorHandling(
      'PERFORMANCE_TEST',
      { data: 'perf test' },
      'Performance test'
    );

    const performanceStats = testBed.getPerformanceStats();
    expect(performanceStats.events.PERFORMANCE_TEST).toBeTruthy();
    expect(performanceStats.events.PERFORMANCE_TEST.totalDispatches).toBe(1);
    expect(performanceStats.events.PERFORMANCE_TEST.successRate).toBe(100);
    expect(
      performanceStats.events.PERFORMANCE_TEST.averageDuration
    ).toBeGreaterThan(0);
  });
});
```

## Integration Points

### 1. CommandProcessor Integration

- EventDispatchService is called by CommandProcessor during action execution
- Traces are correlated between ActionExecutionTrace and EventDispatchTrace
- Error contexts are shared between systems

### 2. ActionTraceFilter Integration

- Uses same filtering logic to determine which events should be traced
- Consistent with action tracing configuration
- Supports wildcard patterns for event types

### 3. Performance Monitoring Integration

- Integrates with existing performance monitoring infrastructure
- Provides event-specific performance metrics
- Correlates with action execution performance data

### 4. Output Services Integration

- Uses same output services as action tracing
- Consistent file naming and rotation policies
- Supports both JSON and human-readable formats

## Error Handling

### Trace Creation Errors

- Graceful fallback when trace creation fails
- Continue event dispatch without tracing
- Log warnings without breaking functionality

### Handler Execution Errors

- Individual handler failures don't break dispatch
- Comprehensive error capture for failed handlers
- Performance impact isolation

### Output Errors

- Asynchronous trace writing with error handling
- Retry logic for transient failures
- Fallback to memory storage if file writes fail

## Security Considerations

1. **Payload Sanitization** - Remove sensitive data from event payloads
2. **Handler Result Protection** - Limit handler result data in traces
3. **Error Information** - Sanitize error messages and stack traces
4. **Performance Limits** - Prevent resource exhaustion from large events

## Dependencies

### Internal Dependencies

- ActionTraceFilter for consistent filtering logic
- Event output services for trace storage
- Performance monitoring infrastructure
- Existing EventBus implementation

### External Dependencies

- None (extends existing EventDispatchService)

## Risks and Mitigation

| Risk                                       | Probability | Impact | Mitigation                                 |
| ------------------------------------------ | ----------- | ------ | ------------------------------------------ |
| Performance overhead from detailed tracing | Medium      | Medium | Optional tracing, efficient implementation |
| Handler failure impact on tracing          | Low         | Low    | Isolated error handling per handler        |
| Memory usage from event traces             | Low         | Medium | Trace size limits, cleanup policies        |
| Integration complexity with EventBus       | Low         | Medium | Minimal changes, backward compatibility    |

## Acceptance Criteria

- [ ] EventDispatchService integrates optional tracing without breaking existing functionality
- [ ] Individual event handler execution is tracked with timing and results
- [ ] Event dispatch success/failure is captured with detailed context
- [ ] Tracing follows same configuration and filtering as action tracing
- [ ] Performance impact is minimal when tracing is disabled
- [ ] Integration with performance monitoring provides useful metrics
- [ ] Error handling prevents tracing failures from breaking event dispatch
- [ ] Unit tests achieve >95% coverage
- [ ] Integration tests verify end-to-end functionality
- [ ] Backward compatibility is maintained

## Future Enhancements

1. **Event Correlation** - Link related events across dispatches
2. **Real-time Event Monitoring** - Live event dispatch monitoring
3. **Event Replay** - Replay captured events for debugging
4. **Distributed Event Tracing** - Support for distributed system events
5. **Custom Event Metrics** - User-defined event performance metrics

## Documentation Requirements

1. **Integration Guide** - How to enable event dispatch tracing
2. **Performance Analysis Guide** - Understanding event performance metrics
3. **Configuration Reference** - All event tracing options
4. **Handler Development Guide** - Best practices for traceable handlers

## Definition of Done

- [ ] EventDispatchService enhanced with optional tracing support
- [ ] EventDispatchTracer and EventDispatchTrace classes implemented
- [ ] EventPerformanceAnalyzer created for statistical analysis
- [ ] Integration with existing tracing infrastructure completed
- [ ] Unit tests written and passing (>95% coverage)
- [ ] Integration tests verify end-to-end tracing functionality
- [ ] Performance tests validate minimal overhead
- [ ] Backward compatibility verified
- [ ] Security review passed
- [ ] Code reviewed and approved
- [ ] Documentation updated
