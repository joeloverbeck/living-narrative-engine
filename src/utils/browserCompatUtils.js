/**
 * @file Browser compatibility utilities for Node.js-specific APIs
 * @description Provides browser-compatible alternatives for Node.js APIs like process.memoryUsage()
 */

import { isNodeEnvironment, isBrowserEnvironment } from './environmentUtils.js';

/**
 * Browser-compatible memory usage information
 * @typedef {object} MemoryUsage
 * @property {number} heapUsed - Used heap memory in bytes
 * @property {number} heapTotal - Total heap memory in bytes  
 * @property {number} external - External memory usage in bytes (Node.js specific)
 * @property {number} rss - Resident set size in bytes (Node.js specific)
 */

/**
 * Gets memory usage information in a cross-platform way
 * @returns {MemoryUsage} Memory usage information
 */
export function getMemoryUsage() {
  // Use Node.js process.memoryUsage() if available
  if (isNodeEnvironment() && typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage();
  }

  // Use browser Performance Memory API if available
  if (isBrowserEnvironment() && typeof performance !== 'undefined' && performance.memory) {
    const memory = performance.memory;
    return {
      heapUsed: memory.usedJSHeapSize || 0,
      heapTotal: memory.totalJSHeapSize || 0,
      external: 0, // Not available in browser
      rss: memory.totalJSHeapSize || 0, // Use total heap as approximation
    };
  }

  // Fallback: return zero values
  return {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0,
  };
}

/**
 * Gets the heap used memory in bytes
 * @returns {number} Used heap memory in bytes
 */
export function getHeapUsed() {
  return getMemoryUsage().heapUsed;
}

/**
 * Checks if memory usage information is available
 * @returns {boolean} True if memory usage can be measured
 */
export function isMemoryUsageAvailable() {
  return (
    (isNodeEnvironment() && typeof process !== 'undefined' && typeof process.memoryUsage === 'function') ||
    (isBrowserEnvironment() && typeof performance !== 'undefined' && performance.memory)
  );
}

/**
 * Browser-compatible high-resolution timer
 * @returns {number} High-resolution timestamp in milliseconds
 */
export function getHighResolutionTime() {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }

  if (isNodeEnvironment() && typeof process !== 'undefined' && process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1000000;
  }

  // Fallback to Date.now()
  return Date.now();
}

/**
 * Creates a memory monitoring utility that works cross-platform
 * @param {object} [options={}] Configuration options
 * @param {boolean} [options.trackPeaks=true] Whether to track peak memory usage
 * @param {boolean} [options.warnOnUnavailable=false] Whether to warn if memory monitoring is unavailable
 * @returns {object} Memory monitor with measurement methods
 */
export function createMemoryMonitor(options = {}) {
  const { trackPeaks = true, warnOnUnavailable = false } = options;
  const available = isMemoryUsageAvailable();

  if (!available && warnOnUnavailable) {
    console.warn(
      '[MemoryMonitor] Memory usage monitoring is not available in this environment. ' +
      'Measurements will return zero values.'
    );
  }

  let initialHeapUsed = 0;
  let peakHeapUsed = 0;
  let lastCheckHeapUsed = 0;

  // Initialize baseline measurements
  if (available) {
    const initial = getMemoryUsage();
    initialHeapUsed = initial.heapUsed;
    peakHeapUsed = initial.heapUsed;
    lastCheckHeapUsed = initial.heapUsed;
  }

  return {
    /**
     * Gets current memory usage
     * @returns {MemoryUsage} Current memory usage information
     */
    getCurrentUsage() {
      return getMemoryUsage();
    },

    /**
     * Gets the initial heap usage when monitor was created
     * @returns {number} Initial heap usage in bytes
     */
    getInitialHeapUsed() {
      return initialHeapUsed;
    },

    /**
     * Gets the peak heap usage since monitor was created
     * @returns {number} Peak heap usage in bytes
     */
    getPeakHeapUsed() {
      return peakHeapUsed;
    },

    /**
     * Updates peak heap usage tracking
     * @returns {number} Current heap usage in bytes
     */
    updatePeakUsage() {
      if (!available) return 0;

      const current = getHeapUsed();
      if (trackPeaks && current > peakHeapUsed) {
        peakHeapUsed = current;
      }
      lastCheckHeapUsed = current;
      return current;
    },

    /**
     * Gets memory usage difference since last check
     * @returns {number} Memory difference in bytes (positive = increase)
     */
    getMemoryDelta() {
      if (!available) return 0;

      const current = getHeapUsed();
      const delta = current - lastCheckHeapUsed;
      lastCheckHeapUsed = current;
      return delta;
    },

    /**
     * Gets memory usage increase since initialization
     * @returns {number} Memory increase in bytes
     */
    getMemoryIncrease() {
      if (!available) return 0;
      return getHeapUsed() - initialHeapUsed;
    },

    /**
     * Resets all memory tracking counters
     */
    reset() {
      if (available) {
        const current = getMemoryUsage();
        initialHeapUsed = current.heapUsed;
        peakHeapUsed = current.heapUsed;
        lastCheckHeapUsed = current.heapUsed;
      } else {
        initialHeapUsed = 0;
        peakHeapUsed = 0;
        lastCheckHeapUsed = 0;
      }
    },

    /**
     * Checks if memory monitoring is available
     * @returns {boolean} True if memory monitoring is available
     */
    isAvailable() {
      return available;
    },

    /**
     * Gets a summary of memory usage statistics
     * @returns {object} Memory usage summary
     */
    getSummary() {
      const current = getHeapUsed();
      return {
        currentHeapUsed: current,
        initialHeapUsed,
        peakHeapUsed,
        memoryIncrease: current - initialHeapUsed,
        available,
      };
    },
  };
}

