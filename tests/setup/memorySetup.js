/**
 * @file Memory test setup utilities
 * @description Configures Node.js environment for reliable memory testing
 */

// Force expose garbage collection if available
if (typeof global !== 'undefined' && typeof global.gc === 'undefined') {
  try {
    // Try to expose gc if not already available
    // This requires Node.js to be run with --expose-gc flag
    global.gc = require('vm').runInNewContext('gc');
  } catch (e) {
    // gc not available, memory tests may be less reliable
    console.warn(
      'Memory tests: GC not exposed. Run Node.js with --expose-gc for more reliable memory testing.'
    );
  }
}

// Set initial memory baseline
const initialMemoryUsage = process.memoryUsage();
console.log(
  `Memory test setup - Initial heap usage: ${(initialMemoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
);

// Force an initial garbage collection if available
if (global.gc) {
  global.gc();
  const afterGcMemory = process.memoryUsage();
  console.log(
    `Memory test setup - After initial GC: ${(afterGcMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
  );
}

// Global memory test utilities
global.memoryTestUtils = {
  /**
   * Forces garbage collection and waits for stabilization
   *
   * @returns {Promise<void>}
   */
  async forceGCAndWait() {
    if (global.gc) {
      global.gc();
      // Wait for first GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      global.gc();
      // Wait for second GC to complete and memory to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  },

  /**
   * Gets stable memory measurement with multiple samples (optimized)
   *
   * @param {number} samples - Number of samples to take
   * @returns {Promise<number>} Median memory usage in bytes
   */
  async getStableMemoryUsage(samples = 2) {
    // Optimized for performance
    const measurements = [];

    for (let i = 0; i < samples; i++) {
      // Removed delay for performance - measurements are fast enough
      measurements.push(process.memoryUsage().heapUsed);
    }

    // Return median to avoid outliers
    measurements.sort((a, b) => a - b);
    const mid = Math.floor(measurements.length / 2);
    return measurements.length % 2 === 0
      ? (measurements[mid - 1] + measurements[mid]) / 2
      : measurements[mid];
  },

  /**
   * Determines if running in CI environment
   *
   * @returns {boolean}
   */
  isCI() {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_URL
    );
  },

  /**
   * Gets environment-appropriate memory thresholds
   *
   * @param {number} baseThresholdMB - Base threshold in MB
   * @returns {number} Adjusted threshold in bytes
   */
  getMemoryThreshold(baseThresholdMB) {
    const isCI = this.isCI();
    const multiplier = isCI ? 1.5 : 1.0; // More lenient in CI
    return baseThresholdMB * multiplier * 1024 * 1024;
  },

  /**
   * Performs memory assertion with retry logic and adaptive thresholds
   *
   * @param {Function} measurementFn - Function that returns memory usage in bytes
   * @param {number} limitMB - Memory limit in MB
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<void>}
   */
  async assertMemoryWithRetry(measurementFn, limitMB, retries = 3) {
    const adjustedLimit = this.getMemoryThreshold(limitMB);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const memory = await measurementFn();
      
      if (memory < adjustedLimit) {
        return; // Test passed
      }
      
      if (attempt < retries) {
        console.log(
          `Memory assertion attempt ${attempt} failed: ${(memory / 1024 / 1024).toFixed(2)}MB > ${(adjustedLimit / 1024 / 1024).toFixed(2)}MB. Retrying...`
        );
        // Wait longer between retries to allow more GC
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // Final attempt failed
        throw new Error(
          `Memory assertion failed after ${retries} attempts: ${(memory / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(adjustedLimit / 1024 / 1024).toFixed(2)}MB`
        );
      }
    }
  },

  /**
   * Calculates memory growth as a percentage
   *
   * @param {number} initial - Initial memory in bytes
   * @param {number} final - Final memory in bytes
   * @returns {number} Growth percentage (0-100)
   */
  calculateMemoryGrowthPercentage(initial, final) {
    if (initial === 0) return 100;
    return ((final - initial) / initial) * 100;
  },

  /**
   * Asserts memory growth is within acceptable percentage
   *
   * @param {number} initial - Initial memory in bytes
   * @param {number} final - Final memory in bytes
   * @param {number} maxGrowthPercent - Maximum acceptable growth percentage
   * @param {string} context - Context for error messages
   */
  assertMemoryGrowthPercentage(initial, final, maxGrowthPercent, context = '') {
    const growthPercent = this.calculateMemoryGrowthPercentage(initial, final);
    const adjustedMaxGrowth = this.isCI() ? maxGrowthPercent * 1.5 : maxGrowthPercent;
    
    if (growthPercent > adjustedMaxGrowth) {
      throw new Error(
        `${context ? context + ': ' : ''}Memory growth ${growthPercent.toFixed(1)}% exceeds limit of ${adjustedMaxGrowth.toFixed(1)}% (Initial: ${(initial / 1024 / 1024).toFixed(2)}MB, Final: ${(final / 1024 / 1024).toFixed(2)}MB)`
      );
    }
  },

  /**
   * Gets adaptive memory limits based on current system state
   *
   * @param {Object} baseThresholds - Base thresholds object
   * @returns {Object} Adapted thresholds
   */
  getAdaptiveThresholds(baseThresholds) {
    const isCI = this.isCI();
    const multiplier = isCI ? 1.5 : 1.0;
    
    return {
      ...baseThresholds,
      MAX_MEMORY_MB: baseThresholds.MAX_MEMORY_MB * multiplier,
      MEMORY_GROWTH_LIMIT_MB: baseThresholds.MEMORY_GROWTH_LIMIT_MB * multiplier,
      MEMORY_GROWTH_LIMIT_PERCENT: (baseThresholds.MEMORY_GROWTH_LIMIT_PERCENT || 50) * multiplier,
    };
  },
};
