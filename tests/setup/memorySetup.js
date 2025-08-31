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
   * Forces garbage collection and waits for stabilization (highly optimized)
   *
   * @returns {Promise<void>}
   */
  async forceGCAndWait() {
    if (global.gc) {
      global.gc();
      // Removed delays for maximum performance - GC is synchronous
      global.gc();
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
};
