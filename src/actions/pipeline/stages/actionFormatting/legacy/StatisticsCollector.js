/**
 * @file StatisticsCollector - Encapsulates statistics tracking logic
 */

/**
 * Encapsulates statistics tracking logic for action formatting.
 * Provides a clean API for incrementing counters and querying stats.
 */
class StatisticsCollector {
  /** @type {Record<string, number> | null} */
  #stats;
  /** @type {boolean} */
  #enabled;

  /**
   * Creates a new statistics collector.
   *
   * @param {Record<string, number> | null | undefined} stats - Statistics object to track into, or null to disable
   */
  constructor(stats) {
    this.#stats = stats || null;
    this.#enabled = !!(stats && typeof stats === 'object');
  }

  /**
   * Increments a statistics counter by 1.
   * No-op if statistics are disabled.
   *
   * @param {string} key - The statistic key to increment
   */
  increment(key) {
    if (!this.#enabled) {
      return;
    }

    // @ts-ignore - this.#stats is non-null when #enabled is true
    if (typeof this.#stats[key] !== 'number') {
      // @ts-ignore - this.#stats is non-null when #enabled is true
      this.#stats[key] = 0;
    }

    // @ts-ignore - this.#stats is non-null when #enabled is true
    this.#stats[key] += 1;
  }

  /**
   * Checks if statistics collection is enabled.
   *
   * @returns {boolean} True if statistics are being collected
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Gets the underlying statistics object.
   *
   * @returns {Record<string, number> | null} The statistics object, or null if disabled
   */
  getStats() {
    return this.#stats;
  }

  /**
   * Gets the current value of a statistic.
   *
   * @param {string} key - The statistic key to query
   * @returns {number|undefined} The statistic value, or undefined if not set
   */
  get(key) {
    if (!this.#enabled) {
      return undefined;
    }
    // @ts-ignore - this.#stats is non-null when #enabled is true
    return this.#stats[key];
  }

  /**
   * Resets a specific statistic to 0.
   * No-op if statistics are disabled.
   *
   * @param {string} key - The statistic key to reset
   */
  reset(key) {
    if (!this.#enabled) {
      return;
    }
    // @ts-ignore - this.#stats is non-null when #enabled is true
    this.#stats[key] = 0;
  }

  /**
   * Resets all statistics to 0.
   * No-op if statistics are disabled.
   */
  resetAll() {
    if (!this.#enabled) {
      return;
    }
    // @ts-ignore - this.#stats is non-null when #enabled is true
    for (const key of Object.keys(this.#stats)) {
      // @ts-ignore - this.#stats is non-null when #enabled is true
      this.#stats[key] = 0;
    }
  }

  /**
   * Creates a snapshot of current statistics.
   *
   * @returns {Record<string, number> | null} A copy of the statistics object, or null if disabled
   */
  snapshot() {
    if (!this.#enabled) {
      return null;
    }
    // @ts-ignore - this.#stats is non-null when #enabled is true
    return { ...this.#stats };
  }
}

export default StatisticsCollector;
