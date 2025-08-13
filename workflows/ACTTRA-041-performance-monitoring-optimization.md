# ACTTRA-041: Add Performance Monitoring and Optimization

## Summary

Implement comprehensive performance monitoring and optimization for the action tracing system, including metrics collection, resource usage tracking, bottleneck identification, and automatic optimization strategies to maintain minimal system impact.

## Parent Issue

- **Phase**: Cross-cutting Concerns
- **Specification**: [Action Tracing System Implementation Specification](../specs/action-tracing-implementation.spec.md)
- **Overview**: [ACTTRA-000](./ACTTRA-000-implementation-overview.md)

## Description

This ticket focuses on implementing robust performance monitoring and optimization capabilities for the action tracing system. The implementation must provide real-time performance metrics, identify bottlenecks, track resource usage, and automatically optimize performance when thresholds are exceeded. The system should maintain comprehensive performance visibility while ensuring minimal overhead.

## Acceptance Criteria

- [ ] Performance metrics collection system with minimal overhead
- [ ] Real-time monitoring of tracing system performance
- [ ] Resource usage tracking (CPU, memory, disk I/O)
- [ ] Bottleneck identification and alerting
- [ ] Automatic optimization strategies for performance issues
- [ ] Performance profiling integration for detailed analysis
- [ ] Configurable performance thresholds and alerts
- [ ] Performance dashboard for operational monitoring
- [ ] Optimization recommendations based on usage patterns
- [ ] Performance regression detection and prevention

## Technical Requirements

### Performance Metrics Collector

#### File: `src/actions/tracing/monitoring/performanceMetrics.js`

