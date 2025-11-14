# BASCHACUICONREF-001: Extract DOMElementManager Service

**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 3 days  
**Phase:** 1 - Service Extraction (P1 Proof of Concept)  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.1)

## Objective

Isolate DOM caching + manipulation responsibilities from `src/characterBuilder/controllers/BaseCharacterBuilderController.js` into a reusable `DOMElementManager` service under `src/characterBuilder/services/domElementManager.js` with full unit tests.

## Current Production Behavior Notes

- `BaseCharacterBuilderController` currently defines a private `#elements = {}` object plus a public `get elements()` accessor that returns a shallow copy used heavily throughout the existing Jest suites (`tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js`). The new service must preserve this plain-object contract so the surrounding code and tests keep behaving consistently. (See `src/characterBuilder/controllers/BaseCharacterBuilderController.js`, lines 360-420.)
- DOM helpers already include `_normalizeElementConfig`, `_validateElement`, `_cacheElement`, `_cacheElementsFromMap`, `_validateElementCache`, `_clearElementCache`, `_getElement`, `_getElements`, `_hasElement`, `_refreshElement`, `_showElement`, `_hideElement`, `_toggleElement`, `_setElementEnabled`, `_setElementText`, `_addElementClass`, and `_removeElementClass`. These live roughly between lines 520-1,050 in the existing controller and rely on `document`, `performance.now()`, selector-specific logging, and `HTMLElement` validation.
- `_cacheElement` optimizes ID selectors by calling `document.getElementById` when the selector starts with `#` and has no spaces, otherwise falling back to `document.querySelector`. `_cacheElementsFromMap` funnels options such as `continueOnError`, `stopOnFirstError`, stats tracking, and custom validators via `_normalizeElementConfig`. `_resetInitializationState()` calls `_clearElementCache()`, so any integration must ensure cache resets still clear the service-backed storage.
- Existing behavior logs to the injected logger for cache hits, misses, validation warnings, and timing metrics via `performance.now()`. The service must either receive these dependencies explicitly (preferred for testability) or rely on the same globals so the instrumentation survives the extraction.

## Implementation Tasks

1. **Module Creation**
   - Create `src/characterBuilder/services/domElementManager.js`.
   - Implement constructor that accepts `{ logger, documentRef = document, performanceRef = performance }` (or comparable dependency-injection-friendly names) and validates required logging methods via `validateDependency`. This mirrors the controller’s current reliance on a logger plus the global `document`/`performance` objects while making the service testable.
   - Port the DOM responsibilities that currently live inside `BaseCharacterBuilderController`: `_cacheElement`, `_cacheElementsFromMap`, `_normalizeElementConfig`, `_getElement`, `_hasElement`, `_getElements`, `_refreshElement`, `_showElement`, `_hideElement`, `_toggleElement`, `_setElementEnabled`, `_setElementText`, `_addElementClass`, `_removeElementClass`, `_validateElement`, `_validateElementCache`, and `_clearElementCache`.
   - Preserve existing behavior regarding selector validation (including the ID vs selector optimization), logging messages, thrown error shapes, and the stats/errors objects returned from `_cacheElementsFromMap`. This includes continuing to track timing data via `performance.now()` and logging optional-miss debug statements.
   - Maintain the cache as a plain object to stay compatible with the public `elements` getter (`get elements() { return { ...this.#elements }; }`). If an internal `Map` wrapper is used, expose a serialization helper so the getter still returns the same structure consumed by existing tests and controllers.

2. **Unit Tests**
   - Add `tests/unit/characterBuilder/services/domElementManager.test.js`.
   - Mirror the cases already exercised in `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js` for `_cacheElement`, `_cacheElementsFromMap`, and the manipulation helpers so regressions are caught when the controller delegates. Include `_normalizeElementConfig` normalization and stats/error object assertions so parity with the current implementation is explicit.
   - Provide mocks for DOM nodes (the current tests create elements in `document.body`) and ensure cleanup between tests. Inject the mocked `documentRef`/`performanceRef` via the constructor rather than relying on globals so that the service can be unit tested without the controller.
   - Target ≥90% coverage lines/branches.

3. **Base Controller Integration Point**
   - Introduce a shim (private field + `_getDomManager()` helper) in `BaseCharacterBuilderController` that lazily instantiates the new service with the existing logger. The shim needs to ensure `_resetInitializationState()` and any other cache-clearing pathways still call through to `domElementManager.clearCache()`.
   - Update the DOM helper methods to delegate internally while keeping the existing method names so subclasses continue calling `_cacheElementsFromMap`, `_getElement`, etc. Start with `_cacheElementsFromMap` and `_cacheElement` to validate wiring, then add TODOs pointing at BASCHACUICONREF-010 for full replacement of the remaining helpers.
   - Add TODO comment referencing BASCHACUICONREF-010 for full adoption.

4. **Documentation**
   - Update `docs/characterBuilder/base-controller-quick-reference.md` (existing quick reference for subclasses) so it points teams to the new `DOMElementManager` service instead of the monolithic methods, and create/update `docs/architecture/base-character-builder-refactor.md` per the program overview to document responsibilities, public API, and testing strategy.

## Acceptance Criteria

- `domElementManager.js` exports a class that encapsulates all DOM cache/manipulation responsibilities with no direct references remaining in the base controller (except transitional delegation).
- Unit tests pass locally via `npm run test:unit -- domElementManager` (document command in PR), covering the normalization/config pathways currently tested against `BaseCharacterBuilderController`.
- Base controller uses the service for caching logic without altering subclass APIs, and the existing `elements` getter plus `_resetInitializationState()` continue to behave the same from a consumer perspective.
- Documentation reflects new service and migration status in both the quick reference (`docs/characterBuilder/base-controller-quick-reference.md`) and the architectural refactor doc referenced in BASCHACUICONREF-000.
