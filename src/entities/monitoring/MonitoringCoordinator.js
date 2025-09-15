/**
 * @file MonitoringCoordinator - Coordinates all monitoring activities
 * @module MonitoringCoordinator
 */

import PerformanceMonitor from './PerformanceMonitor.js';
import CircuitBreaker from './CircuitBreaker.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('./MemoryMonitor.js').default} MemoryMonitor */
/** @typedef {import('./MemoryPressureManager.js').default} MemoryPressureManager */
/** @typedef {import('./MemoryReporter.js').default} MemoryReporter */

/**
 * @typedef {object} MonitoringStats
 * @property {object} performance - Performance metrics
 * @property {object} circuitBreakers - Circuit breaker statistics
 * @property {object} memory - Memory monitoring statistics
 * @property {number} totalOperations - Total operations across all monitors
 * @property {number} totalFailures - Total failures across all circuit breakers
 * @property {Array} recentAlerts - Recent monitoring alerts
 */

/**
 * @class MonitoringCoordinator
 * @description Coordinates performance, memory monitoring, and circuit breaker functionality
 */
export default class MonitoringCoordinator {
  /** @type {ILogger} */
  #logger;
  /** @type {PerformanceMonitor} */
  #performanceMonitor;
  /** @type {Map<string, CircuitBreaker>} */
  #circuitBreakers;
  /** @type {MemoryMonitor|null} */
  #memoryMonitor;
  /** @type {MemoryPressureManager|null} */
  #memoryPressureManager;
  /** @type {MemoryReporter|null} */
  #memoryReporter;
  /** @type {Array<{type: string, message: string, timestamp: number}>} */
  #alerts;
  /** @type {boolean} */
  #enabled;
  /** @type {number} */
  #checkInterval;
  /** @type {number|null} */
  #intervalHandle;
  /** @type {object} */
  #defaultCircuitBreakerOptions;

