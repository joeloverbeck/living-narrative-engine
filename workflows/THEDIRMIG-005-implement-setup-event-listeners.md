# THEDIRMIG-005: Implement \_setupEventListeners() Method

## Overview

Implement the required `_setupEventListeners()` abstract method from BaseCharacterBuilderController. This method sets up all event listeners using base class helpers like `_addEventListener()`, `_addDebouncedListener()`, and `_addDelegatedListener()`, ensuring automatic cleanup on controller destruction.

## Priority

**HIGH** - Required abstract method implementation

## Dependencies

- **Blocked by**: THEDIRMIG-004 (needs cached elements)
- **Blocks**: THEDIRMIG-006 (lifecycle methods depend on event handlers)
- **Related**: THEDIRMIG-009 (modal event handling)

## Acceptance Criteria

- [ ] All event listeners use base class helper methods
- [ ] Direct addEventListener calls are removed
- [ ] Delegated listeners handle dynamic content
- [ ] Debounced listeners used for text inputs
- [ ] Event subscriptions use base class patterns
- [ ] All listeners are automatically cleaned up on destroy
- [ ] Event handling behavior remains identical

## Implementation Steps

### Step 1: Identify Current Event Listeners

Search for existing event listener patterns:

```bash
# Find addEventListener calls
grep -n "addEventListener" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js

# Find event subscriptions
grep -n "subscribe" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js

# Find click handlers
grep -n "onclick\|\.click" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
```

Common patterns to migrate:

- Button click handlers
- Input field listeners
- Modal interactions
- Event bus subscriptions
- Delegated listeners for dynamic content

### Step 2: Implement \_setupEventListeners() Method

Replace the placeholder with actual implementation:

```javascript
/**
 * Set up event listeners using base class helpers
 * @protected
 * @override
 */
_setupEventListeners() {
  // === Action Button Handlers ===
  this._addEventListener('refreshBtn', 'click', () => this._loadDirectionsData());
  this._addEventListener('retryBtn', 'click', () => this._loadDirectionsData());
  this._addEventListener('cleanupOrphansBtn', 'click', () => this._handleCleanupOrphans());
  this._addEventListener('addDirectionBtn', 'click', () => this._showAddDirectionModal());

  // === Filter Handlers ===
  // Debounced text input for search
  this._addDebouncedListener('directionFilter', 'input',
    (e) => this._handleFilterChange(e.target.value), 300);

  // Concept dropdown change
  this._addEventListener('conceptFilter', 'change',
    (e) => this._handleConceptSelection(e.target.value));

  // Clear filters button
  this._addEventListener('filterClear', 'click', () => this._clearFilters());

  // === Delegated Listeners for Dynamic Content ===
  // Click on direction cards
  this._addDelegatedListener('directionsList', '.direction-card', 'click',
    (e, target) => this._handleDirectionClick(e, target));

  // Delete button on cards (stop propagation)
  this._addDelegatedListener('directionsList', '.delete-btn', 'click',
    (e, target) => {
      e.stopPropagation();
      this._handleDeleteClick(e, target);
    });

  // Edit buttons on cards
  this._addDelegatedListener('directionsList', '.edit-btn', 'click',
    (e, target) => {
      e.stopPropagation();
      this._handleEditClick(e, target);
    });

  // === Modal Event Handlers ===
  this._addEventListener('modalConfirmBtn', 'click', () => this._handleModalConfirm());
  this._addEventListener('modalCancelBtn', 'click', () => this._closeModal());

  // Click outside modal to close
  this._addEventListener('modalOverlay', 'click', (e) => {
    if (e.target.id === 'modal-overlay') {
      this._closeModal();
    }
  });

  // === Keyboard Shortcuts ===
  this._addEventListener(document, 'keydown', (e) => this._handleKeyPress(e));

  // === Application Event Subscriptions ===
  this._subscribeToEvent('core:thematic_direction_updated',
    (data) => this._handleDirectionUpdated(data));

  this._subscribeToEvent('core:character_concept_updated',
    (data) => this._handleConceptUpdated(data));

  this._subscribeToEvent('core:thematic_direction_deleted',
    (data) => this._handleDirectionDeleted(data));
}
```