```javascript
/**
 * @file Performance metrics collection for action tracing system
 * @see ./performanceDashboard.js
 */

import { validateDependency } from '../../../utils/validationUtils.js';

/**
 * Performance metric types
 */
export const MetricType = {
  COUNTER: 'counter', // Incremental values (errors, requests)
  GAUGE: 'gauge', // Point-in-time values (memory, CPU)
  HISTOGRAM: 'histogram', // Distribution of values (response times)
  TIMER: 'timer', // Time measurements
};

/**
 * Performance threshold levels
 */
export const ThresholdLevel = {
  INFO: 'info', // Informational, no action needed
  WARNING: 'warning', // Performance degradation detected
  CRITICAL: 'critical', // Immediate action required
};

/**
 * Collects and manages performance metrics for the tracing system
 */
export class PerformanceMetrics {
  #logger;
  #config;
  #metrics;
  #thresholds;
  #collectors;
  #startTime;
  #enabled;

  constructor({ logger, config }) {
    validateDependency(logger, 'ILogger');

    this.#logger = logger;
    this.#config = config || {};
    this.#metrics = new Map();
    this.#thresholds = this.#initializeThresholds();
    this.#collectors = new Map();
    this.#startTime = process.hrtime.bigint();
    this.#enabled = config?.performanceMonitoring?.enabled ?? true;
  }

  /**
   * Initialize the metrics collection system
   */
  initialize() {
    if (!this.#enabled) {
      this.#logger.info('Performance monitoring disabled');
      return;
    }

    this.#setupMetrics();
    this.#startCollectors();

    this.#logger.info('Performance monitoring initialized');
  }

  /**
   * Record a counter metric
   * @param {string} name - Metric name
   * @param {number} value - Value to add (default: 1)
   * @param {Object} tags - Additional tags for the metric
   */
  incrementCounter(name, value = 1, tags = {}) {
    if (!this.#enabled) return;

    const metric = this.#getOrCreateMetric(name, MetricType.COUNTER);
    metric.value += value;
    metric.tags = { ...metric.tags, ...tags };
    metric.lastUpdated = Date.now();

    this.#checkThresholds(name, metric.value);
  }

  /**
   * Set a gauge metric value
   * @param {string} name - Metric name
   * @param {number} value - Current value
   * @param {Object} tags - Additional tags for the metric
   */
  setGauge(name, value, tags = {}) {
    if (!this.#enabled) return;

    const metric = this.#getOrCreateMetric(name, MetricType.GAUGE);
    metric.value = value;
    metric.tags = { ...metric.tags, ...tags };
    metric.lastUpdated = Date.now();

    this.#checkThresholds(name, value);
  }

  /**
   * Record a histogram value
   * @param {string} name - Metric name
   * @param {number} value - Value to record
   * @param {Object} tags - Additional tags for the metric
   */
  recordHistogram(name, value, tags = {}) {
    if (!this.#enabled) return;

    const metric = this.#getOrCreateMetric(name, MetricType.HISTOGRAM);

    if (!metric.values) {
      metric.values = [];
    }

    metric.values.push(value);

    // Keep only last 1000 values to prevent memory growth
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }

    // Calculate statistics
    metric.count = metric.values.length;
    metric.min = Math.min(...metric.values);
    metric.max = Math.max(...metric.values);
    metric.avg =
      metric.values.reduce((sum, v) => sum + v, 0) / metric.values.length;
    metric.p95 = this.#calculatePercentile(metric.values, 0.95);
    metric.p99 = this.#calculatePercentile(metric.values, 0.99);

    metric.tags = { ...metric.tags, ...tags };
    metric.lastUpdated = Date.now();

    this.#checkThresholds(name, metric.avg);
  }

  /**
   * Start a timer and return a function to stop it
   * @param {string} name - Timer name
   * @param {Object} tags - Additional tags for the metric
   * @returns {Function} Function to call to stop the timer
   */
  startTimer(name, tags = {}) {
    if (!this.#enabled) {
      return () => {}; // No-op function
    }

    const startTime = process.hrtime.bigint();

    return () => {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds
      this.recordHistogram(name, duration, tags);
      return duration;
    };
  }

  /**
   * Get current metrics snapshot
   * @returns {Object} Current metrics data
   */
  getMetrics() {
    if (!this.#enabled) {
      return { enabled: false };
    }

    const snapshot = {
      timestamp: Date.now(),
      uptime: Number(process.hrtime.bigint() - this.#startTime) / 1000000000, // Convert to seconds
      metrics: {},
    };

    for (const [name, metric] of this.#metrics) {
      snapshot.metrics[name] = {
        type: metric.type,
        value: metric.value,
        tags: metric.tags,
        lastUpdated: metric.lastUpdated,
      };

      // Add histogram statistics
      if (metric.type === MetricType.HISTOGRAM) {
        snapshot.metrics[name].statistics = {
          count: metric.count,
          min: metric.min,
          max: metric.max,
          avg: metric.avg,
          p95: metric.p95,
          p99: metric.p99,
        };
      }
    }

    return snapshot;
  }

  /**
   * Get performance summary for monitoring dashboard
   * @returns {Object} Performance summary
   */
  getPerformanceSummary() {
    if (!this.#enabled) {
      return { enabled: false };
    }

    const metrics = this.getMetrics();

    return {
      system: {
        uptime: metrics.uptime,
        tracingEnabled: this.#getMetricValue('tracing.enabled', true),
        tracedActions: this.#getMetricValue('tracing.actions.traced', 0),
      },
      performance: {
        avgTraceTime: this.#getHistogramAvg('tracing.trace_time'),
        avgWriteTime: this.#getHistogramAvg('tracing.write_time'),
        errorRate: this.#calculateErrorRate(),
        throughput: this.#calculateThroughput(),
      },
      resources: {
        memoryUsage: this.#getMetricValue('system.memory.tracing'),
        diskUsage: this.#getMetricValue('system.disk.tracing'),
        cpuUsage: this.#getMetricValue('system.cpu.tracing'),
      },
      health: {
        status: this.#getOverallHealthStatus(),
        activeThresholdViolations: this.#getActiveViolations(),
        lastOptimization: this.#getMetricValue('optimization.last_run'),
      },
    };
  }

  /**
   * Configure performance thresholds
   * @param {Object} thresholds - Threshold configuration
   */
  setThresholds(thresholds) {
    this.#thresholds = { ...this.#thresholds, ...thresholds };
    this.#logger.info('Performance thresholds updated', {
      thresholds: Object.keys(thresholds),
    });
  }

  /**
   * Cleanup and shutdown metrics collection
   */
  shutdown() {
    for (const [name, collector] of this.#collectors) {
      clearInterval(collector.interval);
    }
    this.#collectors.clear();
    this.#logger.info('Performance monitoring shutdown');
  }

  #setupMetrics() {
    // Initialize core metrics
    this.#getOrCreateMetric('tracing.actions.traced', MetricType.COUNTER);
    this.#getOrCreateMetric('tracing.actions.filtered', MetricType.COUNTER);
    this.#getOrCreateMetric('tracing.files.written', MetricType.COUNTER);
    this.#getOrCreateMetric('tracing.errors.total', MetricType.COUNTER);
    this.#getOrCreateMetric('tracing.trace_time', MetricType.HISTOGRAM);
    this.#getOrCreateMetric('tracing.write_time', MetricType.HISTOGRAM);
    this.#getOrCreateMetric('tracing.queue.size', MetricType.GAUGE);
    this.#getOrCreateMetric('system.memory.tracing', MetricType.GAUGE);
    this.#getOrCreateMetric('system.cpu.tracing', MetricType.GAUGE);
    this.#getOrCreateMetric('system.disk.tracing', MetricType.GAUGE);
  }

  #startCollectors() {
    // System resource collector
    this.#collectors.set('system', {
      interval: setInterval(() => {
        this.#collectSystemMetrics();
      }, 5000), // Every 5 seconds
    });

    // Throughput calculator
    this.#collectors.set('throughput', {
      interval: setInterval(() => {
        this.#calculateAndRecordThroughput();
      }, 10000), // Every 10 seconds
    });
  }

  #collectSystemMetrics() {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.setGauge('system.memory.heap_used', memUsage.heapUsed);
    this.setGauge('system.memory.heap_total', memUsage.heapTotal);
    this.setGauge('system.memory.external', memUsage.external);

    // CPU usage (approximation based on event loop lag)
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // ms
      this.recordHistogram('system.cpu.event_loop_lag', lag);
    });
  }

  #calculateAndRecordThroughput() {
    const tracedActionsMetric = this.#metrics.get('tracing.actions.traced');
    const now = Date.now();

    if (tracedActionsMetric && tracedActionsMetric.lastThroughputCheck) {
      const timeDiff = (now - tracedActionsMetric.lastThroughputCheck) / 1000; // seconds
      const actionsDiff =
        tracedActionsMetric.value -
        (tracedActionsMetric.lastThroughputValue || 0);
      const throughput = actionsDiff / timeDiff;

      this.setGauge('tracing.throughput.actions_per_second', throughput);
    }

    if (tracedActionsMetric) {
      tracedActionsMetric.lastThroughputCheck = now;
      tracedActionsMetric.lastThroughputValue = tracedActionsMetric.value;
    }
  }

  #getOrCreateMetric(name, type) {
    if (!this.#metrics.has(name)) {
      this.#metrics.set(name, {
        type,
        value: type === MetricType.COUNTER ? 0 : null,
        tags: {},
        created: Date.now(),
        lastUpdated: Date.now(),
      });
    }
    return this.#metrics.get(name);
  }

  #checkThresholds(metricName, value) {
    const threshold = this.#thresholds[metricName];
    if (!threshold) return;

    let level = ThresholdLevel.INFO;
    let violated = false;

    if (threshold.critical !== undefined && value >= threshold.critical) {
      level = ThresholdLevel.CRITICAL;
      violated = true;
    } else if (threshold.warning !== undefined && value >= threshold.warning) {
      level = ThresholdLevel.WARNING;
      violated = true;
    }

    if (violated) {
      this.#logger.warn(`Performance threshold violated: ${metricName}`, {
        metricName,
        value,
        threshold: threshold[level],
        level,
      });

      // Record threshold violation
      this.incrementCounter('performance.threshold_violations', 1, {
        metric: metricName,
        level,
      });
    }
  }

  #calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  #initializeThresholds() {
    return {
      'tracing.trace_time': {
        warning: 5, // 5ms
        critical: 10, // 10ms
      },
      'tracing.write_time': {
        warning: 10, // 10ms
        critical: 50, // 50ms
      },
      'tracing.queue.size': {
        warning: 100,
        critical: 500,
      },
      'system.memory.heap_used': {
        warning: 100 * 1024 * 1024, // 100MB
        critical: 500 * 1024 * 1024, // 500MB
      },
      'system.cpu.event_loop_lag': {
        warning: 10, // 10ms
        critical: 50, // 50ms
      },
      ...this.#config.thresholds,
    };
  }

  #getMetricValue(name, defaultValue = null) {
    const metric = this.#metrics.get(name);
    return metric ? metric.value : defaultValue;
  }

  #getHistogramAvg(name) {
    const metric = this.#metrics.get(name);
    return metric && metric.avg ? metric.avg : 0;
  }

  #calculateErrorRate() {
    const totalActions = this.#getMetricValue('tracing.actions.traced', 1);
    const totalErrors = this.#getMetricValue('tracing.errors.total', 0);
    return totalErrors / totalActions;
  }

  #calculateThroughput() {
    return this.#getMetricValue('tracing.throughput.actions_per_second', 0);
  }

  #getOverallHealthStatus() {
    const violations = this.#getActiveViolations();

    if (violations.critical > 0) return 'critical';
    if (violations.warning > 0) return 'warning';
    return 'healthy';
  }

  #getActiveViolations() {
    // This would track active threshold violations
    // Simplified implementation for now
    return {
      warning: 0,
      critical: 0,
    };
  }
}
```

