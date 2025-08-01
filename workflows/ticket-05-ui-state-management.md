# Ticket #5: Implement UI State Management Integration

## Overview

Build standardized UI state management into the BaseCharacterBuilderController. This provides consistent state transitions (empty, loading, results, error) and integrates with the existing UIStateManager patterns used in the project.

## Priority

**Medium** - While important for consistency, this builds on top of core functionality.

## Dependencies

- Ticket #1: Base Controller Class Structure (completed)
- Ticket #4: DOM Element Management (completed - for element operations)

## Estimated Effort

**1-2 hours**

## Acceptance Criteria

1. ✅ `_showState()` method for state transitions
2. ✅ Support for standard states: empty, loading, results, error
3. ✅ State change hooks for custom behavior
4. ✅ Error state handling with message display
5. ✅ Loading indicator management
6. ✅ State transition logging
7. ✅ Integration with existing UI patterns
8. ✅ Extensible for custom states

## Implementation Details

### 1. State Constants

Add to `BaseCharacterBuilderController.js`:

```javascript
/**
 * Standard UI states for character builder pages
 * @readonly
 * @enum {string}
 */
export const UI_STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
};

// Add to class definition
class BaseCharacterBuilderController {
  // ... existing code ...

  /**
   * Get UI states enum
   * @protected
   * @returns {object} UI states enum
   */
  get UI_STATES() {
    return UI_STATES;
  }
}
```

### 2. Main State Management Method

```javascript
/**
 * Show UI state - standardized state management
 * @protected
 * @param {string} state - State to show (empty, loading, results, error)
 * @param {object} [options={}] - State options
 * @param {string} [options.message] - Message for error state
 * @param {any} [options.data] - Additional data for state
 * @param {boolean} [options.animate=true] - Whether to animate transition
 * @example
 * // Show loading state
 * this._showState('loading');
 *
 * // Show error with message
 * this._showState('error', { message: 'Failed to load data' });
 *
 * // Show results with data
 * this._showState('results', { data: resultData });
 */
_showState(state, options = {}) {
  const { message, data, animate = true } = options;

  // Validate state
  const validStates = Object.values(UI_STATES);
  if (!validStates.includes(state)) {
    this._logger.warn(
      `${this.constructor.name}: Invalid state '${state}', using 'empty' instead`
    );
    state = UI_STATES.EMPTY;
  }

  const previousState = this._currentState;

  this._logger.debug(
    `${this.constructor.name}: State transition: ${previousState || 'none'} → ${state}`
  );

  try {
    // Call pre-transition hook
    this._beforeStateChange(previousState, state, options);

    // Hide all state containers
    this._hideAllStates(animate);

    // Show the requested state
    this._showSpecificState(state, options);

    // Update current state
    this._currentState = state;

    // Handle state-specific logic
    this._handleStateChange(state, { message, data, previousState });

    // Call post-transition hook
    this._afterStateChange(previousState, state, options);

    // Dispatch state change event
    if (this._eventBus) {
      this._eventBus.dispatch('UI_STATE_CHANGED', {
        controller: this.constructor.name,
        previousState,
        currentState: state,
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    this._logger.error(
      `${this.constructor.name}: State transition failed`,
      error
    );
    // Try to show error state as fallback
    if (state !== UI_STATES.ERROR) {
      this._showState(UI_STATES.ERROR, {
        message: 'An error occurred while updating the display',
      });
    }
  }
}
```

### 3. State Container Management

```javascript
/**
 * Hide all state containers
 * @private
 * @param {boolean} [animate=true] - Whether to animate
 */
_hideAllStates(animate = true) {
  const states = Object.values(UI_STATES);

  states.forEach(stateName => {
    const elementKey = `${stateName}State`;
    const element = this._getElement(elementKey);

    if (element) {
      if (animate && this._supportsAnimation()) {
        element.classList.add('state-hiding');
        setTimeout(() => {
          element.style.display = 'none';
          element.classList.remove('state-hiding');
        }, 200);
      } else {
        element.style.display = 'none';
      }
    }
  });
}

/**
 * Show specific state container
 * @private
 * @param {string} state - State to show
 * @param {object} options - State options
 */
_showSpecificState(state, options = {}) {
  const elementKey = `${state}State`;
  const element = this._getElement(elementKey);

  if (element) {
    // Handle state-specific setup
    switch (state) {
      case UI_STATES.ERROR:
        this._setupErrorState(element, options.message);
        break;
      case UI_STATES.LOADING:
        this._setupLoadingState(element);
        break;
      case UI_STATES.RESULTS:
        this._setupResultsState(element, options.data);
        break;
      case UI_STATES.EMPTY:
        this._setupEmptyState(element);
        break;
    }

    // Show the element
    if (options.animate && this._supportsAnimation()) {
      element.style.display = 'block';
      element.classList.add('state-showing');
      setTimeout(() => {
        element.classList.remove('state-showing');
      }, 200);
    } else {
      element.style.display = 'block';
    }

    this._logger.debug(
      `${this.constructor.name}: Showing ${state} state container`
    );
  } else {
    this._logger.warn(
      `${this.constructor.name}: State container not found: ${elementKey}`
    );
  }
}

/**
 * Check if animations are supported/enabled
 * @private
 * @returns {boolean}
 */
_supportsAnimation() {
  // Check for reduced motion preference
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }

  // Could add additional checks here
  return true;
}
```

