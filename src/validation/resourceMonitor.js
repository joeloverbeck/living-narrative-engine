/**
 * @file Resource monitor for mod validation system
 * @description Monitors and limits resource usage to prevent exhaustion attacks
 */

import { ModSecurityError, SecurityLevel } from '../errors/modSecurityError.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Resource exhaustion error for resource limit violations
 */
class ResourceExhaustionError extends ModSecurityError {
  constructor(message, resourceType, context) {
    super(message, SecurityLevel.HIGH, {
      ...context,
      resourceType,
      timestamp: new Date().toISOString(),
    });
    this.name = 'ResourceExhaustionError';
    this.resourceType = resourceType;
  }
}

/**
 * Monitors system resources and enforces limits during validation
 */
class ResourceMonitor {
  #config;
  #logger;
  #currentOperations;
  #operationTimers;
  #memoryCheckInterval;
  #startMemory;
  #peakMemory;
  #isMonitoring;

  /**
   * Creates a new ResourceMonitor instance
   *
   * @param {object} dependencies - Dependencies
   * @param {object} dependencies.config - Resource configuration
   * @param {import('../utils/loggerUtils.js').ILogger} [dependencies.logger] - Optional logger
   */
  constructor({ config, logger = console }) {
    this.#config = config || {};
    this.#logger = logger;

    // Set configuration with defaults
    this.maxMemoryUsage = this.#config.maxMemoryUsage || 512 * 1024 * 1024; // 512MB
    this.maxProcessingTime = this.#config.maxProcessingTime || 30000; // 30 seconds
    this.maxConcurrentOperations = this.#config.maxConcurrentOperations || 10;
    this.memoryCheckInterval = this.#config.memoryCheckInterval || 1000; // 1 second
    this.memoryWarningThreshold = this.#config.memoryWarningThreshold || 0.75;
    this.memoryCriticalThreshold = this.#config.memoryCriticalThreshold || 0.9;

    // Initialize tracking structures
    this.#currentOperations = new Map();
    this.#operationTimers = new Map();
    this.#memoryCheckInterval = null;
    this.#startMemory = 0;
    this.#peakMemory = 0;
    this.#isMonitoring = false;
  }