### Performance Optimizer

#### File: `src/actions/tracing/optimization/performanceOptimizer.js`

```javascript
/**
 * @file Performance optimizer for action tracing system
 * @see ../monitoring/performanceMetrics.js
 */

import { validateDependency } from '../../../utils/validationUtils.js';

/**
 * Optimization strategies
 */
export const OptimizationStrategy = {
  REDUCE_VERBOSITY: 'reduce_verbosity',
  INCREASE_BATCH_SIZE: 'increase_batch_size',
  REDUCE_TRACE_COUNT: 'reduce_trace_count',
  DISABLE_COMPONENT_DATA: 'disable_component_data',
  INCREASE_QUEUE_SIZE: 'increase_queue_size',
  REDUCE_RETENTION: 'reduce_retention',
  EMERGENCY_SHUTDOWN: 'emergency_shutdown',
};

/**
 * Automatically optimizes tracing system performance based on metrics
 */
export class PerformanceOptimizer {
  #logger;
  #performanceMetrics;
  #config;
  #actionTraceFilter;
  #optimizationHistory;
  #enabled;

  constructor({ logger, performanceMetrics, config, actionTraceFilter }) {
    validateDependency(logger, 'ILogger');
    validateDependency(performanceMetrics, 'IPerformanceMetrics');

    this.#logger = logger;
    this.#performanceMetrics = performanceMetrics;
    this.#config = config || {};
    this.#actionTraceFilter = actionTraceFilter;
    this.#optimizationHistory = [];
    this.#enabled = config?.automaticOptimization?.enabled ?? true;
  }

  /**
   * Initialize the optimizer
   */
  initialize() {
    if (!this.#enabled) {
      this.#logger.info('Performance optimization disabled');
      return;
    }

    // Start optimization monitoring
    setInterval(() => {
      this.#checkAndOptimize();
    }, 30000); // Check every 30 seconds

    this.#logger.info('Performance optimizer initialized');
  }

  /**
   * Manually trigger optimization analysis
   * @returns {Promise<Object>} Optimization result
   */
  async optimize() {
    if (!this.#enabled) {
      return { status: 'disabled' };
    }

    const metrics = this.#performanceMetrics.getPerformanceSummary();
    const issues = this.#identifyPerformanceIssues(metrics);

    if (issues.length === 0) {
      return { status: 'no_issues', metrics };
    }

    const strategies = this.#selectOptimizationStrategies(issues);
    const results = [];

    for (const strategy of strategies) {
      try {
        const result = await this.#applyOptimization(strategy);
        results.push(result);

        // Record optimization in history
        this.#optimizationHistory.push({
          timestamp: Date.now(),
          strategy: strategy.type,
          reason: strategy.reason,
          success: result.success,
          metrics: { ...metrics },
        });
      } catch (error) {
        this.#logger.error('Optimization strategy failed', {
          strategy: strategy.type,
          error: error.message,
        });
      }
    }

    return {
      status: 'optimized',
      issues,
      strategies: strategies.map((s) => s.type),
      results,
      metrics,
    };
  }

  /**
   * Get optimization recommendations without applying them
   * @returns {Array} List of recommended optimizations
   */
  getRecommendations() {
    const metrics = this.#performanceMetrics.getPerformanceSummary();
    const issues = this.#identifyPerformanceIssues(metrics);

    if (issues.length === 0) {
      return [];
    }

    return this.#selectOptimizationStrategies(issues);
  }

  /**
   * Get optimization history
   * @returns {Array} Historical optimization data
   */
  getOptimizationHistory() {
    return [...this.#optimizationHistory];
  }

  async #checkAndOptimize() {
    try {
      const result = await this.optimize();

      if (result.status === 'optimized') {
        this.#logger.info('Automatic optimization completed', {
          strategies: result.strategies,
          issuesFound: result.issues.length,
        });
      }
    } catch (error) {
      this.#logger.error('Automatic optimization failed', error);
    }
  }

  #identifyPerformanceIssues(metrics) {
    const issues = [];

    // High trace processing time
    if (metrics.performance.avgTraceTime > 5) {
      issues.push({
        type: 'high_trace_time',
        severity: 'medium',
        value: metrics.performance.avgTraceTime,
        threshold: 5,
        description: 'Average trace processing time exceeds 5ms',
      });
    }

    // High file write time
    if (metrics.performance.avgWriteTime > 10) {
      issues.push({
        type: 'high_write_time',
        severity: 'medium',
        value: metrics.performance.avgWriteTime,
        threshold: 10,
        description: 'Average file write time exceeds 10ms',
      });
    }

    // High error rate
    if (metrics.performance.errorRate > 0.01) {
      issues.push({
        type: 'high_error_rate',
        severity: 'high',
        value: metrics.performance.errorRate,
        threshold: 0.01,
        description: 'Error rate exceeds 1%',
      });
    }

    // High memory usage
    if (metrics.resources.memoryUsage > 100 * 1024 * 1024) {
      issues.push({
        type: 'high_memory_usage',
        severity: 'high',
        value: metrics.resources.memoryUsage,
        threshold: 100 * 1024 * 1024,
        description: 'Memory usage exceeds 100MB',
      });
    }

    // Low throughput with high CPU
    if (
      metrics.performance.throughput < 10 &&
      metrics.resources.cpuUsage > 50
    ) {
      issues.push({
        type: 'low_throughput_high_cpu',
        severity: 'medium',
        throughput: metrics.performance.throughput,
        cpuUsage: metrics.resources.cpuUsage,
        description:
          'Low throughput with high CPU usage indicates inefficiency',
      });
    }

    return issues;
  }

  #selectOptimizationStrategies(issues) {
    const strategies = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'high_trace_time':
          strategies.push({
            type: OptimizationStrategy.REDUCE_VERBOSITY,
            reason: 'Reduce trace processing overhead',
            priority: 2,
            issue,
          });
          break;

        case 'high_write_time':
          strategies.push({
            type: OptimizationStrategy.INCREASE_BATCH_SIZE,
            reason: 'Improve I/O efficiency through batching',
            priority: 2,
            issue,
          });
          break;

        case 'high_error_rate':
          strategies.push({
            type: OptimizationStrategy.REDUCE_TRACE_COUNT,
            reason: 'Reduce system load to prevent errors',
            priority: 1,
            issue,
          });
          break;

        case 'high_memory_usage':
          strategies.push({
            type: OptimizationStrategy.DISABLE_COMPONENT_DATA,
            reason: 'Reduce memory usage by limiting data capture',
            priority: 1,
            issue,
          });
          strategies.push({
            type: OptimizationStrategy.REDUCE_RETENTION,
            reason: 'Free memory by reducing trace retention',
            priority: 2,
            issue,
          });
          break;

        case 'low_throughput_high_cpu':
          strategies.push({
            type: OptimizationStrategy.INCREASE_QUEUE_SIZE,
            reason: 'Reduce processing overhead through larger queues',
            priority: 3,
            issue,
          });
          break;
      }
    }

    // Sort by priority (lower number = higher priority)
    return strategies.sort((a, b) => a.priority - b.priority);
  }

  async #applyOptimization(strategy) {
    this.#logger.info(`Applying optimization: ${strategy.type}`, {
      reason: strategy.reason,
      issue: strategy.issue.type,
    });

    switch (strategy.type) {
      case OptimizationStrategy.REDUCE_VERBOSITY:
        return await this.#reduceVerbosity();

      case OptimizationStrategy.INCREASE_BATCH_SIZE:
        return await this.#increaseBatchSize();

      case OptimizationStrategy.REDUCE_TRACE_COUNT:
        return await this.#reduceTraceCount();

      case OptimizationStrategy.DISABLE_COMPONENT_DATA:
        return await this.#disableComponentData();

      case OptimizationStrategy.INCREASE_QUEUE_SIZE:
        return await this.#increaseQueueSize();

      case OptimizationStrategy.REDUCE_RETENTION:
        return await this.#reduceRetention();

      case OptimizationStrategy.EMERGENCY_SHUTDOWN:
        return await this.#emergencyShutdown();

      default:
        throw new Error(`Unknown optimization strategy: ${strategy.type}`);
    }
  }

  async #reduceVerbosity() {
    // This would interact with the configuration system to reduce verbosity
    this.#logger.info(
      'Optimization: Reduced trace verbosity to improve performance'
    );
    return { success: true, action: 'verbosity_reduced' };
  }

  async #increaseBatchSize() {
    // This would increase the batch size for file writes
    this.#logger.info(
      'Optimization: Increased batch size for better I/O efficiency'
    );
    return { success: true, action: 'batch_size_increased' };
  }

  async #reduceTraceCount() {
    // This would reduce the number of actions being traced
    this.#logger.info('Optimization: Reduced number of traced actions');
    return { success: true, action: 'trace_count_reduced' };
  }

  async #disableComponentData() {
    // This would disable component data collection
    this.#logger.info('Optimization: Disabled component data collection');
    return { success: true, action: 'component_data_disabled' };
  }

  async #increaseQueueSize() {
    // This would increase queue sizes to reduce processing overhead
    this.#logger.info(
      'Optimization: Increased queue size for better throughput'
    );
    return { success: true, action: 'queue_size_increased' };
  }

  async #reduceRetention() {
    // This would reduce trace file retention periods
    this.#logger.info('Optimization: Reduced trace retention period');
    return { success: true, action: 'retention_reduced' };
  }

  async #emergencyShutdown() {
    // This would shut down tracing completely
    this.#logger.error('Emergency optimization: Shutting down tracing system');
    return { success: true, action: 'emergency_shutdown' };
  }
}
```

