# Ticket #8: Implement Resource Cleanup and Lifecycle

## Overview

Implement the `destroy()` method and complete resource cleanup lifecycle in the BaseCharacterBuilderController. This ensures proper memory management, prevents memory leaks, and provides a clean shutdown process for controllers.

## Priority

**Medium** - Resource cleanup is important for preventing memory leaks in long-running applications.

## Dependencies

- Ticket #4: DOM Element Management (completed - for element cleanup)
- Ticket #6: Event Handling Infrastructure (completed - for listener cleanup)

## Estimated Effort

**1 hour**

## Acceptance Criteria

1. ✅ Complete `destroy()` method implementation
2. ✅ All event listeners removed properly
3. ✅ DOM element references cleared
4. ✅ Service cleanup hooks available
5. ✅ Proper cleanup order maintained
6. ✅ Memory leaks prevented
7. ✅ Destruction state tracked
8. ✅ Cleanup errors handled gracefully

## Implementation Details

### 1. Lifecycle State Tracking

Add to field declarations in `BaseCharacterBuilderController.js`:

```javascript
/** @protected @type {boolean} */
_isDestroyed = false;

/** @protected @type {boolean} */
_isDestroying = false;

/** @protected @type {Array<Function>} */
_cleanupTasks = [];
```

### 2. Main Destroy Method

Replace the placeholder `destroy()` method:

```javascript
/**
 * Cleanup resources - call when controller is destroyed
 * Performs cleanup in reverse order of initialization
 * @public
 * @returns {Promise<void>}
 */
async destroy() {
  if (this._isDestroyed) {
    this._logger.warn(
      `${this.constructor.name}: Already destroyed, skipping cleanup`
    );
    return;
  }

  if (this._isDestroying) {
    this._logger.warn(
      `${this.constructor.name}: Destruction already in progress`
    );
    return;
  }

  this._isDestroying = true;
  const startTime = performance.now();

  try {
    this._logger.info(`${this.constructor.name}: Starting cleanup`);

    // Pre-destruction hook
    await this._executeLifecycleMethod('_preDestroy', 'pre-destruction');

    // Step 1: Cancel any pending operations
    await this._cancelPendingOperations();

    // Step 2: Remove event listeners (DOM and eventBus)
    this._removeAllEventListeners();

    // Step 3: Cleanup services
    await this._cleanupServices();

    // Step 4: Clear element references
    this._clearElementCache();

    // Step 5: Execute registered cleanup tasks
    await this._executeCleanupTasks();

    // Step 6: Clear remaining references
    this._clearReferences();

    // Post-destruction hook
    await this._executeLifecycleMethod('_postDestroy', 'post-destruction');

    // Mark as destroyed
    this._isDestroyed = true;
    this._isDestroying = false;
    this._isInitialized = false;

    const destroyTime = performance.now() - startTime;
    this._logger.info(
      `${this.constructor.name}: Cleanup completed in ${destroyTime.toFixed(2)}ms`
    );

    // Dispatch destruction complete event
    if (this._eventBus && !this._isDestroyed) {
      this._eventBus.dispatch('CONTROLLER_DESTROYED', {
        controllerName: this.constructor.name,
        destroyTime,
      });
    }

  } catch (error) {
    this._logger.error(
      `${this.constructor.name}: Error during cleanup`,
      error
    );

    // Still mark as destroyed to prevent memory leaks
    this._isDestroyed = true;
    this._isDestroying = false;

    // Re-throw to notify caller
    throw new Error(`Cleanup failed: ${error.message}`);
  }
}
```

### 3. Cleanup Lifecycle Hooks

```javascript
/**
 * Pre-destruction hook - override in subclasses
 * Called before any cleanup operations
 * @protected
 * @returns {Promise<void>}
 * @example
 * async _preDestroy() {
 *   await this._saveState();
 *   this._notifyDependents();
 * }
 */
async _preDestroy() {
  // Default implementation - no-op
  // Subclasses can override for custom pre-destruction logic
}

/**
 * Post-destruction hook - override in subclasses
 * Called after all cleanup operations
 * @protected
 * @returns {Promise<void>}
 */
async _postDestroy() {
  // Default implementation - no-op
  // Subclasses can override for custom post-destruction logic
}
```

