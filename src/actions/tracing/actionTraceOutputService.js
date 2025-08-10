/**
 * @file Service for outputting action traces with browser-compatible storage
 * @see actionTraceFilter.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Service for outputting action traces with queue processing
 */
export class ActionTraceOutputService {
  #storageAdapter;
  #logger;
  #actionTraceFilter;
  #outputQueue;
  #isProcessing;
  #maxQueueSize;
  #writeErrors;
  #storageKey;
  #pendingWrites;
  #writeCount;
  #errorCount;
  #outputHandler;

  /**
   * Constructor
   *
   * @param {object} dependencies
   * @param {object} [dependencies.storageAdapter] - Storage interface for IndexedDB
   * @param {object} [dependencies.logger] - Logger interface
   * @param {object} [dependencies.actionTraceFilter] - Trace filter
   * @param {Function} [dependencies.outputHandler] - Custom output handler function for testing
   */
  constructor({ storageAdapter, logger, actionTraceFilter, outputHandler } = {}) {
    // Validate dependencies if provided
    if (storageAdapter) {
      validateDependency(storageAdapter, 'IStorageAdapter', null, {
        requiredMethods: ['getItem', 'setItem', 'removeItem', 'getAllKeys'],
      });
    }
    if (actionTraceFilter) {
      validateDependency(actionTraceFilter, 'IActionTraceFilter', null, {
        requiredMethods: [
          'shouldTrace',
          'getVerbosityLevel',
          'getInclusionConfig',
        ],
      });
    }

    this.#storageAdapter = storageAdapter;
    this.#logger = ensureValidLogger(logger, 'ActionTraceOutputService');
    this.#actionTraceFilter = actionTraceFilter;

    // Initialize queue management
    this.#outputQueue = [];
    this.#isProcessing = false;
    this.#maxQueueSize = 1000; // Prevent unbounded growth
    this.#writeErrors = 0;
    this.#storageKey = 'actionTraces';

    // Track pending writes for backward compatibility
    this.#pendingWrites = new Set();
    this.#writeCount = 0;
    this.#errorCount = 0;

    // Use custom output handler if provided (for testing), otherwise use default
    this.#outputHandler = outputHandler || this.#defaultOutputHandler.bind(this);

    this.#logger.debug('ActionTraceOutputService initialized');
  }

