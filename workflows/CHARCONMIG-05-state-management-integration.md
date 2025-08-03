# CHARCONMIG-05: State Management Integration

## Overview

Integrate the controller's state management with the BaseCharacterBuilderController's standardized state management infrastructure. This migration replaces manual state transitions and error handling with base class methods, enabling consistent UI state patterns and enhanced error handling with retry logic.

## Priority

**High** - Critical for achieving consistent state management patterns and error handling improvements.

## Dependencies

- CHARCONMIG-01: Structural Foundation Setup (completed)
- CHARCONMIG-02: Abstract Method Implementation (completed)
- CHARCONMIG-03: Lifecycle Method Migration (completed)
- CHARCONMIG-04: Field Access Pattern Updates (completed)

## Estimated Effort

**5 hours** - State management integration with comprehensive error handling migration and testing

## Acceptance Criteria

1. ✅ Manual state management methods replaced with base class methods
2. ✅ Error handling standardized using `_executeWithErrorHandling()` with retry logic
3. ✅ State transitions use base class `_showState()`, `_showError()`, `_showLoading()`
4. ✅ Manual UIStateManager references removed
5. ✅ Consistent error display patterns throughout controller
6. ✅ Loading states properly managed during async operations
7. ✅ Retry functionality integrated for service operations
8. ✅ All existing functionality preserved with improved error handling
9. ✅ Code reduction achieved (80+ lines saved)
10. ✅ Enhanced user experience through better state management

## Current State Management Analysis

### Manual State Management (To Be Replaced)

```javascript
// Current manual state transitions
#showLoading(message = 'Loading...') {
  this.#uiStateManager.showState(UI_STATES.LOADING);
  if (message && this.#elements.loadingMessage) {
    this.#elements.loadingMessage.textContent = message;
  }
}

#showError(message, showRetryButton = true) {
  this.#uiStateManager.showState(UI_STATES.ERROR);
  if (this.#elements.errorMessageText) {
    this.#elements.errorMessageText.textContent = message;
  }
  if (this.#elements.retryBtn && showRetryButton) {
    this.#elements.retryBtn.style.display = 'block';
  }
}

#showResults() {
  this.#uiStateManager.showState(UI_STATES.RESULTS);
}

#showEmpty() {
  this.#uiStateManager.showState(UI_STATES.EMPTY);
}
```

### Manual Error Handling (To Be Enhanced)

```javascript
// Current inconsistent error handling patterns
try {
  const concepts = await this.#characterBuilderService.getAllCharacterConcepts();
  this.#conceptsData = concepts;
  this.#showResults();
} catch (error) {
  this.#logger.error('Failed to load concepts', error);
  this.#showError('Failed to load character concepts. Please try again.');
}

// Manual retry logic
#retryLastOperation() {
  if (this.#lastFailedOperation) {
    this.#lastFailedOperation();
  }
}
```

### Manual Loading State Management

```javascript
// Current manual loading state handling
async #loadConceptsData() {
  this.#showLoading('Loading character concepts...');
  try {
    // ... operation
  } catch (error) {
    this.#showError('Failed to load concepts');
  } finally {
    // Manual cleanup
  }
}
```

## Implementation Steps

### Step 1: Replace Manual State Management Methods

**Duration:** 2 hours

**Current Manual Methods (80+ lines):**

```javascript
#showLoading(message = 'Loading...') {
  this.#uiStateManager.showState(UI_STATES.LOADING);
  if (message && this.#elements.loadingMessage) {
    this.#elements.loadingMessage.textContent = message;
  }
  this.#logger.debug(`Showing loading state: ${message}`);
}

#showError(message, showRetryButton = true) {
  this.#uiStateManager.showState(UI_STATES.ERROR);
  if (this.#elements.errorMessageText) {
    this.#elements.errorMessageText.textContent = message;
  }
  if (this.#elements.retryBtn && showRetryButton) {
    this.#elements.retryBtn.style.display = 'block';
  } else if (this.#elements.retryBtn) {
    this.#elements.retryBtn.style.display = 'none';
  }
  this.#logger.error(`Showing error state: ${message}`);
}

#showResults() {
  this.#uiStateManager.showState(UI_STATES.RESULTS);
  this.#updateStatistics();
  this.#logger.debug('Showing results state');
}

#showEmpty() {
  this.#uiStateManager.showState(UI_STATES.EMPTY);
  this.#logger.debug('Showing empty state');
}
```

