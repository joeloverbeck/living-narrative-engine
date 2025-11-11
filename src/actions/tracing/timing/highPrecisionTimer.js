/**
 * @file High-precision timing service for action execution tracing
 * Provides consistent, accurate timing across different JavaScript environments
 * @see actionExecutionTrace.js
 */

/* global process */

/**
 * High-precision timer service
 * Abstracts timing implementation details and provides consistent API
 */
export class HighPrecisionTimer {
  #performanceAPIAvailable;
  #baseTimestamp;
  #hrTimeAvailable;

  constructor() {
    // Detect available timing APIs
    this.#performanceAPIAvailable =
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function';
    this.#hrTimeAvailable =
      typeof process !== 'undefined' && typeof process.hrtime === 'function';

    // Initialize base timestamp for relative measurements
    this.#baseTimestamp = this.#performanceAPIAvailable
      ? performance.now()
      : Date.now();

    // Log timing capabilities
    this.#logTimingCapabilities();
  }

  /**
   * Get current high-precision timestamp
   *
   * @returns {number} Timestamp in milliseconds with sub-millisecond precision
   */
  now() {
    // Check if performance API is available at runtime (handles cases where it might be removed)
    if (
      this.#performanceAPIAvailable &&
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    ) {
      // Browser or Node.js with performance API
      return performance.now();
    } else if (
      this.#hrTimeAvailable &&
      typeof process !== 'undefined' &&
      typeof process.hrtime === 'function'
    ) {
      // Node.js with process.hrtime
      const [seconds, nanoseconds] = process.hrtime();
      return seconds * 1000 + nanoseconds / 1000000;
    } else {
      // Fallback to Date.now() (lower precision)
      return Date.now() - this.#baseTimestamp;
    }
  }

  /**
   * Measure duration of a synchronous function
   *
   * @param {Function} fn - Function to measure
   * @returns {object} Result and timing information
   */
  measure(fn) {
    const startTime = this.now();

    try {
      const result = fn();
      const endTime = this.now();

      return {
        result,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: true,
      };
    } catch (error) {
      const endTime = this.now();

      return {
        result: null,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: false,
        error,
      };
    }
  }

  /**
   * Measure duration of an async function
   *
   * @param {Function} asyncFn - Async function to measure
   * @returns {Promise<object>} Result and timing information
   */
  async measureAsync(asyncFn) {
    const startTime = this.now();

    try {
      const result = await asyncFn();
      const endTime = this.now();

      return {
        result,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: true,
      };
    } catch (error) {
      const endTime = this.now();

      return {
        result: null,
        duration: endTime - startTime,
        startTime,
        endTime,
        success: false,
        error,
      };
    }
  }

  /**
   * Create a timing marker for later duration calculation
   *
   * @param {string} label - Label for the timing marker
   * @returns {object} Timing marker object
   */
  createMarker(label) {
    return {
      label,
      timestamp: this.now(),
      id: `${label}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Calculate duration between two timing markers
   *
   * @param {object} startMarker - Start timing marker
   * @param {object} endMarker - End timing marker
   * @returns {object} Duration information
   */
  calculateDuration(startMarker, endMarker) {
    if (!startMarker || !endMarker) {
      throw new Error('Both start and end markers are required');
    }

    const duration = endMarker.timestamp - startMarker.timestamp;

    return {
      duration,
      startMarker,
      endMarker,
      label: `${startMarker.label} → ${endMarker.label}`,
      humanReadable: this.formatDuration(duration),
    };
  }

  /**
   * Format duration in human-readable format
   *
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted duration string
   */
  formatDuration(durationMs) {
    if (durationMs < 1) {
      return `${(durationMs * 1000).toFixed(1)}μs`;
    } else if (durationMs < 1000) {
      return `${durationMs.toFixed(2)}ms`;
    } else if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Get timing precision information
   *
   * @returns {object} Timing precision details
   */
  getPrecisionInfo() {
    return {
      api: this.#getTimingAPI(),
      resolution: this.#getTimingResolution(),
      baseline: this.#measureBaseline(),
    };
  }

  /**
   * Check if high-precision timing is available
   *
   * @returns {boolean} True if high-precision timing is available
   */
  isHighPrecisionAvailable() {
    // Check at runtime for accuracy
    const perfAvailable =
      this.#performanceAPIAvailable &&
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function';
    const hrTimeAvailable =
      this.#hrTimeAvailable &&
      typeof process !== 'undefined' &&
      typeof process.hrtime === 'function';
    return perfAvailable || hrTimeAvailable;
  }

  /**
   * Get timing API being used
   *
   * @private
   * @returns {string} Name of timing API
   */
  #getTimingAPI() {
    // Check at runtime to reflect current state
    if (
      this.#performanceAPIAvailable &&
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    ) {
      return 'performance.now()';
    } else if (
      this.#hrTimeAvailable &&
      typeof process !== 'undefined' &&
      typeof process.hrtime === 'function'
    ) {
      return 'process.hrtime()';
    } else {
      return 'Date.now()';
    }
  }

  /**
   * Estimate timing resolution
   *
   * @private
   * @returns {number} Estimated resolution in milliseconds
   */
  #getTimingResolution() {
    // Check at runtime to reflect current state
    if (
      this.#performanceAPIAvailable &&
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    ) {
      return 0.001; // 1 microsecond
    } else if (
      this.#hrTimeAvailable &&
      typeof process !== 'undefined' &&
      typeof process.hrtime === 'function'
    ) {
      return 0.000001; // 1 nanosecond
    } else {
      return 1; // 1 millisecond
    }
  }

  /**
   * Measure baseline timing overhead
   *
   * @private
   * @returns {number} Baseline overhead in milliseconds
   */
  #measureBaseline() {
    const iterations = 1000;
    const startTime = this.now();

    for (let i = 0; i < iterations; i++) {
      this.now();
    }

    const totalTime = this.now() - startTime;
    return totalTime / iterations;
  }

  /**
   * Log timing capabilities at initialization
   *
   * @private
   */
  #logTimingCapabilities() {
    const api = this.#getTimingAPI();
    const resolution = this.#getTimingResolution();

    if (typeof console !== 'undefined' && console.debug) {
      console.debug(
        `HighPrecisionTimer: Using ${api} with ${resolution * 1000}μs resolution`
      );
    }
  }
}

// Create singleton instance
export const highPrecisionTimer = new HighPrecisionTimer();
