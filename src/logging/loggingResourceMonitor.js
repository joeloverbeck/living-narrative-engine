/**
 * @file LoggingResourceMonitor for tracking resource usage
 * @see loggingPerformanceMonitor.js
 * @see ../utils/monitoring/actionCategorizationPerformanceMonitor.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Monitors resource usage for the logging system
 * Tracks memory, buffer sizes, and generates resource alerts
 */
export class LoggingResourceMonitor {
  #performanceMonitor;
  #logger;
  #resourceHistory;
  #alertThresholds;
  #lastCheckTime;
  #checkInterval;

  /**
   * Creates a new LoggingResourceMonitor instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.performanceMonitor - LoggingPerformanceMonitor instance
   * @param {ILogger} dependencies.logger - Logger for internal use
   * @param {object} [config] - Optional configuration
   */
  constructor({ performanceMonitor, logger }, config = {}) {
    validateDependency(
      performanceMonitor,
      'LoggingPerformanceMonitor',
      undefined,
      {
        requiredMethods: ['getMemoryUsage', 'recordMetric', 'checkThreshold'],
      }
    );

    validateDependency(logger, 'ILogger', undefined, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#performanceMonitor = performanceMonitor;
    this.#logger = logger;

    // Initialize resource tracking
    this.#resourceHistory = [];
    this.#lastCheckTime = performance.now();
    this.#checkInterval = config.checkInterval || 5000; // Check every 5 seconds

    // Define alert thresholds
    this.#alertThresholds = config.alertThresholds || {
      memoryUsageMB: {
        warning: 50,
        critical: 100,
      },
      bufferSize: {
        warning: 750,
        critical: 950,
      },
      heapUsage: {
        warning: 0.7, // 70% of heap limit
        critical: 0.9, // 90% of heap limit
      },
      gcFrequency: {
        warning: 10, // GCs per minute
        critical: 20,
      },
    };

    // Configuration
    this.maxHistorySize = config.maxHistorySize || 1000;
    this.enableGCMonitoring = config.enableGCMonitoring !== false;
  }

  /**
   * Checks current resource usage and generates alerts if needed
   *
   * @returns {object} Resource usage status
   */
  checkResourceUsage() {
    const now = performance.now();
    const timeSinceLastCheck = now - this.#lastCheckTime;

    // Get memory usage from performance monitor
    const memoryUsage = this.#performanceMonitor.getMemoryUsage();

    // Get buffer information
    const bufferInfo = this.#getBufferInfo();

    // Get heap usage if available
    const heapUsage = this.#getHeapUsage();

    // Calculate resource metrics
    const resourceMetrics = {
      timestamp: now,
      memory: {
        usageMB: memoryUsage.estimatedSizeMB,
        totalSpans: memoryUsage.totalSpans,
        averageSpanSize: memoryUsage.averageSpanSize,
        largestSpanSize: memoryUsage.largestSpanSize,
      },
      buffer: {
        size: bufferInfo.size,
        pressure: bufferInfo.pressure,
        maxSize: bufferInfo.maxSize,
      },
      heap: heapUsage,
      gcMetrics: this.#getGCMetrics(timeSinceLastCheck),
    };

    // Check thresholds and generate alerts
    const alerts = this.#checkResourceThresholds(resourceMetrics);

    // Record metrics
    this.#recordResourceMetrics(resourceMetrics);

    // Add to history
    this.#addToHistory(resourceMetrics);

    // Update last check time
    this.#lastCheckTime = now;

    // Generate status
    const status = this.#generateResourceStatus(resourceMetrics, alerts);

    return {
      ...resourceMetrics,
      alerts,
      status,
      recommendations: this.#generateRecommendations(resourceMetrics, alerts),
    };
  }

