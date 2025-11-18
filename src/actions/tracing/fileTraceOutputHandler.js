/**
 * @file File-based trace output handler for browser environments
 * @description Handles writing trace files using File System Access API or fallback to downloads
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { getEndpointConfig } from '../../config/endpointConfig.js';

/**
 * Handles file-based output of trace data in browser environments
 * Uses File System Access API when available, falls back to downloads
 */
class FileTraceOutputHandler {
  #logger;
  #outputDirectory;
  #traceDirectoryManager;
  #rootDirectoryHandle;
  #tracesDirectoryHandle;
  #isInitialized = false;
  #queuedTraces = [];
  #isProcessingQueue = false;
  #batchWriteCount = 0;
  #batchedTraceCount = 0;
  #batchSuccesses = 0;
  #testMode = false;
  #batchWriter;

  /**
   * Create a new FileTraceOutputHandler
   * 
   * @param {object} dependencies - Dependency injection object
   * @param {string} dependencies.outputDirectory - Directory path for trace output
   * @param {object} dependencies.traceDirectoryManager - Directory manager for file operations
   * @param {object} dependencies.logger - Logger instance
   * @param {boolean} dependencies.testMode - Enable test mode to disable network calls
   * @param {object} [dependencies.queueImplementation] - Optional custom queue implementation
   * @param {Function} [dependencies.batchWriter] - Optional batch writer override
   */
  constructor({
    outputDirectory,
    traceDirectoryManager,
    logger,
    testMode = false,
    queueImplementation,
    batchWriter,
  } = {}) {
    this.#logger = ensureValidLogger(logger, 'FileTraceOutputHandler');
    this.#outputDirectory = outputDirectory || './traces';
    this.#testMode = testMode;

    if (traceDirectoryManager) {
      validateDependency(
        traceDirectoryManager,
        'ITraceDirectoryManager',
        null,
        {
          requiredMethods: ['selectDirectory', 'ensureSubdirectoryExists'],
        }
      );
      this.#traceDirectoryManager = traceDirectoryManager;
    }

    if (queueImplementation) {
      validateDependency(queueImplementation, 'ITraceQueue', this.#logger, {
        requiredMethods: ['push', 'shift'],
      });

      if (!Object.prototype.hasOwnProperty.call(queueImplementation, 'length')) {
        throw new Error(
          "Invalid trace queue implementation: missing required 'length' property."
        );
      }

      const queueLength = queueImplementation.length;
      if (typeof queueLength !== 'number' || Number.isNaN(queueLength)) {
        throw new Error(
          "Invalid trace queue implementation: 'length' property must resolve to a number."
        );
      }

      this.#queuedTraces = queueImplementation;
    }

