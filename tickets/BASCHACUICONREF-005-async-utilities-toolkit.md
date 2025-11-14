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

2. **Integration with EventListenerRegistry**  
   - Update BASCHACUICONREF-002 deliverables to depend on this toolkit once ready; ensure both modules share consistent handler signatures.  
   - Provide bridging methods for other services (e.g., lifecycle) needing safe timers.

3. **Unit Tests**  
   - `tests/unit/characterBuilder/services/asyncUtilitiesToolkit.test.js`.  
   - Use Jest fake timers; verify leading/trailing options, repeated scheduling, handler cancellation, stats accuracy, and `clearAllTimers`.  
   - Cover error handling when invalid handler provided.

4. **Controller Delegation**  
   - Replace `_debounce`, `_throttle`, `_setTimeout`, `_setInterval`, `_requestAnimationFrame`, `_clearTimeout`, `_clearInterval`, `_cancelAnimationFrame` implementations in base controller with service calls + TODO for removal in BASCHACUICONREF-010.  
   - Ensure lifecycle orchestrator registers cleanup tasks that call `asyncUtilities.clearAllTimers()` on destroy.

5. **Docs**  
   - Document configuration options (leading/trailing, default wait, instrumentation) and timer stats shape.

## Acceptance Criteria

- Toolkit encapsulates all async helpers with no remaining timer bookkeeping in the base controller.  
- Jest fake timer suite passes locally (`npm run test:unit -- asyncUtilitiesToolkit`).  
- EventListenerRegistry updated to depend on toolkit rather than local debounce logic.  
- Documentation describes usage and cleanup responsibilities.
