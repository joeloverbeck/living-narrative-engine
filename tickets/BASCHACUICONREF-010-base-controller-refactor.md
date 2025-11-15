# BASCHACUICONREF-010: Finalize BaseCharacterBuilderController Refactor

**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 5 days  
**Phase:** 2 - Controller Simplification  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Phase 2 section)

## Objective

Reduce `src/characterBuilder/controllers/BaseCharacterBuilderController.js` from the current 2,892 lines to ~450 (per the BASCHACUICONREF-000 program target) by delegating responsibilities to the extracted services and cleaning up the remaining transitional methods.

## Implementation Tasks

1. **Constructor Dependency Rationalization**
   - The constructor already supports injecting `domElementManager`, `eventListenerRegistry`, `controllerLifecycleOrchestrator`, `asyncUtilitiesToolkit`, `performanceMonitor`, `memoryManager`, `errorHandlingStrategy`, and `validationService`. Tighten this by eliminating the fallback instantiations wired through `#configureInjectedServices`, `#logDependencyFallback`, and the `_getDomManager`/`#getEventListenerRegistry` helpers so the controller behaves as a thin coordination layer instead of re-creating services.
   - Remove legacy state fields and caches that become redundant after DI is enforced (e.g., `#elements` mirroring DOM lookups once DOM helpers move into the DOM manager service).
   - Ensure dependency validation continues to throw descriptive errors using the existing `#validateCoreDependencies` utilities.

2. **Getter/Delegation Layer**
   - Keep the existing protected getters (`logger`, `eventBus`, `characterBuilderService`, `schemaValidator`, `eventRegistry`, `_getAsyncUtilitiesToolkit`, etc.) but collapse the thick DOM/event wrappers such as `_getElement`, `_addEventListener`, `_debounce`, and `_throttle` so subclasses interact with the injected services directly.
   - Update inline documentation to highlight the expectation that subclasses rely on these service getters rather than legacy helpers (coordinate with BASCHACUICONREF-011 for downstream controller updates).

3. **Lifecycle Delegation**
   - `initialize`/`destroy` already proxy through `ControllerLifecycleOrchestrator`. Focus this task on trimming any remaining direct lifecycle management logic outside the orchestrator (for example, `#configureLifecycleHooks`, manual hook registration comments, and bespoke destroy guards) so the controller only wires the orchestrator with the standard `_preInitialize`/`_loadInitialData`/`_initializeUIState`/`_postInitialize` hooks promised in BASCHACUICONREF-000.
   - Confirm the orchestrator wiring covers the entire lifecycle (including `DESTRUCTION_PHASES`) and document these hooks at the top of the file for subclass authors.

4. **State/Error/Validation Helpers**
   - Update `_showState`, `_handleError`, `_validateData`, and related helpers to delegate straight to the injected `UIStateManager`, `ErrorHandlingStrategy`, and `ValidationService`. Several of these helpers still contain local branching or UI manipulation that should move into the specialized services.
   - Delete redundant wrappers once delegation is complete and ensure the error strategy wiring in `#configureInjectedServices` remains intact.

5. **File Reorganization**  
   - Split large file into logical sections (constructor, getters, lifecycle, template hooks, utility delegations).  
   - Ensure JSDoc at top explains new architecture + service composition.

6. **Compatibility Layer Removal**
   - Delete the transitional helper methods introduced earlier in the program (e.g., `_getElement`, `_bindAsyncClickHandler`, `_preventDefault`, `_wrapAsyncOperation`) that currently sit between subclasses and the injected services.
   - Update all internal references to use the direct service getters.
   - Provide codemod-friendly comments for subclass migrations (link to BASCHACUICONREF-011 for final adjustments) once those helpers disappear.

7. **Tests + Coverage**
   - Update the existing `tests/integration/characterBuilder/controllers/BaseCharacterBuilderController.*` suites (DI, utilities, recovery, etc.) plus any relevant unit tests to reflect the removed helper methods.
   - Add or expand integration coverage for initialization/destroy flows using mocked services within that same directory rather than creating a new suite path.
   - Ensure Jest coverage remains ≥90% lines/branches for the controller file after refactoring.

## Acceptance Criteria

- `BaseCharacterBuilderController.js` ≤ 500 lines with no direct DOM/event/timer/error logic.
- All new services injected via constructor and exposed through getters.
- Integration tests confirm the controller orchestrates services correctly via the updated suites under `tests/integration/characterBuilder/controllers/`.
- Code reviewers sign off that subclass API is stable (except for planned adjustments in BASCHACUICONREF-011).
