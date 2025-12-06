/**
 * @file LowMemoryStrategy - Strategy for handling low memory pressure situations
 * @module LowMemoryStrategy
 */

import { BaseService } from '../../../utils/serviceBase.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import {
  triggerGarbageCollection,
  getMemoryUsageBytes,
} from '../../../utils/environmentUtils.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('../../../cache/UnifiedCache.js').UnifiedCache} UnifiedCache */

/**
 * @typedef {object} StrategyResult
 * @property {boolean} success - Whether the strategy executed successfully
 * @property {number} memoryFreed - Amount of memory freed in bytes
 * @property {string[]} actionsTaken - List of actions taken
 * @property {object} metrics - Performance metrics
 */

/**
 * Strategy for handling low memory pressure (warning level)
 * Implements conservative memory recovery tactics
 */
export default class LowMemoryStrategy extends BaseService {
  #logger;
  #eventBus;
  #cache;
  #config;
  #executionCount;
  #lastExecutionTime;

  /**
   * Creates a new LowMemoryStrategy instance
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
        requiredMethods: ['prune', 'getStats', 'size'],
      });
    }

    this.#logger = this._init('LowMemoryStrategy', logger);
    this.#eventBus = eventBus;
    this.#cache = cache;

    this.#config = {
      cachePrunePercent: config.cachePrunePercent || 0.2, // Prune 20% of cache
      minTimeBetweenExecutions: config.minTimeBetweenExecutions || 30000, // 30 seconds
      enableCachePruning: config.enableCachePruning !== false,
      enableEventNotification: config.enableEventNotification !== false,
      ...config,
    };

    this.#executionCount = 0;
    this.#lastExecutionTime = 0;

    this.#logger.info('LowMemoryStrategy initialized', this.#config);
  }

  /**
   * Execute the low memory pressure strategy
   *
   * @param {object} context - Execution context
   * @returns {Promise<StrategyResult>}
   */
  async execute(context = {}) {
    const startTime = Date.now();

    // Check if we're executing too frequently
    if (this.#shouldThrottle()) {
      this.#logger.debug('Strategy execution throttled');
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

    this.#logger.info('Executing low memory pressure strategy', {
      executionCount: this.#executionCount,
      context,
    });

