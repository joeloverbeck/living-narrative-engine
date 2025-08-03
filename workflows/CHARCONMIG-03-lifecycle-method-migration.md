# CHARCONMIG-03: Lifecycle Method Migration

## Overview

Migrate the controller's initialization logic from a monolithic `initialize()` method to the BaseCharacterBuilderController's structured lifecycle hooks. This migration enables better separation of concerns, automatic dependency management, and consistent initialization patterns across all character builder controllers.

## Priority

**High** - Core architecture migration that enables proper base class integration and initialization patterns.

## Dependencies

- CHARCONMIG-01: Structural Foundation Setup (completed)
- CHARCONMIG-02: Abstract Method Implementation (completed)

## Estimated Effort

**7 hours** - Complex initialization refactoring with comprehensive testing and validation

## Acceptance Criteria

1. ✅ Monolithic `initialize()` method replaced with lifecycle hooks
2. ✅ `_initializeServices()` hook implemented for cross-tab sync setup
3. ✅ `_loadInitialData()` hook implemented for concepts data loading
4. ✅ `_initializeUIState()` hook implemented for UI state configuration
5. ✅ `_postInitialize()` hook implemented for advanced features
6. ✅ All existing functionality preserved identically
7. ✅ Service initialization automated through base class
8. ✅ UIStateManager integration automated through base class
9. ✅ Initialization order maintained correctly
10. ✅ Error handling improved through lifecycle management

## Current Initialization Pattern Analysis

### Existing `initialize()` Method (150+ lines)

```javascript
async initialize() {
  try {
    // Step 1: Element caching (40+ lines) - now handled by CHARCONMIG-02
    this.#cacheElements();

    // Step 2: UIStateManager initialization (20+ lines)
    await this.#initializeUIStateManager();

    // Step 3: Service initialization (15+ lines)
    await this.#initializeService();

    // Step 4: Event listener setup (60+ lines) - now handled by CHARCONMIG-02
    this.#setupEventListeners();

    // Step 5: Advanced feature setup (25+ lines)
    this.#setupKeyboardShortcuts();
    this.#restoreSearchState();

    // Step 6: Data loading (30+ lines)
    await this.#loadConceptsData();

    // Step 7: Cross-tab synchronization (20+ lines)
    this.#initializeCrossTabSync();

    // Step 8: Final state setup (10+ lines)
    this.#isInitialized = true;
    this.#logger.info('CharacterConceptsManagerController initialized successfully');

  } catch (error) {
    this.#logger.error('Failed to initialize CharacterConceptsManagerController', error);
    this.#showError('Failed to initialize the character concepts manager');
    throw error;
  }
}
```

### Target Lifecycle Hook Implementation

The base class provides structured lifecycle hooks that are called automatically in the correct order:

```javascript
// Base class initialization sequence:
// 1. constructor() - dependency injection
// 2. _preInitialize() - optional pre-setup
// 3. _cacheElements() - DOM element caching (CHARCONMIG-02)
// 4. _initializeServices() - service setup beyond characterBuilderService
// 5. _setupEventListeners() - event listener setup (CHARCONMIG-02)
// 6. _loadInitialData() - page-specific data loading
// 7. _initializeUIState() - UI state configuration
// 8. _postInitialize() - final setup and advanced features
```

## Implementation Steps

### Step 1: Remove Monolithic Initialize Method

**Duration:** 1 hour

**Current Structure:**

```javascript
async initialize() {
  // 150+ lines of initialization logic
}
```

**Target Structure:**

```javascript
// Remove entire initialize() method
// Base class handles initialization orchestration automatically
```

**Implementation:**

1. **Backup Current Logic**: Copy all initialization logic to separate staging methods
2. **Remove Method**: Delete the entire `initialize()` method
3. **Verify Calls**: Remove any explicit calls to `initialize()` in tests or other code
4. **Update JSDoc**: Remove initialization-related documentation

**Validation:**

- No `initialize()` method exists in the controller
- Base class initialization takes over automatically
- No explicit initialization calls remain

### Step 2: Implement `_initializeServices()` Hook

**Duration:** 1.5 hours

