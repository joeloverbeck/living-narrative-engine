# THEDIRMIG-006: Migrate Lifecycle Methods to Base Controller Hooks

## Overview

Migrate the existing initialization and lifecycle methods to use the BaseCharacterBuilderController's lifecycle hooks. This includes implementing methods like `_loadInitialData()`, `_initializeUIState()`, `_initializeAdditionalServices()`, and `_postInitialize()` to replace the current custom initialization flow.

**IMPORTANT**: This workflow addresses a critical missing dependency issue - UIStateManager is not currently being passed to the controller but is expected by the base class.

## Priority

**HIGH** - Core functionality migration with dependency fix

## Dependencies

- **Blocked by**: THEDIRMIG-005 (event listeners setup)
- **Blocks**: THEDIRMIG-007, THEDIRMIG-008 (component initialization)
- **Enables**: THEDIRMIG-010 (state management)

## Acceptance Criteria

- [ ] UIStateManager dependency properly registered and passed to controller
- [ ] Current initialize() method removed (not overridden)
- [ ] Data loading moved to \_loadInitialData()
- [ ] UI state initialization in \_initializeUIState()
- [ ] Additional services setup in \_initializeAdditionalServices()
- [ ] Initialization order preserved
- [ ] No duplicate initialization
- [ ] Error handling maintained
- [ ] Loading states shown at appropriate times
- [ ] Base class initialize() method used

## Implementation Steps

### Key Implementation Notes

1. **DO NOT override initialize()** - The base class provides the correct implementation
2. **UIStateManager must be passed** - It's currently missing from the DI registration
3. **Preserve existing logic** - Move code from current initialize() to appropriate hooks
4. **Use base class utilities** - The base class provides error handling, state management, etc.

### Step 1: Fix Missing UIStateManager Dependency

**Critical Issue**: UIStateManager is expected by the controller but not provided in thematicDirectionsManagerMain.js

Add UIStateManager to the DI container registration:

```javascript
// In thematicDirectionsManagerMain.js
#registerController(container) {
  const registrar = new Registrar(container);
  
  // First create UIStateManager instance
  registrar.singletonFactory(
    Symbol('UIStateManager'), // or add to tokens.js
    (c) => {
      // UIStateManager will be initialized by the base controller
      // using _initializeUIStateManager() method
      return new UIStateManager();
    }
  );
  
  registrar.singletonFactory(
    tokens.ThematicDirectionsManagerController,
    (c) => {
      return new ThematicDirectionsManagerController({
        logger: c.resolve(tokens.ILogger),
        characterBuilderService: c.resolve(tokens.CharacterBuilderService),
        eventBus: c.resolve(tokens.ISafeEventDispatcher),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        uiStateManager: c.resolve(Symbol('UIStateManager')), // ADD THIS LINE
      });
    }
  );
}
```

### Step 2: Analyze Current Initialization Flow

The current initialize() method in the controller:

1. Caches DOM elements (via `_cacheElements()`)
2. Initializes concept dropdown 
3. Initializes characterBuilderService
4. Sets up event listeners (via `_setupEventListeners()`)
5. Loads directions data
6. Handles errors

**Note**: The current method completely overrides the base class initialize(), which prevents lifecycle hooks from running.

### Step 3: Map to Base Controller Lifecycle

Base controller lifecycle order (from BaseCharacterBuilderController):

1. `constructor()` - Basic field initialization
2. `initialize()` - Base class method (calls hooks in order):
   - `_preInitialize()` - Pre-initialization setup
   - `_cacheElements()` - Cache DOM elements (already implemented)
   - `_setupEventListeners()` - Setup events (already implemented)
   - `_initializeAdditionalServices()` - Initialize services/components
   - `_loadInitialData()` - Load page data
   - `_initializeUIState()` - Setup UI state (calls `_initializeUIStateManager()`)
   - `_postInitialize()` - Final setup

**Current vs Target Mapping**:
- Concept dropdown init → `_initializeAdditionalServices()`
- characterBuilderService.initialize() → `_initializeAdditionalServices()`
- loadDirectionsData() → `_loadInitialData()`
- UI state setup → `_initializeUIState()`

### Step 4: Implement \_preInitialize() (Optional)

This hook is optional for early setup before DOM caching:

```javascript
/**
 * Pre-initialization setup
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _preInitialize() {
  await super._preInitialize();

  // Initialize any early state that doesn't depend on DOM
  this.#currentFilter = '';
  this.#currentConcept = null;
  this.#directionsData = [];

  this.logger.debug('ThematicDirectionsManager: Pre-initialization complete');
}
```

