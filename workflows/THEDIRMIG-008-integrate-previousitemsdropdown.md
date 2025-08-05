# THEDIRMIG-008: Integrate PreviousItemsDropdown Component

## Overview

Integrate the PreviousItemsDropdown component for concept filtering in the thematic directions manager. This component needs special handling because it does NOT have a destroy() method, requiring careful cleanup implementation to prevent memory leaks.

## Priority

**MEDIUM** - Important UI component integration

## Dependencies

- **Blocked by**: THEDIRMIG-006 (lifecycle methods for initialization)
- **Related**: THEDIRMIG-004 (cached element for dropdown)
- **Enables**: THEDIRMIG-011 (cleanup implementation)

## Acceptance Criteria

- [ ] PreviousItemsDropdown initialized in \_initializeAdditionalServices()
- [ ] Dropdown populated with available concepts
- [ ] Selection changes trigger filtering
- [ ] Clear functionality works
- [ ] Previous selections are remembered
- [ ] Component cleaned up properly despite lacking destroy()
- [ ] No memory leaks from event listeners
- [ ] Dropdown updates when concepts change

## Implementation Steps

### Step 1: Analyze PreviousItemsDropdown API

First, understand the component's interface:

```bash
# Find the component definition
find src -name "*PreviousItemsDropdown*" -type f

# Check its constructor and methods
grep -A 20 "class PreviousItemsDropdown" src/shared/components/PreviousItemsDropdown.js
```

Expected API:

```javascript
new PreviousItemsDropdown({
  element: HTMLElement, // The select/input element
  onSelectionChange: Function, // Callback when selection changes
  placeholder: String, // Placeholder text
  allowClear: Boolean, // Show clear button
  storageKey: String, // Local storage key for persistence
  maxItems: Number, // Max items to remember
});
```

### Step 2: Add Component Field and Configuration

```javascript
export class ThematicDirectionsManagerController extends BaseCharacterBuilderController {
  // Existing fields...

  /**
   * Concept filter dropdown instance
   * @type {PreviousItemsDropdown|null}
   */
  #conceptDropdown = null;

  /**
   * Storage key for concept filter persistence
   * @type {string}
   */
  #conceptFilterStorageKey = 'thematic-directions-concept-filter';

  /**
   * Currently selected concept ID
   * @type {string|null}
   */
  #currentConcept = null;
}
```

### Step 3: Initialize in \_initializeAdditionalServices()

```javascript
/**
 * Initialize additional services and components
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _initializeAdditionalServices() {
  await super._initializeAdditionalServices();

  try {
    // Initialize concept dropdown
    this._initializeConceptDropdown();

    // Load concepts for the dropdown
    await this._loadConceptsForDropdown();

    // Restore previous selection if any
    this._restoreConceptSelection();

    this.logger.debug('PreviousItemsDropdown initialized successfully');

  } catch (error) {
    this.logger.error('Failed to initialize concept dropdown:', error);
    // Continue without dropdown - graceful degradation
    this._disableConceptFilter();
  }
}

/**
 * Initialize the concept filter dropdown
 * @private
 */
_initializeConceptDropdown() {
  const conceptFilterElement = this._getElement('conceptFilter');
  if (!conceptFilterElement) {
    this.logger.warn('Concept filter element not found');
    return;
  }

  // Create dropdown instance
  this.#conceptDropdown = new PreviousItemsDropdown({
    element: conceptFilterElement,
    onSelectionChange: this._handleConceptSelection.bind(this),
    placeholder: 'Filter by concept...',
    allowClear: true,
    storageKey: this.#conceptFilterStorageKey,
    maxItems: 10,
    searchable: true,
    clearText: 'All concepts',
    noResultsText: 'No matching concepts'
  });

  // Store reference to element for manual cleanup
  this.#conceptDropdown._element = conceptFilterElement;
}
```

### Step 4: Load and Populate Concepts

```javascript
/**
 * Load concepts and populate dropdown
 * @private
 * @returns {Promise<void>}
 */
async _loadConceptsForDropdown() {
  if (!this.#conceptDropdown) return;

  try {
    // Get concepts from service or use cached data
    const concepts = this.#conceptsData.length > 0
      ? this.#conceptsData
      : await this._fetchConcepts();

    // Transform concepts to dropdown format
    const dropdownItems = concepts.map(concept => ({
      value: concept.id,
      label: concept.name,
      description: concept.description,
      count: this._getDirectionCountForConcept(concept.id)
    }));

    // Sort by name
    dropdownItems.sort((a, b) => a.label.localeCompare(b.label));

    // Add "All" option at the beginning
    dropdownItems.unshift({
      value: '',
      label: 'All Concepts',
      description: 'Show all thematic directions',
      count: this.#directionsData.length
    });

    // Populate dropdown
    this._populateDropdown(dropdownItems);

  } catch (error) {
    this.logger.error('Failed to load concepts for dropdown:', error);
    this._disableConceptFilter();
  }
}

/**
 * Populate dropdown with items
 * @private
 * @param {Array} items - Dropdown items
 */
_populateDropdown(items) {
  if (!this.#conceptDropdown?._element) return;

  const selectElement = this.#conceptDropdown._element;

  // Clear existing options
  selectElement.innerHTML = '';

  // Add options
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.count !== undefined
      ? `${item.label} (${item.count})`
      : item.label;
    option.title = item.description || '';

    selectElement.appendChild(option);
  });

  // Trigger dropdown's internal update
  if (typeof this.#conceptDropdown.refresh === 'function') {
    this.#conceptDropdown.refresh();
  }
}
```

