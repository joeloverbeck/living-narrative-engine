/**
 * @file Service for outputting action traces with browser-compatible storage
 * @see actionTraceFilter.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { TraceQueueProcessor } from './traceQueueProcessor.js';
import { DEFAULT_PRIORITY } from './tracePriority.js';
import { StorageRotationManager } from './storageRotationManager.js';
import { TraceIdGenerator } from './traceIdGenerator.js';
import { defaultTimerService } from './timerService.js';
import FileTraceOutputHandler from './fileTraceOutputHandler.js';

// Re-export from traceIdGenerator for backward compatibility
export { NamingStrategy, TimestampFormat } from './traceIdGenerator.js';

/**
 * Service for outputting action traces with queue processing
 */
export class ActionTraceOutputService {
  #storageAdapter;
  #logger;
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
  #fileOutputHandler;
  #outputToFiles;
  #actionTraceConfig;

  /**
   * Constructor
   *
   * @param {object} dependencies - Dependency injection container
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
   * @param {string} [dependencies.outputDirectory] - Directory for file output (enables file output mode)
   * @param {boolean} [dependencies.outputToFiles] - Whether to output traces to files instead of IndexedDB
   * @param {object} [dependencies.actionTraceConfig] - Action trace configuration
   * @param {boolean} [dependencies.testMode] - Enable test mode to disable network calls
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
    outputDirectory,
    outputToFiles = false,
    actionTraceConfig,
    testMode = false,
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
    this.#jsonFormatter = jsonFormatter;
    this.#humanReadableFormatter = humanReadableFormatter;
    this.#eventBus = eventBus;
    this.#traceDirectoryManager = traceDirectoryManager;
    this.#exportInProgress = false;

    // Store configuration
    this.#actionTraceConfig = actionTraceConfig || {
      outputFormats: ['json'],
      textFormatOptions: {},
    };

    // Store naming options for later use
    this.#namingOptions = namingOptions || {};

    // Initialize ID generator with naming options
    this.#idGenerator = new TraceIdGenerator(this.#namingOptions);

    // Use provided timerService or extract from queueConfig, or use default
    this.#timerService =
      timerService ||
      (queueConfig && queueConfig.timerService) ||
      defaultTimerService;

    // Extract remaining config (timerService already extracted above)
    const { timerService: _configTimerService, ...remainingConfig } =
      queueConfig || {};

    // Initialize file output handler if enabled
    this.#outputToFiles = outputToFiles || !!outputDirectory;
    if (this.#outputToFiles) {
      this.#fileOutputHandler = new FileTraceOutputHandler({
        outputDirectory: outputDirectory || './traces',
        traceDirectoryManager: this.#traceDirectoryManager,
        logger: this.#logger,
        testMode: testMode,
      });

      // Initialize the file output handler immediately
      this.#fileOutputHandler
        .initialize()
        .then((success) => {
          if (success) {
            this.#logger.info(
              'FileTraceOutputHandler initialized successfully'
            );
          } else {
            this.#logger.warn('FileTraceOutputHandler initialization failed');
          }
        })
        .catch((error) => {
          this.#logger.error(
            'Error initializing FileTraceOutputHandler',
            error
          );
        });

      this.#logger.debug('ActionTraceOutputService: File output mode enabled', {
        outputDirectory: outputDirectory || './traces',
        hasDirectoryManager: !!this.#traceDirectoryManager,
      });
    }

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
    // CRITICAL DEBUG: Log every call to writeTrace - DISABLED
    // Debug logging removed - was causing log pollution

    if (!trace) {
      this.#logger.warn('ActionTraceOutputService: Null trace provided');
      return;
    }

    // When file output is enabled, bypass queue processor and write directly to files
    if (this.#outputToFiles && this.#fileOutputHandler) {
      this.#logger.debug(
        'ActionTraceOutputService: Using file output mode with formats',
        { formats: this.#actionTraceConfig?.outputFormats || ['json'] }
      );

      // Use multi-format writing
      const writePromise = this.#writeTraceMultiFormat(trace);
      this.#pendingWrites.add(writePromise);

      try {
        await writePromise;
      } finally {
        this.#pendingWrites.delete(writePromise);
      }
      return;
    }

    // Use advanced queue processor if available (for IndexedDB storage)
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
    this.#scheduleQueueResume();
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
   * Schedule queue resume after error recovery
   *
   * @private
   */
  #scheduleQueueResume() {
    if (
      this.#outputQueue &&
      this.#outputQueue.length > 0 &&
      this.#writeErrors < 10
    ) {
      this.#timerService.setTimeout(() => this.#processQueue(), 1000);
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
      // Validate trace has required methods (toJSON or getTracedActions)
      const hasToJSON = trace.toJSON && typeof trace.toJSON === 'function';
      const hasGetTracedActions =
        trace.getTracedActions && typeof trace.getTracedActions === 'function';

      if (!hasToJSON && !hasGetTracedActions) {
        throw new Error(
          'Trace must have either toJSON() or getTracedActions() method'
        );
      }

      // Serialize trace data using the appropriate method
      const traceData = hasToJSON
        ? trace.toJSON()
        : this.#formatTraceData(trace);

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
   * Default output handler - writes to files when enabled, otherwise logs to console
   *
   * @private
   * @param {object} writeData - Serialized trace data with metadata
   * @param {object} trace - Original trace instance
   * @returns {Promise<void>}
   */
  async #defaultOutputHandler(writeData, trace) {
    // CRITICAL DEBUG: Log handler entry - DISABLED
    // Debug logging removed - was causing log pollution

    // Use file output if enabled and available
    if (this.#outputToFiles && this.#fileOutputHandler) {
      try {
        // Debug logging removed - was causing log pollution
        const success = await this.#fileOutputHandler.writeTrace(
          writeData,
          trace
        );
        if (success) {
          this.#logger.debug('Trace written to file', {
            actionId: trace.actionId,
            actorId: trace.actorId,
            writeSequence: writeData.writeMetadata.writeSequence,
          });
          return;
        } else {
          this.#logger.warn(
            'File output failed, falling back to console logging',
            {
              actionId: trace.actionId,
              actorId: trace.actorId,
            }
          );
        }
      } catch (error) {
        this.#logger.error(
          'File output error, falling back to console logging',
          {
            error: error.message,
            actionId: trace.actionId,
            actorId: trace.actorId,
          }
        );
      }
    }

    // Fallback to console logging (original behavior)
    /* global process */
    const isDevelopment =
      typeof process !== 'undefined' &&
      process?.env?.NODE_ENV === 'development';
    const isTest =
      typeof process !== 'undefined' && process?.env?.NODE_ENV === 'test';

    if (isDevelopment || isTest) {
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
   * Write trace in multiple formats
   *
   * @private
   * @param {object} trace - Trace to write
   */
  async #writeTraceMultiFormat(trace) {
    const outputFormats = this.#actionTraceConfig?.outputFormats || ['json'];

    // Write JSON format if configured
    if (outputFormats.includes('json') && this.#fileOutputHandler) {
      const jsonData = this.#formatTraceData(trace);
      await this.#fileOutputHandler.writeTrace(jsonData, trace);
    }

    // Write text format if configured
    if (outputFormats.includes('text') && this.#fileOutputHandler) {
      // Get formatted data first to extract actionId and actorId
      const formattedData = this.#formatTraceData(trace);

      // Extract actionId and actorId from the formatted data
      let actionId, actorId;
      if (formattedData.actions) {
        // For structured traces, get the first action's data
        const firstActionKey = Object.keys(formattedData.actions)[0];
        if (firstActionKey && formattedData.actions[firstActionKey]) {
          actionId = firstActionKey;
          actorId = formattedData.actions[firstActionKey].actorId;
        }
      }

      // Create a modified trace object with text format indicator and proper IDs
      const textTrace = {
        ...trace,
        actionId: actionId || trace.actionId || 'unknown',
        actorId: actorId || trace.actorId || 'unknown',
        _outputFormat: 'text', // Indicator for file handler
      };

      // Format as text (note: can't pass options to formatter)
      const textData = this.#formatTraceAsText({
        id: this.#generateTraceId(trace),
        timestamp: Date.now(),
        data: formattedData,
      });

      await this.#fileOutputHandler.writeTrace(textData, textTrace);
    }
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
   * Wait for file operations to complete (FileTraceOutputHandler queue processing)
   * Essential for accurate memory testing
   *
   * @returns {Promise<void>}
   */
  async waitForFileOperations() {
    if (!this.#fileOutputHandler) {
      return;
    }

    // Wait for the file handler's queue to be processed
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total wait time

    while (attempts < maxAttempts) {
      if (
        this.#fileOutputHandler.isQueueEmpty &&
        this.#fileOutputHandler.isQueueEmpty()
      ) {
        break;
      }

      // Wait 100ms between checks
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      this.#logger.warn(
        'File operations may not have completed within timeout'
      );
    } else {
      this.#logger.debug('File operations completed successfully');
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
          this.#eventBus.dispatch('TRACE_EXPORT_PROGRESS', {
            progress,
            current: i + 1,
            total: traces.length,
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
   * @param {string} [format] - Export format (json or txt), defaults to 'json'
   * @returns {Promise<boolean>} True if export succeeded
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
      spans: trace.getSpans
        ? trace.getSpans().map((span) => this.#serializeSpan(span))
        : [],
      actions: {},
      operatorEvaluations: null, // Will be populated if present
    };

    // Convert Map to object for JSON serialization
    for (const [actionId, data] of tracedActions) {
      // Check if this is operator evaluation data
      if (actionId === '_current_scope_evaluation') {
        // Extract operator evaluations for separate section
        if (data.stages?.operator_evaluations?.data?.evaluations) {
          result.operatorEvaluations = {
            timestamp: data.stages.operator_evaluations.timestamp,
            evaluations: data.stages.operator_evaluations.data.evaluations,
            totalCount:
              data.stages.operator_evaluations.data.evaluations.length,
          };
        }
        // Don't include this in regular actions
        continue;
      }

      // Extract enhanced scope evaluation data for better visibility
      const enhancedScopeData = data.stages?.enhanced_scope_evaluation;
      const actionResult = {
        ...data,
        stageOrder: Object.keys(data.stages || {}),
        totalDuration: this.#calculateTotalDuration(data),
      };

      // Add enhanced scope evaluation as a separate section for better debugging
      if (enhancedScopeData?.data) {
        actionResult.enhancedScopeEvaluation = {
          scope: enhancedScopeData.data.scope,
          timestamp: enhancedScopeData.data.timestamp,
          entityDiscovery: enhancedScopeData.data.entityDiscovery,
          filterEvaluations: enhancedScopeData.data.filterEvaluations,
          summary: {
            entitiesDiscovered:
              enhancedScopeData.data.entityDiscovery?.reduce(
                (sum, discovery) => sum + (discovery.foundEntities || 0),
                0
              ) || 0,
            entitiesEvaluated:
              enhancedScopeData.data.filterEvaluations?.length || 0,
            entitiesPassed:
              enhancedScopeData.data.filterEvaluations?.filter(
                (evaluation) => evaluation.filterPassed
              ).length || 0,
            entitiesFailed:
              enhancedScopeData.data.filterEvaluations?.filter(
                (evaluation) => !evaluation.filterPassed
              ).length || 0,
          },
        };
      }

      result.actions[actionId] = actionResult;
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

    // Use reduce to avoid stack overflow with large arrays
    const maxTimestamp = timestamps.reduce(
      (max, ts) => Math.max(max, ts),
      -Infinity
    );
    const minTimestamp = timestamps.reduce(
      (min, ts) => Math.min(min, ts),
      Infinity
    );
    return maxTimestamp - minTimestamp;
  }

  /**
   * Serialize a Span object for JSON output
   *
   * @private
   * @param {object} span - Span object to serialize
   * @returns {object} Serialized span data
   */
  #serializeSpan(span) {
    if (!span) {
      return {
        name: null,
        startTime: null,
        endTime: null,
        duration: null,
        data: null,
      };
    }

    // Extract span information safely
    const name = span.operation || span.name || null;
    const startTime = span.startTime !== undefined ? span.startTime : null;
    const endTime = span.endTime !== undefined ? span.endTime : null;

    // Calculate duration safely
    let duration = null;
    if (span.duration !== undefined && span.duration !== null) {
      duration = span.duration;
    } else if (startTime !== null && endTime !== null) {
      duration = endTime - startTime;
    }

    // Ensure duration is not negative
    if (duration !== null && duration < 0) {
      this.#logger.warn(
        `Span "${name}" has negative duration: ${duration}ms, setting to 0`
      );
      duration = 0;
    }

    // Extract span attributes or data
    const data = span.attributes || span.data || null;

    return {
      name,
      startTime,
      endTime,
      duration,
      data,
    };
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

  /**
   * Set output directory for file-based trace output
   *
   * @param {string} directory - Output directory path
   */
  setOutputDirectory(directory) {
    if (this.#fileOutputHandler) {
      this.#fileOutputHandler.setOutputDirectory(directory);
      this.#logger.info(
        `ActionTraceOutputService: Output directory set to ${directory}`
      );
    } else {
      this.#logger.warn(
        'ActionTraceOutputService: Cannot set output directory - file output not enabled'
      );
    }
  }

  /**
   * Enable file output mode with specified directory
   *
   * @param {string} outputDirectory - Directory for trace files
   * @returns {boolean} Success status
   */
  enableFileOutput(outputDirectory) {
    try {
      if (!this.#fileOutputHandler) {
        this.#fileOutputHandler = new FileTraceOutputHandler({
          outputDirectory: outputDirectory || './traces',
          traceDirectoryManager: this.#traceDirectoryManager,
          logger: this.#logger,
        });
      } else {
        this.#fileOutputHandler.setOutputDirectory(outputDirectory);
      }

      this.#outputToFiles = true;
      this.#logger.info('ActionTraceOutputService: File output mode enabled', {
        outputDirectory: outputDirectory || './traces',
      });

      return true;
    } catch (error) {
      this.#logger.error(
        'ActionTraceOutputService: Failed to enable file output',
        error
      );
      return false;
    }
  }

  /**
   * Test-only helper to schedule queue resume logic
   *
   * @returns {void}
   */
  __TEST_ONLY_scheduleQueueResume() {
    this.#scheduleQueueResume();
  }

  /**
   * Test-only helper to invoke default output handler
   *
   * @param {object} writeData - Serialized trace data
   * @param {object} trace - Original trace instance
   * @returns {Promise<void>}
   */
  async __TEST_ONLY_defaultOutputHandler(writeData, trace) {
    await this.#defaultOutputHandler(writeData, trace);
  }

  /**
   * Test-only helper to call private storeTrace implementation
   *
   * @param {object} trace - Trace to persist
   * @returns {Promise<void>}
   */
  async __TEST_ONLY_storeTrace(trace) {
    await this.#storeTrace(trace);
  }

  /**
   * Update trace configuration
   *
   * @param {object} config - Action trace configuration
   */
  updateConfiguration(config) {
    if (config) {
      this.#actionTraceConfig = {
        outputFormats: config.outputFormats || ['json'],
        textFormatOptions: config.textFormatOptions || {},
      };

      this.#logger.debug('ActionTraceOutputService: Configuration updated', {
        outputFormats: this.#actionTraceConfig.outputFormats,
      });
    }
  }
}