### 4. Pending Operations Management

```javascript
/**
 * Cancel any pending operations
 * @private
 * @returns {Promise<void>}
 */
async _cancelPendingOperations() {
  this._logger.debug(
    `${this.constructor.name}: Cancelling pending operations`
  );

  // Cancel any pending timers
  if (this._pendingTimers) {
    this._pendingTimers.forEach(timerId => clearTimeout(timerId));
    this._pendingTimers.clear();
  }

  // Cancel any pending intervals
  if (this._pendingIntervals) {
    this._pendingIntervals.forEach(intervalId => clearInterval(intervalId));
    this._pendingIntervals.clear();
  }

  // Cancel any pending animation frames
  if (this._pendingAnimationFrames) {
    this._pendingAnimationFrames.forEach(frameId =>
      cancelAnimationFrame(frameId)
    );
    this._pendingAnimationFrames.clear();
  }

  // Allow subclasses to cancel their operations
  if (typeof this._cancelCustomOperations === 'function') {
    await this._cancelCustomOperations();
  }
}

// Add timer tracking methods
/**
 * Set timeout with automatic cleanup
 * @protected
 * @param {Function} callback - Callback function
 * @param {number} delay - Delay in milliseconds
 * @returns {number} Timer ID
 */
_setTimeout(callback, delay) {
  if (!this._pendingTimers) {
    this._pendingTimers = new Set();
  }

  const timerId = setTimeout(() => {
    this._pendingTimers.delete(timerId);
    callback();
  }, delay);

  this._pendingTimers.add(timerId);
  return timerId;
}

/**
 * Clear timeout
 * @protected
 * @param {number} timerId - Timer ID to clear
 */
_clearTimeout(timerId) {
  clearTimeout(timerId);
  if (this._pendingTimers) {
    this._pendingTimers.delete(timerId);
  }
}

/**
 * Set interval with automatic cleanup
 * @protected
 * @param {Function} callback - Callback function
 * @param {number} interval - Interval in milliseconds
 * @returns {number} Interval ID
 */
_setInterval(callback, interval) {
  if (!this._pendingIntervals) {
    this._pendingIntervals = new Set();
  }

  const intervalId = setInterval(callback, interval);
  this._pendingIntervals.add(intervalId);
  return intervalId;
}

/**
 * Clear interval
 * @protected
 * @param {number} intervalId - Interval ID to clear
 */
_clearInterval(intervalId) {
  clearInterval(intervalId);
  if (this._pendingIntervals) {
    this._pendingIntervals.delete(intervalId);
  }
}
```

### 5. Service Cleanup

```javascript
/**
 * Cleanup services
 * @private
 * @returns {Promise<void>}
 */
async _cleanupServices() {
  this._logger.debug(
    `${this.constructor.name}: Cleaning up services`
  );

  // Cleanup additional services first
  await this._cleanupAdditionalServices();

  // Core services typically don't need explicit cleanup
  // but we can offer hooks for special cases
  if (typeof this._cleanupCoreServices === 'function') {
    await this._cleanupCoreServices();
  }
}

/**
 * Cleanup additional page-specific services
 * @protected
 * @returns {Promise<void>}
 * @example
 * async _cleanupAdditionalServices() {
 *   if (this._hasService('websocketService')) {
 *     await this._getService('websocketService').disconnect();
 *   }
 * }
 */
async _cleanupAdditionalServices() {
  // Default implementation - no-op
  // Subclasses can override to cleanup page-specific services
}
```

### 6. Reference Clearing

