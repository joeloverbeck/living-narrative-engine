# Migration Guide: Adopting BaseCharacterBuilderController

## Overview

This guide walks you through migrating existing character builder controllers to extend the new `BaseCharacterBuilderController`. The base controller eliminates ~50% of boilerplate code while ensuring consistent behavior across all character builder pages.

## Benefits of Migration

### Code Reduction

- **Before**: 500-1000 lines per controller
- **After**: 200-400 lines per controller
- **Savings**: 50-60% code reduction

### Consistency Improvements

- Standardized initialization lifecycle
- Consistent error handling
- Unified event management
- Common UI state patterns

### Maintenance Benefits

- Single source of truth for common functionality
- Easier to add new features across all controllers
- Reduced testing burden
- Better error tracking

## Pre-Migration Checklist

Before starting migration, ensure:

- [ ] Current controller has tests (to verify behavior preservation)
- [ ] You understand the controller's specific functionality
- [ ] You have identified custom vs common functionality
- [ ] Backup of current implementation exists
- [ ] Time allocated for testing post-migration
- [ ] **UIStateManager integration**: Your HTML includes required state containers (empty, loading, results, error states)

### UIStateManager Requirements

The BaseCharacterBuilderController integrates with UIStateManager which requires specific DOM structure:

```html
<!-- Required state containers for UIStateManager -->
<div id="empty-state">
  <!-- Empty state content -->
</div>

<div id="loading-state" style="display:none">
  <!-- Loading state content -->
</div>

<div id="results-state" style="display:none">
  <!-- Results display content -->
</div>

<div id="error-state" style="display:none">
  <div class="error-message-text"></div>
</div>
```

**Note**: The `_initializeUIState()` lifecycle method automatically initializes UIStateManager. If these DOM elements are missing, the controller will log warnings but continue to function.

## Migration Process

### Step 1: Analyze Current Controller

Identify these patterns in your existing controller:

1. **Common patterns** (will be replaced):
   - Dependency validation
   - DOM element caching
   - Event listener setup/cleanup
   - State management
   - Error handling

2. **Unique functionality** (will be preserved):
   - Page-specific business logic
   - Custom event handlers
   - Specialized data processing
   - Unique UI behaviors

### Step 2: Create New Controller Structure

```javascript
// BEFORE: MyController.js
export class MyController {
  #logger;
  #characterBuilderService;
  #eventBus;
  #elements = {};
  // ... many more fields

  constructor({ logger, characterBuilderService, eventBus }) {
    // Manual validation
    validateDependency(logger, 'ILogger', ...);
    // ... more validation

    this.#logger = logger;
    // ... assign all dependencies
  }
}

// AFTER: MyController.js
import { BaseCharacterBuilderController } from '../BaseCharacterBuilderController.js';

export class MyController extends BaseCharacterBuilderController {
  // Only page-specific fields needed
  #customData = null;

  constructor(dependencies) {
    super(dependencies); // Base class handles validation

    // Additional services are automatically stored in base class
    // Access them via this.additionalServices.serviceName
  }
}
```

### Step 3: Implement Required Abstract Methods

```javascript
// REQUIRED: Cache DOM elements using _cacheElementsFromMap
_cacheElements() {
  // This method is required by BaseCharacterBuilderController
  // Use the bulk caching method provided by base class
  this._cacheElementsFromMap({
    // Page-specific elements
    form: '#my-form',
    submitBtn: '#submit-btn',
    resultsContainer: '#results',
    // Mark optional elements
    advancedOptions: { selector: '#advanced', required: false },

    // REQUIRED: UIStateManager elements for state transitions
    emptyState: '#empty-state',
    loadingState: '#loading-state',
    resultsState: '#results-state',
    errorState: '#error-state'
  });
}

// REQUIRED: Set up event listeners
_setupEventListeners() {
  // Use base class helper methods
  this._addEventListener('form', 'submit', (e) => {
    e.preventDefault();
    this._handleFormSubmit();
  });

  // Debounced input handler
  this._addDebouncedListener('searchInput', 'input',
    this._handleSearch.bind(this), 300);

  // Application events
  this._subscribeToEvent('DATA_UPDATED', this._refreshDisplay.bind(this));
}
```

### Step 4: Convert Initialization Logic