**Current Service Initialization:**

```javascript
async #initializeService() {
  try {
    this.#logger.debug('Initializing CharacterBuilderService...');
    await this.#characterBuilderService.initialize();
    this.#logger.debug('CharacterBuilderService initialized successfully');
  } catch (error) {
    this.#logger.error('Failed to initialize CharacterBuilderService', error);
    throw new Error('Service initialization failed');
  }
}

#initializeCrossTabSync() {
  // Cross-tab synchronization setup
  this.#tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create broadcast channel for cross-tab communication
  this.#syncChannel = new BroadcastChannel('character-concepts-sync');
  this.#syncChannel.addEventListener('message', this.#handleCrossTabMessage.bind(this));

  // Set up leader election
  this.#startLeaderElection();

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    this.#cleanupCrossTabSync();
  });
}
```

**Target Implementation:**

```javascript
/**
 * Initialize services beyond characterBuilderService
 * Base class automatically initializes characterBuilderService
 * @protected
 */
async _initializeServices() {
  await super._initializeServices(); // Initializes characterBuilderService

  // Page-specific service initialization
  this._initializeCrossTabSync();
}

/**
 * Initialize cross-tab synchronization
 * @private
 */
_initializeCrossTabSync() {
  // Tab identification
  this.#tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create broadcast channel for cross-tab communication
  this.#syncChannel = new BroadcastChannel('character-concepts-sync');
  this.#syncChannel.addEventListener('message', this._handleCrossTabMessage.bind(this));

  // Set up leader election
  this._startLeaderElection();

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    this._cleanupCrossTabSync();
  });

  this.logger.debug('Cross-tab synchronization initialized');
}
```

**Implementation Details:**

1. **Base Class Integration**: Call `super._initializeServices()` to handle characterBuilderService
2. **Cross-Tab Setup**: Move cross-tab initialization to this hook
3. **Error Handling**: Leverage base class error handling patterns
4. **Logging**: Use base class logger property

**Validation:**

- CharacterBuilderService initialized by base class
- Cross-tab sync properly initialized
- Error handling works correctly
- Proper initialization order maintained

### Step 3: Implement `_loadInitialData()` Hook

**Duration:** 2 hours

**Current Data Loading:**

```javascript
async #loadConceptsData() {
  try {
    this.#showLoading('Loading character concepts...');

    const concepts = await this.#characterBuilderService.getAllCharacterConcepts();

    if (!Array.isArray(concepts)) {
      throw new Error('Invalid concepts data received');
    }

    this.#conceptsData = concepts;
    this.#updateStatistics();
    this.#renderConcepts();

    if (concepts.length > 0) {
      this.#showResults();
    } else {
      this.#showEmpty();
    }

    this.#logger.info(`Loaded ${concepts.length} character concepts`);

  } catch (error) {
    this.#logger.error('Failed to load concepts data', error);
    this.#showError('Failed to load character concepts. Please try again.');
    throw error;
  }
}

#restoreSearchState() {
  // Restore search state from session storage
  const savedSearchFilter = sessionStorage.getItem('conceptsSearchFilter');
  if (savedSearchFilter) {
    this.#searchFilter = savedSearchFilter;
    if (this.#elements.conceptSearch) {
      this.#elements.conceptSearch.value = savedSearchFilter;
      this.#applySearchFilter();
    }
  }

  // Restore scroll position
  const savedScrollPosition = sessionStorage.getItem('conceptsScrollPosition');
  if (savedScrollPosition) {
    setTimeout(() => {
      window.scrollTo(0, parseInt(savedScrollPosition, 10));
    }, 100);
  }
}
```

**Target Implementation:**

