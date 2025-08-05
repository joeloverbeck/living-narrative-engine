# THEDIRMIG-011: Implement Resource Cleanup in Destroy Hooks

## Overview

Implement comprehensive resource cleanup in the `_preDestroy()` and `_postDestroy()` lifecycle hooks. This addresses the critical issue of the current controller lacking a destroy() method, which risks memory leaks. The base controller provides automatic cleanup of timers, intervals, and event listeners, but we need to clean up page-specific resources.

## Priority

**CRITICAL** - Prevents memory leaks

## Dependencies

- **Blocked by**: THEDIRMIG-007 (InPlaceEditor cleanup)
- **Blocked by**: THEDIRMIG-008 (PreviousItemsDropdown cleanup)
- **Blocked by**: THEDIRMIG-009 (Modal cleanup)
- **Enables**: Proper resource management

## Acceptance Criteria

- [ ] All InPlaceEditor instances destroyed
- [ ] PreviousItemsDropdown cleaned up properly
- [ ] Modal state and callbacks cleared
- [ ] Pending operations cancelled
- [ ] Custom event handlers removed
- [ ] Memory profiling shows no leaks
- [ ] Destroy can be called multiple times safely
- [ ] No errors during cleanup

## Implementation Steps

### Step 1: Implement _preDestroy() Hook

The `_preDestroy()` hook is called BEFORE the base class cleanup and must be SYNCHRONOUS:

```javascript
/**
 * Pre-destroy cleanup hook
 * Called before base class cleanup
 * MUST BE SYNCHRONOUS - no async/await
 * @protected
 * @override
 */
_preDestroy() {
  this.logger.info('ThematicDirectionsManagerController: Starting cleanup');
  
  try {
    // 1. Cancel any pending operations
    this._cancelPendingOperations();
    
    // 2. Clean up InPlaceEditor instances
    this._cleanupInPlaceEditors();
    
    // 3. Close any open modals
    this._cleanupModals();
    
    // 4. Clear any running timers/intervals specific to this controller
    this._clearTimers();
    
    // 5. Remove any manual event listeners
    this._removeManualEventListeners();
    
    // 6. Clear data references
    this._clearDataReferences();
    
  } catch (error) {
    // Log but don't throw - cleanup must complete
    this.logger.error('Error during pre-destroy cleanup:', error);
  }
  
  // Call parent implementation last
  super._preDestroy();
}
```

### Step 2: Implement _postDestroy() Hook

The `_postDestroy()` hook is called AFTER base class cleanup:

```javascript
/**
 * Post-destroy cleanup hook
 * Called after base class cleanup
 * MUST BE SYNCHRONOUS - no async/await
 * @protected
 * @override
 */
_postDestroy() {
  try {
    // 1. Clean up PreviousItemsDropdown (no destroy method)
    this._cleanupPreviousItemsDropdown();
    
    // 2. Null out remaining references
    this._nullifyReferences();
    
    // 3. Clear any module-level state
    this._clearModuleState();
    
  } catch (error) {
    this.logger.error('Error during post-destroy cleanup:', error);
  }
  
  // Call parent implementation last
  super._postDestroy();
  
  this.logger.info('ThematicDirectionsManagerController: Cleanup complete');
}
```

### Step 3: Implement Cleanup Methods

#### Cancel Pending Operations

```javascript
/**
 * Cancel any pending operations
 * @private
 */
_cancelPendingOperations() {
  // Cancel pending modal actions
  if (this.#pendingModalAction) {
    this.logger.debug('Cancelling pending modal action');
    this.#pendingModalAction = null;
  }
  
  // Cancel pending retry actions
  if (this.#pendingRetryAction) {
    this.logger.debug('Cancelling pending retry action');
    this.#pendingRetryAction = null;
  }
  
  // Cancel any pending saves
  if (this.#pendingSaveOperations) {
    this.logger.debug(`Cancelling ${this.#pendingSaveOperations.size} pending saves`);
    this.#pendingSaveOperations.clear();
  }
  
  // Abort any active fetch requests
  if (this.#abortController) {
    this.logger.debug('Aborting active requests');
    this.#abortController.abort();
    this.#abortController = null;
  }
}
```

#### Clean Up InPlaceEditors

```javascript
/**
 * Clean up all InPlaceEditor instances
 * @private
 */
_cleanupInPlaceEditors() {
  if (!this.#inPlaceEditors || this.#inPlaceEditors.size === 0) {
    return;
  }
  
  this.logger.debug(`Cleaning up ${this.#inPlaceEditors.size} InPlaceEditor instances`);
  
  let cleanedCount = 0;
  let errorCount = 0;
  
  this.#inPlaceEditors.forEach((editor, elementId) => {
    try {
      if (editor && typeof editor.destroy === 'function') {
        editor.destroy();
        cleanedCount++;
      }
    } catch (error) {
      errorCount++;
      this.logger.error(`Failed to destroy InPlaceEditor for ${elementId}:`, error);
    }
  });
  
  this.#inPlaceEditors.clear();
  
  this.logger.debug(`InPlaceEditors cleaned: ${cleanedCount}, errors: ${errorCount}`);
}
```

#### Clean Up Modals

```javascript
/**
 * Clean up modal state
 * @private
 */
