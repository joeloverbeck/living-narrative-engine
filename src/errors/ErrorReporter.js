/**
 * @file ErrorReporter.js - Error reporting service with batching, analytics, and alerting
 * @description Provides comprehensive error reporting with batch processing, trend analysis, and alerting
 * @see baseError.js - Base error class for enhanced error context
 * @see CentralErrorHandler.js - Central error handling integration
 * @see ../config/errorHandling.config.js - Centralized error handling configuration
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { getEnvironmentMode } from '../utils/environmentUtils.js';
import BaseError from './baseError.js';
import { getErrorConfig } from '../config/errorHandling.config.js';

/**
 * Error reporting service that batches errors, provides analytics, and sends alerts
 *
 * @class
 */
class ErrorReporter {
  #logger;
  #eventBus;
  #buffer;
  #batchSize;
  #flushInterval;
  #endpoint;
  #intervalHandle;
  #analytics;
  #alertThresholds;
  #enabled;

  /**
   * Creates a new ErrorReporter instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.logger - Logger instance
   * @param {object} dependencies.eventBus - Event bus for dispatching events
   * @param {string|null} dependencies.endpoint - Reporting endpoint URL
   * @param {number} dependencies.batchSize - Maximum batch size before auto-flush
   * @param {number} dependencies.flushInterval - Interval in ms between automatic flushes
   * @param {boolean} dependencies.enabled - Whether reporting is enabled
   */
  constructor({
    logger,
    eventBus,
    endpoint = null,
    batchSize = null,
    flushInterval = null,
    enabled = null
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'error', 'warn', 'debug']
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch', 'subscribe']
    });

    // Get configuration
    const config = getErrorConfig();

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#endpoint = endpoint ?? config.reporting.endpoint;
    this.#batchSize = batchSize ?? config.reporting.batchSize;
    this.#flushInterval = flushInterval ?? config.reporting.flushInterval;
    this.#enabled = (enabled !== null ? enabled : config.reporting.enabled) && this.#endpoint !== null;
    this.#buffer = [];
    this.#intervalHandle = null;

    this.#analytics = {
      totalReported: 0,
      errorsByType: new Map(),
      errorsBySeverity: new Map(),
      errorsByHour: new Map(),
      trends: []
    };

    // Use configuration for alert thresholds
    this.#alertThresholds = {
      criticalErrors: config.reporting.alerts.criticalErrors,
      errorRate: config.reporting.alerts.errorRate,
      specificError: config.reporting.alerts.specificError,
      failureRate: config.reporting.alerts.failureRate
    };

    if (this.#enabled) {
      this.#startBatchReporting();
      this.#registerEventListeners();
    }
  }

  /**
   * @description Resolves the current URL from the provided global-like object.
   * @param {object} [globals] - Execution context providing window/location data.
   * @returns {string|undefined} Detected href string when available.
   */
  static resolveCurrentUrl(globals = globalThis) {
    const windowHref = globals?.window?.location?.href;
    if (typeof windowHref === 'string') {
      return windowHref;
    }

    const globalHref = globals?.location?.href;
    return typeof globalHref === 'string' ? globalHref : undefined;
  }

  /**
   * @description Resolves the user agent string from the provided global-like object.
   * @param {object} [globals] - Execution context containing navigator information.
   * @returns {string} Detected user agent or the default server identifier.
   */
  static resolveUserAgent(globals = globalThis) {
    const userAgent = globals?.navigator?.userAgent;
    return typeof userAgent === 'string' && userAgent.length > 0 ? userAgent : 'server';
  }

  /**
   * Report an error
   *
   * @param {Error|BaseError} error - Error to report
   * @param {object} context - Additional context for the error
   */
  report(error, context = {}) {
    if (!this.#enabled) {
      return;
    }

    const config = getErrorConfig();
    const sampling = config.reporting.sampling;

    // Check sampling configuration
    if (sampling.enabled) {
      const shouldReport =
        // Always report certain error types/severities
        sampling.alwaysReport.includes(error?.severity) ||
        sampling.alwaysReport.includes(error?.constructor?.name) ||
        // Or apply sampling rate
        Math.random() < sampling.rate;

      if (!shouldReport) {
        this.#logger.debug('Error sampled out', {
          errorType: error?.constructor?.name,
          severity: error?.severity
        });
        return;
      }
    }

    const errorReport = this.#createErrorReport(error, context);

    // Add to buffer
    this.#buffer.push(errorReport);

    // Update analytics
    this.#updateAnalytics(errorReport);

    // Check thresholds
    this.#checkThresholds(errorReport);

    // Flush if buffer is full
    if (this.#buffer.length >= this.#batchSize) {
      this.flush();
    }
  }

  /**
   * Flush buffered errors
   *
   * @returns {Promise<void>}
   */
  async flush() {
    if (!this.#enabled || this.#buffer.length === 0) {
      return;
    }

    const errors = [...this.#buffer];
    this.#buffer = [];

    try {
      await this.#sendBatch(errors);
      this.#logger.debug(`Flushed ${errors.length} error reports`);
    } catch (error) {
      this.#logger.error('Failed to send error batch', {
        error: error.message,
        batchSize: errors.length
      });

      // Re-add to buffer if send failed (with limit)
      if (this.#buffer.length < this.#batchSize * 2) {
        this.#buffer.unshift(...errors.slice(0, this.#batchSize));
      }
    }
  }

  /**
   * Generate error report for time range
   *
   * @param {number|null} startTime - Start timestamp (defaults to 24 hours ago)
   * @param {number|null} endTime - End timestamp (defaults to now)
   * @returns {object} Error report with analytics
   */
  generateErrorReport(startTime = null, endTime = null) {
    const now = Date.now();
    startTime = startTime || now - 24 * 60 * 60 * 1000; // Default: last 24 hours
    endTime = endTime || now;

    const report = {
      period: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString()
      },
      summary: {
        totalErrors: this.#analytics.totalReported,
        uniqueErrorTypes: this.#analytics.errorsByType.size,
        topErrors: this.#getTopErrors(5),
        severityBreakdown: Object.fromEntries(this.#analytics.errorsBySeverity),
        hourlyDistribution: this.#getHourlyDistribution(startTime, endTime)
      },
      trends: this.#analyzeTrends(),
      recommendations: this.#generateRecommendations()
    };

    return report;
  }

  /**
   * Get error trends
   *
   * @param {number} hours - Number of hours to look back
   * @returns {Array} Error trend data
   */
  getErrorTrends(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.#analytics.trends.filter(t => t.timestamp > cutoff);
  }

  /**
   * Get top errors
   *
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array} Top errors with counts and percentages
   */
  getTopErrors(limit = 10) {
    return this.#getTopErrors(limit);
  }

  /**
   * Get analytics data
   *
   * @returns {object} Analytics data including error counts by type and severity
   */
  getAnalytics() {
    return {
      totalReported: this.#analytics.totalReported,
      errorsByType: Object.fromEntries(this.#analytics.errorsByType),
      errorsBySeverity: Object.fromEntries(this.#analytics.errorsBySeverity),
      errorsByHour: Object.fromEntries(this.#analytics.errorsByHour),
      trends: [...this.#analytics.trends],
      topErrors: this.#getTopErrors(10)
    };
  }

  /**
   * Send alert
   *
   * @param {string} severity - Alert severity level
   * @param {string} message - Alert message
   * @param {object} details - Additional alert details
   */
  sendAlert(severity, message, details = {}) {
    this.#eventBus.dispatch({
      type: 'ERROR_ALERT',
      payload: {
        severity,
        message,
        details,
        timestamp: Date.now()
      }
    });

    this.#logger.warn(`Error alert: ${message}`, {
      severity,
      details
    });
  }

  // Private methods
  #createErrorReport(error, context) {
    const isBaseError = error instanceof BaseError;
    const config = getErrorConfig();
    const environmentMode = getEnvironmentMode();

    return {
      id: error?.correlationId || this.#generateReportId(),
      timestamp: Date.now(),
      error: isBaseError ? error.toJSON() : {
        name: error?.constructor?.name || 'UnknownError',
        message: error?.message || 'Unknown error',
        stack: config.reporting.includeStackTrace ? error?.stack : undefined,
        code: error?.code
      },
      context: {
        ...context,
        environment: environmentMode,
        userAgent:
          environmentMode === 'test'
            ? 'server'
            : ErrorReporter.resolveUserAgent(),
        url:
          environmentMode === 'test'
            ? 'server'
            : ErrorReporter.resolveCurrentUrl() ?? 'server'
      },
      severity: isBaseError ? error.severity : (error?.severity || 'error'),
      recoverable: isBaseError ? error.recoverable : (error?.recoverable || false)
    };
  }

  async #sendBatch(errors) {
    if (!this.#endpoint) {
      // If no endpoint, just log
      this.#logger.info(`Would send ${errors.length} errors to reporting service`);
      return;
    }

    // In real implementation, this would be an HTTP request
    // For now, we'll simulate it
    this.#logger.info('Sending error batch', {
      endpoint: this.#endpoint,
      batchSize: errors.length,
      batchId: this.#generateReportId(),
      timestamp: Date.now(),
      environment: getEnvironmentMode()
    });

    // Simulate network delay (use immediate resolution for testing)
    await Promise.resolve();

    // Simulate occasional failure for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Network error');
    }
  }

  #updateAnalytics(errorReport) {
    this.#analytics.totalReported++;

    // Update by type
    const errorType = errorReport.error.name;
    const typeCount = this.#analytics.errorsByType.get(errorType) || 0;
    this.#analytics.errorsByType.set(errorType, typeCount + 1);

    // Update by severity
    const severity = errorReport.severity;
    const severityCount = this.#analytics.errorsBySeverity.get(severity) || 0;
    this.#analytics.errorsBySeverity.set(severity, severityCount + 1);

    // Update hourly
    const hour = new Date(errorReport.timestamp).getHours();
    const hourCount = this.#analytics.errorsByHour.get(hour) || 0;
    this.#analytics.errorsByHour.set(hour, hourCount + 1);

    // Update trends (keep last 100)
    this.#analytics.trends.push({
      timestamp: errorReport.timestamp,
      type: errorType,
      severity: severity
    });

    if (this.#analytics.trends.length > 100) {
      this.#analytics.trends.shift();
    }
  }

  #checkThresholds(errorReport) {
    // Check critical error threshold
    const criticalCount = this.#analytics.errorsBySeverity.get('critical') || 0;
    if (criticalCount >= this.#alertThresholds.criticalErrors) {
      this.sendAlert('critical', `Critical error threshold exceeded: ${criticalCount} errors`);
    }

    // Check error rate (errors in last minute)
    const recentErrors = this.#analytics.trends.filter(
      t => Date.now() - t.timestamp < 60000
    ).length;

    if (recentErrors >= this.#alertThresholds.errorRate) {
      this.sendAlert('warning', `High error rate: ${recentErrors} errors in last minute`);
    }

    // Check specific error threshold
    const errorCount = this.#analytics.errorsByType.get(errorReport.error.name);
    if (errorCount >= this.#alertThresholds.specificError) {
      this.sendAlert('warning', `Repeated error: ${errorReport.error.name} occurred ${errorCount} times`);
    }
  }

  #getTopErrors(limit) {
    const sorted = Array.from(this.#analytics.errorsByType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map(([type, count]) => ({
      type,
      count,
      percentage: (count / this.#analytics.totalReported * 100).toFixed(2)
    }));
  }

  #getHourlyDistribution(_startTime, _endTime) {
    const distribution = {};
    for (let i = 0; i < 24; i++) {
      distribution[i] = this.#analytics.errorsByHour.get(i) || 0;
    }
    return distribution;
  }

  #analyzeTrends() {
    if (this.#analytics.trends.length < 20) {
      return { status: 'insufficient_data' };
    }

    const recent = this.#analytics.trends.slice(-10);
    const older = this.#analytics.trends.slice(-20, -10);

    const severityWeights = {
      critical: 4,
      error: 3,
      warning: 2,
      info: 1
    };

    const calculateWindowScore = entries => {
      const totalWeight = entries.reduce(
        (sum, entry) => sum + (severityWeights[entry.severity] ?? 0),
        0
      );

      return totalWeight / entries.length;
    };

    const recentRate = calculateWindowScore(recent);
    const olderRate = calculateWindowScore(older);

    // Only compare if we have full windows
    if (olderRate === 0) {
      return { status: 'insufficient_data' };
    }

    if (recentRate > olderRate * 1.5) {
      return { status: 'increasing', change: '+' + Math.round((recentRate / olderRate - 1) * 100) + '%' };
    } else if (recentRate < olderRate * 0.5) {
      return { status: 'decreasing', change: '-' + Math.round((1 - recentRate / olderRate) * 100) + '%' };
    }

    return { status: 'stable' };
  }

  #generateRecommendations() {
    const recommendations = [];

    // Check for high critical error rate
    const criticalCount = this.#analytics.errorsBySeverity.get('critical') || 0;
    if (criticalCount > 0) {
      recommendations.push({
        priority: 'high',
        message: `Address ${criticalCount} critical errors immediately`
      });
    }

    // Check for repeated errors
    const topErrors = this.#getTopErrors(1);
    if (topErrors.length > 0 && topErrors[0].count > 50) {
      recommendations.push({
        priority: 'medium',
        message: `Investigate root cause of ${topErrors[0].type} (${topErrors[0].count} occurrences)`
      });
    }

    // Check trends
    const trends = this.#analyzeTrends();
    if (trends.status === 'increasing') {
      recommendations.push({
        priority: 'medium',
        message: `Error rate increasing by ${trends.change}, investigate cause`
      });
    }

    return recommendations;
  }

  #startBatchReporting() {
    this.#intervalHandle = setInterval(() => {
      this.flush();
    }, this.#flushInterval);

    this.#logger.debug('Error batch reporting started', {
      interval: this.#flushInterval,
      batchSize: this.#batchSize
    });
  }

  #registerEventListeners() {
    // Listen for generic error events
    this.#eventBus.subscribe('ERROR_OCCURRED', (event) => {
      this.report(event.payload.error || event.payload, event.payload.context || {});
    });

    // Also listen for domain-specific error events (following existing pattern)
    this.#eventBus.subscribe('SYSTEM_ERROR_OCCURRED', (event) => {
      this.report(event.payload.error || event.payload, event.payload.context || {});
    });
  }

  #generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy the error reporter and clean up resources
   */
  destroy() {
    if (this.#intervalHandle) {
      clearInterval(this.#intervalHandle);
      this.#intervalHandle = null;
    }

    this.flush(); // Final flush
    this.#enabled = false;
    this.#logger.info('ErrorReporter destroyed');
  }
}

export default ErrorReporter;