/**
 * @file MonitoringCoordinator - Coordinates all monitoring activities
 * @module MonitoringCoordinator
 */

import PerformanceMonitor from './PerformanceMonitor.js';
import CircuitBreaker from './CircuitBreaker.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { getGlobalConfig, isConfigInitialized } from '../utils/configUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} MonitoringStats
 * @property {object} performance - Performance metrics
 * @property {object} circuitBreakers - Circuit breaker statistics
 * @property {number} totalOperations - Total operations across all monitors
 * @property {number} totalFailures - Total failures across all circuit breakers
 * @property {Array} recentAlerts - Recent monitoring alerts
 */

/**
 * @class MonitoringCoordinator
 * @description Coordinates performance monitoring and circuit breaker functionality
 */
export default class MonitoringCoordinator {
  /** @type {ILogger} */
  #logger;
  /** @type {PerformanceMonitor} */
  #performanceMonitor;
  /** @type {Map<string, CircuitBreaker>} */
  #circuitBreakers;
  /** @type {Array<{type: string, message: string, timestamp: number}>} */
  #alerts;
  /** @type {boolean} */
  #enabled;
  /** @type {number} */
  #checkInterval;
  /** @type {NodeJS.Timeout} */
  #intervalHandle;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {boolean} [deps.enabled] - Whether monitoring is enabled
   * @param {number} [deps.checkInterval] - Health check interval in ms
   */
  constructor({ logger, enabled = true, checkInterval = 30000 }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'MonitoringCoordinator');

    // Apply configuration overrides if available
    const config = isConfigInitialized() ? getGlobalConfig() : null;
    this.#enabled = config?.isFeatureEnabled('performance.ENABLE_MONITORING') ?? enabled;
    this.#checkInterval = checkInterval;

    // Initialize monitoring components
    this.#performanceMonitor = new PerformanceMonitor({ logger: this.#logger });
    this.#circuitBreakers = new Map();
    this.#alerts = [];

    // Start health checks if enabled
    if (this.#enabled) {
      this.#startHealthChecks();
    }

