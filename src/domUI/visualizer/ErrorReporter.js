/**
 * @file Error reporting utility for anatomy visualization errors
 * @description Standardized error reporting with context and metrics collection
 * @see src/domUI/visualizer/ErrorClassifier.js, src/domUI/visualizer/ErrorRecovery.js
 */

import { validateDependency } from '../../utils/index.js';
import { ErrorClassifier } from './ErrorClassifier.js';

/**
 * Utility class for standardized error reporting with context preservation,
 * metrics collection, and structured logging for anatomy visualization errors.
 *
 * @class ErrorReporter
 */
class ErrorReporter {
  #logger;
  #eventDispatcher;
  #metricsCollector;
  #reportingConfig;
  #disposed;

  /**
   * Create a new ErrorReporter instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.logger - Logging service
   * @param {object} dependencies.eventDispatcher - Event dispatching service
   * @param {object} dependencies.metricsCollector - Metrics collection service (optional)
   * @param {object} config - Reporting configuration
   * @param {boolean} config.enableMetrics - Enable metrics collection (default: true)
   * @param {boolean} config.enableEventDispatch - Enable event dispatching (default: true)
   * @param {Array<string>} config.reportLevels - Severity levels to report (default: ['CRITICAL', 'HIGH'])
   * @param {number} config.maxStackTraceLines - Maximum stack trace lines to include (default: 10)
   * @param {boolean} config.includeUserAgent - Include user agent in reports (default: true)
   * @param {boolean} config.includeUrl - Include current URL in reports (default: true)
   */
  constructor(dependencies, config = {}) {
    this.#logger = null;
    this.#eventDispatcher = null;
    this.#metricsCollector = null;
    this.#disposed = false;

    // Validate required dependencies
    validateDependency(dependencies.logger, 'logger');
    validateDependency(dependencies.eventDispatcher, 'eventDispatcher');

    this.#logger = dependencies.logger;
    this.#eventDispatcher = dependencies.eventDispatcher;
    this.#metricsCollector = dependencies.metricsCollector || null;

    // Configuration with defaults
    this.#reportingConfig = {
      enableMetrics: config.enableMetrics !== false,
      enableEventDispatch: config.enableEventDispatch !== false,
      reportLevels: config.reportLevels || ['CRITICAL', 'HIGH'],
      maxStackTraceLines: config.maxStackTraceLines || 10,
      includeUserAgent: config.includeUserAgent !== false,
      includeUrl: config.includeUrl !== false,
      ...config,
    };
  }

  /**
   * Report an error with comprehensive context and classification
   *
   * @param {Error} error - Error to report
   * @param {object} context - Error context information
   * @param {string} context.operation - Operation being performed when error occurred
   * @param {string} context.component - Component where error occurred
   * @param {object} context.data - Data related to the operation
   * @param {string} context.userId - User ID (if available)
   * @param {string} context.sessionId - Session ID (if available)
   * @param {object} context.metadata - Additional metadata
   * @returns {Promise<object>} Report result with ID and status
   */
  async report(error, context = {}) {
    this._throwIfDisposed();

    try {
      // Generate unique report ID
      const reportId = this._generateReportId();

      // Classify the error
      const classification = ErrorClassifier.classify(error, context);

      // Check if this error should be reported
      if (!this._shouldReport(classification)) {
        return {
          reportId,
          status: 'skipped',
          reason: 'Error does not meet reporting criteria',
        };
      }

      // Build comprehensive error report
      const errorReport = await this._buildErrorReport(
        error,
        context,
        classification,
        reportId
      );

      // Execute reporting actions
      await this._executeReporting(errorReport);

      // Collect metrics if enabled
      if (this.#reportingConfig.enableMetrics && this.#metricsCollector) {
        await this._collectMetrics(errorReport);
      }

      this.#logger.debug(`Error reported with ID: ${reportId}`);

      return {
        reportId,
        status: 'reported',
        classification: classification.category,
        severity: classification.severity,
      };
    } catch (reportingError) {
      this.#logger.error('Failed to report error:', reportingError);
      return {
        reportId: null,
        status: 'failed',
        error: reportingError.message,
      };
    }
  }

  /**
   * @description Resolve the current URL from provided globals.
   * @param {object} [globals=globalThis] - Execution context that may include window/location.
   * @returns {string|undefined} Current href when available.
   */
  static resolveCurrentUrl(globals) {
    const contextGlobals = globals ?? globalThis;
    const windowContext = contextGlobals?.window;

    if (windowContext && typeof windowContext.location?.href === 'string') {
      return windowContext.location.href;
    }

    const globalHref = contextGlobals?.location?.href;
    return typeof globalHref === 'string' ? globalHref : undefined;
  }

  /**
   * Report multiple errors as a batch
   *
   * @param {Array<{error: Error, context: object}>} errorBatch - Array of errors with contexts
   * @returns {Promise<Array<object>>} Array of report results
   */
  async reportBatch(errorBatch) {
    this._throwIfDisposed();

    if (!Array.isArray(errorBatch) || errorBatch.length === 0) {
      throw new Error('Error batch must be a non-empty array');
    }

    const results = [];

    for (const { error, context = {} } of errorBatch) {
      try {
        const result = await this.report(error, context);
        results.push(result);
      } catch (batchError) {
        results.push({
          reportId: null,
          status: 'failed',
          error: batchError.message,
        });
      }
    }

    this.#logger.debug(`Batch reported ${results.length} errors`);
    return results;
  }

  /**
   * Get error reporting statistics
   *
   * @returns {object} Reporting statistics
   */
  getStatistics() {
    this._throwIfDisposed();

    // TODO: Implement actual metrics collection
    // This method currently returns placeholder data and should be
    // implemented to track real error reporting statistics
    // For now, return placeholder statistics
    return {
      totalReported: 0,
      reportedBySeverity: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      },
      reportedByCategory: {
        data: 0,
        render: 0,
        state: 0,
        network: 0,
        validation: 0,
        permission: 0,
        resource: 0,
        unknown: 0,
      },
      lastReportTime: null,
    };
  }

  /**
   * Update reporting configuration
   *
   * @param {object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this._throwIfDisposed();

    this.#reportingConfig = {
      ...this.#reportingConfig,
      ...newConfig,
    };

    this.#logger.debug('Error reporter configuration updated');
  }

  /**
   * Dispose the error reporter
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
  }

  /**
   * Check if the reporter is disposed
   *
   * @returns {boolean} True if disposed
   */
  isDisposed() {
    return this.#disposed;
  }

  /**
   * Generate unique report ID
   *
   * @private
   * @returns {string} Unique report ID
   */
  _generateReportId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `error_${timestamp}_${random}`;
  }

  /**
   * Check if error should be reported based on configuration and classification
   *
   * @private
   * @param {object} classification - Error classification
   * @returns {boolean} True if error should be reported
   */
  _shouldReport(classification) {
    // Check if severity level is in reporting levels
    if (!this.#reportingConfig.reportLevels.includes(classification.severity)) {
      return false;
    }

    // Always report if external reporting indicates it should be reported
    if (ErrorClassifier.shouldReport) {
      return true;
    }

    return true;
  }

  /**
   * Build comprehensive error report
   *
   * @private
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @param {object} classification - Error classification
   * @param {string} reportId - Report ID
   * @returns {Promise<object>} Comprehensive error report
   */
  async _buildErrorReport(error, context, classification, reportId) {
    const report = {
      // Report metadata
      reportId,
      timestamp: new Date().toISOString(),
      reporterVersion: '1.0.0',

      // Error information
      error: {
        name: error.name,
        message: error.message,
        stack: this._truncateStackTrace(error.stack),
        toString: error.toString(),
      },

      // Classification
      classification,

      // Context
      context: {
        operation: context.operation || 'unknown',
        component: context.component || 'unknown',
        userId: context.userId || null,
        sessionId: context.sessionId || null,
        data: this._sanitizeData(context.data),
        metadata: context.metadata || {},
      },

      // Environment
      environment: await this._collectEnvironmentInfo(),

      // Browser information
      browser: this._collectBrowserInfo(),

      // Performance information
      performance: this._collectPerformanceInfo(),
    };

    return report;
  }

  /**
   * Execute reporting actions (logging, events, external services)
   *
   * @private
   * @param {object} errorReport - Complete error report
   * @returns {Promise<void>}
   */
  async _executeReporting(errorReport) {
    // Log the error report
    this._logErrorReport(errorReport);

    // Dispatch event if enabled
    if (this.#reportingConfig.enableEventDispatch) {
      this._dispatchErrorEvent(errorReport);
    }

    // Additional reporting actions could be added here:
    // - Send to external error tracking service
    // - Store in local database
    // - Send notifications for critical errors
  }

  /**
   * Collect metrics for the reported error
   *
   * @private
   * @param {object} errorReport - Error report
   * @returns {Promise<void>}
   */
  async _collectMetrics(errorReport) {
    if (!this.#metricsCollector) {
      return;
    }

    try {
      // Increment error counters
      this.#metricsCollector.increment('anatomy_visualizer.errors.total');
      this.#metricsCollector.increment(
        `anatomy_visualizer.errors.severity.${errorReport.classification.severity.toLowerCase()}`
      );
      this.#metricsCollector.increment(
        `anatomy_visualizer.errors.category.${errorReport.classification.category}`
      );

      // Record error timing if operation timing is available
      if (errorReport.context.metadata?.operationDuration) {
        this.#metricsCollector.timing(
          `anatomy_visualizer.errors.operation_duration.${errorReport.context.operation}`,
          errorReport.context.metadata.operationDuration
        );
      }

      // Record error rate by component
      this.#metricsCollector.increment(
        `anatomy_visualizer.errors.component.${errorReport.context.component}`
      );
    } catch (metricsError) {
      this.#logger.warn('Failed to collect error metrics:', metricsError);
    }
  }

  /**
   * Log error report with appropriate log level
   *
   * @private
   * @param {object} errorReport - Error report to log
   */
  _logErrorReport(errorReport) {
    const { classification, reportId } = errorReport;
    const logData = {
      reportId,
      classification: classification.category,
      severity: classification.severity,
      operation: errorReport.context.operation,
      component: errorReport.context.component,
      errorMessage: errorReport.error.message,
    };

    switch (classification.severity) {
      case 'CRITICAL':
        this.#logger.error(`CRITICAL ERROR [${reportId}]:`, logData);
        break;
      case 'HIGH':
        this.#logger.error(`HIGH SEVERITY ERROR [${reportId}]:`, logData);
        break;
      case 'MEDIUM':
        this.#logger.warn(`MEDIUM SEVERITY ERROR [${reportId}]:`, logData);
        break;
      case 'LOW':
        this.#logger.debug(`LOW SEVERITY ERROR [${reportId}]:`, logData);
        break;
      default:
        this.#logger.info(`ERROR [${reportId}]:`, logData);
    }
  }

  /**
   * Dispatch error event for UI handling
   *
   * @private
   * @param {object} errorReport - Error report
   */
  _dispatchErrorEvent(errorReport) {
    try {
      this.#eventDispatcher.dispatch('anatomy:error_reported', {
        reportId: errorReport.reportId,
        severity: errorReport.classification.severity,
        category: errorReport.classification.category,
        userMessage: errorReport.classification.userMessageSuggested,
        suggestions: errorReport.classification.actionsSuggested,
        timestamp: errorReport.timestamp,
      });
    } catch (dispatchError) {
      this.#logger.warn(
        'Failed to dispatch error report event:',
        dispatchError
      );
    }
  }

  /**
   * Truncate stack trace to configured maximum lines
   *
   * @private
   * @param {string} stack - Stack trace
   * @returns {string} Truncated stack trace
   */
  _truncateStackTrace(stack) {
    if (!stack || this.#reportingConfig.maxStackTraceLines <= 0) {
      return '';
    }

    const lines = stack.split('\n');
    if (lines.length <= this.#reportingConfig.maxStackTraceLines) {
      return stack;
    }

    return (
      lines.slice(0, this.#reportingConfig.maxStackTraceLines).join('\n') +
      `\n... (${lines.length - this.#reportingConfig.maxStackTraceLines} more lines)`
    );
  }

  /**
   * Sanitize data for safe logging (remove sensitive information)
   *
   * @private
   * @param {*} data - Data to sanitize
   * @returns {*} Sanitized data
   */
  _sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Clone data to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove common sensitive fields
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'credential',
    ];

    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;

      for (const [key, value] of Object.entries(obj)) {
        if (
          sensitiveKeys.some((sensitive) =>
            key.toLowerCase().includes(sensitive.toLowerCase())
          )
        ) {
          obj[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitizeObject(value);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Collect environment information
   *
   * @private
   * @returns {Promise<object>} Environment information
   */
  async _collectEnvironmentInfo(globals) {
    const contextGlobals = globals ?? globalThis;
    const hasWindow = typeof contextGlobals.window !== 'undefined';
    const resolvedUrl = this.#reportingConfig.includeUrl
      ? ErrorReporter.resolveCurrentUrl(contextGlobals)
      : '[REDACTED]';

    const env = {
      url: this.#reportingConfig.includeUrl
        ? resolvedUrl ?? 'unknown'
        : '[REDACTED]',
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Add viewport information if in browser
    if (hasWindow && contextGlobals.window) {
      env.viewport = {
        width: contextGlobals.window.innerWidth,
        height: contextGlobals.window.innerHeight,
        devicePixelRatio: contextGlobals.window.devicePixelRatio,
      };
    }

    return env;
  }

  /**
   * Collect browser information
   *
   * @private
   * @returns {object} Browser information
   */
  _collectBrowserInfo() {
    if (typeof navigator === 'undefined') {
      return { userAgent: 'unknown', platform: 'unknown' };
    }

    return {
      userAgent: this.#reportingConfig.includeUserAgent
        ? navigator.userAgent
        : '[REDACTED]',
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    };
  }

  /**
   * Collect performance information
   *
   * @private
   * @returns {object} Performance information
   */
  _collectPerformanceInfo() {
    const perf = {
      timestamp: Date.now(),
    };

    // Add performance timing if available
    if (typeof performance !== 'undefined' && performance.timing) {
      const timing = performance.timing;
      perf.pageLoad = {
        navigationStart: timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
      };
    }

    // Add memory information if available
    if (typeof performance !== 'undefined' && performance.memory) {
      perf.memory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      };
    }

    return perf;
  }

  /**
   * Throw error if reporter is disposed
   *
   * @private
   */
  _throwIfDisposed() {
    if (this.#disposed) {
      throw new Error('ErrorReporter has been disposed');
    }
  }
}

export { ErrorReporter };