  /**
   * Starts resource monitoring
   */
  startMonitoring() {
    if (this.#isMonitoring) {
      return;
    }

    this.#isMonitoring = true;
    this.#startMemory = this.#getMemoryUsage();
    this.#peakMemory = this.#startMemory;

    // Start periodic memory checks
    this.#memoryCheckInterval = setInterval(() => {
      this.#checkMemoryUsage();
    }, this.memoryCheckInterval);

    this.#logger.debug('Resource monitoring started');
  }

  /**
   * Stops resource monitoring
   */
  stopMonitoring() {
    if (!this.#isMonitoring) {
      return;
    }

    this.#isMonitoring = false;

    // Clear memory check interval
    if (this.#memoryCheckInterval) {
      clearInterval(this.#memoryCheckInterval);
      this.#memoryCheckInterval = null;
    }

    // Clear all operation timers
    for (const timer of this.#operationTimers.values()) {
      clearTimeout(timer);
    }
    this.#operationTimers.clear();
    this.#currentOperations.clear();

    const finalMemory = this.#getMemoryUsage();
    this.#logger.debug('Resource monitoring stopped', {
      startMemory: this.#startMemory,
      peakMemory: this.#peakMemory,
      finalMemory,
      memoryGrowth: finalMemory - this.#startMemory,
    });
  }

  /**
   * Checks current resource limits
   *
   * @throws {ResourceExhaustionError} If limits are exceeded
   */
  checkResourceLimits() {
    // Check concurrent operations
    if (this.#currentOperations.size >= this.maxConcurrentOperations) {
      throw new ResourceExhaustionError(
        `Maximum concurrent operations exceeded: ${this.#currentOperations.size} >= ${this.maxConcurrentOperations}`,
        'CONCURRENT_OPERATIONS',
        {
          currentOperations: this.#currentOperations.size,
          maxOperations: this.maxConcurrentOperations,
          activeOperations: Array.from(this.#currentOperations.keys()),
        }
      );
    }

    // Check memory usage
    const currentMemory = this.#getMemoryUsage();
    if (currentMemory > this.maxMemoryUsage) {
      throw new ResourceExhaustionError(
        `Memory usage exceeds limit: ${this.#formatBytes(currentMemory)} > ${this.#formatBytes(this.maxMemoryUsage)}`,
        'MEMORY',
        {
          currentMemory,
          maxMemory: this.maxMemoryUsage,
          memoryGrowth: currentMemory - this.#startMemory,
        }
      );
    }
  }

  /**
   * Creates an operation guard with automatic cleanup
   *
   * @param {string} operationId - Unique operation identifier
   * @param {object} [options] - Operation options
   * @param {number} [options.timeout] - Custom timeout for this operation
   * @returns {object} Guard object with cleanup method
   */
  createOperationGuard(operationId, options = {}) {
    // Check if we can start a new operation
    this.checkResourceLimits();

    // Register the operation
    const startTime = Date.now();
    this.#currentOperations.set(operationId, {
      id: operationId,
      startTime,
      options,
    });

    // Set timeout for operation
    const timeout = options.timeout || this.maxProcessingTime;
    const timer = setTimeout(() => {
      this.#handleOperationTimeout(operationId);
    }, timeout);

    this.#operationTimers.set(operationId, timer);

    this.#logger.debug(`Operation started: ${operationId}`, {
      currentOperations: this.#currentOperations.size,
      timeout,
    });

    // Return guard object
    return {
      operationId,
      startTime,

      /**
       * Cleans up the operation
       */
      cleanup: () => {
        this.#cleanupOperation(operationId);
      },

      /**
       * Checks if operation is still valid
       *
       * @returns {boolean} True if operation is still active
       */
      isActive: () => {
        return this.#currentOperations.has(operationId);
      },

      /**
       * Gets operation duration
       *
       * @returns {number} Duration in milliseconds
       */
      getDuration: () => {
        return Date.now() - startTime;
      },
    };
  }

  /**
   * Gets current resource usage statistics
   *
   * @returns {object} Resource usage stats
   */
  getResourceStats() {
    const currentMemory = this.#getMemoryUsage();
    const memoryPercentage = currentMemory / this.maxMemoryUsage;

    return {
      memory: {
        current: currentMemory,
        peak: this.#peakMemory,
        limit: this.maxMemoryUsage,
        percentage: memoryPercentage,
        formatted: {
          current: this.#formatBytes(currentMemory),
          peak: this.#formatBytes(this.#peakMemory),
          limit: this.#formatBytes(this.maxMemoryUsage),
        },
      },
      operations: {
        current: this.#currentOperations.size,
        limit: this.maxConcurrentOperations,
        active: Array.from(this.#currentOperations.entries()).map(
          ([id, op]) => ({
            id,
            duration: Date.now() - op.startTime,
            startTime: new Date(op.startTime).toISOString(),
          })
        ),
      },
      status: this.#getResourceStatus(memoryPercentage),
    };
  }

  /**
   * Resets resource tracking
   */
  reset() {
    // Clear operations
    for (const timer of this.#operationTimers.values()) {
      clearTimeout(timer);
    }
    this.#operationTimers.clear();
    this.#currentOperations.clear();

    // Reset memory tracking
    this.#startMemory = this.#getMemoryUsage();
    this.#peakMemory = this.#startMemory;

    this.#logger.debug('Resource monitor reset');
  }

  /**
   * Checks memory usage periodically
   *
   * @private
   */
  #checkMemoryUsage() {
    const currentMemory = this.#getMemoryUsage();
    this.#peakMemory = Math.max(this.#peakMemory, currentMemory);

    const memoryPercentage = currentMemory / this.maxMemoryUsage;

    // Check critical threshold
    if (memoryPercentage >= this.memoryCriticalThreshold) {
      this.#logger.error('Critical memory usage detected', {
        current: this.#formatBytes(currentMemory),
        limit: this.#formatBytes(this.maxMemoryUsage),
        percentage: (memoryPercentage * 100).toFixed(2) + '%',
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.#logger.info(
          'Forced garbage collection due to critical memory usage'
        );
      }
    }
    // Check warning threshold
    else if (memoryPercentage >= this.memoryWarningThreshold) {
      this.#logger.warn('High memory usage detected', {
        current: this.#formatBytes(currentMemory),
        limit: this.#formatBytes(this.maxMemoryUsage),
        percentage: (memoryPercentage * 100).toFixed(2) + '%',
      });
    }
  }

  /**
   * Handles operation timeout
   *
   * @private
   * @param {string} operationId - Operation that timed out
   */
  #handleOperationTimeout(operationId) {
    const operation = this.#currentOperations.get(operationId);
    if (!operation) {
      return; // Already cleaned up
    }

    const duration = Date.now() - operation.startTime;

    this.#logger.error(`Operation timeout: ${operationId}`, {
      duration,
      maxDuration: this.maxProcessingTime,
    });

    // Clean up the operation
    this.#cleanupOperation(operationId);

    // Throw timeout error
    throw new ResourceExhaustionError(
      `Operation '${operationId}' exceeded maximum processing time: ${duration}ms > ${this.maxProcessingTime}ms`,
      'TIMEOUT',
      {
        operationId,
        duration,
        maxDuration: this.maxProcessingTime,
      }
    );
  }

  /**
   * Cleans up an operation
   *
   * @private
   * @param {string} operationId - Operation to clean up
   */
  #cleanupOperation(operationId) {
    const operation = this.#currentOperations.get(operationId);
    if (!operation) {
      return; // Already cleaned up
    }

    // Clear timeout
    const timer = this.#operationTimers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.#operationTimers.delete(operationId);
    }

    // Remove operation
    this.#currentOperations.delete(operationId);

    const duration = Date.now() - operation.startTime;
    this.#logger.debug(`Operation completed: ${operationId}`, {
      duration,
      remainingOperations: this.#currentOperations.size,
    });
  }

  /**
   * Gets current memory usage
   *
   * @private
   * @returns {number} Memory usage in bytes
   */
  #getMemoryUsage() {
    if (globalThis.process?.memoryUsage) {
      // Node.js environment
      const usage = globalThis.process.memoryUsage();
      return usage.heapUsed;
    } else if (globalThis.performance?.memory) {
      // Browser environment with memory API
      return globalThis.performance.memory.usedJSHeapSize;
    } else {
      // Fallback - estimate based on operation count
      // This is a rough estimate: 1MB per operation
      return this.#currentOperations.size * 1024 * 1024;
    }
  }

  /**
   * Formats bytes to human-readable string
   *
   * @private
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  #formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Gets resource status based on usage
   *
   * @private
   * @param {number} memoryPercentage - Memory usage percentage
   * @returns {string} Status indicator
   */
  #getResourceStatus(memoryPercentage) {
    const operationPercentage =
      this.#currentOperations.size / this.maxConcurrentOperations;

    if (
      memoryPercentage >= this.memoryCriticalThreshold ||
      operationPercentage >= 0.9
    ) {
      return 'CRITICAL';
    }
    if (
      memoryPercentage >= this.memoryWarningThreshold ||
      operationPercentage >= 0.75
    ) {
      return 'WARNING';
    }
    if (memoryPercentage >= 0.5 || operationPercentage >= 0.5) {
      return 'MODERATE';
    }
    return 'HEALTHY';
  }
}

export { ResourceMonitor, ResourceExhaustionError };
export default ResourceMonitor;
