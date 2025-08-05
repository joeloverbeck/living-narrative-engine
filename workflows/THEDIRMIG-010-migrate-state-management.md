# THEDIRMIG-010: Migrate State Management to UIStateManager

## Overview

Migrate all state management to use the base controller's UIStateManager integration. This includes using `_showState()`, `_showLoading()`, `_showError()`, and other state management helpers instead of direct UIStateManager calls, ensuring consistent state handling across the application.

## Priority

**HIGH** - Core functionality standardization

## Dependencies

- **Blocked by**: THEDIRMIG-006 (lifecycle methods that set initial state)
- **Related**: THEDIRMIG-001 (UI_STATES import)
- **Enables**: Consistent state management patterns

## Acceptance Criteria

- [ ] All direct UIStateManager calls replaced with base controller methods
- [ ] Loading states shown during async operations
- [ ] Error states shown with user-friendly messages
- [ ] Empty state shown when no data
- [ ] Results state shown when data available
- [ ] State transitions are smooth
- [ ] Error recovery works properly
- [ ] Loading messages are contextual

## Implementation Steps

### Step 1: Identify Current State Management

Search for current UIStateManager usage:

```bash
# Find direct UIStateManager calls
grep -n "uiStateManager\." src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
grep -n "setState" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
grep -n "showElement\|hideElement" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
```

Common patterns to replace:
- `this.#uiStateManager.setState(UI_STATES.LOADING)`
- `this.#uiStateManager.setState(UI_STATES.ERROR, errorMessage)`
- `this.#uiStateManager.showElement('elementId')`
- `this.#uiStateManager.hideElement('elementId')`

### Step 2: Replace with Base Controller Methods

Map old patterns to new:

```javascript
// BEFORE:
this.#uiStateManager.setState(UI_STATES.LOADING);

// AFTER:
this._showLoading('Loading thematic directions...');

// BEFORE:
this.#uiStateManager.setState(UI_STATES.ERROR, 'Failed to load');

// AFTER:
this._showError('Failed to load thematic directions. Please try again.');

// BEFORE:
this.#uiStateManager.setState(UI_STATES.EMPTY);

// AFTER:
this._showState(UI_STATES.EMPTY);

// BEFORE:
this.#uiStateManager.setState(UI_STATES.RESULTS);

// AFTER:
this._showState(UI_STATES.RESULTS);
```

### Step 3: Implement Contextual Loading States

Update async operations to show appropriate loading messages:

```javascript
/**
 * Load directions data with loading state
 * @private
 */
async _loadDirectionsData() {
  try {
    // Show contextual loading message
    this._showLoading('Loading thematic directions...');
    
    const [directions, concepts, orphaned] = await this._executeWithErrorHandling(
      () => Promise.all([
        this.characterBuilderService.getAllThematicDirectionsWithConcepts(),
        this.characterBuilderService.getAllCharacterConcepts(),
        this.characterBuilderService.getOrphanedThematicDirections()
      ]),
      'load directions data',
      {
        retries: 2,
        userErrorMessage: 'Unable to load thematic directions. Please check your connection and try again.'
      }
    );
    
    // Update data
    this.#directionsData = directions || [];
    this.#conceptsData = concepts || [];
    this.#orphanedCount = orphaned?.length || 0;
    
    // Show appropriate state based on data
    this._updateUIStateBasedOnData();
    
  } catch (error) {
    // Error already shown by _executeWithErrorHandling
    this.logger.error('Failed to load directions:', error);
  }
}

/**
 * Update UI state based on current data
 * @private
 */
_updateUIStateBasedOnData() {
  const filteredDirections = this._getFilteredDirections();
  
  if (this.#directionsData.length === 0) {
    // No data at all
    this._showState(UI_STATES.EMPTY);
    this._updateEmptyStateMessage('No thematic directions found. Create your first direction to get started.');
  } else if (filteredDirections.length === 0) {
    // Have data but filters exclude everything
    this._showState(UI_STATES.EMPTY);
    this._updateEmptyStateMessage('No directions match your current filters. Try adjusting your search criteria.');
  } else {
    // Have displayable data
    this._displayDirections();
    this._showState(UI_STATES.RESULTS);
  }
  
  // Always update stats
  this._updateStats();
}
```

### Step 4: Implement Error Handling with Recovery

