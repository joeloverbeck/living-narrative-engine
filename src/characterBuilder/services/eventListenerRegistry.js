/**
 * @file EventListenerRegistry service
 * @description Centralizes DOM and event bus listener tracking plus async handler lifecycle management.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @typedef {object} EventListenerRegistryDeps
 * @property {ILogger} logger - Logger used for instrumentation.
 * @property {{ debounce: Function, throttle: Function }} asyncUtilities - Async utilities adapter.
 * @property {string} [contextName] - Optional context name for logging clarity.
 */

/**
 * Service responsible for tracking DOM and event bus listeners with deterministic cleanup semantics.
 */
export class EventListenerRegistry {
  /** @type {ILogger} */
  #logger;

  /** @type {{ debounce: Function, throttle: Function }} */
  #asyncUtilities;

  /** @type {string} */
  #contextName;

  /** @type {Array<object>} */
  #eventListeners = [];

  /** @type {number} */
  #listenerCounter = 0;

  /** @type {Map<string, Function>} */
  #debouncedHandlers = new Map();

  /** @type {Map<string, Function>} */
  #throttledHandlers = new Map();

  /**
   * @param {EventListenerRegistryDeps} deps - Registry dependencies.
   */
  constructor({
    logger,
    asyncUtilities,
    contextName = 'EventListenerRegistry',
  }) {
    validateDependency(logger, 'logger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    if (
      !asyncUtilities ||
      typeof asyncUtilities.debounce !== 'function' ||
      typeof asyncUtilities.throttle !== 'function'
    ) {
      throw new Error(
        'EventListenerRegistry requires asyncUtilities with debounce and throttle functions'
      );
    }

    this.#logger = logger;
    this.#asyncUtilities = asyncUtilities;
    this.#contextName = contextName;
  }

  /**
   * Add DOM listener and track metadata for cleanup.
   *
   * @param {EventTarget} element - Element or target implementing addEventListener.
   * @param {string} event - Event type.
   * @param {Function} handler - Handler reference (already bound by caller when needed).
   * @param {object} [options] - Listener options.
   * @param {string} [options.id] - Explicit listener id.
   * @param {Function} [options.originalHandler] - Original handler before binding/wrapping.
   * @param {boolean} [options.capture=false] - Capture phase flag.
   * @param {boolean} [options.once=false] - Single-fire flag.
   * @param {boolean} [options.passive=true] - Passive flag.
   * @returns {string|null} Listener identifier or null when target missing.
   */
  addEventListener(element, event, handler, options = {}) {
    if (!element || typeof element.addEventListener !== 'function') {
      this.#logger.warn(
        `${this.#contextName}: Cannot add ${event} listener - invalid target provided`
      );
      return null;
    }

    const {
      id,
      originalHandler = handler,
      capture = false,
      once = false,
      passive,
      ...additionalOptions
    } = options;

    const listenerOptions = {
      capture,
      once,
      passive: passive !== false,
      ...additionalOptions,
    };

    const listenerId = id || this.#generateId('listener');