    this.#logger.info('MonitoringCoordinator initialized', {
      enabled: this.#enabled,
      checkInterval: this.#checkInterval,
    });
  }

  /**
   * Gets the performance monitor instance.
   *
   * @returns {PerformanceMonitor} Performance monitor
   */
  getPerformanceMonitor() {
    return this.#performanceMonitor;
  }

  /**
   * Creates or gets a circuit breaker for a specific operation.
   *
   * @param {string} name - Circuit breaker name
   * @param {object} [options] - Circuit breaker options
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.#circuitBreakers.has(name)) {
      const circuitBreaker = new CircuitBreaker({
        logger: this.#logger,
        options: { ...options, name },
      });
      this.#circuitBreakers.set(name, circuitBreaker);
      this.#logger.debug(`Created circuit breaker: ${name}`);
    }
    return this.#circuitBreakers.get(name);
  }

  /**
   * Executes an operation with full monitoring (performance + circuit breaker).
   *
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Operation to execute
   * @param {object} [options] - Monitoring options
   * @param {string} [options.context] - Additional context
   * @param {boolean} [options.useCircuitBreaker] - Whether to use circuit breaker
   * @param {object} [options.circuitBreakerOptions] - Circuit breaker options
   * @returns {Promise<*>} Result of the operation
   */
  async executeMonitored(operationName, operation, options = {}) {
    const {
      context = '',
      useCircuitBreaker = true,
      circuitBreakerOptions = {},
    } = options;

    if (!this.#enabled) {
      return await operation();
    }

    const circuitBreaker = useCircuitBreaker 
      ? this.getCircuitBreaker(operationName, circuitBreakerOptions)
      : null;

    const wrappedOperation = async () => {
      return await this.#performanceMonitor.timeOperation(
        operationName,
        operation,
        context
      );
    };

    if (circuitBreaker) {
      return await circuitBreaker.execute(wrappedOperation);
    } else {
      return await wrappedOperation();
    }
  }

  /**
   * Executes a synchronous operation with full monitoring.
   *
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Operation to execute
   * @param {object} [options] - Monitoring options
   * @returns {*} Result of the operation
   */
  executeSyncMonitored(operationName, operation, options = {}) {
    const {
      context = '',
      useCircuitBreaker = true,
      circuitBreakerOptions = {},
    } = options;

    if (!this.#enabled) {
      return operation();
    }

    const circuitBreaker = useCircuitBreaker 
      ? this.getCircuitBreaker(operationName, circuitBreakerOptions)
      : null;

    const wrappedOperation = () => {
      return this.#performanceMonitor.timeSync(
        operationName,
        operation,
        context
      );
    };

    if (circuitBreaker) {
      return circuitBreaker.executeSync(wrappedOperation);
    } else {
      return wrappedOperation();
    }
  }

  /**
   * Starts a performance timer.
   *
   * @param {string} operation - Operation name
   * @param {string} [context] - Optional context
   * @returns {string} Timer ID
   */
  startTimer(operation, context = '') {
    return this.#performanceMonitor.startTimer(operation, context);
  }

  /**
   * Stops a performance timer.
   *
   * @param {string} timerId - Timer ID
   * @returns {number} Operation duration
   */
  stopTimer(timerId) {
    return this.#performanceMonitor.stopTimer(timerId);
  }

  /**
   * Gets comprehensive monitoring statistics.
   *
   * @returns {MonitoringStats} Monitoring statistics
   */
  getStats() {
    const performanceMetrics = this.#performanceMonitor.getMetrics();
    const circuitBreakerStats = {};
    let totalFailures = 0;

    for (const [name, circuitBreaker] of this.#circuitBreakers) {
      const stats = circuitBreaker.getStats();
      circuitBreakerStats[name] = stats;
      totalFailures += stats.totalFailures;
    }

    return {
      performance: performanceMetrics,
      circuitBreakers: circuitBreakerStats,
      totalOperations: performanceMetrics.totalOperations,
      totalFailures,
      recentAlerts: this.#alerts.slice(-10),
      enabled: this.#enabled,
      healthChecksActive: this.#intervalHandle !== null,
    };
  }

  /**
   * Starts periodic health checks.
   */
  #startHealthChecks() {
    if (this.#intervalHandle) {
      clearInterval(this.#intervalHandle);
    }

    this.#intervalHandle = setInterval(() => {
      this.#performHealthCheck();
    }, this.#checkInterval);

    this.#logger.debug('Health checks started', {
      interval: this.#checkInterval,
    });
  }

  /**
   * Stops periodic health checks.
   */
  #stopHealthChecks() {
    if (this.#intervalHandle) {
      clearInterval(this.#intervalHandle);
      this.#intervalHandle = null;
    }
    this.#logger.debug('Health checks stopped');
  }

  /**
   * Performs a health check.
   */
  #performHealthCheck() {
    try {
      // Check memory usage
      this.#performanceMonitor.checkMemoryUsage();

      // Check circuit breaker states
      this.#checkCircuitBreakerHealth();

      // Check for performance degradation
      this.#checkPerformanceDegradation();

      // Clean up old alerts
      this.#cleanupOldAlerts();
    } catch (error) {
      this.#logger.error('Health check failed:', error);
    }
  }

  /**
   * Checks circuit breaker health.
   */
  #checkCircuitBreakerHealth() {
    for (const [name, circuitBreaker] of this.#circuitBreakers) {
      const stats = circuitBreaker.getStats();
      
      if (stats.state === 'OPEN') {
        this.#addAlert('warning', `Circuit breaker '${name}' is OPEN`);
      } else if (stats.state === 'HALF_OPEN') {
        this.#addAlert('info', `Circuit breaker '${name}' is HALF_OPEN`);
      }

      // Check failure rate
      if (stats.totalRequests > 10) {
        const failureRate = stats.totalFailures / stats.totalRequests;
        if (failureRate > 0.5) {
          this.#addAlert('warning', `High failure rate (${Math.round(failureRate * 100)}%) for circuit breaker '${name}'`);
        }
      }
    }
  }

  /**
   * Checks for performance degradation.
   */
  #checkPerformanceDegradation() {
    const metrics = this.#performanceMonitor.getMetrics();
    
    // Check for high average operation time
    const config = isConfigInitialized() ? getGlobalConfig() : null;
    const slowThreshold = config?.getValue('performance.SLOW_OPERATION_THRESHOLD') ?? 100;
    
    if (metrics.averageOperationTime > slowThreshold * 2) {
      this.#addAlert('warning', `High average operation time: ${metrics.averageOperationTime.toFixed(2)}ms`);
    }

    // Check for high percentage of slow operations
    if (metrics.totalOperations > 0) {
      const slowOperationRate = metrics.slowOperations / metrics.totalOperations;
      if (slowOperationRate > 0.2) {
        this.#addAlert('warning', `High slow operation rate: ${Math.round(slowOperationRate * 100)}%`);
      }
    }
  }

  /**
   * Adds a monitoring alert.
   *
   * @param {string} type - Alert type (info, warning, error)
   * @param {string} message - Alert message
   */
  #addAlert(type, message) {
    this.#alerts.push({
      type,
      message,
      timestamp: Date.now(),
    });

    // Log the alert
    this.#logger[type](`Monitoring alert: ${message}`);
  }

  /**
   * Cleans up old alerts.
   */
  #cleanupOldAlerts() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxAge;
    
    this.#alerts = this.#alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Gets a comprehensive monitoring report.
   *
   * @returns {string} Monitoring report
   */
  getMonitoringReport() {
    if (!this.#enabled) {
      return 'Monitoring is disabled';
    }

    const stats = this.getStats();
    const report = [];

    report.push('Entity Module Monitoring Report');
    report.push('=' .repeat(40));
    report.push(`Monitoring Status: ${this.#enabled ? 'Enabled' : 'Disabled'}`);
    report.push(`Health Checks: ${stats.healthChecksActive ? 'Active' : 'Inactive'}`);
    report.push('');

    // Performance section
    report.push('Performance Metrics:');
    report.push(`  Total Operations: ${stats.performance.totalOperations}`);
    report.push(`  Slow Operations: ${stats.performance.slowOperations}`);
    report.push(`  Average Time: ${stats.performance.averageOperationTime.toFixed(2)}ms`);
    report.push(`  Max Time: ${stats.performance.maxOperationTime.toFixed(2)}ms`);
    report.push(`  Memory Warnings: ${stats.performance.memoryUsageWarnings}`);
    report.push('');

    // Circuit breaker section
    report.push('Circuit Breakers:');
    if (Object.keys(stats.circuitBreakers).length === 0) {
      report.push('  No circuit breakers active');
    } else {
      for (const [name, cbStats] of Object.entries(stats.circuitBreakers)) {
        report.push(`  ${name}: ${cbStats.state} (${cbStats.totalFailures}/${cbStats.totalRequests} failures)`);
      }
    }
    report.push('');

    // Recent alerts
    report.push('Recent Alerts:');
    if (stats.recentAlerts.length === 0) {
      report.push('  No recent alerts');
    } else {
      for (const alert of stats.recentAlerts.slice(-5)) {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        report.push(`  [${time}] ${alert.type.toUpperCase()}: ${alert.message}`);
      }
    }

    return report.join('\n');
  }

  /**
   * Enables or disables monitoring.
   *
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setEnabled(enabled) {
    this.#enabled = enabled;
    this.#performanceMonitor.setEnabled(enabled);
    
    for (const circuitBreaker of this.#circuitBreakers.values()) {
      circuitBreaker.setEnabled(enabled);
    }

    if (enabled) {
      this.#startHealthChecks();
    } else {
      this.#stopHealthChecks();
    }

    this.#logger.info(`Monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Resets all monitoring data.
   */
  reset() {
    this.#performanceMonitor.reset();
    this.#circuitBreakers.clear();
    this.#alerts = [];
    this.#logger.info('Monitoring data reset');
  }

  /**
   * Closes the monitoring coordinator and cleans up resources.
   */
  close() {
    this.#stopHealthChecks();
    this.#logger.info('MonitoringCoordinator closed');
  }
}