# Base Character Builder Refactor Program

The BASCHACUICONREF program tracks the extraction of services from the
monolithic `BaseCharacterBuilderController`. Phase 1 focuses on DOM
responsibilities which are now encapsulated inside the
`DOMElementManager` service.

## DOMElementManager responsibilities

- Maintain a plain-object cache so `BaseCharacterBuilderController#elements`
  continues to expose a shallow copy for tests and subclasses.
- Normalize selector configs (`string` or `{ selector, required, validate }`).
- Cache individual selectors with ID optimizations and timing metrics via
  `performance.now()`.
- Batch-cache element maps while capturing stats and validation errors.
- Provide DOM manipulation helpers (show/hide/toggle, text/class helpers,
  enable/disable) and cache validation/clearing routines.
- Surface consistent logging by reusing the controller logger (debug/info
  for cache hits, warn/error for cache misses and validation failures).

## Integration notes

- `BaseCharacterBuilderController` now lazily instantiates a
  `DOMElementManager` via `_getDomManager()` which wires in the controller
  logger, `document`, and `performance` references.
- Existing methods such as `_cacheElement`, `_cacheElementsFromMap`,
  `_getElement`, and `_clearElementCache` delegate to the service, so
  subclasses continue calling the same APIs without modification.
- Cache resets performed during `_resetInitializationState()` route
  through `domElementManager.clearCache()` ensuring shared metrics are
  recorded in one place.
- TODO(BASCHACUICONREF-010) will revisit the shim so controllers can
  inject a mocked service directly and remove the remaining wrapper
  methods once downstream controllers adopt the new surface area.

## ControllerLifecycleOrchestrator responsibilities

- Coordinates initialization, reinitialization, and destruction for every
  controller via `src/characterBuilder/services/controllerLifecycleOrchestrator.js`.
- Owns state guards (`isInitialized`, `isDestroying`, etc.) and exposes
  `checkDestroyed`/`makeDestructionSafe` helpers for UI callbacks.
- Provides hook registration so controllers (and bootstrap overrides) can
  attach logic to named phases without rewriting the orchestration code.

### Lifecycle phases and contracts

- **Initialization (async):** `preInit`, `cacheElements` (required),
  `initServices`, `setupEventListeners` (required), `loadData`, `initUI`,
  `postInit`, plus `initError` which receives the thrown error.
- **Destruction (sync):** `destroy:pre`, `destroy:cancelOperations`,
  `destroy:removeListeners`, `destroy:cleanupServices`,
  `destroy:clearElements`, `destroy:cleanupTasks`,
  `destroy:clearReferences`, `destroy:post`.
- Initialization hooks may return promises (awaited in sequence);
  destruction hooks are expected to be synchronous to preserve the
  existing `destroy()` contract.

### Integration notes

- `BaseCharacterBuilderController` now injects a
  `ControllerLifecycleOrchestrator` (or creates one) and registers
  default hooks that bridge to familiar methods
  (`_preInitialize`, `_initializeServices`, `_preDestroy`, etc.).
- Subclasses continue overriding the same protected methods while the
  orchestrator handles logging, concurrency guards, cleanup tasks, and
  event dispatching.
- Tests can exercise the service directly via
  `tests/unit/characterBuilder/services/controllerLifecycleOrchestrator.test.js`
  with `npm run test:unit -- controllerLifecycleOrchestrator`.

## Testing strategy

- Unit tests live in
  `tests/unit/characterBuilder/services/domElementManager.test.js` and
  mirror the legacy controller assertions for caching, normalization, and
  manipulation helpers.
- Run `npm run test:unit -- domElementManager` to execute the targeted
  suite during development or CI.
- Integration tests for individual controllers continue to run under the
  existing Jest configs; no changes are required until additional
  services are extracted in later BASCHACUICONREF tickets.

## Documentation + communication

- Quick reference docs now direct teams to the shared service so they can
  rely on the consistent caching layer instead of duplicating logic in
  subclasses.
- Future BASCHACUICONREF updates should continue adding sections here to
  describe new services (event managers, API coordinators, etc.) along
  with the corresponding test commands and ownership updates referenced
  in BASCHACUICONREF-000.

## ErrorHandlingStrategy responsibilities

- Centralizes the heuristics previously implemented inside
  `BaseCharacterBuilderController` for creating and categorizing error
  objects. The service keeps the same taxonomy:
  - `validation` – invalid user input or schema errors.
  - `network` – connectivity, timeout, and fetch failures.
  - `system` – lifecycle, dependency, or unexpected exceptions.
  - `user` – user initiated cancellation/flow breaks (reserved for
    future extraction but preserved for telemetry consistency).
  - `permission` – authorization or capability mismatches.
  - `not_found` – resources that cannot be resolved (404s, missing
    documents, etc.).
- Emits `SYSTEM_ERROR_OCCURRED` with the original payload shape so
  observers (telemetry, overlays, etc.) continue to work without
  modifications.
- Mirrors the `_showError → _showState(UI_STATES.ERROR, …)` flow via the
  controller-provided hooks rather than instantiating `UIStateManager`
  instances on its own. Controllers can provide different UI entry
  points or override `_showError` without re-implementing the rest of
  the pipeline.
- Provides `handleError`, `handleServiceError`,
  `executeWithErrorHandling`, `createError`, and `wrapError` façades so
  controller subclasses continue calling the same methods while the
  underlying implementation is handled by the service.
- Supports retry + recovery orchestration by letting controllers
  register category-specific handlers. For the base controller the
  default handlers wrap `_retryLastOperation()` (network) and
  `_reinitialize()` (system initialization failures). Later tickets can
  plug additional category handlers or migrate to specialized recovery
  services without editing controller code again.

### Usage

```
const strategy = new ErrorHandlingStrategy({
  logger,
  eventBus,
  controllerName: 'TraitsRewriterController',
  showError: (message, details) => this._showError(message, details),
  dispatchErrorEvent: (payload) => this._dispatchErrorEvent(payload),
  errorCategories: ERROR_CATEGORIES,
  errorSeverity: ERROR_SEVERITY,
});

return strategy.executeWithErrorHandling(
  () => this.characterBuilderService.loadConcepts(),
  'loadConcepts',
  { retries: 2, userErrorMessage: 'Unable to load concepts.' }
);
```

### Testing strategy

- Unit tests live in
  `tests/unit/characterBuilder/services/errorHandlingStrategy.test.js` and
  cover the categorization heuristics, retry metadata propagation, UI
  hooks, recoverability decisions, and recovery handler registration.
- Run `npx jest tests/unit/characterBuilder/services/errorHandlingStrategy.test.js`
  to execute the suite locally when updating the service.