```javascript
/**
 * Clear all references to prevent memory leaks
 * @private
 */
_clearReferences() {
  this._logger.debug(
    `${this.constructor.name}: Clearing references`
  );

  // Clear service references
  this._characterBuilderService = null;
  this._eventBus = null;
  this._schemaValidator = null;
  this._additionalServices = {};

  // Clear state
  this._currentState = null;
  this._lastError = null;

  // Clear any cached data
  if (typeof this._clearCachedData === 'function') {
    this._clearCachedData();
  }

  // Don't clear logger - might need it for final messages
}
```

### 7. Cleanup Task Registration

```javascript
/**
 * Register a cleanup task to be executed during destruction
 * @protected
 * @param {Function} task - Cleanup task (can be async)
 * @param {string} [description] - Task description for debugging
 * @example
 * // In subclass initialization
 * this._registerCleanupTask(
 *   () => this._closeWebSocket(),
 *   'Close WebSocket connection'
 * );
 */
_registerCleanupTask(task, description) {
  if (typeof task !== 'function') {
    throw new Error('Cleanup task must be a function');
  }

  this._cleanupTasks.push({
    task,
    description: description || 'Unnamed cleanup task',
  });

  this._logger.debug(
    `${this.constructor.name}: Registered cleanup task: ${description || 'unnamed'}`
  );
}

/**
 * Execute all registered cleanup tasks
 * @private
 * @returns {Promise<void>}
 */
async _executeCleanupTasks() {
  if (this._cleanupTasks.length === 0) {
    return;
  }

  this._logger.debug(
    `${this.constructor.name}: Executing ${this._cleanupTasks.length} cleanup tasks`
  );

  // Execute in reverse order of registration (LIFO)
  const tasks = [...this._cleanupTasks].reverse();

  for (const { task, description } of tasks) {
    try {
      this._logger.debug(
        `${this.constructor.name}: Executing cleanup task: ${description}`
      );
      await task();
    } catch (error) {
      this._logger.error(
        `${this.constructor.name}: Cleanup task failed: ${description}`,
        error
      );
      // Continue with other tasks
    }
  }

  // Clear the tasks array
  this._cleanupTasks = [];
}
```

### 8. Destruction Guards

```javascript
/**
 * Check if controller is destroyed
 * @protected
 * @param {string} [operation] - Operation being attempted
 * @returns {boolean} True if destroyed
 * @throws {Error} If operation provided and controller is destroyed
 */
_checkDestroyed(operation) {
  if (this._isDestroyed) {
    if (operation) {
      const error = new Error(
        `Cannot perform '${operation}' on destroyed controller`
      );
      this._logger.error(
        `${this.constructor.name}: Operation attempted on destroyed controller`,
        error
      );
      throw error;
    }
    return true;
  }
  return false;
}

/**
 * Get destruction status
 * @public
 * @returns {boolean}
 */
get isDestroyed() {
  return this._isDestroyed;
}

/**
 * Get destroying status
 * @public
 * @returns {boolean}
 */
get isDestroying() {
  return this._isDestroying;
}
```

### 9. Safe Method Wrapper

Add a utility for making methods destruction-safe:

```javascript
/**
 * Wrap a method to make it destruction-safe
 * @protected
 * @param {Function} method - Method to wrap
 * @param {string} methodName - Method name for error messages
 * @returns {Function} Wrapped method
 * @example
 * // In subclass
 * this._handleClick = this._makeDestructionSafe(
 *   this._handleClick.bind(this),
 *   'handleClick'
 * );
 */
_makeDestructionSafe(method, methodName) {
  return (...args) => {
    if (this._checkDestroyed(methodName)) {
      return;
    }
    return method(...args);
  };
}
```

### 10. Memory Leak Prevention Helpers