/**
 * Creates a browser-compatible process object shim
 * @returns {object} Process-like object that works in browser
 */
export function createProcessShim() {
  const processShim = {};

  // Add memoryUsage method
  processShim.memoryUsage = getMemoryUsage;

  // Add hrtime method (simplified)
  if (typeof performance !== 'undefined' && performance.now) {
    processShim.hrtime = (start) => {
      const now = performance.now();
      if (start) {
        const diff = now - (start[0] * 1000 + start[1] / 1000000);
        return [Math.floor(diff / 1000), (diff % 1000) * 1000000];
      }
      return [Math.floor(now / 1000), (now % 1000) * 1000000];
    };
  } else {
    processShim.hrtime = () => [0, 0];
  }

  // Add basic process info
  processShim.version = 'browser-shim';
  processShim.versions = { node: 'browser-shim' };

  return processShim;
}

/**
 * Safely measures operation performance with memory tracking
 * @param {string} operationName - Name of the operation being measured
 * @param {Function} operation - Function to execute and measure
 * @param {object} [options={}] Measurement options
 * @returns {*} The result of the operation
 */
export function measureOperationPerformance(operationName, operation, options = {}) {
  const { trackMemory = true, logger = null } = options;

  const startTime = getHighResolutionTime();
  let startMemory = 0;
  let memoryDelta = 0;

  // Track memory if available and requested
  if (trackMemory && isMemoryUsageAvailable()) {
    startMemory = getHeapUsed();
  }

  try {
    // Execute the operation
    const result = operation();

    // Calculate performance metrics
    const endTime = getHighResolutionTime();
    const duration = endTime - startTime;

    if (trackMemory && isMemoryUsageAvailable()) {
      const endMemory = getHeapUsed();
      memoryDelta = endMemory - startMemory;
    }

    // Log performance metrics if logger provided
    if (logger && typeof logger.debug === 'function') {
      const memoryInfo = trackMemory && isMemoryUsageAvailable() 
        ? `, memory: ${memoryDelta > 0 ? '+' : ''}${memoryDelta} bytes`
        : '';
      
      logger.debug(
        `[Performance] ${operationName}: ${duration.toFixed(2)}ms${memoryInfo}`
      );
    }

    return result;
  } catch (error) {
    // Log error with timing info
    if (logger && typeof logger.error === 'function') {
      const duration = getHighResolutionTime() - startTime;
      logger.error(
        `[Performance] ${operationName} failed after ${duration.toFixed(2)}ms:`,
        error
      );
    }
    throw error;
  }
}

/**
 * Feature detection for various browser/Node.js APIs
 */
export const features = {
  memoryUsage: isMemoryUsageAvailable(),
  performanceNow: typeof performance !== 'undefined' && typeof performance.now === 'function',
  processHrtime: isNodeEnvironment() && typeof process !== 'undefined' && typeof process.hrtime === 'function',
  webWorkers: typeof Worker !== 'undefined',
  sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  bigInt: typeof BigInt !== 'undefined',
};