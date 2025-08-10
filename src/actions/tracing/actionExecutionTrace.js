/**
 * @file Action execution trace data structure
 * Captures timing, payloads, results, and errors for action execution
 */

/**
 * ActionExecutionTrace class for capturing action execution data
 * Used by CommandProcessor to track action dispatch and execution
 */
export class ActionExecutionTrace {
  #actionId;
  #actorId;
  #turnAction;
  #executionData;
  #startTime;
  #endTime;

  /**
   * Create new execution trace
   *
   * @param {object} options - Trace options
   * @param {string} options.actionId - Action definition ID being executed
   * @param {string} options.actorId - Actor performing the action
   * @param {object} options.turnAction - Complete turn action object
   */
  constructor({ actionId, actorId, turnAction }) {
    // Validate required parameters
    if (!actionId || typeof actionId !== 'string') {
      throw new Error('ActionExecutionTrace requires valid actionId string');
    }
    if (!actorId || typeof actorId !== 'string') {
      throw new Error('ActionExecutionTrace requires valid actorId string');
    }
    if (!turnAction || typeof turnAction !== 'object') {
      throw new Error('ActionExecutionTrace requires valid turnAction object');
    }

    this.#actionId = actionId;
    this.#actorId = actorId;
    this.#turnAction = Object.freeze({ ...turnAction }); // Immutable copy

    // Initialize execution data structure
    this.#executionData = {
      startTime: null,
      endTime: null,
      duration: null,
      eventPayload: null,
      dispatchResult: null,
      error: null,
      phases: [], // Track execution phases
    };

