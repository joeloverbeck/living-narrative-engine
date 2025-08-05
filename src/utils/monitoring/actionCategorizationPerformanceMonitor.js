/**
 * @file Action Categorization Performance Monitor
 * Monitors and reports performance metrics for categorization operations
 */

/**
 * Performance monitoring utility for action categorization
 */
export class ActionCategorizationPerformanceMonitor {
  #logger;
  #metrics;
  #config;

  constructor({ logger, config = {} }) {
    this.#logger = logger;
    this.#config = {
      enabled: config.enabled ?? false,
      slowOperationThreshold: config.slowOperationThreshold ?? 10, // ms
      memoryCheckInterval: config.memoryCheckInterval ?? 100, // operations
      reportInterval: config.reportInterval ?? 1000, // operations
      ...config,
    };

    this.#metrics = {
      operations: {
        extractNamespace: { count: 0, totalTime: 0, slowCount: 0 },
        shouldUseGrouping: { count: 0, totalTime: 0, slowCount: 0 },
        groupActionsByNamespace: { count: 0, totalTime: 0, slowCount: 0 },
        getSortedNamespaces: { count: 0, totalTime: 0, slowCount: 0 },
        formatNamespaceDisplayName: { count: 0, totalTime: 0, slowCount: 0 },
      },
      memory: {
        initialHeapUsed: process.memoryUsage().heapUsed,
        peakHeapUsed: process.memoryUsage().heapUsed,
        lastCheckHeapUsed: process.memoryUsage().heapUsed,
      },
      errors: {
        count: 0,
        lastError: null,
      },
    };
  }

  /**
   * Monitor a service operation
   *
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Function to execute and monitor
   * @returns {*} Result of the operation
   */
  monitorOperation(operationName, operation) {
    if (!this.#config.enabled) {
      return operation();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.#recordOperation(operationName, duration);

      if (duration > this.#config.slowOperationThreshold) {
        this.#logger.warn(
          'ActionCategorizationPerformanceMonitor: Slow operation detected',
          {
            operation: operationName,
            duration: `${duration.toFixed(2)}ms`,
            threshold: `${this.#config.slowOperationThreshold}ms`,
          }
        );
      }

      this.#checkMemoryUsage(startMemory);
      return result;
    } catch (error) {
      this.#recordError(operationName, error);
      throw error;
    }
  }

  /**
   * Monitor an async operation
   *
   * @param {string} operationName - Name of the operation
   * @param {Function} operation - Async function to execute and monitor
   * @returns {Promise<*>} Result of the operation
   */
  async monitorAsyncOperation(operationName, operation) {
    if (!this.#config.enabled) {
      return await operation();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.#recordOperation(operationName, duration);

      if (duration > this.#config.slowOperationThreshold) {
        this.#logger.warn(
          'ActionCategorizationPerformanceMonitor: Slow async operation detected',
          {
            operation: operationName,
            duration: `${duration.toFixed(2)}ms`,
            threshold: `${this.#config.slowOperationThreshold}ms`,
          }
        );
      }

      this.#checkMemoryUsage(startMemory);
      return result;
    } catch (error) {
      this.#recordError(operationName, error);
      throw error;
    }
  }

  /**
   * Record operation metrics
   *
   * @param operationName
   * @param duration
   * @private
   */
  #recordOperation(operationName, duration) {
    const metric = this.#metrics.operations[operationName];
    if (!metric) {
      this.#metrics.operations[operationName] = {
        count: 0,
        totalTime: 0,
        slowCount: 0,
      };
    }

    const op = this.#metrics.operations[operationName];
    op.count++;
    op.totalTime += duration;

    if (duration > this.#config.slowOperationThreshold) {
      op.slowCount++;
    }

    // Report periodically
    if (op.count % this.#config.reportInterval === 0) {
      this.#reportOperationMetrics(operationName, op);
    }
  }

  /**
   * Record error metrics
   *
   * @param operationName
   * @param error
   * @private
   */
  #recordError(operationName, error) {
    this.#metrics.errors.count++;
    this.#metrics.errors.lastError = {
      operation: operationName,
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    this.#logger.error(
      'ActionCategorizationPerformanceMonitor: Operation error',
      {
        operation: operationName,
        error: error.message,
        totalErrors: this.#metrics.errors.count,
      }
    );
  }

  /**
   * Check memory usage
   *
   * @param startMemory
   * @private
   */
  #checkMemoryUsage(startMemory) {
    const currentMemory = process.memoryUsage().heapUsed;

    if (currentMemory > this.#metrics.memory.peakHeapUsed) {
      this.#metrics.memory.peakHeapUsed = currentMemory;
    }

    const memoryIncrease = currentMemory - startMemory;
    if (memoryIncrease > 1024 * 1024) {
      // 1MB increase in single operation
      this.#logger.warn(
        'ActionCategorizationPerformanceMonitor: High memory usage in operation',
        {
          memoryIncrease: `${Math.round(memoryIncrease / 1024)}KB`,
          currentHeapUsed: `${Math.round(currentMemory / 1024 / 1024)}MB`,
        }
      );
    }

    // Periodic memory check
    const totalOperations = Object.values(this.#metrics.operations).reduce(
      (sum, op) => sum + op.count,
      0
    );

    if (totalOperations % this.#config.memoryCheckInterval === 0) {
      this.#reportMemoryMetrics();
    }
  }

  /**
   * Report operation metrics
   *
   * @param operationName
   * @param metrics
   * @private
   */
  #reportOperationMetrics(operationName, metrics) {
    const avgTime = metrics.totalTime / metrics.count;
    const slowPercentage = (metrics.slowCount / metrics.count) * 100;

    this.#logger.info(
      'ActionCategorizationPerformanceMonitor: Operation metrics',
      {
        operation: operationName,
        totalOperations: metrics.count,
        averageTime: `${avgTime.toFixed(2)}ms`,
        slowOperations: metrics.slowCount,
        slowPercentage: `${slowPercentage.toFixed(1)}%`,
      }
    );
  }

  /**
   * Report memory metrics
   *
   * @private
   */
  #reportMemoryMetrics() {
    const current = process.memoryUsage().heapUsed;
    const peak = this.#metrics.memory.peakHeapUsed;
    const initial = this.#metrics.memory.initialHeapUsed;
    const increase = current - initial;

    this.#logger.info(
      'ActionCategorizationPerformanceMonitor: Memory metrics',
      {
        currentHeapUsed: `${Math.round(current / 1024 / 1024)}MB`,
        peakHeapUsed: `${Math.round(peak / 1024 / 1024)}MB`,
        memoryIncrease: `${Math.round(increase / 1024)}KB`,
        memoryIncreasePercentage: `${((increase / initial) * 100).toFixed(1)}%`,
      }
    );
  }

  /**
   * Get current performance metrics
   *
   * @returns {object} Performance metrics summary
   */
  getMetrics() {
    const summary = {
      operations: {},
      memory: {
        currentHeapUsed: process.memoryUsage().heapUsed,
        peakHeapUsed: this.#metrics.memory.peakHeapUsed,
        memoryIncrease:
          process.memoryUsage().heapUsed - this.#metrics.memory.initialHeapUsed,
      },
      errors: this.#metrics.errors,
    };

    // Calculate operation summaries
    for (const [name, metrics] of Object.entries(this.#metrics.operations)) {
      if (metrics.count > 0) {
        summary.operations[name] = {
          count: metrics.count,
          averageTime: metrics.totalTime / metrics.count,
          slowCount: metrics.slowCount,
          slowPercentage: (metrics.slowCount / metrics.count) * 100,
        };
      }
    }

    return summary;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.#metrics.operations = {
      extractNamespace: { count: 0, totalTime: 0, slowCount: 0 },
      shouldUseGrouping: { count: 0, totalTime: 0, slowCount: 0 },
      groupActionsByNamespace: { count: 0, totalTime: 0, slowCount: 0 },
      getSortedNamespaces: { count: 0, totalTime: 0, slowCount: 0 },
      formatNamespaceDisplayName: { count: 0, totalTime: 0, slowCount: 0 },
    };

    this.#metrics.memory = {
      initialHeapUsed: process.memoryUsage().heapUsed,
      peakHeapUsed: process.memoryUsage().heapUsed,
      lastCheckHeapUsed: process.memoryUsage().heapUsed,
    };

    this.#metrics.errors = {
      count: 0,
      lastError: null,
    };

    this.#logger.info('ActionCategorizationPerformanceMonitor: Metrics reset');
  }

  /**
   * Generate performance report
   *
   * @returns {string} Formatted performance report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const report = [];

    report.push('=== Action Categorization Performance Report ===');
    report.push('');

    // Operations summary
    report.push('Operations:');
    for (const [name, op] of Object.entries(metrics.operations)) {
      report.push(`  ${name}:`);
      report.push(`    Count: ${op.count}`);
      report.push(`    Average Time: ${op.averageTime.toFixed(2)}ms`);
      report.push(
        `    Slow Operations: ${op.slowCount} (${op.slowPercentage.toFixed(1)}%)`
      );
    }

    report.push('');

    // Memory summary
    report.push('Memory:');
    report.push(
      `  Current Heap: ${Math.round(metrics.memory.currentHeapUsed / 1024 / 1024)}MB`
    );
    report.push(
      `  Peak Heap: ${Math.round(metrics.memory.peakHeapUsed / 1024 / 1024)}MB`
    );
    report.push(
      `  Memory Increase: ${Math.round(metrics.memory.memoryIncrease / 1024)}KB`
    );

    report.push('');

    // Errors summary
    report.push('Errors:');
    report.push(`  Total Errors: ${metrics.errors.count}`);
    if (metrics.errors.lastError) {
      report.push(
        `  Last Error: ${metrics.errors.lastError.operation} - ${metrics.errors.lastError.message}`
      );
    }

    return report.join('\n');
  }
}