  /**
   * Gets buffer information from remote logger
   *
   * @private
   * @returns {object} Buffer information
   */
  #getBufferInfo() {
    try {
      // Get buffer size from remote logger
      // Note: This assumes getBufferSize method exists or we track it through metrics
      const bufferSize =
        this.#performanceMonitor.getRecordedMetrics()['buffer.size']?.value ||
        0;
      const maxBufferSize = 1000; // Default max buffer size
      const bufferPressure = (bufferSize / maxBufferSize) * 100;

      return {
        size: bufferSize,
        maxSize: maxBufferSize,
        pressure: bufferPressure,
      };
    } catch (error) {
      this.#logger.warn(
        '[LoggingResourceMonitor] Failed to get buffer info:',
        error
      );
      return {
        size: 0,
        maxSize: 1000,
        pressure: 0,
      };
    }
  }

  /**
   * Gets heap usage information
   *
   * @private
   * @returns {object|null} Heap usage information
   */
  #getHeapUsage() {
    // Check if we're in Node.js environment
    if (typeof globalThis.process !== 'undefined' && globalThis.process.memoryUsage) {
      try {
        const memUsage = globalThis.process.memoryUsage();
        const heapTotal = memUsage.heapTotal;
        const heapUsed = memUsage.heapUsed;

        return {
          usedMB: heapUsed / (1024 * 1024),
          totalMB: heapTotal / (1024 * 1024),
          percentage: (heapUsed / heapTotal) * 100,
          external: memUsage.external / (1024 * 1024),
          rss: memUsage.rss / (1024 * 1024),
        };
      } catch (error) {
        this.#logger.debug(
          '[LoggingResourceMonitor] Unable to get heap usage:',
          error
        );
        return null;
      }
    }

    // Browser environment - try performance.memory if available
    if (typeof performance !== 'undefined' && performance.memory) {
      try {
        return {
          usedMB: performance.memory.usedJSHeapSize / (1024 * 1024),
          totalMB: performance.memory.totalJSHeapSize / (1024 * 1024),
          percentage:
            (performance.memory.usedJSHeapSize /
              performance.memory.totalJSHeapSize) *
            100,
          limit: performance.memory.jsHeapSizeLimit / (1024 * 1024),
        };
      } catch (error) {
        this.#logger.debug(
          '[LoggingResourceMonitor] Unable to get browser memory:',
          error
        );
        return null;
      }
    }

    return null;
  }

  /**
   * Gets garbage collection metrics if available
   *
   * @private
   * @param {number} timeSinceLastCheck - Time since last check in ms
   * @returns {object|null} GC metrics
   */
  #getGCMetrics(timeSinceLastCheck) {
    if (!this.enableGCMonitoring) return null;

    // This would require performance.measureUserAgentSpecificMemory() or similar
    // For now, we'll estimate based on memory changes
    if (this.#resourceHistory.length < 2) return null;

    const recent = this.#resourceHistory.slice(-10);
    const memoryDrops = [];

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];

      if (prev.memory && curr.memory) {
        const drop = prev.memory.usageMB - curr.memory.usageMB;
        if (drop > 1) {
          // Significant memory drop, likely GC
          memoryDrops.push(drop);
        }
      }
    }

    const gcCount = memoryDrops.length;
    const gcFrequency = gcCount / (timeSinceLastCheck / 60000); // GCs per minute

    return {
      estimatedGCs: gcCount,
      frequencyPerMinute: gcFrequency,
      averageReclaimed:
        memoryDrops.length > 0
          ? memoryDrops.reduce((sum, d) => sum + d, 0) / memoryDrops.length
          : 0,
    };
  }

  /**
   * Checks resource thresholds and generates alerts
   *
   * @private
   * @param {object} metrics - Resource metrics
   * @returns {Array} Generated alerts
   */
  #checkResourceThresholds(metrics) {
    const alerts = [];

    // Check memory usage
    if (metrics.memory.usageMB > this.#alertThresholds.memoryUsageMB.critical) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${metrics.memory.usageMB.toFixed(2)}MB`,
        value: metrics.memory.usageMB,
        threshold: this.#alertThresholds.memoryUsageMB.critical,
      });

      // Use performance monitor to record the alert
      this.#performanceMonitor.checkThreshold(
        'memory.usage',
        metrics.memory.usageMB,
        this.#alertThresholds.memoryUsageMB.critical
      );
    } else if (
      metrics.memory.usageMB > this.#alertThresholds.memoryUsageMB.warning
    ) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${metrics.memory.usageMB.toFixed(2)}MB`,
        value: metrics.memory.usageMB,
        threshold: this.#alertThresholds.memoryUsageMB.warning,
      });
    }

    // Check buffer size
    if (metrics.buffer.size > this.#alertThresholds.bufferSize.critical) {
      alerts.push({
        type: 'buffer',
        severity: 'critical',
        message: `Critical buffer size: ${metrics.buffer.size} logs`,
        value: metrics.buffer.size,
        threshold: this.#alertThresholds.bufferSize.critical,
      });
    } else if (metrics.buffer.size > this.#alertThresholds.bufferSize.warning) {
      alerts.push({
        type: 'buffer',
        severity: 'warning',
        message: `High buffer size: ${metrics.buffer.size} logs`,
        value: metrics.buffer.size,
        threshold: this.#alertThresholds.bufferSize.warning,
      });
    }

    // Check heap usage if available
    if (metrics.heap) {
      const heapPercentage = metrics.heap.percentage / 100;

      if (heapPercentage > this.#alertThresholds.heapUsage.critical) {
        alerts.push({
          type: 'heap',
          severity: 'critical',
          message: `Critical heap usage: ${metrics.heap.percentage.toFixed(1)}%`,
          value: heapPercentage,
          threshold: this.#alertThresholds.heapUsage.critical,
        });
      } else if (heapPercentage > this.#alertThresholds.heapUsage.warning) {
        alerts.push({
          type: 'heap',
          severity: 'warning',
          message: `High heap usage: ${metrics.heap.percentage.toFixed(1)}%`,
          value: heapPercentage,
          threshold: this.#alertThresholds.heapUsage.warning,
        });
      }
    }

    // Check GC frequency if available
    if (metrics.gcMetrics && metrics.gcMetrics.frequencyPerMinute > 0) {
      if (
        metrics.gcMetrics.frequencyPerMinute >
        this.#alertThresholds.gcFrequency.critical
      ) {
        alerts.push({
          type: 'gc',
          severity: 'critical',
          message: `High GC frequency: ${metrics.gcMetrics.frequencyPerMinute.toFixed(1)} per minute`,
          value: metrics.gcMetrics.frequencyPerMinute,
          threshold: this.#alertThresholds.gcFrequency.critical,
        });
      } else if (
        metrics.gcMetrics.frequencyPerMinute >
        this.#alertThresholds.gcFrequency.warning
      ) {
        alerts.push({
          type: 'gc',
          severity: 'warning',
          message: `Elevated GC frequency: ${metrics.gcMetrics.frequencyPerMinute.toFixed(1)} per minute`,
          value: metrics.gcMetrics.frequencyPerMinute,
          threshold: this.#alertThresholds.gcFrequency.warning,
        });
      }
    }

    return alerts;
  }

  /**
   * Records resource metrics using performance monitor
   *
   * @private
   * @param {object} metrics - Resource metrics to record
   */
  #recordResourceMetrics(metrics) {
    // Record memory metrics
    this.#performanceMonitor.recordMetric(
      'resource.memory.mb',
      metrics.memory.usageMB
    );
    this.#performanceMonitor.recordMetric(
      'resource.memory.spans',
      metrics.memory.totalSpans
    );

    // Record buffer metrics
    this.#performanceMonitor.recordMetric(
      'resource.buffer.size',
      metrics.buffer.size
    );
    this.#performanceMonitor.recordMetric(
      'resource.buffer.pressure',
      metrics.buffer.pressure
    );

    // Record heap metrics if available
    if (metrics.heap) {
      this.#performanceMonitor.recordMetric(
        'resource.heap.used.mb',
        metrics.heap.usedMB
      );
      this.#performanceMonitor.recordMetric(
        'resource.heap.percentage',
        metrics.heap.percentage
      );
    }

    // Record GC metrics if available
    if (metrics.gcMetrics) {
      this.#performanceMonitor.recordMetric(
        'resource.gc.frequency',
        metrics.gcMetrics.frequencyPerMinute
      );
    }
  }

  /**
   * Generates resource status based on metrics and alerts
   *
   * @private
   * @param {object} metrics - Resource metrics
   * @param {Array} alerts - Current alerts
   * @returns {string} Resource status
   */
  #generateResourceStatus(metrics, alerts) {
    if (alerts.some((a) => a.severity === 'critical')) {
      return 'critical';
    }

    if (alerts.some((a) => a.severity === 'warning')) {
      return 'warning';
    }

    // Check for moderate resource usage
    if (metrics.memory.usageMB > 30 || metrics.buffer.pressure > 50) {
      return 'moderate';
    }

    return 'normal';
  }

  /**
   * Generates recommendations based on resource usage
   *
   * @private
   * @param {object} metrics - Resource metrics
   * @param {Array} alerts - Current alerts
   * @returns {Array} Recommendations
   */
  #generateRecommendations(metrics, alerts) {
    const recommendations = [];

    // Memory recommendations
    if (metrics.memory.usageMB > this.#alertThresholds.memoryUsageMB.warning) {
      recommendations.push({
        category: 'memory',
        priority: alerts.some(
          (a) => a.type === 'memory' && a.severity === 'critical'
        )
          ? 'high'
          : 'medium',
        issue: 'High memory usage detected',
        impact: 'Potential memory pressure and performance degradation',
        suggestion: 'Reduce buffer size or increase flush frequency',
      });

      if (metrics.memory.largestSpanSize > 10000) {
        recommendations.push({
          category: 'memory',
          priority: 'medium',
          issue: 'Large span detected',
          impact: 'Single span consuming significant memory',
          suggestion: 'Review and optimize large trace spans',
        });
      }
    }

    // Buffer recommendations
    if (metrics.buffer.pressure > 75) {
      recommendations.push({
        category: 'buffer',
        priority: 'high',
        issue: 'High buffer pressure',
        impact: 'Risk of buffer overflow and log loss',
        suggestion: 'Increase flush frequency or reduce log volume',
      });
    } else if (metrics.buffer.size < 10 && metrics.buffer.size > 0) {
      recommendations.push({
        category: 'buffer',
        priority: 'low',
        issue: 'Small buffer size',
        impact: 'Increased network overhead',
        suggestion: 'Consider batching more logs before flushing',
      });
    }

    // Heap recommendations
    if (metrics.heap && metrics.heap.percentage > 70) {
      recommendations.push({
        category: 'heap',
        priority: alerts.some(
          (a) => a.type === 'heap' && a.severity === 'critical'
        )
          ? 'critical'
          : 'high',
        issue: 'High heap usage',
        impact: 'Risk of out-of-memory errors',
        suggestion: 'Implement more aggressive cleanup or increase heap size',
      });
    }

    // GC recommendations
    if (
      metrics.gcMetrics &&
      metrics.gcMetrics.frequencyPerMinute >
        this.#alertThresholds.gcFrequency.warning
    ) {
      recommendations.push({
        category: 'gc',
        priority: 'medium',
        issue: 'Frequent garbage collection',
        impact: 'Performance overhead from GC pauses',
        suggestion:
          'Reduce object allocation rate or optimize memory usage patterns',
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Adds metrics to history and manages size
   *
   * @private
   * @param {object} metrics - Metrics to add
   */
  #addToHistory(metrics) {
    this.#resourceHistory.push(metrics);

    if (this.#resourceHistory.length > this.maxHistorySize) {
      this.#resourceHistory = this.#resourceHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Gets resource usage trend over time
   *
   * @param {string} [metric] - Metric to analyze (defaults to 'memory')
   * @param {number} [samples] - Number of samples to analyze (defaults to 10)
   * @returns {object} Trend analysis
   */
  getResourceTrend(metric = 'memory', samples = 10) {
    if (this.#resourceHistory.length < 2) {
      return {
        trend: 'insufficient_data',
        current: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    const recent = this.#resourceHistory.slice(-samples);
    let values = [];

    switch (metric) {
      case 'memory':
        values = recent.map((r) => r.memory.usageMB);
        break;
      case 'buffer':
        values = recent.map((r) => r.buffer.size);
        break;
      case 'heap':
        values = recent
          .map((r) => r.heap?.percentage || 0)
          .filter((v) => v > 0);
        break;
      default:
        values = recent.map((r) => r.memory.usageMB);
    }

    if (values.length === 0) {
      return {
        trend: 'no_data',
        current: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    const current = values[values.length - 1];
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    let trend = 'stable';
    if (change > 10) trend = 'increasing';
    if (change < -10) trend = 'decreasing';

    return {
      trend,
      current,
      average,
      min,
      max,
      change,
      samples: values.length,
    };
  }

  /**
   * Gets current resource summary
   *
   * @returns {object} Resource summary
   */
  getResourceSummary() {
    const latestMetrics =
      this.#resourceHistory[this.#resourceHistory.length - 1];

    if (!latestMetrics) {
      return {
        status: 'unknown',
        memory: 0,
        buffer: 0,
        heap: null,
      };
    }

    return {
      status: this.#generateResourceStatus(latestMetrics, []),
      memory: latestMetrics.memory.usageMB,
      buffer: latestMetrics.buffer.size,
      heap: latestMetrics.heap,
      trends: {
        memory: this.getResourceTrend('memory'),
        buffer: this.getResourceTrend('buffer'),
        heap: this.getResourceTrend('heap'),
      },
    };
  }

  /**
   * Starts automatic resource monitoring
   *
   * @returns {Function} Stop monitoring function
   */
  startMonitoring() {
    const intervalId = setInterval(() => {
      try {
        const status = this.checkResourceUsage();

        if (status.alerts.length > 0) {
          this.#logger.warn(
            '[LoggingResourceMonitor] Resource alerts:',
            status.alerts
          );
        }
      } catch (error) {
        this.#logger.error('[LoggingResourceMonitor] Monitoring error:', error);
      }
    }, this.#checkInterval);

    // Return stop function
    return () => {
      clearInterval(intervalId);
      this.#logger.info('[LoggingResourceMonitor] Monitoring stopped');
    };
  }

  /**
   * Gets buffer information (public method for advisor compatibility)
   *
   * @returns {object} Buffer information
   */
  getBufferInfo() {
    return this.#getBufferInfo();
  }

  /**
   * Gets memory trends analysis
   *
   * @returns {object} Memory trends analysis
   */
  getMemoryTrends() {
    if (this.#resourceHistory.length < 3) {
      return {
        trend: 'stable',
        confidence: 'low',
        recommendation: 'Insufficient data for trend analysis',
      };
    }

    // Get recent memory usage data points
    const recentHistory = this.#resourceHistory.slice(-10);
    const memoryValues = recentHistory.map((entry) => entry.memory.usageMB);

    // Calculate trend
    const firstHalf = memoryValues.slice(
      0,
      Math.floor(memoryValues.length / 2)
    );
    const secondHalf = memoryValues.slice(Math.floor(memoryValues.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    let trend = 'stable';
    let confidence = 'medium';

    if (changePercent > 10) {
      trend = 'increasing';
      confidence = changePercent > 25 ? 'high' : 'medium';
    } else if (changePercent < -10) {
      trend = 'decreasing';
      confidence = changePercent < -25 ? 'high' : 'medium';
    }

    return {
      trend,
      confidence,
      changePercent: Math.round(changePercent * 100) / 100,
      currentAverage: Math.round(secondAvg * 100) / 100,
      previousAverage: Math.round(firstAvg * 100) / 100,
      recommendation: this.#generateTrendRecommendation(trend, changePercent),
    };
  }

  /**
   * Generate recommendation based on memory trend
   *
   * @private
   * @param {string} trend - Trend direction
   * @param {number} changePercent - Percentage change
   * @returns {string} Recommendation
   */
  #generateTrendRecommendation(trend, changePercent) {
    switch (trend) {
      case 'increasing':
        if (changePercent > 25) {
          return 'Memory usage is increasing rapidly. Consider reducing log buffer sizes or increasing flush frequency.';
        }
        return 'Memory usage is gradually increasing. Monitor and consider optimization if trend continues.';
      case 'decreasing':
        return 'Memory usage is decreasing. Current optimization strategies are effective.';
      default:
        return 'Memory usage is stable. Current configuration appears optimal.';
    }
  }
}

export default LoggingResourceMonitor;