```javascript
/**
 * Load initial data for the page
 * @protected
 */
async _loadInitialData() {
  // Load concepts data
  await this._loadConceptsData();

  // Restore session state
  this._restoreSearchState();
}

/**
 * Load character concepts data
 * @private
 */
async _loadConceptsData() {
  try {
    this._showLoading('Loading character concepts...');

    // Use base class error handling with retry capability
    const concepts = await this._executeWithErrorHandling(
      () => this.characterBuilderService.getAllCharacterConcepts(),
      'load character concepts',
      {
        retries: 2,
        userErrorMessage: 'Failed to load character concepts. Please try again.'
      }
    );

    if (!Array.isArray(concepts)) {
      throw new Error('Invalid concepts data received');
    }

    this.#conceptsData = concepts;
    this._updateStatistics();
    this._renderConcepts();

    this.logger.info(`Loaded ${concepts.length} character concepts`);

  } catch (error) {
    // Error handling is managed by _executeWithErrorHandling
    throw error;
  }
}

/**
 * Restore search and UI state from session storage
 * @private
 */
_restoreSearchState() {
  // Restore search filter
  const savedSearchFilter = sessionStorage.getItem('conceptsSearchFilter');
  if (savedSearchFilter) {
    this.#searchFilter = savedSearchFilter;
    const searchInput = this._getElement('conceptSearch');
    if (searchInput) {
      searchInput.value = savedSearchFilter;
      this._applySearchFilter();
    }
  }

  // Restore scroll position
  const savedScrollPosition = sessionStorage.getItem('conceptsScrollPosition');
  if (savedScrollPosition) {
    setTimeout(() => {
      window.scrollTo(0, parseInt(savedScrollPosition, 10));
    }, 100);
  }

  this.logger.debug('Search state restored from session storage');
}
```

**Implementation Details:**

1. **Error Handling**: Use base class `_executeWithErrorHandling()` with retry logic
2. **Element Access**: Use base class `_getElement()` method
3. **State Management**: Leverage base class state management methods
4. **Logging**: Use base class logger property

**Validation:**

- Concepts data loads correctly
- Search state restoration works
- Error handling includes retry logic
- State transitions work properly

### Step 4: Implement `_initializeUIState()` Hook

**Duration:** 1.5 hours

**Current UI State Initialization:**

```javascript
async #initializeUIStateManager() {
  try {
    // Import UIStateManager
    const { UIStateManager } = await import('../ui/UIStateManager.js');

    // Initialize state manager with required elements
    this.#uiStateManager = new UIStateManager({
      stateContainer: this.#elements.conceptsContainer,
      states: {
        empty: {
          element: this.#elements.emptyState,
          cssClass: 'cb-empty-state'
        },
        loading: {
          element: this.#elements.loadingState,
          cssClass: 'cb-loading-state'
        },
        error: {
          element: this.#elements.errorState,
          cssClass: 'cb-error-state'
        },
        results: {
          element: this.#elements.resultsState,
          cssClass: 'cb-content-container'
        }
      },
      initialState: 'loading'
    });

    this.#logger.debug('UIStateManager initialized successfully');

  } catch (error) {
    this.#logger.error('Failed to initialize UIStateManager', error);
    throw new Error('UI state management initialization failed');
  }
}
```

**Target Implementation:**

```javascript
/**
 * Initialize UI state configuration
 * Base class handles UIStateManager creation automatically
 * @protected
 */
async _initializeUIState() {
  await super._initializeUIState(); // Base class handles UIStateManager setup

  // Set initial state based on data
  if (this.#conceptsData && this.#conceptsData.length > 0) {
    this._showState('results');
  } else {
    this._showState('empty');
  }

  this.logger.debug('UI state initialized');
}
```

**Implementation Details:**

1. **Base Class Integration**: Call `super._initializeUIState()` for automatic UIStateManager setup
2. **Data-Driven State**: Set initial state based on loaded data
3. **State Management**: Use base class state management methods
4. **Simplified Logic**: Remove manual UIStateManager configuration

**Validation:**

- UIStateManager configured by base class
- Initial state set correctly based on data
- State transitions work properly
- No manual UIStateManager code remaining

### Step 5: Implement `_postInitialize()` Hook

**Duration:** 1 hour

**Current Advanced Feature Setup:**

