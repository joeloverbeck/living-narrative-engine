/**
 * @file Service for outputting action traces with browser-compatible storage
 * @see actionTraceFilter.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { TraceQueueProcessor } from './traceQueueProcessor.js';
import { TracePriority, DEFAULT_PRIORITY } from './tracePriority.js';
import { StorageRotationManager } from './storageRotationManager.js';
import {
  TraceIdGenerator,
  NamingStrategy,
  TimestampFormat,
} from './traceIdGenerator.js';
import { defaultTimerService } from './timerService.js';

// Re-export from traceIdGenerator for backward compatibility
export { NamingStrategy, TimestampFormat } from './traceIdGenerator.js';

/**
 * Service for outputting action traces with queue processing
 */
export class ActionTraceOutputService {
  #storageAdapter;
  #logger;
  #actionTraceFilter;
  #jsonFormatter;
  #humanReadableFormatter;
  #outputQueue;
  #isProcessing;
  #maxQueueSize;
  #writeErrors;
  #storageKey;
  #pendingWrites;
  #writeCount;
  #errorCount;
  #outputHandler;
  #queueProcessor;
  #eventBus;
  #rotationManager;
  #idGenerator;
  #namingOptions;
  #traceDirectoryManager;
  #exportInProgress;
  #timerService;

  /**
   * Constructor
   *
   * @param {object} dependencies
   * @param {object} [dependencies.storageAdapter] - Storage interface for IndexedDB
   * @param {object} [dependencies.logger] - Logger interface
   * @param {object} [dependencies.actionTraceFilter] - Trace filter
   * @param {object} [dependencies.jsonFormatter] - JSON trace formatter
   * @param {object} [dependencies.humanReadableFormatter] - Human-readable trace formatter
   * @param {Function} [dependencies.outputHandler] - Custom output handler function for testing
   * @param {object} [dependencies.eventBus] - Event bus for queue notifications
   * @param {object} [dependencies.queueConfig] - Queue processor configuration
   * @param {object} [dependencies.namingOptions] - Naming convention options
   * @param {object} [dependencies.traceDirectoryManager] - Directory manager for file exports
   * @param {object} [dependencies.timerService] - Timer service for scheduling operations
   */
  constructor({
    storageAdapter,
    logger,
    actionTraceFilter,
    jsonFormatter,
    humanReadableFormatter,
    outputHandler,
    eventBus,
    queueConfig,
    namingOptions = {},
    traceDirectoryManager,
    timerService,
  } = {}) {
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
    if (jsonFormatter) {
      validateDependency(jsonFormatter, 'IJsonTraceFormatter', null, {
        requiredMethods: ['format'],
      });
    }
    if (humanReadableFormatter) {
      validateDependency(
        humanReadableFormatter,
        'IHumanReadableFormatter',
        null,
        {
          requiredMethods: ['format'],
        }
      );
    }
    if (traceDirectoryManager) {
      validateDependency(
        traceDirectoryManager,
        'ITraceDirectoryManager',
        null,
        {
          requiredMethods: ['selectDirectory', 'ensureSubdirectoryExists'],
        }
      );
    }

    this.#storageAdapter = storageAdapter;
    this.#logger = ensureValidLogger(logger, 'ActionTraceOutputService');
    this.#actionTraceFilter = actionTraceFilter;
    this.#jsonFormatter = jsonFormatter;
    this.#humanReadableFormatter = humanReadableFormatter;
    this.#eventBus = eventBus;
    this.#traceDirectoryManager = traceDirectoryManager;
    this.#exportInProgress = false;

    // Store naming options for later use
    this.#namingOptions = namingOptions || {};

    // Initialize ID generator with naming options
    this.#idGenerator = new TraceIdGenerator(this.#namingOptions);

    // Use provided timerService or extract from queueConfig, or use default
    this.#timerService =
      timerService ||
      (queueConfig && queueConfig.timerService) ||
      defaultTimerService;

    // Extract timerService from queueConfig if provided (used by both queue processor and rotation manager)
    const { timerService: configTimerService, ...remainingConfig } =
      queueConfig || {};

    // Initialize queue processing system
    if (this.#storageAdapter && typeof TraceQueueProcessor !== 'undefined') {
      // Use advanced queue processor with naming options
      this.#queueProcessor = new TraceQueueProcessor({
        storageAdapter: this.#storageAdapter,
        logger: this.#logger,
        eventBus: this.#eventBus,
        timerService: this.#timerService,
        config: remainingConfig,
        namingOptions: this.#namingOptions,
      });

