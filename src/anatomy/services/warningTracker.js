import { BaseService } from '../../utils/serviceBase.js';

class WarningTracker extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {Map<string, Set<string>>} */
  #caches;

  constructor({ logger }) {
    super();
    this.#logger = this._init('WarningTracker', logger);
    this.#caches = new Map();
  }

  /**
   * Log a warning only once per category+key combination.
   *
   * @param {string} category
   * @param {string} key
   * @param {string} message
   */
  warnOnce(category, key, message) {
    if (this.hasWarned(category, key)) {
      return;
    }
    this.#getCategoryCache(category).add(key);
    this.#logger.warn(message);
  }

  /**
   * Check if a warning has been issued.
   *
   * @param {string} category
   * @param {string} key
   * @returns {boolean}
   */
  hasWarned(category, key) {
    const cache = this.#caches.get(category);
    return cache ? cache.has(key) : false;
  }

  /**
   * Clear all warnings (for testing).
   */
  clear() {
    this.#caches.clear();
  }

  /**
   * Clear warnings for a specific category (for testing).
   *
   * @param {string} category
   */
  clearCategory(category) {
    this.#caches.delete(category);
  }

  /**
   * @param {string} category
   * @returns {Set<string>}
   */
  #getCategoryCache(category) {
    let cache = this.#caches.get(category);
    if (!cache) {
      cache = new Set();
      this.#caches.set(category, cache);
    }
    return cache;
  }
}

export default WarningTracker;
