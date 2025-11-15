# BASCHACUICONREF-005: Create AsyncUtilitiesToolkit

**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 3 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.5)

## Objective

Encapsulate debounce/throttle helpers and timer management into `src/characterBuilder/services/asyncUtilitiesToolkit.js`, ensuring centralized cleanup and visibility into outstanding async work.

## Implementation Tasks

1. **Toolkit Implementation**  
   - Constructor accepts `{ logger }`.  
   - Methods: `debounce`, `throttle`, `getDebouncedHandler`, `getThrottledHandler`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `clearTimeout`, `clearInterval`, `cancelAnimationFrame`, `clearAllTimers`, `getTimerStats`.  
   - Maintain maps for handlers + timer IDs (`#debouncedHandlers`, `#throttledHandlers`, `#pendingTimers`, `#pendingIntervals`, `#pendingAnimationFrames`).  
   - Provide ability to namespace handlers by key for reuse (align with event registry expectations).

2. **Integration with Base Controller + EventListenerRegistry**
   - Replace `BaseCharacterBuilderController.#createAsyncUtilitiesAdapters()` so it instantiates a shared toolkit instance and hands the `debounce`/`throttle` methods into `EventListenerRegistry` when `#getEventListenerRegistry()` lazily constructs it.
   - Call through to the toolkit for `_debounce`, `_throttle`, `_setTimeout`, `_setInterval`, `_requestAnimationFrame`, `_clearTimeout`, `_clearInterval`, `_cancelAnimationFrame`, `_getDebouncedHandler`, and `_getThrottledHandler` rather than duplicating the logic in the controller.
   - Document within the ticket for BASCHACUICONREF-002 that the registry already expects `{ debounce, throttle }` adapters—no additional signature changes are required—so downstream consumers only need to ensure the toolkit is passed in.
   - Provide bridging helpers (e.g., factory or getter) so other services that currently rely on the controller's timer wrappers (like lifecycle cleanup hooks) can access the shared toolkit instance without importing controller internals.

3. **Unit Tests**  
   - `tests/unit/characterBuilder/services/asyncUtilitiesToolkit.test.js`.  
   - Use Jest fake timers; verify leading/trailing options, repeated scheduling, handler cancellation, stats accuracy, and `clearAllTimers`.  
   - Cover error handling when invalid handler provided.

4. **Controller Delegation + Lifecycle Cleanup**
   - Update `BaseCharacterBuilderController._cancelPendingOperations()` so it invokes toolkit-level `clearAllTimers()`/`getTimerStats()` (instead of manually iterating the controller's `#pending*` sets) while keeping the same logging currently emitted in that method.
   - Ensure the lifecycle orchestrator's `DESTRUCTION_PHASES.CANCEL_OPERATIONS` hook continues to be satisfied by wiring the toolkit-backed implementation, and leave TODO markers pointing to BASCHACUICONREF-010 wherever controller code can be deleted once the toolkit is injected everywhere.

5. **Docs**  
   - Document configuration options (leading/trailing, default wait, instrumentation) and timer stats shape.

## Acceptance Criteria

- Toolkit encapsulates all async helpers with no remaining timer bookkeeping in the base controller.  
- Jest fake timer suite passes locally (`npm run test:unit -- asyncUtilitiesToolkit`).  
- BaseCharacterBuilderController passes the shared toolkit instance into EventListenerRegistry via `#createAsyncUtilitiesAdapters()` so that the registry continues consuming `{ debounce, throttle }` adapters without internal changes.
- Documentation describes usage and cleanup responsibilities.
