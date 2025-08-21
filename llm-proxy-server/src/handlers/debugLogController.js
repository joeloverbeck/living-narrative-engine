/**
 * @file Debug log controller for handling batched debug logs from browser clients
 * @description Handles POST requests to /api/debug-log endpoint with validation and batch processing
 * @see traceRoutes.js, llmRequestController.js
 */

import { sendProxyError } from '../utils/responseUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import LogStorageService from '../services/logStorageService.js';

/**
 * @typedef {import('express').Request} ExpressRequest
 */
/**
 * @typedef {import('express').Response} ExpressResponse
 */

/**
 * @typedef {object} ILogger
 * @description Basic logger interface
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message
 */

/**
 * @typedef {object} DebugLogEntry
 * @description Structure for individual debug log entries
 * @property {string} level - Log level: debug, info, warn, error
 * @property {string} message - Log message text
 * @property {string} [category] - Optional log category: engine, ui, ecs, ai, etc
 * @property {string} timestamp - ISO 8601 datetime string
 * @property {string} [source] - Optional source location: filename.js:line
 * @property {string} [sessionId] - Optional UUID v4 session identifier
 * @property {object} [metadata] - Optional additional context data
 */

/**
 * @typedef {object} DebugLogRequest
 * @description Request body structure for debug log endpoint
 * @property {DebugLogEntry[]} logs - Array of debug log entries
 */

/**
 * Debug log controller class for handling batched debug log requests
 */
class DebugLogController {
  /** @type {ILogger} */
  #logger;

  /** @type {LogStorageService} */
  #logStorageService;

