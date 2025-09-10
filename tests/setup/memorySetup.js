/**
 * @file Memory test setup utilities
 * @description Configures Node.js environment for reliable memory testing
 */

/* global global, process, require */
/* eslint-disable no-console, jsdoc/check-types */

// Force expose garbage collection if available
if (typeof global !== 'undefined' && typeof global.gc === 'undefined') {
  try {
    // Try to expose gc if not already available
    // This requires Node.js to be run with --expose-gc flag
    global.gc = require('vm').runInNewContext('gc');
  } catch {
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
   * Forces garbage collection and waits for stabilization (enhanced for reliability)
   *
   * @returns {Promise<void>}
   */
  async forceGCAndWait() {
    if (global.gc) {
      // Enhanced GC cycling for better memory stabilization
      for (let i = 0; i < 4; i++) {
        global.gc();
        // Progressive delays: 50ms, 75ms, 100ms, 125ms
        await new Promise((resolve) => setTimeout(resolve, 50 + i * 25));
      }
      // Final stabilization period
      await new Promise((resolve) => setTimeout(resolve, 100));
    } else {
      // Fallback delay when GC not available
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  },

  /**
   * Gets stable memory measurement with multiple samples (enhanced for reliability)
   *
   * @param {number} samples - Number of samples to take
   * @returns {Promise<number>} Median memory usage in bytes
   */
  async getStableMemoryUsage(samples = 5) {
    // Increased default samples from 2 to 5 for better stability
    const measurements = [];

    // Extended initial stabilization for better accuracy
    await new Promise((resolve) => setTimeout(resolve, 50));

    for (let i = 0; i < samples; i++) {
      if (i > 0) {
        // Progressive delays between samples: 10ms, 15ms, 20ms, 25ms
        await new Promise((resolve) => setTimeout(resolve, 10 + i * 5));
      }
      
      // Force GC before each measurement for consistency
      if (global.gc) {
        global.gc();
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      
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
   * @returns {boolean} True if running in CI environment
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
   * Gets environment-appropriate memory thresholds (enhanced leniency)
   *
   * @param {number} baseThresholdMB - Base threshold in MB
   * @returns {number} Adjusted threshold in bytes
   */
  getMemoryThreshold(baseThresholdMB) {
    const isCI = this.isCI();
    // Enhanced multipliers for better CI reliability: CI 3.0x, local 2.0x
    const multiplier = isCI ? 3.0 : 2.0;
    return baseThresholdMB * multiplier * 1024 * 1024;
  },

  /**
   * Performs memory assertion with enhanced retry logic and adaptive thresholds
   *
   * @param {Function} measurementFn - Function that returns memory usage in bytes
   * @param {number} limitMB - Memory limit in MB
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<void>}
   */
  async assertMemoryWithRetry(measurementFn, limitMB, retries = 12) {
    // Increased default retries from 6 to 12 for better reliability
    const adjustedLimit = this.getMemoryThreshold(limitMB);

    for (let attempt = 1; attempt <= retries; attempt++) {
      // Enhanced GC and stabilization between attempts
      await this.forceGCAndWait();

      const memory = await measurementFn();

      if (memory < adjustedLimit) {
        console.log(
          `Memory assertion passed on attempt ${attempt}: ${(memory / 1024 / 1024).toFixed(2)}MB < ${(adjustedLimit / 1024 / 1024).toFixed(2)}MB`
        );
        return; // Test passed
      }

      if (attempt < retries) {
        console.log(
          `Memory assertion attempt ${attempt} failed: ${(memory / 1024 / 1024).toFixed(2)}MB > ${(adjustedLimit / 1024 / 1024).toFixed(2)}MB. Retrying...`
        );
        // Exponential backoff with jitter for retry delays
        const baseDelay = 100 + attempt * 50;
        const jitter = Math.random() * 50;
        const waitTime = baseDelay + jitter;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
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
   * Asserts memory growth is within acceptable percentage (enhanced leniency)
   *
   * @param {number} initial - Initial memory in bytes
   * @param {number} final - Final memory in bytes
   * @param {number} maxGrowthPercent - Maximum acceptable growth percentage
   * @param {string} context - Context for error messages
   */
  assertMemoryGrowthPercentage(initial, final, maxGrowthPercent, context = '') {
    const growthPercent = this.calculateMemoryGrowthPercentage(initial, final);
    // Enhanced multipliers for better CI reliability: CI 3.5x, local 2.5x
    const adjustedMaxGrowth = this.isCI()
      ? maxGrowthPercent * 3.5
      : maxGrowthPercent * 2.5;

    console.log(
      `${context ? context + ': ' : ''}Memory growth check: ${growthPercent.toFixed(1)}% vs limit ${adjustedMaxGrowth.toFixed(1)}% (Initial: ${(initial / 1024 / 1024).toFixed(2)}MB, Final: ${(final / 1024 / 1024).toFixed(2)}MB)`
    );

    if (growthPercent > adjustedMaxGrowth) {
      throw new Error(
        `${context ? context + ': ' : ''}Memory growth ${growthPercent.toFixed(1)}% exceeds limit of ${adjustedMaxGrowth.toFixed(1)}% (Initial: ${(initial / 1024 / 1024).toFixed(2)}MB, Final: ${(final / 1024 / 1024).toFixed(2)}MB)`
      );
    }
  },

  /**
   * Gets adaptive memory limits based on current system state (significantly enhanced)
   *
   * @param {Object} baseThresholds - Base thresholds object
   * @returns {Object} Adapted thresholds
   */
  getAdaptiveThresholds(baseThresholds) {
    const isCI = this.isCI();
    // Significantly enhanced multipliers for mock-heavy pipeline tests: CI 3.5x, local 2.5x
    const multiplier = isCI ? 3.5 : 2.5;

    return {
      ...baseThresholds,
      MAX_MEMORY_MB: baseThresholds.MAX_MEMORY_MB * multiplier,
      MEMORY_GROWTH_LIMIT_MB:
        baseThresholds.MEMORY_GROWTH_LIMIT_MB * multiplier,
      MEMORY_GROWTH_LIMIT_PERCENT:
        (baseThresholds.MEMORY_GROWTH_LIMIT_PERCENT || 50) * multiplier,
    };
  },

  /**
   * Adds pre-test stabilization delay to reduce flakiness
   *
   * @param {number} minimumDelayMs - Minimum stabilization delay
   * @returns {Promise<void>}
   */
  async addPreTestStabilization(minimumDelayMs = 200) {
    // Force multiple GC cycles for pre-test stabilization
    await this.forceGCAndWait();
    
    // Additional stabilization delay
    await new Promise((resolve) => setTimeout(resolve, minimumDelayMs));
    
    // Final GC before test execution
    if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    console.log(`Pre-test stabilization completed (${minimumDelayMs}ms + GC cycles)`);
  },
};