**Target Base Class Integration:**

```javascript
// Remove all manual state management methods
// Base class provides these methods automatically:
// this._showLoading(message)
// this._showError(message)
// this._showState(stateName)
// this._showResults()
```

**Implementation Steps:**

1. **Remove Manual State Methods**

   ```javascript
   // Delete these entire methods from the controller
   #showLoading()
   #showError()
   #showResults()
   #showEmpty()
   ```

2. **Update State Transition Calls**

   ```javascript
   // Replace manual method calls with base class methods

   // Loading states
   // this.#showLoading('Loading concepts...')
   this._showLoading('Loading concepts...');

   // Error states
   // this.#showError('Failed to load concepts')
   this._showError('Failed to load concepts');

   // Results state
   // this.#showResults()
   this._showState('results');

   // Empty state
   // this.#showEmpty()
   this._showState('empty');
   ```

3. **Remove UIStateManager References**

   ```javascript
   // Remove these from constructor (already done in CHARCONMIG-04)
   // this.#uiStateManager = null;

   // Remove manual UIStateManager initialization (already done in CHARCONMIG-03)
   // this.#initializeUIStateManager()
   ```

**Validation:**

- No manual state management methods remain
- All state transitions use base class methods
- No direct UIStateManager references remain
- State transitions work identically to before

### Step 2: Implement Enhanced Error Handling with Retry Logic

**Duration:** 2 hours

**Current Error Handling Patterns (100+ lines):**

```javascript
// Inconsistent error handling throughout controller
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

  } catch (error) {
    this.#logger.error('Failed to load concepts data', error);
    this.#showError('Failed to load character concepts. Please try again.');
    throw error;
  }
}

async #handleConceptSave() {
  try {
    this.#showLoading('Saving concept...');

    const conceptData = {
      concept: this.#elements.conceptText.value.trim(),
      // ... other data
    };

    if (this.#editingConceptId) {
      await this.#characterBuilderService.updateCharacterConcept(
        this.#editingConceptId,
        conceptData
      );
    } else {
      await this.#characterBuilderService.createCharacterConcept(conceptData);
    }

    await this.#loadConceptsData();
    this.#closeConceptModal();

  } catch (error) {
    this.#logger.error('Failed to save concept', error);
    this.#showError('Failed to save concept. Please try again.');
  }
}
```

**Target Enhanced Error Handling:**

```javascript
/**
 * Load character concepts data with retry logic
 * @private
 */
async _loadConceptsData() {
  // Use base class error handling with automatic retry and loading states
  const concepts = await this._executeWithErrorHandling(
    () => this.characterBuilderService.getAllCharacterConcepts(),
    'load character concepts',
    {
      retries: 2,
      userErrorMessage: 'Failed to load character concepts. Please try again.',
      loadingMessage: 'Loading character concepts...'
    }
  );

  if (!Array.isArray(concepts)) {
    throw new Error('Invalid concepts data received');
  }

  this.#conceptsData = concepts;
  this._updateStatistics();
  this._renderConcepts();

  // Use base class state management
  if (concepts.length > 0) {
    this._showState('results');
  } else {
    this._showState('empty');
  }

  this.logger.info(`Loaded ${concepts.length} character concepts`);
}

/**
 * Handle concept save with enhanced error handling
 * @private
 */
async _handleConceptSave() {
  try {
    const conceptData = {
      concept: this._getElement('conceptText').value.trim(),
      // ... other data gathering
    };

    // Validate concept data
    if (!conceptData.concept) {
      this._showError('Concept text is required');
      return;
    }

    // Use base class error handling for save operation
    if (this.#editingConceptId) {
      await this._executeWithErrorHandling(
        () => this.characterBuilderService.updateCharacterConcept(
          this.#editingConceptId,
          conceptData
        ),
        'update character concept',
        {
          retries: 1,
          userErrorMessage: 'Failed to update concept. Please try again.',
          loadingMessage: 'Updating concept...'
        }
      );
    } else {
      await this._executeWithErrorHandling(
        () => this.characterBuilderService.createCharacterConcept(conceptData),
        'create character concept',
        {
          retries: 1,
          userErrorMessage: 'Failed to create concept. Please try again.',
          loadingMessage: 'Creating concept...'
        }
      );
    }

    // Reload data and close modal
    await this._loadConceptsData();
    this._closeConceptModal();

  } catch (error) {
    // Base class error handling will have already displayed error
    this.logger.error('Concept save operation failed', error);
  }
}
```