    // Notify about strategy execution
    if (this.#config.enableEventNotification) {
      this.#eventBus.dispatch({
        type: 'MEMORY_STRATEGY_STARTED',
        payload: {
          strategy: 'low',
          context,
          timestamp: startTime,
        },
      });
    }

    try {
      // Step 1: Prune cache conservatively
      if (this.#config.enableCachePruning && this.#cache) {
        const pruneResult = await this.#pruneCacheConservatively();
        if (pruneResult.success) {
          actionsTaken.push('cache_pruned');
          totalMemoryFreed += pruneResult.memoryFreed;
        }
      }

      // Step 2: Request garbage collection (if available)
      const gcResult = this.#requestGarbageCollection();
      if (gcResult.success) {
        actionsTaken.push('gc_requested');
        totalMemoryFreed += gcResult.memoryFreed;
      }

      // Step 3: Notify application components to release non-critical resources
      const releaseResult = await this.#requestResourceRelease('non-critical');
      if (releaseResult.success) {
        actionsTaken.push('resources_released');
        totalMemoryFreed += releaseResult.memoryFreed;
      }

      // Step 4: Compact memory pools
      const compactResult = await this.#compactMemoryPools();
      if (compactResult.success) {
        actionsTaken.push('memory_compacted');
        totalMemoryFreed += compactResult.memoryFreed;
      }

      const executionTime = Date.now() - startTime;

      this.#logger.info('Low memory strategy completed', {
        actionsTaken,
        totalMemoryFreed: (totalMemoryFreed / 1048576).toFixed(2) + 'MB',
        executionTime: executionTime + 'ms',
      });

      // Notify completion
      if (this.#config.enableEventNotification) {
        this.#eventBus.dispatch({
          type: 'MEMORY_STRATEGY_COMPLETED',
          payload: {
            strategy: 'low',
            success: true,
            memoryFreed: totalMemoryFreed,
            actionsTaken,
            executionTime,
          },
        });
      }

      return {
        success: true,
        memoryFreed: totalMemoryFreed,
        actionsTaken,
        metrics: {
          executionTime,
          executionCount: this.#executionCount,
        },
      };
    } catch (error) {
      this.#logger.error('Low memory strategy failed:', error);

      if (this.#config.enableEventNotification) {
        this.#eventBus.dispatch({
          type: 'MEMORY_STRATEGY_FAILED',
          payload: {
            strategy: 'low',
            error: error.message,
          },
        });
      }

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
   * Prune cache conservatively
   *
   * @private
   */
  async #pruneCacheConservatively() {
    if (!this.#cache) {
      return { success: false, memoryFreed: 0 };
    }

    try {
      const statsBefore = this.#cache.getStats ? this.#cache.getStats() : {};
      const sizeBefore = this.#cache.size || 0;

      // Prune with conservative settings
      const pruned = this.#cache.prune(false); // Non-aggressive pruning

      const sizeAfter = this.#cache.size || 0;
      const entriesRemoved = sizeBefore - sizeAfter;

      // Estimate memory freed (approximate 1KB per entry)
      const estimatedMemoryFreed = entriesRemoved * 1024;

      this.#logger.debug('Cache pruned conservatively', {
        entriesRemoved,
        estimatedMemoryFreed: (estimatedMemoryFreed / 1024).toFixed(2) + 'KB',
      });

      return {
        success: entriesRemoved > 0,
        memoryFreed: estimatedMemoryFreed,
      };
    } catch (error) {
      this.#logger.error('Cache pruning failed:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Request garbage collection
   *
   * @private
   * @returns {object} Result with success flag and memory freed
   */
  #requestGarbageCollection() {
    try {
      const memBefore = this.#getMemoryUsage();
      const success = triggerGarbageCollection();

      if (success) {
        const memAfter = this.#getMemoryUsage();
        const memoryFreed = Math.max(0, memBefore - memAfter);

        this.#logger.debug('Garbage collection requested', {
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
      this.#logger.error('GC request failed:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Request resource release from application components
   *
   * @param level
   * @private
   */
  async #requestResourceRelease(level) {
    try {
      // Dispatch event requesting resource release
      this.#eventBus.dispatch({
        type: 'MEMORY_RESOURCE_RELEASE_REQUESTED',
        payload: {
          level, // 'non-critical', 'all'
          strategy: 'low',
        },
      });

      // Wait a bit for components to respond
      await new Promise((resolve) => setTimeout(resolve, 100));

      // We can't accurately measure freed memory from other components
      // but we log the request
      this.#logger.debug(`Resource release requested: ${level}`);

      return {
        success: true,
        memoryFreed: 0, // Can't measure accurately
      };
    } catch (error) {
      this.#logger.error('Resource release request failed:', error);
      return { success: false, memoryFreed: 0 };
    }
  }

  /**
   * Compact memory pools
   *
   * @private
   */
  async #compactMemoryPools() {
    try {
      // This is a placeholder for memory pool compaction
      // In a real implementation, this would compact internal memory pools
      // For now, we just dispatch an event

      this.#eventBus.dispatch({
        type: 'MEMORY_COMPACTION_REQUESTED',
        payload: {
          strategy: 'low',
        },
      });

      this.#logger.debug('Memory compaction requested');

      return {
        success: true,
        memoryFreed: 0, // Can't measure accurately
      };
    } catch (error) {
      this.#logger.error('Memory compaction failed:', error);
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
   * Get strategy statistics
   *
   * @returns {object} Statistics object
   */
  getStatistics() {
    return {
      executionCount: this.#executionCount,
      lastExecutionTime: this.#lastExecutionTime,
      config: { ...this.#config },
    };
  }

  /**
   * Reset strategy state
   */
  reset() {
    this.#executionCount = 0;
    this.#lastExecutionTime = 0;
    this.#logger.info('LowMemoryStrategy reset');
  }

  /**
   * Destroy strategy
   */
  destroy() {
    this.reset();
    this.#logger.info('LowMemoryStrategy destroyed');
  }
}
