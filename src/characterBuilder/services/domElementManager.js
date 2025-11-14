/**
 * @file DOMElementManager service
 * @description Provides DOM caching and manipulation helpers extracted from the BaseCharacterBuilderController.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 */

/**
 * @typedef {object} DOMElementConfig
 * @property {string} selector - CSS selector or element ID reference.
 * @property {boolean} [required=true] - Whether the element is required.
 * @property {(element: HTMLElement) => boolean|null} [validate=null] - Optional validator.
 */

/**
 * @typedef {object} DOMElementManagerDependencies
 * @property {ILogger} logger - Logger instance used for instrumentation.
 * @property {Document} documentRef - Document reference used for DOM queries.
 * @property {Performance} performanceRef - Performance reference for timing metrics.
 * @property {Record<string, HTMLElement|null>} elementsRef - Reference to cache store.
 * @property {string} contextName - Name used for contextual logging (usually controller name).
 */

/**
 * Service responsible for DOM caching and manipulation.
 */
export class DOMElementManager {
  /** @type {ILogger} */
  #logger;

  /** @type {Document} */
  #document;

  /** @type {Performance} */
  #performance;

  /** @type {Record<string, HTMLElement|null>} */
  #elements;

  /** @type {string} */
  #contextName;

  /**
   * @param {Partial<DOMElementManagerDependencies>} deps - Dependencies.
   */
  constructor({
    logger,
    documentRef = document,
    performanceRef = performance,
    elementsRef = {},
    contextName = 'DOMElementManager',
  } = {}) {
    validateDependency(logger, 'logger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(documentRef, 'documentRef', logger, {
      requiredMethods: ['getElementById', 'querySelector'],
    });
    validateDependency(performanceRef, 'performanceRef', logger, {
      requiredMethods: ['now'],
    });

    if (!documentRef.body || typeof documentRef.body.contains !== 'function') {
      throw new Error(
        'Invalid documentRef provided. Missing body.contains method.'
      );
    }

