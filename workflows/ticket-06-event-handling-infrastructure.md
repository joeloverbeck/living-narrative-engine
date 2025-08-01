# Ticket #6: Build Event Handling Infrastructure

## Overview

Implement a comprehensive event handling system in the BaseCharacterBuilderController that provides automatic cleanup, consistent patterns, and support for both DOM and application events.

## Priority

**Medium** - Event handling is essential but builds on existing foundation.

## Dependencies

- Ticket #1: Base Controller Class Structure (completed)
- Ticket #4: DOM Element Management (completed - for element references)

## Estimated Effort

**2 hours**

## Acceptance Criteria

1. ✅ `_addEventListener()` method with automatic tracking
2. ✅ Support for DOM events and application events (eventBus)
3. ✅ Automatic cleanup of all listeners on destroy
4. ✅ Event delegation support for dynamic content
5. ✅ Debounce/throttle utilities for performance
6. ✅ Event listener debugging capabilities
7. ✅ Memory leak prevention
8. ✅ Cross-browser compatibility

## Implementation Details

### 1. Event Listener Tracking Enhancement

Update the field declarations in `BaseCharacterBuilderController.js`:

```javascript
/**
 * @protected
 * @type {Array<{
 *   type: 'dom'|'eventBus',
 *   element?: HTMLElement,
 *   event: string,
 *   handler: Function,
 *   originalHandler?: Function,
 *   options?: object,
 *   id?: string
 * }>}
 */
_eventListeners = [];

/** @protected @type {number} */
_eventListenerIdCounter = 0;

/** @protected @type {Map<string, Function>} */
_debouncedHandlers = new Map();

/** @protected @type {Map<string, Function>} */
_throttledHandlers = new Map();
```

### 2. Enhanced DOM Event Listener Method

```javascript
/**
 * Add event listener with automatic tracking for cleanup
 * @protected
 * @param {HTMLElement|string} elementOrKey - Element or element key from cache
 * @param {string} event - Event type (e.g., 'click', 'submit')
 * @param {Function} handler - Event handler function
 * @param {object} [options] - Event listener options
 * @param {boolean} [options.capture=false] - Use capture phase
 * @param {boolean} [options.once=false] - Remove after first call
 * @param {boolean} [options.passive=true] - Passive listener (can't preventDefault)
 * @param {string} [options.id] - Unique identifier for this listener
 * @returns {string} Listener ID for later removal
 * @example
 * // Using cached element key
 * this._addEventListener('submitBtn', 'click', this._handleSubmit.bind(this));
 *
 * // Using element directly
 * this._addEventListener(formElement, 'submit', (e) => {
 *   e.preventDefault();
 *   this._handleFormSubmit();
 * });
 *
 * // With options
 * this._addEventListener('input', 'input', this._handleInput.bind(this), {
 *   passive: true,
 *   id: 'main-input-handler'
 * });
 */
_addEventListener(elementOrKey, event, handler, options = {}) {
  // Resolve element
  let element;
  if (typeof elementOrKey === 'string') {
    element = this._getElement(elementOrKey);
    if (!element) {
      this._logger.warn(
        `${this.constructor.name}: Cannot add ${event} listener - element '${elementOrKey}' not found`
      );
      return null;
    }
  } else if (elementOrKey instanceof HTMLElement) {
    element = elementOrKey;
  } else {
    throw new Error(
      `Invalid element provided to _addEventListener: ${elementOrKey}`
    );
  }

  // Generate unique ID
  const listenerId = options.id || `listener-${++this._eventListenerIdCounter}`;

  // Check for duplicate
  if (options.id && this._eventListeners.some(l => l.id === options.id)) {
    this._logger.warn(
      `${this.constructor.name}: Listener with ID '${options.id}' already exists`
    );
    return listenerId;
  }

  // Bind handler to this context if needed
  const boundHandler = handler.bind ? handler.bind(this) : handler;

  // Add the event listener
  const listenerOptions = {
    capture: options.capture || false,
    once: options.once || false,
    passive: options.passive !== false, // Default to true for better performance
  };

  element.addEventListener(event, boundHandler, listenerOptions);

  // Track for cleanup
  this._eventListeners.push({
    type: 'dom',
    element,
    event,
    handler: boundHandler,
    originalHandler: handler,
    options: listenerOptions,
    id: listenerId,
  });

  this._logger.debug(
    `${this.constructor.name}: Added ${event} listener to ${element.tagName}#${element.id || 'no-id'} [${listenerId}]`
  );

  return listenerId;
}
```

### 3. Event Bus Integration

```javascript
/**
 * Subscribe to application event with automatic cleanup
 * @protected
 * @param {string} eventType - Event type to subscribe to
 * @param {Function} handler - Event handler function
 * @param {object} [options] - Subscription options
 * @param {string} [options.id] - Unique identifier
 * @param {number} [options.priority] - Event priority
 * @returns {string} Subscription ID
 * @example
 * // Subscribe to application event
 * this._subscribeToEvent('USER_LOGGED_IN', this._handleUserLogin.bind(this));
 *
 * // With options
 * this._subscribeToEvent('DATA_UPDATED', this._refreshDisplay.bind(this), {
 *   id: 'main-data-refresh',
 *   priority: 10
 * });
 */
