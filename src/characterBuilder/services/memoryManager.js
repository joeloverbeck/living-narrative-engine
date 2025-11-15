/**
 * @file MemoryManager service
 * @description Provides weak reference storage and tracking helpers for controllers.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * @typedef {object} MemoryManagerDependencies
 * @property {ILogger} logger - Logger used for instrumentation and warnings.
 * @property {string} [contextName] - Optional context name for log scoping.
 */

/**
 * Service responsible for managing weak references and weak tracking sets.
 */
export class MemoryManager {
  /** @type {ILogger} */
  #logger;

  /** @type {string} */
  #contextName;

  /** @type {WeakMap<object, any>} */
  #weakReferences = new WeakMap();

  /** @type {WeakSet<object>} */
  #weakTracking = new WeakSet();

  /**
   * @param {MemoryManagerDependencies} deps - Service dependencies.
   */
  constructor({ logger, contextName = 'MemoryManager' }) {
    validateDependency(logger, 'logger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#contextName = contextName;
  }

  /**
   * Update the context name used in log statements.
   *
   * @param {string} contextName - New context label.
   * @returns {void}
   */
  setContextName(contextName) {
    if (typeof contextName === 'string' && contextName.trim().length > 0) {
      this.#contextName = contextName.trim();
    }
  }

  /**
   * Store a value keyed by an object using WeakMap semantics.
   *
   * @param {object} key - Weak reference key.
   * @param {any} value - Value to associate with the key.
   * @returns {void}
   */
  setWeakReference(key, value) {
    if (!this.#isObject(key)) {
      this.#logger.warn(
        `${this.#contextName}: Failed to set weak reference - key must be an object`,
        { keyType: typeof key }
      );
      throw new TypeError('WeakMap key must be an object');
    }

    this.#weakReferences.set(key, value);
  }

  /**
   * Retrieve a stored weak reference.
   *
   * @param {object} key - Key used for the lookup.
   * @returns {any} Stored value or undefined when not found.
   */
  getWeakReference(key) {
    if (!this.#isObject(key)) {
      this.#logger.warn(
        `${this.#contextName}: Cannot get weak reference - key must be an object`,
        { keyType: typeof key }
      );
      return undefined;
    }

    return this.#weakReferences.get(key);
  }

  /**
   * Track an object using WeakSet semantics.
   *
   * @param {object} obj - Object to track.
   * @returns {void}
   */
  trackWeakly(obj) {
    if (!this.#isObject(obj)) {
      this.#logger.warn(
        `${this.#contextName}: Failed to track object - value must be an object`,
        { valueType: typeof obj }
      );
      throw new TypeError('WeakSet value must be an object');
    }

    this.#weakTracking.add(obj);
  }

  /**
   * Determine whether an object is being weakly tracked.
   *
   * @param {object} obj - Object to check.
   * @returns {boolean} True when the object is tracked.
   */
  isWeaklyTracked(obj) {
    if (!this.#isObject(obj)) {
      this.#logger.warn(
        `${this.#contextName}: Cannot check weak tracking - value must be an object`,
        { valueType: typeof obj }
      );
      return false;
    }

    return this.#weakTracking.has(obj);
  }

  /**
   * Reset tracked references to allow garbage collection.
   *
   * @returns {void}
   */
  clear() {
    this.#weakReferences = new WeakMap();
    this.#weakTracking = new WeakSet();
    this.#logger.debug(`${this.#contextName}: Cleared weak references`);
  }

  /**
   * Determine whether a value is a non-null object.
   *
   * @private
   * @param {any} candidate - Value to inspect.
   * @returns {boolean}
   */
  #isObject(candidate) {
    return typeof candidate === 'object' && candidate !== null;
  }
}

export default MemoryManager;