```javascript
// BEFORE: Complex manual initialization
async initialize() {
  try {
    this.#cacheElements();
    await this.#characterBuilderService.initialize();
    this.#setupEventListeners();
    await this.#loadData();
    this.#showEmptyState();
  } catch (error) {
    console.error('Init failed', error);
    this.#showError('Failed to initialize');
  }
}

// AFTER: Override specific lifecycle hooks
// Available lifecycle methods (in order of execution):

async _preInitialize() {
  // Called before any initialization
  // Use for early setup, parameter validation
}

async _initializeServices() {
  // Called after element caching but before event listeners
  // Use for service initialization that depends on DOM elements
  await this.characterBuilderService.initialize();
}

async _loadInitialData() {
  // Called after event listeners are set up
  // Use for loading page-specific data
  const data = await this.characterBuilderService.getData();
  this._processData(data);
}

async _postInitialize() {
  // Called after all initialization is complete
  // Use for final setup, analytics, etc.
}

async _initializeUIState() {
  // Base class automatically initializes UIStateManager
  // Override to set initial state based on your data
  if (this._hasData()) {
    this._showState('results');
  } else {
    this._showState('empty');
  }
}
```

### Step 5: Update Field Access Patterns

```javascript
// BEFORE: Private fields with #
#handleClick() {
  this.#elements.button.disabled = true;
  this.#logger.info('Button clicked');
}

// AFTER: Use getter methods for base class fields
_handleClick() {
  // Note: 'button' must be cached in _cacheElements() first
  this._setElementEnabled('button', false);
  this.logger.info('Button clicked');
}
```

### Step 6: Migrate Event Handlers

```javascript
// BEFORE: Manual event management
#setupEventListeners() {
  this.#elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    this.#handleSubmit();
  });

  // Manual cleanup tracking
  this.#eventCleanup.push(() => {
    this.#elements.form.removeEventListener('submit', ...);
  });
}

// AFTER: Automatic cleanup
_setupEventListeners() {
  this._addEventListener('form', 'submit', (e) => {
    this._preventDefault(e, () => this._handleSubmit());
  });
  // Cleanup is automatic!
}
```

### Step 7: Update State Management

```javascript
// BEFORE: Manual state management
#showLoading() {
  this.#elements.emptyState.style.display = 'none';
  this.#elements.errorState.style.display = 'none';
  this.#elements.loadingState.style.display = 'block';
  this.#elements.submitBtn.disabled = true;
}

// AFTER: Use base class methods
_startOperation() {
  this._showLoading('Processing...');
  // Form controls disabled automatically
}
```

### Step 8: Migrate Error Handling

```javascript
// BEFORE: Inconsistent error handling
catch (error) {
  console.error('Operation failed', error);
  this.#elements.errorText.textContent = 'Something went wrong';
  this.#showErrorState();
}

// AFTER: Standardized error handling
catch (error) {
  this._handleServiceError(
    error,
    'data loading',
    'Failed to load data. Please try again.'
  );
}

// Or with retry logic
const data = await this._executeWithErrorHandling(
  () => this.characterBuilderService.getData(),
  'loadData',
  { retries: 3, userErrorMessage: 'Unable to load data' }
);
```

## Common Pitfalls and Solutions

### Pitfall 1: Accessing Private Base Class Fields

```javascript
// ❌ WRONG: Can't access private fields
this.#logger.info('Message'); // Error!

// ✅ CORRECT: Use getter methods for base class fields
this.logger.info('Message');
```

### Pitfall 2: Overriding Wrong Methods

```javascript
// ❌ WRONG: Don't override template method
async initialize() {
  // This breaks the lifecycle!
}

// ✅ CORRECT: Override lifecycle hooks
async _postInitialize() {
  // Custom initialization logic
}
```

### Pitfall 3: Manual Cleanup

```javascript
// ❌ WRONG: Manual event listener removal
destroy() {
  this.#elements.btn.removeEventListener('click', this.#handler);
}

// ✅ CORRECT: Base class handles cleanup
// No need to override destroy() for basic cleanup
```

### Pitfall 4: Direct DOM Manipulation

```javascript
// ❌ WRONG: Direct style manipulation
this._elements.error.style.display = 'block';

// ✅ CORRECT: Use base class utilities
this._showElement('error');
// or
this._showState('error');
```

## Testing Migrated Controllers

### Update Test Structure

