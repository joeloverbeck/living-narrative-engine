# CORMOTSEL-006: Update Class Properties and State Management

## Priority: P1 (High)

## Estimated Effort: 0.5-1 hour

## Status: TODO

## Problem Statement

The controller's class properties need to be updated to support the new implementation. Some properties are no longer needed (like `#currentConceptId`), while new properties are required for caching and state management.

## Implementation Details

### Step 1: Remove Deprecated Properties

Remove or mark as deprecated the following properties:

```javascript
class CoreMotivationsGeneratorController extends BaseCharacterBuilderController {
  // REMOVE these properties:
  // #currentConceptId = null;  // No longer needed - we load from ALL concepts
  // ... rest of class
}
```

### Step 2: Add New Properties

Add the required properties for the new implementation:

```javascript
class CoreMotivationsGeneratorController extends BaseCharacterBuilderController {
  // Existing properties to KEEP:
  #selectedDirectionId = null; // Currently selected direction ID
  #eligibleDirections = []; // Now stores organized ConceptGroup objects
  #generatedMotivations = []; // Keep for storing generated results

  // NEW properties to ADD:
  /**
   * Cache for direction-concept pairs
   * @type {Map<string, {direction: ThematicDirection, concept: CharacterConcept}>}
   */
  #directionsWithConceptsMap = new Map();

  /**
   * Currently selected direction object
   * @type {ThematicDirection|null}
   */
  #currentDirection = null;

  /**
   * Concept of the currently selected direction
   * @type {CharacterConcept|null}
   */
  #currentConcept = null;

  /**
   * Loading state flag
   * @type {boolean}
   */
  #isLoading = false;

  /**
   * Cache timestamp for data freshness
   * @type {number|null}
   */
  #cacheTimestamp = null;

  // ... rest of existing properties (logger, eventBus, etc.)
}
```

### Step 3: Add Type Definitions

Add JSDoc type definitions at the top of the file:

```javascript
/**
 * @typedef {Object} ConceptGroup
 * @property {string} conceptId - The concept's unique identifier
 * @property {string} conceptTitle - The concept's display title
 * @property {Array<ThematicDirection>} directions - Directions in this concept
 */

/**
 * @typedef {Object} ThematicDirection
 * @property {string} id - The direction's unique identifier
 * @property {string} conceptId - The parent concept's ID
 * @property {string} title - The direction's display title
 * @property {string} [description] - Optional description
 * @property {Array<string>} [tags] - Optional tags
 */

/**
 * @typedef {Object} CharacterConcept
 * @property {string} id - The concept's unique identifier
 * @property {string} title - The concept's display title
 * @property {string} [description] - Optional description
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} CoreMotivation
 * @property {string} id - The motivation's unique identifier
 * @property {string} directionId - Associated direction ID
 * @property {string} conceptId - Associated concept ID
 * @property {string} content - The generated motivation text
 * @property {Array<string>} contradictions - Internal contradictions
 * @property {string} centralQuestion - The driving question
 * @property {number} generatedAt - Generation timestamp
 */
```

### Step 4: Update Getter Methods

Add or update getter methods for accessing state:

```javascript
/**
 * Get the currently selected direction
 * @returns {ThematicDirection|null}
 */
get currentDirection() {
  return this.#currentDirection;
}

/**
 * Get the concept of the current direction
 * @returns {CharacterConcept|null}
 */
get currentConcept() {
  return this.#currentConcept;
}

/**
 * Get the selected direction ID
 * @returns {string|null}
 */
get selectedDirectionId() {
  return this.#selectedDirectionId;
}

/**
 * Check if data is currently loading
 * @returns {boolean}
 */
get isLoading() {
  return this.#isLoading;
}

/**
 * Get all eligible directions organized by concept
 * @returns {Array<ConceptGroup>}
 */
get eligibleDirections() {
  return this.#eligibleDirections;
}

/**
 * Get the total count of eligible directions
 * @returns {number}
 */
get totalDirectionsCount() {
  return this.#eligibleDirections.reduce(
    (sum, group) => sum + group.directions.length,
    0
  );
}
```

### Step 5: Update State Management Methods

Add methods for managing state transitions:

```javascript
/**
 * Update the loading state and UI
 * @param {boolean} isLoading
 */
#setLoadingState(isLoading) {
  this.#isLoading = isLoading;

  const selector = document.getElementById('direction-selector');
  const generateBtn = document.getElementById('generate-btn');
  const loadingIndicator = document.getElementById('loading-indicator');

  if (selector) {
    selector.disabled = isLoading;
  }

  if (generateBtn) {
    generateBtn.disabled = isLoading || !this.#selectedDirectionId;
  }

  if (loadingIndicator) {
    loadingIndicator.style.display = isLoading ? 'block' : 'none';
  }

  this.eventBus.dispatch('core:loading_state_changed', { isLoading });
}

/**
 * Clear all selection state
 */
#clearSelectionState() {
  this.#selectedDirectionId = null;
  this.#currentDirection = null;
  this.#currentConcept = null;

  const selector = document.getElementById('direction-selector');
  if (selector) {
    selector.value = '';
  }

  this.#updateUIState();
}

/**
 * Check if cached data is stale (older than 5 minutes)
 * @returns {boolean}
 */
#isCacheStale() {
  if (!this.#cacheTimestamp) return true;

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  return Date.now() - this.#cacheTimestamp > CACHE_DURATION;
}

/**
 * Refresh data if cache is stale
 */
async #refreshIfNeeded() {
  if (this.#isCacheStale()) {
    this.logger.info('Cache is stale, refreshing directions...');
    await this.#loadEligibleDirections();
  }
}
```

### Step 6: Update `#updateUIState()` Method

Ensure UI state method uses new properties:

```javascript
#updateUIState() {
  // Update direction display
  const selectedDisplay = document.getElementById('selected-direction-display');
  if (selectedDisplay) {
    if (this.#currentDirection && this.#currentConcept) {
      selectedDisplay.innerHTML = `
        <div class="selected-info">
          <strong>Concept:</strong> ${this.#currentConcept.title}<br>
          <strong>Direction:</strong> ${this.#currentDirection.title}
        </div>
      `;
    } else {
      selectedDisplay.innerHTML = '<em>No direction selected</em>';
    }
  }

  // Update button states
  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.disabled = !this.#selectedDirectionId || this.#isLoading;
  }

  // Update counter displays
  const directionCount = document.getElementById('direction-count');
  if (directionCount) {
    directionCount.textContent = `${this.totalDirectionsCount} directions available`;
  }
}
```

## Acceptance Criteria

- [ ] Old properties are removed (e.g., `#currentConceptId`)
- [ ] New properties are added with proper JSDoc types
- [ ] Getter methods provide safe access to state
- [ ] State management methods handle all transitions
- [ ] Loading states are properly managed
- [ ] Cache invalidation logic is implemented
- [ ] UI updates reflect new state structure

## Dependencies

- **CORMOTSEL-003**: New data loading structure
- **CORMOTSEL-004**: Filtering logic
- **CORMOTSEL-005**: Organization structure

## Testing Requirements

### Unit Tests

```javascript
describe('Class Properties and State', () => {
  it('should initialize with correct default values', () => {
    const controller = new CoreMotivationsGeneratorController(dependencies);

    expect(controller.selectedDirectionId).toBeNull();
    expect(controller.currentDirection).toBeNull();
    expect(controller.currentConcept).toBeNull();
    expect(controller.isLoading).toBe(false);
    expect(controller.eligibleDirections).toEqual([]);
  });

  it('should update loading state correctly', () => {
    controller.setLoadingState(true);

    expect(controller.isLoading).toBe(true);
    expect(generateBtn.disabled).toBe(true);
    expect(loadingIndicator.style.display).toBe('block');
  });

  it('should clear selection state properly', () => {
    controller.selectedDirectionId = 'test-id';
    controller.currentDirection = { id: 'test-id' };

    controller.clearSelectionState();

    expect(controller.selectedDirectionId).toBeNull();
    expect(controller.currentDirection).toBeNull();
    expect(selector.value).toBe('');
  });

  it('should detect stale cache correctly', () => {
    controller.cacheTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago

    expect(controller.isCacheStale()).toBe(true);

    controller.cacheTimestamp = Date.now() - 2 * 60 * 1000; // 2 minutes ago

    expect(controller.isCacheStale()).toBe(false);
  });
});
```

## Related Files

- **Controller**: `src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js`
- **Base Controller**: `src/characterBuilder/controllers/BaseCharacterBuilderController.js`

## Notes

- Proper state management is crucial for UI consistency
- Cache management helps with performance for frequent page reloads
- Type definitions improve IDE support and code maintainability