_subscribeToEvent(eventType, handler, options = {}) {
  if (!this._eventBus) {
    this._logger.warn(
      `${this.constructor.name}: Cannot subscribe to '${eventType}' - eventBus not available`
    );
    return null;
  }

  const subscriptionId = options.id || `sub-${++this._eventListenerIdCounter}`;
  const boundHandler = handler.bind ? handler.bind(this) : handler;

  // Subscribe to event
  const unsubscribe = this._eventBus.subscribe(eventType, boundHandler, options.priority);

  // Track for cleanup
  this._eventListeners.push({
    type: 'eventBus',
    event: eventType,
    handler: boundHandler,
    originalHandler: handler,
    unsubscribe,
    id: subscriptionId,
  });

  this._logger.debug(
    `${this.constructor.name}: Subscribed to event '${eventType}' [${subscriptionId}]`
  );

  return subscriptionId;
}
```

### 4. Event Delegation Support

```javascript
/**
 * Add delegated event listener for dynamic content
 * @protected
 * @param {HTMLElement|string} containerOrKey - Container element or key
 * @param {string} selector - CSS selector for target elements
 * @param {string} event - Event type
 * @param {Function} handler - Event handler (receives event and matched element)
 * @param {object} [options] - Listener options
 * @returns {string} Listener ID
 * @example
 * // Handle clicks on dynamically added buttons
 * this._addDelegatedListener('resultsContainer', '.delete-btn', 'click',
 *   (event, button) => {
 *     const itemId = button.dataset.itemId;
 *     this._deleteItem(itemId);
 *   }
 * );
 */
_addDelegatedListener(containerOrKey, selector, event, handler, options = {}) {
  const delegatedHandler = (e) => {
    // Find the target element that matches the selector
    const matchedElement = e.target.closest(selector);

    if (matchedElement && this._getContainer(containerOrKey).contains(matchedElement)) {
      handler.call(this, e, matchedElement);
    }
  };

  return this._addEventListener(containerOrKey, event, delegatedHandler, {
    ...options,
    id: options.id || `delegated-${selector}-${event}`,
  });
}

/**
 * Helper to get container element
 * @private
 */
_getContainer(containerOrKey) {
  if (typeof containerOrKey === 'string') {
    return this._getElement(containerOrKey);
  }
  return containerOrKey;
}
```

### 5. Debounce and Throttle Utilities

```javascript
/**
 * Add debounced event listener
 * @protected
 * @param {HTMLElement|string} elementOrKey - Element or key
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 * @param {number} delay - Debounce delay in milliseconds
 * @param {object} [options] - Additional options
 * @returns {string} Listener ID
 * @example
 * // Debounce search input
 * this._addDebouncedListener('searchInput', 'input',
 *   this._handleSearch.bind(this),
 *   300
 * );
 */