### Performance Profiler

#### File: `src/actions/tracing/profiling/performanceProfiler.js`

```javascript
/**
 * @file Performance profiler for detailed analysis
 */

/**
 * Detailed performance profiling for the tracing system
 */
export class PerformanceProfiler {
  #profiles;
  #enabled;

  constructor({ enabled = false }) {
    this.#profiles = new Map();
    this.#enabled = enabled;
  }

  /**
   * Start profiling a code section
   * @param {string} name - Profile name
   * @returns {Function} Function to end profiling
   */
  startProfile(name) {
    if (!this.#enabled) {
      return () => {}; // No-op
    }

    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    return () => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();

      const profile = {
        name,
        duration: Number(endTime - startTime) / 1000000, // Convert to milliseconds
        memoryDelta: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
        },
        timestamp: Date.now(),
      };

      this.#profiles.set(`${name}-${Date.now()}`, profile);
      return profile;
    };
  }

  /**
   * Get all collected profiles
   * @returns {Array} Profile data
   */
  getProfiles() {
    return Array.from(this.#profiles.values());
  }

  /**
   * Clear all profiles
   */
  clearProfiles() {
    this.#profiles.clear();
  }

  /**
   * Get profile statistics for a specific operation
   * @param {string} name - Operation name
   * @returns {Object} Statistics
   */
  getProfileStats(name) {
    const profiles = Array.from(this.#profiles.values()).filter(
      (p) => p.name === name
    );

    if (profiles.length === 0) {
      return null;
    }

    const durations = profiles.map((p) => p.duration);
    const memoryDeltas = profiles.map((p) => p.memoryDelta.heapUsed);

    return {
      count: profiles.length,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      },
      memory: {
        min: Math.min(...memoryDeltas),
        max: Math.max(...memoryDeltas),
        avg: memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length,
      },
    };
  }
}
```