```javascript
/**
 * Delete a thematic direction
 * @private
 * @param {string} directionId - Direction to delete
 */
async _deleteDirection(directionId) {
  try {
    this._showLoading('Deleting thematic direction...');
    
    await this._executeWithErrorHandling(
      () => this.characterBuilderService.deleteThematicDirection(directionId),
      'delete direction',
      {
        retries: 1,
        userErrorMessage: 'Failed to delete the direction. Please try again.'
      }
    );
    
    // Remove from local data
    this.#directionsData = this.#directionsData.filter(d => d.id !== directionId);
    
    // Update UI
    this._updateUIStateBasedOnData();
    this._showSuccess('Thematic direction deleted successfully');
    
    // Dispatch event
    this.eventBus.dispatch({
      type: 'core:thematic_direction_deleted',
      payload: { directionId }
    });
    
  } catch (error) {
    // Show error with recovery option
    this._showErrorWithRetry(
      'Failed to delete the direction. Please check your connection and try again.',
      () => this._deleteDirection(directionId) // Retry callback
    );
  }
}

/**
 * Show error with retry option
 * @private
 * @param {string} message - Error message
 * @param {Function} retryCallback - Function to call on retry
 */
_showErrorWithRetry(message, retryCallback) {
  // Update error message
  this._showError(message);
  
  // Store retry callback
  this.#pendingRetryAction = retryCallback;
  
  // Make sure retry button is visible and wired up
  const retryBtn = this._getElement('retryBtn');
  if (retryBtn) {
    retryBtn.style.display = 'inline-block';
  }
}
```

### Step 5: Update Empty State Messaging

```javascript
/**
 * Update empty state with contextual message
 * @private
 * @param {string} [message] - Custom message
 */
_updateEmptyStateMessage(message) {
  const emptyStateElement = this._getElement('emptyState');
  if (!emptyStateElement) return;
  
  const messageElement = emptyStateElement.querySelector('.empty-message');
  if (messageElement) {
    messageElement.textContent = message || this._getDefaultEmptyMessage();
  }
  
  // Update action button visibility based on context
  this._updateEmptyStateActions();
}

/**
 * Get default empty message based on context
 * @private
 * @returns {string} Empty state message
 */
_getDefaultEmptyMessage() {
  if (this.#currentFilter || this.#currentConcept) {
    return 'No thematic directions match your filters. Try adjusting your search criteria.';
  }
  
  if (this.#directionsData.length === 0) {
    return 'No thematic directions found. Create your first direction to get started.';
  }
  
  return 'No directions to display.';
}

/**
 * Update empty state action buttons
 * @private
 */
_updateEmptyStateActions() {
  const hasFilters = this.#currentFilter || this.#currentConcept;
  
  // Show/hide appropriate actions
  if (hasFilters) {
    this._showElement('filterClear');
    this._hideElement('addDirectionBtn');
  } else {
    this._hideElement('filterClear');
    this._showElement('addDirectionBtn');
  }
}
```

### Step 6: Implement Loading State Variations

```javascript
/**
 * Show loading with progress for long operations
 * @private
 * @param {string} message - Loading message
 * @param {Object} [options] - Loading options
 */
_showLoadingWithProgress(message, options = {}) {
  this._showLoading(message);
  
  if (options.showProgress) {
    // Update loading state to show progress
    const loadingState = this._getElement('loadingState');
    if (loadingState) {
      const progressBar = loadingState.querySelector('.progress-bar');
      if (progressBar) {
        progressBar.style.display = 'block';
        this._updateProgress(0);
      }
    }
  }
  
  if (options.showCancel) {
    // Add cancel button to loading state
    this._addLoadingCancelButton(options.onCancel);
  }
}

/**
 * Update progress bar
 * @private
 * @param {number} percent - Progress percentage (0-100)
 */
_updateProgress(percent) {
  const progressBar = document.querySelector('.progress-bar-fill');
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent);
  }
}
```

### Step 7: Handle State During Filtering

```javascript
/**
 * Apply filters with appropriate state management
 * @private
 */
_applyFilters() {
  // Don't show loading for instant operations
  // Just update the display
  
  const filteredCount = this._getFilteredDirections().length;
  
  if (filteredCount === 0 && this.#directionsData.length > 0) {
    // Show empty state with filter message
    this._showState(UI_STATES.EMPTY);
    this._updateEmptyStateMessage('No directions match your current filters.');
  } else if (filteredCount > 0) {
    // Redisplay with filtered results
    this._displayDirections();
    this._showState(UI_STATES.RESULTS);
  }
  
  // Update stats to show filtered count
  this._updateStats();
  
  // Update filter indicators
  this._updateFilterIndicators();
}

/**
 * Update visual indicators for active filters
 * @private
 */
_updateFilterIndicators() {
  const hasActiveFilters = this.#currentFilter || this.#currentConcept;
  
  // Show/hide clear button
  if (hasActiveFilters) {
    this._showElement('filterClear');
  } else {
    this._hideElement('filterClear');
  }
  
  // Update active filter display
  const activeFiltersElement = this._getElement('activeFilters');
  if (activeFiltersElement) {
    if (hasActiveFilters) {
      const filters = [];
      if (this.#currentFilter) {
        filters.push(`Search: "${this.#currentFilter}"`);
      }
      if (this.#currentConcept) {
        const conceptName = this._getConceptName(this.#currentConcept);
        filters.push(`Concept: ${conceptName}`);
      }
      activeFiltersElement.textContent = filters.join(' • ');
      this._showElement('activeFilters');
    } else {
      this._hideElement('activeFilters');
    }
  }
}
```

