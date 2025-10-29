/**
 * @file PerformanceMonitor - Performance monitoring and metrics collection
 * @module PerformanceMonitor
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
// Browser-compatible process detection
const process = globalThis.process || {
  memoryUsage: () => ({ heapUsed: 0, heapTotal: 0 }),
};

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} OperationTimer
 * @property {string} operation - Operation name
 * @property {number} startTime - Start time in milliseconds
 * @property {string} [context] - Optional context information
 */

/**
 * @typedef {object} PerformanceMetrics
 * @property {number} totalOperations - Total number of operations
 * @property {number} slowOperations - Number of slow operations
 * @property {number} averageOperationTime - Average operation time in ms
 * @property {number} maxOperationTime - Maximum operation time in ms
 * @property {number} minOperationTime - Minimum operation time in ms
 * @property {object} operationCounts - Count of operations by type
 * @property {object} slowOperationsByType - Slow operations by type
 * @property {number} memoryUsageWarnings - Number of memory usage warnings
 * @property {number} activeTimers - Number of active timers
 */

/**
 * @class PerformanceMonitor
 * @description Monitors and tracks performance metrics for entity operations
 */
export default class PerformanceMonitor {
  /** @type {ILogger} */
  #logger;
  /** @type {boolean} */
  #enabled;
  /** @type {number} */
  #slowOperationThreshold;
  /** @type {Map<string, OperationTimer>} */
  #activeTimers;
  /** @type {Array<{operation: string, duration: number, timestamp: number, context?: string}>} */
  #operationHistory;
  /** @type {number} */
  #maxHistorySize;
  /** @type {object} */
  #operationCounts;
  /** @type {object} */
  #slowOperationCounts;
  /** @type {Array<number>} */
  #operationTimes;
  /** @type {number} */
  #memoryUsageWarnings;