**Implementation Details:**

1. **Replace Try-Catch Blocks**
   - Identify all service operation try-catch blocks
   - Replace with `_executeWithErrorHandling()` calls
   - Configure retry logic and error messages appropriately

2. **Configure Error Handling Options**

   ```javascript
   // Standard options for different operation types
   const loadOptions = {
     retries: 2,
     userErrorMessage: 'Failed to load data. Please try again.',
     loadingMessage: 'Loading...',
   };

   const saveOptions = {
     retries: 1,
     userErrorMessage: 'Failed to save. Please try again.',
     loadingMessage: 'Saving...',
   };

   const deleteOptions = {
     retries: 1,
     userErrorMessage: 'Failed to delete. Please try again.',
     loadingMessage: 'Deleting...',
   };
   ```

3. **Remove Manual Retry Logic**
   ```javascript
   // Remove these manual retry implementations
   #retryLastOperation()
   #lastFailedOperation
   // Base class handles retry automatically
   ```

**Validation:**

- All service operations use enhanced error handling
- Retry logic works correctly for different operation types
- Loading states managed automatically
- Error messages displayed consistently

### Step 3: Standardize State Transition Patterns

**Duration:** 1 hour

**Current Inconsistent Patterns:**

```javascript
// Different patterns used throughout the controller
this.#showLoading('Loading...');
this.#uiStateManager.showState(UI_STATES.LOADING);
this.#elements.loadingState.style.display = 'block';

this.#showError('Error message');
this.#elements.errorState.style.display = 'block';
this.#elements.errorMessageText.textContent = message;
```

**Target Consistent Patterns:**

```javascript
// Standardized state management through base class
this._showLoading('Loading...'); // For operations with loading
this._showError('Error message'); // For error states
this._showState('results'); // For data display
this._showState('empty'); // For no data state
```

**Implementation:**

1. **Search and Replace State Patterns**

   ```bash
   # Find all state transition patterns
   grep -n "showState\|style\.display\|showLoading\|showError" src/domUI/characterConceptsManagerController.js

   # Replace with base class methods
   # this.#showLoading → this._showLoading
   # this.#showError → this._showError
   # this.#showResults → this._showState('results')
   # this.#showEmpty → this._showState('empty')
   ```

2. **Update Conditional State Logic**

   ```javascript
   // Current conditional patterns
   if (this.#conceptsData.length > 0) {
     this.#showResults();
   } else {
     this.#showEmpty();
   }

   // Updated patterns
   if (this.#conceptsData.length > 0) {
     this._showState('results');
   } else {
     this._showState('empty');
   }
   ```

3. **Remove Manual Style Manipulation**

   ```javascript
   // Remove direct style manipulation
   // this.#elements.loadingState.style.display = 'block';
   // this.#elements.errorState.style.display = 'none';

   // Use base class state management instead
   this._showLoading('Loading...');
   this._showState('results');
   ```

**Validation:**

- All state transitions use base class methods
- No manual style manipulation remains
- Consistent patterns throughout controller

## Code Reduction Analysis

### Quantitative Reduction

| Category                  | Before (Lines) | After (Lines) | Reduction | Savings  |
| ------------------------- | -------------- | ------------- | --------- | -------- |
| **Manual State Methods**  | 60             | 0             | 100%      | 60 lines |
| **Error Handling Blocks** | 80             | 20            | 75%       | 60 lines |
| **Manual Retry Logic**    | 25             | 0             | 100%      | 25 lines |
| **UIStateManager Setup**  | 30             | 0             | 100%      | 30 lines |
| **Manual Loading States** | 40             | 10            | 75%       | 30 lines |

**Total Code Reduction**: **205 lines (80% reduction in state management code)**

### Qualitative Improvements

**Before Migration:**