### Step 3: Migrate Existing Event Handlers

Find and update existing event setup code:

**Before**:

```javascript
// In initialize() or setupEventListeners()
document.getElementById('refresh-btn').addEventListener('click', () => {
  this._loadDirectionsData();
});

this.#eventBus.subscribe('core:thematic_direction_updated', (data) => {
  this._handleDirectionUpdated(data);
});

// Manual cleanup tracking
this.#eventListeners.push({ element, event, handler });
```

**After**:

```javascript
// In _setupEventListeners()
this._addEventListener('refreshBtn', 'click', () => this._loadDirectionsData());

this._subscribeToEvent('core:thematic_direction_updated', (data) =>
  this._handleDirectionUpdated(data)
);

// No manual cleanup needed - base class handles it
```

### Step 4: Implement Delegated Listeners for Dynamic Content

For dynamically created elements, use delegated listeners:

```javascript
// Instead of adding listeners to each direction card:
// ❌ AVOID
directionCards.forEach((card) => {
  card.addEventListener('click', () => this._selectDirection(card.dataset.id));
});

// ✅ USE delegated listener on parent
this._addDelegatedListener(
  'directionsList',
  '.direction-card',
  'click',
  (e, target) => {
    const directionId = target.dataset.directionId;
    this._selectDirection(directionId);
  }
);
```

### Step 5: Handle Special Event Cases

#### Debounced Input

```javascript
// For search/filter inputs that shouldn't fire on every keystroke
this._addDebouncedListener(
  'directionFilter',
  'input',
  (e) => {
    const searchTerm = e.target.value.trim();
    this._filterDirections(searchTerm);
  },
  300 // 300ms delay
);
```

#### Event Delegation with Data Attributes

```javascript
this._addDelegatedListener(
  'directionsList',
  '[data-action]',
  'click',
  (e, target) => {
    e.preventDefault();
    const action = target.dataset.action;
    const directionId = target.closest('.direction-card').dataset.directionId;

    switch (action) {
      case 'edit':
        this._editDirection(directionId);
        break;
      case 'delete':
        this._confirmDeleteDirection(directionId);
        break;
      case 'duplicate':
        this._duplicateDirection(directionId);
        break;
    }
  }
);
```

#### Keyboard Shortcuts

```javascript
// Global keyboard shortcuts
this._addEventListener(document, 'keydown', (e) => {
  // Only handle if no input is focused
  if (
    document.activeElement.tagName === 'INPUT' ||
    document.activeElement.tagName === 'TEXTAREA'
  ) {
    return;
  }

  switch (e.key) {
    case 'r':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this._loadDirectionsData();
      }
      break;
    case 'Escape':
      if (this._isModalOpen()) {
        this._closeModal();
      }
      break;
    case '/':
      e.preventDefault();
      this._getElement('directionFilter')?.focus();
      break;
  }
});
```

### Step 6: Remove Old Event Management Code

Remove any manual event tracking and cleanup:

```javascript
// DELETE old patterns like:
this.#eventListeners = [];
this.#subscriptions = [];

// DELETE manual cleanup in destroy:
destroy() {
  this.#eventListeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  this.#subscriptions.forEach(sub => sub.unsubscribe());
}
```

### Step 7: Update Event Handler Methods

Ensure event handler methods are compatible:

```javascript
// Handler methods should be arrow functions or bound
_handleFilterChange(value) {
  this.#currentFilter = value;
  this._applyFilters();
}

_handleDirectionClick(event, element) {
  const directionId = element.dataset.directionId;
  if (!directionId) return;

  this._selectDirection(directionId);
}

_handleDeleteClick(event, element) {
  event.stopPropagation(); // Prevent card click
  const card = element.closest('.direction-card');
  const directionId = card.dataset.directionId;

  this._confirmDeleteDirection(directionId);
}
```