      this.#logger.debug(
        'ActionTraceOutputService initialized with TraceQueueProcessor',
        this.#namingOptions
      );
    } else {
      // Fall back to simple queue implementation
      this.#outputQueue = [];
      this.#isProcessing = false;
      this.#maxQueueSize = 1000; // Prevent unbounded growth
      this.#writeErrors = 0;
      this.#storageKey = 'actionTraces';

      this.#logger.debug(
        'ActionTraceOutputService initialized with simple queue',
        this.#namingOptions
      );
    }

    // Track pending writes for backward compatibility
    this.#pendingWrites = new Set();
    this.#writeCount = 0;
    this.#errorCount = 0;

    // Use custom output handler if provided (for testing), otherwise use default
    this.#outputHandler =
      outputHandler || this.#defaultOutputHandler.bind(this);

    // Initialize rotation manager if storage adapter is available
    if (this.#storageAdapter && typeof StorageRotationManager !== 'undefined') {
      // Get configuration from filter or use defaults
      const rotationConfig = {
        rotationPolicy: 'count', // Default to count-based
        maxAge: 86400000, // 24 hours
        maxTraceCount: 100,
        maxStorageSize: 10 * 1024 * 1024, // 10MB
        compressionEnabled: true,
        preserveCount: 10,
        preservePattern: null,
      };

      try {
        this.#rotationManager = new StorageRotationManager({
          storageAdapter: this.#storageAdapter,
          logger: this.#logger,
          config: rotationConfig,
          timerService: this.#timerService,
        });

        this.#logger.debug(
          'ActionTraceOutputService: Initialized with StorageRotationManager'
        );
      } catch (error) {
        this.#logger.warn(
          'ActionTraceOutputService: Failed to initialize StorageRotationManager',
          error
        );
      }
    }
  }

  /**
   * Write trace to storage asynchronously with queue processing
   *
   * @param {object} trace - Trace to write (ActionExecutionTrace or ActionAwareStructuredTrace)
   * @param {number} [priority] - Priority level for advanced queue processor
   * @returns {Promise<void>}
   */
  async writeTrace(trace, priority) {
    if (!trace) {
      this.#logger.warn('ActionTraceOutputService: Null trace provided');
      return;
    }

    // Use advanced queue processor if available
    if (this.#queueProcessor) {
      const success = this.#queueProcessor.enqueue(trace, priority);
      if (!success) {
        this.#logger.warn('ActionTraceOutputService: Failed to enqueue trace');
      }
      return;
    }

    // Check if we have storage adapter for simple queue behavior
    if (this.#storageAdapter && this.#outputQueue) {
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
        // Use timer service to ensure async processing with Jest fake timers
        this.#timerService.setTimeout(() => this.#processQueue(), 0);
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

          this.#timerService.setTimeout(() => {
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
      this.#timerService.setTimeout(() => this.#processQueue(), 1000);
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

    // Increment write counter for statistics
    this.#writeCount++;

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

    // Check if rotation needed (async, non-blocking)
    if (this.#rotationManager && existingTraces.length > 100) {
      this.#rotationManager.forceRotation().catch((error) => {
        this.#logger.error('Background rotation failed', error);
      });
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
   * Get rotation statistics
   *
   * @returns {Promise<object|null>} Rotation statistics or null if not available
   */
  async getRotationStatistics() {
    if (this.#rotationManager) {
      return this.#rotationManager.getStatistics();
    }
    return null;
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
   * Export traces from IndexedDB to user's file system using File System Access API
   *
   * @param {Array<string>} [traceIds] - IDs of specific traces to export (optional, exports all if not provided)
   * @param {string} [format] - Export format ('json' or 'text')
   * @returns {Promise<object>} Export result with status and details
   */
  async exportTracesToFileSystem(traceIds = null, format = 'json') {
    // Check if File System Access API is supported
    if (!this.#traceDirectoryManager || !window.showDirectoryPicker) {
      this.#logger.warn(
        'File System Access API not supported, falling back to download'
      );
      return this.exportTracesAsDownload(format);
    }

    if (this.#exportInProgress) {
      throw new Error('Export already in progress');
    }

    this.#exportInProgress = true;
    const startTime = Date.now();

    try {
      // Step 1: Prompt user to select export directory
      const directoryHandle =
        await this.#traceDirectoryManager.selectDirectory();

      if (!directoryHandle) {
        return {
          success: false,
          reason: 'User cancelled directory selection',
          duration: Date.now() - startTime,
        };
      }

      // Step 2: Create export subdirectory with timestamp
      const exportDirName = `traces_${new Date().toISOString().split('T')[0]}_${Date.now()}`;
      const exportDir =
        await this.#traceDirectoryManager.ensureSubdirectoryExists(
          directoryHandle,
          exportDirName
        );

      if (!exportDir) {
        return {
          success: false,
          reason: 'Failed to create export directory',
          duration: Date.now() - startTime,
        };
      }

      // Step 3: Get traces from IndexedDB
      const traces = await this.#getTracesForExport(traceIds);

      if (traces.length === 0) {
        return {
          success: false,
          reason: 'No traces found to export',
          duration: Date.now() - startTime,
        };
      }

      // Step 4: Export each trace to a file
      const exportResults = [];
      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i];
        const progress = ((i + 1) / traces.length) * 100;

        // Dispatch progress event if event bus available
        if (this.#eventBus) {
          this.#eventBus.dispatch({
            type: 'TRACE_EXPORT_PROGRESS',
            payload: {
              progress,
              current: i + 1,
              total: traces.length,
            },
          });
        }

        try {
          const fileName = this.#generateExportFileName(trace, format);
          const fileContent =
            format === 'json'
              ? this.#formatTraceAsJSON(trace)
              : this.#formatTraceAsText(trace);

          // Write file using File System Access API
          await this.#writeTraceToFile(exportDir, fileName, fileContent);

          exportResults.push({
            traceId: trace.id,
            fileName,
            success: true,
          });
        } catch (error) {
          this.#logger.error(`Failed to export trace ${trace.id}`, error);
          exportResults.push({
            traceId: trace.id,
            success: false,
            error: error.message,
          });
        }
      }

      // Step 5: Generate export summary
      const successCount = exportResults.filter((r) => r.success).length;

      return {
        success: true,
        totalTraces: traces.length,
        exportedCount: successCount,
        failedCount: traces.length - successCount,
        exportPath: exportDirName,
        results: exportResults,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.#logger.error('Export failed', error);

      // Handle specific errors
      if (error.name === 'AbortError') {
        return {
          success: false,
          reason: 'User denied file system access',
          duration: Date.now() - startTime,
        };
      }

      throw error;
    } finally {
      this.#exportInProgress = false;
    }
  }

  /**
   * Export traces as downloadable file (fallback for browsers without File System Access API)
   *
   * @param {string} format - 'json' or 'text'
   * @returns {Promise<object>} Export result
   */
  async exportTracesAsDownload(format = 'json') {
    if (!this.#storageAdapter) {
      this.#logger.warn(
        'ActionTraceOutputService: No storage adapter available for export'
      );
      return {
        success: false,
        reason: 'No storage adapter available',
      };
    }

    // Prevent concurrent exports (same as exportTracesToFileSystem)
    if (this.#exportInProgress) {
      throw new Error('Export already in progress');
    }

    this.#exportInProgress = true;
    const startTime = Date.now();

    try {
      const traces =
        (await this.#storageAdapter.getItem(this.#storageKey)) || [];

      if (traces.length === 0) {
        this.#logger.warn('ActionTraceOutputService: No traces to export');
        return {
          success: false,
          reason: 'No traces to export',
        };
      }

      let content;
      let filename;
      let mimeType;

      if (format === 'json') {
        // Use JsonTraceFormatter for each trace if available
        if (this.#jsonFormatter) {
          const formattedTraces = traces.map((traceRecord) => {
            try {
              const formattedJson = this.#jsonFormatter.format(
                traceRecord.data
              );
              return {
                ...traceRecord,
                data: JSON.parse(formattedJson),
              };
            } catch (error) {
              this.#logger.warn('Failed to format trace during export', error);
              return traceRecord;
            }
          });
          content = JSON.stringify(formattedTraces, null, 2);
        } else {
          content = JSON.stringify(traces, null, 2);
        }
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

      return {
        success: true,
        totalTraces: traces.length,
        exportedCount: traces.length,
        failedCount: 0,
        fileName: filename,
        method: 'download',
        duration: Date.now() - startTime,
      };
    } finally {
      this.#exportInProgress = false;
    }
  }

  /**
   * Legacy export method - redirects to new implementation
   *
   * @param format
   * @deprecated Use exportTracesToFileSystem or exportTracesAsDownload
   */
  async exportTraces(format = 'json') {
    return this.exportTracesToFileSystem(null, format);
  }

  /**
   * Get traces from IndexedDB storage for export
   *
   * @private
   * @param {Array<string>|null} traceIds - Specific trace IDs to retrieve, or null for all
   * @returns {Promise<Array>} Array of trace records
   */
  async #getTracesForExport(traceIds) {
    if (!this.#storageAdapter) {
      return [];
    }

    const allTraces =
      (await this.#storageAdapter.getItem(this.#storageKey)) || [];

    if (!traceIds || traceIds.length === 0) {
      return allTraces;
    }

    // Filter to specific trace IDs
    return allTraces.filter((trace) => traceIds.includes(trace.id));
  }

  /**
   * Generate file name for exported trace
   *
   * @private
   * @param {object} trace - Trace record
   * @param {string} format - Export format
   * @returns {string} File name
   */
  #generateExportFileName(trace, format) {
    const timestamp = new Date(trace.timestamp || Date.now())
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '_');

    const extension = format === 'json' ? 'json' : 'txt';

    // Extract action type if available
    const actionType = trace.data?.actionType || trace.data?.type || 'trace';

    return `${actionType}_${timestamp}.${extension}`;
  }

  /**
   * Format trace as JSON for export
   *
   * @private
   * @param {object} trace - Trace record
   * @returns {string} JSON string
   */
  #formatTraceAsJSON(trace) {
    if (this.#jsonFormatter && trace.data) {
      try {
        return this.#jsonFormatter.format(trace.data);
      } catch (error) {
        this.#logger.warn('Failed to use JSON formatter, falling back', error);
      }
    }

    return JSON.stringify(trace, null, 2);
  }

  /**
   * Format single trace as text
   *
   * @private
   * @param {object} trace - Trace record
   * @returns {string} Human-readable text
   */
  #formatTraceAsText(trace) {
    let output = `=== Trace ID: ${trace.id} ===\n`;
    output += `Timestamp: ${new Date(trace.timestamp).toISOString()}\n\n`;

    if (this.#humanReadableFormatter && trace.data) {
      try {
        output += this.#humanReadableFormatter.format(trace.data);
      } catch (error) {
        this.#logger.warn(
          'Failed to use human-readable formatter, falling back',
          error
        );
        output += JSON.stringify(trace.data, null, 2);
      }
    } else {
      output += JSON.stringify(trace.data, null, 2);
    }

    return output;
  }

  /**
   * Write trace file using File System Access API
   *
   * @private
   * @param {FileSystemDirectoryHandle} directoryHandle - Directory to write to
   * @param {string} fileName - Name of file
   * @param {string} content - File content
   * @returns {Promise<void>}
   */
  async #writeTraceToFile(directoryHandle, fileName, content) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, {
      create: true,
    });

    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Generate unique ID for trace with configurable naming strategies
   *
   * @private
   * @param {object} trace - Trace object
   * @returns {string} Unique trace ID
   */
  #generateTraceId(trace) {
    // Use the shared ID generator for consistent naming
    return this.#idGenerator.generateId(trace);
  }

  /**
   * Format trace data for output
   *
   * @private
   * @param {object} trace - Raw trace object
   * @returns {object} Formatted trace data
   */
  #formatTraceData(trace) {
    // Use JsonTraceFormatter if available
    if (this.#jsonFormatter) {
      try {
        const jsonString = this.#jsonFormatter.format(trace);
        return JSON.parse(jsonString);
      } catch (error) {
        this.#logger.warn(
          'Failed to use JsonTraceFormatter, falling back to default formatting',
          error
        );
      }
    }

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
    // Use HumanReadableFormatter if available
    if (this.#humanReadableFormatter) {
      return traces
        .map((trace) => {
          try {
            // Format the trace data using the human-readable formatter
            const formattedTrace = this.#humanReadableFormatter.format(
              trace.data
            );
            return (
              `=== Trace ID: ${trace.id} ===\n` +
              `Stored: ${new Date(trace.timestamp).toISOString()}\n\n` +
              formattedTrace
            );
          } catch (error) {
            this.#logger.warn('Failed to format trace as text', error);
            // Fallback to JSON
            return (
              `=== Trace: ${trace.id} ===\n` +
              `Timestamp: ${new Date(trace.timestamp).toISOString()}\n` +
              `Data:\n${JSON.stringify(trace.data, null, 2)}\n`
            );
          }
        })
        .join('\n\n');
    }

    // Fallback to basic formatting
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
    if (this.#queueProcessor) {
      // Return advanced queue processor stats
      const stats = this.#queueProcessor.getQueueStats();
      return {
        queueLength: stats.totalSize,
        isProcessing: stats.isProcessing,
        writeErrors: 0, // Handled internally by queue processor
        maxQueueSize: this.#maxQueueSize || 1000,
        memoryUsage: stats.memoryUsage,
        circuitBreakerOpen: stats.circuitBreakerOpen,
        priorities: stats.priorities,
      };
    }

    // Simple queue stats
    return {
      queueLength: this.#outputQueue ? this.#outputQueue.length : 0,
      isProcessing: this.#isProcessing,
      writeErrors: this.#writeErrors || 0,
      maxQueueSize: this.#maxQueueSize || 1000,
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

    try {
      // Shutdown advanced queue processor if available with timeout
      if (this.#queueProcessor) {
        const shutdownPromise = this.#queueProcessor.shutdown();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Queue processor shutdown timeout')),
            2000
          )
        );

        await Promise.race([shutdownPromise, timeoutPromise]);
      } else {
        // Process remaining items in simple queue if storage adapter is available
        if (
          this.#storageAdapter &&
          this.#outputQueue &&
          this.#outputQueue.length > 0
        ) {
          await this.#processQueue();
        }

        // Wait for processing to complete with timeout
        let waitCount = 0;
        while (this.#isProcessing && waitCount < 20) {
          // Max 2 seconds
          await new Promise((resolve) => setTimeout(resolve, 100));
          waitCount++;
        }
      }

      // Wait for legacy pending writes with timeout
      if (this.#pendingWrites.size > 0) {
        const pendingPromise = this.waitForPendingWrites();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Pending writes timeout')), 1000)
        );

        await Promise.race([pendingPromise, timeoutPromise]);
      }
    } catch (error) {
      this.#logger.warn(
        'ActionTraceOutputService: Shutdown timeout, forcing completion',
        {
          error: error.message,
        }
      );
    }

    // Shutdown rotation manager if available
    if (this.#rotationManager) {
      try {
        this.#rotationManager.shutdown();
      } catch (error) {
        this.#logger.warn(
          'ActionTraceOutputService: Error shutting down rotation manager',
          error
        );
      }
    }

    this.#logger.info('ActionTraceOutputService: Shutdown complete');
  }

  /**
   * Get advanced queue processor metrics (if available)
   *
   * @returns {object|null} Queue processor metrics or null if not available
   */
  getQueueMetrics() {
    if (this.#queueProcessor) {
      return this.#queueProcessor.getMetrics();
    }
    return null;
  }

  /**
   * Convenience method to write trace with priority
   *
   * @param {object} trace - Trace to write
   * @param {number} priority - Priority level (TracePriority constants)
   * @returns {Promise<void>}
   */
  async writeTraceWithPriority(trace, priority = DEFAULT_PRIORITY) {
    return this.writeTrace(trace, priority);
  }
}