### 4. State-Specific Setup Methods

```javascript
/**
 * Setup error state display
 * @private
 * @param {HTMLElement} container - Error state container
 * @param {string} [message] - Error message to display
 */
_setupErrorState(container, message) {
  if (message) {
    // Try multiple common selectors for error message
    const messageElement =
      container.querySelector('.error-message-text') ||
      container.querySelector('.error-message') ||
      container.querySelector('[data-error-message]') ||
      this._getElement('errorMessageText');

    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  // Add error-specific classes
  container.classList.add('is-error');

  // Focus management for accessibility
  const focusTarget = container.querySelector('[data-focus-target]') || container;
  if (focusTarget.tabIndex === -1) {
    focusTarget.tabIndex = 0;
  }
  focusTarget.focus();
}

/**
 * Setup loading state display
 * @private
 * @param {HTMLElement} container - Loading state container
 */
_setupLoadingState(container) {
  // Add loading-specific classes
  container.classList.add('is-loading');

  // Start any loading animations
  const spinner = container.querySelector('.spinner, .loading-spinner, [data-spinner]');
  if (spinner) {
    spinner.classList.add('active');
  }

  // Disable interactive elements
  this._setFormControlsEnabled(false);
}

/**
 * Setup results state display
 * @private
 * @param {HTMLElement} container - Results state container
 * @param {any} [data] - Results data
 */
_setupResultsState(container, data) {
  // Remove loading classes
  container.classList.remove('is-loading');
  container.classList.add('has-results');

  // Re-enable interactive elements
  this._setFormControlsEnabled(true);

  // Let subclasses handle data display
  if (data && typeof this._displayResults === 'function') {
    this._displayResults(data);
  }
}

/**
 * Setup empty state display
 * @private
 * @param {HTMLElement} container - Empty state container
 */
_setupEmptyState(container) {
  // Add empty-specific classes
  container.classList.add('is-empty');

  // Re-enable interactive elements
  this._setFormControlsEnabled(true);
}
```

### 5. State Change Hooks

```javascript
/**
 * Hook called before state change
 * @protected
 * @param {string} fromState - Previous state
 * @param {string} toState - New state
 * @param {object} options - Transition options
 */
_beforeStateChange(fromState, toState, options) {
  // Default implementation - no-op
  // Subclasses can override for custom behavior
}

/**
 * Handle state change - override in subclasses for custom behavior
 * @protected
 * @param {string} state - The new state
 * @param {object} data - State data including message, data, previousState
 * @example
 * // In subclass:
 * _handleStateChange(state, data) {
 *   switch (state) {
 *     case this.UI_STATES.LOADING:
 *       this._disableFormControls();
 *       break;
 *     case this.UI_STATES.RESULTS:
 *       this._updateResultsCount(data.data);
 *       break;
 *   }
 * }
 */
_handleStateChange(state, data) {
  // Default implementation - no-op
  // Subclasses can override for state-specific behavior
}

/**
 * Hook called after state change
 * @protected
 * @param {string} fromState - Previous state
 * @param {string} toState - New state
 * @param {object} options - Transition options
 */
_afterStateChange(fromState, toState, options) {
  // Default implementation - no-op
  // Subclasses can override for custom behavior
}
```

### 6. Convenience Methods

