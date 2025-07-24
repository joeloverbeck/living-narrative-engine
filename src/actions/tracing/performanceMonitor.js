/**
 * @file PerformanceMonitor class for real-time trace monitoring
 * @see structuredTrace.js
 * @see analysisTypes.js
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';

/** @typedef {import('./analysisTypes.js').PerformanceThresholds} PerformanceThresholds */
/** @typedef {import('./analysisTypes.js').PerformanceAlert} PerformanceAlert */
/** @typedef {import('./analysisTypes.js').SamplingConfig} SamplingConfig */
/** @typedef {import('./analysisTypes.js').MemoryUsage} MemoryUsage */
/** @typedef {import('./analysisTypes.js').RealtimeMetrics} RealtimeMetrics */
/** @typedef {import('./structuredTrace.js').StructuredTrace} StructuredTrace */

/**
 * @class PerformanceMonitor
 * @description Provides real-time performance monitoring for structured traces
 */
export class PerformanceMonitor {
  #structuredTrace;
  #thresholds;
  #samplingConfig;
  #alerts;
  #isMonitoring;
  #metrics;
  #startTime;

  /**
   * Creates a new PerformanceMonitor instance
   *
   * @param {StructuredTrace} structuredTrace - The structured trace to monitor
   * @param {PerformanceThresholds} [thresholds] - Performance thresholds
   * @throws {Error} If structuredTrace is not provided or invalid
   */
  constructor(structuredTrace, thresholds = {}) {
    validateDependency(structuredTrace, 'StructuredTrace', null, {
      requiredMethods: ['getSpans', 'getActiveSpan'],
    });

    this.#structuredTrace = structuredTrace;
    this.#thresholds = this.#createDefaultThresholds(thresholds);
    this.#samplingConfig = this.#createDefaultSamplingConfig();
    this.#alerts = [];
    this.#isMonitoring = false;
    this.#metrics = this.#initializeMetrics();
    this.#startTime = performance.now();
  }

