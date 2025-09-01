/**
 * @file Remote logger implementation with batching, retry logic, and circuit breaker
 * @see loggerStrategy.js, circuitBreaker.js
 */

/* global process */

import CircuitBreaker from './circuitBreaker.js';
import LogCategoryDetector from './logCategoryDetector.js';
import LogMetadataEnricher from './logMetadataEnricher.js';
import SensitiveDataFilter from './SensitiveDataFilter.js';
import { v4 as uuidv4 } from 'uuid';
import { gzip } from 'pako';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} DebugLogEntry
 * @property {string} level - Log level: debug, info, warn, error
 * @property {string} message - Log message text
 * @property {string} timestamp - ISO 8601 datetime string
 * @property {string} [category] - Optional log category
 * @property {string} [source] - Optional source location: filename.js:line
 * @property {string} [sessionId] - Optional UUID v4 session identifier
 * @property {object} [metadata] - Optional additional context data
 */

/**
 * @typedef {object} RemoteLoggerConfig
 * @property {string} [endpoint] - Server endpoint URL
 * @property {number} [batchSize] - Max logs per batch
 * @property {number} [flushInterval] - Time-based flush in ms
 * @property {number} [retryAttempts] - Max retry attempts
 * @property {number} [retryBaseDelay] - Base delay for retry backoff
 * @property {number} [retryMaxDelay] - Max delay for retry backoff
 * @property {number} [initialConnectionDelay] - Delay before first connection attempt in ms
 * @property {number} [circuitBreakerThreshold] - Circuit breaker failure threshold
 * @property {number} [circuitBreakerTimeout] - Circuit breaker timeout
 * @property {number} [requestTimeout] - HTTP request timeout
 * @property {'minimal'|'standard'|'full'} [metadataLevel] - Metadata collection level
 * @property {boolean} [enableCategoryCache] - Enable category detection caching
 * @property {number} [categoryCacheSize] - Category cache size
 * @property {string[]} [debugFilters] - Patterns to filter out from debug logs to reduce noise
 * @property {object} [filtering] - Sensitive data filtering configuration
 */

/**
 * Remote logger that batches debug logs and sends them to the llm-proxy-server endpoint.
 * Handles network failures gracefully with retry logic and circuit breaker functionality.
 *
 * @implements {ILogger}
 */
class RemoteLogger {
  /**
   * @private
   * @type {string}
   */
  #endpoint;

  /**
   * @private
   * @type {number}
   */
  #batchSize;

  /**
   * @private
   * @type {number}
   */
  #flushInterval;

  /**
   * @private
   * @type {number}
   */
  #maxBufferSize;

  /**
   * @private
   * @type {number}
   */
  #maxServerBatchSize;

  /**
   * @private
   * @type {DebugLogEntry[]}
   */
  #buffer;

  /**
   * @private
   * @type {number|null}
   */
  #flushTimer;

  /**
   * @private
   * @type {SensitiveDataFilter|null}
   */
  #sensitiveDataFilter;

  /**
   * @private
   * @type {number}
   */
  #retryAttempts;

  /**
   * @private
   * @type {number}
   */
  #retryBaseDelay;

  /**
   * @private
   * @type {number}
   */
  #retryMaxDelay;

  /**
   * Initial connection delay in milliseconds.
   *
   * @type {number}
   */
  #initialConnectionDelay;

  /**
   * Whether to skip server readiness validation for testing
   *
   * @type {boolean}
   */
  #skipServerReadinessValidation;

  /**
   * @private
   * @type {number}
   */
  #requestTimeout;

  /**
   * Timestamp when the initial connection delay expires.
   *
   * @type {number}
   */
  #initialDelayExpiryTime;

  /**
   * Whether server readiness has been validated.
   *
   * @private
   * @type {boolean}
   */
  #serverReadinessValidated;

  /**
   * Cache for server readiness status to avoid repeated checks.
   *
   * @private
   * @type {object|null}
   */
  #serverReadinessCache;

  /**
   * Timestamp of last server readiness check.
   *
   * @private
   * @type {number}
   */
  #lastReadinessCheck;

  /**
   * @private
   * @type {CircuitBreaker}
   */
  #circuitBreaker;

  /**
   * @private
   * @type {string}
   */
  #sessionId;

  /**
   * @private
   * @type {ILogger}
   */
  #fallbackLogger;

  /**
   * @private
   * @type {*}
   */
  #eventBus;

  /**
   * @private
   * @type {boolean}
   */
  #isUnloading;

  /**
   * @private
   * @type {AbortController|null}
   */
  #abortController;

  /**
   * @private
   * @type {LogCategoryDetector}
   */
  #categoryDetector;

  /**
   * @private
   * @type {LogMetadataEnricher}
   */
  #metadataEnricher;

  /**
   * @private
   * @type {string[]}
   */
  #debugFilters;

  /**
   * @private
   * @type {Promise<void>|null}
   */
  #currentFlushPromise;

  /**
   * @private
   * @type {number}
   */
  #bufferPressureThreshold;

  /**
   * @private
   * @type {number}
   */
  #adaptiveBatchSize;

  /**
   * @private
   * @type {number[]}
   * @description Array of timestamps for recent log entries (for rate calculation)
   */
  #recentLogTimestamps;

  /**
   * @private
   * @type {boolean}
   * @description Disable adaptive batching (testing only)
   */
  #disableAdaptiveBatching;

  /**
   * @private
   * @type {boolean}
   * @description Disable priority buffer system (testing only)
   */
  #disablePriorityBuffering;

  /**
   * @private
   * @type {number}
   */
  #estimatedPayloadSize;

  /**
   * @private
   * @type {Map<string, number>}
   */
  #logThrottleMap;

  /**
   * @private
   * @type {number}
   */
  #throttleWindowMs;

  /**
   * @private
   * @type {*}
   */
  #performanceMonitor;

  /**
   * @private
   * @type {Map<string, DebugLogEntry[]>}
   */
  #priorityBuffers;

  /**
   * @private
   * @type {string[]}
   */
  #priorityLevels;

  /**
   * @private
   * @type {object}
   * @description Compression configuration
   */
  #compressionConfig;

  /**
   * @private
   * @type {object}
   * @description Batching configuration
   */
  #batchingConfig;

  /**
   * @private
   * @type {number[]}
   * @description Recent transmission times for bandwidth estimation
   */
  #transmissionTimes;


  /**
   * @private
   * @type {object}
   * @description Network quality metrics
   */
  #networkMetrics;

  /**
   * @private
   * @type {number}
   */
  #memoryPressureThreshold;

  /**
   * @private
   * @type {boolean}
   */
  #memoryMonitoringEnabled;

  /**
   * Creates a RemoteLogger instance compatible with LoggerStrategy dependency injection.
   *
   * @param {object} options - Configuration options
   * @param {RemoteLoggerConfig} [options.config] - Remote logger configuration
   * @param {object} [options.dependencies] - Dependencies
   * @param {ILogger} [options.dependencies.consoleLogger] - Fallback console logger
   * @param {*} [options.dependencies.eventBus] - Event bus for error reporting
   * @param {*} [options.dependencies.performanceMonitor] - Optional performance monitor
   */
  constructor({ config = {}, dependencies = {} } = {}) {
    // Validate and set dependencies
    this.#fallbackLogger = dependencies.consoleLogger || console;
    this.#eventBus = dependencies.eventBus || null;
    this.#performanceMonitor = dependencies.performanceMonitor || null;

    // Set configuration with defaults
    const defaultConfig = {
      endpoint: 'http://localhost:3001/api/debug-log',
      batchSize: 25, // Further reduced for faster flushing and stability
      flushInterval: 250, // More aggressive flushing to prevent buildup
      retryAttempts: 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 30000,
      initialConnectionDelay: 3000, // Increased to 3 seconds for better server readiness
      skipServerReadinessValidation: false, // Set to true to disable health checks (testing only)
      circuitBreakerThreshold: 8, // Increased for development to allow more failures before opening
      circuitBreakerTimeout: 30000, // Reduced to 30s for faster recovery in development
      requestTimeout: 5000,
      metadataLevel: 'standard',
      enableCategoryCache: true,
      categoryCacheSize: 200, // Reduced from 1000 to 200 for better memory efficiency
      maxBufferSize: 1500, // Slightly reduced to trigger overflow protection earlier
      maxServerBatchSize: 4000, // More conservative limit for better reliability
      disableAdaptiveBatching: false, // Disable dynamic batching (testing only)
      disablePriorityBuffering: false, // Disable priority buffer system (testing only)
      debugFilters: [
        // Filter anatomy-related debug spam that causes buffer overflow
        'bodyComponent.body.descriptors.height: undefined',
        'Entity-level height component: undefined',
        'Height in final descriptors: undefined',
        'composeDescription: bodyLevelDescriptors[descriptorType]: undefined',
        'indexComponentAdd',
        'indexEntityComponents_fn',
        'addCore_fn',
        'Performance monitoring for',
        'Circuit breaker execute for',
        'Monitoring coordinator wrapping',

        // Game initialization noise filters
        'Entity system: registering entity-',
        'Component loaded:',
        'Entity component mapping:',
        'Mod loading component',
        'Entity validation passed',
        'Component schema validation',
        'Loading mod component:',
        'Entity metadata update:',
        'Component cache hit:',
        'Entity lookup cache:',
        'Scope resolution debug:',
        'Debug trace marker:',
        'Entity lifecycle trace:',

        // UI and rendering noise
        'UI element update:',
        'DOM element created:',
        'Render cycle trace:',
        'Style computation:',
        'Layout calculation:',
        'Element positioning:',

        // Frequent operation patterns
        'Processing entity-',
        'Updating component-',
        'Validating entity-',
        'Cache operation:',
        'Memory cleanup:',
        'Garbage collection:',
      ],
    };

    const mergedConfig = { ...defaultConfig, ...config };


    // Validate configuration for safety
    this.#validateConfiguration(mergedConfig);

    // Dynamically determine the endpoint to avoid CORS issues
    this.#endpoint = this.#determineEndpoint(mergedConfig.endpoint);
    this.#batchSize = mergedConfig.batchSize;
    this.#flushInterval = mergedConfig.flushInterval;
    this.#retryAttempts = mergedConfig.retryAttempts;
    this.#retryBaseDelay = mergedConfig.retryBaseDelay;
    this.#retryMaxDelay = mergedConfig.retryMaxDelay;
    this.#initialConnectionDelay = mergedConfig.initialConnectionDelay;
    this.#skipServerReadinessValidation =
      mergedConfig.skipServerReadinessValidation;
    this.#requestTimeout = mergedConfig.requestTimeout;
    this.#maxBufferSize = mergedConfig.maxBufferSize;
    this.#maxServerBatchSize = mergedConfig.maxServerBatchSize;
    this.#debugFilters = mergedConfig.debugFilters || [];
    this.#disableAdaptiveBatching = mergedConfig.disableAdaptiveBatching;
    this.#disablePriorityBuffering = mergedConfig.disablePriorityBuffering;

    // Initialize compression configuration
    this.#compressionConfig = {
      enabled: mergedConfig.compression?.enabled || false,
      threshold: mergedConfig.compression?.threshold || 1024,
      algorithm: mergedConfig.compression?.algorithm || 'gzip',
      level: mergedConfig.compression?.level || 6,
      maxPayloadSize: mergedConfig.compression?.maxPayloadSize || 5242880,
    };

