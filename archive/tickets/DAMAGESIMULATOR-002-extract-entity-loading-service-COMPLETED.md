# DAMAGESIMULATOR-002: Extract EntityLoadingService from AnatomyVisualizerUI

## Summary
Extract the entity loading and state coordination logic from `AnatomyVisualizerUI` into a reusable `EntityLoadingService`. This service handles creating entity instances and coordinating with `VisualizerStateController` for anatomy loading detection.

## Dependencies
- DAMAGESIMULATOR-001 must be completed first (establishes shared/ directory pattern)

## Files to Touch

### Create
- `src/domUI/shared/EntityLoadingService.js` - New shared service
- `tests/unit/domUI/shared/EntityLoadingService.test.js` - Unit tests

### Modify
- `src/domUI/AnatomyVisualizerUI.js` - Replace inline logic with service calls
- `src/dependencyInjection/registrations/visualizerRegistrations.js` - Register new service

## Out of Scope
- DO NOT modify any damage-related code
- DO NOT create the damage-simulator page yet
- DO NOT touch `RecipeSelectorService` (previous ticket)
- DO NOT touch `AnatomyDataExtractor` (next ticket)
- DO NOT modify `VisualizerStateController` internals
- DO NOT modify `AnatomyLoadingDetector` internals
- DO NOT modify any files in `data/mods/`
- DO NOT change any schema files

## Acceptance Criteria

### Tests That Must Pass
1. **Unit: EntityLoadingService.test.js**
   - `should clear tracked entity instances before loading new entity`
   - `should reset state controller before loading`
   - `should throw InvalidArgumentError if definition lacks anatomy:body`
   - `should create entity instance from definition ID`
   - `should wait for anatomy loading via state controller`
   - `should return instance ID on successful load`
   - `should handle loading errors gracefully`
   - `should validate definition exists in registry`

2. **Existing Tests Must Continue to Pass**
   - All existing `tests/unit/domUI/AnatomyVisualizerUI.test.js` tests
   - All existing `tests/integration/visualizer/` tests
   - `npm run test:ci` passes

### Invariants
1. Anatomy visualizer entity loading behavior unchanged from user perspective
2. State transitions (IDLE → LOADING → LOADED) preserved
3. AnatomyLoadingDetector polling behavior unchanged
4. Error handling for missing definitions unchanged
5. Entity cleanup before new load unchanged
6. DI registration follows existing patterns

## Implementation Notes

### EntityLoadingService Interface
```javascript
class EntityLoadingService {
  constructor({ entityManager, dataRegistry, stateController, logger })

  /**
   * Load an entity and wait for its anatomy to be ready
   * @param {string} definitionId
   * @returns {Promise<string>} Instance ID
   * @throws {InvalidArgumentError} If definition lacks anatomy:body
   */
  async loadEntityWithAnatomy(definitionId)

  /**
   * Clear current entity state
   */
  clearCurrentEntity()
}
```

### Code to Extract from AnatomyVisualizerUI
Look for `_loadEntity()` method (lines 401-446) and `_clearPreviousEntities()` method (lines 453-470):
1. Clears previous entities via `_clearPreviousEntities()` which calls `entityManager.removeEntityInstance()` on individually tracked entity IDs (NOT `clearAllInstances()`)
2. Resets state controller if not in IDLE state
3. Validates definition exists and has `anatomy:body` component
4. Creates new instance with `entityManager.createEntityInstance()`
5. Tracks created entity ID in `_createdEntities` array
6. Calls `stateController.selectEntity(instanceId)`

**Important**: The cleanup uses targeted removal of tracked entities, not bulk clearing. The service should maintain this targeted cleanup behavior.

## Definition of Done
- [x] EntityLoadingService created with full JSDoc
- [x] Unit tests with ≥90% coverage on new service
- [x] AnatomyVisualizerUI refactored to use service
- [x] DI token added to tokens-core.js
- [x] Service registered in visualizerRegistrations.js
- [x] All existing tests pass
- [x] ESLint passes: `npx eslint src/domUI/shared/EntityLoadingService.js`

## Outcome

### Implementation Summary
Successfully extracted entity loading logic from `AnatomyVisualizerUI._loadEntity()` into a reusable `EntityLoadingService` class.

### Files Created
1. **`src/domUI/shared/EntityLoadingService.js`** - New shared service (125 lines)
   - Implements entity loading with anatomy validation
   - Tracks created entities for targeted cleanup
   - Coordinates with VisualizerStateController for state management

2. **`tests/unit/domUI/shared/EntityLoadingService.test.js`** - Comprehensive unit tests (436 lines)
   - 26 test cases covering all acceptance criteria
   - Constructor validation tests
   - Load/clear/state management tests

### Files Modified
1. **`src/dependencyInjection/tokens/tokens-core.js`** - Added `IEntityLoadingService` token
2. **`src/dependencyInjection/registrations/visualizerRegistrations.js`** - Registered EntityLoadingService
3. **`src/domUI/AnatomyVisualizerUI.js`** - Added optional entityLoadingService parameter with delegation pattern
4. **`src/anatomy-visualizer.js`** - Resolves and injects EntityLoadingService
5. **`tests/unit/domUI/AnatomyVisualizerUI.test.js`** - Added 3 tests for service delegation

### Key Design Decisions
1. **Optional Service Pattern**: EntityLoadingService is an optional dependency in AnatomyVisualizerUI with fallback to inline implementation, following the same pattern as RecipeSelectorService for backward compatibility.

2. **Targeted Entity Cleanup**: Service uses `removeEntityInstance()` on individually tracked entity IDs rather than `clearAllInstances()` - preserving the targeted cleanup behavior from the original implementation.

3. **State Controller Coordination**: Service handles state reset logic (reset if not IDLE) and waits for anatomy loading via `selectEntity()`.

### Test Results
- EntityLoadingService.test.js: 26 tests passing
- AnatomyVisualizerUI.test.js: 14 tests passing (including 3 new delegation tests)
- All existing visualizer integration tests continue to pass

### Technical Notes
- ESLint warning for hardcoded `anatomy:body` reference is expected (component validation)
- Service follows existing DI patterns with validateDependency for constructor validation
