/**
 * @file Manages rotation of trace data in IndexedDB storage
 * @see actionTraceOutputService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Default timer service that uses native timer functions
 */
class DefaultRotationTimerService {
  setInterval(callback, delay) {
    return setInterval(callback, delay);
  }

  clearInterval(timerId) {
    if (timerId) {
      clearInterval(timerId);
    }
  }
}

const defaultTimerService = new DefaultRotationTimerService();

/**
 * Rotation policies
 *
 * @enum {string}
 */
export const RotationPolicy = {
  AGE: 'age',
  COUNT: 'count',
  SIZE: 'size',
  HYBRID: 'hybrid', // Combination of policies
};

/**
 * Manages storage rotation for trace output in browser environment
 */
export class StorageRotationManager {
  #storageAdapter;
  #logger;
  #config;
  #isRotating;
  #lastRotation;
  #rotationTimer;
  #storageKey;
  #preservedTraces;
  #timerService;

  /**
   * Constructor
   *
   * @param {object} dependencies
   * @param {IStorageAdapter} dependencies.storageAdapter - IndexedDB storage interface
   * @param {ILogger} dependencies.logger - Logger service
   * @param {object} dependencies.config - Rotation configuration
   * @param {object} [dependencies.timerService] - Timer service for scheduling (defaults to real timers)
   */
  constructor({ storageAdapter, logger, config, timerService }) {
    validateDependency(storageAdapter, 'IStorageAdapter', null, {
      requiredMethods: ['getItem', 'setItem', 'removeItem'],
    });

    this.#storageAdapter = storageAdapter;
    this.#logger = ensureValidLogger(logger, 'StorageRotationManager');
    this.#config = this.#validateConfig(config);
    this.#storageKey = 'actionTraces';
    this.#timerService = timerService || defaultTimerService;

    this.#isRotating = false;
    this.#lastRotation = Date.now();
    this.#rotationTimer = null;
    this.#preservedTraces = new Set();

    this.#scheduleRotation();
  }

