/**
 * @file Debug tracing system for complex clothing operations
 */

/**
 * Tracing system for debugging complex clothing operations
 * Maintains execution traces with timing and metadata
 */
export class ClothingTracer {
  #traces;
  #currentTrace;
  #maxTraces;

  /**
   * @param {number} maxTraces - Maximum number of traces to retain
   */
  constructor(maxTraces = 100) {
    this.#traces = new Map();
    this.#currentTrace = null;
    this.#maxTraces = maxTraces;
  }

  /**
   * Start a new trace
   * @param {string} operationName - Name of the operation being traced
   * @param {object} context - Initial context for the trace
   * @returns {string} Trace ID
   */
  startTrace(operationName, context = {}) {
    const traceId = this.#generateTraceId();
    const trace = {
      traceId,
      operationName,
      context,
      startTime: performance.now(),
      steps: [],
      metadata: {},
      errors: []
    };

    this.#traces.set(traceId, trace);
    this.#currentTrace = traceId;

    // Cleanup old traces if limit exceeded
    if (this.#traces.size > this.#maxTraces) {
      const oldestTrace = this.#traces.keys().next().value;
      this.#traces.delete(oldestTrace);
    }

    return traceId;
  }

  /**
   * Add a step to the current trace
   * @param {string} step - Step description
   * @param {object} data - Step data
   */
  addStep(step, data = {}) {
    if (!this.#currentTrace) return;

    const trace = this.#traces.get(this.#currentTrace);
    if (trace) {
      trace.steps.push({
        step,
        data,
        timestamp: performance.now() - trace.startTime
      });
    }
  }

  /**
   * Add metadata to the current trace
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   */
  addMetadata(key, value) {
    if (!this.#currentTrace) return;

    const trace = this.#traces.get(this.#currentTrace);
    if (trace) {
      trace.metadata[key] = value;
    }
  }

  /**
   * Record an error in the current trace
   * @param {Error} error - Error to record
   * @param {object} context - Error context
   */
  recordError(error, context = {}) {
    if (!this.#currentTrace) return;

    const trace = this.#traces.get(this.#currentTrace);
    if (trace) {
      trace.errors.push({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context,
        timestamp: performance.now() - trace.startTime
      });
    }
  }

  /**
   * End the current trace
   * @param {*} result - Final result of the operation
   * @returns {string|null} Trace ID
   */
  endTrace(result = null) {
    if (!this.#currentTrace) return null;

    const trace = this.#traces.get(this.#currentTrace);
    if (trace) {
      trace.endTime = performance.now();
      trace.duration = trace.endTime - trace.startTime;
      trace.result = result;
      trace.successful = trace.errors.length === 0;
    }

    const traceId = this.#currentTrace;
    this.#currentTrace = null;
    return traceId;
  }

  /**
   * Get a specific trace
   * @param {string} traceId - Trace ID
   * @returns {object|null} Trace data
   */
  getTrace(traceId) {
    return this.#traces.get(traceId) || null;
  }

  /**
   * Get all traces
   * @returns {Array} Array of all traces
   */
  getAllTraces() {
    return Array.from(this.#traces.values());
  }

  /**
   * Get traces for a specific operation
   * @param {string} operationName - Operation name to filter by
   * @returns {Array} Filtered traces
   */
  getTracesByOperation(operationName) {
    return this.getAllTraces().filter(trace => 
      trace.operationName === operationName
    );
  }

  /**
   * Get failed traces
   * @returns {Array} Array of traces with errors
   */
  getFailedTraces() {
    return this.getAllTraces().filter(trace => 
      trace.errors && trace.errors.length > 0
    );
  }

  /**
   * Get slow traces exceeding duration threshold
   * @param {number} thresholdMs - Duration threshold in milliseconds
   * @returns {Array} Array of slow traces
   */
  getSlowTraces(thresholdMs) {
    return this.getAllTraces().filter(trace => 
      trace.duration && trace.duration > thresholdMs
    );
  }

  /**
   * Clear all traces
   */
  clearAllTraces() {
    this.#traces.clear();
    this.#currentTrace = null;
  }

  /**
   * Export traces for analysis
   * @returns {string} JSON string of all traces
   */
  exportTraces() {
    const traces = this.getAllTraces();
    return JSON.stringify(traces, null, 2);
  }

  /**
   * Get summary statistics
   * @returns {object} Summary of trace statistics
   */
  getStatistics() {
    const traces = this.getAllTraces();
    
    if (traces.length === 0) {
      return {
        totalTraces: 0,
        successfulTraces: 0,
        failedTraces: 0,
        averageDuration: 0,
        slowestTrace: null,
        fastestTrace: null
      };
    }

    const completedTraces = traces.filter(t => t.duration !== undefined);
    const successfulTraces = traces.filter(t => t.successful);
    const failedTraces = traces.filter(t => !t.successful);
    
    const durations = completedTraces.map(t => t.duration);
    const averageDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    
    const slowestTrace = completedTraces.reduce((max, trace) => 
      !max || trace.duration > max.duration ? trace : max, null
    );
    
    const fastestTrace = completedTraces.reduce((min, trace) => 
      !min || trace.duration < min.duration ? trace : min, null
    );

    return {
      totalTraces: traces.length,
      successfulTraces: successfulTraces.length,
      failedTraces: failedTraces.length,
      averageDuration: averageDuration.toFixed(2),
      slowestTrace: slowestTrace ? {
        traceId: slowestTrace.traceId,
        operationName: slowestTrace.operationName,
        duration: slowestTrace.duration.toFixed(2)
      } : null,
      fastestTrace: fastestTrace ? {
        traceId: fastestTrace.traceId,
        operationName: fastestTrace.operationName,
        duration: fastestTrace.duration.toFixed(2)
      } : null
    };
  }

  /**
   * Generate unique trace ID
   * @private
   * @returns {string} Trace ID
   */
  #generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ClothingTracer;