```javascript
/**
 * Create a WeakMap for storing element-specific data
 * @protected
 * @returns {WeakMap}
 */
_createElementDataMap() {
  return new WeakMap();
}

/**
 * Safely store data associated with an element
 * @protected
 * @param {HTMLElement} element - Element to associate data with
 * @param {string} key - Data key
 * @param {any} value - Data value
 * @param {WeakMap} [dataMap] - Optional specific map to use
 */
_setElementData(element, key, value, dataMap) {
  if (!this._elementDataMaps) {
    this._elementDataMaps = new Map();
  }

  if (!dataMap) {
    if (!this._elementDataMaps.has(key)) {
      this._elementDataMaps.set(key, new WeakMap());
    }
    dataMap = this._elementDataMaps.get(key);
  }

  dataMap.set(element, value);
}

/**
 * Get data associated with an element
 * @protected
 * @param {HTMLElement} element - Element to get data for
 * @param {string} key - Data key
 * @param {WeakMap} [dataMap] - Optional specific map to use
 * @returns {any} Associated data
 */
_getElementData(element, key, dataMap) {
  if (!dataMap && this._elementDataMaps) {
    dataMap = this._elementDataMaps.get(key);
  }

  return dataMap ? dataMap.get(element) : undefined;
}
```

## Technical Considerations

### Cleanup Order

1. Cancel pending operations (timers, requests)
2. Remove event listeners (prevents new events)
3. Cleanup services (might trigger events)
4. Clear DOM references
5. Execute custom cleanup tasks
6. Clear remaining references

### Memory Leak Prevention

- Use WeakMap for element-associated data
- Clear all object references
- Remove all event listeners
- Cancel all timers and animations
- Avoid circular references

### Error Resilience

- Continue cleanup even if steps fail
- Log all errors for debugging
- Still mark as destroyed on error
- Provide destruction state checks

### Performance

- Track cleanup time for monitoring
- Execute cleanup tasks efficiently
- Avoid unnecessary operations
- Clear references in batches

## Testing Requirements

### Test Cases

1. **Basic Destruction**
   - Destroy uninitalized controller
   - Destroy initialized controller
   - Multiple destroy calls handled
   - Destruction state tracked correctly

2. **Event Cleanup**
   - All DOM listeners removed
   - All eventBus subscriptions removed
   - Debounced/throttled handlers cleared
   - No events fire after destruction

3. **Timer Cleanup**
   - Timeouts cancelled
   - Intervals cleared
   - Animation frames cancelled
   - No callbacks execute after destruction

4. **Service Cleanup**
   - Additional services cleaned up
   - Cleanup hooks called
   - Errors in cleanup handled

5. **Memory Leaks**
   - No references retained
   - WeakMaps used correctly
   - Circular references broken

### Destruction Flow Test

```javascript
it('should follow correct destruction sequence', async () => {
  const controller = new TestController(mockDependencies);
  await controller.initialize();

  // Add listeners and timers
  controller._addEventListener('testBtn', 'click', jest.fn());
  controller._setTimeout(jest.fn(), 1000);

  // Spy on cleanup methods
  const preDestroySpy = jest.spyOn(controller, '_preDestroy');
  const cleanupSpy = jest.spyOn(controller, '_removeAllEventListeners');

  // Destroy
  await controller.destroy();

  // Verify sequence
  expect(preDestroySpy).toHaveBeenCalled();
  expect(cleanupSpy).toHaveBeenCalled();
  expect(controller.isDestroyed).toBe(true);
  expect(controller._eventListeners.length).toBe(0);
});

// Test destruction guards
it('should prevent operations on destroyed controller', async () => {
  const controller = new TestController(mockDependencies);
  await controller.destroy();

  expect(() => controller._checkDestroyed('testOperation')).toThrow(
    "Cannot perform 'testOperation' on destroyed controller"
  );
});
```

## Definition of Done

- [ ] Complete destroy method implemented
- [ ] All resources cleaned up properly
- [ ] Memory leaks prevented
- [ ] Destruction hooks available
- [ ] Timer management implemented
- [ ] Destruction guards in place
- [ ] Unit tests cover all cleanup scenarios
- [ ] JSDoc documentation complete

## Notes for Implementer

- Test cleanup thoroughly with memory profiler
- Ensure cleanup works even if initialization failed
- Make destruction idempotent (safe to call multiple times)
- Consider cleanup order carefully
- Log enough information for debugging
- Test with real browser environments
