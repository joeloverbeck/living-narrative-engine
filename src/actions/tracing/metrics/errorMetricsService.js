/**
 * @file Error metrics collection service for action tracing
 * @see ../errors/traceErrorHandler.js
 */

import { ensureValidLogger } from '../../../utils/loggerUtils.js';

/**
 * Service for collecting and tracking error metrics
 */
export class ErrorMetricsService {
  #logger;
  #metrics;
  #errorCounts;
  #lastReset;

  constructor({ logger }) {
    ensureValidLogger(logger);

    this.#logger = logger;
    this.#metrics = new Map();
    this.#errorCounts = new Map();
    this.#lastReset = Date.now();
  }

  /**
   * Record an error occurrence
   *
   * @param {string} errorType - Type of error from TraceErrorType
   * @param {string} severity - Severity level from TraceErrorSeverity
   */
  recordError(errorType, severity) {
    const key = `${errorType}:${severity}`;

    if (!this.#errorCounts.has(key)) {
      this.#errorCounts.set(key, 0);
    }

    this.#errorCounts.set(key, this.#errorCounts.get(key) + 1);

    // Update metrics
    if (!this.#metrics.has(errorType)) {
      this.#metrics.set(errorType, {
        total: 0,
        bySeverity: {},
        lastOccurrence: null,
      });
    }

    const metric = this.#metrics.get(errorType);
    metric.total++;
    metric.bySeverity[severity] = (metric.bySeverity[severity] || 0) + 1;
    metric.lastOccurrence = new Date().toISOString();
  }

  /**
   * Get current error metrics
   *
   * @returns {object} Current metrics summary
   */
  getMetrics() {
    const summary = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      timeSinceReset: Date.now() - this.#lastReset,
    };

    for (const [type, metric] of this.#metrics) {
      summary.totalErrors += metric.total;
      summary.errorsByType[type] = metric.total;

      for (const [severity, count] of Object.entries(metric.bySeverity)) {
        summary.errorsBySeverity[severity] =
          (summary.errorsBySeverity[severity] || 0) + count;
      }
    }

    return summary;
  }

  /**
   * Reset metrics collection
   */
  resetMetrics() {
    this.#metrics.clear();
    this.#errorCounts.clear();
    this.#lastReset = Date.now();
    this.#logger.info('Error metrics reset');
  }

  /**
   * Get error rate for a specific time window
   *
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number} Errors per minute rate
   */
  getErrorRate(windowMs = 60000) {
    const timeSinceReset = Date.now() - this.#lastReset;
    const effectiveWindow = Math.min(windowMs, timeSinceReset);

    if (effectiveWindow === 0) return 0;

    let totalErrors = 0;
    for (const metric of this.#metrics.values()) {
      totalErrors += metric.total;
    }

    // Calculate errors per minute
    return (totalErrors / effectiveWindow) * 60000;
  }
}