**Note**: Most initialization is already handled in the constructor.

### Step 5: Implement \_initializeAdditionalServices()

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

  // Initialize concept dropdown (moved from initialize())
  this.#conceptDropdown = new PreviousItemsDropdown({
    element: this._getElement('conceptSelector'), // Note: actual element ID
    onSelectionChange: this.#handleConceptSelection.bind(this),
    labelText: 'Choose Concept:',
  });

  // Initialize characterBuilderService (moved from initialize())
  await this.characterBuilderService.initialize();

  this.logger.debug('Additional services initialized');
}
```

**Note**: The concept dropdown initialization is moved here from the current `initialize()` method.

### Step 6: Implement \_loadInitialData()

Move the data loading logic from `#loadDirectionsData()`:

```javascript
/**
 * Load initial page data
 * @protected
 * @override
 * @returns {Promise<void>}
 */
async _loadInitialData() {
  // Delegate to existing method for now (to minimize changes)
  await this.#loadDirectionsData();
}

// OR implement inline (moving code from #loadDirectionsData):
async _loadInitialData() {
  this.#uiStateManager.showState(UI_STATES.LOADING);

  try {
    // Load all directions with their concepts
    const directionsWithConcepts =
      await this.characterBuilderService.getAllThematicDirectionsWithConcepts();

    // Extract unique concepts that have associated directions
    const conceptsWithDirections = this.#extractConceptsWithDirections(
      directionsWithConcepts
    );

    // Update dropdown with filtered concepts
    await this.#conceptDropdown.loadItems(conceptsWithDirections);

    // Store data
    this.#directionsData = directionsWithConcepts;

    // Update stats
    this.#updateStats();

    this.logger.info(
      'ThematicDirectionsManagerController: Loaded directions data',
      {
        directionCount: this.#directionsData.length,
        conceptsWithDirections: conceptsWithDirections.length,
      }
    );
  } catch (error) {
    this.logger.error(
      'ThematicDirectionsManagerController: Failed to load directions',
      error
    );
    // Don't throw - let _initializeUIState handle error display
  }
}
```

### Step 7: Implement \_initializeUIState()

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

  // Display directions and determine appropriate state
  // (moved from #loadDirectionsData)
  this.#filterAndDisplayDirections();
  
  // Note: #filterAndDisplayDirections already handles:
  // - Showing EMPTY state if no data
  // - Showing RESULTS state if data exists
  // - Displaying the directions
}
```

**Note**: The base class `_initializeUIState()` will call `_initializeUIStateManager()` which properly sets up the UIStateManager with DOM elements.

### Step 8: Implement \_postInitialize()

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

  // Log successful initialization (moved from initialize())
  this.logger.info(
    'ThematicDirectionsManagerController: Successfully initialized'
  );
  
  // Any other post-initialization tasks can be added here
  // For example: focus management, analytics tracking, etc.
}
```

**Note**: Keep this simple for now. Additional functionality can be added as needed.

### Step 9: Remove Old Initialize Method

After implementing all lifecycle hooks, remove the old method entirely:

```javascript
// DELETE this entire method from thematicDirectionsManagerController.js:
async initialize() {
  try {
    // Cache DOM elements using base class method
    this._cacheElements();

    // Initialize concept dropdown
    this.#conceptDropdown = new PreviousItemsDropdown({
      element: this._getElement('conceptSelector'),
      onSelectionChange: this.#handleConceptSelection.bind(this),
      labelText: 'Choose Concept:',
    });

    // Initialize service
    await this.characterBuilderService.initialize();

    // Set up event listeners using the base class helper method
    this._setupEventListeners();

    // Load initial data
    await this.#loadDirectionsData();

    this.logger.info(
      'ThematicDirectionsManagerController: Successfully initialized'
    );
  } catch (error) {
    this.logger.error(
      'ThematicDirectionsManagerController: Failed to initialize',
      error
    );
    if (this.#uiStateManager) {
      this.#uiStateManager.showError(
        'Failed to initialize directions manager. Please refresh the page.'
      );
    }
  }
}
```

**IMPORTANT**: Do NOT override initialize(). Let the base class handle it.

### Step 10: Update Entry Point

The entry point stays the same, but ensure UIStateManager is passed:

```javascript
// In thematicDirectionsManagerMain.js
#registerController(container) {
  const registrar = new Registrar(container);
  
  // Register UIStateManager (NEW)
  registrar.singletonFactory(
    Symbol('UIStateManager'), // TODO: Add to tokens.js
    () => new UIStateManager()
  );
  
  registrar.singletonFactory(
    tokens.ThematicDirectionsManagerController,
    (c) => {
      return new ThematicDirectionsManagerController({
        logger: c.resolve(tokens.ILogger),
        characterBuilderService: c.resolve(tokens.CharacterBuilderService),
        eventBus: c.resolve(tokens.ISafeEventDispatcher),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        uiStateManager: c.resolve(Symbol('UIStateManager')), // ADD THIS
      });
    }
  );
}

// Controller initialization remains the same:
await this.#controller.initialize(); // Now calls base class initialize()
```

## Error Handling Patterns

### Current Error Handling

The existing error handling in `#loadDirectionsData()` should be preserved:

```javascript
async _loadInitialData() {
  try {
    // ... loading logic
  } catch (error) {
    this.logger.error(
      'ThematicDirectionsManagerController: Failed to load directions',
      error
    );
    this.#uiStateManager.showError(
      'Failed to load thematic directions. Please try again.'
    );
  }
}
```

### Using Base Class Error Methods

The base class provides `_executeWithErrorHandling()` for more sophisticated error handling:

```javascript
async _loadInitialData() {
  const data = await this._executeWithErrorHandling(
    async () => {
      return await this.characterBuilderService.getAllThematicDirectionsWithConcepts();
    },
    'load thematic directions',
    {
      retries: 2,
      userErrorMessage: 'Failed to load thematic directions. Please try again.'
    }
  );
  
  if (data) {
    this.#directionsData = data;
    // ... rest of processing
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
    mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      mockDirections
    );

    await controller.initialize();

    expect(
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts
    ).toHaveBeenCalled();
    expect(controller._getElement('directionsList').children.length).toBe(
      mockDirections.length
    );
  });

  it('should show empty state when no data', async () => {
    mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      []
    );

    await controller.initialize();

    expect(mockUIStateManager.setState).toHaveBeenCalledWith(UI_STATES.EMPTY);
  });
});
```

## Migration Checklist

- [ ] UIStateManager dependency added to thematicDirectionsManagerMain.js
- [ ] Current initialize() method analyzed
- [ ] \_preInitialize() implemented (if needed)
- [ ] \_initializeAdditionalServices() implemented
- [ ] \_loadInitialData() implemented
- [ ] \_initializeUIState() implemented
- [ ] \_postInitialize() implemented
- [ ] Old initialize() method removed (not overridden)
- [ ] Entry point updated to pass UIStateManager
- [ ] Error handling preserved
- [ ] Loading states working
- [ ] All initialization logic migrated
- [ ] No duplicate initialization

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`
- [ ] `src/thematicDirectionsManager/thematicDirectionsManagerMain.js` (REQUIRED for UIStateManager)

## Files Created

- None

## Troubleshooting Common Issues

### Issue 1: "Cannot read property 'showState' of undefined"

**Cause**: UIStateManager is not being passed to the controller constructor.

**Solution**: 
1. Add UIStateManager registration in thematicDirectionsManagerMain.js
2. Pass it in the controller constructor dependencies
3. Ensure the base class `_initializeUIState()` is called

### Issue 2: "#uiStateManager is private" errors

**Cause**: Trying to access private field from base class.

**Solution**: Use the getter `this.#uiStateManager` in the controller (already implemented) or use the base class methods like `_showState()`.

### Issue 3: Initialization happens twice

**Cause**: Both the controller and base class have initialize() methods.

**Solution**: Remove the initialize() override completely. Let the base class handle it.

### Issue 4: DOM elements not cached

**Cause**: _cacheElements() is called at the wrong time.

**Solution**: The base class calls it automatically. Ensure you're not overriding initialize().

### Issue 5: Event listeners not working

**Cause**: _setupEventListeners() called before DOM caching.

**Solution**: The base class handles the correct order. Don't override initialize().

## Definition of Done

- [ ] UIStateManager dependency properly registered and passed
- [ ] All lifecycle hooks implemented
- [ ] Old initialize() method removed completely
- [ ] Base class initialize() method used
- [ ] Initialization order preserved
- [ ] Error handling maintained
- [ ] Loading states shown correctly
- [ ] Empty state shown when no data
- [ ] Results state shown with data
- [ ] All tests pass
- [ ] Manual testing confirms proper initialization
- [ ] No console errors during startup
- [ ] Code committed with descriptive message