```javascript
// ❌ Manual state management with potential inconsistencies
#showLoading(message) {
  this.#uiStateManager.showState(UI_STATES.LOADING);
  if (message && this.#elements.loadingMessage) {
    this.#elements.loadingMessage.textContent = message;
  }
  // Manual logging and cleanup
}

// ❌ Inconsistent error handling without retry
try {
  await this.#characterBuilderService.getAllCharacterConcepts();
} catch (error) {
  this.#logger.error('Error', error);
  this.#showError('Something went wrong');
  // No retry logic
}

// ❌ Manual retry implementation
#retryLastOperation() {
  if (this.#lastFailedOperation) {
    this.#lastFailedOperation();
  }
}
```

**After Migration:**

```javascript
// ✅ Standardized state management through base class
this._showLoading('Loading concepts...');
this._showError('Failed to load concepts');
this._showState('results');

// ✅ Enhanced error handling with automatic retry
const concepts = await this._executeWithErrorHandling(
  () => this.characterBuilderService.getAllCharacterConcepts(),
  'load character concepts',
  {
    retries: 2,
    userErrorMessage: 'Failed to load character concepts. Please try again.',
    loadingMessage: 'Loading character concepts...',
  }
);

// ✅ Automatic retry logic handled by base class
// No manual retry code needed
```

## Integration Points

### Base Class State Management Methods

```javascript
// Available state management methods from base class
this._showLoading(message); // Show loading state with message
this._showError(message); // Show error state with message
this._showState(stateName); // Show specific state (empty, results, etc.)
this._showResults(); // Shortcut for results state

// State checking methods
this._isCurrentState(stateName); // Check if currently in specific state
this._getCurrentState(); // Get current state name
```

### Enhanced Error Handling Options

```javascript
// _executeWithErrorHandling options
{
  retries: number,                   // Number of retry attempts (default: 0)
  userErrorMessage: string,          // User-friendly error message
  loadingMessage: string,            // Loading state message
  retryDelay: number,               // Delay between retries in ms (default: 1000)
  onRetry: function,                // Callback before each retry
  onSuccess: function,              // Callback on successful completion
  onError: function                 // Callback on final failure
}
```

### State Names and Patterns

```javascript
// Standard state names for character builder controllers
'empty'; // No data state
'loading'; // Loading data state
'error'; // Error state
'results'; // Data display state

// Usage patterns
this._showState('empty'); // For no concepts
this._showState('results'); // For concept list
this._showLoading('Loading...'); // During async operations
this._showError('Error message'); // For error conditions
```

## Testing Strategy

### Unit Testing State Management

```javascript
describe('State Management Integration', () => {
  let controller;

  beforeEach(() => {
    controller = createTestController();
    setupMockDOM();
  });

  describe('State Transitions', () => {
    it('should use base class state management', () => {
      const showStateSpy = jest.spyOn(controller, '_showState');
      const showLoadingSpy = jest.spyOn(controller, '_showLoading');
      const showErrorSpy = jest.spyOn(controller, '_showError');

      // Test loading state
      controller._showLoading('Loading concepts...');
      expect(showLoadingSpy).toHaveBeenCalledWith('Loading concepts...');

      // Test results state
      controller._showState('results');
      expect(showStateSpy).toHaveBeenCalledWith('results');

      // Test error state
      controller._showError('Test error message');
      expect(showErrorSpy).toHaveBeenCalledWith('Test error message');
    });

    it('should not have manual state management methods', () => {
      expect(controller['#showLoading']).toBeUndefined();
      expect(controller['#showError']).toBeUndefined();
      expect(controller['#showResults']).toBeUndefined();
      expect(controller['#showEmpty']).toBeUndefined();
    });
  });

  describe('Enhanced Error Handling', () => {
    it('should use executeWithErrorHandling for service operations', async () => {
      const executeWithErrorHandlingSpy = jest.spyOn(
        controller,
        '_executeWithErrorHandling'
      );

      mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([]);

      await controller._loadConceptsData();

      expect(executeWithErrorHandlingSpy).toHaveBeenCalledWith(
        expect.any(Function),
        'load character concepts',
        expect.objectContaining({
          retries: 2,
          userErrorMessage: expect.stringContaining('Failed to load'),
          loadingMessage: expect.stringContaining('Loading'),
        })
      );
    });

    it('should handle service errors with retry logic', async () => {
      const error = new Error('Service unavailable');
      mockCharacterBuilderService.getAllCharacterConcepts
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue([]);

      await controller._loadConceptsData();

      // Should retry 2 times before succeeding
      expect(
        mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalledTimes(3);
    });

    it('should display error message after retries exhausted', async () => {
      const error = new Error('Persistent service error');
      mockCharacterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        error
      );

      const showErrorSpy = jest.spyOn(controller, '_showError');

      await expect(controller._loadConceptsData()).rejects.toThrow();

      expect(showErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load character concepts')
      );
    });
  });

  describe('Loading State Management', () => {
    it('should show loading state during async operations', async () => {
      const showLoadingSpy = jest.spyOn(controller, '_showLoading');

      mockCharacterBuilderService.getAllCharacterConcepts.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const loadPromise = controller._loadConceptsData();

      expect(showLoadingSpy).toHaveBeenCalledWith(
        expect.stringContaining('Loading character concepts')
      );

      await loadPromise;
    });
  });
});
```