```javascript
/**
 * Show error state with message
 * @protected
 * @param {string|Error} error - Error message or Error object
 * @param {object} [options={}] - Additional options
 */
_showError(error, options = {}) {
  const message = typeof error === 'string' ? error : error.message;

  this._showState(UI_STATES.ERROR, {
    ...options,
    message,
  });

  this._logger.error(
    `${this.constructor.name}: Showing error state`,
    { message, error }
  );
}

/**
 * Show loading state with optional message
 * @protected
 * @param {string} [message] - Loading message
 */
_showLoading(message) {
  this._showState(UI_STATES.LOADING, { message });
}

/**
 * Show results state with data
 * @protected
 * @param {any} data - Results data
 */
_showResults(data) {
  this._showState(UI_STATES.RESULTS, { data });
}

/**
 * Show empty state
 * @protected
 */
_showEmpty() {
  this._showState(UI_STATES.EMPTY);
}

/**
 * Get current UI state
 * @protected
 * @returns {string} Current state
 */
get currentState() {
  return this._currentState || UI_STATES.EMPTY;
}

/**
 * Check if in specific state
 * @protected
 * @param {string} state - State to check
 * @returns {boolean}
 */
_isInState(state) {
  return this._currentState === state;
}
```

### 7. Form Control Management

```javascript
/**
 * Enable/disable form controls based on state
 * @private
 * @param {boolean} enabled - Whether to enable controls
 */
_setFormControlsEnabled(enabled) {
  // Common form control selectors
  const controlKeys = [
    'submitBtn',
    'submitButton',
    'saveBtn',
    'cancelBtn',
    'form',
  ];

  controlKeys.forEach(key => {
    this._setElementEnabled(key, enabled);
  });

  // Also handle any buttons in the form
  const form = this._getElement('form');
  if (form) {
    const buttons = form.querySelectorAll('button, input[type="submit"]');
    buttons.forEach(button => {
      button.disabled = !enabled;
    });
  }
}
```

### 8. Add Current State Tracking

Update the constructor to include state tracking:

```javascript
// In the field declarations
/** @protected @type {string} */
_currentState = UI_STATES.EMPTY;

// Update _initializeUIState in ticket #3 to use this
_initializeUIState() {
  // Default implementation - show empty state
  this._showState(UI_STATES.EMPTY);
}
```

## Technical Considerations

### State Container Naming Convention

- State containers should follow pattern: `{state}State`
- Examples: `emptyState`, `loadingState`, `resultsState`, `errorState`
- This matches existing patterns in the codebase

### Animation Support

- Check for reduced motion preference
- Provide non-animated fallbacks
- Keep animations subtle and fast (200ms)

### Accessibility

- Focus management on state changes
- Announce state changes to screen readers
- Ensure error messages are accessible

### Error Resilience

- State transitions should not throw
- Fallback to error state if problems occur
- Log all state transitions for debugging

## Testing Requirements

### Test Cases

1. **State Transitions**
   - All valid states display correctly
   - Invalid states default to empty
   - Previous state tracked correctly
   - State change events dispatched

2. **Error State**
   - Error messages display correctly
   - Error from string or Error object
   - Focus management works

3. **Loading State**
   - Form controls disabled
   - Loading indicators activated
   - Previous state restored on completion

4. **State Hooks**
   - beforeStateChange called
   - handleStateChange called
   - afterStateChange called
   - Custom implementations work

5. **Edge Cases**
   - Missing state containers handled
   - Rapid state changes handled
   - Animation preferences respected

### Test Setup

```javascript
// Mock DOM structure
beforeEach(() => {
  document.body.innerHTML = `
    <div id="empty-state" style="display: block;">Empty</div>
    <div id="loading-state" style="display: none;">
      <div class="spinner"></div>
    </div>
    <div id="results-state" style="display: none;">Results</div>
    <div id="error-state" style="display: none;">
      <div class="error-message-text"></div>
    </div>
    <form id="test-form">
      <button id="submit-btn">Submit</button>
    </form>
  `;

  controller._cacheElementsFromMap({
    emptyState: '#empty-state',
    loadingState: '#loading-state',
    resultsState: '#results-state',
    errorState: '#error-state',
    errorMessageText: '.error-message-text',
    form: '#test-form',
    submitBtn: '#submit-btn',
  });
});
```

## Definition of Done

- [ ] All state management methods implemented
- [ ] State transitions work smoothly
- [ ] Error handling is robust
- [ ] Accessibility requirements met
- [ ] Unit tests cover all scenarios
- [ ] JSDoc documentation complete
- [ ] Integration with DOM management verified
- [ ] Compatible with existing UI patterns

## Notes for Implementer

- Study existing UIStateManager usage in the codebase
- Ensure compatibility with current CSS classes
- Make state transitions smooth and predictable
- Consider future custom states
- Test with actual page layouts
- Keep accessibility in mind throughout