  /**
   * Write trace to storage asynchronously with queue processing
   *
   * @param {object} trace - Trace to write (ActionExecutionTrace or ActionAwareStructuredTrace)
   * @returns {Promise<void>}
   */
  async writeTrace(trace) {
    if (!trace) {
      this.#logger.warn('ActionTraceOutputService: Null trace provided');
      return;
    }

    // Check if we have storage adapter for new behavior
    if (this.#storageAdapter) {
      // Check queue size to prevent memory issues
      if (this.#outputQueue.length >= this.#maxQueueSize) {
        this.#logger.error(
          `ActionTraceOutputService: Queue full (${this.#maxQueueSize} items), dropping trace`
        );
        return;
      }

      // Add to queue
      this.#outputQueue.push({
        trace,
        timestamp: Date.now(),
        retryCount: 0,
      });

      // Start processing if not already running
      if (!this.#isProcessing) {
        this.#processQueue();
      }
    } else {
      // Fallback to legacy behavior for backward compatibility
      const writePromise = this.#performWrite(trace);
      this.#pendingWrites.add(writePromise);

      try {
        await writePromise;
      } finally {
        this.#pendingWrites.delete(writePromise);
      }
    }
  }

  /**
   * Process queued traces without blocking
   *
   * @private
   */
  async #processQueue() {
    this.#isProcessing = true;

    while (this.#outputQueue.length > 0) {
      const item = this.#outputQueue.shift();

      try {
        await this.#storeTrace(item.trace);
        this.#writeErrors = 0; // Reset error counter on success
      } catch (error) {
        this.#writeErrors++;
        this.#logger.error(
          `ActionTraceOutputService: Failed to store trace (attempt ${item.retryCount + 1})`,
          error
        );

        // Retry logic with exponential backoff
        if (item.retryCount < 3 && this.#writeErrors < 10) {
          item.retryCount++;
          const delay = Math.pow(2, item.retryCount) * 100;

          setTimeout(() => {
            this.#outputQueue.unshift(item); // Add back to front for retry
          }, delay);
        } else {
          this.#logger.error(
            'ActionTraceOutputService: Permanently failed to store trace after retries'
          );
        }

        // Circuit breaker - stop processing if too many consecutive errors
        if (this.#writeErrors >= 10) {
          this.#logger.error(
            'ActionTraceOutputService: Too many storage errors, stopping queue processing'
          );
          break;
        }
      }
    }

    this.#isProcessing = false;

    // Resume processing if items were added during error recovery
    if (this.#outputQueue.length > 0 && this.#writeErrors < 10) {
      setTimeout(() => this.#processQueue(), 1000);
    }
  }

  /**
   * Store single trace in IndexedDB
   *
   * @private
   * @param {object} trace - Trace object to store
   */
  async #storeTrace(trace) {
    if (!this.#storageAdapter) {
      throw new Error('Storage adapter not available');
    }

    // Get existing traces from storage
    const existingTraces =
      (await this.#storageAdapter.getItem(this.#storageKey)) || [];

    // Format trace data
    const traceData = this.#formatTraceData(trace);

    // Add timestamp and ID
    const traceRecord = {
      id: this.#generateTraceId(trace),
      timestamp: Date.now(),
      data: traceData,
    };

    // Add to storage
    existingTraces.push(traceRecord);

    // Limit stored traces (implement rotation in ACTTRA-028)
    const maxStoredTraces = 100;
    if (existingTraces.length > maxStoredTraces) {
      existingTraces.splice(0, existingTraces.length - maxStoredTraces);
    }

    // Save back to storage
    await this.#storageAdapter.setItem(this.#storageKey, existingTraces);

    this.#logger.debug(
      `ActionTraceOutputService: Stored trace ${traceRecord.id}`
    );
  }

  /**
   * Perform the actual write operation
   *
   * @private
   * @param {object} trace - Trace to write
   * @returns {Promise<void>}
   */
  async #performWrite(trace) {
    const startTime = Date.now();

    try {
      // Validate trace has required methods
      if (!trace.toJSON || typeof trace.toJSON !== 'function') {
        throw new Error('Trace must have toJSON() method');
      }

      // Serialize trace data
      const traceData = trace.toJSON();

      // Add write metadata
      const writeData = {
        ...traceData,
        writeMetadata: {
          writtenAt: new Date().toISOString(),
          writeSequence: ++this.#writeCount,
        },
      };

      // Output the trace
      await this.#outputHandler(writeData, trace);

      const duration = Date.now() - startTime;
      this.#logger.debug('Trace written successfully', {
        actionId: trace.actionId,
        actorId: trace.actorId,
        isComplete: trace.isComplete,
        hasError: trace.hasError,
        writeDuration: duration,
        writeSequence: this.#writeCount,
      });
    } catch (error) {
      this.#errorCount++;
      const duration = Date.now() - startTime;

      this.#logger.error('Failed to write trace', {
        error: error.message,
        actionId: trace.actionId || 'unknown',
        actorId: trace.actorId || 'unknown',
        writeDuration: duration,
        errorCount: this.#errorCount,
      });

      // Re-throw to let caller handle if needed
      throw error;
    }
  }

  /**
   * Default output handler - logs trace to console in development
   * In production, this would write to file system or external service
   *
   * @private
   * @param {object} writeData - Serialized trace data with metadata
   * @param {object} trace - Original trace instance
   * @returns {Promise<void>}
   */
  async #defaultOutputHandler(writeData, trace) {
    // In development, log to debug
    // In production, this would write to file or send to monitoring service
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      this.#logger.debug('ACTION_TRACE', {
        actionId: trace.actionId,
        actorId: trace.actorId,
        duration: trace.duration,
        phases: trace.getExecutionPhases ? trace.getExecutionPhases() : [],
        hasError: trace.hasError,
        writeSequence: writeData.writeMetadata.writeSequence,
      });
    }

    // Simulate async write operation
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Wait for all pending writes to complete
   * Useful for graceful shutdown
   *
   * @returns {Promise<void>}
   */
  async waitForPendingWrites() {
    if (this.#pendingWrites.size === 0) {
      return;
    }

    this.#logger.info(
      `Waiting for ${this.#pendingWrites.size} pending trace writes`
    );

    try {
      await Promise.all(this.#pendingWrites);
      this.#logger.info('All pending trace writes completed');
    } catch (error) {
      this.#logger.error('Error waiting for pending writes', error);
    }
  }

  /**
   * Get service statistics
   *
   * @returns {object} Service statistics
   */
  getStatistics() {
    return {
      totalWrites: this.#writeCount,
      totalErrors: this.#errorCount,
      pendingWrites: this.#pendingWrites.size,
      errorRate: this.#writeCount > 0 ? this.#errorCount / this.#writeCount : 0,
    };
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStatistics() {
    this.#writeCount = 0;
    this.#errorCount = 0;
    this.#logger.debug('ActionTraceOutputService statistics reset');
  }

  /**
   * Export traces as downloadable file
   *
   * @param {string} format - 'json' or 'text'
   * @returns {Promise<void>}
   */
  async exportTraces(format = 'json') {
    if (!this.#storageAdapter) {
      this.#logger.warn(
        'ActionTraceOutputService: No storage adapter available for export'
      );
      return;
    }

    const traces = (await this.#storageAdapter.getItem(this.#storageKey)) || [];

    if (traces.length === 0) {
      this.#logger.warn('ActionTraceOutputService: No traces to export');
      return;
    }

    let content;
    let filename;
    let mimeType;

    if (format === 'json') {
      content = JSON.stringify(traces, null, 2);
      filename = `action-traces-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      content = this.#formatTracesAsText(traces);
      filename = `action-traces-${Date.now()}.txt`;
      mimeType = 'text/plain';
    }

    // Create blob and download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    this.#logger.info(
      `ActionTraceOutputService: Exported ${traces.length} traces as ${filename}`
    );
  }

  /**
   * Generate unique ID for trace
   *
   * @private
   * @param {object} trace - Trace object
   * @returns {string} Unique trace ID
   */
  #generateTraceId(trace) {
    const timestamp = Date.now();

    // Extract action ID from trace
    let actionId = 'unknown';
    if (trace.actionId) {
      actionId = trace.actionId;
    } else if (
      trace.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      const tracedActions = trace.getTracedActions();
      if (tracedActions.size > 0) {
        actionId = Array.from(tracedActions.keys())[0];
      }
    }

    // Sanitize action ID
    const sanitizedActionId = actionId.replace(/[^a-zA-Z0-9_-]/g, '-');

    return `${sanitizedActionId}_${timestamp}`;
  }

  /**
   * Format trace data for output
   *
   * @private
   * @param {object} trace - Raw trace object
   * @returns {object} Formatted trace data
   */
  #formatTraceData(trace) {
    // Handle ActionExecutionTrace
    if (trace.toJSON && typeof trace.toJSON === 'function') {
      return trace.toJSON();
    }

    // Handle ActionAwareStructuredTrace
    if (
      trace.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      return this.#formatStructuredTrace(trace);
    }

    // Fallback for unknown trace types
    return {
      timestamp: new Date().toISOString(),
      type: 'unknown',
      data: trace,
    };
  }

  /**
   * Format structured trace for output
   *
   * @private
   * @param {object} trace - Structured trace
   * @returns {object} Formatted data
   */
  #formatStructuredTrace(trace) {
    const tracedActions = trace.getTracedActions();
    const result = {
      timestamp: new Date().toISOString(),
      traceType: 'pipeline',
      spans: trace.getSpans ? trace.getSpans() : [],
      actions: {},
    };

    // Convert Map to object for JSON serialization
    for (const [actionId, data] of tracedActions) {
      result.actions[actionId] = {
        ...data,
        stageOrder: Object.keys(data.stages || {}),
        totalDuration: this.#calculateTotalDuration(data),
      };
    }

    return result;
  }

  /**
   * Calculate total duration from stage data
   *
   * @private
   * @param {object} actionData - Action trace data
   * @returns {number} Total duration in ms
   */
  #calculateTotalDuration(actionData) {
    if (!actionData.stages) return 0;

    const timestamps = Object.values(actionData.stages)
      .map((stage) => stage.timestamp)
      .filter((ts) => ts);

    if (timestamps.length < 2) return 0;

    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  /**
   * Format traces as human-readable text
   *
   * @private
   * @param {Array} traces - Array of trace records
   * @returns {string} Human-readable text
   */
  #formatTracesAsText(traces) {
    // This will be fully implemented in ACTTRA-027
    // For now, return formatted JSON
    return traces
      .map((trace) => {
        return (
          `=== Trace: ${trace.id} ===\n` +
          `Timestamp: ${new Date(trace.timestamp).toISOString()}\n` +
          `Data:\n${JSON.stringify(trace.data, null, 2)}\n`
        );
      })
      .join('\n\n');
  }

  /**
   * Get queue statistics
   *
   * @returns {object} Queue stats
   */
  getQueueStats() {
    return {
      queueLength: this.#outputQueue.length,
      isProcessing: this.#isProcessing,
      writeErrors: this.#writeErrors,
      maxQueueSize: this.#maxQueueSize,
    };
  }

  /**
   * Flush remaining traces and cleanup
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.#logger.info(
      'ActionTraceOutputService: Shutting down, flushing queue...'
    );

    // Process remaining items if storage adapter is available
    if (this.#storageAdapter && this.#outputQueue.length > 0) {
      await this.#processQueue();
    }

    // Wait for processing to complete
    while (this.#isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Wait for legacy pending writes
    if (this.#pendingWrites.size > 0) {
      await this.waitForPendingWrites();
    }

    this.#logger.info('ActionTraceOutputService: Shutdown complete');
  }
}
