/**
 * @file Action execution trace data structure
 * Captures timing, payloads, results, and errors for action execution
 */

/** @typedef {import('./timing/executionPhaseTimer.js').ExecutionPhaseTimer} ExecutionPhaseTimer */
import { ExecutionPhaseTimer } from './timing/executionPhaseTimer.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { ErrorClassifier } from './errorClassification.js';
import { StackTraceAnalyzer } from './stackTraceAnalyzer.js';

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
  #phaseTimer;
  #timingEnabled;
  #errorAnalysisEnabled;
  #errorClassifier;
  #stackTraceAnalyzer;
  #errorContext;
  #errorHistory;
  #processingLock;

  /**
   * Create new execution trace
   *
   * @param {object} options - Trace options
   * @param {string} options.actionId - Action definition ID being executed
   * @param {string} options.actorId - Actor performed the action
   * @param {object} options.turnAction - Complete turn action object
   * @param {boolean} [options.enableTiming] - Enable high-precision timing
   * @param {boolean} [options.enableErrorAnalysis] - Enable error classification and analysis
   */
  constructor({
    actionId,
    actorId,
    turnAction,
    enableTiming = true,
    enableErrorAnalysis = false, // Default to false to reduce memory overhead
  }) {
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

    // Validate enableTiming parameter
    if (typeof enableTiming !== 'boolean') {
      throw new InvalidArgumentError('enableTiming must be a boolean value');
    }

    // Validate enableErrorAnalysis parameter
    if (typeof enableErrorAnalysis !== 'boolean') {
      throw new InvalidArgumentError(
        'enableErrorAnalysis must be a boolean value'
      );
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
      operations: [], // Track individual operation executions
      currentOperation: null, // Currently executing operation
    };

    this.#startTime = null;
    this.#endTime = null;

    // Add timing support with backward compatibility
    this.#timingEnabled = enableTiming;
    if (this.#timingEnabled) {
      this.#phaseTimer = new ExecutionPhaseTimer();
    }

    // Store enableErrorAnalysis flag for lazy initialization
    this.#errorAnalysisEnabled = enableErrorAnalysis;

    // Initialize error analysis components lazily when needed
    this.#errorClassifier = null;
    this.#stackTraceAnalyzer = null;

    this.#errorContext = {
      phase: null,
      timing: null,
      retryCount: 0,
      executionState: {},
    };

    // Initialize error history for multiple error support
    this.#errorHistory = [];

    // Initialize processing lock for concurrency safety
    this.#processingLock = false;
  }

  /**
   * Enhanced dispatch start with timing
   */
  captureDispatchStart() {
    if (this.#startTime !== null) {
      throw new Error('Dispatch already started for this trace');
    }

    this.#startTime = this.#getHighPrecisionTime();
    this.#executionData.startTime = this.#startTime;

    // Start execution timing
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.startExecution('action_dispatch');
      this.#phaseTimer.startPhase('initialization', {
        actionId: this.#actionId,
        actorId: this.#actorId,
      });
    }

    this.#executionData.phases.push({
      phase: 'dispatch_start',
      timestamp: this.#startTime,
      description: 'Action dispatch initiated',
    });
  }

  /**
   * Enhanced payload capture with phase timing
   *
   * @param {object} payload - Event payload to capture
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

    // End initialization phase, start payload phase
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.endPhase('initialization');
      this.#phaseTimer.startPhase('payload_creation', {
        payloadSize: this.#calculatePayloadSize(payload),
      });
    }

    this.#executionData.eventPayload = this.#sanitizePayload(payload);

    const timestamp = this.#getHighPrecisionTime();
    this.#executionData.phases.push({
      phase: 'payload_captured',
      timestamp,
      description: 'Event payload captured',
      payloadSize: this.#calculatePayloadSize(payload),
    });

    // Add timing marker
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.addMarker('payload_sanitized');
    }
  }

  /**
   * Enhanced dispatch result with timing
   *
   * @param {object} result - Dispatch result to capture
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

    // End current phase and start completion phase
    if (this.#timingEnabled && this.#phaseTimer) {
      // End whichever phase is currently active (initialization or payload_creation)
      const currentPhases = this.#phaseTimer.getAllPhases();
      const activePhase = currentPhases.find((p) => p.endTime === null);
      if (activePhase) {
        this.#phaseTimer.endPhase(activePhase.name);
      }
      this.#phaseTimer.startPhase('completion', {
        success: Boolean(result.success),
      });
    }

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

    // Complete timing
    if (this.#timingEnabled && this.#phaseTimer) {
      this.#phaseTimer.endPhase('completion');
      this.#phaseTimer.endExecution({
        success: result.success,
        actionId: this.#actionId,
      });
    }
  }

  /**
   * Enhanced error capture with timing and classification
   * Supports multiple error captures for retry scenarios
   *
   * @param {Error} error - Error that occurred
   * @param {object} context - Additional error context
   * @param {boolean} allowMultiple - Allow multiple error captures
   */
  captureError(error, context = {}, allowMultiple = false) {
    if (this.#startTime === null) {
      throw new Error(
        'Must call captureDispatchStart() before capturing error'
      );
    }

    // Check for concurrent processing
    if (this.#processingLock) {
      // If we already have an error and this isn't explicitly allowed, return early
      if (this.#executionData.error !== null && !allowMultiple) {
        return; // Gracefully ignore duplicate error capture attempts
      }
    }

    this.#processingLock = true;

    try {
      // Handle multiple error scenario - either update existing or add to history
      if (this.#executionData.error !== null) {
        if (!allowMultiple) {
          // For backward compatibility, ignore subsequent errors unless explicitly allowed
          return;
        } else {
          // Store previous error in history before overwriting
          this.#errorHistory.push({
            ...this.#executionData.error,
            capturedAt: this.#executionData.error.timestamp,
          });
        }
      }

      const errorTime = this.#getHighPrecisionTime();

      // End timing if not already ended
      if (this.#endTime === null) {
        this.#endTime = errorTime;
        this.#executionData.endTime = this.#endTime;
        this.#executionData.duration = this.#endTime - this.#startTime;
      }

      // Update error context
      this.#errorContext = {
        ...this.#errorContext,
        ...context,
        phase:
          context.phase || this.#errorContext.phase || this.#getCurrentPhase(),
        timing: this.#getTimingContext(),
        captureTime: errorTime,
      };

      // Lazy initialize error analysis components if enabled and needed
      if (this.#errorAnalysisEnabled) {
        if (!this.#errorClassifier) {
          this.#errorClassifier = new ErrorClassifier({
            logger: console, // Fallback logger
          });
        }
        if (!this.#stackTraceAnalyzer) {
          this.#stackTraceAnalyzer = new StackTraceAnalyzer({
            projectPath:
              typeof process !== 'undefined' &&
              typeof process.cwd === 'function'
                ? process.cwd()
                : '/',
            logger: console,
          });
        }
      }

      // Classify error if classifier available
      let classification = null;
      if (this.#errorClassifier) {
        try {
          classification = this.#errorClassifier.classifyError(
            error,
            this.#errorContext
          );
        } catch (classificationError) {
          // Log classification failure without console (will be handled by logger)
          if (
            typeof process !== 'undefined' &&
            process.env?.NODE_ENV === 'test'
          ) {
            console.warn(
              'Error classification failed:',
              classificationError.message
            );
          }
        }
      }

      // Analyze stack trace if analyzer available
      let stackAnalysis = null;
      if (this.#stackTraceAnalyzer && error?.stack) {
        try {
          stackAnalysis = this.#stackTraceAnalyzer.parseStackTrace(error.stack);
        } catch (analysisError) {
          // Log stack trace analysis failure without console (will be handled by logger)
          if (
            typeof process !== 'undefined' &&
            process.env?.NODE_ENV === 'test'
          ) {
            console.warn('Stack trace analysis failed:', analysisError.message);
          }
        }
      }

      // Handle timing for error case with classification
      if (
        this.#timingEnabled &&
        this.#phaseTimer &&
        this.#phaseTimer.isActive()
      ) {
        this.#phaseTimer.addMarker('error_occurred', null, {
          errorType: error?.constructor?.name || 'Unknown',
          errorMessage: error?.message || 'Unknown error',
          errorCategory: classification?.category || 'unknown',
        });

        if (this.#endTime === errorTime) {
          this.#phaseTimer.endExecution({
            success: false,
            error: error?.constructor?.name || 'Unknown',
            errorCategory: classification?.category || 'unknown',
          });
        }
      }

      this.#executionData.error = {
        // Existing error information
        message: error?.message || 'Unknown error',
        type: error?.constructor?.name || 'Error',
        name: error?.name || error?.constructor?.name || 'Error',
        stack: error?.stack || null,
        timestamp: errorTime,

        // Extended error properties
        code: error?.code || null,
        cause: error?.cause || null,
        errno: error?.errno || null,
        syscall: error?.syscall || null,

        // Error context
        context: {
          phase: this.#errorContext.phase,
          executionDuration: this.#executionData.duration,
          retryCount: this.#errorContext.retryCount,
          actionId: this.#actionId,
          actorId: this.#actorId,
        },

        // Classification results
        classification: classification || {
          category: 'unknown',
          severity: 'medium',
          recoveryPotential: 'conditional',
          isTransient: false,
          isRetryable: false,
          confidence: 0,
        },

        // Stack trace analysis
        stackAnalysis: stackAnalysis || null,

        // Error location (from stack trace)
        location: stackAnalysis
          ? this.#stackTraceAnalyzer.getErrorLocation(stackAnalysis)
          : null,

        // Formatted stack trace for readability
        formattedStack:
          stackAnalysis && this.#stackTraceAnalyzer
            ? this.#stackTraceAnalyzer.formatStackTrace(stackAnalysis, {
                showProjectOnly: false,
                maxFrames: 15,
                includeLineNumbers: true,
                includeAnalysis: false,
              })
            : null,
      };

      // Add to execution phases
      this.#executionData.phases.push({
        phase: 'error_captured',
        timestamp: errorTime,
        description: `Error occurred: ${error?.message || 'Unknown error'}`,
        errorType: error?.constructor?.name || 'Unknown',
        errorCategory: classification?.category || 'unknown',
        severity: classification?.severity || 'unknown',
      });
    } finally {
      // Always release the processing lock
      this.#processingLock = false;
    }
  }

  /**
   * Capture operation execution start
   *
   * @param {object} operation - Operation being executed
   * @param {number} operationIndex - Index in rule action sequence
   */
  captureOperationStart(operation, operationIndex) {
    const startTime = this.#getHighPrecisionTime();

    this.#executionData.currentOperation = {
      type: operation.type,
      index: operationIndex,
      parameters: operation.parameters || {},
      startTime,
      endTime: null,
      duration: null,
      result: null,
    };

    this.#executionData.phases.push({
      phase: 'operation_start',
      timestamp: startTime,
      description: `Operation ${operationIndex}: ${operation.type} started`,
      operationType: operation.type,
      operationIndex,
    });
  }

  /**
   * Capture operation execution result
   *
   * @param {object} result - Operation result {success: boolean, error?: string}
   */
  captureOperationResult(result) {
    if (!this.#executionData.currentOperation) {
      return; // No current operation to capture result for
    }

    const endTime = this.#getHighPrecisionTime();
    const duration = endTime - this.#executionData.currentOperation.startTime;

    // Complete current operation
    this.#executionData.currentOperation.endTime = endTime;
    this.#executionData.currentOperation.duration = duration;
    this.#executionData.currentOperation.result = result;

    // Move to operations history
    this.#executionData.operations.push({
      ...this.#executionData.currentOperation,
    });

    // Add phase entry
    this.#executionData.phases.push({
      phase: 'operation_completed',
      timestamp: endTime,
      description: `Operation ${this.#executionData.currentOperation.index}: ${this.#executionData.currentOperation.type} ${result?.success ? 'succeeded' : 'failed'}`,
      operationType: this.#executionData.currentOperation.type,
      operationIndex: this.#executionData.currentOperation.index,
      success: result?.success,
      error: result?.error || null,
      duration,
    });

    // Clear current operation
    this.#executionData.currentOperation = null;
  }

  /**
   * Get operation execution history
   *
   * @returns {Array} Array of operation executions
   */
  getOperations() {
    return [...this.#executionData.operations]; // Return copy
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
   * Enhanced JSON export with timing data
   */
  toJSON() {
    const baseData = {
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
        parameters: this.#turnAction.parameters || {},
      },
      execution: {
        startTime: this.#executionData.startTime,
        endTime: this.#executionData.endTime,
        duration: this.#executionData.duration,
        status: this.#getExecutionStatus(),
        phases: this.#executionData.phases,
        operations: this.#executionData.operations,
        currentOperation: this.#executionData.currentOperation,
      },
      eventPayload: this.#executionData.eventPayload,
      result: this.#executionData.dispatchResult,
      error: this.#executionData.error,
      hasError: Boolean(this.#executionData.error),
      errorData: this.#executionData.error
        ? {
            message: this.#executionData.error.message,
            type: this.#executionData.error.type || 'Unknown',
            stack: this.#executionData.error.stack,
          }
        : null,
      errorHistory: this.#errorHistory,
      hasMultipleErrors: this.#errorHistory.length > 0,
      duration: this.#executionData.duration, // Also expose at top level for easy access
    };

    // Add timing data if available
    if (this.#timingEnabled && this.#phaseTimer) {
      baseData.timing = this.#phaseTimer.exportTimingData();
    }

    return baseData;
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
   * Get detailed performance report
   *
   * @returns {string} Human-readable performance report
   */
  getPerformanceReport() {
    if (!this.#timingEnabled || !this.#phaseTimer) {
      return 'Timing not enabled for this trace';
    }

    return this.#phaseTimer.createReport();
  }

  /**
   * Get timing summary
   *
   * @returns {object | null} Timing summary or null if timing disabled
   */
  getTimingSummary() {
    if (!this.#timingEnabled || !this.#phaseTimer) {
      return null;
    }

    return this.#phaseTimer.getSummary();
  }

  /**
   * Set error context for better error analysis
   *
   * @param {object} context - Error context
   */
  setErrorContext(context) {
    this.#errorContext = {
      ...this.#errorContext,
      ...context,
    };
  }

  /**
   * Update existing error with additional information
   *
   * @param {Error} error - New error information
   * @param {object} context - Additional context
   */
  updateError(error, context = {}) {
    if (this.#executionData.error === null) {
      // No existing error, behave like captureError
      this.captureError(error, context, false);
    } else {
      // Update existing error
      this.captureError(error, context, true);
    }
  }

  /**
   * Add error to history without replacing current error
   *
   * @param {Error} error - Error to add to history
   * @param {object} context - Additional context
   */
  addErrorToHistory(error, context = {}) {
    const errorTime = this.#getHighPrecisionTime();

    this.#errorHistory.push({
      message: error?.message || 'Unknown error',
      type: error?.constructor?.name || 'Error',
      timestamp: errorTime,
      context: {
        phase: context.phase || this.#getCurrentPhase(),
        retryCount: this.#errorContext.retryCount,
        ...context,
      },
    });
  }

  /**
   * Get error history
   *
   * @returns {Array} Array of historical errors
   */
  getErrorHistory() {
    return [...this.#errorHistory]; // Return copy
  }

  /**
   * Check if trace has multiple errors captured
   *
   * @returns {boolean} True if multiple errors exist
   */
  hasMultipleErrors() {
    return this.#errorHistory.length > 0;
  }

  /**
   * Get error details
   *
   * @returns {object | null} Error details or null if no error
   */
  getError() {
    return this.#executionData.error;
  }

  /**
   * Get error summary
   *
   * @returns {object | null} Error summary or null if no error
   */
  getErrorSummary() {
    if (!this.#executionData.error) {
      return null;
    }

    const error = this.#executionData.error;
    return {
      type: error.type,
      message: error?.message || 'Unknown error',
      category: error.classification?.category || 'unknown',
      severity: error.classification?.severity || 'unknown',
      isRetryable: error.classification?.isRetryable || false,
      location: error.location
        ? {
            file: error.location.shortFile,
            function: error.location.function,
            line: error.location.line,
          }
        : null,
      troubleshooting: error.classification?.troubleshooting || [],
    };
  }

  /**
   * Generate error report
   *
   * @returns {string} Human-readable error report
   */
  getErrorReport() {
    if (!this.#executionData.error) {
      return 'No error occurred during execution';
    }

    const error = this.#executionData.error;
    const lines = [
      'ACTION EXECUTION ERROR REPORT',
      '='.repeat(30),
      `Action: ${this.#actionId}`,
      `Actor: ${this.#actorId}`,
      `Error Type: ${error?.type || 'Unknown'}`,
      `Message: ${error?.message || 'Unknown error'}`,
      `Category: ${error.classification?.category || 'unknown'}`,
      `Severity: ${error.classification?.severity || 'unknown'}`,
      `Phase: ${error.context?.phase || 'unknown'}`,
      `Duration: ${
        error.context?.executionDuration
          ? `${error.context.executionDuration.toFixed(2)}ms`
          : 'unknown'
      }`,
      '',
    ];

    // Add location information
    if (error.location) {
      lines.push('Error Location:');
      lines.push(`  File: ${error.location.shortFile}`);
      lines.push(`  Function: ${error.location.function}`);
      if (error.location.line) {
        lines.push(
          `  Line: ${error.location.line}${error.location.column ? ':' + error.location.column : ''}`
        );
      }
      lines.push('');
    }

    // Add troubleshooting steps
    if (error.classification?.troubleshooting?.length > 0) {
      lines.push('Troubleshooting Steps:');
      error.classification.troubleshooting.forEach((step, index) => {
        lines.push(`  ${index + 1}. ${step}`);
      });
      lines.push('');
    }

    // Add formatted stack trace
    if (error.formattedStack) {
      lines.push('Stack Trace:');
      lines.push(error.formattedStack);
    }

    return lines.join('\n');
  }

  /**
   * Check if error is recoverable
   *
   * @returns {boolean} True if error is recoverable
   */
  isErrorRecoverable() {
    if (!this.#executionData.error) {
      return true; // No error, so recoverable
    }

    const recovery =
      this.#executionData.error.classification?.recoveryPotential;
    return (
      recovery === 'immediate' ||
      recovery === 'delayed' ||
      recovery === 'conditional'
    );
  }

  /**
   * @description Toggle the internal processing lock for test scenarios.
   * @param {ActionExecutionTrace} traceInstance - Trace instance whose lock should change.
   * @param {boolean} locked - Indicates whether the lock should be engaged.
   * @returns {void}
   */
  static __setProcessingLockForTesting(traceInstance, locked) {
    if (
      typeof process === 'undefined' ||
      process?.env?.NODE_ENV !== 'test' ||
      !(traceInstance instanceof ActionExecutionTrace)
    ) {
      return;
    }

    traceInstance.#processingLock = Boolean(locked);
  }

  /**
   * Get current execution phase
   *
   * @private
   * @returns {string} Current phase
   */
  #getCurrentPhase() {
    if (
      !this.#executionData.phases ||
      this.#executionData.phases.length === 0
    ) {
      return 'unknown';
    }

    const lastPhase =
      this.#executionData.phases[this.#executionData.phases.length - 1];
    return lastPhase.phase || 'unknown';
  }

  /**
   * Get timing context for error
   *
   * @private
   * @returns {object | null} Timing context
   */
  #getTimingContext() {
    if (!this.#timingEnabled || !this.#phaseTimer) {
      return null;
    }

    return {
      totalDuration: this.#executionData.duration,
      phaseDurations: this.#phaseTimer.getAllPhases().map((phase) => ({
        name: phase.name,
        duration: phase.duration,
      })),
    };
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

    // Remove trace object to prevent circular reference
    // The trace captures the payload, which would include itself if not removed
    delete sanitized.trace;

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