## Testing Event Listeners

### Manual Testing Checklist

1. **Button Clicks**:
   - [ ] Refresh button loads data
   - [ ] Retry button works on error state
   - [ ] Cleanup orphans shows confirmation
   - [ ] Add direction opens modal

2. **Filtering**:
   - [ ] Direction filter has 300ms debounce
   - [ ] Concept dropdown filters immediately
   - [ ] Clear filters resets both filters

3. **Dynamic Content**:
   - [ ] Clicking direction cards selects them
   - [ ] Delete buttons work without selecting
   - [ ] Edit buttons open edit mode

4. **Modal Interactions**:
   - [ ] Confirm button executes action
   - [ ] Cancel button closes modal
   - [ ] Clicking overlay closes modal
   - [ ] ESC key closes modal

5. **Keyboard Shortcuts**:
   - [ ] Ctrl+R refreshes (prevented)
   - [ ] / focuses search
   - [ ] ESC closes modals

### Unit Test Example

```javascript
describe('Event Listener Setup', () => {
  it('should set up all required event listeners', () => {
    const addEventListenerSpy = jest.spyOn(controller, '_addEventListener');
    const addDebouncedSpy = jest.spyOn(controller, '_addDebouncedListener');
    const addDelegatedSpy = jest.spyOn(controller, '_addDelegatedListener');
    const subscribeToEventSpy = jest.spyOn(controller, '_subscribeToEvent');

    controller._setupEventListeners();

    // Verify button listeners
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'refreshBtn',
      'click',
      expect.any(Function)
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'retryBtn',
      'click',
      expect.any(Function)
    );

    // Verify debounced listener
    expect(addDebouncedSpy).toHaveBeenCalledWith(
      'directionFilter',
      'input',
      expect.any(Function),
      300
    );

    // Verify delegated listeners
    expect(addDelegatedSpy).toHaveBeenCalledWith(
      'directionsList',
      '.direction-card',
      'click',
      expect.any(Function)
    );

    // Verify event subscriptions
    expect(subscribeToEventSpy).toHaveBeenCalledWith(
      'core:thematic_direction_updated',
      expect.any(Function)
    );
  });
});
```

## Common Patterns and Best Practices

### Pattern 1: Organized Event Groups

```javascript
_setupEventListeners() {
  // === Group 1: User Actions ===
  this._setupActionButtons();

  // === Group 2: Filtering ===
  this._setupFilterListeners();

  // === Group 3: Dynamic Content ===
  this._setupDelegatedListeners();

  // === Group 4: Application Events ===
  this._setupEventSubscriptions();
}
```

### Pattern 2: Event Handler Naming

```javascript
// Consistent naming: _handle[What][Action]
_handleDirectionClick(e, element) { }
_handleFilterChange(value) { }
_handleModalConfirm() { }
_handleKeyPress(e) { }
```

### Pattern 3: Stop Propagation for Nested Elements

```javascript
this._addDelegatedListener(
  'directionsList',
  '.delete-btn',
  'click',
  (e, target) => {
    e.stopPropagation(); // Prevent parent click
    e.preventDefault(); // Prevent default action
    this._handleDeleteClick(e, target);
  }
);
```

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] \_setupEventListeners() implemented
- [ ] All direct addEventListener calls removed
- [ ] All event handlers use base class helpers
- [ ] Debounced listeners used for text inputs
- [ ] Delegated listeners handle dynamic content
- [ ] Event subscriptions use \_subscribeToEvent()
- [ ] Manual cleanup code removed
- [ ] All event handling behavior preserved
- [ ] Manual testing confirms all interactions work
- [ ] Unit tests pass
- [ ] Code committed with descriptive message