    this.#logger = logger;
    this.#document = documentRef;
    this.#performance = performanceRef;
    this.#elements = elementsRef;
    this.#contextName = contextName;
  }

  /**
   * @returns {Record<string, HTMLElement|null>} Snapshot of cached elements.
   */
  getElementsSnapshot() {
    return { ...this.#elements };
  }

  /**
   * Clears the cache without replacing the reference.
   *
   * @returns {number} Number of cleared entries.
   */
  clearCache() {
    const keys = Object.keys(this.#elements);
    for (const key of keys) {
      delete this.#elements[key];
    }

    this.#logger.debug(
      `${this.#contextName}: Cleared ${keys.length} cached element references`
    );
    return keys.length;
  }

  /**
   * Validate cached elements.
   *
   * @returns {{valid: string[], invalid: string[], total: number}} Validation summary.
   */
  validateElementCache() {
    const results = {
      valid: [],
      invalid: [],
      total: 0,
    };

    for (const [key, element] of Object.entries(this.#elements)) {
      results.total++;

      if (element && this.#document.body.contains(element)) {
        results.valid.push(key);
      } else {
        results.invalid.push(key);
        this.#logger.warn(
          `${this.#contextName}: Cached element '${key}' no longer in DOM`
        );
      }
    }

    return results;
  }

  /**
   * Cache a single element.
   *
   * @param {string} key - Cache key.
   * @param {string} selector - Selector or ID.
   * @param {boolean} [required=true] - Whether element is required.
   * @returns {HTMLElement|null} Cached element.
   */
  cacheElement(key, selector, required = true) {
    if (!key || typeof key !== 'string') {
      throw new Error(
        `${this.#contextName}: Invalid element key provided: ${key}`
      );
    }

    if (!selector || typeof selector !== 'string') {
      throw new Error(
        `${this.#contextName}: Invalid selector provided for key '${key}': ${selector}`
      );
    }

    const startTime = this.#performance.now();
    let element = null;

    try {
      if (selector.startsWith('#') && !selector.includes(' ')) {
        const id = selector.slice(1);
        element = this.#document.getElementById(id);

        if (!element && required) {
          throw new Error(`Required element with ID '${id}' not found in DOM`);
        }
      } else {
        element = this.#document.querySelector(selector);

        if (!element && required) {
          throw new Error(
            `Required element matching selector '${selector}' not found in DOM`
          );
        }
      }

      if (element) {
        this.validateElement(element, key);
      }

      this.#elements[key] = element;

      const cacheTime = this.#performance.now() - startTime;

      if (element) {
        this.#logger.debug(
          `${this.#contextName}: Cached element '${key}' ` +
            `(${element.tagName}${element.id ? '#' + element.id : ''}) ` +
            `in ${cacheTime.toFixed(2)}ms`
        );
      } else {
        this.#logger.debug(
          `${this.#contextName}: Optional element '${key}' not found ` +
            `(selector: ${selector})`
        );
      }

      return element;
    } catch (error) {
      const enhancedError = new Error(
        `${this.#contextName}: Failed to cache element '${key}'. ${error.message}`
      );
      enhancedError.originalError = error;
      enhancedError.elementKey = key;
      enhancedError.selector = selector;

      this.#logger.error(
        `${this.#contextName}: Element caching failed`,
        enhancedError
      );

      if (required) {
        throw enhancedError;
      }

      return null;
    }
  }

  /**
   * Cache multiple elements based on configuration map.
   *
   * @param {Record<string, string|DOMElementConfig>} elementMap - Config map.
   * @param {{continueOnError?: boolean, stopOnFirstError?: boolean}} [options] - Options.
   * @returns {{cached: Record<string, HTMLElement>, errors: Array<{key: string, error: string, selector: string}>, stats: {total: number, cached: number, failed: number, optional: number}}}
   */
  cacheElementsFromMap(elementMap, options = {}) {
    const { continueOnError = true, stopOnFirstError = false } = options;
    const results = {
      cached: {},
      errors: [],
      stats: {
        total: 0,
        cached: 0,
        failed: 0,
        optional: 0,
      },
    };

    const startTime = this.#performance.now();

    for (const [key, config] of Object.entries(elementMap)) {
      results.stats.total++;

      try {
        const elementConfig = this.normalizeElementConfig(config);
        const { selector, required, validate } = elementConfig;

        const element = this.cacheElement(key, selector, required);

        if (element) {
          if (validate && typeof validate === 'function') {
            if (!validate(element)) {
              throw new Error(`Custom validation failed for element '${key}'`);
            }
          }

          results.cached[key] = element;
          results.stats.cached++;
        } else if (!required) {
          results.stats.optional++;
        }
      } catch (error) {
        results.stats.failed++;
        results.errors.push({
          key,
          error: error.message,
          selector: typeof config === 'string' ? config : config.selector,
        });

        if (
          stopOnFirstError ||
          (!continueOnError && config.required !== false)
        ) {
          const batchError = new Error(
            `Element caching failed for '${key}': ${error.message}`
          );
          batchError.results = results;
          throw batchError;
        }

        this.#logger.warn(
          `${this.#contextName}: Failed to cache element '${key}': ${error.message}`
        );
      }
    }

    const cacheTime = this.#performance.now() - startTime;

    this.#logger.info(
      `${this.#contextName}: Cached ${results.stats.cached}/${results.stats.total} elements ` +
        `(${results.stats.optional} optional, ${results.stats.failed} failed) ` +
        `in ${cacheTime.toFixed(2)}ms`
    );

    if (results.errors.length > 0) {
      this.#logger.warn(
        `${this.#contextName}: Element caching errors:`,
        results.errors
      );
    }

    return results;
  }

  /**
   * Normalize element configuration.
   *
   * @param {string|DOMElementConfig} config - Config.
   * @returns {DOMElementConfig} Normalized config.
   */
  normalizeElementConfig(config) {
    return this.#normalizeElementConfig(config);
  }

  #normalizeElementConfig(config) {
    if (typeof config === 'string') {
      return {
        selector: config,
        required: true,
        validate: null,
      };
    }

    return {
      selector: config.selector,
      required: config.required !== false,
      validate: config.validate || null,
    };
  }

  /**
   * Get cached element by key.
   *
   * @param {string} key - Cache key.
   * @returns {HTMLElement|null} Cached element.
   */
  getElement(key) {
    return this.#elements[key] || null;
  }

  /**
   * Determine if element exists in cache and DOM.
   *
   * @param {string} key - Cache key.
   * @returns {boolean} True when element exists and is attached.
   */
  hasElement(key) {
    const element = this.#elements[key];
    return !!(element && this.#document.body.contains(element));
  }

  /**
   * Retrieve multiple cached elements.
   *
   * @param {string[]} keys - Keys to resolve.
   * @returns {Record<string, HTMLElement|null>} Map of resolved elements.
   */
  getElements(keys) {
    const elements = {};
    for (const key of keys) {
      elements[key] = this.getElement(key);
    }
    return elements;
  }

  /**
   * Refresh cached element from DOM.
   *
   * @param {string} key - Cache key.
   * @param {string} selector - Selector.
   * @returns {HTMLElement|null} Refreshed element.
   */
  refreshElement(key, selector) {
    this.#logger.debug(`${this.#contextName}: Refreshing element '${key}'`);
    delete this.#elements[key];
    return this.cacheElement(key, selector, false);
  }

  /**
   * Show element by key.
   *
   * @param {string} key - Cache key.
   * @param {string} [displayType='block'] - Display value.
   * @returns {boolean} True if shown.
   */
  showElement(key, displayType = 'block') {
    const element = this.getElement(key);
    if (element) {
      element.style.display = displayType;
      return true;
    }
    return false;
  }

  /**
   * Hide element by key.
   *
   * @param {string} key - Cache key.
   * @returns {boolean} True if hidden.
   */
  hideElement(key) {
    const element = this.getElement(key);
    if (element) {
      element.style.display = 'none';
      return true;
    }
    return false;
  }

  /**
   * Toggle element visibility.
   *
   * @param {string} key - Cache key.
   * @param {boolean} [visible] - Desired visibility.
   * @returns {boolean} Final visibility state.
   */
  toggleElement(key, visible) {
    const element = this.getElement(key);
    if (!element) return false;

    if (visible === undefined) {
      visible = element.style.display === 'none';
    }

    element.style.display = visible ? 'block' : 'none';
    return visible;
  }

  /**
   * Enable or disable element.
   *
   * @param {string} key - Cache key.
   * @param {boolean} [enabled=true] - Enable flag.
   * @returns {boolean} True if changed.
   */
  setElementEnabled(key, enabled = true) {
    const element = this.getElement(key);
    if (element && 'disabled' in element) {
      element.disabled = !enabled;
      return true;
    }
    return false;
  }

  /**
   * Update text content.
   *
   * @param {string} key - Cache key.
   * @param {string} text - Text.
   * @returns {boolean} True when updated.
   */
  setElementText(key, text) {
    const element = this.getElement(key);
    if (element) {
      element.textContent = text;
      return true;
    }
    return false;
  }

  /**
   * Add CSS class.
   *
   * @param {string} key - Cache key.
   * @param {string} className - Class name.
   * @returns {boolean} True if added.
   */
  addElementClass(key, className) {
    const element = this.getElement(key);
    if (element) {
      element.classList.add(className);
      return true;
    }
    return false;
  }

  /**
   * Remove CSS class.
   *
   * @param {string} key - Cache key.
   * @param {string} className - Class name.
   * @returns {boolean} True if removed.
   */
  removeElementClass(key, className) {
    const element = this.getElement(key);
    if (element) {
      element.classList.remove(className);
      return true;
    }
    return false;
  }

  /**
   * Validate HTMLElement instance.
   *
   * @param {HTMLElement} element - Element to validate.
   * @param {string} key - Cache key.
   */
  validateElement(element, key) {
    this.#validateElement(element, key);
  }

  /**
   * Validate HTMLElement instance.
   *
   * @param {HTMLElement} element - Element to validate.
   * @param {string} key - Cache key.
   */
  #validateElement(element, key) {
    const HTMLElementCtor =
      (this.#document.defaultView && this.#document.defaultView.HTMLElement) ||
      globalThis.HTMLElement;

    if (!HTMLElementCtor || !(element instanceof HTMLElementCtor)) {
      throw new Error(`Element '${key}' is not a valid HTMLElement`);
    }

    if (!this.#document.body.contains(element)) {
      this.#logger.warn(
        `${this.#contextName}: Element '${key}' is not attached to DOM`
      );
    }
  }
}