```javascript
#setupKeyboardShortcuts() {
  // Set up keyboard shortcuts for common actions
  document.addEventListener('keydown', (e) => {
    // Ctrl+N or Cmd+N: Create new concept
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this.#showCreateModal();
    }

    // Escape: Close any open modal
    if (e.key === 'Escape') {
      if (this.#elements.conceptModal.style.display !== 'none') {
        this.#closeConceptModal();
      }
      if (this.#elements.deleteModal.style.display !== 'none') {
        this.#closeDeleteModal();
      }
    }

    // Ctrl+F or Cmd+F: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      this.#elements.conceptSearch.focus();
    }
  });

  this.#logger.debug('Keyboard shortcuts initialized');
}
```

**Target Implementation:**

```javascript
/**
 * Final setup after all initialization complete
 * @protected
 */
async _postInitialize() {
  // Set up advanced features
  this._setupKeyboardShortcuts();
  this._registerPageUnloadHandler();

  // Mark as fully initialized
  this.#isInitialized = true;
  this.logger.info('CharacterConceptsManagerController fully initialized');
}

/**
 * Set up keyboard shortcuts for common actions
 * @private
 */
_setupKeyboardShortcuts() {
  // Use base class event management for keyboard shortcuts
  this._addEventListener('document', 'keydown', (e) => {
    // Ctrl+N or Cmd+N: Create new concept
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      this._showCreateModal();
    }

    // Escape: Close any open modal
    if (e.key === 'Escape') {
      const conceptModal = this._getElement('conceptModal');
      const deleteModal = this._getElement('deleteConfirmationModal');

      if (conceptModal && conceptModal.style.display !== 'none') {
        this._closeConceptModal();
      }
      if (deleteModal && deleteModal.style.display !== 'none') {
        this._closeDeleteModal();
      }
    }

    // Ctrl+F or Cmd+F: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const searchInput = this._getElement('conceptSearch');
      if (searchInput) {
        searchInput.focus();
      }
    }
  });

  this.logger.debug('Keyboard shortcuts initialized');
}

/**
 * Register page unload handler for cleanup
 * @private
 */
_registerPageUnloadHandler() {
  // Save search state on page unload
  this._addEventListener('window', 'beforeunload', () => {
    // Save current search filter
    if (this.#searchFilter) {
      sessionStorage.setItem('conceptsSearchFilter', this.#searchFilter);
    }

    // Save scroll position
    sessionStorage.setItem('conceptsScrollPosition', window.scrollY.toString());

    // Clean up cross-tab sync
    this._cleanupCrossTabSync();
  });
}
```

**Implementation Details:**

1. **Advanced Features**: Set up keyboard shortcuts and page unload handling
2. **Element Access**: Use base class element access methods
3. **Event Management**: Use base class event management for global events
4. **State Persistence**: Save session state for restoration
5. **Cleanup Registration**: Ensure proper cleanup on page unload

**Validation:**

- Keyboard shortcuts work correctly
- Page unload handling preserves state
- All advanced features functional
- Proper cleanup on page exit

## Lifecycle Hook Dependencies and Order

### Base Class Initialization Sequence

```javascript
// 1. constructor() - CHARCONMIG-01 (completed)
super(dependencies);

// 2. _preInitialize() - Optional, not needed for this controller

// 3. _cacheElements() - CHARCONMIG-02 (completed)
this._cacheElementsFromMap({...});

// 4. _initializeServices() - CHARCONMIG-03
await this._initializeServices();

// 5. _setupEventListeners() - CHARCONMIG-02 (completed)
this._setupEventListeners();

// 6. _loadInitialData() - CHARCONMIG-03
await this._loadInitialData();

// 7. _initializeUIState() - CHARCONMIG-03
await this._initializeUIState();

// 8. _postInitialize() - CHARCONMIG-03
await this._postInitialize();
```

### Data Flow Between Hooks

```javascript
// Service initialization provides dependencies for data loading
_initializeServices() → characterBuilderService available

// Data loading populates data for UI state decisions
_loadInitialData() → this.#conceptsData populated

// UI state initialization uses loaded data to set initial state
_initializeUIState() → uses this.#conceptsData to determine initial state

// Post-initialization sets up advanced features that depend on everything else
_postInitialize() → keyboard shortcuts, state persistence, cleanup handlers
```

## Code Reduction Analysis

### Quantitative Reduction