    if (batchWriter) {
      validateDependency(batchWriter, 'BatchWriter', this.#logger, {
        isFunction: true,
      });
      this.#batchWriter = batchWriter;
    }

    this.#logger.debug('FileTraceOutputHandler initialized', {
      outputDirectory: this.#outputDirectory,
      hasDirectoryManager: !!this.#traceDirectoryManager,
    });
  }

  /**
   * Initialize the file output system
   *
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.#isInitialized) {
      return true;
    }

    try {
      // Check if File System Access API is supported
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        this.#logger.info(
          'File System Access API supported - traces can be saved to filesystem'
        );
      } else {
        this.#logger.info(
          'File System Access API not supported - will use download fallback'
        );
      }

      this.#isInitialized = true;
      return true;
    } catch (error) {
      this.#logger.error('Failed to initialize FileTraceOutputHandler', error);
      return false;
    }
  }

  /**
   * Write a trace to file system
   *
   * @param {object} traceData - Formatted trace data
   * @param {object} originalTrace - Original trace object
   * @returns {Promise<boolean>} Success status
   */
  async writeTrace(traceData, originalTrace) {
    // CRITICAL DEBUG: Log every call to writeTrace - DISABLED
    // Debug logging removed - was causing log pollution

    if (!this.#isInitialized) {
      await this.initialize();
    }

    try {
      // Queue the trace for processing
      this.#queuedTraces.push({
        traceData,
        originalTrace,
        timestamp: Date.now(),
      });

      this.#logger.debug(
        'FileTraceOutputHandler: Trace queued for processing',
        {
          actionId: originalTrace?.actionId,
          actorId: originalTrace?.actorId,
          queueLength: this.#queuedTraces.length,
        }
      );

      // Start processing if not already running
      if (!this.#isProcessingQueue) {
        this.#processTraceQueue();
      }

      return true;
    } catch (error) {
      this.#logger.error('Failed to queue trace for writing', error);
      return false;
    }
  }

  /**
   * Write multiple traces in a single batch operation
   *
   * @param {Array<{content: string, fileName: string, originalTrace: object}>} traceBatch - Batch of traces
   * @returns {Promise<boolean>} Success status
   */
  async writeBatch(traceBatch) {
    if (!Array.isArray(traceBatch) || traceBatch.length === 0) {
      this.#logger.error('writeBatch requires non-empty array');
      return false;
    }

    this.#logger.debug('Writing trace batch', {
      batchSize: traceBatch.length,
      fileNames: traceBatch.map((t) =>
        this.#generateFileName(t.originalTrace, Date.now())
      ),
    });

    if (!this.#isInitialized) {
      await this.initialize();
    }

    try {
      this.#batchWriteCount++;
      this.#batchedTraceCount += traceBatch.length;

      // Try batch endpoint first
      const batchResult = await (this.#batchWriter
        ? this.#batchWriter(traceBatch)
        : this.#writeBatchToServer(traceBatch));

      if (batchResult === true) {
        // Batch endpoint succeeded
        this.#batchSuccesses++;
        return true;
      } else if (batchResult === 'fallback') {
        // Batch endpoint returned 404, fallback to individual writes
        this.#logger.info(
          'Batch endpoint unavailable, falling back to individual writes'
        );
        const writePromises = traceBatch.map(({ content, originalTrace }) =>
          this.writeTrace(content, originalTrace)
        );

        const results = await Promise.allSettled(writePromises);
        const successes = results.filter(
          (r) => r.status === 'fulfilled' && r.value === true
        );

        // Only consider this a success if at least one write succeeded
        if (successes.length > 0) {
          this.#batchSuccesses++;
          return true;
        }
      }

      // Batch failed and no fallback needed
      return false;
    } catch (error) {
      this.#logger.error('Failed to write trace batch', {
        error: error.message,
        batchSize: traceBatch.length,
      });
      return false;
    }
  }

  /**
   * Process queued traces
   *
   * @private
   */
  async #processTraceQueue() {
    if (this.#isProcessingQueue || this.#queuedTraces.length === 0) {
      return;
    }

    this.#isProcessingQueue = true;

    try {
      while (this.#queuedTraces.length > 0) {
        const { traceData, originalTrace, timestamp } =
          this.#queuedTraces.shift();
        await this.#writeTraceToFile(traceData, originalTrace, timestamp);
      }
    } catch (error) {
      this.#logger.error('Error processing trace queue', error);
    } finally {
      this.#isProcessingQueue = false;
    }
  }

  /**
   * Check if the trace queue is empty and not processing
   * Used for testing and synchronization
   *
   * @returns {boolean} True if queue is empty and not processing
   */
  isQueueEmpty() {
    return this.#queuedTraces.length === 0 && !this.#isProcessingQueue;
  }

  /**
   * Write individual trace to file
   *
   * @private
   * @param {object} traceData - Formatted trace data
   * @param {object} originalTrace - Original trace object
   * @param {number} timestamp - Write timestamp
   */
  async #writeTraceToFile(traceData, originalTrace, timestamp) {
    try {
      const fileName = this.#generateFileName(originalTrace, timestamp);
      const fileContent = this.#formatTraceContent(traceData, originalTrace);

      this.#logger.debug('FileTraceOutputHandler: Writing trace to file', {
        fileName,
        actionId: originalTrace?.actionId,
        actorId: originalTrace?.actorId,
        outputDirectory: this.#outputDirectory,
      });

      // Try server endpoint first if available
      if (await this.#writeUsingServerEndpoint(fileName, fileContent)) {
        this.#logger.debug(`Trace written via server endpoint: ${fileName}`);
        return;
      }

      // Try File System Access API as second option
      if (await this.#writeUsingFileSystemAPI(fileName, fileContent)) {
        this.#logger.debug(`Trace written to file system: ${fileName}`);
        return;
      }

      // Fall back to download
      this.#downloadTrace(fileName, fileContent);
      this.#logger.debug(`Trace downloaded as file: ${fileName}`);
    } catch (error) {
      this.#logger.error('Failed to write trace to file', {
        error: error.message,
        actionId: originalTrace?.actionId,
        actorId: originalTrace?.actorId,
      });
    }
  }

  /**
   * Attempt to write using server endpoint
   *
   * @private
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   * @returns {Promise<boolean>} Success status
   */
  async #writeUsingServerEndpoint(fileName, content) {
    try {
      // Skip network calls in test mode
      if (this.#testMode) {
        this.#logger.debug('FileTraceOutputHandler: Skipping server endpoint in test mode');
        return true; // Simulate successful write
      }

      // Check if we're in a browser environment and have fetch available
      if (typeof window === 'undefined' || !window.fetch) {
        this.#logger.warn(
          'FileTraceOutputHandler: Not in browser environment or fetch unavailable',
          {
            hasWindow: typeof window !== 'undefined',
            hasFetch: typeof window !== 'undefined' && !!window.fetch,
            environment: typeof window !== 'undefined' ? 'browser' : 'node',
          }
        );
        return false;
      }

      this.#logger.debug(
        'FileTraceOutputHandler: Attempting to write trace via server endpoint',
        {
          fileName,
          outputDirectory: this.#outputDirectory,
          contentLength: content.length,
        }
      );

      // Prepare the request to the LLM proxy server
      const requestBody = {
        traceData: content,
        fileName: fileName,
        outputDirectory: this.#outputDirectory,
      };

      this.#logger.debug('FileTraceOutputHandler: Sending POST to server', {
        url: getEndpointConfig().getTracesWriteEndpoint(),
        bodySize: JSON.stringify(requestBody).length,
      });

      const response = await fetch(
        getEndpointConfig().getTracesWriteEndpoint(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.#logger.error(
          'FileTraceOutputHandler: Server endpoint write failed',
          {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error || 'Unknown error',
            details: errorData.details || 'No details',
          }
        );
        return false;
      }

      const result = await response.json();
      this.#logger.debug(
        'FileTraceOutputHandler: Trace written to server successfully',
        {
          path: result.path,
          size: result.size,
          fileName: result.fileName,
        }
      );

      return true;
    } catch (error) {
      this.#logger.error(
        'FileTraceOutputHandler: Failed to write to server endpoint',
        {
          error: error.message,
          stack: error.stack,
          fileName,
        }
      );

      // Log specific error types for better debugging
      if (error.message.includes('Failed to fetch')) {
        this.#logger.error(
          `FileTraceOutputHandler: Server appears to be offline or unreachable at ${getEndpointConfig().getBaseUrl()}`
        );
      } else if (error.message.includes('CORS')) {
        this.#logger.error(
          'FileTraceOutputHandler: CORS error - check server CORS configuration'
        );
      }

      return false;
    }
  }

  /**
   * Attempt batch write to server endpoint
   *
   * @private
   * @param {Array} traceBatch - Batch of traces
   * @returns {Promise<boolean|string>} Success status or 'fallback' for 404 errors
   */
  async #writeBatchToServer(traceBatch) {
    if (typeof window === 'undefined' || !window.fetch) {
      return false;
    }

    try {
      // Prepare batch payload for new endpoint
      const batchPayload = traceBatch.map(({ content, originalTrace }) => ({
        traceData: content,
        fileName: this.#generateFileName(originalTrace, Date.now()),
        originalTrace: {
          actionId: originalTrace?.actionId,
          actorId: originalTrace?.actorId,
          _outputFormat: originalTrace?._outputFormat,
        },
      }));

      const requestBody = {
        traces: batchPayload,
        outputDirectory: this.#outputDirectory,
      };

      this.#logger.info(
        'FileTraceOutputHandler: Attempting batch write to server',
        {
          batchSize: traceBatch.length,
          endpoint: getEndpointConfig().getTracesWriteBatchEndpoint(),
        }
      );

      const response = await fetch(
        getEndpointConfig().getTracesWriteBatchEndpoint(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        // If batch endpoint doesn't exist (404), return 'fallback' to trigger individual writes
        if (response.status === 404) {
          this.#logger.debug('Batch endpoint not available, using fallback');
          return 'fallback';
        }

        const errorData = await response.json().catch(() => ({}));
        this.#logger.error('Batch write failed', {
          status: response.status,
          error: errorData.error || 'Unknown error',
        });
        return false;
      }

      const result = await response.json();
      this.#logger.info('Batch write successful', {
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
        totalSize: result.totalSize || 0,
      });

      return result.success === true;
    } catch (error) {
      this.#logger.error('Batch server write failed', {
        error: error.message,
        batchSize: traceBatch.length,
      });
      return false;
    }
  }

  /**
   * Attempt to write using File System Access API
   *
   * @private
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   * @returns {Promise<boolean>} Success status
   */
  async #writeUsingFileSystemAPI(fileName, content) {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      return false;
    }

    try {
      // Lazy initialization of directory handle
      if (!this.#tracesDirectoryHandle) {
        await this.#ensureDirectoryHandle();
      }

      if (!this.#tracesDirectoryHandle) {
        return false;
      }

      // Write the file
      const fileHandle = await this.#tracesDirectoryHandle.getFileHandle(
        fileName,
        {
          create: true,
        }
      );

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      return true;
    } catch (error) {
      this.#logger.debug(
        'File System API write failed, will use download fallback',
        error.message
      );
      return false;
    }
  }

  /**
   * Ensure directory handle is available
   *
   * @private
   */
  async #ensureDirectoryHandle() {
    try {
      if (!this.#traceDirectoryManager) {
        return;
      }

      // This would prompt user to select directory on first use
      this.#rootDirectoryHandle =
        await this.#traceDirectoryManager.selectDirectory();

      if (this.#rootDirectoryHandle) {
        // Create traces subdirectory
        this.#tracesDirectoryHandle =
          await this.#traceDirectoryManager.ensureSubdirectoryExists(
            this.#rootDirectoryHandle,
            'traces'
          );
      }
    } catch (error) {
      this.#logger.debug('Could not establish directory handle', error.message);
    }
  }

  /**
   * Download trace as file (fallback method)
   *
   * @private
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   */
  #downloadTrace(fileName, content) {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      this.#logger.error('Failed to download trace file', error);
    }
  }

  /**
   * Generate filename for trace
   *
   * @private
   * @param {object} trace - Original trace object
   * @param {number} timestamp - Write timestamp
   * @param {string} [format] - Output format
   * @returns {string} Generated filename
   */
  #generateFileName(trace, timestamp, format = 'json') {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().replace(/:/g, '-').replace(/\./g, '_');

    const actionId = trace?.actionId || 'unknown';
    const actorId = trace?.actorId || 'unknown';

    // Handle format indicator
    const outputFormat = trace?._outputFormat || format;

    // Extension based on format
    const extension = outputFormat === 'text' ? 'txt' : 'json';

    // Create safe filename
    const safeActionId = actionId.replace(/[^a-z0-9_-]/gi, '_');
    const safeActorId = actorId.replace(/[^a-z0-9_-]/gi, '_');

    return `trace_${safeActionId}_${safeActorId}_${dateStr}.${extension}`;
  }

  /**
   * Format trace content for file output
   *
   * @private
   * @param {object} traceData - Formatted trace data
   * @param {object} originalTrace - Original trace object
   * @returns {string} Formatted content
   */
  #formatTraceContent(traceData, originalTrace) {
    // Check if this is text format
    if (originalTrace?._outputFormat === 'text') {
      // For text format, return the data as-is (already formatted as text)
      return typeof traceData === 'string'
        ? traceData
        : JSON.stringify(traceData, null, 2);
    }

    // For JSON format, wrap with metadata
    const output = {
      timestamp: new Date().toISOString(),
      outputDirectory: this.#outputDirectory,
      trace: traceData,
      metadata: {
        actionId: originalTrace?.actionId,
        actorId: originalTrace?.actorId,
        isComplete: originalTrace?.isComplete,
        hasError: originalTrace?.hasError,
        generatedBy: 'Living Narrative Engine Action Tracing System',
      },
    };

    return JSON.stringify(output, null, 2);
  }

  /**
   * Get enhanced statistics including batch operations
   *
   * @returns {object} Statistics
   */
  getStatistics() {
    return {
      ...this.#getBaseStatistics(),
      batchOperations: {
        totalBatches: this.#batchWriteCount || 0,
        totalBatchedTraces: this.#batchedTraceCount || 0,
        batchSuccessRate: this.#calculateBatchSuccessRate(),
        avgBatchSize: this.#calculateAverageBatchSize(),
      },
    };
  }

  #getBaseStatistics() {
    return {
      isInitialized: this.#isInitialized,
      outputDirectory: this.#outputDirectory,
      queuedTraces: this.#queuedTraces.length,
      isProcessingQueue: this.#isProcessingQueue,
      hasDirectoryManager: !!this.#traceDirectoryManager,
      hasDirectoryHandle: !!this.#tracesDirectoryHandle,
      supportsFileSystemAPI:
        typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    };
  }

  #calculateBatchSuccessRate() {
    if (this.#batchWriteCount === 0) {
      return 0;
    }
    return (this.#batchSuccesses / this.#batchWriteCount) * 100;
  }

  #calculateAverageBatchSize() {
    if (this.#batchWriteCount === 0) {
      return 0;
    }
    return this.#batchedTraceCount / this.#batchWriteCount;
  }

  /**
   * Set output directory
   *
   * @param {string} directory - New output directory
   */
  setOutputDirectory(directory) {
    this.#outputDirectory = directory;
    this.#logger.debug(`Output directory set to: ${directory}`);

    // Reset directory handles to force re-initialization
    this.#rootDirectoryHandle = null;
    this.#tracesDirectoryHandle = null;
  }
}

export default FileTraceOutputHandler;
