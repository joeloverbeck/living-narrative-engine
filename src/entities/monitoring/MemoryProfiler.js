/**
 * @file MemoryProfiler - Memory profiling and operation tracking
 * @module MemoryProfiler
 */

import { BaseService } from '../../utils/serviceBase.js';
import {
  validateDependency,
  assertNonBlankString,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { getMemoryUsage } from '../../utils/environmentUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} MemorySnapshot
 * @property {string} id - Snapshot identifier
 * @property {number} timestamp - Timestamp in milliseconds
 * @property {number} heapUsed - Heap memory used in bytes
 * @property {number} heapTotal - Total heap size in bytes
 * @property {number} external - External memory in bytes
 * @property {object} [metadata] - Additional metadata
 */

/**
 * @typedef {object} OperationProfile
 * @property {string} id - Operation identifier
 * @property {string} label - Human-readable label
 * @property {number} startTime - Start timestamp
 * @property {number} endTime - End timestamp
 * @property {number} duration - Duration in milliseconds
 * @property {number} memoryStart - Memory at start in bytes
 * @property {number} memoryEnd - Memory at end in bytes
 * @property {number} memoryDelta - Memory change in bytes
 * @property {number} peakMemory - Peak memory during operation
 * @property {object} [metadata] - Additional metadata
 */

/**
 * @typedef {object} MemoryHotspot
 * @property {string} operation - Operation name
 * @property {number} averageMemoryIncrease - Average memory increase
 * @property {number} totalMemoryIncrease - Total memory increase
 * @property {number} executionCount - Number of executions
 * @property {number} averageDuration - Average duration
 */

/**
 * Memory profiling service for tracking operation memory usage
 */
export default class MemoryProfiler extends BaseService {
  #logger;
  #snapshots;
  #operations;
  #activeOperations;
  #config;
  #objectTracking;

  /**
   * Creates a new MemoryProfiler instance
   *
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {object} [config] - Profiler configuration
   */
  constructor({ logger }, config = {}) {
    super();

    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    this.#logger = this._init('MemoryProfiler', logger);

    this.#config = {
      maxSnapshots: config.maxSnapshots || 100,
      maxOperations: config.maxOperations || 1000,
      autoSnapshot: config.autoSnapshot !== false,
      trackPeakMemory: config.trackPeakMemory !== false,
      snapshotInterval: config.snapshotInterval || 100, // ms during operations
      ...config,
    };

    this.#snapshots = new Map();
    this.#operations = new Map();
    this.#activeOperations = new Map();
    this.#objectTracking = new Map();

    this.#logger.info('MemoryProfiler initialized', this.#config);
  }

  /**
   * Start profiling an operation
   *
   * @param {string} operationId - Unique operation identifier
   * @param {string} [label] - Human-readable label
   * @param {object} [metadata] - Additional metadata
   * @returns {string} Operation ID for tracking
   */
  startProfiling(operationId, label, metadata = {}) {
    assertNonBlankString(operationId, 'Operation ID');

    if (this.#activeOperations.has(operationId)) {
      this.#logger.warn(`Operation ${operationId} already being profiled`);
      return operationId;
    }

    const startMemory = this.#getMemoryUsage();
    const profile = {
      id: operationId,
      label: label || operationId,
      startTime: Date.now(),
      memoryStart: startMemory.heapUsed,
      peakMemory: startMemory.heapUsed,
      metadata,
      intervalHandle: null,
    };

    // Track peak memory if enabled
    if (this.#config.trackPeakMemory) {
      profile.intervalHandle = setInterval(() => {
        const currentMemory = this.#getMemoryUsage();
        profile.peakMemory = Math.max(
          profile.peakMemory,
          currentMemory.heapUsed
        );
      }, this.#config.snapshotInterval);
    }

    this.#activeOperations.set(operationId, profile);

    this.#logger.debug(`Profiling started: ${operationId}`, {
      label,
      memoryStart: (startMemory.heapUsed / 1048576).toFixed(2) + 'MB',
    });

    return operationId;
  }

  /**
   * End profiling an operation
   *
   * @param {string} operationId - Operation identifier
   * @returns {OperationProfile|null} Completed operation profile
   */
  endProfiling(operationId) {
    assertNonBlankString(operationId, 'Operation ID');

    const profile = this.#activeOperations.get(operationId);
    if (!profile) {
      this.#logger.warn(`Operation ${operationId} not being profiled`);
      return null;
    }

    // Clear interval if tracking peak memory
    if (profile.intervalHandle) {
      clearInterval(profile.intervalHandle);
    }

    const endMemory = this.#getMemoryUsage();
    const endTime = Date.now();

    const completedProfile = {
      ...profile,
      endTime,
      duration: endTime - profile.startTime,
      memoryEnd: endMemory.heapUsed,
      memoryDelta: endMemory.heapUsed - profile.memoryStart,
      intervalHandle: undefined, // Remove interval handle from result
    };

    // Store completed operation
    this.#operations.set(operationId, completedProfile);
    this.#activeOperations.delete(operationId);

    // Maintain max operations limit
    if (this.#operations.size > this.#config.maxOperations) {
      const oldestKey = this.#operations.keys().next().value;
      this.#operations.delete(oldestKey);
    }

    this.#logger.debug(`Profiling ended: ${operationId}`, {
      duration: completedProfile.duration + 'ms',
      memoryDelta: (completedProfile.memoryDelta / 1048576).toFixed(2) + 'MB',
      peakMemory: (completedProfile.peakMemory / 1048576).toFixed(2) + 'MB',
    });

    return completedProfile;
  }

  /**
   * Take a memory snapshot
   *
   * @param {string} snapshotId - Unique snapshot identifier
   * @param {object} [metadata] - Additional metadata
   * @returns {MemorySnapshot}
   */
  takeSnapshot(snapshotId, metadata = {}) {
    assertNonBlankString(snapshotId, 'Snapshot ID');

    const memory = this.#getMemoryUsage();
    const snapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      ...memory,
      metadata,
    };

    this.#snapshots.set(snapshotId, snapshot);

    // Maintain max snapshots limit
    if (this.#snapshots.size > this.#config.maxSnapshots) {
      const oldestKey = this.#snapshots.keys().next().value;
      this.#snapshots.delete(oldestKey);
    }

    this.#logger.debug(`Snapshot taken: ${snapshotId}`, {
      heapUsed: (memory.heapUsed / 1048576).toFixed(2) + 'MB',
      heapTotal: (memory.heapTotal / 1048576).toFixed(2) + 'MB',
    });

    return snapshot;
  }

  /**
   * Compare two snapshots
   *
   * @param {string} snapshotId1 - First snapshot ID
   * @param {string} snapshotId2 - Second snapshot ID
   * @returns {object|null} Comparison result
   */
  compareSnapshots(snapshotId1, snapshotId2) {
    const snapshot1 = this.#snapshots.get(snapshotId1);
    const snapshot2 = this.#snapshots.get(snapshotId2);

    if (!snapshot1 || !snapshot2) {
      this.#logger.warn('One or both snapshots not found');
      return null;
    }

    const timeDelta = snapshot2.timestamp - snapshot1.timestamp;
    const heapDelta = snapshot2.heapUsed - snapshot1.heapUsed;
    const totalDelta = snapshot2.heapTotal - snapshot1.heapTotal;

    const comparison = {
      snapshot1: snapshotId1,
      snapshot2: snapshotId2,
      timeDelta,
      heapDelta,
      totalDelta,
      heapGrowthRate: timeDelta > 0 ? (heapDelta / timeDelta) * 1000 : 0, // Bytes per second
      analysis: {
        trend:
          heapDelta > 0 ? 'growing' : heapDelta < 0 ? 'shrinking' : 'stable',
        percentChange:
          snapshot1.heapUsed > 0 ? (heapDelta / snapshot1.heapUsed) * 100 : 0,
      },
    };

    this.#logger.debug(`Snapshots compared: ${snapshotId1} vs ${snapshotId2}`, {
      heapDelta: (heapDelta / 1048576).toFixed(2) + 'MB',
      timeDelta: timeDelta + 'ms',
      trend: comparison.analysis.trend,
    });

    return comparison;
  }

  /**
   * Find memory hotspots from profiled operations
   *
   * @param {number} [minExecutions] - Minimum executions to consider
   * @returns {MemoryHotspot[]}
   */
  findMemoryHotspots(minExecutions = 2) {
    const operationStats = new Map();

    // Aggregate statistics by operation label
    for (const op of this.#operations.values()) {
      const label = op.label;

      if (!operationStats.has(label)) {
        operationStats.set(label, {
          operation: label,
          totalMemoryIncrease: 0,
          totalDuration: 0,
          executionCount: 0,
          maxIncrease: 0,
        });
      }

      const stats = operationStats.get(label);
      stats.totalMemoryIncrease += Math.max(0, op.memoryDelta);
      stats.totalDuration += op.duration;
      stats.executionCount++;
      stats.maxIncrease = Math.max(stats.maxIncrease, op.memoryDelta);
    }

    // Calculate averages and filter
    const hotspots = [];
    for (const stats of operationStats.values()) {
      if (stats.executionCount >= minExecutions) {
        hotspots.push({
          operation: stats.operation,
          averageMemoryIncrease:
            stats.totalMemoryIncrease / stats.executionCount,
          totalMemoryIncrease: stats.totalMemoryIncrease,
          executionCount: stats.executionCount,
          averageDuration: stats.totalDuration / stats.executionCount,
          maxIncrease: stats.maxIncrease,
        });
      }
    }

    // Sort by total memory increase
    hotspots.sort((a, b) => b.totalMemoryIncrease - a.totalMemoryIncrease);

    this.#logger.debug(`Found ${hotspots.length} memory hotspots`);

    return hotspots;
  }

  /**
   * Analyze retained objects (simplified for browser compatibility)
   *
   * @returns {object} Retained objects analysis
   */
  analyzeRetainedObjects() {
    const analysis = {
      trackedClasses: Array.from(this.#objectTracking.keys()),
      totalTracked: 0,
      byClass: {},
    };

    for (const [className, count] of this.#objectTracking.entries()) {
      analysis.byClass[className] = count;
      analysis.totalTracked += count;
    }

    this.#logger.debug('Retained objects analyzed', {
      totalTracked: analysis.totalTracked,
      classCount: analysis.trackedClasses.length,
    });

    return analysis;
  }

  /**
   * Generate profiling report
   *
   * @returns {object} Comprehensive profiling report
   */
  generateReport() {
    const hotspots = this.findMemoryHotspots();
    const retainedObjects = this.analyzeRetainedObjects();

    // Calculate operation statistics
    const operations = Array.from(this.#operations.values());
    const totalOperations = operations.length;
    const totalMemoryIncrease = operations.reduce(
      (sum, op) => sum + Math.max(0, op.memoryDelta),
      0
    );
    const averageMemoryIncrease =
      totalOperations > 0 ? totalMemoryIncrease / totalOperations : 0;

    // Find worst operations
    const worstOperations = [...operations]
      .sort((a, b) => b.memoryDelta - a.memoryDelta)
      .slice(0, 10)
      .map((op) => ({
        id: op.id,
        label: op.label,
        memoryDelta: op.memoryDelta,
        duration: op.duration,
      }));

    const report = {
      summary: {
        totalOperations,
        totalMemoryIncrease,
        averageMemoryIncrease,
        snapshotCount: this.#snapshots.size,
        activeOperations: this.#activeOperations.size,
      },
      hotspots: hotspots.slice(0, 10), // Top 10 hotspots
      worstOperations,
      retainedObjects,
      timestamp: Date.now(),
    };

    this.#logger.info('Profiling report generated', {
      totalOperations,
      hotspots: hotspots.length,
      totalMemoryIncrease: (totalMemoryIncrease / 1048576).toFixed(2) + 'MB',
    });

    return report;
  }

  /**
   * Measure a synchronous operation
   *
   * @param {Function} operation - Operation to measure
   * @param {string} label - Operation label
   * @returns {*} Operation result
   */
  measureOperation(operation, label) {
    assertPresent(operation, 'Operation function');
    assertNonBlankString(label, 'Operation label');

    const operationId = `${label}_${Date.now()}`;

    this.startProfiling(operationId, label);

    try {
      const result = operation();
      const profile = this.endProfiling(operationId);

      if (profile) {
        this.#logger.debug(`Operation measured: ${label}`, {
          duration: profile.duration + 'ms',
          memoryDelta: (profile.memoryDelta / 1048576).toFixed(2) + 'MB',
        });
      }

      return result;
    } catch (error) {
      this.endProfiling(operationId);
      throw error;
    }
  }

  /**
   * Measure an async operation
   *
   * @param {Function} operation - Async operation to measure
   * @param {string} label - Operation label
   * @returns {Promise<*>} Operation result
   */
  async measureAsyncOperation(operation, label) {
    assertPresent(operation, 'Operation function');
    assertNonBlankString(label, 'Operation label');

    const operationId = `${label}_${Date.now()}`;

    this.startProfiling(operationId, label);

    try {
      const result = await operation();
      const profile = this.endProfiling(operationId);

      if (profile) {
        this.#logger.debug(`Async operation measured: ${label}`, {
          duration: profile.duration + 'ms',
          memoryDelta: (profile.memoryDelta / 1048576).toFixed(2) + 'MB',
        });
      }

      return result;
    } catch (error) {
      this.endProfiling(operationId);
      throw error;
    }
  }

  /**
   * Track object allocation (simplified)
   *
   * @param {string} className - Class name to track
   */
  trackObjectAllocation(className) {
    assertNonBlankString(className, 'Class name');

    const current = this.#objectTracking.get(className) || 0;
    this.#objectTracking.set(className, current + 1);

    this.#logger.debug(`Object allocation tracked: ${className}`);
  }

  /**
   * Get current memory usage (browser-compatible)
   *
   * @private
   * @returns {object} Memory usage with heapUsed, heapTotal, external
   */
  #getMemoryUsage() {
    // Try browser performance.memory API first
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        heapUsed: performance.memory.usedJSHeapSize || 0,
        heapTotal: performance.memory.totalJSHeapSize || 0,
        external: 0, // Not available in browser
      };
    }

    // Fallback for Node.js environment
    const memUsage = getMemoryUsage();
    if (memUsage) {
      return {
        heapUsed: memUsage.heapUsed || 0,
        heapTotal: memUsage.heapTotal || 0,
        external: memUsage.external || 0,
      };
    }

    // Fallback when no memory API available
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    };
  }

  /**
   * Clear all profiling data
   */
  clear() {
    // Stop any active profiling
    for (const [id, profile] of this.#activeOperations.entries()) {
      if (profile.intervalHandle) {
        clearInterval(profile.intervalHandle);
      }
    }

    this.#snapshots.clear();
    this.#operations.clear();
    this.#activeOperations.clear();
    this.#objectTracking.clear();

    this.#logger.info('MemoryProfiler data cleared');
  }

  /**
   * Get profiler statistics
   *
   * @returns {object} Statistics object
   */
  getStatistics() {
    return {
      snapshots: this.#snapshots.size,
      operations: this.#operations.size,
      activeOperations: this.#activeOperations.size,
      trackedObjects: this.#objectTracking.size,
      config: { ...this.#config },
    };
  }

  /**
   * Destroy profiler
   */
  destroy() {
    this.clear();
    this.#logger.info('MemoryProfiler destroyed');
  }
}