  /**
   * Creates a new MonitoringCoordinator instance.
   *
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IEventBus} [deps.eventBus] - Event bus for memory monitoring
   * @param {MemoryMonitor} [deps.memoryMonitor] - Memory monitor instance
   * @param {MemoryPressureManager} [deps.memoryPressureManager] - Memory pressure manager
   * @param {MemoryReporter} [deps.memoryReporter] - Memory reporter instance
   * @param {boolean} [deps.enabled] - Whether monitoring is enabled
   * @param {number} [deps.checkInterval] - Health check interval in ms
   * @param {object} [deps.circuitBreakerOptions] - Default circuit breaker options
   */
  constructor({
    logger,
    eventBus,
    memoryMonitor,
    memoryPressureManager,
    memoryReporter,
    enabled = true,
    checkInterval = 30000,
    circuitBreakerOptions = {},
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'MonitoringCoordinator');

    // Validate optional memory monitoring dependencies
    if (eventBus) {
      validateDependency(eventBus, 'IEventBus', logger, {
        requiredMethods: ['dispatch', 'on'],
      });
    }

    this.#enabled = enabled;
    this.#checkInterval = checkInterval;
    this.#defaultCircuitBreakerOptions = circuitBreakerOptions;

    // Initialize monitoring components
    this.#performanceMonitor = new PerformanceMonitor({
      logger: this.#logger,
      enabled: this.#enabled,
    });
    this.#circuitBreakers = new Map();
    this.#alerts = [];

    // Initialize memory monitoring if dependencies provided
    this.#memoryMonitor = memoryMonitor || null;
    this.#memoryPressureManager = memoryPressureManager || null;
    this.#memoryReporter = memoryReporter || null;

    // Register for memory alerts if available
    if (this.#memoryMonitor && eventBus) {
      this.#registerMemoryAlerts(eventBus);
    }

    // Start health checks if enabled
    if (this.#enabled) {
      this.#startHealthChecks();
    }

    this.#logger.info('MonitoringCoordinator initialized', {
      enabled: this.#enabled,
      checkInterval: this.#checkInterval,
      memoryMonitoring: this.#memoryMonitor !== null,
    });
  }

  /**
   * Registers for memory monitoring alerts.
   *
   * @param {IEventBus} eventBus - Event bus
   * @private
   */
  #registerMemoryAlerts(eventBus) {
    // Listen for memory pressure alerts
    eventBus.on('MEMORY_THRESHOLD_EXCEEDED', (event) => {
      const { level, type, value } = event.payload;
      this.#addAlert(
        level === 'critical' ? 'error' : 'warning',
        `Memory ${type} threshold exceeded: ${level} (${value})`
      );
    });

    // Listen for memory leak detection
    eventBus.on('MEMORY_LEAK_DETECTED', (event) => {
      const { confidence, metrics } = event.payload;
      this.#addAlert(
        'warning',
        `Potential memory leak detected (confidence: ${confidence})`
      );
    });

    // Listen for memory strategy executions
    eventBus.on('MEMORY_STRATEGY_COMPLETED', (event) => {
      const { strategy, memoryFreed } = event.payload;
      this.#addAlert(
        'info',
        `Memory ${strategy} strategy executed, freed ${(memoryFreed / 1048576).toFixed(2)}MB`
      );
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
   * Gets the memory monitor instance.
   *
   * @returns {MemoryMonitor|null} Memory monitor or null if not available
   */
  getMemoryMonitor() {
    return this.#memoryMonitor;
  }

  /**
   * Gets the memory pressure manager instance.
   *
   * @returns {MemoryPressureManager|null} Memory pressure manager or null
   */
  getMemoryPressureManager() {
    return this.#memoryPressureManager;
  }

  /**
   * Gets the memory reporter instance.
   *
   * @returns {MemoryReporter|null} Memory reporter or null
   */
  getMemoryReporter() {
    return this.#memoryReporter;
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
        options: { ...this.#defaultCircuitBreakerOptions, ...options, name },
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

    // Get memory statistics if available
    let memoryStats = null;
    if (this.#memoryMonitor) {
      const currentUsage = this.#memoryMonitor.getCurrentUsage();
      const pressureLevel = this.#memoryMonitor.getPressureLevel();
      memoryStats = {
        currentUsage,
        pressureLevel,
        history: this.#memoryMonitor.getHistory(10), // Last 10 samples
      };

      if (this.#memoryPressureManager) {
        memoryStats.managementHistory = this.#memoryPressureManager.getManagementHistory(5);
      }
    }

    return {
      performance: performanceMetrics,
      circuitBreakers: circuitBreakerStats,
      memory: memoryStats,
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
      // Check memory usage (both legacy and new)
      this.#performanceMonitor.checkMemoryUsage();

      // Check memory monitoring if available
      if (this.#memoryMonitor) {
        this.#checkMemoryHealth();
      }

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
   * Checks memory health using the new memory monitoring system.
   *
   * @private
   */
  #checkMemoryHealth() {
    if (!this.#memoryMonitor) return;

    const usage = this.#memoryMonitor.getCurrentUsage();
    const pressureLevel = this.#memoryMonitor.getPressureLevel();

    // Check pressure level
    if (pressureLevel === 'critical') {
      this.#addAlert('error', `Critical memory pressure: ${(usage.usagePercent * 100).toFixed(1)}% heap usage`);
    } else if (pressureLevel === 'warning') {
      this.#addAlert('warning', `High memory usage: ${(usage.usagePercent * 100).toFixed(1)}% heap usage`);
    }

    // Check for memory leaks
    const leakDetection = this.#memoryMonitor.detectLeaks();
    if (leakDetection && leakDetection.isLeak) {
      this.#addAlert(
        'warning',
        `Potential memory leak detected (confidence: ${leakDetection.confidence})`
      );
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
          this.#addAlert(
            'warning',
            `High failure rate (${Math.round(failureRate * 100)}%) for circuit breaker '${name}'`
          );
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
    const slowThreshold = 100; // Default threshold in ms

    if (metrics.averageOperationTime > slowThreshold * 2) {
      this.#addAlert(
        'warning',
        `High average operation time: ${metrics.averageOperationTime.toFixed(2)}ms`
      );
    }

    // Check for high percentage of slow operations
    if (metrics.totalOperations > 0) {
      const slowOperationRate =
        metrics.slowOperations / metrics.totalOperations;
      if (slowOperationRate > 0.2) {
        this.#addAlert(
          'warning',
          `High slow operation rate: ${Math.round(slowOperationRate * 100)}%`
        );
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

    this.#alerts = this.#alerts.filter((alert) => alert.timestamp > cutoff);
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
    report.push('='.repeat(40));
    report.push(`Monitoring Status: ${this.#enabled ? 'Enabled' : 'Disabled'}`);
    report.push(
      `Health Checks: ${stats.healthChecksActive ? 'Active' : 'Inactive'}`
    );
    report.push('');

    // Performance section
    report.push('Performance Metrics:');
    report.push(`  Total Operations: ${stats.performance.totalOperations}`);
    report.push(`  Slow Operations: ${stats.performance.slowOperations}`);
    report.push(
      `  Average Time: ${stats.performance.averageOperationTime.toFixed(2)}ms`
    );
    report.push(
      `  Max Time: ${stats.performance.maxOperationTime.toFixed(2)}ms`
    );
    report.push(`  Memory Warnings: ${stats.performance.memoryUsageWarnings}`);
    report.push('');

    // Memory monitoring section
    if (stats.memory) {
      report.push('Memory Monitoring:');
      report.push(`  Pressure Level: ${stats.memory.pressureLevel}`);
      const usage = stats.memory.currentUsage;
      if (usage) {
        report.push(`  Heap Usage: ${(usage.usagePercent * 100).toFixed(1)}%`);
        report.push(`  Heap Used: ${(usage.heapUsed / 1048576).toFixed(2)}MB`);
        report.push(`  Heap Total: ${(usage.heapTotal / 1048576).toFixed(2)}MB`);
        if (usage.rss) {
          report.push(`  RSS: ${(usage.rss / 1048576).toFixed(2)}MB`);
        }
      }
      report.push('');
    }

    // Circuit breaker section
    report.push('Circuit Breakers:');
    if (Object.keys(stats.circuitBreakers).length === 0) {
      report.push('  No circuit breakers active');
    } else {
      for (const [name, cbStats] of Object.entries(stats.circuitBreakers)) {
        report.push(
          `  ${name}: ${cbStats.state} (${cbStats.totalFailures}/${cbStats.totalRequests} failures)`
        );
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
        report.push(
          `  [${time}] ${alert.type.toUpperCase()}: ${alert.message}`
        );
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

    // Reset memory monitoring if available
    if (this.#memoryMonitor) {
      this.#memoryMonitor.reset();
    }
    if (this.#memoryPressureManager) {
      this.#memoryPressureManager.clearHistory();
    }

    this.#logger.info('Monitoring data reset');
  }

  /**
   * Closes the monitoring coordinator and cleans up resources.
   */
  close() {
    this.#stopHealthChecks();

    // Destroy memory monitoring if available
    if (this.#memoryMonitor) {
      this.#memoryMonitor.destroy();
    }
    if (this.#memoryPressureManager) {
      this.#memoryPressureManager.destroy();
    }

    this.#logger.info('MonitoringCoordinator closed');
  }
}
