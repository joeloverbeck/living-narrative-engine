# BASCHACUICONREF-001: Extract DOMElementManager Service

**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 3 days  
**Phase:** 1 - Service Extraction (P1 Proof of Concept)  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.1)

## Objective

Isolate DOM caching + manipulation responsibilities from `src/characterBuilder/controllers/BaseCharacterBuilderController.js` into a reusable `DOMElementManager` service under `src/characterBuilder/services/domElementManager.js` with full unit tests.

## Implementation Tasks

1. **Module Creation**  
   - Create `src/characterBuilder/services/domElementManager.js`.  
   - Implement constructor that accepts `{ logger }` and validates required logging methods via existing dependency helpers.  
   - Port methods listed in the report (`_cacheElement`, `_cacheElementsFromMap`, `_getElement`, `_hasElement`, `_getElements`, `_refreshElement`, `_showElement`, `_hideElement`, `_toggleElement`, `_setElementEnabled`, `_setElementText`, `_addElementClass`, `_removeElementClass`, `_validateElement`, `_validateElementCache`, `_clearElementCache`).  
   - Preserve existing behavior regarding selector validation, error handling, and logging (copy relevant logic from the current controller but adapt to new class + naming).  
   - Maintain internal `#elements` Map (or similar) with encapsulated helpers for normalization of selectors / DOM references.

2. **Unit Tests**  
   - Add `tests/unit/characterBuilder/services/domElementManager.test.js`.  
   - Cover caching flows (single element, map-based caching, refreshing, clearing), validation failures, DOM operations (show/hide/toggle, enable/disable, text updates, class toggles).  
   - Provide mocks for DOM nodes (e.g., `document.createElement`) and ensure cleanup between tests.  
   - Target ≥90% coverage lines/branches.

3. **Base Controller Integration Point**  
   - Introduce a shim method (e.g., `_getDomManager()` or property) in `BaseCharacterBuilderController` that delegates to the new service, but keep legacy methods temporarily for backwards compatibility.  
   - Update at least one non-critical method (e.g., `_cacheElementsFromMap`) to call the service internally to validate wiring.  
   - Add TODO comment referencing BASCHACUICONREF-010 for full adoption.

4. **Documentation**  
   - Update `docs/architecture/base-character-builder-refactor.md` (create if missing) with DOMElementManager responsibilities, public API, and testing strategy.

## Acceptance Criteria

- `domElementManager.js` exports a class that encapsulates all DOM cache/manipulation responsibilities with no direct references remaining in the base controller (except transitional delegation).  
- Unit tests pass locally via `npm run test:unit -- domElementManager` (document command in PR).  
- Base controller uses the service for caching logic without altering subclass APIs.  
- Documentation reflects new service and migration status.