### Step 5: Handle Selection Changes

```javascript
/**
 * Handle concept selection change
 * @private
 * @param {string} conceptId - Selected concept ID
 */
_handleConceptSelection(conceptId) {
  this.logger.debug(`Concept filter changed to: ${conceptId || 'All'}`);

  // Update current concept
  this.#currentConcept = conceptId || null;

  // Store selection
  this._storeConceptSelection(conceptId);

  // Apply filters
  this._applyFilters();

  // Update UI
  this._updateFilterDisplay();
  this._updateStats();

  // Track analytics if needed
  this.eventBus.dispatch({
    type: 'ANALYTICS_TRACK',
    payload: {
      event: 'concept_filter_changed',
      properties: {
        conceptId: conceptId,
        conceptName: this._getConceptName(conceptId)
      }
    }
  });
}

/**
 * Get count of directions for a concept
 * @private
 * @param {string} conceptId - Concept ID
 * @returns {number} Direction count
 */
_getDirectionCountForConcept(conceptId) {
  return this.#directionsData.filter(direction =>
    direction.concepts?.some(c => c.id === conceptId)
  ).length;
}
```

### Step 6: Implement Cleanup Without destroy()

Since PreviousItemsDropdown doesn't have a destroy() method, implement manual cleanup:

```javascript
/**
 * Post-destroy cleanup
 * @protected
 * @override
 */
_postDestroy() {
  // Clean up PreviousItemsDropdown manually
  if (this.#conceptDropdown) {
    this._cleanupConceptDropdown();
  }

  super._postDestroy();
}

/**
 * Manually clean up concept dropdown
 * @private
 */
_cleanupConceptDropdown() {
  if (!this.#conceptDropdown) return;

  try {
    // Remove event listeners if we know about them
    if (this.#conceptDropdown._element) {
      // Remove change listener
      const element = this.#conceptDropdown._element;

      // Clone and replace to remove all event listeners
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
    }

    // Clear any internal references
    if (this.#conceptDropdown._items) {
      this.#conceptDropdown._items = null;
    }

    if (this.#conceptDropdown._selectedItems) {
      this.#conceptDropdown._selectedItems = null;
    }

    // Remove dropdown reference
    this.#conceptDropdown = null;

    this.logger.debug('Concept dropdown cleaned up');

  } catch (error) {
    this.logger.error('Error cleaning up concept dropdown:', error);
  }
}
```

### Step 7: Handle Dynamic Concept Updates

Update dropdown when concepts change:

```javascript
/**
 * Handle character concept updated event
 * @private
 * @param {Object} data - Event data
 */
_handleConceptUpdated(data) {
  const { concept } = data;
  if (!concept) return;

  // Update local concepts data
  const index = this.#conceptsData.findIndex(c => c.id === concept.id);
  if (index !== -1) {
    this.#conceptsData[index] = concept;
  } else {
    this.#conceptsData.push(concept);
  }

  // Refresh dropdown
  this._loadConceptsForDropdown();

  // If the updated concept is currently selected, reapply filters
  if (this.#currentConcept === concept.id) {
    this._applyFilters();
  }
}

/**
 * Handle character concept deleted event
 * @private
 * @param {Object} data - Event data
 */
_handleConceptDeleted(data) {
  const { conceptId } = data;
  if (!conceptId) return;

  // Remove from local data
  this.#conceptsData = this.#conceptsData.filter(c => c.id !== conceptId);

  // If deleted concept was selected, clear filter
  if (this.#currentConcept === conceptId) {
    this.#currentConcept = null;
    this._clearConceptFilter();
  }

  // Refresh dropdown
  this._loadConceptsForDropdown();
}
```

### Step 8: Restore and Persist Selection