### Integration Helpers

#### File: `src/actions/tracing/monitoring/performanceIntegration.js`

```javascript
/**
 * @file Integration helpers for performance monitoring
 */

/**
 * Decorates methods with performance monitoring
 * @param {PerformanceMetrics} metrics - Performance metrics instance
 * @param {string} metricName - Base name for metrics
 */
export function withPerformanceMonitoring(metrics, metricName) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const timer = metrics.startTimer(`${metricName}.duration`);

      try {
        const result = await originalMethod.apply(this, args);
        metrics.incrementCounter(`${metricName}.success`);
        return result;
      } catch (error) {
        metrics.incrementCounter(`${metricName}.error`);
        throw error;
      } finally {
        timer();
      }
    };

    return descriptor;
  };
}

/**
 * Monitors resource usage for a function
 * @param {PerformanceMetrics} metrics - Performance metrics instance
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to monitor
 * @returns {Promise} Function result
 */
export async function monitorResourceUsage(metrics, operation, fn) {
  const startMemory = process.memoryUsage();
  const timer = metrics.startTimer(`${operation}.duration`);

  try {
    const result = await fn();

    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    metrics.recordHistogram(`${operation}.memory_delta`, memoryDelta);
    metrics.incrementCounter(`${operation}.success`);

    return result;
  } catch (error) {
    metrics.incrementCounter(`${operation}.error`);
    throw error;
  } finally {
    timer();
  }
}
```

