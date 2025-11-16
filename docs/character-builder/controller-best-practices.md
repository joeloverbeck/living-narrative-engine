# Character Builder Controller Best Practices

This guide summarizes the current production patterns for controllers that
extend `BaseCharacterBuilderController`. The guidelines reflect the
BASCHACUICONREF-011 migration work and should be used until the base
controller refactor exits the planning stage documented in
`tickets/BASCHACUICONREF-000-overview.md`.

## Design Principles

- **Prefer service getters over direct DOM access.** Use
  `_getDomManager().cacheElementsFromMap()` and
  `_getDomManager().getElement()` to keep caching and validation
  consistent across controllers.
- **Use the event registry for listener management.** Register listeners
  through `this.eventRegistry.addEventListener()` to benefit from shared
  tracking and teardown behavior. The `_addEventListener()` wrapper
  remains available for brevity.
- **Keep error handling centralized.** Call `_handleServiceError()` for
  service failures so error categorization, telemetry, and UI state
  transitions remain consistent.
- **Debounce with the async utilities toolkit.** Use
  `_getAsyncUtilitiesToolkit().debounce()` when throttling frequent
  operations (e.g., text input) to avoid duplicating debounce logic.
- **Respect lifecycle orchestration.** Implement caching inside
  `_cacheElements()`, event wiring inside `_registerEventListeners()`,
  and teardown inside `_preDestroy()` or the lifecycle orchestrator
  hooks so the base controller can manage initialization and cleanup.

## DOM Caching

- Cache DOM elements via `_getDomManager().cacheElementsFromMap()` in
  `_cacheElements()` to keep selector validation, performance metrics,
  and cache clearing centralized.
- Retrieve elements using `_getElement()` so your controller benefits
  from consistent error messages and element cache instrumentation.
- When adding new selectors, include validation flags in the map entries
  to prevent silent failures during initialization.

## Event Listener Patterns

- Register listeners with `this.eventRegistry.addEventListener(element,
  eventName, handler)` after retrieving the element with `_getElement()`.
- For concise wiring, `_addEventListener(elementName, eventName,
  handler)` remains acceptable. The wrapper routes through the event
  registry and keeps listener cleanup connected to controller teardown.
- Prefer bound methods over inline lambdas when listeners need to be
  removed individually.

## Error Handling

- Surface recoverable service failures via `_handleServiceError(error,
  operationName, userMessage)` to keep UI messaging and telemetry
  aligned with the ErrorHandlingStrategy service.
- When adding new service calls, log the `operationName` consistently
  (e.g., `loadThematicDirections`, `fetchSpeechPatterns`) to simplify
  future validation and test updates.

## Debounce and Async Utilities

- Use the async utilities toolkit for debounce and throttle helpers:

```javascript
this.#debouncedHandler = this._getAsyncUtilitiesToolkit().debounce(
  handlerFunction,
  delayMs,
  options
);
```

- Store debounced handlers on private fields so they can be cleared
  during destruction.

## Migration Status

- Wrapper methods remain supported in production. Future work may migrate
  controllers to direct service calls; new controllers should prefer
  service getters to minimize future refactoring.

## Validation Checklist for New Controllers

- [ ] DOM selectors cached via `_getDomManager().cacheElementsFromMap()`
- [ ] Listeners registered through `eventRegistry` or `_addEventListener()`
- [ ] Errors routed through `_handleServiceError()`
- [ ] Debounced work uses `_getAsyncUtilitiesToolkit().debounce()`
- [ ] Lifecycle hooks implemented for initialization and teardown