```javascript
/**
 * Restore previous concept selection
 * @private
 */
_restoreConceptSelection() {
  if (!this.#conceptDropdown) return;

  try {
    const stored = localStorage.getItem(this.#conceptFilterStorageKey);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.selectedConcept && this._isValidConcept(data.selectedConcept)) {
        this.#currentConcept = data.selectedConcept;

        // Set dropdown value
        if (this.#conceptDropdown._element) {
          this.#conceptDropdown._element.value = data.selectedConcept;
        }

        // Apply filter
        this._applyFilters();
      }
    }
  } catch (error) {
    this.logger.error('Failed to restore concept selection:', error);
  }
}

/**
 * Store concept selection
 * @private
 * @param {string} conceptId - Selected concept ID
 */
_storeConceptSelection(conceptId) {
  try {
    const data = {
      selectedConcept: conceptId,
      timestamp: Date.now()
    };
    localStorage.setItem(this.#conceptFilterStorageKey, JSON.stringify(data));
  } catch (error) {
    this.logger.error('Failed to store concept selection:', error);
  }
}
```

### Step 9: Add Fallback for Missing Component

```javascript
/**
 * Disable concept filter if component unavailable
 * @private
 */
_disableConceptFilter() {
  const conceptFilterElement = this._getElement('conceptFilter');
  if (conceptFilterElement) {
    conceptFilterElement.disabled = true;
    conceptFilterElement.title = 'Concept filtering is currently unavailable';
  }

  // Hide related UI elements
  const filterContainer = conceptFilterElement?.closest('.filter-container');
  if (filterContainer) {
    filterContainer.style.display = 'none';
  }
}

/**
 * Clear concept filter
 * @private
 */
_clearConceptFilter() {
  this.#currentConcept = null;

  if (this.#conceptDropdown?._element) {
    this.#conceptDropdown._element.value = '';
  }

  this._storeConceptSelection('');
  this._applyFilters();
}
```

## Testing Strategy

### Manual Testing Checklist

1. **Initialization**:
   - [ ] Dropdown appears and is populated
   - [ ] Placeholder text shows correctly
   - [ ] All concepts listed with counts

2. **Filtering**:
   - [ ] Selecting concept filters directions
   - [ ] Clear button resets filter
   - [ ] Filter persists on page reload

3. **Updates**:
   - [ ] Adding concept updates dropdown
   - [ ] Deleting concept updates dropdown
   - [ ] Counts update when directions change

4. **Cleanup**:
   - [ ] No errors on controller destroy
   - [ ] No memory leaks detected

### Unit Test Example

```javascript
describe('PreviousItemsDropdown Integration', () => {
  let mockPreviousItemsDropdown;

  beforeEach(() => {
    mockPreviousItemsDropdown = {
      _element: document.createElement('select'),
      refresh: jest.fn(),
    };

    jest
      .spyOn(window, 'PreviousItemsDropdown')
      .mockImplementation(() => mockPreviousItemsDropdown);
  });

  it('should initialize dropdown in additional services', async () => {
    await controller._initializeAdditionalServices();

    expect(PreviousItemsDropdown).toHaveBeenCalledWith({
      element: expect.any(HTMLElement),
      onSelectionChange: expect.any(Function),
      placeholder: 'Filter by concept...',
      allowClear: true,
      storageKey: 'thematic-directions-concept-filter',
    });
  });

  it('should handle concept selection', () => {
    controller.#conceptDropdown = mockPreviousItemsDropdown;
    const applyFiltersSpy = jest.spyOn(controller, '_applyFilters');

    controller._handleConceptSelection('concept-123');

    expect(controller.#currentConcept).toBe('concept-123');
    expect(applyFiltersSpy).toHaveBeenCalled();
  });

  it('should clean up dropdown on destroy', () => {
    controller.#conceptDropdown = mockPreviousItemsDropdown;
    const element = mockPreviousItemsDropdown._element;

    controller._postDestroy();

    expect(controller.#conceptDropdown).toBe(null);
  });
});
```

## Workaround Documentation

### Why Manual Cleanup?

PreviousItemsDropdown doesn't implement a destroy() method, which means:

1. Event listeners aren't automatically removed
2. Internal references may persist
3. Memory leaks are possible

### Cleanup Strategy

1. **Clone and Replace**: Removes all event listeners by replacing the element
2. **Clear References**: Manually null out internal properties
3. **Null Assignment**: Ensure garbage collection can clean up

### Future Improvement

Consider submitting a PR to add destroy() method to PreviousItemsDropdown:

```javascript
// Suggested implementation for PreviousItemsDropdown
destroy() {
  // Remove event listeners
  this._element?.removeEventListener('change', this._handleChange);
  this._element?.removeEventListener('input', this._handleInput);

  // Clear references
  this._items = null;
  this._selectedItems = null;
  this._element = null;
  this._onSelectionChange = null;
}
```

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] PreviousItemsDropdown initialized properly
- [ ] Dropdown populated with concepts
- [ ] Selection triggers filtering
- [ ] Clear functionality works
- [ ] Selection persists across sessions
- [ ] Manual cleanup implemented
- [ ] No memory leaks
- [ ] Updates handled dynamically
- [ ] Fallback for missing component
- [ ] All tests pass
- [ ] Manual testing confirms functionality
- [ ] Code committed with descriptive message