  /**
   * Validate and set defaults for configuration
   *
   * @param config
   * @private
   */
  #validateConfig(config) {
    return {
      // Rotation policy - handle both 'policy' and 'rotationPolicy' for backwards compatibility
      policy: config?.policy || config?.rotationPolicy || RotationPolicy.COUNT,

      // Age-based settings
      maxAge: config?.maxAge || 86400000, // 24 hours in milliseconds

      // Count-based settings
      maxTraceCount: config?.maxTraceCount || 100,

      // Size-based settings
      maxStorageSize: config?.maxStorageSize || 10 * 1024 * 1024, // 10MB
      maxTraceSize: config?.maxTraceSize || 100 * 1024, // 100KB per trace

      // Performance settings
      rotationInterval: config?.rotationInterval || 300000, // 5 minutes
      batchSize: config?.batchSize || 50, // Traces to process per batch

      // Preservation
      preservePattern: config?.preservePattern || null, // Regex to preserve traces
      preserveCount: config?.preserveCount || 10, // Keep N most recent always

      // Compression
      compressionEnabled: config?.compressionEnabled || false,
      compressionAge: config?.compressionAge || 3600000, // 1 hour

      ...config,
    };
  }

  /**
   * Schedule periodic rotation checks
   *
   * @private
   */
  #scheduleRotation() {
    if (this.#rotationTimer) {
      this.#timerService.clearInterval(this.#rotationTimer);
    }

    this.#rotationTimer = this.#timerService.setInterval(async () => {
      await this.rotateTraces();
    }, this.#config.rotationInterval);
  }

  /**
   * Perform trace rotation in IndexedDB
   *
   * @returns {Promise<object>} Rotation results
   */
  async rotateTraces() {
    if (this.#isRotating) {
      this.#logger.debug(
        'StorageRotationManager: Rotation already in progress'
      );
      return { skipped: true };
    }

    this.#isRotating = true;
    const startTime = Date.now();
    const results = {
      deleted: 0,
      compressed: 0,
      preserved: 0,
      errors: 0,
      duration: 0,
    };

    try {
      this.#logger.debug('StorageRotationManager: Starting rotation');

      // Get all traces from storage
      const traces =
        (await this.#storageAdapter.getItem(this.#storageKey)) || [];

      if (traces.length === 0) {
        this.#logger.debug('StorageRotationManager: No traces to rotate');
        return results;
      }

      // Apply rotation policy
      const { toKeep, toDelete } = await this.#applyRotationPolicy(traces);

      // Apply compression if enabled
      let finalTraces = toKeep;
      if (this.#config.compressionEnabled) {
        finalTraces = await this.#compressOldTraces(toKeep);
        results.compressed = finalTraces.filter((t) => t.compressed).length;
      }

      // Update storage with rotated traces
      await this.#storageAdapter.setItem(this.#storageKey, finalTraces);

      results.deleted = toDelete.length;
      results.preserved = finalTraces.length;
      results.duration = Date.now() - startTime;
      this.#lastRotation = Date.now();

      this.#logger.debug('StorageRotationManager: Rotation complete', results);
    } catch (error) {
      this.#logger.error('StorageRotationManager: Rotation error', error);
      results.errors++;
    } finally {
      this.#isRotating = false;
    }

    return results;
  }

  /**
   * Apply rotation policy to determine traces to keep/delete
   *
   * @param traces
   * @private
   */
  async #applyRotationPolicy(traces) {
    const policy = this.#config.policy;
    let toKeep = [];
    let toDelete = [];

    // Sort traces by timestamp (newest first)
    traces.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    switch (policy) {
      case RotationPolicy.AGE: {
        const maxAge = this.#config.maxAge;
        const now = Date.now();

        for (const trace of traces) {
          const age = now - (trace.timestamp || 0);
          if (age <= maxAge) {
            toKeep.push(trace);
          } else {
            toDelete.push(trace);
          }
        }
        break;
      }

      case RotationPolicy.COUNT: {
        const maxCount = this.#config.maxTraceCount;
        toKeep = traces.slice(0, maxCount);
        toDelete = traces.slice(maxCount);
        break;
      }

      case RotationPolicy.SIZE: {
        const maxSize = this.#config.maxStorageSize;
        const maxTraceSize = this.#config.maxTraceSize;
        let totalSize = 0;

        for (const trace of traces) {
          const traceSize = this.#estimateSize(trace);

          // Skip oversized traces
          if (traceSize > maxTraceSize) {
            toDelete.push(trace);
            continue;
          }

          if (totalSize + traceSize <= maxSize) {
            toKeep.push(trace);
            totalSize += traceSize;
          } else {
            toDelete.push(trace);
          }
        }
        break;
      }

      case RotationPolicy.HYBRID: {
        // Apply all policies and keep intersection
        const { toKeep: byAge } = await this.#applyPolicyHelper(
          traces,
          RotationPolicy.AGE
        );
        const { toKeep: byCount } = await this.#applyPolicyHelper(
          traces,
          RotationPolicy.COUNT
        );
        const { toKeep: bySize } = await this.#applyPolicyHelper(
          traces,
          RotationPolicy.SIZE
        );

        // Keep only traces that pass all policies
        const ageIds = new Set(byAge.map((t) => t.id));
        const countIds = new Set(byCount.map((t) => t.id));
        const sizeIds = new Set(bySize.map((t) => t.id));

        toKeep = traces.filter(
          (t) => ageIds.has(t.id) && countIds.has(t.id) && sizeIds.has(t.id)
        );
        toDelete = traces.filter((t) => !toKeep.includes(t));
        break;
      }

      default:
        this.#logger.warn(`StorageRotationManager: Unknown policy ${policy}`);
        toKeep = traces;
    }

    // Apply preservation rules
    return this.#applyPreservationRules(toKeep, toDelete, traces);
  }

  /**
   * Helper to apply a specific policy
   *
   * @param traces
   * @param policy
   * @private
   */
  async #applyPolicyHelper(traces, policy) {
    let toKeep = [];
    let toDelete = [];

    // Sort traces by timestamp (newest first)
    traces.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    switch (policy) {
      case RotationPolicy.AGE: {
        const maxAge = this.#config.maxAge;
        const now = Date.now();

        for (const trace of traces) {
          const age = now - (trace.timestamp || 0);
          if (age <= maxAge) {
            toKeep.push(trace);
          } else {
            toDelete.push(trace);
          }
        }
        break;
      }

      case RotationPolicy.COUNT: {
        const maxCount = this.#config.maxTraceCount;
        toKeep = traces.slice(0, maxCount);
        toDelete = traces.slice(maxCount);
        break;
      }

      case RotationPolicy.SIZE: {
        const maxSize = this.#config.maxStorageSize;
        const maxTraceSize = this.#config.maxTraceSize;
        let totalSize = 0;

        for (const trace of traces) {
          const traceSize = this.#estimateSize(trace);

          // Skip oversized traces
          if (traceSize > maxTraceSize) {
            toDelete.push(trace);
            continue;
          }

          if (totalSize + traceSize <= maxSize) {
            toKeep.push(trace);
            totalSize += traceSize;
          } else {
            toDelete.push(trace);
          }
        }
        break;
      }

    }

    return { toKeep, toDelete };
  }

  /**
   * Apply preservation rules to protect important traces
   *
   * @param toKeep
   * @param toDelete
   * @param allTraces
   * @private
   */
  #applyPreservationRules(toKeep, toDelete, allTraces) {
    const { preserveCount, preservePattern } = this.#config;

    // Always preserve N most recent
    if (preserveCount > 0) {
      const sortedByTime = [...allTraces].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );

      const recentTraces = sortedByTime.slice(0, preserveCount);
      const recentIds = new Set(recentTraces.map((t) => t.id));

      // Move preserved traces from toDelete to toKeep
      const preserved = toDelete.filter((t) => recentIds.has(t.id));
      toKeep.push(...preserved);
      toDelete = toDelete.filter((t) => !recentIds.has(t.id));

      preserved.forEach((t) => this.#preservedTraces.add(t.id));
    }

    // Preserve by pattern
    if (preservePattern) {
      const regex = new RegExp(preservePattern);
      const preserved = toDelete.filter((trace) => {
        return trace.id && regex.test(trace.id);
      });

      toKeep.push(...preserved);
      toDelete = toDelete.filter((t) => !preserved.includes(t));

      preserved.forEach((t) => this.#preservedTraces.add(t.id));
    }

    return { toKeep, toDelete };
  }

  /**
   * Compress old traces using pako (already a project dependency)
   *
   * @param traces
   * @private
   */
  async #compressOldTraces(traces) {
    const compressionAge = this.#config.compressionAge;
    const now = Date.now();

    return Promise.all(
      traces.map(async (trace) => {
        const age = now - (trace.timestamp || 0);

        if (age > compressionAge && !trace.compressed && trace.data) {
          try {
            // Dynamic import to avoid bundling if not used
            const pako = window.pako;

            if (pako) {
              const dataString = JSON.stringify(trace.data);
              const compressed = pako.deflate(dataString);

              return {
                ...trace,
                data: Array.from(compressed), // Convert Uint8Array to array for JSON storage
                compressed: true,
                originalSize: this.#estimateSize(trace.data),
                compressedSize: compressed.length,
              };
            }
          } catch (error) {
            this.#logger.warn('Failed to compress trace', {
              id: trace.id,
              error,
            });
          }
        }

        return trace;
      })
    );
  }

  /**
   * Decompress a trace for reading
   *
   * @param {object} trace - Compressed trace
   * @returns {object} Decompressed trace
   */
  async decompressTrace(trace) {
    if (!trace.compressed) {
      return trace;
    }

    try {
      const pako = window.pako;
      if (pako) {
        const compressed = new Uint8Array(trace.data);
        const decompressed = pako.inflate(compressed, { to: 'string' });

        return {
          ...trace,
          data: JSON.parse(decompressed),
          compressed: false,
        };
      }
    } catch (error) {
      this.#logger.error('Failed to decompress trace', { id: trace.id, error });
    }

    return trace;
  }

  /**
   * Estimate size of object in bytes
   *
   * @param obj
   * @private
   */
  #estimateSize(obj) {
    try {
      const str = JSON.stringify(obj);
      // Rough estimate: UTF-16 uses 2 bytes per character
      return str.length * 2;
    } catch {
      return 1024; // Default 1KB if serialization fails
    }
  }

  /**
   * Get storage statistics
   *
   * @returns {Promise<object>} Storage statistics
   */
  async getStatistics() {
    const traces = (await this.#storageAdapter.getItem(this.#storageKey)) || [];
    const totalSize = traces.reduce((sum, trace) => {
      return sum + this.#estimateSize(trace);
    }, 0);

    const compressed = traces.filter((t) => t.compressed).length;
    const preserved = traces.filter((t) =>
      this.#preservedTraces.has(t.id)
    ).length;

    return {
      isRotating: this.#isRotating,
      lastRotation: this.#lastRotation,
      policy: this.#config.policy,
      maxAge: this.#config.maxAge,
      maxCount: this.#config.maxTraceCount,
      maxSize: this.#config.maxStorageSize,
      currentCount: traces.length,
      currentSize: totalSize,
      compressedCount: compressed,
      preservedCount: preserved,
    };
  }

  /**
   * Update configuration
   *
   * @param {object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.#config = this.#validateConfig({ ...this.#config, ...newConfig });

    // Restart rotation timer with new interval
    this.#scheduleRotation();

    this.#logger.info(
      'StorageRotationManager: Configuration updated',
      this.#config
    );
  }

  /**
   * Force immediate rotation
   *
   * @returns {Promise<object>} Rotation results
   */
  async forceRotation() {
    this.#logger.info('StorageRotationManager: Forcing rotation');
    return this.rotateTraces();
  }

  /**
   * Clear all traces (with optional preservation)
   *
   * @param {boolean} preserveProtected - Keep preserved traces
   * @returns {Promise<number>} Number of traces cleared
   */
  async clearAllTraces(preserveProtected = true) {
    const traces = (await this.#storageAdapter.getItem(this.#storageKey)) || [];

    let finalTraces = [];
    if (preserveProtected) {
      finalTraces = traces.filter((t) => this.#preservedTraces.has(t.id));
    }

    await this.#storageAdapter.setItem(this.#storageKey, finalTraces);

    const cleared = traces.length - finalTraces.length;
    this.#logger.info(`StorageRotationManager: Cleared ${cleared} traces`);

    return cleared;
  }

  /**
   * Shutdown rotation manager
   */
  shutdown() {
    if (this.#rotationTimer) {
      this.#timerService.clearInterval(this.#rotationTimer);
      this.#rotationTimer = null;
    }

    this.#logger.info('StorageRotationManager: Shutdown complete');
  }
}

export default StorageRotationManager;