```javascript
// BEFORE: Complex test setup
describe('MyController', () => {
  let controller;
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMocks();
    controller = new MyController(mockDeps);
    setupDOM();
  });
});

// AFTER: Use test base class
import { BaseCharacterBuilderControllerTestBase } from '../../../../tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';

describe('MyController', () => {
  let testBase;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Create controller instance using dependencies from testBase
    testBase.controller = new MyController(testBase.mockDependencies);
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  it('should initialize correctly', async () => {
    await testBase.controller.initialize();
    expect(testBase.controller.isInitialized).toBe(true);
  });
});
```

### Verify Behavior Preservation

Create tests that verify the migration didn't break functionality:

```javascript
it('should maintain original behavior after migration', async () => {
  // Test specific business logic
  await testBase.controller.initialize();

  // Simulate user action
  testBase.submitForm('#my-form', { name: 'Test' });

  // Verify expected behavior
  expect(mockService.saveData).toHaveBeenCalledWith({ name: 'Test' });
});
```

## Performance Comparison

### Metrics to Track

```javascript
// Add performance logging during migration
async _postInitialize() {
  console.log(`Init time: ${performance.now() - this._initStartTime}ms`);
}
```

### Expected Performance Impact

- **Initialization**: +2-5ms overhead (acceptable)
- **Memory**: -10-20% due to shared prototype methods
- **Event handling**: Improved due to optimized delegation

## Rollback Plan

If issues arise post-migration:

1. **Immediate**: Revert to previous implementation
2. **Debug**: Use enhanced logging in base controller
3. **Gradual**: Migrate one method at a time
4. **Test**: Ensure comprehensive test coverage

## Migration Checklist

- [ ] Analyze current controller structure
- [ ] Create backup of current implementation
- [ ] Extend BaseCharacterBuilderController
- [ ] Implement `_cacheElements()`
- [ ] Implement `_setupEventListeners()`
- [ ] Migrate initialization logic to lifecycle hooks
- [ ] Update field access patterns (`_` instead of `#`)
- [ ] Convert error handling to base methods
- [ ] Update state management calls
- [ ] Remove redundant cleanup code
- [ ] Update tests to use test base
- [ ] Run all tests
- [ ] Verify UI functionality manually
- [ ] Check performance metrics
- [ ] Document any custom patterns

## Real-World Example Patterns

### Current Controller Pattern (ThematicDirectionController)

Here's how existing controllers implement common patterns that you'll migrate:

```javascript
// Current element caching pattern
#cacheElements() {
  // Form elements
  this.#elements.form = document.getElementById('concept-form');
  this.#elements.conceptSelector = document.getElementById('concept-selector');

  // State containers - these will map to UIStateManager elements
  this.#elements.emptyState = document.getElementById('empty-state');
  this.#elements.loadingState = document.getElementById('loading-state');
  this.#elements.errorState = document.getElementById('error-state');
  this.#elements.resultsState = document.getElementById('results-state');

  // Error display
  this.#elements.errorMessageText = document.getElementById('error-message-text');
}

// Current initialization pattern
async initialize() {
  try {
    this.#cacheElements();
    await this.#characterBuilderService.initialize();
    await this.#loadCharacterConcepts();
    this.#setupEventListeners();
    this.#showState(UI_STATES.EMPTY);
  } catch (error) {
    this.#showError('Failed to initialize...');
  }
}
```

### After Migration to BaseCharacterBuilderController

```javascript
// Migrated element caching
_cacheElements() {
  this._cacheElementsFromMap({
    // Page-specific elements
    form: '#concept-form',
    conceptSelector: '#concept-selector',

    // Required UIStateManager elements
    emptyState: '#empty-state',
    loadingState: '#loading-state',
    errorState: '#error-state',
    resultsState: '#results-state'
  });
}

// Migrated initialization using lifecycle hooks
async _initializeServices() {
  await this.characterBuilderService.initialize();
}

async _loadInitialData() {
  await this._loadCharacterConcepts();
}

async _initializeUIState() {
  this._showState('empty');
}
```

## Next Steps

1. See [Complete Migration Example](examples/thematic-direction-migration.md) for a real-world implementation
2. Use [Quick Reference Card](base-controller-quick-reference.md) for daily development
3. Run tests continuously during migration
4. Document any unique patterns for future reference
