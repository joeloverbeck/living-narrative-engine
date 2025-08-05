# THEDIRMIG-003: Simplify Constructor and Implement Dependency Validation

## Overview

Simplify the ThematicDirectionsManagerController constructor by leveraging base class validation for core dependencies while properly handling UIStateManager as an additional service. This will reduce the constructor from 31 lines to 10-15 lines (~50% reduction) while maintaining the same validation guarantees.

## Priority

**HIGH** - Significant code reduction and standardization

## Dependencies

- **Blocked by**: THEDIRMIG-002 (class declaration update)
- **Blocks**: THEDIRMIG-004, THEDIRMIG-005 (abstract method implementations)
- **Enables**: Further lifecycle method migrations

## Acceptance Criteria

- [ ] Constructor reduced to 10-15 lines (from 31 lines)
- [ ] Core dependency validation delegated to base class
- [ ] UIStateManager validation properly handled as additional service
- [ ] Page-specific field initialization retained and streamlined
- [ ] No loss of validation coverage (all required dependencies still validated)
- [ ] Constructor remains functionally equivalent
- [ ] UIStateManager dependency properly exposed in constructor signature

## Implementation Steps

### Step 1: Analyze Current Constructor

**Current Constructor Structure** (~31 lines, validation is 28 lines):

```javascript
constructor({ logger, characterBuilderService, eventBus, schemaValidator }) {
  super({ logger, characterBuilderService, eventBus, schemaValidator });

  // Keep existing validation for now (to be cleaned up in THEDIRMIG-003)
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'info', 'warn', 'error'],
  });
  validateDependency(
    characterBuilderService,
    'CharacterBuilderService',
    logger,
    {
      requiredMethods: [
        'initialize',
        'getAllCharacterConcepts',
        'getCharacterConcept',
        'getAllThematicDirectionsWithConcepts',
        'getOrphanedThematicDirections',
        'updateThematicDirection',
        'deleteThematicDirection',
      ],
    }
  );
  validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
    requiredMethods: ['dispatch'],
  });
  validateDependency(schemaValidator, 'ISchemaValidator', logger, {
    requiredMethods: ['validateAgainstSchema'],
  });

  // Dependencies are now handled by super() - assignments removed
}
```

### Step 2: Remove Manual Validation Code

**IMPORTANT**: The base class does NOT validate UIStateManager, which is needed by this controller. We must keep UIStateManager validation or add it as an additional service.

The base class validates core dependencies but with different method requirements. Some current validations need to be kept or moved to additional services pattern.

### Step 3: Simplify Constructor

**New Constructor** (10-15 lines with additional service validation):

```javascript
constructor({ logger, characterBuilderService, eventBus, schemaValidator, uiStateManager }) {
  super({ logger, characterBuilderService, eventBus, schemaValidator });

  // Validate additional service not handled by base class
  validateDependency(uiStateManager, 'UIStateManager', logger, {
    requiredMethods: ['showState', 'showError']
  });

  this.#uiStateManager = uiStateManager;

  // Initialize page-specific fields only
  this.#currentFilter = '';
  this.#currentConcept = null;
  this.#directionsData = [];
  this.#inPlaceEditors = new Map();
}
```

### Step 4: Verify Base Class Validation Coverage

**Base class actually validates:**

- ILogger with methods: ['debug', 'info', 'warn', 'error'] ✓
- CharacterBuilderService with methods: ['initialize', 'getAllCharacterConcepts', 'createCharacterConcept', 'updateCharacterConcept', 'deleteCharacterConcept', 'getCharacterConcept', 'generateThematicDirections', 'getThematicDirections'] ✓
- ISafeEventDispatcher with methods: ['dispatch', 'subscribe', 'unsubscribe'] ✓
- ISchemaValidator with methods: ['validateAgainstSchema'] ✓

**Missing validations that our controller needs:**

- UIStateManager - NOT validated by base class, must handle separately
- Additional CharacterBuilderService methods: ['getAllThematicDirectionsWithConcepts', 'getOrphanedThematicDirections', 'updateThematicDirection', 'deleteThematicDirection'] - these are specific to this controller

**Resolution:** Use base class for core validation, add UIStateManager as additional service validation.

### Step 5: Update Constructor Implementation

**Note:** Core dependency assignments have already been removed (see line 78 comment in current code). Only UIStateManager assignment is needed since it's not handled by base class.

### Step 6: Final Constructor Structure

The final constructor should focus on:

1. Base class validation via super()
2. Additional service validation (UIStateManager)
3. Simple field initialization only

Complex initialization (UIStateManager creation, dropdown setup, etc.) is already properly handled in the `initialize()` method.

### Step 7: Updated JSDoc Documentation

```javascript
/**
 * Creates an instance of ThematicDirectionsManagerController
 * @param {Object} dependencies - Injected dependencies
 * @param {ILogger} dependencies.logger - Logger instance (validated by base class)
 * @param {CharacterBuilderService} dependencies.characterBuilderService - Service for character builder operations (validated by base class)
 * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher (validated by base class)
 * @param {ISchemaValidator} dependencies.schemaValidator - Schema validation service (validated by base class)
 * @param {UIStateManager} dependencies.uiStateManager - UI state management (validated here)
 */
constructor({ logger, characterBuilderService, eventBus, schemaValidator, uiStateManager }) {
  super({ logger, characterBuilderService, eventBus, schemaValidator });

  // Validate additional service not handled by base class
  validateDependency(uiStateManager, 'UIStateManager', logger, {
    requiredMethods: ['showState', 'showError']
  });

  this.#uiStateManager = uiStateManager;

  // Initialize page-specific fields
  this.#currentFilter = '';
  this.#currentConcept = null;
  this.#directionsData = [];
  this.#inPlaceEditors = new Map();
}
```

## Testing the Changes

### Step 1: Unit Test Verification

Run existing constructor tests:

```bash
npm test -- tests/unit/domUI/thematicDirectionsManagerController.test.js --grep "constructor"
```

### Step 2: Validation Error Testing

Test that validation still works by passing invalid dependencies:

```javascript
// This should throw an error (base class validation for core dependencies)
const controller = new ThematicDirectionsManagerController({
  logger: null, // Invalid - base class will catch this
  characterBuilderService: mockService,
  eventBus: mockEventBus,
  schemaValidator: mockValidator,
  uiStateManager: mockUIStateManager,
});

// This should throw an error (our additional validation)
const controller2 = new ThematicDirectionsManagerController({
  logger: mockLogger,
  characterBuilderService: mockService,
  eventBus: mockEventBus,
  schemaValidator: mockValidator,
  uiStateManager: null, // Invalid - our validation will catch this
});
```

### Step 3: Integration Testing

Ensure the controller initializes properly in the full application context.

## Code Comparison

### Current (31 lines total, 28 lines of validation):

```javascript
constructor({ logger, characterBuilderService, eventBus, schemaValidator }) {
  super({ logger, characterBuilderService, eventBus, schemaValidator });

  // Keep existing validation for now (to be cleaned up in THEDIRMIG-003) - 25 lines
  validateDependency(logger, 'ILogger', logger, { ... });
  validateDependency(characterBuilderService, 'CharacterBuilderService', logger, { ... });
  validateDependency(eventBus, 'ISafeEventDispatcher', logger, { ... });
  validateDependency(schemaValidator, 'ISchemaValidator', logger, { ... });

  // Dependencies are now handled by super() - assignments removed
}
```

### After (10-15 lines):

```javascript
constructor({ logger, characterBuilderService, eventBus, schemaValidator, uiStateManager }) {
  super({ logger, characterBuilderService, eventBus, schemaValidator }); // Base class handles core validation

  // Validate additional service not handled by base class
  validateDependency(uiStateManager, 'UIStateManager', logger, {
    requiredMethods: ['showState', 'showError']
  });

  this.#uiStateManager = uiStateManager;

  // Initialize page-specific fields only
  this.#currentFilter = '';
  this.#currentConcept = null;
  this.#directionsData = [];
  this.#inPlaceEditors = new Map();
}
```

## Benefits Achieved

1. **Code Reduction**: ~50% reduction in constructor size (31 → 15 lines)
2. **Standardization**: Consistent core validation across all character builder controllers
3. **Maintainability**: Reduced duplication by leveraging base class validation
4. **Clarity**: Constructor focused on additional services and page-specific initialization
5. **Correctness**: Proper handling of UIStateManager which was missing from base class

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] Constructor reduced to 10-15 lines (50% reduction)
- [ ] Core dependency validation delegated to base class via super()
- [ ] UIStateManager validation added as additional service
- [ ] Page-specific fields initialized efficiently
- [ ] No validation coverage lost
- [ ] All existing tests pass
- [ ] No runtime errors during initialization
- [ ] JSDoc updated with correct dependency signature
- [ ] Code committed with descriptive message
