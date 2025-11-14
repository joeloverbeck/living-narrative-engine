# BASCHACUICONREF-002: Extract EventListenerRegistry Service

**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 3 days  
**Phase:** 1 - Service Extraction (P1 Proof of Concept)  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.2)

## Objective

Move all event listener tracking, subscription, debounce/throttle wrapping, and teardown logic out of `BaseCharacterBuilderController` into `src/characterBuilder/services/eventListenerRegistry.js`, ensuring deterministic cleanup and metrics reporting.

## Current State Notes

- `_addEventListener` currently accepts either a cached element key or a DOM element, resolves keys through the controller's `_getElement`, binds handlers to the controller instance, defaults listeners to passive mode, logs failures, and stores metadata objects containing `{ type, element, event, handler, originalHandler, options, id }` inside the `#eventListeners` array for later teardown.
- `_subscribeToEvent` binds handlers to the controller instance before calling `ISafeEventDispatcher.subscribe`, storing the returned unsubscribe closure in the listener metadata (`type: 'eventBus'`). Missing `eventBus` instances log warnings and return `null` to match existing tests.
- `_addDelegatedListener` relies on `_getContainer`/`_getElement` to ensure that the matched `closest()` element is inside the tracked container before invoking the bound handler.
- `_addDebouncedListener` and `_addThrottledListener` wrap the controller's `_debounce`/`_throttle` helpers, store the wrapped functions inside `#debouncedHandlers`/`#throttledHandlers`, and expect `_removeAllEventListeners` to clear those Maps so repeated `destroy()` calls remain idempotent.
- `_addAsyncClickHandler` toggles the target element's disabled state, `textContent`, and `is-loading` class while awaiting the async handler and logs any failures via the injected logger before invoking optional `onError` hooks.
- `_removeAllEventListeners` iterates over `#eventListeners` (covering DOM listeners and event bus subscriptions) to detach each handler and then clears `#debouncedHandlers`/`#throttledHandlers`; `_preventDefault` simply wraps `event.preventDefault()`/`event.stopPropagation()` before invoking the provided handler.

## Implementation Tasks

1. **Service Definition**
   - Implement `EventListenerRegistry` class with constructor accepting `{ logger, asyncUtilities }`.
   - Port methods: `_addEventListener`, `_subscribeToEvent`, `_addDelegatedListener`, `_addDebouncedListener`, `_addThrottledListener`, `_addAsyncClickHandler`, `_removeEventListener`, `_removeAllEventListeners`, `_getEventListenerStats`, `_preventDefault`.
   - Replace private controller state (`#eventListeners`, `#eventListenerIdCounter`, `#debouncedHandlers`, `#throttledHandlers`) with encapsulated properties.
   - Ensure IDs are stable strings (prefix + increment).
   - Provide metadata (element reference, event type, options) for debugging + stats.
   - Keep the protected `_add*` helpers on `BaseCharacterBuilderController` as thin wrappers that resolve cached element keys (`_getElement`/`_getContainer`), bind handlers to the controller context, and then delegate into the registry, since the registry cannot reach into controller private fields.

2. **Async Utilities Integration**
   - Consume `AsyncUtilitiesToolkit` (from BASCHACUICONREF-005) via dependency injection; if toolkit not yet extracted, temporarily wrap existing `_debounce/_throttle` logic behind adapter functions with TODO referencing BASCHACUICONREF-005.
   - Guarantee `removeAllListeners` clears timers / wrappers to prevent leaks.
   - When the toolkit is unavailable, instantiate the registry from the controller with `asyncUtilities` adapters created from the existing `_debounce`/`_throttle` methods so the service owns the Maps tracking debounced/throttled handlers instead of the controller.

3. **Unit Tests**
   - Create `tests/unit/characterBuilder/services/eventListenerRegistry.test.js`.
   - Mock DOM elements and event targets; verify listener registration, delegated handler filtering, event bus subscription, throttle/debounce scheduling, and cleanup semantics.
   - Include regression test ensuring repeated `destroy()` on controller triggers idempotent removal.
   - Achieve ≥90% coverage.
   - Port existing expectations from `BaseCharacterBuilderController` tests (ID stability, null return when elements are missing, passive option defaults, stats structure) to ensure behavior parity before deleting the controller-specific assertions.

4. **Controller Wiring**
   - Add getter (e.g., `eventRegistry`) on base controller returning the service instance.
   - Update existing event setup helpers to use the service internally while keeping subclass API stable for now.
   - Document migration path for subclasses that directly call `_addEventListener` to transition to service usage (link to BASCHACUICONREF-011).
   - Lazily instantiate the registry inside the controller (e.g., private `#eventListenerRegistry`) using the controller logger and async utility adapters so `_addEventListener`, `_subscribeToEvent`, `_addDelegatedListener`, `_addDebouncedListener`, `_addThrottledListener`, `_addAsyncClickHandler`, `_removeEventListener`, `_removeAllEventListeners`, `_getEventListenerStats`, and `_preventDefault` simply delegate to it without changing the subclass-visible signatures.

## Acceptance Criteria

- Event listener state fully encapsulated in `EventListenerRegistry`.
- Base controller no longer directly manipulates listener Maps/Sets.
- Comprehensive unit tests exist and pass via `npm run test:unit -- eventListenerRegistry`.
- Service API documented in architecture guide, including lifecycle responsibilities.
- Existing controller helpers continue to accept cached element keys and automatically bind handlers to the controller context so subclasses and legacy controllers remain untouched during Phase 1.