_cleanupModals() {
  // Close any open modal without animations
  if (this.#activeModal) {
    this.logger.debug('Closing active modal');
    
    // Hide immediately without animation
    this._hideElement('confirmationModal');
    this._hideElement('modalOverlay');
    
    // Remove body class
    document.body.classList.remove('modal-open');
    
    // Clear state
    this.#activeModal = null;
    this.#pendingModalAction = null;
  }
  
  // Clear modal stack
  if (this.#modalStack && this.#modalStack.length > 0) {
    this.logger.debug(`Clearing modal stack (${this.#modalStack.length} modals)`);
    this.#modalStack = [];
  }
  
  // Remove modal keyboard handler
  if (this.#modalKeyHandler) {
    document.removeEventListener('keydown', this.#modalKeyHandler, true);
    this.#modalKeyHandler = null;
  }
}
```

#### Clean Up PreviousItemsDropdown

```javascript
/**
 * Clean up PreviousItemsDropdown component
 * Component doesn't have destroy() so we do manual cleanup
 * @private
 */
_cleanupPreviousItemsDropdown() {
  if (!this.#conceptDropdown) {
    return;
  }
  
  this.logger.debug('Cleaning up PreviousItemsDropdown');
  
  try {
    // Get the element before cleanup
    const element = this.#conceptDropdown._element || 
                   this._getElement('conceptFilter');
    
    if (element) {
      // Clone and replace to remove all event listeners
      const newElement = element.cloneNode(true);
      if (element.parentNode) {
        element.parentNode.replaceChild(newElement, element);
      }
    }
    
    // Clear internal state
    const propsToClean = [
      '_element', '_items', '_selectedItems', '_previousItems',
      '_onSelectionChange', '_options', '_storageKey'
    ];
    
    propsToClean.forEach(prop => {
      if (this.#conceptDropdown[prop] !== undefined) {
        this.#conceptDropdown[prop] = null;
      }
    });
    
    // Clear the reference
    this.#conceptDropdown = null;
    
  } catch (error) {
    this.logger.error('Error cleaning up PreviousItemsDropdown:', error);
  }
}
```

#### Clear Timers

```javascript
/**
 * Clear any custom timers
 * @private
 */
_clearTimers() {
  // Clear notification timeout
  if (this.#notificationTimeout) {
    clearTimeout(this.#notificationTimeout);
    this.#notificationTimeout = null;
  }
  
  // Clear auto-save interval
  if (this.#autoSaveInterval) {
    clearInterval(this.#autoSaveInterval);
    this.#autoSaveInterval = null;
  }
  
  // Clear debounce timers
  if (this.#filterDebounceTimer) {
    clearTimeout(this.#filterDebounceTimer);
    this.#filterDebounceTimer = null;
  }
}
```

#### Remove Manual Event Listeners

```javascript
/**
 * Remove any manually added event listeners
 * @private
 */
_removeManualEventListeners() {
  // Remove window resize listener if added
  if (this.#resizeHandler) {
    window.removeEventListener('resize', this.#resizeHandler);
    this.#resizeHandler = null;
  }
  
  // Remove beforeunload listener if added
  if (this.#beforeUnloadHandler) {
    window.removeEventListener('beforeunload', this.#beforeUnloadHandler);
    this.#beforeUnloadHandler = null;
  }
  
  // Remove any document-level listeners
  if (this.#documentClickHandler) {
    document.removeEventListener('click', this.#documentClickHandler);
    this.#documentClickHandler = null;
  }
}
```

#### Clear Data References

```javascript
/**
 * Clear data references to help garbage collection
 * @private
 */
_clearDataReferences() {
  // Clear large data arrays
  this.#directionsData = [];
  this.#conceptsData = [];
  
  // Clear filter state
  this.#currentFilter = '';
  this.#currentConcept = null;
  
  // Clear cached functions
  this.#getFilteredData = null;
  
  // Clear any cached DOM references
  this.#cachedElements = null;
}
```

#### Nullify References

```javascript
/**
 * Null out remaining references
 * @private
 */
_nullifyReferences() {
  // Null out all private fields
  const privateFields = [
    '#modalManager',
    '#filterManager',
    '#editorConfigs',
    '#previousFocus',
    '#abortController'
  ];
  
  privateFields.forEach(field => {
    try {
      if (this[field] !== undefined) {
        this[field] = null;
      }
    } catch (error) {
      // Field might not exist
    }
  });
}
```

### Step 4: Make Destroy Idempotent

Ensure destroy can be called multiple times safely:

```javascript
/**
 * Track if destroy has been called
 * @private
 * @type {boolean}
 */
#isDestroyed = false;

/**
 * Pre-destroy cleanup
 * @protected
 * @override
 */
_preDestroy() {
  if (this.#isDestroyed) {
    this.logger.warn('Destroy already called, skipping cleanup');
    return;
  }
  
  this.#isDestroyed = true;
  
  // ... rest of cleanup
  
  super._preDestroy();
}
```

### Step 5: Add Memory Leak Detection

Add debugging helpers for development:

```javascript
/**
 * Debug method to check for potential leaks
 * @private
 */
_checkForLeaks() {
  if (process.env.NODE_ENV !== 'development') return;
  
  const leaks = [];
  
  // Check InPlaceEditors
  if (this.#inPlaceEditors && this.#inPlaceEditors.size > 0) {
    leaks.push(`${this.#inPlaceEditors.size} InPlaceEditor instances`);
  }
  
  // Check event listeners
  const listeners = this._getEventListenerCount();
  if (listeners > 0) {
    leaks.push(`${listeners} event listeners`);
  }
  
  // Check timers
  if (this.#notificationTimeout || this.#autoSaveInterval) {
    leaks.push('Active timers');
  }
  
  if (leaks.length > 0) {
    console.warn('Potential memory leaks detected:', leaks);
  }
}

// Call in _postDestroy during development
_postDestroy() {
  // ... cleanup
  
  if (process.env.NODE_ENV === 'development') {
    this._checkForLeaks();
  }
  
  super._postDestroy();
}
```

## Testing Cleanup

### Manual Testing Checklist

1. **Basic Cleanup**:
   - [ ] Call destroy() on controller
   - [ ] No console errors
   - [ ] All UI elements cleaned up

2. **InPlaceEditor Cleanup**:
   - [ ] Create multiple editors
   - [ ] Call destroy()
   - [ ] Verify all editors destroyed

3. **Modal Cleanup**:
   - [ ] Open a modal
   - [ ] Call destroy() while open
   - [ ] Modal closes, no errors

4. **Repeated Destroy**:
   - [ ] Call destroy() twice
   - [ ] No errors on second call

### Unit Test Examples

```javascript
describe('Resource Cleanup', () => {
  it('should clean up all InPlaceEditors on destroy', () => {
    // Create some editors
    controller._createInPlaceEditor('test-1', 'dir1', 'name', {});
    controller._createInPlaceEditor('test-2', 'dir1', 'desc', {});
    
    expect(controller.#inPlaceEditors.size).toBe(2);
    
    // Destroy controller
    controller.destroy();
    
    expect(controller.#inPlaceEditors.size).toBe(0);
  });
  
  it('should handle destroy being called multiple times', () => {
    expect(() => {
      controller.destroy();
      controller.destroy();
    }).not.toThrow();
  });
  
  it('should cancel pending operations', () => {
    controller.#pendingModalAction = jest.fn();
    controller.#pendingRetryAction = jest.fn();
    
    controller.destroy();
    
    expect(controller.#pendingModalAction).toBe(null);
    expect(controller.#pendingRetryAction).toBe(null);
  });
  
  it('should close open modals', () => {
    controller._showConfirmationModal({
      title: 'Test',
      message: 'Test',
      onConfirm: jest.fn()
    });
    
    expect(controller.#activeModal).toBeTruthy();
    
    controller.destroy();
    
    expect(controller.#activeModal).toBe(null);
  });
});
```

### Memory Profiling

Use Chrome DevTools to verify no leaks:

1. Take heap snapshot
2. Create controller and interact with it
3. Destroy controller
4. Force garbage collection
5. Take another heap snapshot
6. Compare snapshots - controller should be gone

```javascript
// Temporary debug helper
window.__DEBUG_CONTROLLER__ = controller;

// After destroy
controller.destroy();
window.__DEBUG_CONTROLLER__ = null;

// Check in console
console.log(window.__DEBUG_CONTROLLER__); // Should be null
```

## Common Pitfalls to Avoid

1. **Don't use async/await in destroy hooks** - They must be synchronous
2. **Don't throw errors** - Log and continue cleanup
3. **Don't assume elements exist** - They might already be removed
4. **Clear all references** - Help garbage collection
5. **Make idempotent** - Destroy might be called multiple times

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] _preDestroy() implemented with all cleanup
- [ ] _postDestroy() implemented for remaining cleanup
- [ ] All InPlaceEditors destroyed
- [ ] PreviousItemsDropdown cleaned up
- [ ] Modal state cleared
- [ ] Pending operations cancelled
- [ ] Timers/intervals cleared
- [ ] Event listeners removed
- [ ] Data references cleared
- [ ] Destroy is idempotent
- [ ] No errors during cleanup
- [ ] Memory profiling shows no leaks
- [ ] All tests pass
- [ ] Manual testing confirms cleanup works
- [ ] Code committed with descriptive message