| Category                         | Before (Lines) | After (Lines) | Reduction | Savings   |
| -------------------------------- | -------------- | ------------- | --------- | --------- |
| **Monolithic initialize()**      | 150            | 0             | 100%      | 150 lines |
| **Manual service init**          | 25             | 5             | 80%       | 20 lines  |
| **Manual UIStateManager**        | 30             | 5             | 83%       | 25 lines  |
| **Manual error handling**        | 40             | 10            | 75%       | 30 lines  |
| **Initialization orchestration** | 20             | 0             | 100%      | 20 lines  |

**Total Code Reduction**: **245 lines (85% reduction in initialization code)**

### Qualitative Improvements

**Before Migration:**

```javascript
// ❌ Manual initialization orchestration
async initialize() {
  try {
    this.#cacheElements();
    await this.#initializeUIStateManager();
    await this.#initializeService();
    this.#setupEventListeners();
    // ... complex manual sequence
  } catch (error) {
    // Manual error handling
  }
}

// ❌ Manual service initialization with error handling
async #initializeService() {
  try {
    await this.#characterBuilderService.initialize();
  } catch (error) {
    this.#logger.error('Service failed', error);
    throw new Error('Service initialization failed');
  }
}
```

**After Migration:**

```javascript
// ✅ Automatic initialization orchestration by base class
// ✅ Structured lifecycle hooks with clear separation of concerns

async _initializeServices() {
  await super._initializeServices(); // Automatic service handling
  this._initializeCrossTabSync();    // Page-specific services
}

async _loadInitialData() {
  // Use base class error handling with retry
  const concepts = await this._executeWithErrorHandling(
    () => this.characterBuilderService.getAllCharacterConcepts(),
    'load character concepts',
    { retries: 2 }
  );
}
```

## Testing Strategy

### Unit Testing Lifecycle Hooks

```javascript
describe('Lifecycle Hook Implementation', () => {
  let controller;
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    controller = new CharacterConceptsManagerController(mockDependencies);
  });

  describe('_initializeServices', () => {
    it('should call base class service initialization', async () => {
      const superSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(controller)),
        '_initializeServices'
      );

      await controller._initializeServices();

      expect(superSpy).toHaveBeenCalled();
    });

    it('should initialize cross-tab synchronization', async () => {
      const initCrossTabSpy = jest.spyOn(controller, '_initializeCrossTabSync');

      await controller._initializeServices();

      expect(initCrossTabSpy).toHaveBeenCalled();
    });

    it('should set up broadcast channel', async () => {
      await controller._initializeServices();

      expect(controller.#syncChannel).toBeInstanceOf(BroadcastChannel);
      expect(controller.#tabId).toMatch(/^tab-\d+-[a-z0-9]+$/);
    });
  });

  describe('_loadInitialData', () => {
    it('should load concepts data with retry logic', async () => {
      const mockConcepts = [{ id: '1', concept: 'Test concept' }];
      mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await controller._loadInitialData();

      expect(controller.#conceptsData).toEqual(mockConcepts);
    });

    it('should restore search state from session storage', async () => {
      sessionStorage.setItem('conceptsSearchFilter', 'test search');
      mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      await controller._loadInitialData();

      expect(controller.#searchFilter).toBe('test search');
    });

    it('should handle data loading errors with retry', async () => {
      const error = new Error('Network error');
      mockDependencies.characterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        error
      );

      await expect(controller._loadInitialData()).rejects.toThrow();

      // Verify retry logic was attempted
      expect(
        mockDependencies.characterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('_initializeUIState', () => {
    it('should call base class UI state initialization', async () => {
      const superSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(controller)),
        '_initializeUIState'
      );

      await controller._initializeUIState();

      expect(superSpy).toHaveBeenCalled();
    });

    it('should show results state when data exists', async () => {
      controller.#conceptsData = [{ id: '1', concept: 'Test' }];
      const showStateSpy = jest.spyOn(controller, '_showState');

      await controller._initializeUIState();

      expect(showStateSpy).toHaveBeenCalledWith('results');
    });

    it('should show empty state when no data exists', async () => {
      controller.#conceptsData = [];
      const showStateSpy = jest.spyOn(controller, '_showState');

      await controller._initializeUIState();

      expect(showStateSpy).toHaveBeenCalledWith('empty');
    });
  });

  describe('_postInitialize', () => {
    it('should set up keyboard shortcuts', async () => {
      const setupShortcutsSpy = jest.spyOn(
        controller,
        '_setupKeyboardShortcuts'
      );

      await controller._postInitialize();

      expect(setupShortcutsSpy).toHaveBeenCalled();
    });

    it('should register page unload handler', async () => {
      const registerUnloadSpy = jest.spyOn(
        controller,
        '_registerPageUnloadHandler'
      );

      await controller._postInitialize();

      expect(registerUnloadSpy).toHaveBeenCalled();
    });

    it('should mark controller as fully initialized', async () => {
      await controller._postInitialize();

      expect(controller.#isInitialized).toBe(true);
    });
  });
});
```

