# THEDIRMIG-006: Migrate Lifecycle Methods to Base Controller Hooks

## Overview

Migrate the existing initialization and lifecycle methods to use the BaseCharacterBuilderController's lifecycle hooks. This includes implementing methods like `_loadInitialData()`, `_initializeUIState()`, `_initializeAdditionalServices()`, and `_postInitialize()` to replace the current custom initialization flow.

## Priority

**HIGH** - Core functionality migration

## Dependencies

- **Blocked by**: THEDIRMIG-005 (event listeners setup)
- **Blocks**: THEDIRMIG-007, THEDIRMIG-008 (component initialization)
- **Enables**: THEDIRMIG-010 (state management)

## Acceptance Criteria

- [ ] Current initialize() method logic distributed to appropriate hooks
- [ ] Data loading moved to _loadInitialData()
- [ ] UI state initialization in _initializeUIState()
- [ ] Additional services setup in _initializeAdditionalServices()
- [ ] Initialization order preserved
- [ ] No duplicate initialization
- [ ] Error handling maintained
- [ ] Loading states shown at appropriate times

## Implementation Steps

### Step 1: Analyze Current Initialization Flow

Review the existing initialize() method:

```bash
# Find current initialization
grep -n "initialize" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
grep -A 30 "async initialize" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
```

Typical flow:
1. Cache DOM elements
2. Setup event listeners
3. Initialize UI components
4. Load initial data
5. Set initial UI state
6. Log completion

### Step 2: Map to Base Controller Lifecycle

Base controller lifecycle order:
1. `constructor()` - Basic field initialization
2. `initialize()` - Base class method (calls hooks in order):
   - `_preInitialize()` - Pre-initialization setup
   - `_cacheElements()` - Cache DOM elements (already done)
   - `_setupEventListeners()` - Setup events (already done)
   - `_initializeAdditionalServices()` - Initialize services/components
   - `_loadInitialData()` - Load page data
   - `_initializeUIState()` - Setup UI state
   - `_postInitialize()` - Final setup

### Step 3: Implement _preInitialize()

Optional hook for early setup:

```javascript
/**
 * Pre-initialization setup
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _preInitialize() {
  await super._preInitialize();
  
  // Initialize any early state or utilities
  this.#filterManager = this._createFilterManager();
  this.#getFilteredData = this._createFilteredDataGetter();
  
  this.logger.debug('ThematicDirectionsManager: Pre-initialization complete');
}
```

### Step 4: Implement _initializeAdditionalServices()

Initialize components that aren't core dependencies:

```javascript
/**
 * Initialize additional services and components
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _initializeAdditionalServices() {
  await super._initializeAdditionalServices();
  
  // Initialize concept dropdown
  this.#conceptDropdown = new PreviousItemsDropdown({
    element: this._getElement('conceptFilter'),
    onSelectionChange: this._handleConceptSelection.bind(this),
    placeholder: 'Filter by concept...',
    allowClear: true,
    storageKey: 'thematic-directions-concept-filter'
  });
  
  // Initialize modal manager if using custom modal system
  this.#modalManager = new ModalManager(this);
  
  // Load concepts for dropdown
  await this._loadConceptsForDropdown();
  
  this.logger.debug('Additional services initialized');
}
```

### Step 5: Implement _loadInitialData()

Move data loading logic here:

```javascript
/**
 * Load initial page data
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _loadInitialData() {
  try {
    // Show loading state while fetching
    this._showLoading('Loading thematic directions...');
    
    // Fetch all required data in parallel
    const [directions, concepts, orphanedCount] = await this._executeWithErrorHandling(
      () => Promise.all([
        this.characterBuilderService.getAllThematicDirectionsWithConcepts(),
        this.characterBuilderService.getAllCharacterConcepts(),
        this.characterBuilderService.getOrphanedThematicDirections()
      ]),
      'load initial data',
      { 
        retries: 2,
        userErrorMessage: 'Failed to load thematic directions. Please try again.'
      }
    );
    
    // Store the data
    this.#directionsData = directions || [];
    this.#conceptsData = concepts || [];
    this.#orphanedCount = orphanedCount?.length || 0;
    
    // Process data if needed
    this._processDirectionsData();
    
    this.logger.info(`Loaded ${this.#directionsData.length} directions, ${this.#orphanedCount} orphaned`);
    
  } catch (error) {
    // Error already handled by _executeWithErrorHandling
    this.logger.error('Failed to load initial data', error);
    // Don't rethrow - let _initializeUIState handle empty/error state
  }
}
```

### Step 6: Implement _initializeUIState()

Set up the initial UI state based on loaded data:

```javascript
/**
 * Initialize UI state based on loaded data
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _initializeUIState() {
  await super._initializeUIState(); // Initializes UIStateManager
  
  // Update stats displays
  this._updateStats();
  
  // Determine and show appropriate state
  if (this.#directionsData.length > 0) {
    // Display the directions
    this._displayDirections();
    this._showState(UI_STATES.RESULTS);
    
    // Restore previous filters if any
    this._restoreFilterState();
  } else {
    // Show empty state
    this._showState(UI_STATES.EMPTY);
    this._updateEmptyStateMessage();
  }
  
  // Initialize any UI-specific features
  this._initializeTooltips();
  this._initializeSortOptions();
}
```

### Step 7: Implement _postInitialize()

Final initialization tasks:

```javascript
/**
 * Post-initialization setup
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _postInitialize() {
  await super._postInitialize();
  
  // Set up keyboard shortcuts
  this._initializeKeyboardShortcuts();
  
  // Start any background processes
  this._startAutoSave();
  
  // Focus initial element
  const filterInput = this._getElement('directionFilter');
  if (filterInput && !this._hasActiveModal()) {
    filterInput.focus();
  }
  
  // Log successful initialization
  this.logger.info('ThematicDirectionsManagerController initialized successfully', {
    directionsCount: this.#directionsData.length,
    conceptsCount: this.#conceptsData.length,
    orphanedCount: this.#orphanedCount
  });
  
  // Dispatch initialization complete event
  this.eventBus.dispatch({
    type: 'THEMATIC_DIRECTIONS_MANAGER_INITIALIZED',
    payload: {
      directionsCount: this.#directionsData.length
    }
  });
}
```

### Step 8: Remove Old Initialize Method

After implementing all lifecycle hooks, remove the old method:

```javascript
// DELETE this entire method:
async initialize() {
  try {
    // Cache DOM elements
    this.#cacheElements();
    
    // Setup event listeners
    this.#setupEventListeners();
    
    // ... rest of old initialization
  } catch (error) {
    this.#logger.error('Failed to initialize', error);
    throw error;
  }
}
```

### Step 9: Update Entry Point

Update how the controller is initialized:

**Before**:
```javascript
// In thematicDirectionsManagerMain.js
const controller = new ThematicDirectionsManagerController(dependencies);
await controller.initialize();
```

**After**:
```javascript
// In thematicDirectionsManagerMain.js
const controller = new ThematicDirectionsManagerController(dependencies);
await controller.initialize(); // Now calls base class initialize()
```

## Error Handling Patterns

### Use _executeWithErrorHandling

```javascript
async _loadInitialData() {
  const data = await this._executeWithErrorHandling(
    async () => {
      // Operation that might fail
      return await this.characterBuilderService.getAllThematicDirections();
    },
    'load thematic directions', // Context for logging
    {
      retries: 2,                // Number of retries
      retryDelay: 1000,          // Delay between retries
      userErrorMessage: 'Unable to load directions. Please refresh the page.',
      fallbackValue: []          // Return empty array on failure
    }
  );
  
  this.#directionsData = data;
}
```

### State-Based Error Display

```javascript
async _loadInitialData() {
  try {
    // ... loading logic
  } catch (error) {
    // Don't throw - let UI state handle it
    this.#directionsData = [];
    this._setErrorMessage('Failed to load directions. Please try again.');
    // _initializeUIState will show error state
  }
}
```

## Testing the Migration

### Step 1: Verify Initialization Order

Add temporary logging to verify correct order:

```javascript
async _preInitialize() {
  console.log('1. _preInitialize');
  await super._preInitialize();
}

async _initializeAdditionalServices() {
  console.log('2. _initializeAdditionalServices (after cache & events)');
  await super._initializeAdditionalServices();
}

async _loadInitialData() {
  console.log('3. _loadInitialData');
  // ...
}

async _initializeUIState() {
  console.log('4. _initializeUIState');
  await super._initializeUIState();
}

async _postInitialize() {
  console.log('5. _postInitialize');
  await super._postInitialize();
}
```

### Step 2: Test Each State

1. **With Data**: Verify shows results state
2. **Empty Data**: Verify shows empty state
3. **Network Error**: Verify shows error state
4. **Slow Loading**: Verify shows loading state

### Step 3: Unit Test Updates

```javascript
describe('Lifecycle Methods', () => {
  it('should load initial data on initialization', async () => {
    const mockDirections = [{ id: 1, name: 'Direction 1' }];
    mockCharacterBuilderService.getAllThematicDirectionsWithConcepts
      .mockResolvedValue(mockDirections);
    
    await controller.initialize();
    
    expect(mockCharacterBuilderService.getAllThematicDirectionsWithConcepts)
      .toHaveBeenCalled();
    expect(controller._getElement('directionsList').children.length)
      .toBe(mockDirections.length);
  });
  
  it('should show empty state when no data', async () => {
    mockCharacterBuilderService.getAllThematicDirectionsWithConcepts
      .mockResolvedValue([]);
    
    await controller.initialize();
    
    expect(mockUIStateManager.setState)
      .toHaveBeenCalledWith(UI_STATES.EMPTY);
  });
});
```

## Migration Checklist

- [ ] Current initialize() analyzed
- [ ] _preInitialize() implemented (if needed)
- [ ] _initializeAdditionalServices() implemented
- [ ] _loadInitialData() implemented
- [ ] _initializeUIState() implemented
- [ ] _postInitialize() implemented
- [ ] Old initialize() method removed
- [ ] Entry point updated (if needed)
- [ ] Error handling preserved
- [ ] Loading states working
- [ ] All initialization logic migrated
- [ ] No duplicate initialization

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`
- [ ] `src/thematicDirectionsManager/thematicDirectionsManagerMain.js` (potentially)

## Files Created

- None

## Definition of Done

- [ ] All lifecycle hooks implemented
- [ ] Old initialize() method removed
- [ ] Initialization order preserved
- [ ] Error handling maintained
- [ ] Loading states shown correctly
- [ ] Empty state shown when no data
- [ ] Results state shown with data
- [ ] All tests pass
- [ ] Manual testing confirms proper initialization
- [ ] No console errors during startup
- [ ] Code committed with descriptive message