### Integration Testing

```javascript
describe('State Management Integration', () => {
  it('should complete full state cycle', async () => {
    const controller = createTestController();
    setupMockDOM();

    // Mock successful data loading
    mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([
      { id: '1', concept: 'Test concept' },
    ]);

    // Initialize and load data
    await controller.initialize();

    // Verify state progression
    expect(controller._showLoading).toHaveBeenCalledWith(
      expect.stringContaining('Loading')
    );
    expect(controller._showState).toHaveBeenCalledWith('results');
  });

  it('should handle error states correctly', async () => {
    const controller = createTestController();
    setupMockDOM();

    // Mock service failure
    mockCharacterBuilderService.getAllCharacterConcepts.mockRejectedValue(
      new Error('Service error')
    );

    await expect(controller.initialize()).rejects.toThrow();

    // Verify error state shown
    expect(controller._showError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load')
    );
  });
});
```

### Performance Testing

```javascript
describe('State Management Performance', () => {
  it('should not degrade performance with base class methods', async () => {
    const controller = createTestController();
    setupMockDOM();

    const iterations = 1000;

    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      controller._showLoading('Loading...');
      controller._showState('results');
      controller._showError('Error');
    }
    const endTime = performance.now();

    const timePerIteration = (endTime - startTime) / iterations;

    // Should be under 0.1ms per state transition
    expect(timePerIteration).toBeLessThan(0.1);
  });
});
```

## Verification Steps

### 1. Pre-Implementation Verification

```bash
# Ensure previous tickets are complete
npm run test:unit -- tests/unit/domUI/characterConceptsManagerController.test.js

# Check current state management patterns
grep -n "#showLoading\|#showError\|#showResults\|#showEmpty" src/domUI/characterConceptsManagerController.js
grep -n "uiStateManager\|UI_STATES" src/domUI/characterConceptsManagerController.js
```

### 2. Implementation Verification

**Step-by-Step Testing:**

```bash
# After state method removal
npm run test:unit -- --grep "state management"

# After error handling migration
npm run test:unit -- --grep "error handling"

# After state transition updates
npm run test:unit -- --grep "state transitions"

# Full regression testing
npm run test:unit -- tests/unit/domUI/characterConceptsManagerController.test.js
```

**Code Quality Checks:**

```bash
# Verify no manual state methods remain
grep -r "#showLoading\|#showError\|#showResults\|#showEmpty" src/domUI/characterConceptsManagerController.js

# Verify base class usage
grep -r "_showLoading\|_showError\|_showState" src/domUI/characterConceptsManagerController.js
grep -r "_executeWithErrorHandling" src/domUI/characterConceptsManagerController.js

# Run linting and type checking
npm run lint
npm run typecheck
```

### 3. Functionality Verification

**Manual Testing Checklist:**

- [ ] Page loads with proper initial state (empty/results)
- [ ] Loading states display during data operations
- [ ] Error states display with retry button
- [ ] Retry functionality works after errors
- [ ] Concept creation shows loading and handles errors
- [ ] Concept editing shows loading and handles errors
- [ ] Concept deletion shows loading and handles errors
- [ ] Search operations handle errors gracefully
- [ ] State transitions are smooth and consistent

