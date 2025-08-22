/**
 * @file Remote logger implementation with batching, retry logic, and circuit breaker
 * @see loggerStrategy.js, circuitBreaker.js
 */

import CircuitBreaker from './circuitBreaker.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { v4 as uuidv4 } from 'uuid';

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
 * @property {number} [circuitBreakerThreshold] - Circuit breaker failure threshold
 * @property {number} [circuitBreakerTimeout] - Circuit breaker timeout
 * @property {number} [requestTimeout] - HTTP request timeout
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
   * @private
   * @type {number}
   */
  #requestTimeout;

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
   * Creates a RemoteLogger instance compatible with LoggerStrategy dependency injection.
   *
   * @param {object} options - Configuration options
   * @param {RemoteLoggerConfig} [options.config] - Remote logger configuration
   * @param {object} [options.dependencies] - Dependencies
   * @param {ILogger} [options.dependencies.consoleLogger] - Fallback console logger
   * @param {*} [options.dependencies.eventBus] - Event bus for error reporting
   */
  constructor({ config = {}, dependencies = {} } = {}) {
    // Validate and set dependencies
    this.#fallbackLogger = dependencies.consoleLogger || console;
    this.#eventBus = dependencies.eventBus || null;

    // Set configuration with defaults
    const defaultConfig = {
      endpoint: 'http://localhost:3001/api/debug-log',
      batchSize: 100,
      flushInterval: 1000,
      retryAttempts: 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      requestTimeout: 5000,
    };

    const mergedConfig = { ...defaultConfig, ...config };

    this.#endpoint = mergedConfig.endpoint;
    this.#batchSize = mergedConfig.batchSize;
    this.#flushInterval = mergedConfig.flushInterval;
    this.#retryAttempts = mergedConfig.retryAttempts;
    this.#retryBaseDelay = mergedConfig.retryBaseDelay;
    this.#retryMaxDelay = mergedConfig.retryMaxDelay;
    this.#requestTimeout = mergedConfig.requestTimeout;

    // Initialize state
    this.#buffer = [];
    this.#flushTimer = null;
    this.#sessionId = uuidv4();
    this.#isUnloading = false;
    this.#abortController = null;

    // Initialize circuit breaker
    this.#circuitBreaker = new CircuitBreaker({
      failureThreshold: mergedConfig.circuitBreakerThreshold,
      timeout: mergedConfig.circuitBreakerTimeout,
    });

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
    try {
      // Create enriched log entry
      const logEntry = this.#enrichLogEntry(level, message, metadata);

      // Add to buffer
      this.#buffer.push(logEntry);

      // Check if we need to flush based on batch size
      if (this.#buffer.length >= this.#batchSize) {
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

    // Auto-detect category from message content
    const category = this.#detectCategory(message);

    // Build metadata object
    const enrichedMetadata = {
      originalArgs: metadata.length > 0 ? metadata : undefined,
    };

    // Add browser-specific metadata if available
    if (typeof window !== 'undefined') {
      enrichedMetadata.userAgent = navigator.userAgent;
      enrichedMetadata.url = window.location.href;

      // Performance metadata
      if (performance) {
        enrichedMetadata.performance = {
          timing: performance.now(),
        };

        // Memory information (if available)
        if (performance.memory) {
          enrichedMetadata.performance.memory =
            performance.memory.usedJSHeapSize;
        }
      }
    }

    // Try to detect source location from stack trace
    const source = this.#detectSource();

    return {
      level,
      message: String(message),
      timestamp,
      category,
      source,
      sessionId: this.#sessionId,
      metadata: enrichedMetadata,
    };
  }

  /**
   * Auto-detects log category from message content.
   *
   * @private
   * @param {string} message - Log message
   * @returns {string|undefined} Detected category
   */
  #detectCategory(message) {
    const msg = message.toLowerCase();

    // Engine-related logs
    if (
      msg.includes('engine') ||
      msg.includes('ecs') ||
      msg.includes('entity')
    ) {
      return 'engine';
    }

    // UI-related logs
    if (
      msg.includes('ui') ||
      msg.includes('dom') ||
      msg.includes('component')
    ) {
      return 'ui';
    }

    // AI-related logs
    if (msg.includes('ai') || msg.includes('llm') || msg.includes('memory')) {
      return 'ai';
    }

    // Network-related logs
    if (
      msg.includes('fetch') ||
      msg.includes('http') ||
      msg.includes('request')
    ) {
      return 'network';
    }

    return undefined;
  }

  /**
   * Attempts to detect source location from stack trace.
   *
   * @private
   * @returns {string|undefined} Source location
   */
  #detectSource() {
    try {
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n');
        // Skip first few lines (Error, this method, addToBuffer, logger method)
        for (let i = 4; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.includes('remoteLogger.js')) {
            // Extract filename and line number
            const match = line.match(/([^/\\]+\.js):(\d+):\d+/);
            if (match) {
              return `${match[1]}:${match[2]}`;
            }
          }
        }
      }
    } catch (error) {
      // Ignore source detection errors
    }
    return undefined;
  }

  /**
   * Schedules a flush operation based on time interval.
   *
   * @private
   */
  #scheduleFlush() {
    if (this.#flushTimer === null && this.#buffer.length > 0) {
      this.#flushTimer = setTimeout(() => {
        this.#flushTimer = null;
        this.#flush();
      }, this.#flushInterval);
    }
  }

  /**
   * Flushes the current buffer asynchronously.
   *
   * @private
   * @returns {Promise<void>}
   */
  async #flush() {
    if (this.#buffer.length === 0) {
      return;
    }

    // Clear the scheduled flush timer
    if (this.#flushTimer !== null) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = null;
    }

    // Get logs to send and clear buffer
    const logsToSend = this.#buffer.splice(0);

    if (logsToSend.length === 0) {
      return;
    }

    try {
      await this.#sendBatch(logsToSend);
    } catch (error) {
      this.#handleSendFailure(error, logsToSend);
    }
  }

  /**
   * Flushes the current buffer synchronously using sendBeacon (for page unload).
   *
   * @private
   */
  #flushSync() {
    if (this.#buffer.length === 0) {
      return;
    }

    const logsToSend = this.#buffer.splice(0);

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
   * Sends a batch of logs with retry logic and circuit breaker protection.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Logs to send
   * @returns {Promise<void>}
   */
  async #sendBatch(logs) {
    return await this.#circuitBreaker.execute(async () => {
      return await this.#retryWithBackoff(
        () => this.#sendHttpRequest(logs),
        this.#retryAttempts
      );
    });
  }

  /**
   * Sends HTTP request to the debug log endpoint.
   *
   * @private
   * @param {DebugLogEntry[]} logs - Logs to send
   * @returns {Promise<object>} Response from server
   */
  async #sendHttpRequest(logs) {
    // Create new abort controller for this request
    this.#abortController = new AbortController();

    const requestConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs }),
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

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

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

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on the last attempt
        if (attempt === maxAttempts - 1) {
          break;
        }

        // Don't retry client errors (4xx)
        if (error.message.includes('HTTP 4')) {
          break;
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
          error: error.message,
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
          error: error.message,
          logCount: logs.length,
          circuitBreakerState: this.#circuitBreaker.getState(),
          endpoint: this.#endpoint,
        },
      });
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
      bufferSize: this.#buffer.length,
      endpoint: this.#endpoint,
      circuitBreaker: this.#circuitBreaker.getStats(),
      configuration: {
        batchSize: this.#batchSize,
        flushInterval: this.#flushInterval,
        retryAttempts: this.#retryAttempts,
      },
    };
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

    // Final flush of any remaining logs
    await this.#flush();

    // Clear buffer
    this.#buffer.length = 0;
  }
}

export default RemoteLogger;