### Integration Testing

```javascript
describe('Lifecycle Integration', () => {
  it('should complete full initialization sequence', async () => {
    const controller = createTestController();
    setupMockDOM();

    // Mock service responses
    mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([
      { id: '1', concept: 'Test concept' },
    ]);

    // Initialize controller (triggers all lifecycle hooks)
    await controller.initialize();

    // Verify initialization completed successfully
    expect(controller.#isInitialized).toBe(true);
    expect(controller.#conceptsData).toHaveLength(1);
    expect(controller.#syncChannel).toBeInstanceOf(BroadcastChannel);

    // Verify UI state is correct
    expect(controller._showState).toHaveBeenCalledWith('results');
  });

  it('should handle initialization errors gracefully', async () => {
    const controller = createTestController();
    setupMockDOM();

    // Mock service failure
    mockCharacterBuilderService.getAllCharacterConcepts.mockRejectedValue(
      new Error('Service unavailable')
    );

    // Should handle error gracefully with retry logic
    await expect(controller.initialize()).rejects.toThrow();

    // Verify error state is shown
    expect(controller._showError).toHaveBeenCalled();
  });
});
```

### Performance Testing

```javascript
describe('Initialization Performance', () => {
  it('should initialize within performance thresholds', async () => {
    const controller = createTestController();
    setupMockDOM();

    const startTime = performance.now();
    await controller.initialize();
    const initTime = performance.now() - startTime;

    // Should initialize in under 100ms
    expect(initTime).toBeLessThan(100);
  });

  it('should not leak memory during initialization', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      const controller = createTestController();
      await controller.initialize();
      controller.destroy(); // Clean up
    }

    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    // Memory growth should be minimal
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
  });
});
```

## Verification Steps

### 1. Pre-Implementation Verification

```bash
# Ensure previous tickets are complete
npm run test:unit -- tests/unit/domUI/characterConceptsManagerController.test.js

# Verify base class lifecycle hooks are available
grep -r "_initializeServices\|_loadInitialData\|_initializeUIState\|_postInitialize" src/characterBuilder/controllers/BaseCharacterBuilderController.js
```

### 2. Implementation Verification

**After Each Hook Implementation:**

```bash
# Test service initialization
npm run test:unit -- --grep "_initializeServices"

# Test data loading
npm run test:unit -- --grep "_loadInitialData"

# Test UI state initialization
npm run test:unit -- --grep "_initializeUIState"

# Test post-initialization
npm run test:unit -- --grep "_postInitialize"
```

**Full Integration Testing:**

```bash
# Test complete initialization sequence
npm run test:unit -- tests/unit/domUI/characterConceptsManagerController.test.js
npm run test:integration -- --grep "CharacterConceptsManagerController"

# Manual testing
npm run start
```

### 3. Functionality Verification

**Manual Testing Checklist:**

- [ ] Page loads and displays concepts correctly
- [ ] Cross-tab synchronization works between multiple tabs
- [ ] Search state is restored on page reload
- [ ] Keyboard shortcuts work (Ctrl+N, Escape, Ctrl+F)
- [ ] Page unload saves state properly
- [ ] Error states display correctly with retry functionality
- [ ] Initial state (empty/results) displays correctly based on data