### Step 8: Add Success Notifications

```javascript
/**
 * Show success notification
 * @private
 * @param {string} message - Success message
 * @param {number} [duration=3000] - Display duration in ms
 */
_showSuccess(message, duration = 3000) {
  // Create or update success notification
  let notification = document.getElementById('success-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'success-notification';
    notification.className = 'notification notification-success';
    document.body.appendChild(notification);
  }
  
  notification.textContent = message;
  notification.classList.add('notification-visible');
  
  // Auto-hide after duration
  clearTimeout(this.#notificationTimeout);
  this.#notificationTimeout = setTimeout(() => {
    notification.classList.remove('notification-visible');
  }, duration);
}
```

### Step 9: Clean Up Old State Management

Remove any direct UIStateManager usage:

```javascript
// DELETE old patterns:
this.#uiStateManager.setState(UI_STATES.LOADING);
this.#uiStateManager.showElement('elementId');
this.#uiStateManager.hideElement('elementId');
this.#uiStateManager.updateErrorMessage('message');

// All replaced with base controller methods
```

## State Transition Examples

### Loading → Results

```javascript
async _performOperation() {
  this._showLoading('Processing...');
  
  try {
    const result = await this._doAsyncWork();
    this._processResult(result);
    this._showState(UI_STATES.RESULTS);
  } catch (error) {
    this._showError('Operation failed. Please try again.');
  }
}
```

### Results → Empty (via filtering)

```javascript
_handleFilterChange(filterValue) {
  this.#currentFilter = filterValue;
  const filtered = this._getFilteredDirections();
  
  if (filtered.length === 0) {
    this._showState(UI_STATES.EMPTY);
    this._updateEmptyStateMessage('No matches found.');
  } else {
    this._displayDirections();
    this._showState(UI_STATES.RESULTS);
  }
}
```

### Error → Recovery

```javascript
_handleRetryClick() {
  if (this.#pendingRetryAction) {
    this.#pendingRetryAction();
    this.#pendingRetryAction = null;
  } else {
    // Default retry
    this._loadDirectionsData();
  }
}
```

## Testing State Management

### Unit Test Examples

```javascript
describe('State Management', () => {
  it('should show loading state during data fetch', async () => {
    const showLoadingSpy = jest.spyOn(controller, '_showLoading');
    
    const promise = controller._loadDirectionsData();
    
    expect(showLoadingSpy).toHaveBeenCalledWith('Loading thematic directions...');
    
    await promise;
  });
  
  it('should show empty state when no data', async () => {
    mockCharacterBuilderService.getAllThematicDirectionsWithConcepts
      .mockResolvedValue([]);
    
    await controller._loadInitialData();
    controller._initializeUIState();
    
    expect(controller.uiStateManager.currentState).toBe(UI_STATES.EMPTY);
  });
  
  it('should show error state on failure', async () => {
    const showErrorSpy = jest.spyOn(controller, '_showError');
    mockCharacterBuilderService.getAllThematicDirectionsWithConcepts
      .mockRejectedValue(new Error('Network error'));
    
    await controller._loadDirectionsData();
    
    expect(showErrorSpy).toHaveBeenCalled();
  });
});
```

### Manual Testing Checklist

1. **Loading States**:
   - [ ] Shows during initial load
   - [ ] Shows during refresh
   - [ ] Shows during delete operations
   - [ ] Messages are contextual

2. **Error States**:
   - [ ] Shows on network failure
   - [ ] Shows on validation error
   - [ ] Retry button works
   - [ ] Error messages are helpful

3. **Empty States**:
   - [ ] Shows when no data
   - [ ] Shows when filters exclude all
   - [ ] Messages are contextual
   - [ ] Actions are appropriate

4. **State Transitions**:
   - [ ] Smooth transitions
   - [ ] No flashing between states
   - [ ] Progress indicators work

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] All UIStateManager calls replaced
- [ ] Base controller state methods used throughout
- [ ] Loading states show during async operations
- [ ] Error states show with helpful messages
- [ ] Empty states have contextual messages
- [ ] State transitions are smooth
- [ ] Success notifications implemented
- [ ] Error recovery works
- [ ] All tests pass
- [ ] Manual testing confirms all states work
- [ ] Code committed with descriptive message