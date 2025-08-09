/**
 * @file Template Event Manager for DOM event handling
 * @module characterBuilder/templates/utilities/dataBinding/TemplateEventManager
 * @description Manages DOM event listeners for template bindings with automatic cleanup
 */

/**
 * Event manager for template DOM events
 */
export class TemplateEventManager {
  #listeners;
  #delegatedEvents;
  #nextId;

  constructor() {
    this.#listeners = new Map();
    this.#delegatedEvents = new Map();
    this.#nextId = 1;
  }

  /**
   * Add event listener to an element
   *
   * @param {HTMLElement} element - Element to bind to
   * @param {string} eventType - Event type (e.g., 'click', 'input')
   * @param {Function} handler - Event handler function
   * @param {object} [options] - Event options
   * @param {boolean} [options.once] - Remove after first trigger
   * @param {boolean} [options.passive] - Passive event listener
   * @param {boolean} [options.capture] - Capture phase
   * @returns {string} Listener ID for cleanup
   */
  addEventListener(element, eventType, handler, options = {}) {
    if (!element || !eventType || typeof handler !== 'function') {
      throw new Error('Invalid addEventListener parameters');
    }

    const listenerId = `listener_${this.#nextId++}`;

    // Wrap handler for error handling and context
    const wrappedHandler = (event) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Template event handler error:', error);
      }
    };

    // Add event listener
    element.addEventListener(eventType, wrappedHandler, options);

    // Store for cleanup
    this.#listeners.set(listenerId, {
      element,
      eventType,
      handler: wrappedHandler,
      originalHandler: handler,
      options,
    });

    return listenerId;
  }

  /**
   * Remove event listener
   *
   * @param {string} listenerId - Listener ID returned by addEventListener
   * @returns {boolean} True if listener was removed
   */
  removeEventListener(listenerId) {
    const listener = this.#listeners.get(listenerId);
    if (!listener) {
      return false;
    }

    listener.element.removeEventListener(
      listener.eventType,
      listener.handler,
      listener.options
    );

    this.#listeners.delete(listenerId);
    return true;
  }

  /**
   * Set up event delegation for a container
   *
   * @param {HTMLElement} container - Container element
   * @param {string} eventType - Event type
   * @param {string} selector - CSS selector for target elements
   * @param {Function} handler - Event handler
   * @returns {string} Delegation ID for cleanup
   */
  delegate(container, eventType, selector, handler) {
    if (
      !container ||
      !eventType ||
      !selector ||
      typeof handler !== 'function'
    ) {
      throw new Error('Invalid delegate parameters');
    }

    const delegationId = `delegate_${this.#nextId++}`;

    // Create delegated handler
    const delegatedHandler = (event) => {
      const target = event.target.closest(selector);
      if (target && container.contains(target)) {
        try {
          // Call handler with target as context
          handler.call(target, event);
        } catch (error) {
          console.error('Template delegated event handler error:', error);
        }
      }
    };

    // Add event listener to container
    container.addEventListener(eventType, delegatedHandler);

    // Store for cleanup
    this.#delegatedEvents.set(delegationId, {
      container,
      eventType,
      selector,
      handler: delegatedHandler,
      originalHandler: handler,
    });

    return delegationId;
  }

  /**
   * Remove delegated event
   *
   * @param {string} delegationId - Delegation ID
   * @returns {boolean} True if delegation was removed
   */
  removeDelegate(delegationId) {
    const delegation = this.#delegatedEvents.get(delegationId);
    if (!delegation) {
      return false;
    }

    delegation.container.removeEventListener(
      delegation.eventType,
      delegation.handler
    );

    this.#delegatedEvents.delete(delegationId);
    return true;
  }

  /**
   * Create event handler from expression
   *
   * @param {string} expression - Handler expression
   * @param {object} context - Template context
   * @param {ExpressionEvaluator} evaluator - Expression evaluator
   * @returns {Function} Event handler function
   */
  createHandler(expression, context, evaluator) {
    return (event) => {
      // Create event context
      const eventContext = {
        ...context,
        $event: event,
        $target: event.target,
        $currentTarget: event.currentTarget,
      };

      // Handle different expression types
      if (expression.includes('(')) {
        // Function call - evaluate expression
        evaluator.evaluate(expression, eventContext);
      } else {
        // Simple function reference - call directly
        const handler = evaluator.evaluate(expression, eventContext);
        if (typeof handler === 'function') {
          handler(event);
        }
      }
    };
  }

  /**
   * Clear all event listeners for a specific element
   *
   * @param {HTMLElement} element - Element to clear
   * @returns {number} Number of listeners removed
   */
  clearElement(element) {
    let removed = 0;

    // Remove direct listeners
    for (const [id, listener] of this.#listeners.entries()) {
      if (listener.element === element) {
        this.removeEventListener(id);
        removed++;
      }
    }

    // Remove delegated events where container is the element
    for (const [id, delegation] of this.#delegatedEvents.entries()) {
      if (delegation.container === element) {
        this.removeDelegate(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all event listeners and delegations
   */
  clearAll() {
    // Remove all direct listeners
    for (const id of this.#listeners.keys()) {
      this.removeEventListener(id);
    }

    // Remove all delegated events
    for (const id of this.#delegatedEvents.keys()) {
      this.removeDelegate(id);
    }
  }

  /**
   * Get statistics about registered events
   *
   * @returns {object} Event statistics
   */
  getStats() {
    return {
      directListeners: this.#listeners.size,
      delegatedEvents: this.#delegatedEvents.size,
      total: this.#listeners.size + this.#delegatedEvents.size,
    };
  }

  /**
   * Check if an element has any registered events
   *
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element has events
   */
  hasEvents(element) {
    // Check direct listeners
    for (const listener of this.#listeners.values()) {
      if (listener.element === element) {
        return true;
      }
    }

    // Check delegated events
    for (const delegation of this.#delegatedEvents.values()) {
      if (delegation.container === element) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all event listeners for an element
   *
   * @param {HTMLElement} element - Element to query
   * @returns {object[]} Array of listener info
   */
  getElementEvents(element) {
    const events = [];

    // Add direct listeners
    for (const [id, listener] of this.#listeners.entries()) {
      if (listener.element === element) {
        events.push({
          id,
          type: 'direct',
          eventType: listener.eventType,
          options: listener.options,
        });
      }
    }

    // Add delegated events
    for (const [id, delegation] of this.#delegatedEvents.entries()) {
      if (delegation.container === element) {
        events.push({
          id,
          type: 'delegated',
          eventType: delegation.eventType,
          selector: delegation.selector,
        });
      }
    }

    return events;
  }
}
