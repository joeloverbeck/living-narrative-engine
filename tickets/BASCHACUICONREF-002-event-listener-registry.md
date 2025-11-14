# BASCHACUICONREF-002: Extract EventListenerRegistry Service

**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 3 days  
**Phase:** 1 - Service Extraction (P1 Proof of Concept)  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.2)

## Objective

Move all event listener tracking, subscription, debounce/throttle wrapping, and teardown logic out of `BaseCharacterBuilderController` into `src/characterBuilder/services/eventListenerRegistry.js`, ensuring deterministic cleanup and metrics reporting.

## Implementation Tasks

1. **Service Definition**  
   - Implement `EventListenerRegistry` class with constructor accepting `{ logger, asyncUtilities }`.  
   - Port methods: `_addEventListener`, `_subscribeToEvent`, `_addDelegatedListener`, `_addDebouncedListener`, `_addThrottledListener`, `_addAsyncClickHandler`, `_removeEventListener`, `_removeAllEventListeners`, `_getEventListenerStats`, `_preventDefault`.  
   - Replace private controller state (`#eventListeners`, `#eventListenerIdCounter`, `#debouncedHandlers`, `#throttledHandlers`) with encapsulated properties.  
   - Ensure IDs are stable strings (prefix + increment).  
   - Provide metadata (element reference, event type, options) for debugging + stats.

2. **Async Utilities Integration**  
   - Consume `AsyncUtilitiesToolkit` (from BASCHACUICONREF-005) via dependency injection; if toolkit not yet extracted, temporarily wrap existing `_debounce/_throttle` logic behind adapter functions with TODO referencing BASCHACUICONREF-005.  
   - Guarantee `removeAllListeners` clears timers / wrappers to prevent leaks.

3. **Unit Tests**  
   - Create `tests/unit/characterBuilder/services/eventListenerRegistry.test.js`.  
   - Mock DOM elements and event targets; verify listener registration, delegated handler filtering, event bus subscription, throttle/debounce scheduling, and cleanup semantics.  
   - Include regression test ensuring repeated `destroy()` on controller triggers idempotent removal.  
   - Achieve ≥90% coverage.

4. **Controller Wiring**  
   - Add getter (e.g., `eventRegistry`) on base controller returning the service instance.  
   - Update existing event setup helpers to use the service internally while keeping subclass API stable for now.  
   - Document migration path for subclasses that directly call `_addEventListener` to transition to service usage (link to BASCHACUICONREF-011).

## Acceptance Criteria

- Event listener state fully encapsulated in `EventListenerRegistry`.  
- Base controller no longer directly manipulates listener Maps/Sets.  
- Comprehensive unit tests exist and pass via `npm run test:unit -- eventListenerRegistry`.  
- Service API documented in architecture guide, including lifecycle responsibilities.