## Implementation Steps

1. **Create Performance Metrics System** (90 minutes)
   - Implement PerformanceMetrics class with comprehensive metric types
   - Add system resource monitoring and collection
   - Create threshold management and violation detection
   - Implement metric aggregation and statistics

2. **Implement Performance Optimizer** (60 minutes)
   - Create automatic optimization strategies
   - Implement issue detection and analysis
   - Add optimization history tracking
   - Create recommendation system

3. **Add Performance Profiling** (30 minutes)
   - Implement detailed profiling capabilities
   - Add memory and CPU usage tracking
   - Create profiling statistics and analysis
   - Add integration decorators

4. **Create Monitoring Dashboard Integration** (30 minutes)
   - Implement performance summary endpoints
   - Add health check integration
   - Create monitoring dashboard data sources
   - Add alert integration points

5. **Integration and Testing** (20 minutes)
   - Integrate with existing tracing services
   - Add performance monitoring to all components
   - Test optimization strategies
   - Validate monitoring accuracy

## Dependencies

### Depends On

- ACTTRA-039: Setup dependency injection tokens and registration
- ACTTRA-040: Implement error handling and recovery
- Configuration loading system
- Logging infrastructure

### Blocks

- Production performance validation
- System optimization automation
- Monitoring dashboard deployment