  /**
   * Creates a new PerformanceMonitor instance.
   *
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {boolean} [deps.enabled] - Whether monitoring is enabled
   * @param {number} [deps.slowOperationThreshold] - Threshold for slow operations (ms)
   * @param {number} [deps.maxHistorySize] - Maximum history size
   */
  constructor({
    logger,
    enabled = true,
    slowOperationThreshold = 100,
    maxHistorySize = 1000,
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'PerformanceMonitor');

    this.#enabled = enabled;
    this.#slowOperationThreshold = slowOperationThreshold;
    this.#maxHistorySize = maxHistorySize;

    // Initialize tracking structures
    this.#activeTimers = new Map();
    this.#operationHistory = [];
    this.#operationCounts = {};
    this.#slowOperationCounts = {};
    this.#operationTimes = [];
    this.#memoryUsageWarnings = 0;

    this.#logger.debug('PerformanceMonitor initialized', {
      enabled: this.#enabled,
      slowOperationThreshold: this.#slowOperationThreshold,
      maxHistorySize: this.#maxHistorySize,
    });
  }

  /**
   * Starts timing an operation.
   *
   * @param {string} operation - Operation name
   * @param {string} [context] - Optional context information
   * @returns {string|null} Timer ID for stopping the timer
   */
  startTimer(operation, context = '') {
    if (!this.#enabled) {
      return null;
    }

    const timerId = `${operation}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timer = {
      operation,
      startTime: performance.now(),
      context,
    };

    this.#activeTimers.set(timerId, timer);

    return timerId;
  }

  /**
   * Stops timing an operation.
   *
   * @param {string} timerId - Timer ID from startTimer
   * @returns {number|null} Operation duration in milliseconds
   */
  stopTimer(timerId) {
    if (!this.#enabled || !timerId) {
      return null;
    }

    const timer = this.#activeTimers.get(timerId);
    if (!timer) {
      this.#logger.warn(`Timer not found: ${timerId}`);
      return null;
    }

    const duration = performance.now() - timer.startTime;
    this.#activeTimers.delete(timerId);

    // Record the operation
    this.#recordOperation(timer.operation, duration, timer.context);

    return duration;
  }

  /**
   * Times an operation using a function wrapper.
   *
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to time
   * @param {string} [context] - Optional context information
   * @returns {Promise<*>} Result of the function
   */
  async timeOperation(operation, fn, context = '') {
    if (!this.#enabled) {
      return await fn();
    }

    const timerId = this.startTimer(operation, context);

    try {
      const result = await fn();
      this.stopTimer(timerId);
      return result;
    } catch (error) {
      this.stopTimer(timerId);
      this.#logger.error(`Operation ${operation} failed:`, error);
      throw error;
    }
  }

  /**
   * Times a synchronous operation.
   *
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to time
   * @param {string} [context] - Optional context information
   * @returns {*} Result of the function
   */
  timeSync(operation, fn, context = '') {
    if (!this.#enabled) {
      return fn();
    }

    const timerId = this.startTimer(operation, context);

    try {
      const result = fn();
      this.stopTimer(timerId);
      return result;
    } catch (error) {
      this.stopTimer(timerId);
      this.#logger.error(`Sync operation ${operation} failed:`, error);
      throw error;
    }
  }

  /**
   * Records an operation manually.
   *
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {string} [context] - Optional context information
  */
  #recordOperation(operation, duration, context = '') {
    // Update operation counts
    this.#operationCounts[operation] =
      (this.#operationCounts[operation] || 0) + 1;

    // Track operation times
    this.#operationTimes.push(duration);

    // Check if it's a slow operation
    if (duration > this.#slowOperationThreshold) {
      this.#slowOperationCounts[operation] =
        (this.#slowOperationCounts[operation] || 0) + 1;
      this.#logger.warn(
        `Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`,
        {
          operation,
          duration,
          context,
          threshold: this.#slowOperationThreshold,
        }
      );
    }

    // Add to history
    this.#operationHistory.push({
      operation,
      duration,
      timestamp: Date.now(),
      context,
    });

    // Trim history if needed
    if (this.#operationHistory.length > this.#maxHistorySize) {
      this.#operationHistory.shift();
    }
  }

  /**
   * Gets current performance metrics.
   *
   * @returns {PerformanceMetrics} Performance metrics
   */
  getMetrics() {
    if (!this.#enabled) {
      return this.#getEmptyMetrics();
    }

    const totalOperations = this.#operationTimes.length;
    const slowOperations = Object.values(this.#slowOperationCounts).reduce(
      (a, b) => a + b,
      0
    );

    let averageOperationTime = 0;
    let maxOperationTime = 0;
    let minOperationTime = Infinity;

    if (totalOperations > 0) {
      averageOperationTime =
        this.#operationTimes.reduce((a, b) => a + b, 0) / totalOperations;
      // Use reduce to avoid stack overflow with large arrays
      // Spreading large arrays as function arguments can exceed JS argument limit
      maxOperationTime = this.#operationTimes.reduce((max, time) => Math.max(max, time), -Infinity);
      minOperationTime = this.#operationTimes.reduce((min, time) => Math.min(min, time), Infinity);
    }

    return {
      totalOperations,
      slowOperations,
      averageOperationTime,
      maxOperationTime,
      minOperationTime: minOperationTime === Infinity ? 0 : minOperationTime,
      operationCounts: { ...this.#operationCounts },
      slowOperationsByType: { ...this.#slowOperationCounts },
      memoryUsageWarnings: this.#memoryUsageWarnings,
      activeTimers: this.#activeTimers.size,
    };
  }

  /**
   * Gets empty metrics when monitoring is disabled.
   *
   * @returns {PerformanceMetrics} Empty metrics
   */
  #getEmptyMetrics() {
    return {
      totalOperations: 0,
      slowOperations: 0,
      averageOperationTime: 0,
      maxOperationTime: 0,
      minOperationTime: 0,
      operationCounts: {},
      slowOperationsByType: {},
      memoryUsageWarnings: 0,
      activeTimers: 0,
    };
  }

  /**
   * Gets recent operation history.
   *
   * @param {number} [limit] - Maximum number of operations to return
   * @returns {Array<object>} Recent operations
   */
  getRecentOperations(limit = 100) {
    if (!this.#enabled) {
      return [];
    }

    return this.#operationHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gets operations by type.
   *
   * @param {string} operation - Operation name
   * @param {number} [limit] - Maximum number of operations to return
   * @returns {Array<object>} Operations of the specified type
   */
  getOperationsByType(operation, limit = 50) {
    if (!this.#enabled) {
      return [];
    }

    return this.#operationHistory
      .filter((op) => op.operation === operation)
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gets slow operations.
   *
   * @param {number} [limit] - Maximum number of operations to return
   * @returns {Array<object>} Slow operations
   */
  getSlowOperations(limit = 50) {
    if (!this.#enabled) {
      return [];
    }

    return this.#operationHistory
      .filter((op) => op.duration > this.#slowOperationThreshold)
      .slice(-limit)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Checks current memory usage and logs warnings if needed.
   */
  checkMemoryUsage() {
    if (!this.#enabled) {
      return;
    }

    const memoryUsage = process.memoryUsage();
    const warningThreshold = 0.8; // Default warning threshold

    // Approximate memory limit (this is a simplified check)
    const memoryLimit = 1024 * 1024 * 1024; // 1GB as default
    const currentUsage = memoryUsage.heapUsed / memoryLimit;

    if (currentUsage > warningThreshold) {
      this.#memoryUsageWarnings++;
      this.#logger.warn('High memory usage detected', {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        usagePercentage: Math.round(currentUsage * 100) + '%',
        threshold: Math.round(warningThreshold * 100) + '%',
      });
    }
  }

  /**
   * Resets all performance metrics.
   */
  reset() {
    this.#activeTimers.clear();
    this.#operationHistory = [];
    this.#operationCounts = {};
    this.#slowOperationCounts = {};
    this.#operationTimes = [];
    this.#memoryUsageWarnings = 0;

    this.#logger.info('Performance metrics reset');
  }

  /**
   * Enables or disables monitoring.
   *
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setEnabled(enabled) {
    this.#enabled = enabled;
    this.#logger.info(
      `Performance monitoring ${enabled ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Sets the slow operation threshold.
   *
   * @param {number} threshold - Threshold in milliseconds
   */
  setSlowOperationThreshold(threshold) {
    this.#slowOperationThreshold = threshold;
    this.#logger.info(`Slow operation threshold set to ${threshold}ms`);
  }

  /**
   * Gets a performance summary report.
   *
   * @returns {string} Performance report
   */
  getPerformanceReport() {
    if (!this.#enabled) {
      return 'Performance monitoring is disabled';
    }

    const metrics = this.getMetrics();
    const slowOps = this.getSlowOperations(5);

    const report = [
      'Performance Monitor Report',
      '='.repeat(30),
      `Total Operations: ${metrics.totalOperations}`,
      `Slow Operations: ${metrics.slowOperations}`,
      `Average Time: ${metrics.averageOperationTime.toFixed(2)}ms`,
      `Max Time: ${metrics.maxOperationTime.toFixed(2)}ms`,
      `Min Time: ${metrics.minOperationTime.toFixed(2)}ms`,
      `Memory Warnings: ${metrics.memoryUsageWarnings}`,
      `Active Timers: ${metrics.activeTimers}`,
      '',
      'Top Operations:',
      ...Object.entries(metrics.operationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([op, count]) => `  ${op}: ${count}`),
      '',
      'Slow Operations by Type:',
      ...Object.entries(metrics.slowOperationsByType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([op, count]) => `  ${op}: ${count}`),
      '',
      'Recent Slow Operations:',
      ...slowOps
        .slice(0, 3)
        .map(
          (op) =>
            `  ${op.operation}: ${op.duration.toFixed(2)}ms (${new Date(op.timestamp).toISOString()})`
        ),
    ];

    return report.join('\n');
  }
}