    this.#startTime = null;
    this.#endTime = null;
  }

  /**
   * Mark the start of action dispatch
   * Captures high-precision start time
   */
  captureDispatchStart() {
    if (this.#startTime !== null) {
      throw new Error('Dispatch already started for this trace');
    }

    this.#startTime = this.#getHighPrecisionTime();
    this.#executionData.startTime = this.#startTime;

    this.#executionData.phases.push({
      phase: 'dispatch_start',
      timestamp: this.#startTime,
      description: 'Action dispatch initiated',
    });
  }

  /**
   * Capture the event payload sent to EventDispatchService
   *
   * @param {object} payload - Event payload object
   */
  captureEventPayload(payload) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing payload'
      );
    }
    if (this.#endTime !== null) {
      throw new Error('Cannot capture payload after dispatch has ended');
    }

    // Create immutable copy of payload, filtering sensitive data
    this.#executionData.eventPayload = this.#sanitizePayload(payload);

    this.#executionData.phases.push({
      phase: 'payload_captured',
      timestamp: this.#getHighPrecisionTime(),
      description: 'Event payload captured',
      payloadSize: this.#calculatePayloadSize(payload),
    });
  }

  /**
   * Capture the result of dispatch operation
   *
   * @param {object} result - Dispatch result
   * @param {boolean} result.success - Whether dispatch succeeded
   * @param {number} [result.timestamp] - Result timestamp
   * @param {object} [result.metadata] - Additional result metadata
   */
  captureDispatchResult(result) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing result'
      );
    }
    if (this.#endTime !== null) {
      throw new Error('Dispatch result already captured');
    }

    this.#endTime = this.#getHighPrecisionTime();
    this.#executionData.endTime = this.#endTime;
    this.#executionData.duration = this.#endTime - this.#startTime;

    // Store dispatch result
    this.#executionData.dispatchResult = {
      success: Boolean(result.success),
      timestamp: result.timestamp || this.#endTime,
      metadata: result.metadata || null,
    };

    this.#executionData.phases.push({
      phase: 'dispatch_completed',
      timestamp: this.#endTime,
      description: result.success ? 'Dispatch succeeded' : 'Dispatch failed',
      success: result.success,
    });
  }

  /**
   * Capture error information
   *
   * @param {Error} error - Error that occurred during execution
   */
  captureError(error) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing error'
      );
    }

    const errorTime = this.#getHighPrecisionTime();

    // End timing if not already ended
    if (this.#endTime === null) {
      this.#endTime = errorTime;
      this.#executionData.endTime = this.#endTime;
      this.#executionData.duration = this.#endTime - this.#startTime;
    }

    // Capture comprehensive error information
    this.#executionData.error = {
      message: error.message || 'Unknown error',
      type: error.constructor.name || 'Error',
      stack: error.stack || null,
      timestamp: errorTime,
      // Additional error properties if available
      code: error.code || null,
      cause: error.cause || null,
    };

    this.#executionData.phases.push({
      phase: 'error_captured',
      timestamp: errorTime,
      description: `Error occurred: ${error.message}`,
      errorType: error.constructor.name,
    });
  }

  /**
   * Get the action ID being traced
   *
   * @returns {string} Action definition ID
   */
  get actionId() {
    return this.#actionId;
  }

  /**
   * Get the actor ID performing the action
   *
   * @returns {string} Actor ID
   */
  get actorId() {
    return this.#actorId;
  }

  /**
   * Check if execution is complete (either success or error)
   *
   * @returns {boolean} True if execution is complete
   */
  get isComplete() {
    return this.#endTime !== null;
  }

  /**
   * Check if execution ended with error
   *
   * @returns {boolean} True if error occurred
   */
  get hasError() {
    return this.#executionData.error !== null;
  }

  /**
   * Get execution duration in milliseconds
   *
   * @returns {number|null} Duration or null if not complete
   */
  get duration() {
    return this.#executionData.duration;
  }

  /**
   * Get execution phases for detailed analysis
   *
   * @returns {Array} Array of execution phases with timestamps
   */
  getExecutionPhases() {
    return [...this.#executionData.phases]; // Return copy
  }

  /**
   * Convert trace to JSON for serialization
   *
   * @returns {object} Serializable trace data
   */
  toJSON() {
    return {
      metadata: {
        actionId: this.#actionId,
        actorId: this.#actorId,
        traceType: 'execution',
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
      turnAction: {
        actionDefinitionId: this.#turnAction.actionDefinitionId,
        commandString: this.#turnAction.commandString,
        // Include other non-sensitive turn action properties
        parameters: this.#turnAction.parameters || {},
      },
      execution: {
        startTime: this.#executionData.startTime,
        endTime: this.#executionData.endTime,
        duration: this.#executionData.duration,
        status: this.#getExecutionStatus(),
        phases: this.#executionData.phases,
      },
      eventPayload: this.#executionData.eventPayload,
      result: this.#executionData.dispatchResult,
      error: this.#executionData.error,
    };
  }

  /**
   * Create human-readable summary
   *
   * @returns {string} Human-readable trace summary
   */
  toSummary() {
    const status = this.#getExecutionStatus();
    const duration = this.#executionData.duration
      ? `${this.#executionData.duration.toFixed(2)}ms`
      : 'incomplete';

    return `Action: ${this.#actionId} | Actor: ${this.#actorId} | Status: ${status} | Duration: ${duration}`;
  }

  /**
   * Get high-precision timestamp
   *
   * @private
   * @returns {number} High-precision timestamp
   */
  #getHighPrecisionTime() {
    // Use performance.now() if available, fallback to Date.now()
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  /**
   * Get execution status string
   *
   * @private
   * @returns {string} Status description
   */
  #getExecutionStatus() {
    if (this.#executionData.error) {
      return 'error';
    } else if (this.#executionData.dispatchResult?.success === true) {
      return 'success';
    } else if (this.#executionData.dispatchResult?.success === false) {
      return 'failed';
    } else if (this.#startTime !== null && this.#endTime === null) {
      return 'in_progress';
    } else {
      return 'pending';
    }
  }

  /**
   * Sanitize payload to remove sensitive information
   *
   * @private
   * @param {object} payload - Original payload
   * @returns {object} Sanitized payload
   */
  #sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };

    // Remove or redact sensitive fields
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

    // Deep sanitization for nested objects
    Object.keys(sanitized).forEach((key) => {
      if (sanitized[key] && typeof sanitized[key] === 'object') {
        sanitized[key] = this.#sanitizePayload(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Calculate approximate payload size
   *
   * @private
   * @param {object} payload - Payload to measure
   * @returns {number} Approximate size in bytes
   */
  #calculatePayloadSize(payload) {
    try {
      return new TextEncoder().encode(JSON.stringify(payload)).length;
    } catch {
      return 0; // Fallback if JSON.stringify fails
    }
  }
}

export default ActionExecutionTrace;