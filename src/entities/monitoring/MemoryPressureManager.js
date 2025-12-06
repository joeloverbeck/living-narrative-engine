/**
 * @file MemoryPressureManager - Manages memory pressure responses and strategies
 * @module MemoryPressureManager
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  validateDependency,
  assertNonBlankString,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import {
  triggerGarbageCollection,
  getMemoryUsageBytes,
} from '../../utils/environmentUtils.js';
import LowMemoryStrategy from './strategies/LowMemoryStrategy.js';
import CriticalMemoryStrategy from './strategies/CriticalMemoryStrategy.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('./MemoryMonitor.js').default} MemoryMonitor */
/** @typedef {import('../../cache/UnifiedCache.js').UnifiedCache} UnifiedCache */

/**
 * @typedef {object} PressureStrategy
 * @property {string} level - Pressure level
 * @property {Function} execute - Strategy execution function
 * @property {object} config - Strategy configuration
 */

/**
 * @typedef {object} ManagementResult
 * @property {boolean} success - Whether management was successful
 * @property {string} pressureLevel - Current pressure level
 * @property {string[]} actionsT taken - Actions taken
 * @property {number} memoryFreed - Memory freed in bytes
 * @property {object} metrics - Performance metrics
 */

/**
 * Coordinates memory pressure responses and automatic management
 */
export default class MemoryPressureManager extends BaseService {
  #logger;
  #eventBus;
  #monitor;
  #cache;
  #strategies;
  #currentPressureLevel;
  #automaticManagementEnabled;
  #config;
  #lastManagementTime;
  #managementHistory;

  /**
   * Creates a new MemoryPressureManager instance
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {IEventBus} deps.eventBus - Event bus
   * @param {MemoryMonitor} deps.monitor - Memory monitor instance
   * @param {UnifiedCache} [deps.cache] - Cache instance
   * @param {object} [config] - Configuration
   */
  constructor({ logger, eventBus, monitor, cache }, config = {}) {
    super();

    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(monitor, 'MemoryMonitor', logger, {
      requiredMethods: [
        'getCurrentUsage',
        'getPressureLevel',
        'onThresholdExceeded',
      ],
    });

    if (cache) {
      validateDependency(cache, 'UnifiedCache', logger, {
        requiredMethods: ['prune', 'clear', 'size'],
      });
    }

    this.#logger = this._init('MemoryPressureManager', logger);
    this.#eventBus = eventBus;
    this.#monitor = monitor;
    this.#cache = cache;

    this.#config = {
      automaticManagement: config.automaticManagement !== false,
      aggressiveGC: config.aggressiveGC !== false,
      minTimeBetweenManagement: config.minTimeBetweenManagement || 30000, // 30 seconds
      maxHistorySize: config.maxHistorySize || 100,
      ...config,
    };

    this.#strategies = new Map();
    this.#currentPressureLevel = 'normal';
    this.#automaticManagementEnabled = false;
    this.#lastManagementTime = 0;
    this.#managementHistory = [];

    // Initialize default strategies
    this.#initializeDefaultStrategies();

    // Register for pressure change events
    this.#registerEventHandlers();