_addDebouncedListener(elementOrKey, event, handler, delay, options = {}) {
  const debouncedHandler = this._debounce(handler, delay);
  const listenerId = `debounced-${event}-${delay}`;

  // Store for cleanup
  this._debouncedHandlers.set(listenerId, debouncedHandler);

  return this._addEventListener(elementOrKey, event, debouncedHandler, {
    ...options,
    id: options.id || listenerId,
  });
}

/**
 * Add throttled event listener
 * @protected
 * @param {HTMLElement|string} elementOrKey - Element or key
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 * @param {number} limit - Throttle limit in milliseconds
 * @param {object} [options] - Additional options
 * @returns {string} Listener ID
 * @example
 * // Throttle scroll handler
 * this._addThrottledListener(window, 'scroll',
 *   this._handleScroll.bind(this),
 *   100
 * );
 */
_addThrottledListener(elementOrKey, event, handler, limit, options = {}) {
  const throttledHandler = this._throttle(handler, limit);
  const listenerId = `throttled-${event}-${limit}`;

  // Store for cleanup
  this._throttledHandlers.set(listenerId, throttledHandler);

  return this._addEventListener(elementOrKey, event, throttledHandler, {
    ...options,
    id: options.id || listenerId,
  });
}

/**
 * Debounce utility
 * @private
 */
_debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle utility
 * @private
 */
_throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
```

### 6. Event Listener Management

```javascript
/**
 * Remove specific event listener by ID
 * @protected
 * @param {string} listenerId - Listener ID returned from add methods
 * @returns {boolean} True if listener was removed
 */
_removeEventListener(listenerId) {
  const index = this._eventListeners.findIndex(l => l.id === listenerId);

  if (index === -1) {
    this._logger.warn(
      `${this.constructor.name}: Listener '${listenerId}' not found`
    );
    return false;
  }

  const listener = this._eventListeners[index];

  // Remove the listener
  if (listener.type === 'dom') {
    listener.element.removeEventListener(
      listener.event,
      listener.handler,
      listener.options
    );
  } else if (listener.type === 'eventBus' && listener.unsubscribe) {
    listener.unsubscribe();
  }

  // Remove from tracking
  this._eventListeners.splice(index, 1);

  this._logger.debug(
    `${this.constructor.name}: Removed listener '${listenerId}'`
  );

  return true;
}

/**
 * Remove all event listeners
 * @protected
 */
_removeAllEventListeners() {
  const count = this._eventListeners.length;

  // Remove in reverse order to handle dependencies
  while (this._eventListeners.length > 0) {
    const listener = this._eventListeners.pop();

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
      this._logger.error(
        `${this.constructor.name}: Error removing listener`,
        error
      );
    }
  }

  // Clear debounced/throttled handlers
  this._debouncedHandlers.clear();
  this._throttledHandlers.clear();

  this._logger.debug(
    `${this.constructor.name}: Removed ${count} event listeners`
  );
}

/**
 * Get event listener statistics (for debugging)
 * @protected
 * @returns {object} Listener statistics
 */
_getEventListenerStats() {
  const stats = {
    total: this._eventListeners.length,
    dom: 0,
    eventBus: 0,
    byEvent: {},
  };

  this._eventListeners.forEach(listener => {
    if (listener.type === 'dom') stats.dom++;
    if (listener.type === 'eventBus') stats.eventBus++;

    const eventKey = `${listener.type}:${listener.event}`;
    stats.byEvent[eventKey] = (stats.byEvent[eventKey] || 0) + 1;
  });

  return stats;
}
```

### 7. Common Event Handlers

```javascript
/**
 * Prevent default and stop propagation helper
 * @protected
 * @param {Event} event - DOM event
 * @param {Function} handler - Handler to execute
 * @example
 * formElement.addEventListener('submit', (e) => {
 *   this._preventDefault(e, () => this._handleSubmit());
 * });
 */
_preventDefault(event, handler) {
  event.preventDefault();
  event.stopPropagation();

  if (handler) {
    handler.call(this, event);
  }
}

/**
 * Add click handler with loading state
 * @protected
 * @param {HTMLElement|string} elementOrKey - Element or key
 * @param {Function} asyncHandler - Async handler function
 * @param {object} [options] - Options
 * @returns {string} Listener ID
 */