### Enables

- Proactive performance management
- Automatic system optimization
- Performance regression detection
- Operational monitoring visibility

## Estimated Effort

- **Estimated Hours**: 4 hours
- **Complexity**: Medium to High
- **Risk**: Medium (performance monitoring overhead)

## Success Metrics

- [ ] Performance metrics collected with <1% overhead
- [ ] Real-time monitoring provides accurate system visibility
- [ ] Automatic optimization prevents performance degradation
- [ ] Resource usage tracking identifies bottlenecks accurately
- [ ] Performance thresholds trigger appropriate alerts
- [ ] Optimization recommendations improve system performance
- [ ] Performance regression detection catches issues early
- [ ] Monitoring dashboard provides operational visibility
- [ ] Profiling data enables detailed performance analysis
- [ ] Integration with existing monitoring systems works seamlessly

## Notes

### Performance Monitoring Philosophy

- **Minimal Overhead**: Monitoring should not impact system performance
- **Actionable Metrics**: All metrics should lead to specific actions
- **Automatic Optimization**: System should self-heal performance issues
- **Predictive Analysis**: Identify issues before they become critical
- **Comprehensive Coverage**: Monitor all aspects of system performance

### Optimization Strategies

- **Graduated Response**: Start with minimal changes, escalate as needed
- **Reversible Changes**: All optimizations should be easily reversed
- **Impact Assessment**: Measure optimization effectiveness
- **Safety First**: Prefer degraded functionality over system failures

### Integration Considerations

- Compatible with existing monitoring infrastructure
- Supports multiple metric backend systems
- Provides standard health check endpoints
- Enables custom alerting and dashboard integration

## Related Files

- Metrics: `src/actions/tracing/monitoring/performanceMetrics.js`
- Optimizer: `src/actions/tracing/optimization/performanceOptimizer.js`
- Profiler: `src/actions/tracing/profiling/performanceProfiler.js`
- Integration: `src/actions/tracing/monitoring/performanceIntegration.js`
- Dashboard: `src/actions/tracing/monitoring/performanceDashboard.js`

---

**Ticket Status**: Ready for Development
**Priority**: High (Cross-cutting Infrastructure)
**Labels**: performance-monitoring, optimization, metrics, cross-cutting, action-tracing, observability