  /**
   * Creates a new DebugLogController instance
   * @param {ILogger} logger - Logger instance for server-side logging
   * @param {LogStorageService} [logStorageService] - Optional log storage service for file persistence
   */
  constructor(logger, logStorageService = null) {
    this.#logger = ensureValidLogger(logger, 'DebugLogController');
    this.#logStorageService = logStorageService;

    if (this.#logStorageService) {
      this.#logger.info(
        'DebugLogController: Initialized with log storage service'
      );
    } else {
      this.#logger.info(
        'DebugLogController: Initialized with console-only logging'
      );
    }
  }

  /**
   * Handles debug log requests with validation and batch processing
   * @param {ExpressRequest} req - Express request object
   * @param {ExpressResponse} res - Express response object
   * @returns {Promise<void>}
   */
  async handleDebugLog(req, res) {
    const startTime = Date.now();

    try {
      // Validation has already been performed by middleware at this point
      const { logs } = req.body;

      // Additional safety check for logs array
      if (!Array.isArray(logs)) {
        return sendProxyError(
          res,
          400,
          'request_validation',
          'logs must be an array',
          {
            providedType: typeof logs,
            expectedType: 'array',
          },
          'debug-log-validation-failed',
          this.#logger
        );
      }

      // Process the logs using storage service if available, otherwise console logging
      const processedCount = await this.#processLogs(logs);

      // Generate success response
      const response = {
        success: true,
        processed: processedCount,
        timestamp: new Date().toISOString(),
      };

      this.#logger.info('Debug logs processed successfully', {
        processedCount,
        totalLogs: logs.length,
        processingTimeMs: Date.now() - startTime,
        endpoint: '/api/debug-log',
      });

      res.status(200).json(response);
    } catch (error) {
      this.#logger.error('Failed to process debug logs', {
        error: error.message,
        stack: error.stack,
        processingTimeMs: Date.now() - startTime,
        endpoint: '/api/debug-log',
      });

      return sendProxyError(
        res,
        500,
        'debug_log_processing',
        'Failed to process debug logs',
        {
          originalErrorMessage: error.message,
        },
        'debug-log-processing-failed',
        this.#logger
      );
    }
  }

  /**
   * Processes debug log entries using storage service or console logging fallback
   * @param {DebugLogEntry[]} logs - Array of debug log entries to process
   * @returns {Promise<number>} Number of logs processed
   * @private
   */
  async #processLogs(logs) {
    let processedCount = 0;

    try {
      // If storage service is available, use it for persistent logging
      if (this.#logStorageService) {
        try {
          const storedCount = await this.#logStorageService.writeLogs(logs);
          processedCount += storedCount;

          this.#logger.debug(
            'DebugLogController.#processLogs: Logs written to storage service',
            {
              storedCount,
              totalLogs: logs.length,
            }
          );
        } catch (storageError) {
          // Log storage failed, fallback to console logging
          this.#logger.warn(
            'DebugLogController.#processLogs: Storage service failed, falling back to console logging',
            {
              error: storageError.message,
              logsCount: logs.length,
            }
          );

          // Process with console logging fallback
          processedCount += await this.#processLogsToConsole(logs);
        }
      } else {
        // No storage service, use console logging
        processedCount += await this.#processLogsToConsole(logs);
      }

      return processedCount;
    } catch (error) {
      this.#logger.error(
        'DebugLogController.#processLogs: Critical error processing logs',
        {
          error: error.message,
          stack: error.stack,
          logsCount: logs.length,
        }
      );

      // Return partial success count
      return processedCount;
    }
  }

  /**
   * Processes logs to console with structured logging (fallback method)
   * @param {DebugLogEntry[]} logs - Array of debug log entries to process
   * @returns {Promise<number>} Number of logs processed
   * @private
   */
  async #processLogsToConsole(logs) {
    let processedCount = 0;

    for (const logEntry of logs) {
      try {
        // Create a structured log message
        const logMessage = this.#formatLogMessage(logEntry);

        // Log to server console based on client log level
        switch (logEntry.level.toLowerCase()) {
          case 'error':
            this.#logger.error(`[CLIENT] ${logMessage}`, {
              clientLog: true,
              category: logEntry.category,
              source: logEntry.source,
              sessionId: logEntry.sessionId,
              timestamp: logEntry.timestamp,
              metadata: logEntry.metadata,
            });
            break;
          case 'warn':
            this.#logger.warn(`[CLIENT] ${logMessage}`, {
              clientLog: true,
              category: logEntry.category,
              source: logEntry.source,
              sessionId: logEntry.sessionId,
              timestamp: logEntry.timestamp,
              metadata: logEntry.metadata,
            });
            break;
          case 'info':
            this.#logger.info(`[CLIENT] ${logMessage}`, {
              clientLog: true,
              category: logEntry.category,
              source: logEntry.source,
              sessionId: logEntry.sessionId,
              timestamp: logEntry.timestamp,
              metadata: logEntry.metadata,
            });
            break;
          case 'debug':
          default:
            this.#logger.debug(`[CLIENT] ${logMessage}`, {
              clientLog: true,
              category: logEntry.category,
              source: logEntry.source,
              sessionId: logEntry.sessionId,
              timestamp: logEntry.timestamp,
              metadata: logEntry.metadata,
            });
            break;
        }

        processedCount++;
      } catch (logError) {
        // Don't fail the entire batch for a single log entry error
        this.#logger.warn('Failed to process individual log entry', {
          logError: logError.message,
          logEntry: {
            level: logEntry.level,
            message: logEntry.message?.substring(0, 100), // Truncate for safety
            source: logEntry.source,
          },
        });
      }
    }

    return processedCount;
  }

  /**
   * Formats a log entry for server-side logging
   * @param {DebugLogEntry} logEntry - Debug log entry to format
   * @returns {string} Formatted log message
   * @private
   */
  #formatLogMessage(logEntry) {
    const parts = [];

    if (logEntry.category) {
      parts.push(`[${logEntry.category.toUpperCase()}]`);
    }

    if (logEntry.source) {
      parts.push(`(${logEntry.source})`);
    }

    parts.push(logEntry.message);

    return parts.join(' ');
  }
}

export default DebugLogController;
