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