    if (id && this.#eventListeners.some((listener) => listener.id === id)) {
      this.#logger.warn(
        `${this.#contextName}: Listener with ID '${id}' already exists`
      );
      return listenerId;
    }

    element.addEventListener(event, handler, listenerOptions);

    this.#eventListeners.push({
      type: 'dom',
      element,
      event,
      handler,
      originalHandler,
      options: listenerOptions,
      id: listenerId,
    });

    const targetLabel = this.#describeTarget(element);
    this.#logger.debug(
      `${this.#contextName}: Added ${event} listener to ${targetLabel} [${listenerId}]`
    );

    return listenerId;
  }

  /**
   * Subscribe to an event bus and track unsubscribe handles.
   *
   * @param {ISafeEventDispatcher} eventBus - Event bus instance.
   * @param {string} eventType - Event name.
   * @param {Function} handler - Bound handler reference.
   * @param {object} [options] - Subscription options.
   * @param {string} [options.id] - Explicit identifier.
   * @param {Function} [options.originalHandler] - Original handler before binding.
   * @returns {string|null} Subscription id or null when subscription fails.
   */
  subscribeToEvent(eventBus, eventType, handler, options = {}) {
    if (!eventBus || typeof eventBus.subscribe !== 'function') {
      this.#logger.warn(
        `${this.#contextName}: Cannot subscribe to '${eventType}' - eventBus not available`
      );
      return null;
    }

    const subscriptionId = options.id || this.#generateId('sub');
    const unsubscribe = eventBus.subscribe(eventType, handler);

    if (typeof unsubscribe !== 'function') {
      this.#logger.error(
        `${this.#contextName}: Failed to subscribe to event '${eventType}'`
      );
      return null;
    }

    this.#eventListeners.push({
      type: 'eventBus',
      event: eventType,
      handler,
      originalHandler: options.originalHandler || handler,
      unsubscribe,
      id: subscriptionId,
    });

    this.#logger.debug(
      `${this.#contextName}: Subscribed to event '${eventType}' [${subscriptionId}]`
    );

    return subscriptionId;
  }

  /**
   * Add delegated listener that filters targets based on selector containment.
   *
   * @param {HTMLElement} container - Container for delegation boundary.
   * @param {string} selector - Selector used with closest().
   * @param {string} event - Event type.
   * @param {Function} handler - Handler invoked with (event, matchedElement).
   * @param {object} [options] - Listener options.
   * @returns {string|null} Listener identifier.
   */
  addDelegatedListener(container, selector, event, handler, options = {}) {
    if (!container || typeof container.contains !== 'function') {
      this.#logger.warn(
        `${this.#contextName}: Cannot add delegated listener - invalid container`
      );
      return null;
    }

    const delegatedHandler = (domEvent) => {
      const matchedElement = domEvent.target?.closest?.(selector) || null;
      if (matchedElement && container.contains(matchedElement)) {
        handler(domEvent, matchedElement);
      }
    };

    const listenerId = options.id || `delegated-${selector}-${event}`;

    return this.addEventListener(container, event, delegatedHandler, {
      ...options,
      id: listenerId,
      originalHandler: handler,
    });
  }

  /**
   * Add listener backed by a debounced handler.
   *
   * @param {EventTarget} element - Target element.
   * @param {string} event - Event type.
   * @param {Function} handler - Handler executed after debounce.
   * @param {number} delay - Debounce wait in ms.
   * @param {object} [options] - Additional listener options.
   * @returns {string|null} Listener identifier.
   */
  addDebouncedListener(element, event, handler, delay, options = {}) {
    if (typeof delay !== 'number' || Number.isNaN(delay)) {
      throw new TypeError('addDebouncedListener requires a numeric delay');
    }

    const debouncedHandler = this.#asyncUtilities.debounce(handler, delay);
    const listenerId = options.id || `debounced-${event}-${delay}`;

    this.#debouncedHandlers.set(listenerId, debouncedHandler);

    const cleanup = () => {
      const stored = this.#debouncedHandlers.get(listenerId);
      if (stored?.cancel) {
        stored.cancel();
      }
      this.#debouncedHandlers.delete(listenerId);
    };

    return this.#registerWrappedListener(
      element,
      event,
      debouncedHandler,
      {
        ...options,
        id: listenerId,
        originalHandler: handler,
      },
      cleanup
    );
  }

  /**
   * Add listener backed by a throttled handler.
   *
   * @param {EventTarget} element - Target element.
   * @param {string} event - Event type.
   * @param {Function} handler - Handler executed during throttling window.
   * @param {number} limit - Minimum time between invocations.
   * @param {object} [options] - Additional listener options.
   * @returns {string|null} Listener identifier.
   */
  addThrottledListener(element, event, handler, limit, options = {}) {
    if (typeof limit !== 'number' || Number.isNaN(limit)) {
      throw new TypeError('addThrottledListener requires a numeric limit');
    }

    const throttledHandler = this.#asyncUtilities.throttle(handler, limit);
    const listenerId = options.id || `throttled-${event}-${limit}`;

    this.#throttledHandlers.set(listenerId, throttledHandler);

    const cleanup = () => {
      const stored = this.#throttledHandlers.get(listenerId);
      if (stored?.cancel) {
        stored.cancel();
      }
      this.#throttledHandlers.delete(listenerId);
    };

    return this.#registerWrappedListener(
      element,
      event,
      throttledHandler,
      {
        ...options,
        id: listenerId,
        originalHandler: handler,
      },
      cleanup
    );
  }

  /**
   * Add async click handler that manages loading UI state.
   *
   * @param {EventTarget} element - Click target.
   * @param {Function} asyncHandler - Async handler executed on click.
   * @param {object} [options] - Additional options.
   * @param {string} [options.loadingText] - Temporary text content.
   * @param {(error: Error) => void} [options.onError] - Optional hook for errors.
   * @returns {string|null} Listener identifier.
   */
  addAsyncClickHandler(element, asyncHandler, options = {}) {
    const handler = async (event) => {
      const target = event.currentTarget || element;
      if (!target) {
        return asyncHandler(event);
      }

      const originalText = target.textContent;
      const wasDisabled = Boolean(target.disabled);

      try {
        target.disabled = true;
        if (options.loadingText) {
          target.textContent = options.loadingText;
        }
        target.classList?.add?.('is-loading');

        await asyncHandler(event);
      } catch (error) {
        this.#logger.error(
          `${this.#contextName}: Async click handler failed`,
          error
        );
        if (typeof options.onError === 'function') {
          options.onError(error);
        }
      } finally {
        target.disabled = wasDisabled;
        target.textContent = originalText;
        target.classList?.remove?.('is-loading');
      }
    };

    return this.addEventListener(element, 'click', handler, {
      ...options,
      originalHandler: asyncHandler,
    });
  }

  /**
   * Remove listener by identifier.
   *
   * @param {string} listenerId - Listener identifier.
   * @returns {boolean} True when removal succeeded.
   */
  removeEventListener(listenerId) {
    const index = this.#eventListeners.findIndex(
      (listener) => listener.id === listenerId
    );

    if (index === -1) {
      this.#logger.warn(
        `${this.#contextName}: Listener '${listenerId}' not found`
      );
      return false;
    }

    const [listener] = this.#eventListeners.splice(index, 1);
    this.#detachListener(listener);

    this.#logger.debug(
      `${this.#contextName}: Removed listener '${listenerId}'`
    );

    return true;
  }

  /**
   * Remove every listener and cancel async wrappers.
   */
  removeAllEventListeners() {
    const total = this.#eventListeners.length;

    while (this.#eventListeners.length > 0) {
      const listener = this.#eventListeners.pop();
      this.#detachListener(listener);
    }

    this.#clearAsyncWrappers();
    this.#logger.debug(
      `${this.#contextName}: Removed ${total} event listeners`
    );
  }

  /**
   * Detach only event bus listeners, preserving DOM listeners for reuse.
   *
   * @returns {number} Number of unsubscribed listeners.
   */
  detachEventBusListeners() {
    const listenersToRestore = [];
    let detachedCount = 0;

    while (this.#eventListeners.length > 0) {
      const listener = this.#eventListeners.pop();
      if (listener.type === 'eventBus') {
        this.#detachListener(listener);
        detachedCount += 1;
      } else {
        listenersToRestore.push(listener);
      }
    }

    listenersToRestore.reverse().forEach((listener) => {
      this.#eventListeners.push(listener);
    });

    return detachedCount;
  }

  /**
   * Provide aggregate stats for debugging.
   *
   * @returns {{ total: number, dom: number, eventBus: number, byEvent: Record<string, number> }} Stats object.
   */
  getEventListenerStats() {
    const stats = {
      total: this.#eventListeners.length,
      dom: 0,
      eventBus: 0,
      byEvent: {},
    };

    this.#eventListeners.forEach((listener) => {
      if (listener.type === 'dom') stats.dom++;
      if (listener.type === 'eventBus') stats.eventBus++;

      const eventKey = `${listener.type}:${listener.event}`;
      stats.byEvent[eventKey] = (stats.byEvent[eventKey] || 0) + 1;
    });

    return stats;
  }

  /**
   * Utility to prevent default behaviour and execute handler.
   *
   * @param {Event} event - DOM event instance.
   * @param {Function} [handler] - Optional handler.
   */
  preventDefault(event, handler) {
    if (!event) {
      return;
    }

    event.preventDefault?.();
    event.stopPropagation?.();

    if (typeof handler === 'function') {
      handler(event);
    }
  }

  /**
   * Retrieve memoized debounced handler.
   *
   * @param {string} key - Cache key.
   * @param {Function} fn - Handler to debounce.
   * @param {number} delay - Debounce delay.
   * @param {object} [options] - Debounce options forwarded to asyncUtilities.
   * @returns {Function} Debounced handler reference.
   */
  getDebouncedHandler(key, fn, delay, options) {
    if (!this.#debouncedHandlers.has(key)) {
      this.#debouncedHandlers.set(
        key,
        this.#asyncUtilities.debounce(fn, delay, options)
      );
    }
    return this.#debouncedHandlers.get(key);
  }

  /**
   * Retrieve memoized throttled handler.
   *
   * @param {string} key - Cache key.
   * @param {Function} fn - Handler to throttle.
   * @param {number} wait - Minimum wait period.
   * @param {object} [options] - Throttle options forwarded to asyncUtilities.
   * @returns {Function} Throttled handler reference.
   */
  getThrottledHandler(key, fn, wait, options) {
    if (!this.#throttledHandlers.has(key)) {
      this.#throttledHandlers.set(
        key,
        this.#asyncUtilities.throttle(fn, wait, options)
      );
    }
    return this.#throttledHandlers.get(key);
  }

  /**
   * Destroy registry by clearing listeners and handler caches.
   */
  destroy() {
    this.removeAllEventListeners();
    this.#clearAsyncWrappers();
    this.#eventListeners = [];
    this.#debouncedHandlers.clear();
    this.#throttledHandlers.clear();
  }

  /**
   * Register wrapped listeners that require cleanup.
   *
   * @private
   */
  #registerWrappedListener(element, event, handler, options, cleanup) {
    const listenerId = this.addEventListener(element, event, handler, options);
    if (!listenerId) {
      cleanup?.();
      return null;
    }

    const listener = this.#eventListeners.find((l) => l.id === listenerId);
    if (listener) {
      listener.cleanup = cleanup;
    }

    return listenerId;
  }

  /**
   * Detach listener from DOM or event bus and invoke cleanup.
   *
   * @private
   * @param {object} listener - Listener metadata.
   */
  #detachListener(listener) {
    if (!listener) {
      return;
    }

    try {
      if (listener.type === 'dom') {
        listener.element.removeEventListener(
          listener.event,
          listener.handler,
          listener.options
        );
      } else if (listener.type === 'eventBus' && listener.unsubscribe) {
        listener.unsubscribe();
      }
    } catch (error) {
      this.#logger.error(
        `${this.#contextName}: Error removing listener`,
        error
      );
    } finally {
      listener.cleanup?.();
    }
  }

  /**
   * Cancel any active wrappers and clear caches.
   *
   * @private
   */
  #clearAsyncWrappers() {
    this.#debouncedHandlers.forEach((handler) => handler?.cancel?.());
    this.#debouncedHandlers.clear();
    this.#throttledHandlers.forEach((handler) => handler?.cancel?.());
    this.#throttledHandlers.clear();
  }

  /**
   * Describe event target for logging.
   *
   * @private
   * @param {EventTarget} target - Target reference.
   * @returns {string} Human readable label.
   */
  #describeTarget(target) {
    if (!target) {
      return 'unknown-target';
    }
    if ('tagName' in target) {
      const element = /** @type {HTMLElement} */ (target);
      return `${element.tagName}#${element.id || 'no-id'}`;
    }
    return target.constructor?.name || 'EventTarget';
  }

  /**
   * Generate deterministic IDs.
   *
   * @private
   * @param {string} prefix - Identifier prefix.
   * @returns {string} Generated id.
   */
  #generateId(prefix) {
    this.#listenerCounter += 1;
    return `${prefix}-${this.#listenerCounter}`;
  }
}

export default EventListenerRegistry;