  /**
   * Creates default performance thresholds
   *
   * @private
   * @param {Partial<PerformanceThresholds>} overrides - Threshold overrides
   * @returns {PerformanceThresholds} Default thresholds with overrides applied
   */
  #createDefaultThresholds(overrides) {
    return {
      slowOperationMs: 100,
      criticalOperationMs: 500,
      maxConcurrency: 10,
      maxTotalDurationMs: 5000,
      maxErrorRate: 5,
      maxMemoryUsageMB: 50,
      ...overrides,
    };
  }

  /**
   * Creates default sampling configuration
   *
   * @private
   * @returns {SamplingConfig} Default sampling config
   */
  #createDefaultSamplingConfig() {
    return {
      rate: 1.0, // Sample all traces by default
      strategy: 'random',
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
      slowThresholdMs: 1000,
    };
  }

  /**
   * Initializes metrics tracking
   *
   * @private
   * @returns {object} Initial metrics object
   */
  #initializeMetrics() {
    return {
      activeSpans: 0,
      completedSpans: 0,
      totalOperations: 0,
      currentConcurrency: 0,
      errorCount: 0,
      currentDuration: 0,
    };
  }

  /**
   * Sets performance thresholds
   *
   * @param {PerformanceThresholds} thresholds - New thresholds
   * @throws {Error} If thresholds are invalid
   */
  setThresholds(thresholds) {
    assertPresent(thresholds, 'Thresholds are required');

    if (typeof thresholds !== 'object') {
      throw new Error('Thresholds must be an object');
    }

    // Validate threshold values
    const numericFields = [
      'slowOperationMs',
      'criticalOperationMs',
      'maxConcurrency',
      'maxTotalDurationMs',
      'maxErrorRate',
      'maxMemoryUsageMB',
    ];

    for (const field of numericFields) {
      if (
        thresholds[field] !== undefined &&
        (typeof thresholds[field] !== 'number' || thresholds[field] < 0)
      ) {
        throw new Error(`${field} must be a non-negative number`);
      }
    }

    this.#thresholds = { ...this.#thresholds, ...thresholds };

    // Generate alert if thresholds changed during monitoring
    if (this.#isMonitoring) {
      this.#generateAlert({
        type: 'threshold_changed',
        severity: 'warning',
        message: 'Performance thresholds updated during monitoring',
        operation: 'Monitor',
        value: 0,
        threshold: 0,
        context: { newThresholds: thresholds },
      });
    }
  }

  /**
   * Enables trace sampling
   *
   * @param {SamplingConfig|number} config - Sampling configuration or rate (0.0-1.0)
   * @throws {Error} If config is invalid
   */
  enableSampling(config) {
    assertPresent(config, 'Sampling config is required');

    if (typeof config === 'number') {
      if (config < 0 || config > 1) {
        throw new Error('Sampling rate must be between 0.0 and 1.0');
      }
      this.#samplingConfig.rate = config;
    } else if (typeof config === 'object' && !Array.isArray(config)) {
      // Validate sampling config
      if (config.rate !== undefined) {
        if (
          typeof config.rate !== 'number' ||
          config.rate < 0 ||
          config.rate > 1
        ) {
          throw new Error('Sampling rate must be between 0.0 and 1.0');
        }
      }

      if (config.strategy !== undefined) {
        const validStrategies = ['random', 'adaptive', 'error_biased'];
        if (!validStrategies.includes(config.strategy)) {
          throw new Error(
            `Invalid sampling strategy. Must be one of: ${validStrategies.join(
              ', '
            )}`
          );
        }
      }

      this.#samplingConfig = { ...this.#samplingConfig, ...config };
    } else {
      throw new Error('Config must be a number or object');
    }
  }

  /**
   * Gets current memory usage of trace storage
   *
   * @returns {MemoryUsage} Memory usage information
   */
  getMemoryUsage() {
    const spans = this.#structuredTrace.getSpans();
    const totalSpans = spans.length;

    if (totalSpans === 0) {
      return {
        totalSpans: 0,
        estimatedSizeBytes: 0,
        estimatedSizeMB: 0,
        averageSpanSize: 0,
        largestSpanSize: 0,
      };
    }

    // Rough estimation of span memory usage
    let totalSize = 0;
    let largestSpanSize = 0;

    for (const span of spans) {
      // Estimate size: base object + strings + attributes
      let spanSize = 200; // Base object overhead

      spanSize += span.operation.length * 2; // String characters (UTF-16)
      spanSize += JSON.stringify(span.attributes).length * 2;

      if (span.error) {
        spanSize += span.error.message.length * 2;
        spanSize += (span.error.stack || '').length * 2;
      }

      totalSize += spanSize;
      largestSpanSize = Math.max(largestSpanSize, spanSize);
    }

    const averageSpanSize = totalSize / totalSpans;
    const estimatedSizeMB = totalSize / (1024 * 1024);

    return {
      totalSpans,
      estimatedSizeBytes: totalSize,
      estimatedSizeMB,
      averageSpanSize,
      largestSpanSize,
    };
  }

  /**
   * Gets real-time performance metrics
   *
   * @returns {RealtimeMetrics} Current performance metrics
   */
  getRealtimeMetrics() {
    const spans = this.#structuredTrace.getSpans();
    const activeSpan = this.#structuredTrace.getActiveSpan();
    const memoryUsage = this.getMemoryUsage();

    // Update current metrics
    this.#metrics.activeSpans = activeSpan ? 1 : 0;
    this.#metrics.completedSpans = spans.filter(
      (span) => span.endTime !== null
    ).length;
    this.#metrics.totalOperations = spans.length;
    this.#metrics.errorCount = spans.filter(
      (span) => span.status === 'error'
    ).length;

    // Calculate current duration
    const rootSpan = spans.find((span) => span.parentId === null);
    if (rootSpan) {
      if (rootSpan.endTime !== null) {
        this.#metrics.currentDuration = rootSpan.duration || 0;
      } else {
        this.#metrics.currentDuration = performance.now() - rootSpan.startTime;
      }
    }

    // Calculate current concurrency (approximate)
    const now = performance.now();
    this.#metrics.currentConcurrency = spans.filter(
      (span) =>
        span.startTime <= now && (span.endTime === null || span.endTime > now)
    ).length;

    return {
      ...this.#metrics,
      recentAlerts: this.#getRecentAlerts(5), // Last 5 alerts
      memoryUsageMB: memoryUsage.estimatedSizeMB,
    };
  }

  /**
   * Gets recent alerts
   *
   * @private
   * @param {number} count - Number of recent alerts to return
   * @returns {PerformanceAlert[]} Recent alerts
   */
  #getRecentAlerts(count) {
    return this.#alerts.slice(-count).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Starts performance monitoring
   *
   * @param {object} [options] - Monitoring options
   * @param {number} [options.intervalMs] - Monitoring interval in milliseconds
   * @returns {Function} Stop monitoring function
   */
  startMonitoring(options = {}) {
    const { intervalMs = 1000 } = options;

    if (this.#isMonitoring) {
      throw new Error('Monitoring is already active');
    }

    this.#isMonitoring = true;
    this.#startTime = performance.now();

    const intervalId = setInterval(() => {
      this.#performMonitoringCheck();
    }, intervalMs);

    // Return stop function
    return () => {
      this.#isMonitoring = false;
      clearInterval(intervalId);

      this.#generateAlert({
        type: 'monitoring_stopped',
        severity: 'warning',
        message: 'Performance monitoring stopped',
        operation: 'Monitor',
        value: performance.now() - this.#startTime,
        threshold: 0,
        context: { duration: performance.now() - this.#startTime },
      });
    };
  }

  /**
   * Performs a monitoring check cycle
   *
   * @private
   */
  #performMonitoringCheck() {
    if (!this.#isMonitoring) {
      return;
    }

    const metrics = this.getRealtimeMetrics();
    const memoryUsage = this.getMemoryUsage();

    // Check for slow operations
    this.#checkSlowOperations();

    // Check concurrency
    if (metrics.currentConcurrency > this.#thresholds.maxConcurrency) {
      this.#generateAlert({
        type: 'high_concurrency',
        severity: 'warning',
        message: `High concurrency detected: ${metrics.currentConcurrency} operations`,
        operation: 'Monitor',
        value: metrics.currentConcurrency,
        threshold: this.#thresholds.maxConcurrency,
        context: { metrics },
      });
    }

    // Check total duration
    if (metrics.currentDuration > this.#thresholds.maxTotalDurationMs) {
      this.#generateAlert({
        type: 'long_trace',
        severity: 'warning',
        message: `Trace duration exceeded threshold: ${metrics.currentDuration.toFixed(
          2
        )}ms`,
        operation: 'Monitor',
        value: metrics.currentDuration,
        threshold: this.#thresholds.maxTotalDurationMs,
        context: { metrics },
      });
    }

    // Check error rate
    if (metrics.totalOperations > 0) {
      const errorRate = (metrics.errorCount / metrics.totalOperations) * 100;
      if (errorRate > this.#thresholds.maxErrorRate) {
        this.#generateAlert({
          type: 'high_error_rate',
          severity: 'critical',
          message: `High error rate: ${errorRate.toFixed(
            1
          )}% (${metrics.errorCount}/${metrics.totalOperations})`,
          operation: 'Monitor',
          value: errorRate,
          threshold: this.#thresholds.maxErrorRate,
          context: { metrics },
        });
      }
    }

    // Check memory usage
    if (memoryUsage.estimatedSizeMB > this.#thresholds.maxMemoryUsageMB) {
      this.#generateAlert({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `High memory usage: ${memoryUsage.estimatedSizeMB.toFixed(
          2
        )}MB`,
        operation: 'Monitor',
        value: memoryUsage.estimatedSizeMB,
        threshold: this.#thresholds.maxMemoryUsageMB,
        context: { memoryUsage },
      });
    }
  }

  /**
   * Checks for slow operations
   *
   * @private
   */
  #checkSlowOperations() {
    const spans = this.#structuredTrace.getSpans();
    const recentWindowMs = this.#thresholds.recentWindowMs || 5000; // Default 5 seconds
    const recentSpans = spans.filter((span) => {
      return span.endTime && span.endTime > performance.now() - recentWindowMs;
    });

    for (const span of recentSpans) {
      if (span.duration >= this.#thresholds.criticalOperationMs) {
        this.#generateAlert({
          type: 'critical_operation',
          severity: 'critical',
          message: `Critical operation duration: ${span.operation} took ${span.duration.toFixed(
            2
          )}ms`,
          operation: span.operation,
          value: span.duration,
          threshold: this.#thresholds.criticalOperationMs,
          context: { spanId: span.id, attributes: span.attributes },
        });
      } else if (span.duration >= this.#thresholds.slowOperationMs) {
        this.#generateAlert({
          type: 'slow_operation',
          severity: 'warning',
          message: `Slow operation detected: ${span.operation} took ${span.duration.toFixed(
            2
          )}ms`,
          operation: span.operation,
          value: span.duration,
          threshold: this.#thresholds.slowOperationMs,
          context: { spanId: span.id, attributes: span.attributes },
        });
      }
    }
  }

  /**
   * Generates and stores a performance alert
   *
   * @private
   * @param {Omit<PerformanceAlert, 'timestamp'>} alertData - Alert data
   */
  #generateAlert(alertData) {
    const alert = {
      ...alertData,
      timestamp: performance.now(),
    };

    this.#alerts.push(alert);

    // Limit stored alerts to prevent memory growth
    if (this.#alerts.length > 100) {
      this.#alerts = this.#alerts.slice(-50); // Keep last 50
    }
  }

  /**
   * Gets all performance alerts
   *
   * @param {object} [filters] - Alert filters
   * @param {string} [filters.type] - Filter by alert type
   * @param {string} [filters.severity] - Filter by severity
   * @param {number} [filters.since] - Get alerts since timestamp
   * @returns {PerformanceAlert[]} Filtered alerts
   */
  getAlerts(filters = {}) {
    let filteredAlerts = [...this.#alerts];

    if (filters.type) {
      filteredAlerts = filteredAlerts.filter(
        (alert) => alert.type === filters.type
      );
    }

    if (filters.severity) {
      filteredAlerts = filteredAlerts.filter(
        (alert) => alert.severity === filters.severity
      );
    }

    if (filters.since) {
      filteredAlerts = filteredAlerts.filter(
        (alert) => alert.timestamp >= filters.since
      );
    }

    return filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clears all stored alerts
   */
  clearAlerts() {
    this.#alerts = [];
  }

  /**
   * Determines whether a trace should be sampled based on current configuration
   *
   * @returns {boolean} Whether to sample this trace
   */
  shouldSampleTrace() {
    const {
      rate,
      strategy,
      alwaysSampleErrors,
      alwaysSampleSlow,
      slowThresholdMs,
    } = this.#samplingConfig;

    // Always sample if rate is 1.0
    if (rate >= 1.0) {
      return true;
    }

    const spans = this.#structuredTrace.getSpans();

    // Always sample if there are errors and alwaysSampleErrors is true
    if (alwaysSampleErrors && spans.some((span) => span.status === 'error')) {
      return true;
    }

    // Always sample if trace is slow and alwaysSampleSlow is true
    if (alwaysSampleSlow) {
      const rootSpan = spans.find((span) => span.parentId === null);
      if (
        rootSpan &&
        rootSpan.duration !== null &&
        rootSpan.duration > slowThresholdMs
      ) {
        return true;
      }
    }

    // Apply sampling strategy
    switch (strategy) {
      case 'random':
        return Math.random() < rate;

      case 'adaptive':
        // Increase sampling rate if we have errors or slow operations
        const hasErrors = spans.some((span) => span.status === 'error');
        const hasSlowOps = spans.some(
          (span) =>
            span.duration !== null &&
            span.duration > this.#thresholds.slowOperationMs
        );
        const adaptiveRate =
          hasErrors || hasSlowOps ? Math.min(rate * 2, 1.0) : rate;
        return Math.random() < adaptiveRate;

      case 'error_biased':
        // Higher sampling rate for traces with errors
        const errorCount = spans.filter(
          (span) => span.status === 'error'
        ).length;
        const errorBiasedRate = Math.min(rate + errorCount * 0.1, 1.0);
        return Math.random() < errorBiasedRate;

      default:
        return Math.random() < rate;
    }
  }

  /**
   * Gets the current monitoring status
   *
   * @returns {object} Monitoring status information
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.#isMonitoring,
      monitoringDuration: this.#isMonitoring
        ? performance.now() - this.#startTime
        : 0,
      thresholds: { ...this.#thresholds },
      samplingConfig: { ...this.#samplingConfig },
      alertCount: this.#alerts.length,
    };
  }
}

export default PerformanceMonitor;