## Risk Assessment

### Low Risk ✅

- **State Method Replacement**: Direct mapping to base class methods
- **Error Message Display**: Same user-facing messages
- **State Transition Logic**: Preserving existing logic patterns

### Medium Risk ⚠️

- **Async Operation Timing**: Base class error handling may change timing
- **Retry Logic Integration**: New retry behavior vs. existing error flows
- **Loading State Management**: Automatic vs. manual loading state control

### High Risk 🚨

- **Complex Error Scenarios**: Multi-step operations with partial failures
- **User Experience Changes**: Different retry behavior may affect UX
- **State Consistency**: Ensuring state transitions remain atomic

## Mitigation Strategies

### 1. Incremental Migration

```javascript
// Phase 1: Add base class alongside existing
_showLoadingNew(message) {
  return this._showLoading(message);
}

_showLoadingOld(message) {
  return this.#showLoading(message);
}

// Phase 2: Switch implementation after validation
// Phase 3: Remove old methods
```

### 2. Comprehensive Testing

- Unit tests for all state transitions
- Integration tests for complete workflows
- Error scenario testing with mock failures
- Performance testing for state transition overhead

### 3. Error Handling Validation

```javascript
// Test different error scenarios
const errorScenarios = [
  { error: new Error('Network error'), expectedRetries: 2 },
  { error: new Error('Timeout'), expectedRetries: 2 },
  { error: new Error('Validation error'), expectedRetries: 0 },
];

errorScenarios.forEach((scenario) => {
  // Test each scenario
});
```

### 4. State Consistency Checks

```javascript
// Add validation to ensure state consistency
_validateStateTransition(fromState, toState) {
  const validTransitions = {
    'loading': ['results', 'error', 'empty'],
    'error': ['loading'],
    'empty': ['loading'],
    'results': ['loading']
  };

  if (!validTransitions[fromState]?.includes(toState)) {
    this.logger.warn(`Invalid state transition: ${fromState} → ${toState}`);
  }
}
```

## Success Criteria

### Functional Requirements ✅

1. **State Management**: All state transitions use base class methods
2. **Error Handling**: Enhanced error handling with retry logic for all operations
3. **Loading States**: Automatic loading state management during async operations
4. **Error Display**: Consistent error message display and retry functionality
5. **User Experience**: Improved UX through better state management and error recovery

### Technical Requirements ✅

1. **Code Reduction**: 205+ lines removed (80% reduction in state management code)
2. **Base Class Integration**: Full utilization of base class state management infrastructure
3. **Error Patterns**: Consistent error handling patterns throughout controller
4. **Retry Logic**: Configurable retry logic for different operation types
5. **Performance**: No performance degradation from base class method usage

### Quality Requirements ✅

1. **Consistency**: Uniform state management patterns throughout controller
2. **Reliability**: Enhanced error recovery and retry capabilities
3. **Maintainability**: Simplified state management code
4. **Testability**: Improved testability through base class infrastructure
5. **User Experience**: Better error handling and loading state feedback

## Next Steps

Upon successful completion of CHARCONMIG-05:

1. **CHARCONMIG-06**: Preserve advanced features using base class patterns
2. **CHARCONMIG-07**: Migrate test infrastructure to base class patterns
3. **CHARCONMIG-08**: Final cleanup and optimization

## Troubleshooting Guide

### Issue 1: State Transition Failures

**Symptoms**: States not changing or displaying incorrectly
**Solution**: Verify base class state management is properly initialized and element mapping is correct

### Issue 2: Error Handling Not Working

**Symptoms**: Errors not displayed or retry logic not triggering
**Solution**: Check `_executeWithErrorHandling` configuration and error message setup

### Issue 3: Loading States Not Showing

**Symptoms**: Loading messages not appearing during async operations
**Solution**: Verify loading message configuration in `_executeWithErrorHandling` options

### Issue 4: Retry Logic Issues

**Symptoms**: Operations retrying too many times or not at all
**Solution**: Check retry configuration and ensure proper error types are being thrown

### Issue 5: Performance Issues

**Symptoms**: State transitions feel slow or laggy
**Solution**: Profile state transition performance and optimize base class method calls

**Completion Time Estimate**: 5 hours with comprehensive testing and validation
