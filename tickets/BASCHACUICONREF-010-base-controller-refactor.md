# BASCHACUICONREF-010: Finalize BaseCharacterBuilderController Refactor

**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 5 days  
**Phase:** 2 - Controller Simplification  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Phase 2 section)

## Objective

Reduce `src/characterBuilder/controllers/BaseCharacterBuilderController.js` from 3,667 lines to ~450 by delegating responsibilities to the extracted services and cleaning up transitional methods.

## Implementation Tasks

1. **Constructor Cleanup**  
   - Update constructor to accept injected services (`domManager`, `eventRegistry`, `lifecycle`, `errorHandler`, `asyncUtils`, `performanceMonitor`, `validator`, `memoryManager`, `uiStateManager`).  
   - Remove legacy state fields replaced by services.  
   - Validate dependencies and throw descriptive errors when missing.

2. **Getter/Delegation Layer**  
   - Provide protected getters for all injected services plus existing dependencies (`logger`, `eventBus`, `characterBuilderService`, `schemaValidator`).  
   - Remove old `_getElement`, `_addEventListener`, `_debounce`, etc., ensuring subclasses call service getters instead (see BASCHACUICONREF-011).

3. **Lifecycle Delegation**  
   - Replace `initialize`, `destroy`, `reinitialize`, and lifecycle hook invocation with pass-through calls to `ControllerLifecycleOrchestrator`.  
   - Register base hooks to call `this._preInitialize()`, `_loadInitialData()`, `_initializeUIState()`, `_postInitialize()` so subclasses can override as before.

4. **State/Error/Validation Helpers**  
   - `_showState`, `_handleError`, `_validateData` should simply delegate to `uiStateManager`, `errorHandler`, `validator`.  
   - Remove redundant wrappers now covered by services.

5. **File Reorganization**  
   - Split large file into logical sections (constructor, getters, lifecycle, template hooks, utility delegations).  
   - Ensure JSDoc at top explains new architecture + service composition.

6. **Compatibility Layer Removal**  
   - Delete transitional helper methods introduced in BASCHACUICONREF-001..008.  
   - Update all internal references to use service getters.  
   - Provide codemod-friendly comments for subclass migrations (link to BASCHACUICONREF-011 for final adjustments).

7. **Tests + Coverage**  
   - Update existing integration/unit tests referencing removed methods.  
   - Add new `tests/integration/characterBuilder/controllers/baseController.integration.test.js` verifying initialization/destroy flows with mocked services.  
   - Ensure Jest coverage remains ≥90% lines/branches for controller file.

## Acceptance Criteria

- `BaseCharacterBuilderController.js` ≤ 500 lines with no direct DOM/event/timer/error logic.  
- All new services injected via constructor and exposed through getters.  
- Integration tests confirm controller orchestrates services correctly.  
- Code reviewers sign off that subclass API is stable (except for planned adjustments in BASCHACUICONREF-011).