    // Initialize batching configuration
    this.#batchingConfig = {
      adaptive: mergedConfig.batching?.adaptive ?? true,
      minBatchSize: mergedConfig.batching?.minBatchSize || 10,
      maxBatchSize: mergedConfig.batching?.maxBatchSize || 500,
      targetLatency: mergedConfig.batching?.targetLatency || 100,
      adjustmentFactor: mergedConfig.batching?.adjustmentFactor || 0.1,
    };

    // Initialize state
    this.#buffer = [];
    this.#flushTimer = null;
    this.#sessionId = uuidv4();
    this.#recentLogTimestamps = [];
    this.#isUnloading = false;
    this.#transmissionTimes = [];
    this.#networkMetrics = {
      successCount: 0,
      failureCount: 0,
      totalBytes: 0,
      totalTime: 0,
    };
    this.#abortController = null;
    this.#currentFlushPromise = null;

    // Initialize enhanced buffer management
    this.#bufferPressureThreshold = Math.floor(this.#maxBufferSize * 0.75); // 75% threshold
    this.#adaptiveBatchSize = this.#batchSize;

    // Initialize priority-based buffer management (only if enabled)
    this.#priorityLevels = ['error', 'warn', 'info', 'debug'];
    this.#priorityBuffers = new Map();
    if (!this.#disablePriorityBuffering) {
      this.#priorityLevels.forEach(level => {
        this.#priorityBuffers.set(level, []);
      });
    }

    // Initialize browser memory monitoring
    this.#memoryMonitoringEnabled = typeof performance !== 'undefined' && 
      performance.memory && 
      typeof performance.memory.usedJSHeapSize === 'number';
    this.#memoryPressureThreshold = 100 * 1024 * 1024; // 100MB threshold

    // Set initial connection delay expiry time
    this.#initialDelayExpiryTime = Date.now() + this.#initialConnectionDelay;
    this.#estimatedPayloadSize = 0;

    // Initialize server readiness validation
    this.#serverReadinessValidated = false;
    this.#serverReadinessCache = null;
    this.#lastReadinessCheck = 0;

    // Initialize log throttling
    this.#logThrottleMap = new Map();
    this.#throttleWindowMs = 5000; // 5 second throttle window

    // Initialize circuit breaker with event bus integration
    this.#circuitBreaker = new CircuitBreaker({
      failureThreshold: mergedConfig.circuitBreakerThreshold,
      timeout: mergedConfig.circuitBreakerTimeout,
      eventBus: this.#eventBus,
      rollingWindowDuration: mergedConfig.rollingWindowDuration || 10 * 60 * 1000,
    });

    // Initialize category detector
    this.#categoryDetector = new LogCategoryDetector({
      cacheSize: mergedConfig.categoryCacheSize,
      enableCache: mergedConfig.enableCategoryCache,
    });

    // Initialize metadata enricher
    this.#metadataEnricher = new LogMetadataEnricher({
      level: mergedConfig.metadataLevel,
      enableSource: true,
      enablePerformance: true,
      enableBrowser: true,
      lazyLoadExpensive: mergedConfig.metadataLevel === 'full',
    });

    // Initialize sensitive data filter if configured
    if (mergedConfig.filtering && mergedConfig.filtering.enabled !== false) {
      this.#sensitiveDataFilter = new SensitiveDataFilter({
        logger: this.#fallbackLogger,
        enabled: mergedConfig.filtering.enabled,
        config: mergedConfig.filtering,
      });
    } else {
      this.#sensitiveDataFilter = null;
    }

    // Set up page lifecycle handling
    this.#setupLifecycleHandlers();

    // Log initialization
    if (
      this.#fallbackLogger &&
      typeof this.#fallbackLogger.info === 'function'
    ) {
      this.#fallbackLogger.info(
        `[RemoteLogger] Initialized with endpoint: ${this.#endpoint}, session: ${this.#sessionId}`
      );
    }
  }

  /**
   * Validates configuration parameters for safety and consistency.
   *
   * @private
   * @param {RemoteLoggerConfig} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  #validateConfiguration(config) {
    const warnings = [];
    const errors = [];

    // Validate batch size relationships
    if (config.batchSize <= 0) {
      errors.push('batchSize must be positive');
    }
    if (config.maxBufferSize <= config.batchSize) {
      warnings.push(
        'maxBufferSize should be larger than batchSize for proper buffering'
      );
    }
    if (config.maxServerBatchSize <= config.batchSize) {
      warnings.push('maxServerBatchSize should be larger than batchSize');
    }

    // Validate timing parameters
    if (config.flushInterval <= 0) {
      errors.push('flushInterval must be positive');
    }
    if (config.retryBaseDelay <= 0) {
      errors.push('retryBaseDelay must be positive');
    }
    if (config.retryMaxDelay < config.retryBaseDelay) {
      errors.push(
        'retryMaxDelay must be greater than or equal to retryBaseDelay'
      );
    }
    if (config.initialConnectionDelay < 0) {
      errors.push('initialConnectionDelay cannot be negative');
    }
    if (config.initialConnectionDelay > 30000) {
      warnings.push(
        'initialConnectionDelay > 30s may delay logging significantly'
      );
    }

    // Validate retry configuration
    if (config.retryAttempts < 0) {
      errors.push('retryAttempts cannot be negative');
    }
    if (config.retryAttempts > 10) {
      warnings.push('retryAttempts > 10 may cause excessive delays');
    }

    // Validate timeouts
    if (config.requestTimeout <= 0) {
      errors.push('requestTimeout must be positive');
    }
    if (config.requestTimeout > 30000) {
      warnings.push('requestTimeout > 30s may cause poor user experience');
    }

    // Validate circuit breaker
    if (config.circuitBreakerThreshold <= 0) {
      errors.push('circuitBreakerThreshold must be positive');
    }
    if (config.circuitBreakerTimeout <= 0) {
      errors.push('circuitBreakerTimeout must be positive');
    }

    // Validate buffer sizes for memory safety
    if (config.maxBufferSize > 10000) {
      warnings.push('maxBufferSize > 10000 may cause memory issues');
    }
    if (config.maxServerBatchSize > 5000) {
      warnings.push('maxServerBatchSize > 5000 may exceed server limits');
    }

    // Log warnings
    if (
      warnings.length > 0 &&
      this.#fallbackLogger &&
      typeof this.#fallbackLogger.warn === 'function'
    ) {
      this.#fallbackLogger.warn(
        '[RemoteLogger] Configuration warnings:',
        warnings
      );
    }

    // Throw errors
    if (errors.length > 0) {
      throw new Error(
        `RemoteLogger configuration errors: ${errors.join(', ')}`
      );
    }
  }

  /**
   * Determines the appropriate endpoint based on the current page origin
   * to avoid CORS issues between localhost and 127.0.0.1
   *
   * @private
   * @param {string} configEndpoint - The configured endpoint
   * @returns {string} The adjusted endpoint URL
   */
  #determineEndpoint(configEndpoint) {
    // If not in a browser environment, use the configured endpoint
    if (typeof window === 'undefined' || !window.location) {
      return configEndpoint;
    }

    try {
      const endpointUrl = new URL(configEndpoint);
      const pageHostname = window.location.hostname;

      // If the endpoint uses localhost but the page is served from 127.0.0.1,
      // or vice versa, adjust the endpoint to match
      if (
        (endpointUrl.hostname === 'localhost' &&
          pageHostname === '127.0.0.1') ||
        (endpointUrl.hostname === '127.0.0.1' && pageHostname === 'localhost')
      ) {
        // Replace the hostname in the endpoint with the page's hostname
        endpointUrl.hostname = pageHostname;
        const adjustedEndpoint = endpointUrl.toString();

        if (
          this.#fallbackLogger &&
          typeof this.#fallbackLogger.debug === 'function'
        ) {
          this.#fallbackLogger.debug(
            `[RemoteLogger] Adjusted endpoint from ${configEndpoint} to ${adjustedEndpoint} to match page origin`
          );
        }

        return adjustedEndpoint;
      }
    } catch (error) {
      // If URL parsing fails, fall back to the configured endpoint
      if (
        this.#fallbackLogger &&
        typeof this.#fallbackLogger.warn === 'function'
      ) {
        this.#fallbackLogger.warn(
          '[RemoteLogger] Failed to parse endpoint URL, using configured endpoint:',
          error
        );
      }
    }

    return configEndpoint;
  }

  /**
   * Sets up page lifecycle event handlers for proper cleanup.
   *
   * @private
   */
  #setupLifecycleHandlers() {
    if (typeof window !== 'undefined') {
      // Handle page unload
      window.addEventListener('beforeunload', () => {
        this.#isUnloading = true;
        this.#flushSync(); // Synchronous flush for unload
      });

      // Handle visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.#flush(); // Asynchronous flush for visibility change
        }
      });
    }
  }

  /**
   * Logs an informational message.
   *
   * @param {string} message - The primary message string to log
   * @param {...any} args - Additional arguments or objects to include in the log output
   */
  info(message, ...args) {
    this.#addToBuffer('info', message, args);
  }

  /**
   * Logs a warning message.
   *
   * @param {string} message - The primary warning message string
   * @param {...any} args - Additional arguments or objects to include in the warning output
   */
  warn(message, ...args) {
    this.#addToBuffer('warn', message, args);
  }

  /**
   * Logs an error message.
   *
   * @param {string} message - The primary error message string
   * @param {...any} args - Additional arguments or objects to include in the error output
   */
  error(message, ...args) {
    this.#addToBuffer('error', message, args);
    // Flush immediately for error level logs
    this.#flush();
  }

  /**
   * Logs a debug message.
   *
   * @param {string} message - The primary debug message string
   * @param {...any} args - Additional arguments or objects to include in the debug output
   */
  debug(message, ...args) {
    this.#addToBuffer('debug', message, args);
  }

  /**
   * Starts a collapsed logging group (ConsoleLogger compatibility).
   *
   * @param {string} [label] - The label for the group
   */
  groupCollapsed(label) {
    if (typeof this.#fallbackLogger.groupCollapsed === 'function') {
      this.#fallbackLogger.groupCollapsed(label);
    }
    this.#addToBuffer(
      'debug',
      `[GROUP_START] ${label || 'Unlabeled group'}`,
      []
    );
  }

  /**
   * Ends the current logging group (ConsoleLogger compatibility).
   */
  groupEnd() {
    if (typeof this.#fallbackLogger.groupEnd === 'function') {
      this.#fallbackLogger.groupEnd();
    }
    this.#addToBuffer('debug', '[GROUP_END]', []);
  }

  /**
   * Displays tabular data (ConsoleLogger compatibility).
   *
   * @param {any} data - The data to display in a table
   * @param {string[] | undefined} [columns] - An array of strings representing the columns to include
   */
  table(data, columns) {
    if (typeof this.#fallbackLogger.table === 'function') {
      this.#fallbackLogger.table(data, columns);
    }
    this.#addToBuffer('debug', '[TABLE]', [{ data, columns }]);
  }

  /**
   * Sets the log level (ConsoleLogger compatibility).
   * This is a no-op for RemoteLogger as filtering is handled server-side.
   *
   * @param {string | number} logLevelInput - The desired log level
   */
  setLogLevel(logLevelInput) {
    // Remote logger doesn't filter locally - delegate to fallback
    if (typeof this.#fallbackLogger.setLogLevel === 'function') {
      this.#fallbackLogger.setLogLevel(logLevelInput);
    }
  }

  /**
   * Adds a log entry to the buffer and manages batch flushing.
   *
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any[]} metadata - Additional log data
   */
  #addToBuffer(level, message, metadata) {
    // Skip processing if logger is being destroyed
    if (this.#isUnloading) {
      return;
    }

    try {
      // Record timestamp FIRST for accurate rate calculation (only if adaptive batching is enabled)
      if (!this.#disableAdaptiveBatching) {
        this.#recordLogTimestamp();
      }

      // Create enriched log entry
      let logEntry = this.#enrichLogEntry(level, message, metadata);

      // Apply sensitive data filtering if enabled
      if (this.#sensitiveDataFilter && this.#sensitiveDataFilter.isEnabled()) {
        const strategy = this.#sensitiveDataFilter.strategy || 'mask';
        logEntry = {
          ...logEntry,
          message: this.#sensitiveDataFilter.filter(logEntry.message, strategy),
          metadata: logEntry.metadata
            ? this.#sensitiveDataFilter.filter(logEntry.metadata, strategy)
            : undefined,
        };
      }

      // Apply debug filters to reduce anatomy-related noise
      if (level === 'debug' && this.#shouldFilterDebugLog(message)) {
        return; // Skip this log entry
      }

      // Estimate payload size for this entry
      const entrySize = this.#estimateLogEntrySize(logEntry);
      this.#estimatedPayloadSize += entrySize;

      // Add to priority buffer if enabled, otherwise use legacy buffer
      if (!this.#disablePriorityBuffering && this.#priorityBuffers.size > 0) {
        this.#addToPriorityBuffer(logEntry);
      } else {
        this.#buffer.push(logEntry);
      }


      // Update adaptive batch size based on current conditions
      this.#updateAdaptiveBatchSize();

      // Check for buffer pressure and handle proactively (AFTER adding to buffer and updating batch size)
      this.#handleBufferPressure();

      // Check for memory pressure and handle if detected
      if (this.#detectMemoryPressure()) {
        // Handle memory pressure asynchronously without blocking
        this.#handleMemoryPressure().catch(err => {
          this.#fallbackLogger?.error('Error handling memory pressure:', err);
        });
        return; // Exit early after emergency flush initiation
      }

      // Track buffer size in performance monitor (use total buffer size for priority buffers)
      if (
        this.#performanceMonitor &&
        typeof this.#performanceMonitor.monitorBufferSize === 'function'
      ) {
        const totalSize = this.#priorityBuffers.size > 0 ? 
          this.#getTotalBufferSize() : this.#buffer.length;
        this.#performanceMonitor.monitorBufferSize(
          totalSize,
          this.#maxBufferSize
        );
      }

      // Check if we need to flush based on adaptive batch size or payload size
      if (this.#shouldFlushBatch()) {
        this.#flush();
      } else {
        // Schedule flush if not already scheduled
        this.#scheduleFlush();
      }
    } catch (error) {
      // Fallback to console logging if buffer fails
      this.#handleBufferError(error, level, message, metadata);
    }
  }

  /**
   * Enriches a log entry with metadata and session information.
   *
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any[]} metadata - Additional log data
   * @returns {DebugLogEntry} Enriched log entry
   */
  #enrichLogEntry(level, message, metadata) {
    const timestamp = new Date().toISOString();

    // Use enhanced category detector with level metadata
    const category = this.#categoryDetector.detectCategory(message, { level });

    // Create base log entry
    const baseEntry = {
      level,
      message: String(message),
      timestamp,
      category,
      sessionId: this.#sessionId,
    };

    // Use metadata enricher for comprehensive metadata
    const enrichedEntry = this.#metadataEnricher.enrichLogEntrySync(
      baseEntry,
      metadata
    );

    return enrichedEntry;
  }

  /**
   * Determines if a debug log message should be filtered out.
   *
   * @private
   * @param {string} message - The log message to check
   * @returns {boolean} True if the message should be filtered out
   */
  #shouldFilterDebugLog(message) {
    // Check static filters first
    if (this.#debugFilters && this.#debugFilters.length > 0) {
      const hasStaticFilter = this.#debugFilters.some((filter) =>
        message.includes(filter)
      );
      if (hasStaticFilter) {
        return true;
      }
    }

    // Check throttling for repetitive patterns
    return this.#shouldThrottleLog(message);
  }

  /**
   * Determines if a log message should be throttled based on frequency.
   *
   * @private
   * @param {string} message - The log message to check
   * @returns {boolean} True if the message should be throttled
   */
  #shouldThrottleLog(message) {
    // Generate throttle key from message pattern
    const throttleKey = this.#generateThrottleKey(message);
    if (!throttleKey) {
      return false; // No throttling for this message
    }

    const now = Date.now();
    const lastLogTime = this.#logThrottleMap.get(throttleKey);

    if (lastLogTime && now - lastLogTime < this.#throttleWindowMs) {
      return true; // Throttle this log
    }

    // Update throttle map
    this.#logThrottleMap.set(throttleKey, now);

    // Cleanup old throttle entries periodically
    if (this.#logThrottleMap.size > 1000) {
      this.#cleanupThrottleMap(now);
    }

    return false; // Don't throttle
  }

  /**
   * Generates a throttle key for repetitive log patterns.
   *
   * @private
   * @param {string} message - The log message
   * @returns {string|null} Throttle key or null if no throttling needed
   */
  #generateThrottleKey(message) {
    // Throttle patterns for game initialization
    const throttlePatterns = [
      // Entity operations - group by operation type, not specific entity
      { pattern: /Entity created: entity-\d+/, key: 'entity-creation' },
      { pattern: /Entity updated: entity-\d+/, key: 'entity-update' },
      {
        pattern: /Component attached to entity-\d+/,
        key: 'component-attachment',
      },

      // Game engine patterns
      { pattern: /Engine startup \d+/, key: 'engine-startup' },
      { pattern: /Loading \w+ component \d+/, key: 'component-loading' },
      { pattern: /Turn system: processing entity-\d+/, key: 'turn-processing' },

      // Debug trace patterns
      { pattern: /Debug trace \d+/, key: 'debug-trace' },
      { pattern: /Performance metric:/, key: 'performance-metrics' },
      { pattern: /Memory usage:/, key: 'memory-usage' },

      // UI patterns
      { pattern: /UI element \d+ initialized/, key: 'ui-initialization' },
      { pattern: /Render cycle \d+/, key: 'render-cycle' },
    ];

    for (const { pattern, key } of throttlePatterns) {
      if (pattern.test(message)) {
        return key;
      }
    }

    return null;
  }

  /**
   * Cleans up old entries from the throttle map.
   *
   * @private
   * @param {number} currentTime - Current timestamp
   */
  #cleanupThrottleMap(currentTime) {
    const cutoffTime = currentTime - this.#throttleWindowMs * 2; // Keep 2x window

    for (const [key, timestamp] of this.#logThrottleMap.entries()) {
      if (timestamp < cutoffTime) {
        this.#logThrottleMap.delete(key);
      }
    }
  }

  /**
   * Schedules a flush operation based on time interval.
   *
   * @private
   */
  #scheduleFlush() {
    // Check total buffer size including priority buffers for timer scheduling consistency
    const totalBufferSize = (!this.#disablePriorityBuffering && this.#priorityBuffers.size > 0) ? 
      this.#getTotalBufferSize() : this.#buffer.length;
    
    if (this.#flushTimer === null && totalBufferSize > 0) {
      // During high-volume periods with adaptive batching, use a longer interval
      // to allow buffer to accumulate for efficient batching
      let flushDelay = this.#flushInterval;
      
      if (!this.#disableAdaptiveBatching) {
        const recentLogRate = this.#calculateRecentLoggingRate();
        const isHighVolumePhase = recentLogRate > 50;
        
        if (isHighVolumePhase && totalBufferSize < 100) {
          // During high-volume, delay flush to allow accumulation
          // Use 3x the normal interval or 3 seconds, whichever is smaller
          flushDelay = Math.min(3000, this.#flushInterval * 3);
        }
      }
      
      this.#flushTimer = setTimeout(() => {
        this.#flushTimer = null;
        this.#flush();
      }, flushDelay);
    }
  }

  /**
   * Flushes the current buffer asynchronously.
   *
   * @private
   * @returns {Promise<void>}
   */
  async #flush() {

    // Prevent concurrent flushes
    if (this.#currentFlushPromise) {
      return this.#currentFlushPromise;
    }

    // Check total buffer size including priority buffers
    const totalBufferSize = (!this.#disablePriorityBuffering && this.#priorityBuffers.size > 0) ? 
      this.#getTotalBufferSize() : this.#buffer.length;
    
    if (totalBufferSize === 0) {
      return;
    }

    // Skip async flush if unloading (will use sync flush instead)
    if (this.#isUnloading) {
      return;
    }

    // Check if initial connection delay has passed
    if (Date.now() < this.#initialDelayExpiryTime) {
      // Reschedule flush after the initial delay expires
      const remainingDelay = this.#initialDelayExpiryTime - Date.now();
      this.#flushTimer = setTimeout(() => {
        this.#flushTimer = null;
        this.#flush();
      }, remainingDelay);
      return;
    }

    // Clear the scheduled flush timer
    if (this.#flushTimer !== null) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }

    // Get logs to send with enhanced size protection
    const logsToSend = this.#selectLogsForBatch();

    if (logsToSend.length === 0) {
      return;
    }

    this.#currentFlushPromise = (async () => {
      const flushStartTime = Date.now();

      try {
        await this.#sendBatch(logsToSend);

        // Track successful flush in performance monitor
        if (
          this.#performanceMonitor &&
          typeof this.#performanceMonitor.monitorBatchFlush === 'function'
        ) {
          this.#performanceMonitor.monitorBatchFlush(
            logsToSend.length,
            Date.now() - flushStartTime,
            true
          );
        }
      } catch (error) {
        // Track failed flush in performance monitor
        if (
          this.#performanceMonitor &&
          typeof this.#performanceMonitor.monitorBatchFlush === 'function'
        ) {
          this.#performanceMonitor.monitorBatchFlush(
            logsToSend.length,
            Date.now() - flushStartTime,
            false
          );
        }

        // Handle failure based on error type
        this.#handleSendFailure(error, logsToSend);

        // For 400/413 errors, don't retry - log to fallback and discard
        if (this.#isClientError(error)) {
          // Don't requeue - these logs won't succeed on retry
          this.#fallbackLogger?.warn(
            '[RemoteLogger] Discarding batch due to client error',
            {
              error: error?.message || String(error),
              logCount: logsToSend.length,
            }
          );
        } else {
          // For server errors (5xx) or network issues, consider limited requeue
          this.#handleRetriableFailure(error, logsToSend);
        }
      } finally {
        // Clean up memory regardless of success/failure
        this.#cleanupLogMetadata(logsToSend);
        this.#currentFlushPromise = null;

        // Reset payload size estimation since we've processed logs
        this.#estimatedPayloadSize = Math.max(
          0,
          this.#estimatedPayloadSize - this.#estimateBatchSize(logsToSend)
        );
      }
    })();

    return this.#currentFlushPromise;
  }

  /**
   * Waits for all pending flush operations to complete
   * Useful for tests and cleanup scenarios
   *
   * @returns {Promise<void>}
   */
  async waitForPendingFlushes() {
    // Keep flushing until buffer is empty and no flush is in progress
    // This handles the race condition where new logs can be added during flush
    let iterations = 0;
    const maxIterations = 10; // Safety limit to prevent infinite loops

    while (iterations < maxIterations) {
      // Check total buffer size including priority buffers
      const totalBufferSize = this.#priorityBuffers.size > 0 ? 
        this.#getTotalBufferSize() : this.#buffer.length;
      
      if (totalBufferSize === 0 && !this.#currentFlushPromise) {
        break; // No more data to flush
      }
      
      iterations++;

      // Trigger flush if there's data in buffer
      if (totalBufferSize > 0) {
        await this.#flush();
      }

      // Wait for any current flush to complete
      if (this.#currentFlushPromise) {
        await this.#currentFlushPromise;
      }

      // Small delay to allow any async operations to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Final check - if we hit max iterations, force one more flush
    const finalTotalBufferSize = this.#priorityBuffers.size > 0 ? 
      this.#getTotalBufferSize() : this.#buffer.length;
    if (iterations >= maxIterations && finalTotalBufferSize > 0) {
      await this.#flush();
    }
  }

  /**
   * Flushes the current buffer synchronously using sendBeacon (for page unload).
   *
   * @private
   */
  #flushSync() {
    // Check total buffer size including priority buffers
    const totalBufferSize = this.#priorityBuffers.size > 0 ? 
      this.#getTotalBufferSize() : this.#buffer.length;
    
    if (totalBufferSize === 0) {
      return;
    }

    // Use the same log selection logic as async flush
    const logsToSend = this.#selectLogsForBatch();
    
    // For sync flush, we want to send everything, so clear all buffers
    this.#clearAllBuffers();

    try {
      // Use sendBeacon if available for unload events
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const data = JSON.stringify({ logs: logsToSend });
        const success = navigator.sendBeacon(this.#endpoint, data);

        if (!success) {
          // Fallback to synchronous XMLHttpRequest
          this.#sendSynchronous(logsToSend);
        }
      } else {
        // Fallback for browsers without sendBeacon
        this.#sendSynchronous(logsToSend);
      }
    } catch (error) {
      // Log to fallback if sync flush fails
      this.#handleSendFailure(error, logsToSend);
    }
  }

  /**
   * Sends logs synchronously using XMLHttpRequest (fallback for unload).
   *
   * @private
   * @param {DebugLogEntry[]} logs - Logs to send
   */
  #sendSynchronous(logs) {
    if (typeof XMLHttpRequest === 'undefined') {
      return; // Can't send synchronously in this environment
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', this.#endpoint, false); // false = synchronous
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ logs }));
  }

  /**
   * Sends a batch of logs with retry logic, circuit breaker protection, and optional compression.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Logs to send
   * @returns {Promise<void>}
   */
  async #sendBatch(logs) {
    // Check if compression should be applied
    const shouldCompress = this.#shouldCompress(logs);
    let payloadData = logs;
    let compressionResult = null;

    if (shouldCompress) {
      // Attempt to compress the payload
      compressionResult = await this.#compressPayload(logs);
      payloadData = compressionResult.data;
    }

    // Validate payload size before sending (use original logs for size validation)
    const payloadValidation = this.#validatePayloadSize(logs);
    if (!payloadValidation.valid) {
      if (payloadValidation.shouldSplit) {
        // Split oversized batch and send in chunks
        return await this.#sendOversizedBatchInChunks(logs);
      } else {
        // Payload is too large even for splitting - discard with warning
        this.#fallbackLogger?.warn(
          '[RemoteLogger] Discarding batch - payload too large even for splitting',
          {
            logCount: logs.length,
            estimatedSize: payloadValidation.estimatedSize,
            maxSize: payloadValidation.maxSize,
          }
        );
        return;
      }
    }

    // Execute both server readiness validation and log sending within circuit breaker protection
    const result = await this.#circuitBreaker.execute(async () => {
      // Validate server readiness before attempting to send
      try {
        const serverReady = await this.#validateServerReadiness();
        if (!serverReady) {
          // Server is not ready - throw an error to trigger circuit breaker failure
          throw new Error('Server not ready - health check failed');
        }
      } catch (error) {
        // If server readiness check fails, treat as connection failure
        throw new Error(`Server readiness validation failed: ${error.message}`);
      }

      return await this.#retryWithBackoff(
        () => this.#sendHttpRequest(payloadData, compressionResult),
        this.#retryAttempts
      );
    });

    return result;
  }

  /**
   * Clean up log metadata to free memory after transmission.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Logs to clean up
   */
  #cleanupLogMetadata(logs) {
    // Clear originalArgs references to allow garbage collection
    for (const log of logs) {
      if (log.metadata && log.metadata.originalArgs) {
        log.metadata.originalArgs = null;
      }
      // Clear the entire metadata object to be thorough
      if (log.metadata) {
        log.metadata = null;
      }
    }
  }

  /**
   * Validates server readiness before attempting to send logs.
   * Checks the server's health endpoint to ensure it's ready to receive debug logs.
   *
   * @private
   * @returns {Promise<boolean>} True if server is ready, false otherwise
   */
  async #validateServerReadiness() {
    // Skip validation if configured to do so (for testing)
    if (this.#skipServerReadinessValidation) {
      return true;
    }

    const now = Date.now();
    const cacheValidDuration = 30000; // Cache result for 30 seconds

    // Return cached result if still valid
    if (
      this.#serverReadinessValidated &&
      this.#serverReadinessCache &&
      now - this.#lastReadinessCheck < cacheValidDuration
    ) {
      return this.#serverReadinessCache.ready;
    }

    // Extract health endpoint from debug endpoint
    let healthEndpoint;
    try {
      const endpointUrl = new URL(this.#endpoint);
      healthEndpoint = `${endpointUrl.protocol}//${endpointUrl.host}/health`;
    } catch (_error) {
      // If URL parsing fails, assume server readiness (fallback to original behavior)
      this.#serverReadinessCache = { ready: true, error: 'URL parsing failed' };
      this.#lastReadinessCheck = now;
      return true;
    }

    // Create abort controller for health check request
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 2000); // 2 second timeout for health check

    try {
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        signal: abortController.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      // Consider server ready if health endpoint responds with 200 or 503 (degraded but operational)
      const serverReady = response.ok || response.status === 503;

      // Try to parse response for additional context
      let healthData = null;
      try {
        healthData = await response.json();
      } catch {
        // Ignore JSON parsing errors for health checks
      }

      // Cache the result
      this.#serverReadinessCache = {
        ready: serverReady,
        status: response.status,
        healthData,
        timestamp: now,
      };

      this.#serverReadinessValidated = true;
      this.#lastReadinessCheck = now;

      // Log readiness validation result (only first time or on status change)
      if (
        !this.#serverReadinessValidated ||
        (this.#serverReadinessCache &&
          this.#serverReadinessCache.ready !== serverReady)
      ) {
        const logMessage = serverReady
          ? `[RemoteLogger] Server readiness validated: endpoint available`
          : `[RemoteLogger] Server readiness check failed: HTTP ${response.status}`;

        if (
          this.#fallbackLogger &&
          typeof this.#fallbackLogger.debug === 'function'
        ) {
          this.#fallbackLogger.debug(logMessage, {
            endpoint: healthEndpoint,
            status: response.status,
            ready: serverReady,
          });
        }
      }

      return serverReady;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle different error types
      let errorMessage = 'Server readiness check failed';
      if (error.name === 'AbortError') {
        errorMessage = 'Server readiness check timeout';
      } else if (error.message === 'Failed to fetch') {
        errorMessage = 'Server connection refused';
      }

      // Cache the failure result
      this.#serverReadinessCache = {
        ready: false,
        error: errorMessage,
        originalError: error.message,
        timestamp: now,
      };

      this.#lastReadinessCheck = now;

      // Log readiness failure (only first time or on error change)
      if (
        !this.#serverReadinessValidated ||
        (this.#serverReadinessCache &&
          this.#serverReadinessCache.error !== errorMessage)
      ) {
        if (
          this.#fallbackLogger &&
          typeof this.#fallbackLogger.debug === 'function'
        ) {
          this.#fallbackLogger.debug(`[RemoteLogger] ${errorMessage}`, {
            endpoint: healthEndpoint,
            error: error.message,
          });
        }
      }

      return false;
    }
  }

  /**
   * Sends HTTP request to the debug log endpoint with optional compression support.
   *
   * @private
   * @param {DebugLogEntry[]|Uint8Array|string} payloadData - Logs to send (may be compressed)
   * @param {object|null} compressionResult - Compression result with metadata
   * @returns {Promise<object>} Response from server
   */
  async #sendHttpRequest(payloadData, compressionResult = null) {
    // Track start time for transmission metrics
    const startTime = Date.now();
    let payloadSize = 0;

    // Create new abort controller for this request
    this.#abortController = new AbortController();

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
    };

    // Prepare body based on compression
    let body;
    if (compressionResult && compressionResult.compressed) {
      // Add compression headers
      headers['Content-Encoding'] = 'gzip';
      headers['X-Original-Size'] = compressionResult.originalSize;
      headers['X-Compression-Ratio'] = compressionResult.compressionRatio;
      
      // For compressed data, send as binary
      body = payloadData; // Already compressed Uint8Array
      payloadSize = payloadData.length;
    } else {
      // For uncompressed data, stringify if needed
      const payload = typeof payloadData === 'string' ? payloadData : JSON.stringify({ logs: payloadData });
      body = payload;
      payloadSize = payload.length;
    }

    const requestConfig = {
      method: 'POST',
      headers,
      body,
      signal: this.#abortController.signal,
    };

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (this.#abortController) {
        this.#abortController.abort();
      }
    }, this.#requestTimeout);

    try {
      const response = await fetch(this.#endpoint, requestConfig);
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      
      // Record transmission metrics for network analysis
      this.#recordTransmissionMetrics(payloadSize, duration, response.ok);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Validate response format
      if (
        typeof result.success !== 'boolean' ||
        typeof result.processed !== 'number'
      ) {
        throw new Error('Invalid response format from debug log endpoint');
      }

      // Log compression savings if applicable
      if (compressionResult && compressionResult.compressed && this.#fallbackLogger?.debug) {
        this.#fallbackLogger.debug('[RemoteLogger] Compression stats', {
          originalSize: compressionResult.originalSize,
          compressedSize: compressionResult.compressedSize,
          compressionRatio: compressionResult.compressionRatio,
          savedBytes: compressionResult.originalSize - compressionResult.compressedSize,
        });
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      this.#recordTransmissionMetrics(payloadSize, duration, false);

      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    } finally {
      this.#abortController = null;
    }
  }

  /**
   * Implements retry logic with exponential backoff and jitter.
   *
   * @private
   * @param {Function} fn - Function to retry
   * @param {number} maxAttempts - Maximum retry attempts
   * @returns {Promise<any>} Result of successful execution
   */
  async #retryWithBackoff(fn, maxAttempts) {
    let lastError;
    
    // Ensure at least one attempt is made, even when maxAttempts is 0
    const totalAttempts = Math.max(1, maxAttempts);

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Log retry attempts for debugging
        if (
          this.#fallbackLogger &&
          typeof this.#fallbackLogger.debug === 'function'
        ) {
          this.#fallbackLogger.debug(
            `[RemoteLogger] Retrying batch send (attempt ${attempt + 1}/${totalAttempts})`,
            {
              error: error.message,
              isConnectionError: this.#isConnectionError(error),
              willRetry: attempt < totalAttempts - 1,
            }
          );
        }

        // Don't retry on the last attempt
        if (attempt === totalAttempts - 1) {
          break;
        }

        // Don't retry client errors (4xx) - these won't be fixed by retrying
        if (this.#isClientError(error)) {
          break;
        }

        // Also don't retry certain network conditions immediately
        if (this.#isNonRetriableError(error)) {
          break;
        }

        // Special handling for connection errors during startup
        if (this.#isConnectionError(error)) {
          // Use longer delays for connection errors to allow server startup
          const connectionDelay = this.#calculateConnectionBackoff(attempt);
          await this.#delay(connectionDelay);
          continue;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.#calculateBackoff(attempt);
        await this.#delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Calculates exponential backoff delay with jitter.
   *
   * @private
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  #calculateBackoff(attempt) {
    const exponentialDelay = this.#retryBaseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const totalDelay = exponentialDelay + jitter;

    return Math.min(totalDelay, this.#retryMaxDelay);
  }

  /**
   * Creates a delay promise.
   *
   * @private
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>}
   */
  #delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handles send failures with fallback logging and error reporting.
   *
   * @private
   * @param {Error} error - The error that occurred
   * @param {DebugLogEntry[]} logs - The logs that failed to send
   */
  #handleSendFailure(error, logs) {
    // Log to fallback logger
    if (
      this.#fallbackLogger &&
      typeof this.#fallbackLogger.warn === 'function'
    ) {
      this.#fallbackLogger.warn(
        '[RemoteLogger] Failed to send batch to server, falling back to console',
        {
          error: error?.message || String(error),
          logCount: logs.length,
          circuitBreakerState: this.#circuitBreaker.getState(),
        }
      );

      // Log the original messages to fallback
      for (const logEntry of logs.slice(0, 5)) {
        // Limit to first 5 to avoid spam
        const fallbackMethod =
          this.#fallbackLogger[logEntry.level] || this.#fallbackLogger.info;
        if (typeof fallbackMethod === 'function') {
          fallbackMethod.call(
            this.#fallbackLogger,
            `[REMOTE_FALLBACK] ${logEntry.message}`,
            logEntry.metadata?.originalArgs || []
          );
        }
      }

      if (logs.length > 5) {
        this.#fallbackLogger.info(
          `[RemoteLogger] ... and ${logs.length - 5} more log entries`
        );
      }
    }

    // Report error via event bus if available
    if (this.#eventBus && typeof this.#eventBus.dispatch === 'function') {
      this.#eventBus.dispatch({
        type: 'REMOTE_LOGGER_SEND_FAILED',
        payload: {
          error: error?.message || String(error),
          logCount: logs.length,
          circuitBreakerState: this.#circuitBreaker.getState(),
          endpoint: this.#endpoint,
        },
      });
    }
  }

  /**
   * Handles buffer overflow by removing oldest entries.
   *
   * @private
   */
  #handleBufferOverflow() {
    const overflowCount = this.#buffer.length - this.#maxBufferSize + 100; // Remove extra to avoid immediate overflow
    const removedLogs = this.#buffer.splice(0, overflowCount);

    // Log overflow event
    if (
      this.#fallbackLogger &&
      typeof this.#fallbackLogger.warn === 'function'
    ) {
      this.#fallbackLogger.warn(
        '[RemoteLogger] Buffer overflow - discarded oldest log entries',
        {
          removedCount: removedLogs.length,
          currentBufferSize: this.#buffer.length,
          maxBufferSize: this.#maxBufferSize,
        }
      );
    }

    // Clean up removed logs
    this.#cleanupLogMetadata(removedLogs);

    // Dispatch event for monitoring
    if (this.#eventBus && typeof this.#eventBus.dispatch === 'function') {
      this.#eventBus.dispatch({
        type: 'REMOTE_LOGGER_BUFFER_OVERFLOW',
        payload: {
          removedCount: removedLogs.length,
          bufferSize: this.#buffer.length,
          maxBufferSize: this.#maxBufferSize,
        },
      });
    }
  }

  /**
   * Handles buffer pressure proactively to prevent overflow.
   *
   * @private
   */
  #handleBufferPressure() {
    const currentSize = this.#buffer.length;

    // If we're at or above the pressure threshold, take action
    if (currentSize >= this.#bufferPressureThreshold) {
      // Check if we're in high-volume mode to allow buffer accumulation
      const recentLogRate = this.#calculateRecentLoggingRate();
      const isHighVolumePhase = recentLogRate > 50;
      
      
      // During high-volume periods, allow buffer to grow for dynamic batching
      if (isHighVolumePhase && !this.#disableAdaptiveBatching && currentSize < 100) {
        // Don't flush yet - let buffer accumulate for better batching
        return;
      }
      
      // Force flush if we have enough logs for a batch
      if (currentSize >= this.#adaptiveBatchSize) {
        this.#flush();
      } else if (currentSize >= this.#maxBufferSize) {
        // Critical overflow protection
        this.#handleBufferOverflow();
      }
    }
  }

  /**
   * Estimates the serialized size of a log entry in bytes.
   *
   * @private
   * @param {DebugLogEntry} logEntry - Log entry to estimate
   * @returns {number} Estimated size in bytes
   */
  #estimateLogEntrySize(logEntry) {
    try {
      // Quick estimation based on JSON serialization
      const serialized = JSON.stringify(logEntry);
      return serialized.length * 2; // Rough UTF-8 byte estimation
    } catch (_error) {
      // Fallback estimation if serialization fails
      const messageSize = (logEntry.message || '').length;
      const metadataSize = logEntry.metadata ? 500 : 100; // Rough estimate
      return (messageSize + metadataSize) * 2;
    }
  }

  /**
   * Calculates the recent logging rate (logs per second over the last 2 seconds).
   *
   * @private
   * @returns {number} Logging rate in logs per second
   */
  #calculateRecentLoggingRate() {
    const now = Date.now();
    const twoSecondsAgo = now - 2000;

    // Remove old timestamps (older than 2 seconds)
    this.#recentLogTimestamps = this.#recentLogTimestamps.filter(
      (timestamp) => timestamp > twoSecondsAgo
    );

    // If no recent logs, rate is 0
    if (this.#recentLogTimestamps.length === 0) {
      return 0;
    }

    // Calculate the actual time window (from the oldest timestamp to now)
    const oldestTimestamp = Math.min(...this.#recentLogTimestamps);
    const timeWindowSeconds = (now - oldestTimestamp) / 1000;
    
    // Prevent division by zero and handle very small time windows
    if (timeWindowSeconds < 0.1) {
      // For very rapid logging (< 100ms window), estimate based on count
      // This handles the burst at the start of logging
      return this.#recentLogTimestamps.length * 10; // Extrapolate to per-second rate
    }

    // Calculate rate: logs in time window / seconds in window
    return this.#recentLogTimestamps.length / timeWindowSeconds;
  }

  /**
   * Records a log timestamp for rate calculation.
   *
   * @private
   */
  #recordLogTimestamp() {
    const now = Date.now();
    this.#recentLogTimestamps.push(now);

    // Keep array size reasonable (max 1000 entries = ~10 seconds at 100 logs/sec)
    if (this.#recentLogTimestamps.length > 1000) {
      this.#recentLogTimestamps = this.#recentLogTimestamps.slice(-500);
    }
  }

  /**
   * Updates the adaptive batch size based on current logging rate, buffer conditions, and network analysis.
   *
   * Enhanced strategy: Incorporates network quality metrics to optimize batch sizing for
   * bandwidth, latency, and reliability conditions.
   *
   * @private
   */
  #updateAdaptiveBatchSize() {
    // If adaptive batching is disabled or not using batching config, keep batch size fixed
    if (this.#disableAdaptiveBatching || !this.#batchingConfig?.adaptive) {
      this.#adaptiveBatchSize = this.#batchSize;
      return;
    }

    const currentSize = this.#buffer.length;
    const bufferUtilization = currentSize / this.#maxBufferSize;
    
    // Calculate recent logging rate (logs per second over last 2 seconds)
    const recentLogRate = this.#calculateRecentLoggingRate();

    // Analyze network conditions
    const networkConditions = this.#analyzeNetworkConditions();

    // Detect high-volume periods (like game initialization)
    const isHighVolumePhase = recentLogRate > 50; // More than 50 logs/second
    const isCriticalBuffer = bufferUtilization > 0.9; // Buffer nearly full

    // Calculate optimal batch size based on multiple factors
    let optimal = this.#batchSize;

    if (isCriticalBuffer) {
      // Critical: buffer nearly full, use smaller batches to flush quickly
      optimal = Math.max(this.#batchingConfig.minBatchSize, Math.floor(this.#batchSize * 0.6));
    } else if (isHighVolumePhase && currentSize >= 90) {
      // High volume with sufficient logs: use larger batches
      const targetBatchSize = Math.min(
        this.#batchingConfig.maxBatchSize,
        Math.max(100, currentSize * 0.5)
      );
      optimal = Math.floor(targetBatchSize);
    } else {
      // Network-aware batch sizing
      optimal = this.#calculateOptimalBatchSize(networkConditions, bufferUtilization, recentLogRate);
    }

    // Apply gradual adjustment to prevent oscillation
    const currentBatch = this.#adaptiveBatchSize || this.#batchSize;
    const adjustmentFactor = this.#batchingConfig.adjustmentFactor;
    
    if (optimal > currentBatch) {
      // Increase gradually
      this.#adaptiveBatchSize = Math.min(
        optimal,
        Math.floor(currentBatch * (1 + adjustmentFactor))
      );
    } else if (optimal < currentBatch) {
      // Decrease gradually
      this.#adaptiveBatchSize = Math.max(
        optimal,
        Math.floor(currentBatch * (1 - adjustmentFactor))
      );
    }

    // Ensure within configured bounds
    this.#adaptiveBatchSize = Math.max(
      this.#batchingConfig.minBatchSize,
      Math.min(this.#batchingConfig.maxBatchSize, this.#adaptiveBatchSize)
    );

    // Debug logging for development
    if (process.env.NODE_ENV === 'development' && this.#fallbackLogger?.debug) {
      this.#fallbackLogger.debug('[RemoteLogger] Adaptive batching update', {
        recentLogRate,
        isHighVolumePhase,
        bufferUtilization,
        networkQuality: networkConditions.quality,
        currentBufferSize: currentSize,
        adaptiveBatchSize: this.#adaptiveBatchSize,
        baseBatchSize: this.#batchSize,
      });
    }
  }

  /**
   * Calculates optimal batch size based on network conditions and system state.
   *
   * @private
   * @param {object} networkConditions - Network analysis results
   * @param {number} bufferUtilization - Current buffer utilization (0-1)
   * @param {number} logRate - Current logging rate (logs/second)
   * @returns {number} Optimal batch size
   */
  #calculateOptimalBatchSize(networkConditions, bufferUtilization, logRate) {
    let optimal = this.#batchSize;

    // Adjust based on network bandwidth
    if (networkConditions.bandwidth > 1000000) {
      // > 1Mbps: can handle larger batches
      optimal *= 1.5;
    } else if (networkConditions.bandwidth < 100000) {
      // < 100Kbps: use smaller batches
      optimal *= 0.7;
    }

    // Adjust based on latency
    if (networkConditions.latency > this.#batchingConfig.targetLatency * 2) {
      // High latency: larger batches to reduce round trips
      optimal *= 1.3;
    } else if (networkConditions.latency < this.#batchingConfig.targetLatency * 0.5) {
      // Low latency: can use smaller batches
      optimal *= 0.9;
    }

    // Adjust based on reliability
    if (networkConditions.reliability < 0.8) {
      // Poor reliability: smaller batches to reduce retry cost
      optimal *= 0.8;
    }

    // Adjust based on buffer pressure
    if (bufferUtilization > 0.7) {
      optimal *= 1.2; // Increase batch size to clear buffer
    } else if (bufferUtilization < 0.3) {
      optimal *= 0.9; // Can use smaller batches
    }

    // Adjust based on log rate
    if (logRate > 100) {
      optimal *= 1.4; // High rate: larger batches
    } else if (logRate < 10) {
      optimal *= 0.8; // Low rate: smaller batches
    }

    return Math.floor(optimal);
  }

  /**
   * Determines if a batch should be flushed based on multiple criteria.
   *
   * @private
   * @returns {boolean} True if batch should be flushed
   */
  #shouldFlushBatch() {
    // Use total buffer size if priority buffers are enabled
    const currentSize = (!this.#disablePriorityBuffering && this.#priorityBuffers.size > 0) ? 
      this.#getTotalBufferSize() : this.#buffer.length;

    // Calculate logging rate to detect high-volume periods
    const recentLogRate = this.#calculateRecentLoggingRate();
    const isHighVolumePhase = recentLogRate > 50; // More than 50 logs/second
    
    
    // FIX for dynamic batching: During high-volume periods, allow buffer to accumulate
    // before triggering flush. This prevents the chicken-and-egg problem where buffer
    // flushes at 25 logs and never reaches 100 logs needed for adaptive sizing.
    if (isHighVolumePhase && !this.#disableAdaptiveBatching) {
      // During high volume, wait for buffer to accumulate enough logs
      // for effective batching (at least 100 logs)
      if (currentSize < 90) {
        // Don't flush yet unless we're approaching max buffer size
        const bufferUtilization = currentSize / this.#maxBufferSize;
        if (bufferUtilization < 0.5) {
          return false; // Allow buffer to grow for better batching efficiency
        }
        // If we're above 50% buffer but still < 90 logs in high-volume, keep accumulating
        return false; // Still accumulate in high-volume mode
      }
      // If we have 90+ logs, ensure adaptive batch size is updated for high-volume
      // The adaptive batch size should have been updated in #updateAdaptiveBatchSize()
      // to be larger than 25 when buffer >= 90 in high-volume mode
      if (currentSize >= 90) {
        // We've accumulated enough for efficient batching
        // The flush should use the larger adaptive batch size set by updateAdaptiveBatchSize
        // Only flush if we've reached the LARGER adaptive batch size
        if (currentSize >= this.#adaptiveBatchSize) {
          return true;
        }
        return false; // Keep accumulating until we reach the adaptive batch size
      }
    } else {
      // Normal volume: flush when we reach the adaptive batch size
      if (currentSize >= this.#adaptiveBatchSize) {
        return true;
      }
    }

    // Priority-based flushing: flush immediately if error logs are present
    if (!this.#disablePriorityBuffering && this.#priorityBuffers.size > 0) {
      const errorBuffer = this.#priorityBuffers.get('error');
      if (errorBuffer && errorBuffer.length > 0) {
        return true;
      }
      
      // Flush if warning logs accumulate (lower threshold)
      const warnBuffer = this.#priorityBuffers.get('warn');
      if (warnBuffer && warnBuffer.length >= Math.max(5, this.#adaptiveBatchSize * 0.3)) {
        return true;
      }
    }

    // Flush if estimated payload approaches server limit (3MB threshold for safety)
    const payloadThreshold = 3 * 1024 * 1024; // 3MB
    if (this.#estimatedPayloadSize >= payloadThreshold) {
      return true;
    }

    // Flush if buffer pressure is critical (but respect high-volume accumulation)
    if (currentSize >= this.#bufferPressureThreshold) {
      // During high-volume accumulation, allow buffer to grow more
      if (isHighVolumePhase && !this.#disableAdaptiveBatching && currentSize < 100) {
        return false; // Continue accumulating
      }
      return true;
    }

    return false;
  }

  /**
   * Selects logs for batching based on priority and adaptive batch size.
   * Priority order: error > warn > info > debug
   *
   * @private
   * @returns {DebugLogEntry[]} Array of logs to send
   */
  #selectLogsForBatch() {
    // Check if we have priority buffers or fall back to legacy buffer
    const hasPriorityBuffers = this.#priorityBuffers.size > 0;
    const totalBufferSize = hasPriorityBuffers ? this.#getTotalBufferSize() : this.#buffer.length;
    
    if (totalBufferSize === 0) {
      return [];
    }

    const maxPayloadSize = this.#maxServerBatchSize * 1024; // Convert KB to bytes
    const maxBatchCount = Math.min(totalBufferSize, this.#adaptiveBatchSize);

    let selectedLogs = [];
    let currentPayloadSize = 0;

    if (hasPriorityBuffers) {
      // Priority-based selection: error > warn > info > debug
      for (const level of this.#priorityLevels) {
        const buffer = this.#priorityBuffers.get(level);
        if (!buffer || buffer.length === 0) {
          continue;
        }

        // Select logs from this priority level
        for (let i = 0; i < buffer.length && selectedLogs.length < maxBatchCount; i++) {
          const log = buffer[i];
          const logSize = this.#estimateLogEntrySize(log);

          // Check if adding this log would exceed our size limit
          if (currentPayloadSize + logSize > maxPayloadSize && selectedLogs.length > 0) {
            break;
          }

          selectedLogs.push(log);
          currentPayloadSize += logSize;

          // Hard safety limit to prevent enormous payloads (not count)
          // maxServerBatchSize is in KB, so convert to bytes for comparison
          if (currentPayloadSize >= this.#maxServerBatchSize * 1024) {
            break;
          }
        }

        // Break if we've reached our limits
        if (selectedLogs.length >= maxBatchCount || currentPayloadSize >= this.#maxServerBatchSize * 1024) {
          break;
        }
      }

      // Remove selected logs from priority buffers
      this.#removeSelectedLogsFromBuffers(selectedLogs);
    } else {
      // Legacy buffer selection (original logic)
      for (let i = 0; i < maxBatchCount; i++) {
        const log = this.#buffer[i];
        const logSize = this.#estimateLogEntrySize(log);

        // Check if adding this log would exceed our size limit
        if (currentPayloadSize + logSize > maxPayloadSize && selectedLogs.length > 0) {
          break;
        }

        selectedLogs.push(log);
        currentPayloadSize += logSize;

        // Hard safety limit to prevent enormous payloads (not count)
        // maxServerBatchSize is in KB, so convert to bytes for comparison
        if (currentPayloadSize >= this.#maxServerBatchSize * 1024) {
          break;
        }
      }

      // Remove selected logs from buffer
      this.#buffer.splice(0, selectedLogs.length);
    }

    return selectedLogs;
  }

  /**
   * Estimates the total size of a batch of logs.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Array of log entries
   * @returns {number} Estimated batch size in bytes
   */
  #estimateBatchSize(logs) {
    return logs.reduce(
      (total, log) => total + this.#estimateLogEntrySize(log),
      0
    );
  }

  /**
   * Validates if a batch payload size is acceptable for sending.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Logs to validate
   * @returns {object} Validation result with valid, shouldSplit, estimatedSize, maxSize
   */
  #validatePayloadSize(logs) {
    const estimatedSize = this.#estimateBatchSize(logs);
    const maxAcceptableSize = 4.5 * 1024 * 1024; // 4.5MB safety limit (server has 5MB)
    const minSplitSize = 100 * 1024; // 100KB - minimum size worth splitting

    return {
      valid: estimatedSize <= maxAcceptableSize,
      shouldSplit:
        estimatedSize > maxAcceptableSize && estimatedSize > minSplitSize,
      estimatedSize,
      maxSize: maxAcceptableSize,
    };
  }

  /**
   * Compresses a payload using gzip if it meets the threshold criteria.
   *
   * @private
   * @param {object} data - Data to compress
   * @returns {Promise<{data: *, compressed: boolean, compressionRatio?: number, originalSize?: number}>}
   */
  async #compressPayload(data) {
    if (!this.#compressionConfig.enabled) {
      return { data, compressed: false };
    }

    const jsonString = JSON.stringify(data);
    const originalSize = jsonString.length;

    // Skip compression for small payloads
    if (originalSize < this.#compressionConfig.threshold) {
      return { data: jsonString, compressed: false };
    }

    try {
      // Compress using pako's gzip with configured level
      const compressed = gzip(jsonString, { level: this.#compressionConfig.level });
      const compressedSize = compressed.length;
      const compressionRatio = compressedSize / originalSize;

      // Only use compression if it provides significant savings (>20% reduction)
      if (compressionRatio < 0.8) {
        return {
          data: compressed,
          compressed: true,
          compressionRatio,
          originalSize,
          compressedSize,
        };
      }
    } catch (error) {
      // Log compression error but continue with uncompressed data
      if (this.#fallbackLogger?.warn) {
        this.#fallbackLogger.warn('[RemoteLogger] Compression failed', error);
      }
    }

    return { data: jsonString, compressed: false };
  }

  /**
   * Determines if payload should be compressed based on size and configuration.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Logs to check
   * @returns {boolean}
   */
  #shouldCompress(logs) {
    if (!this.#compressionConfig.enabled) {
      return false;
    }

    const estimatedSize = JSON.stringify(logs).length;
    return estimatedSize >= this.#compressionConfig.threshold;
  }

  /**
   * Estimates network bandwidth based on recent transmission times.
   *
   * @private
   * @returns {number} Estimated bandwidth in bytes per second
   */
  #estimateBandwidth() {
    if (this.#transmissionTimes.length < 2) {
      return 0; // Not enough data
    }

    // Calculate average bytes per second from recent transmissions
    const recentTransmissions = this.#transmissionTimes.slice(-10); // Last 10 transmissions
    const avgBytesPerSecond = recentTransmissions.reduce((sum, t) => sum + (t.bytes / (t.duration / 1000)), 0) / recentTransmissions.length;
    
    return avgBytesPerSecond;
  }

  /**
   * Analyzes network conditions based on recent metrics.
   *
   * @private
   * @returns {object} Network condition analysis
   */
  #analyzeNetworkConditions() {
    const bandwidth = this.#estimateBandwidth();
    const successRate = this.#networkMetrics.successCount / 
                       (this.#networkMetrics.successCount + this.#networkMetrics.failureCount || 1);
    
    // Calculate average latency from recent transmissions
    const avgLatency = this.#transmissionTimes.length > 0
      ? this.#transmissionTimes.slice(-10).reduce((sum, t) => sum + t.duration, 0) / Math.min(10, this.#transmissionTimes.length)
      : 0;

    return {
      bandwidth,
      latency: avgLatency,
      reliability: successRate,
      congestion: this.#networkMetrics.failureCount > 5, // Simple congestion detection
      quality: this.#assessNetworkQuality(bandwidth, avgLatency, successRate),
    };
  }

  /**
   * Assesses overall network quality based on multiple factors.
   *
   * @private
   * @param {number} bandwidth - Bytes per second
   * @param {number} latency - Average latency in ms
   * @param {number} reliability - Success rate (0-1)
   * @returns {string} Quality assessment: 'good', 'fair', or 'poor'
   */
  #assessNetworkQuality(bandwidth, latency, reliability) {
    let score = 0;

    // Bandwidth scoring
    if (bandwidth > 1000000) score += 3; // > 1Mbps
    else if (bandwidth > 100000) score += 2; // > 100Kbps
    else if (bandwidth > 10000) score += 1; // > 10Kbps

    // Latency scoring
    if (latency < 50) score += 3; // < 50ms
    else if (latency < 200) score += 2; // < 200ms
    else if (latency < 500) score += 1; // < 500ms

    // Reliability scoring
    if (reliability > 0.95) score += 3; // > 95% success
    else if (reliability > 0.8) score += 2; // > 80% success
    else if (reliability > 0.6) score += 1; // > 60% success

    // Overall quality assessment
    if (score >= 7) return 'good';
    if (score >= 4) return 'fair';
    return 'poor';
  }

  /**
   * Records transmission metrics for network analysis.
   *
   * @private
   * @param {number} bytes - Bytes transmitted
   * @param {number} duration - Transmission duration in ms
   * @param {boolean} success - Whether transmission succeeded
   */
  #recordTransmissionMetrics(bytes, duration, success) {
    // Record transmission time
    this.#transmissionTimes.push({ bytes, duration, timestamp: Date.now() });
    
    // Keep only recent transmissions (last 20)
    if (this.#transmissionTimes.length > 20) {
      this.#transmissionTimes = this.#transmissionTimes.slice(-20);
    }

    // Update network metrics
    if (success) {
      this.#networkMetrics.successCount++;
    } else {
      this.#networkMetrics.failureCount++;
    }
    this.#networkMetrics.totalBytes += bytes;
    this.#networkMetrics.totalTime += duration;
  }

  /**
   * Sends an oversized batch by splitting it into smaller chunks.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Oversized batch to split and send
   * @returns {Promise<void>}
   */
  async #sendOversizedBatchInChunks(logs) {
    const maxChunkSize = Math.floor(logs.length / 3); // Split into at least 3 chunks
    const minChunkSize = 5; // Minimum logs per chunk
    const actualChunkSize = Math.max(minChunkSize, maxChunkSize);

    const chunks = [];
    for (let i = 0; i < logs.length; i += actualChunkSize) {
      chunks.push(logs.slice(i, i + actualChunkSize));
    }

    if (this.#fallbackLogger?.warn) {
      this.#fallbackLogger.warn(
        '[RemoteLogger] Splitting oversized batch for transmission',
        {
          originalLogCount: logs.length,
          chunkCount: chunks.length,
          avgChunkSize: Math.round(logs.length / chunks.length),
        }
      );
    }

    // Send chunks with small delays to avoid overwhelming server
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        // Validate each chunk size
        const chunkValidation = this.#validatePayloadSize(chunk);
        if (chunkValidation.valid) {
          const result = await this.#circuitBreaker.execute(async () => {
            return await this.#retryWithBackoff(
              () => this.#sendHttpRequest(chunk, null),
              this.#retryAttempts
            );
          });
          results.push(result);
        } else {
          // If chunk is still too large, log and skip
          this.#fallbackLogger?.warn(
            '[RemoteLogger] Chunk still too large, skipping',
            {
              chunkSize: chunk.length,
              estimatedSize: chunkValidation.estimatedSize,
            }
          );
        }

        // Small delay between chunks to be server-friendly
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        // Log chunk failure but continue with remaining chunks
        this.#fallbackLogger?.warn('[RemoteLogger] Chunk send failed', {
          chunkIndex: i,
          chunkSize: chunk.length,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Determines if an error is a client error (4xx) that shouldn't be retried.
   *
   * @private
   * @param {Error} error - The error to check
   * @returns {boolean} True if this is a client error
   */
  #isClientError(error) {
    if (!error) return false;
    const message = error.message || '';
    return (
      message.includes('HTTP 4') ||
      message.includes('400') ||
      message.includes('413') ||
      message.includes('Payload Too Large') ||
      message.includes('Bad Request')
    );
  }

  /**
   * Determines if an error is non-retriable due to network or permanent conditions.
   *
   * @private
   * @param {Error} error - The error to check
   * @returns {boolean} True if this is a non-retriable error
   */
  #isNonRetriableError(error) {
    if (!error) return false;
    const message = error.message || '';
    return (
      // Browser-specific network failures that won't be fixed by retrying
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('ERR_NETWORK') ||
      // DNS resolution failures, certificate errors, etc.
      message.includes('ENOTFOUND') ||
      message.includes('CERT_') ||
      message.includes('certificate') ||
      message.includes('SSL') ||
      message.includes('TLS') ||
      // Permanent authentication failures
      message.includes('HTTP 401') ||
      message.includes('HTTP 403') ||
      message.includes('Unauthorized') ||
      message.includes('Forbidden') ||
      // Method not allowed, etc.
      message.includes('HTTP 405') ||
      message.includes('Method Not Allowed')
    );
  }

  /**
   * Determines if an error is a connection error that might be resolved by retry.
   *
   * @private
   * @param {Error} error - The error to check
   * @returns {boolean} True if this is a retriable connection error
   */
  #isConnectionError(error) {
    if (!error) return false;
    const message = error.message || '';
    return (
      message.includes('ECONNREFUSED') ||
      message.includes('Connection refused') ||
      message.includes('ERR_CONNECTION_REFUSED') ||
      message.includes('connect ECONNREFUSED') ||
      // Server temporarily unavailable
      message.includes('HTTP 502') ||
      message.includes('HTTP 503') ||
      message.includes('Bad Gateway') ||
      message.includes('Service Unavailable') ||
      // Timeout errors (server might be starting up)
      message.includes('timeout') ||
      message.includes('ETIMEDOUT')
    );
  }

  /**
   * Calculates backoff delay specifically for connection errors during startup.
   * Uses longer delays to allow server startup time.
   *
   * @private
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  #calculateConnectionBackoff(attempt) {
    // Use longer base delays for connection errors, but respect test configuration
    const connectionBaseDelay =
      process.env.NODE_ENV === 'test'
        ? this.#retryBaseDelay
        : Math.max(this.#retryBaseDelay, 2000); // Minimum 2 seconds in production
    const exponentialDelay = connectionBaseDelay * Math.pow(1.5, attempt); // Gentler exponential growth
    const jitter = process.env.NODE_ENV === 'test' ? 0 : Math.random() * 1000; // No jitter in tests for predictable timing
    const totalDelay = exponentialDelay + jitter;

    // Cap at a reasonable maximum for connection retries, but respect test configuration
    const connectionMaxDelay =
      process.env.NODE_ENV === 'test'
        ? this.#retryMaxDelay
        : Math.max(this.#retryMaxDelay, 15000); // Minimum 15 seconds max in production
    return Math.min(totalDelay, connectionMaxDelay);
  }

  /**
   * Handles retriable failures by implementing limited requeue logic.
   *
   * @private
   * @param {Error} error - The error that occurred
   * @param {DebugLogEntry[]} logs - The logs that failed to send
   */
  #handleRetriableFailure(error, logs) {
    // Only requeue if buffer has space and it's not a client error
    const availableSpace = this.#maxBufferSize - this.#buffer.length;
    const logsToRequeue = Math.min(logs.length, availableSpace, 500); // Limit requeue to 500 logs max

    if (logsToRequeue > 0) {
      // Add back to front of buffer for retry
      this.#buffer.unshift(...logs.slice(0, logsToRequeue));

      if (
        this.#fallbackLogger &&
        typeof this.#fallbackLogger.info === 'function'
      ) {
        this.#fallbackLogger.info(
          '[RemoteLogger] Requeued logs for retry after server error',
          {
            requeuedCount: logsToRequeue,
            discardedCount: logs.length - logsToRequeue,
            error: error?.message || String(error),
          }
        );
      }
    }

    // If we couldn't requeue all logs, clean up the remainder
    if (logsToRequeue < logs.length) {
      const discardedLogs = logs.slice(logsToRequeue);
      this.#cleanupLogMetadata(discardedLogs);
    }
  }

  /**
   * Handles buffer operation errors.
   *
   * @private
   * @param {Error} error - The error that occurred
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any[]} metadata - Log metadata
   */
  #handleBufferError(error, level, message, metadata) {
    if (
      this.#fallbackLogger &&
      typeof this.#fallbackLogger.error === 'function'
    ) {
      this.#fallbackLogger.error(
        '[RemoteLogger] Buffer operation failed, logging directly to fallback',
        error
      );

      // Log the original message to fallback
      const fallbackMethod =
        this.#fallbackLogger[level] || this.#fallbackLogger.info;
      if (typeof fallbackMethod === 'function') {
        fallbackMethod.call(this.#fallbackLogger, message, ...metadata);
      }
    }
  }

  /**
   * Gets the current session ID.
   *
   * @returns {string} Session ID
   */
  getSessionId() {
    return this.#sessionId;
  }

  /**
   * Gets the current circuit breaker state.
   *
   * @returns {string} Circuit breaker state
   */
  getCircuitBreakerState() {
    return this.#circuitBreaker.getState();
  }

  /**
   * Gets statistics about the remote logger.
   *
   * @returns {object} Logger statistics
   */
  getStats() {
    return {
      sessionId: this.#sessionId,
      bufferSize: this.#priorityBuffers.size > 0 ? this.#getTotalBufferSize() : this.#buffer.length,
      endpoint: this.#endpoint,
      circuitBreaker: this.#circuitBreaker.getStats(),
      categoryDetector: this.#categoryDetector.getStats(),
      metadataEnricher: this.#metadataEnricher.getConfig(),
      adaptiveBatchSize: this.#adaptiveBatchSize,
      configuration: {
        batchSize: this.#batchSize,
        flushInterval: this.#flushInterval,
        retryAttempts: this.#retryAttempts,
        maxBufferSize: this.#maxBufferSize,
        maxServerBatchSize: this.#maxServerBatchSize,
      },
    };
  }

  /**
   * Gets the current buffer contents for testing purposes.
   * This method should only be used in test environments.
   *
   * @returns {DebugLogEntry[]} Copy of all buffered logs (legacy + priority buffers)
   */
  getBuffer() {
    const allLogs = [...this.#buffer];
    
    // Add logs from priority buffers if they exist and contain data
    if (this.#priorityBuffers.size > 0) {
      for (const level of this.#priorityLevels) {
        const buffer = this.#priorityBuffers.get(level);
        if (buffer && buffer.length > 0) {
          allLogs.push(...buffer);
        }
      }
    }
    
    return allLogs;
  }

  /**
   * Manually flushes the buffer (useful for testing or forced flushing).
   *
   * @returns {Promise<void>}
   */
  async flush() {
    await this.#flush();
  }

  /**
   * Gets the current buffer size
   *
   * @returns {number} Number of logs in buffer
   */
  getBufferSize() {
    return this.#priorityBuffers.size > 0 ? this.#getTotalBufferSize() : this.#buffer.length;
  }

  /**
   * Gets batch metrics for performance monitoring
   *
   * @returns {object} Batch metrics including size, success rate, etc.
   */
  getBatchMetrics() {
    return {
      currentBufferSize: this.#buffer.length,
      maxBufferSize: this.#maxBufferSize,
      bufferUtilization: (this.#buffer.length / this.#maxBufferSize) * 100,
      adaptiveBatchSize: this.#adaptiveBatchSize,
      baseBatchSize: this.#batchSize,
      flushInterval: this.#flushInterval,
      isCircuitOpen: this.#circuitBreaker?.getState ? this.#circuitBreaker.getState() === 'open' : false,
      pendingFlush: this.#currentFlushPromise !== null,
      bufferPressureThreshold: this.#bufferPressureThreshold,
    };
  }

  /**
   * Adds a log to the appropriate priority buffer
   *
   * @private
   * @param {object} log - The log entry to buffer
   */
  #addToPriorityBuffer(log) {
    const level = log.level || 'info';
    const priority = this.#priorityLevels.indexOf(level);
    const bufferKey = priority >= 0 ? level : 'info';
    
    if (!this.#priorityBuffers.has(bufferKey)) {
      this.#priorityBuffers.set(bufferKey, []);
    }
    
    this.#priorityBuffers.get(bufferKey).push(log);
  }

  /**
   * Gets the total size of all priority buffers
   *
   * @private
   * @returns {number} Total buffer size
   */
  #getTotalBufferSize() {
    let total = 0;
    for (const buffer of this.#priorityBuffers.values()) {
      total += buffer.length;
    }
    return total + this.#buffer.length; // Include legacy buffer
  }

  /**
   * Removes selected logs from priority buffers
   *
   * @private
   * @param {Array} selectedLogs - Logs to remove from buffers
   */
  #removeSelectedLogsFromBuffers(selectedLogs) {
    // Create a set of unique identifiers for selected logs (timestamp + message hash)
    // This avoids the object identity issue where log objects might be modified
    const selectedIds = new Set(selectedLogs.map(log => `${log.timestamp}:${this.#hashLogMessage(log.message)}`));
    
    for (const [level, buffer] of this.#priorityBuffers.entries()) {
      const remainingLogs = buffer.filter(log => 
        !selectedIds.has(`${log.timestamp}:${this.#hashLogMessage(log.message)}`)
      );
      this.#priorityBuffers.set(level, remainingLogs);
    }
    
    // Also clean legacy buffer
    this.#buffer = this.#buffer.filter(log => 
      !selectedIds.has(`${log.timestamp}:${this.#hashLogMessage(log.message)}`)
    );
  }

  /**
   * Creates a simple hash of a log message for identification purposes
   *
   * @private
   * @param {string} message - Log message to hash
   * @returns {string} Simple hash string
   */
  #hashLogMessage(message) {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36); // Convert to base36 for shorter string
  }

  /**
   * Detects browser memory pressure using performance.memory API
   *
   * @private
   * @returns {boolean} True if memory pressure detected
   */
  #detectMemoryPressure() {
    if (!this.#memoryMonitoringEnabled || typeof performance === 'undefined' || !performance.memory) {
      return false;
    }

    const memoryInfo = performance.memory;
    const usedMemory = memoryInfo.usedJSHeapSize;
    const memoryLimit = memoryInfo.jsHeapSizeLimit;
    const memoryUsage = usedMemory / memoryLimit;

    return memoryUsage >= this.#memoryPressureThreshold;
  }

  /**
   * Handles memory pressure by forcing immediate flush
   *
   * @private
   * @returns {Promise<void>}
   */
  async #handleMemoryPressure() {
    if (this.#getTotalBufferSize() > 0) {
      this.#fallbackLogger?.warn('Memory pressure detected, forcing immediate flush', {
        totalBufferSize: this.#getTotalBufferSize(),
        memoryUsage: performance.memory ? 
          (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100 : 'unknown'
      });
      
      await this.#flush();
    }
  }

  /**
   * Clears all buffers (both priority and legacy).
   *
   * @private
   */
  #clearAllBuffers() {
    // Clear priority buffers
    for (const buffer of this.#priorityBuffers.values()) {
      // Clear metadata references to prevent memory leaks
      for (const log of buffer) {
        if (log.metadata) {
          log.metadata = null;
        }
      }
      buffer.length = 0;
    }
    
    // Clear legacy buffer  
    for (const log of this.#buffer) {
      if (log.metadata) {
        log.metadata = null;
      }
    }
    this.#buffer.length = 0;
  }

  /**
   * Cleans up resources and flushes any remaining logs.
   *
   * @returns {Promise<void>}
   */
  async destroy() {

    // Clear any pending flush timer
    if (this.#flushTimer !== null) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }

    // Abort any pending requests
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }

    // Final flush of any remaining logs BEFORE setting unloading flag
    try {
      await this.#flush();
    } catch (error) {
      // If flush fails, log the error but continue with cleanup
      if (this.#fallbackLogger?.warn) {
        this.#fallbackLogger.warn('[RemoteLogger] Final flush failed during destroy, force clearing buffers', error);
      }
    }

    // Set unloading flag to prevent new operations
    this.#isUnloading = true;

    // Force clear all buffers regardless of flush success/failure
    this.#clearAllBuffers();

    // Clear category cache
    if (this.#categoryDetector) {
      this.#categoryDetector.clearCache();
    }

    // Remove event listeners to prevent memory leaks
    if (typeof window !== 'undefined') {
      // Note: We can't remove these specific listeners without storing references
      // but setting isUnloading flag prevents their execution
      // Future improvement: Store listener references to remove them explicitly
    }

    // Clear current flush promise reference
    this.#currentFlushPromise = null;
  }
}

export default RemoteLogger;