## Risk Assessment

### Low Risk ✅

- **Lifecycle Hook Implementation**: Well-defined base class interface
- **Service Integration**: Preserving existing service logic
- **Data Loading**: Moving existing logic to appropriate hook

### Medium Risk ⚠️

- **Initialization Order**: Must maintain correct sequence of operations
- **State Dependencies**: UI state depends on loaded data
- **Cross-Tab Sync**: Complex feature with timing dependencies

### High Risk 🚨

- **Session State Restoration**: Complex interaction between data loading and UI state
- **Error Handling**: Retry logic and error state management
- **Advanced Features**: Keyboard shortcuts and page unload handling

## Mitigation Strategies

### 1. Incremental Implementation

```javascript
// Phase 1: Implement hooks that delegate to existing methods
_initializeServices() {
  return this.#initializeService(); // Delegate temporarily
}

// Phase 2: Migrate logic to new patterns
_initializeServices() {
  await super._initializeServices();
  this._initializeCrossTabSync();
}
```

### 2. Comprehensive Testing

- Unit tests for each lifecycle hook
- Integration tests for complete initialization sequence
- Error scenario testing with mock failures
- Performance testing for initialization time

### 3. State Validation

```javascript
// Add validation checkpoints
_initializeUIState() {
  if (!this.characterBuilderService) {
    throw new Error('Services not initialized before UI state');
  }
  if (this.#conceptsData === undefined) {
    throw new Error('Data not loaded before UI state initialization');
  }
  // Continue with implementation
}
```

### 4. Rollback Capability

- Keep existing methods during migration
- Feature flags for switching between implementations
- Comprehensive error logging for debugging

## Success Criteria

### Functional Requirements ✅

1. **Lifecycle Integration**: All hooks properly implemented and called in sequence
2. **Service Initialization**: characterBuilderService and cross-tab sync working
3. **Data Loading**: Concepts loaded with retry logic and error handling
4. **UI State Management**: Proper initial state based on loaded data
5. **Advanced Features**: Keyboard shortcuts and state persistence working
6. **Error Handling**: Improved error handling through base class patterns

### Technical Requirements ✅

1. **Code Reduction**: 245+ lines removed (85% reduction in initialization code)
2. **Initialization Order**: Correct lifecycle hook sequence maintained
3. **State Dependencies**: Proper data flow between hooks
4. **Base Class Integration**: Leveraging all base class lifecycle features
5. **Error Patterns**: Consistent error handling across all hooks

### Quality Requirements ✅

1. **Test Coverage**: Comprehensive testing of all lifecycle hooks
2. **Performance**: Initialization time under 100ms
3. **Memory Management**: No memory leaks during repeated initialization
4. **Functionality Preservation**: Zero changes to user-facing behavior
5. **Code Quality**: Clean, maintainable lifecycle hook implementations

## Next Steps

Upon successful completion of CHARCONMIG-03:

1. **CHARCONMIG-04**: Update field access patterns to use base class getters
2. **CHARCONMIG-05**: Integrate state management with base class methods
3. **CHARCONMIG-06**: Preserve advanced features using base class patterns
4. **Continue Migration Sequence**: Follow remaining tickets in order

## Troubleshooting Guide

### Issue 1: Initialization Order Problems

**Symptoms**: Data not available when UI state initializes
**Solution**: Verify hook sequence and data dependencies between hooks

### Issue 2: Cross-Tab Sync Not Working

**Symptoms**: Events not received between tabs
**Solution**: Check broadcast channel setup and message handler binding

### Issue 3: Service Initialization Failures

**Symptoms**: CharacterBuilderService not properly initialized
**Solution**: Verify base class service initialization is called correctly

### Issue 4: Search State Not Restored

**Symptoms**: Search filter not restored on page reload
**Solution**: Check session storage access and timing in data loading hook

### Issue 5: Error Handling Not Working

**Symptoms**: Errors not properly caught and displayed
**Solution**: Verify `_executeWithErrorHandling` usage and error state management

**Completion Time Estimate**: 7 hours with comprehensive testing and validation
