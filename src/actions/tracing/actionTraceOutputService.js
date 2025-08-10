/**
 * @file ActionTraceOutputService - Handles writing action execution traces
 * @description Service responsible for outputting action traces asynchronously
 * without blocking action execution. Provides serialization and write operations.
 */

import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Service for outputting action execution traces
 * Handles async writing and serialization of trace data
 */
export class ActionTraceOutputService {
  #logger;
  #outputHandler;
  #pendingWrites;
  #writeCount;
  #errorCount;

  /**
   * @param {object} options - Service configuration
   * @param {object} [options.logger] - Logger instance
   * @param {Function} [options.outputHandler] - Custom output handler function
   */
  constructor({ logger, outputHandler } = {}) {
    this.#logger = ensureValidLogger(logger, 'ActionTraceOutputService');

    // Allow custom output handler for testing or alternative output methods
    this.#outputHandler =
      outputHandler || this.#defaultOutputHandler.bind(this);

    // Track pending writes for graceful shutdown
    this.#pendingWrites = new Set();
    this.#writeCount = 0;
    this.#errorCount = 0;

    this.#logger.debug('ActionTraceOutputService initialized');
  }

  /**
   * Write execution trace asynchronously
   * Never throws - errors are logged internally
   *
   * @param {object} trace - ActionExecutionTrace instance to write
   * @returns {Promise<void>} Resolves when write completes or fails
   */
  async writeTrace(trace) {
    if (!trace) {
      this.#logger.warn(
        'ActionTraceOutputService: Received null/undefined trace'
      );
      return;
    }

    // Create write promise
    const writePromise = this.#performWrite(trace);

    // Track pending write
    this.#pendingWrites.add(writePromise);

    try {
      await writePromise;
    } finally {
      // Remove from pending regardless of success/failure
      this.#pendingWrites.delete(writePromise);
    }
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
}
