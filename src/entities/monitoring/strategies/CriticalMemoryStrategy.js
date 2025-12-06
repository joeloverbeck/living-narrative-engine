/**
 * @file CriticalMemoryStrategy - Strategy for handling critical memory pressure situations
 * @module CriticalMemoryStrategy
 */

import { BaseService } from '../../../utils/serviceBase.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import {
  triggerGarbageCollection,
  getMemoryUsageBytes,
  getMemoryUsagePercent,
} from '../../../utils/environmentUtils.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('../../../cache/UnifiedCache.js').UnifiedCache} UnifiedCache */

/**
 * Strategy for handling critical memory pressure
 * Implements aggressive memory recovery tactics
 */
export default class CriticalMemoryStrategy extends BaseService {
  #logger;
  #eventBus;
  #cache;
  #config;
  #executionCount;
  #lastExecutionTime;
  #emergencyMode;

  /**
   * Creates a new CriticalMemoryStrategy instance
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IEventBus} deps.eventBus - Event bus for notifications
   * @param {UnifiedCache} [deps.cache] - Cache instance for pruning
   * @param {object} [config] - Strategy configuration
   */
  constructor({ logger, eventBus, cache }, config = {}) {
    super();

    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });

    if (cache) {
      validateDependency(cache, 'UnifiedCache', logger, {
        requiredMethods: ['clear', 'prune', 'size'],
      });
    }

    this.#logger = this._init('CriticalMemoryStrategy', logger);
    this.#eventBus = eventBus;
    this.#cache = cache;

    this.#config = {
      clearCache: config.clearCache !== false,
      forceGC: config.forceGC !== false,
      minTimeBetweenExecutions: config.minTimeBetweenExecutions || 10000, // 10 seconds
      emergencyThreshold: config.emergencyThreshold || 0.95, // 95% usage
      enableEmergencyMode: config.enableEmergencyMode !== false,
      ...config,
    };

    this.#executionCount = 0;
    this.#lastExecutionTime = 0;
    this.#emergencyMode = false;

    this.#logger.info('CriticalMemoryStrategy initialized', this.#config);
  }

  /**
   * Execute the critical memory pressure strategy
   *
   * @param {object} context - Execution context
   * @returns {Promise<object>}
   */
  async execute(context = {}) {
    const startTime = Date.now();

    // In critical situations, we may need to override throttling
    if (!this.#emergencyMode && this.#shouldThrottle()) {
      this.#logger.debug('Strategy execution throttled (non-emergency)');
      return {
        success: false,
        memoryFreed: 0,
        actionsTaken: ['throttled'],
        metrics: { throttled: true },
      };
    }

    this.#executionCount++;
    this.#lastExecutionTime = startTime;

    const actionsTaken = [];
    let totalMemoryFreed = 0;

    // Check for emergency mode
    const memoryUsage = this.#getMemoryUsagePercent();
    if (memoryUsage >= this.#config.emergencyThreshold) {
      this.#emergencyMode = true;
      actionsTaken.push('emergency_mode_activated');
    }

    this.#logger.warn('Executing critical memory pressure strategy', {
      executionCount: this.#executionCount,
      emergencyMode: this.#emergencyMode,
      memoryUsage: (memoryUsage * 100).toFixed(1) + '%',
      context,
    });

    // Notify about critical strategy execution
    this.#eventBus.dispatch({
      type: 'MEMORY_STRATEGY_STARTED',
      payload: {
        strategy: 'critical',
        emergencyMode: this.#emergencyMode,
        context,
        timestamp: startTime,
      },
    });

    try {
      // Step 1: Immediately stop non-critical operations
      const stopResult = await this.#stopNonCriticalOperations();
      if (stopResult.success) {
        actionsTaken.push('operations_stopped');
        totalMemoryFreed += stopResult.memoryFreed;
      }

      // Step 2: Clear all caches aggressively
      if (this.#config.clearCache && this.#cache) {
        const clearResult = await this.#clearAllCaches();
        if (clearResult.success) {
          actionsTaken.push('caches_cleared');
          totalMemoryFreed += clearResult.memoryFreed;
        }
      }

      // Step 3: Force garbage collection multiple times
      if (this.#config.forceGC) {
        const gcResult = await this.#forceAggressiveGC();
        if (gcResult.success) {
          actionsTaken.push('aggressive_gc');
          totalMemoryFreed += gcResult.memoryFreed;
        }
      }

      // Step 4: Release all non-essential resources
      const releaseResult = await this.#releaseAllResources();
      if (releaseResult.success) {
        actionsTaken.push('all_resources_released');
        totalMemoryFreed += releaseResult.memoryFreed;
      }

      // Step 5: Emergency memory dump if still critical
      if (this.#emergencyMode) {
        const dumpResult = await this.#performEmergencyDump();
        if (dumpResult.success) {
          actionsTaken.push('emergency_dump');
          totalMemoryFreed += dumpResult.memoryFreed;
        }
      }

      // Check if we recovered enough memory
      const finalUsage = this.#getMemoryUsagePercent();
      const recovered = finalUsage < this.#config.emergencyThreshold;

      if (recovered && this.#emergencyMode) {
        this.#emergencyMode = false;
        actionsTaken.push('emergency_mode_deactivated');
      }

      const executionTime = Date.now() - startTime;

      this.#logger.warn('Critical memory strategy completed', {
        actionsTaken,
        totalMemoryFreed: (totalMemoryFreed / 1048576).toFixed(2) + 'MB',
        executionTime: executionTime + 'ms',
        finalUsage: (finalUsage * 100).toFixed(1) + '%',
        recovered,
      });

      // Notify completion
      this.#eventBus.dispatch({
        type: 'MEMORY_STRATEGY_COMPLETED',
        payload: {
          strategy: 'critical',
          success: true,
          memoryFreed: totalMemoryFreed,
          actionsTaken,
          executionTime,
          recovered,
        },
      });

      return {
        success: true,
        memoryFreed: totalMemoryFreed,
        actionsTaken,
        metrics: {
          executionTime,
          executionCount: this.#executionCount,
          finalUsage,
          recovered,
        },
      };
    } catch (error) {
      this.#logger.error('Critical memory strategy failed:', error);

      this.#eventBus.dispatch({
        type: 'MEMORY_STRATEGY_FAILED',
        payload: {
          strategy: 'critical',
          error: error.message,
          emergencyMode: this.#emergencyMode,
        },
      });

      return {
        success: false,
        memoryFreed: totalMemoryFreed,
        actionsTaken,
        metrics: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Check if execution should be throttled
   *
   * @private
   */
  #shouldThrottle() {
    const timeSinceLastExecution = Date.now() - this.#lastExecutionTime;
    return timeSinceLastExecution < this.#config.minTimeBetweenExecutions;
  }

  /**
   * Stop non-critical operations
   *
   * @private
   */
  async #stopNonCriticalOperations() {
    try {
      this.#eventBus.dispatch({
        type: 'MEMORY_CRITICAL_STOP_OPERATIONS',
        payload: {
          level: 'non-critical',
          immediate: true,
        },
      });

      // Give components time to stop
      await new Promise((resolve) => setTimeout(resolve, 50));

      this.#logger.warn('Non-critical operations stopped');

      return {
        success: true,
        memoryFreed: 0, // Can't measure directly
      };
    } catch (error) {
      this.#logger.error('Failed to stop operations:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Clear all caches aggressively
   *
   * @private
   */
  async #clearAllCaches() {
    if (!this.#cache) {
      return { success: false, memoryFreed: 0 };
    }

    try {
      const sizeBefore = this.#cache.size || 0;

      // Clear the entire cache
      this.#cache.clear();

      // Estimate memory freed (approximate 2KB per entry for critical mode)
      const estimatedMemoryFreed = sizeBefore * 2048;

      this.#logger.warn('All caches cleared', {
        entriesRemoved: sizeBefore,
        estimatedMemoryFreed:
          (estimatedMemoryFreed / 1048576).toFixed(2) + 'MB',
      });

      // Notify other caches to clear via event
      this.#eventBus.dispatch({
        type: 'MEMORY_CRITICAL_CLEAR_ALL_CACHES',
        payload: {
          source: 'CriticalMemoryStrategy',
        },
      });

      return {
        success: true,
        memoryFreed: estimatedMemoryFreed,
      };
    } catch (error) {
      this.#logger.error('Cache clearing failed:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Force aggressive garbage collection
   *
   * @private
   * @returns {Promise<object>} Result with success flag and memory freed
   */
  async #forceAggressiveGC() {
    try {
      const memBefore = this.#getMemoryUsage();
      let gcTriggered = false;

      // Run GC multiple times for aggressive collection
      for (let i = 0; i < 3; i++) {
        if (triggerGarbageCollection()) {
          gcTriggered = true;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      if (gcTriggered) {
        const memAfter = this.#getMemoryUsage();
        const memoryFreed = Math.max(0, memBefore - memAfter);

        this.#logger.warn('Aggressive garbage collection completed', {
          iterations: 3,
          memoryFreed: (memoryFreed / 1048576).toFixed(2) + 'MB',
        });

        return {
          success: true,
          memoryFreed,
        };
      }

      // GC not available
      return { success: false, memoryFreed: 0 };
    } catch (error) {
      this.#logger.error('Aggressive GC failed:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Release all non-essential resources
   *
   * @private
   */
  async #releaseAllResources() {
    try {
      this.#eventBus.dispatch({
        type: 'MEMORY_CRITICAL_RELEASE_ALL',
        payload: {
          level: 'all',
          immediate: true,
        },
      });

      // Give components more time to release resources
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.#logger.warn('All resources release requested');

      return {
        success: true,
        memoryFreed: 0, // Can't measure directly
      };
    } catch (error) {
      this.#logger.error('Resource release failed:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Perform emergency memory dump
   *
   * @private
   */
  async #performEmergencyDump() {
    try {
      // In a real implementation, this would dump non-critical data to disk
      // and free up memory. For now, we dispatch an event.

      this.#eventBus.dispatch({
        type: 'MEMORY_EMERGENCY_DUMP',
        payload: {
          timestamp: Date.now(),
          memoryUsage: this.#getMemoryUsagePercent(),
        },
      });

      this.#logger.error('Emergency memory dump performed');

      return {
        success: true,
        memoryFreed: 0, // Can't measure directly
      };
    } catch (error) {
      this.#logger.error('Emergency dump failed:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Get current memory usage
   *
   * @private
   * @returns {number} Current memory usage in bytes
   */
  #getMemoryUsage() {
    return getMemoryUsageBytes();
  }

  /**
   * Get memory usage percentage
   *
   * @private
   * @returns {number} Memory usage as percentage (0-1)
   */
  #getMemoryUsagePercent() {
    return getMemoryUsagePercent();
  }

  /**
   * Get strategy statistics
   *
   * @returns {object} Statistics object
   */
  getStatistics() {
    return {
      executionCount: this.#executionCount,
      lastExecutionTime: this.#lastExecutionTime,
      emergencyMode: this.#emergencyMode,
      config: { ...this.#config },
    };
  }

  /**
   * Check if in emergency mode
   *
   * @returns {boolean} Whether emergency mode is active
   */
  isEmergencyMode() {
    return this.#emergencyMode;
  }

  /**
   * Reset strategy state
   */
  reset() {
    this.#executionCount = 0;
    this.#lastExecutionTime = 0;
    this.#emergencyMode = false;
    this.#logger.info('CriticalMemoryStrategy reset');
  }

  /**
   * Destroy strategy
   */
  destroy() {
    this.reset();
    this.#logger.info('CriticalMemoryStrategy destroyed');
  }
}
