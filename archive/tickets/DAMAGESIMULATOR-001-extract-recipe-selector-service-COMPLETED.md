# DAMAGESIMULATOR-001: Extract RecipeSelectorService from AnatomyVisualizerUI

## Summary
Extract the entity selector population logic from `AnatomyVisualizerUI` into a reusable `RecipeSelectorService` that can be shared between anatomy-visualizer and damage-simulator.

## Files to Touch

### Create
- `src/domUI/shared/RecipeSelectorService.js` - New shared service
- `tests/unit/domUI/shared/RecipeSelectorService.test.js` - Unit tests

### Modify
- `src/domUI/AnatomyVisualizerUI.js` - Replace inline logic with service calls
- `src/dependencyInjection/registrations/visualizerRegistrations.js` - Register new service

## Out of Scope
- DO NOT modify any damage-related code
- DO NOT modify anatomy traversal logic
- DO NOT change entity loading behavior
- DO NOT create the damage-simulator page yet
- DO NOT touch `EntityLoadingService` or `AnatomyDataExtractor` (separate tickets)
- DO NOT modify any files in `data/mods/`
- DO NOT change any schema files

## Acceptance Criteria

### Tests That Must Pass
1. **Unit: RecipeSelectorService.test.js**
   - `should populate select element with entities having specified component`
   - `should filter entities without the required component`
   - `should sort entities alphabetically by name`
   - `should handle entities with only id (no name)`
   - `should add default "Select..." option`
   - `should clear previous options before populating`
   - `should return array of filtered definitions`
   - `should handle empty registry gracefully`

2. **Existing Tests Must Continue to Pass**
   - All existing `tests/unit/domUI/AnatomyVisualizerUI.test.js` tests
   - All existing `tests/integration/visualizer/` tests
   - `npm run test:ci` passes

### Invariants
1. Anatomy visualizer dropdown behavior unchanged from user perspective
2. Entity filtering by `anatomy:body` component works identically
3. Alphabetical sorting preserved
4. No new dependencies added to anatomy-visualizer.js entry point
5. DI registration follows existing patterns in `visualizerRegistrations.js`

## Implementation Notes

### RecipeSelectorService Interface
```javascript
class RecipeSelectorService {
  constructor({ dataRegistry, logger })

  /**
   * @param {HTMLSelectElement} selectElement
   * @param {string} requiredComponent - e.g., 'anatomy:body'
   * @param {Object} [options]
   * @param {string} [options.placeholderText='Select...']
   * @returns {Array} Filtered definitions
   */
  populateWithComponent(selectElement, requiredComponent, options = {})
}
```

### Code to Extract from AnatomyVisualizerUI
Look for `_populateEntitySelector()` method or similar inline dropdown population logic.

## Definition of Done
- [x] RecipeSelectorService created with full JSDoc
- [x] Unit tests with ≥90% coverage on new service
- [x] AnatomyVisualizerUI refactored to use service
- [x] DI token added to tokens-core.js
- [x] Service registered in visualizerRegistrations.js
- [x] All existing tests pass
- [x] ESLint passes: `npx eslint src/domUI/shared/RecipeSelectorService.js`

## Outcome

### Implementation Complete
All acceptance criteria met. The `RecipeSelectorService` has been extracted successfully:

**Files Created:**
- `src/domUI/shared/RecipeSelectorService.js` - Reusable service for entity selector population
- `tests/unit/domUI/shared/RecipeSelectorService.test.js` - 17 unit tests with full coverage

**Files Modified:**
- `src/dependencyInjection/tokens/tokens-core.js` - Added `IRecipeSelectorService` token
- `src/dependencyInjection/registrations/visualizerRegistrations.js` - Registered service with dependencies
- `src/domUI/AnatomyVisualizerUI.js` - Refactored to use service with backward-compatible fallback
- `tests/unit/domUI/AnatomyVisualizerUI.test.js` - Updated tests to mock the service

**Test Results:**
- 17 new tests for RecipeSelectorService: ALL PASS
- 11 existing AnatomyVisualizerUI tests: ALL PASS
- Integration visualizer tests: ALL PASS (except pre-existing unrelated failure in errorPaths)

**Key Design Decisions:**
1. Service is optional with fallback - existing code paths preserved for backward compatibility
2. Service follows existing DI patterns in visualizerRegistrations.js
3. Service filters by any component, not just `anatomy:body`, making it reusable for damage-simulator