    this.#logger.info('MemoryPressureManager initialized', {
      automaticManagement: this.#config.automaticManagement,
      aggressiveGC: this.#config.aggressiveGC,
    });
  }

  /**
   * Initialize default memory strategies
   *
   * @private
   */
  #initializeDefaultStrategies() {
    // Low pressure strategy
    const lowStrategy = new LowMemoryStrategy({
      logger: this.#logger,
      eventBus: this.#eventBus,
      cache: this.#cache,
    });

    this.registerStrategy('warning', {
      level: 'warning',
      execute: (context) => lowStrategy.execute(context),
      config: lowStrategy.getStatistics().config,
      instance: lowStrategy,
    });

    // Critical pressure strategy
    const criticalStrategy = new CriticalMemoryStrategy({
      logger: this.#logger,
      eventBus: this.#eventBus,
      cache: this.#cache,
    });

    this.registerStrategy('critical', {
      level: 'critical',
      execute: (context) => criticalStrategy.execute(context),
      config: criticalStrategy.getStatistics().config,
      instance: criticalStrategy,
    });

    this.#logger.debug('Default strategies initialized');
  }

  /**
   * Register event handlers
   *
   * @private
   */
  #registerEventHandlers() {
    // Listen for pressure level changes
    this.#monitor.onThresholdExceeded('warning', (alert) => {
      this.#handlePressureChange('warning', alert);
    });

    this.#monitor.onThresholdExceeded('critical', (alert) => {
      this.#handlePressureChange('critical', alert);
    });

    // Also listen via event bus
    this.#eventBus.subscribe('MEMORY_PRESSURE_CHANGED', (event) => {
      const { newLevel } = event.payload;
      this.#currentPressureLevel = newLevel;

      if (this.#automaticManagementEnabled) {
        this.#handleAutomaticManagement(newLevel);
      }
    });
  }

  /**
   * Handle pressure level change
   *
   * @param level
   * @param alert
   * @private
   */
  #handlePressureChange(level, alert) {
    this.#currentPressureLevel = level;

    this.#logger.info(`Memory pressure changed to: ${level}`, {
      value:
        alert.type === 'heap'
          ? (alert.value * 100).toFixed(1) + '%'
          : (alert.value / 1048576).toFixed(2) + 'MB',
    });

    if (this.#automaticManagementEnabled) {
      this.#handleAutomaticManagement(level);
    }
  }

  /**
   * Handle automatic management for a pressure level
   *
   * @param level
   * @private
   */
  async #handleAutomaticManagement(level) {
    // Check throttling
    const timeSinceLastManagement = Date.now() - this.#lastManagementTime;
    if (timeSinceLastManagement < this.#config.minTimeBetweenManagement) {
      this.#logger.debug('Automatic management throttled');
      return;
    }

    if (level === 'normal') {
      this.#logger.debug('Normal pressure, no automatic management needed');
      return;
    }

    const strategy = this.#strategies.get(level);
    if (!strategy) {
      this.#logger.warn(`No strategy registered for level: ${level}`);
      return;
    }

    this.#logger.info(`Executing automatic management for level: ${level}`);

    try {
      const result = await strategy.execute({
        automatic: true,
        pressureLevel: level,
        currentUsage: this.#monitor.getCurrentUsage(),
      });

      this.#lastManagementTime = Date.now();
      this.#recordManagementHistory(level, result);

      this.#logger.info('Automatic management completed', {
        level,
        success: result.success,
        memoryFreed: (result.memoryFreed / 1048576).toFixed(2) + 'MB',
      });
    } catch (error) {
      this.#logger.error(
        `Automatic management failed for level ${level}:`,
        error
      );
    }
  }

  /**
   * Record management history
   *
   * @param level
   * @param result
   * @private
   */
  #recordManagementHistory(level, result) {
    const entry = {
      timestamp: Date.now(),
      level,
      success: result.success,
      memoryFreed: result.memoryFreed,
      actionsTaken: result.actionsTaken,
    };

    this.#managementHistory.push(entry);

    // Maintain history size limit
    if (this.#managementHistory.length > this.#config.maxHistorySize) {
      this.#managementHistory.shift();
    }
  }

  /**
   * Register a custom strategy for a pressure level
   *
   * @param {string} level - Pressure level
   * @param {PressureStrategy} strategy - Strategy object
   */
  registerStrategy(level, strategy) {
    assertNonBlankString(level, 'Pressure level');
    assertPresent(strategy, 'Strategy');
    assertPresent(strategy.execute, 'Strategy execute function');

    this.#strategies.set(level, strategy);

    this.#logger.info(`Strategy registered for level: ${level}`);
  }

  /**
   * Get current pressure level
   *
   * @returns {string} Current pressure level
   */
  getCurrentPressureLevel() {
    return this.#currentPressureLevel;
  }

  /**
   * Enable automatic memory management
   *
   * @param {boolean} [aggressive] - Enable aggressive management
   */
  enableAutomaticManagement(aggressive = false) {
    this.#automaticManagementEnabled = true;
    this.#config.aggressiveGC = aggressive;

    this.#logger.info('Automatic memory management enabled', {
      aggressive,
    });

    this.#eventBus.dispatch({
      type: 'MEMORY_AUTOMATIC_MANAGEMENT_ENABLED',
      payload: {
        aggressive,
      },
    });

    // Check current pressure level and act if needed
    const currentLevel = this.#monitor.getPressureLevel();
    if (currentLevel !== 'normal') {
      this.#handleAutomaticManagement(currentLevel);
    }
  }

  /**
   * Disable automatic memory management
   */
  disableAutomaticManagement() {
    this.#automaticManagementEnabled = false;

    this.#logger.info('Automatic memory management disabled');

    this.#eventBus.dispatch({
      type: 'MEMORY_AUTOMATIC_MANAGEMENT_DISABLED',
    });
  }

  /**
   * Set aggressive garbage collection mode
   *
   * @param {boolean} enabled - Whether to enable aggressive GC
   */
  setAggressiveGC(enabled) {
    this.#config.aggressiveGC = enabled;

    this.#logger.info(`Aggressive GC ${enabled ? 'enabled' : 'disabled'}`);

    // Update strategy configurations
    for (const strategy of this.#strategies.values()) {
      if (strategy.instance && strategy.instance.updateConfig) {
        strategy.instance.updateConfig({ forceGC: enabled });
      }
    }
  }

  /**
   * Trigger cache pruning at specified level
   *
   * @param {string} level - Pruning level (normal, aggressive)
   * @returns {Promise<number>} Number of entries pruned
   */
  async triggerCachePruning(level = 'normal') {
    if (!this.#cache) {
      this.#logger.warn('No cache available for pruning');
      return 0;
    }

    const aggressive = level === 'aggressive';

    this.#logger.info(`Triggering ${level} cache pruning`);

    try {
      const pruned = await this.#cache.prune(aggressive);

      this.#logger.info(`Cache pruning completed`, {
        level,
        entriesPruned: pruned,
      });

      this.#eventBus.dispatch({
        type: 'MEMORY_CACHE_PRUNED',
        payload: {
          level,
          entriesPruned: pruned,
        },
      });

      return pruned;
    } catch (error) {
      this.#logger.error('Cache pruning failed:', error);
      return 0;
    }
  }

  /**
   * Force garbage collection (if available)
   *
   * @returns {boolean} Whether GC was triggered
   */
  forceGarbageCollection() {
    try {
      const memBefore = this.#getMemoryUsage();
      const gcTriggered = triggerGarbageCollection();

      if (gcTriggered) {
        const memAfter = this.#getMemoryUsage();

        const freed = Math.max(0, memBefore - memAfter);

        this.#logger.info('Forced garbage collection', {
          memoryFreed: (freed / 1048576).toFixed(2) + 'MB',
        });

        this.#eventBus.dispatch({
          type: 'MEMORY_GC_FORCED',
          payload: {
            memoryFreed: freed,
          },
        });

        return true;
      }

      this.#logger.debug('Garbage collection not available');
      return false;
    } catch (error) {
      this.#logger.error('Force GC failed:', error);
      return false;
    }
  }

  /**
   * Release unused memory
   *
   * @returns {Promise<ManagementResult>}
   */
  async releaseUnusedMemory() {
    const startTime = Date.now();
    const actionsTaken = [];
    let totalFreed = 0;

    this.#logger.info('Releasing unused memory');

    // Prune cache
    if (this.#cache) {
      const pruned = await this.triggerCachePruning('normal');
      if (pruned > 0) {
        actionsTaken.push('cache_pruned');
        totalFreed += pruned * 1024; // Estimate
      }
    }

    // Request resource release
    this.#eventBus.dispatch({
      type: 'MEMORY_RESOURCE_RELEASE_REQUESTED',
      payload: {
        level: 'unused',
        source: 'MemoryPressureManager',
      },
    });
    actionsTaken.push('resources_released');

    // Force GC if available
    if (this.forceGarbageCollection()) {
      actionsTaken.push('gc_forced');
    }

    const executionTime = Date.now() - startTime;

    const result = {
      success: actionsTaken.length > 0,
      pressureLevel: this.#currentPressureLevel,
      actionsTaken,
      memoryFreed: totalFreed,
      metrics: {
        executionTime,
      },
    };

    this.#logger.info('Memory release completed', result);

    return result;
  }

  /**
   * Compact heap memory (placeholder for future implementation)
   *
   * @returns {Promise<boolean>}
   */
  async compactHeap() {
    this.#logger.info('Heap compaction requested');

    // This is a placeholder for heap compaction
    // In a real implementation, this would compact memory allocations

    this.#eventBus.dispatch({
      type: 'MEMORY_HEAP_COMPACTION_REQUESTED',
      payload: {
        timestamp: Date.now(),
      },
    });

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.#logger.info('Heap compaction completed (simulated)');

    return true;
  }

  /**
   * Manually execute strategy for current pressure level
   *
   * @param {object} [context] - Execution context
   * @returns {Promise<ManagementResult>}
   */
  async executeCurrentStrategy(context = {}) {
    const level = this.#currentPressureLevel;

    if (level === 'normal') {
      this.#logger.info('Normal pressure, no strategy needed');
      return {
        success: true,
        pressureLevel: level,
        actionsTaken: ['none'],
        memoryFreed: 0,
        metrics: {},
      };
    }

    const strategy = this.#strategies.get(level);
    if (!strategy) {
      throw new InvalidArgumentError(
        `No strategy registered for level: ${level}`
      );
    }

    this.#logger.info(`Manually executing strategy for level: ${level}`);

    const result = await strategy.execute({
      ...context,
      manual: true,
      pressureLevel: level,
      currentUsage: this.#monitor.getCurrentUsage(),
    });

    this.#recordManagementHistory(level, result);

    return {
      success: result.success,
      pressureLevel: level,
      actionsTaken: result.actionsTaken,
      memoryFreed: result.memoryFreed,
      metrics: result.metrics,
    };
  }

  /**
   * Get memory usage
   *
   * @private
   * @returns {number} Current memory usage in bytes
   */
  #getMemoryUsage() {
    return getMemoryUsageBytes();
  }

  /**
   * Get management statistics
   *
   * @returns {object} Statistics object
   */
  getStatistics() {
    return {
      currentPressureLevel: this.#currentPressureLevel,
      automaticManagementEnabled: this.#automaticManagementEnabled,
      lastManagementTime: this.#lastManagementTime,
      managementHistory: this.#managementHistory.slice(-10), // Last 10 entries
      registeredStrategies: Array.from(this.#strategies.keys()),
      config: { ...this.#config },
    };
  }

  /**
   * Get management history
   *
   * @param {number} [limit] - Number of entries to return
   * @returns {Array} Management history entries
   */
  getManagementHistory(limit) {
    if (limit) {
      return this.#managementHistory.slice(-limit);
    }
    return [...this.#managementHistory];
  }

  /**
   * Clear management history
   */
  clearHistory() {
    this.#managementHistory = [];
    this.#logger.info('Management history cleared');
  }

  /**
   * Destroy manager
   */
  destroy() {
    this.disableAutomaticManagement();

    // Destroy strategies
    for (const strategy of this.#strategies.values()) {
      if (strategy.instance && strategy.instance.destroy) {
        strategy.instance.destroy();
      }
    }

    this.#strategies.clear();
    this.#managementHistory = [];

    this.#logger.info('MemoryPressureManager destroyed');
  }
}