_addAsyncClickHandler(elementOrKey, asyncHandler, options = {}) {
  const handler = async (event) => {
    const element = event.currentTarget;
    const originalText = element.textContent;
    const wasDisabled = element.disabled;

    try {
      // Show loading state
      element.disabled = true;
      if (options.loadingText) {
        element.textContent = options.loadingText;
      }
      element.classList.add('is-loading');

      // Execute handler
      await asyncHandler.call(this, event);

    } catch (error) {
      this._logger.error(
        `${this.constructor.name}: Async click handler failed`,
        error
      );
      if (options.onError) {
        options.onError(error);
      }
    } finally {
      // Restore state
      element.disabled = wasDisabled;
      element.textContent = originalText;
      element.classList.remove('is-loading');
    }
  };

  return this._addEventListener(elementOrKey, 'click', handler, options);
}
```

### 8. Update Destroy Method

This will be fully implemented in ticket #8, but add the cleanup call:

```javascript
// In destroy() method (to be completed in ticket #8)
destroy() {
  // ... other cleanup ...

  // Remove all event listeners
  this._removeAllEventListeners();

  // ... rest of cleanup ...
}
```

## Technical Considerations

### Memory Management

- All listeners must be tracked for cleanup
- Avoid circular references in handlers
- Clear references to DOM elements on cleanup
- Use WeakMap for element-specific data if needed

### Performance

- Use passive listeners by default
- Implement debounce/throttle for high-frequency events
- Use event delegation for dynamic content
- Avoid creating new functions in loops

### Cross-Browser Compatibility

- Support both addEventListener and older APIs
- Handle event option support detection
- Normalize event objects if needed

### Debugging

- Provide listener statistics method
- Log all listener additions/removals at debug level
- Include meaningful IDs for tracking
- Warn about potential memory leaks

## Testing Requirements

### Test Cases

1. **DOM Event Listeners**
   - Add listener with element key
   - Add listener with element reference
   - Handler receives correct context (this)
   - Options (capture, once, passive) work correctly
   - Missing elements handled gracefully

2. **Event Bus Integration**
   - Subscribe to application events
   - Handler receives events correctly
   - Unsubscribe works properly
   - Missing eventBus handled

3. **Event Delegation**
   - Delegated listeners work with dynamic content
   - Only matching elements trigger handler
   - Event bubbling works correctly

4. **Debounce/Throttle**
   - Debounced handlers delay correctly
   - Throttled handlers limit frequency
   - Final calls are not lost

5. **Cleanup**
   - All listeners removed on destroy
   - No memory leaks
   - Statistics accurate

### Mock Event Tests

```javascript
// Test event handling
it('should handle DOM events correctly', () => {
  const handler = jest.fn();
  const button = document.getElementById('test-button');

  const listenerId = controller._addEventListener(
    'testButton',
    'click',
    handler
  );

  // Simulate click
  button.click();

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith(expect.any(Event));

  // Remove listener
  controller._removeEventListener(listenerId);
  button.click();

  expect(handler).toHaveBeenCalledTimes(1); // Not called again
});

// Test debounce
it('should debounce input events', async () => {
  const handler = jest.fn();
  controller._addDebouncedListener('input', 'input', handler, 100);

  const input = document.getElementById('input');

  // Rapid inputs
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('input'));

  expect(handler).not.toHaveBeenCalled();

  // Wait for debounce
  await new Promise((resolve) => setTimeout(resolve, 150));

  expect(handler).toHaveBeenCalledTimes(1);
});
```

## Definition of Done

- [ ] All event handling methods implemented
- [ ] Automatic cleanup working properly
- [ ] Debounce/throttle utilities functional
- [ ] Event delegation supported
- [ ] Memory leaks prevented
- [ ] Unit tests achieve 100% coverage
- [ ] JSDoc documentation complete
- [ ] Integration with destroy lifecycle planned

## Notes for Implementer

- Study existing event patterns in controllers
- Ensure compatibility with eventBus implementation
- Make debugging easy with good logging
- Consider future needs for custom events
- Test with real user interactions
- Focus on preventing memory leaks
