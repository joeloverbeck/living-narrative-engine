/**
 * @file AsyncUtilitiesToolkit
 * @description Provides centralized debounce/throttle helpers and timer lifecycle management
 * extracted from BaseCharacterBuilderController.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * @typedef {object} AsyncToolkitConfig
 * @property {number} [defaultWait=100] - Default wait time in milliseconds when delay not provided.
 * @property {{ logTimerEvents?: boolean }} [instrumentation] - Optional instrumentation flags.
 */

/**
 * Toolkit that encapsulates async utilities and timer bookkeeping.
 */
export class AsyncUtilitiesToolkit {
  /** @type {ILogger} */
  #logger;

  /** @type {AsyncToolkitConfig} */
  #config;

  /** @type {Map<string, Function>} */
  #debouncedHandlers = new Map();

  /** @type {Map<string, Function>} */
  #throttledHandlers = new Map();

  /** @type {Map<number, { createdAt: number, delay: number }>} */
  #pendingTimers = new Map();

  /** @type {Map<number, { createdAt: number, delay: number }>} */
  #pendingIntervals = new Map();

  /** @type {Map<number, { createdAt: number }> } */
  #pendingAnimationFrames = new Map();

  /** @type {number} */
  #animationFrameCounter = 0;

  /**
   * @param {{ logger: ILogger } & AsyncToolkitConfig} deps - Toolkit dependencies.
   */
  constructor({ logger, defaultWait = 100, instrumentation = {} }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#config = {
      defaultWait,
      instrumentation: {
        logTimerEvents: Boolean(instrumentation.logTimerEvents),
      },
    };
  }

  /**
   * Debounce a handler.
   *
   * @param {Function} fn - Handler to debounce.
   * @param {number} [delay] - Debounce delay.
   * @param {{ leading?: boolean, trailing?: boolean, maxWait?: number }} [options] - Debounce options.
   * @returns {Function} Debounced handler with cancel/flush helpers.
   */
  debounce(fn, delay = this.#config.defaultWait, options = {}) {
    if (typeof fn !== 'function') {
      throw new TypeError('AsyncUtilitiesToolkit.debounce expects a function');
    }

    const { leading = false, trailing = true, maxWait } = options;
    let timerId = null;
    let maxTimerId = null;
    let lastCallTime = null;
    let lastExecuteTime = null;
    let lastArgs = null;
    let lastThis = null;
    let result;

    const executeFunction = () => {
      const args = lastArgs;
      const thisArg = lastThis;

      lastArgs = null;
      lastThis = null;
      lastExecuteTime = Date.now();

      result = fn.apply(thisArg, args);
      return result;
    };

    const startTimer = (wait) => {
      return this.setTimeout(() => {
        timerId = null;
        maxTimerId = null;

        if (trailing && lastArgs) {
          executeFunction();
        }
      }, wait);
    };

    const toolkit = this;

    const debounced = function (...args) {
      lastArgs = args;
      lastThis = this;
      lastCallTime = Date.now();

      const shouldExecuteNow = leading && !timerId;

      if (timerId) {
        toolkit.clearTimeout(timerId);
      }

      if (maxWait && !maxTimerId) {
        const timeToMaxWait = maxWait - (lastCallTime - (lastExecuteTime || 0));

        if (timeToMaxWait <= 0) {
          if (timerId) {
            toolkit.clearTimeout(timerId);
            timerId = null;
          }
          executeFunction();
        } else {
          maxTimerId = toolkit.setTimeout(() => {
            if (timerId) {
              toolkit.clearTimeout(timerId);
              timerId = null;
            }
            maxTimerId = null;
            executeFunction();
          }, timeToMaxWait);
        }
      }

      timerId = startTimer(delay);

      if (shouldExecuteNow) {
        executeFunction();
      }

      return result;
    };

    debounced.cancel = () => {
      if (timerId) {
        toolkit.clearTimeout(timerId);
        timerId = null;
      }
      if (maxTimerId) {
        toolkit.clearTimeout(maxTimerId);
        maxTimerId = null;
      }
      lastArgs = null;
      lastThis = null;
      lastCallTime = null;
      lastExecuteTime = null;
    };

    debounced.flush = () => {
      if (timerId) {
        toolkit.clearTimeout(timerId);
        timerId = null;
      }
      if (maxTimerId) {
        toolkit.clearTimeout(maxTimerId);
        maxTimerId = null;
      }
      if (lastArgs) {
        return executeFunction();
      }
      return result;
    };

    debounced.pending = () => Boolean(timerId);

    return debounced;
  }

  /**
   * Throttle a handler.
   *
   * @param {Function} fn - Handler to throttle.
   * @param {number} wait - Minimum wait between invocations.
   * @param {{ leading?: boolean, trailing?: boolean }} [options] - Throttle options.
   * @returns {Function} Throttled handler with cancel helper.
   */
  throttle(fn, wait = this.#config.defaultWait, options = {}) {
    if (typeof fn !== 'function') {
      throw new TypeError('AsyncUtilitiesToolkit.throttle expects a function');
    }

    const { leading = true, trailing = true } = options;
    let timerId = null;
    let lastExecuteTime = 0;
    let lastArgs = null;
    let lastThis = null;
    let result;

    const executeFunction = () => {
      const args = lastArgs;
      const thisArg = lastThis;

      lastArgs = null;
      lastThis = null;
      lastExecuteTime = Date.now();

      result = fn.apply(thisArg, args);
      return result;
    };

    const toolkit = this;

    const throttled = function (...args) {
      const now = Date.now();
      const timeSinceLastExecute = now - lastExecuteTime;

      lastArgs = args;
      lastThis = this;

      const shouldExecuteNow = leading && timeSinceLastExecute >= wait;

      if (shouldExecuteNow) {
        if (timerId) {
          toolkit.clearTimeout(timerId);
          timerId = null;
        }
        executeFunction();
      } else if (!timerId && trailing) {
        const delay = wait - timeSinceLastExecute;
        timerId = toolkit.setTimeout(
          () => {
            timerId = null;
            executeFunction();
          },
          delay > 0 ? delay : wait
        );
      }

      return result;
    };

    throttled.cancel = () => {
      if (timerId) {
        toolkit.clearTimeout(timerId);
        timerId = null;
      }
      lastArgs = null;
      lastThis = null;
    };

    throttled.flush = () => {
      if (!lastArgs) {
        return result;
      }

      if (timerId) {
        toolkit.clearTimeout(timerId);
        timerId = null;
      }

      return executeFunction();
    };

    return throttled;
  }

  /**
   * Get or create namespaced debounced handler.
   *
   * @param {string} key - Handler namespace key.
   * @param {Function} fn - Handler reference.
   * @param {number} delay - Debounce delay.
   * @param {object} [options] - Debounce options.
   * @returns {Function} Debounced handler.
   */
  getDebouncedHandler(key, fn, delay, options) {
    if (!key) {
      throw new Error(
        'AsyncUtilitiesToolkit.getDebouncedHandler requires a key'
      );
    }
    if (typeof fn !== 'function') {
      throw new TypeError(
        'AsyncUtilitiesToolkit.getDebouncedHandler expects a function'
      );
    }

    if (!this.#debouncedHandlers.has(key)) {
      const handler = this.debounce(fn, delay, options);
      this.#debouncedHandlers.set(key, handler);
    }

    return this.#debouncedHandlers.get(key);
  }

  /**
   * Get or create namespaced throttled handler.
   *
   * @param {string} key - Handler namespace key.
   * @param {Function} fn - Handler reference.
   * @param {number} wait - Wait duration.
   * @param {object} [options] - Throttle options.
   * @returns {Function} Throttled handler.
   */
  getThrottledHandler(key, fn, wait, options) {
    if (!key) {
      throw new Error(
        'AsyncUtilitiesToolkit.getThrottledHandler requires a key'
      );
    }
    if (typeof fn !== 'function') {
      throw new TypeError(
        'AsyncUtilitiesToolkit.getThrottledHandler expects a function'
      );
    }

    if (!this.#throttledHandlers.has(key)) {
      const handler = this.throttle(fn, wait, options);
      this.#throttledHandlers.set(key, handler);
    }

    return this.#throttledHandlers.get(key);
  }

  /**
   * Schedule a timeout.
   *
   * @param {Function} callback - Callback to execute.
   * @param {number} [delay] - Delay in milliseconds.
   * @returns {number} Timer ID.
   */
  setTimeout(callback, delay = this.#config.defaultWait) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        'AsyncUtilitiesToolkit.setTimeout expects a function'
      );
    }

    const timerId = globalThis.setTimeout(() => {
      try {
        callback();
      } finally {
        this.#pendingTimers.delete(timerId);
        this.#logTimerEvent('timeout:completed', { timerId });
      }
    }, delay);

    this.#pendingTimers.set(timerId, {
      createdAt: Date.now(),
      delay,
    });
    this.#logTimerEvent('timeout:scheduled', { timerId, delay });
    return timerId;
  }

  /**
   * Clear a timeout.
   *
   * @param {number} timerId - Timer identifier.
   */
  clearTimeout(timerId) {
    if (!this.#pendingTimers.has(timerId)) {
      return;
    }
    globalThis.clearTimeout(timerId);
    this.#pendingTimers.delete(timerId);
    this.#logTimerEvent('timeout:cleared', { timerId });
  }

  /**
   * Schedule an interval.
   *
   * @param {Function} callback - Callback to execute.
   * @param {number} [delay] - Delay in milliseconds.
   * @returns {number} Interval ID.
   */
  setInterval(callback, delay = this.#config.defaultWait) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        'AsyncUtilitiesToolkit.setInterval expects a function'
      );
    }

    const intervalId = globalThis.setInterval(callback, delay);
    this.#pendingIntervals.set(intervalId, {
      createdAt: Date.now(),
      delay,
    });
    this.#logTimerEvent('interval:scheduled', { intervalId, delay });
    return intervalId;
  }

  /**
   * Clear an interval.
   *
   * @param {number} intervalId - Interval identifier.
   */
  clearInterval(intervalId) {
    if (!this.#pendingIntervals.has(intervalId)) {
      return;
    }
    globalThis.clearInterval(intervalId);
    this.#pendingIntervals.delete(intervalId);
    this.#logTimerEvent('interval:cleared', { intervalId });
  }

  /**
   * Request animation frame.
   *
   * @param {Function} callback - Frame callback.
   * @returns {number} Frame identifier.
   */
  requestAnimationFrame(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        'AsyncUtilitiesToolkit.requestAnimationFrame expects a function'
      );
    }

    const frameId = ++this.#animationFrameCounter;
    const raf =
      globalThis.requestAnimationFrame ||
      ((cb) => globalThis.setTimeout(() => cb(Date.now()), 16));
    const cancelRaf =
      globalThis.cancelAnimationFrame || globalThis.clearTimeout;

    const wrappedCallback = (timestamp) => {
      try {
        callback(timestamp);
      } finally {
        this.#pendingAnimationFrames.delete(frameId);
        this.#logTimerEvent('animationFrame:completed', { frameId });
      }
    };

    const nativeId = raf(wrappedCallback);
    this.#pendingAnimationFrames.set(frameId, {
      createdAt: Date.now(),
      nativeId,
      cancelRaf,
    });
    this.#logTimerEvent('animationFrame:scheduled', { frameId });
    return frameId;
  }

  /**
   * Cancel animation frame.
   *
   * @param {number} frameId - Frame identifier.
   */
  cancelAnimationFrame(frameId) {
    const frameMeta = this.#pendingAnimationFrames.get(frameId);
    if (!frameMeta) {
      return;
    }

    frameMeta.cancelRaf(frameMeta.nativeId);
    this.#pendingAnimationFrames.delete(frameId);
    this.#logTimerEvent('animationFrame:cancelled', { frameId });
  }

  /**
   * Clear all timers and async handlers.
   *
   * @returns {{ timers: number, intervals: number, animationFrames: number, debouncedHandlers: number, throttledHandlers: number }}
   */
  clearAllTimers() {
    const summary = {
      timers: this.#pendingTimers.size,
      intervals: this.#pendingIntervals.size,
      animationFrames: this.#pendingAnimationFrames.size,
      debouncedHandlers: this.#debouncedHandlers.size,
      throttledHandlers: this.#throttledHandlers.size,
    };

    this.#pendingTimers.forEach((_, timerId) => {
      globalThis.clearTimeout(timerId);
    });
    this.#pendingTimers.clear();

    this.#pendingIntervals.forEach((_, intervalId) => {
      globalThis.clearInterval(intervalId);
    });
    this.#pendingIntervals.clear();

    this.#pendingAnimationFrames.forEach((frameMeta, frameId) => {
      frameMeta.cancelRaf(frameMeta.nativeId);
      this.#pendingAnimationFrames.delete(frameId);
    });

    this.#debouncedHandlers.forEach((handler) => handler.cancel?.());
    this.#debouncedHandlers.clear();

    this.#throttledHandlers.forEach((handler) => handler.cancel?.());
    this.#throttledHandlers.clear();

    return summary;
  }

  /**
   * Get timer statistics.
   *
   * @returns {{
   *  timeouts: { count: number, entries: Array<{ id: number, delay: number, createdAt: number }> },
   *  intervals: { count: number, entries: Array<{ id: number, delay: number, createdAt: number }> },
   *  animationFrames: { count: number },
   *  handlers: { debounced: number, throttled: number }
   * }} Timer stats snapshot.
   */
  getTimerStats() {
    return {
      timeouts: {
        count: this.#pendingTimers.size,
        entries: Array.from(this.#pendingTimers.entries()).map(
          ([id, meta]) => ({
            id,
            delay: meta.delay,
            createdAt: meta.createdAt,
          })
        ),
      },
      intervals: {
        count: this.#pendingIntervals.size,
        entries: Array.from(this.#pendingIntervals.entries()).map(
          ([id, meta]) => ({
            id,
            delay: meta.delay,
            createdAt: meta.createdAt,
          })
        ),
      },
      animationFrames: {
        count: this.#pendingAnimationFrames.size,
      },
      handlers: {
        debounced: this.#debouncedHandlers.size,
        throttled: this.#throttledHandlers.size,
      },
    };
  }

  /**
   * Log timer events when instrumentation enabled.
   *
   * @private
   * @param {string} event - Event name.
   * @param {object} payload - Event payload.
   */
  #logTimerEvent(event, payload) {
    if (!this.#config.instrumentation.logTimerEvents) {
      return;
    }
    this.#logger.debug(`AsyncUtilitiesToolkit:${event}`, payload);
  }
}

const toolkitOwners = new WeakMap();

/**
 * Register toolkit for an owner.
 *
 * @param {object} owner - Owning instance reference.
 * @param {AsyncUtilitiesToolkit} toolkit - Toolkit instance.
 */
export function registerToolkitForOwner(owner, toolkit) {
  if (!owner || !toolkit) {
    return;
  }
  toolkitOwners.set(owner, toolkit);
}

/**
 * Retrieve toolkit for an owner.
 *
 * @param {object} owner - Owning instance.
 * @returns {AsyncUtilitiesToolkit|null}
 */
export function getToolkitForOwner(owner) {
  return toolkitOwners.get(owner) || null;
}

/**
 * Remove toolkit entry for an owner.
 *
 * @param {object} owner - Owning instance.
 */
export function unregisterToolkitForOwner(owner) {
  toolkitOwners.delete(owner);
}

export default AsyncUtilitiesToolkit;
