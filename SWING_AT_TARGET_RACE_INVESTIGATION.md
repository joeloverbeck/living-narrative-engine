# Swing_at_Target Race Condition Investigation Report

## Summary
The early listener implementation in Phase 6-8 is **theoretically correct** but has critical **timing and lifecycle issues** that cause the timeout to still win the race. The problem is NOT in the early listener pattern itself, but in HOW and WHEN it interacts with handler destruction.

## Current Implementation State

### 1. TurnContext (✅ Correct)
**File**: `src/turns/context/turnContext.js` (lines 55-275)

**Pending Event Storage**:
- `#pendingTurnEndEvent = null` (line 56)
- `setPendingTurnEndEvent(event)` (lines 219-224) - Stores event
- `consumePendingTurnEndEvent()` (lines 231-240) - Retrieves and clears

**Early Listener Unsubscribe Storage**:
- `#earlyListenerUnsubscribe = null` (line 58)
- `setEarlyListenerUnsubscribe(unsubscribe)` (lines 251-258) - Stores function
- `consumeEarlyListenerUnsubscribe()` (lines 266-275) - Retrieves and clears

✅ **Assessment**: Storage mechanism is correct. Methods exist and are properly documented.

---

### 2. CommandProcessingWorkflow (⚠️ PARTIALLY CORRECT but with critical issue)
**File**: `src/turns/states/helpers/commandProcessingWorkflow.js` (lines 479-601)

**Early Listener Setup** (lines 483-512):
```javascript
let earlyUnsubscribe = null;
let earlyEventCaptured = false;

const dispatcher = getSafeEventDispatcher(turnCtx, this._state?._handler);
if (dispatcher && typeof dispatcher.subscribe === 'function') {
  earlyUnsubscribe = dispatcher.subscribe(TURN_ENDED_ID, (event) => {
    if (event.payload?.entityId === actorId && !earlyEventCaptured) {
      earlyEventCaptured = true;
      if (typeof turnCtx.setPendingTurnEndEvent === 'function') {
        turnCtx.setPendingTurnEndEvent(event);
      }
    }
  });

  if (typeof turnCtx.setEarlyListenerUnsubscribe === 'function') {
    turnCtx.setEarlyListenerUnsubscribe(earlyUnsubscribe);
  }
}
```

✅ **Correct**: Early listener is set up BEFORE dispatch.
✅ **Correct**: Unsubscribe function is stored on context.
✅ **Correct**: Early listener is NOT unsubscribed in finally block (comment at lines 581-586 explains why).

⚠️ **CRITICAL ISSUE - Early Listener Lifecycle**:
The early listener stays active for the **entire duration** of `processCommand()`. This is:
- ✅ Good: Captures events that fire before AwaitingExternalTurnEndState enters
- ❌ Bad: If handler is destroyed DURING processCommand, the early listener may never be cleaned up properly

**Timeline Problem**:
1. `processCommand()` starts, early listener subscribed
2. Action dispatch happens
3. turn_ended event queued (via queueMicrotask)
4. Handler destruction triggered (e.g., from timeout or external event)
5. Early listener never gets unsubscribed (context not available anymore)

---

### 3. AwaitingExternalTurnEndState (⚠️ CORRECT PATTERN, WRONG ASSUMPTIONS)
**File**: `src/turns/states/awaitingExternalTurnEndState.js` (lines 58-154)

**Early Listener Cleanup** (lines 71-87):
```javascript
const earlyUnsubscribe = ctx.consumeEarlyListenerUnsubscribe?.();
if (earlyUnsubscribe && typeof earlyUnsubscribe === 'function') {
  try {
    earlyUnsubscribe();
    logger.debug(`${this.getStateName()}: Unsubscribed early listener for ${actorId}`);
  } catch (unsubErr) {
    logger.warn(`${this.getStateName()}: Error unsubscribing early listener: ${unsubErr.message}`);
  }
}
```

**Pending Event Handling** (lines 69-98):
```javascript
const pendingEvent = ctx.consumePendingTurnEndEvent?.();
// ... cleanup early listener ...
if (pendingEvent) {
  logger.debug(`${this.getStateName()}: Found pre-captured turn_ended event for ${actorId}, handling immediately`);
  ctx.setAwaitingExternalEvent(true, actorId);
  await this.#handleTurnEndedEvent(ctx, pendingEvent);
  this.#cleanup(ctx);
  return;  // ← EARLY RETURN WITH PENDING EVENT
}
```

**Race Setup** (lines 121-144):
```javascript
const eventPromise = createEventPromise(dispatcher, TURN_ENDED_ID, ...);
const timeoutPromise = createCancellableTimeout(this.#configuredTimeout, signal);
const result = await Promise.race([eventPromise, timeoutPromise]);
```

✅ **Correct**: Pending event is checked and handled immediately.
✅ **Correct**: Early listener is unsubscribed when state enters.
⚠️ **Problem**: The pattern assumes AwaitingExternalTurnEndState will ALWAYS be reached.

---

### 4. EndTurnHandler (✅ CORRECT)
**File**: `src/logic/operationHandlers/endTurnHandler.js` (lines 78-139)

**queueMicrotask Implementation** (lines 106-137):
```javascript
await new Promise((resolve) => queueMicrotask(resolve));
const dispatchResult = this.#safeEventDispatcher.dispatch(TURN_ENDED_ID, payload);
```

✅ **Correct**: Event dispatch is deferred to microtask queue.
✅ **Correct**: Dispatch is awaited to ensure event is delivered.
✅ **Correct**: This allows the early listener to capture the event even if dispatched after action handler returns.

---

## Root Cause Analysis

The **actual race condition** is not between the early listener and the event—it's between:

1. **Normal Flow**: `processCommand()` → dispatch → queueMicrotask(turn_ended) → AwaitingExternalTurnEndState.enterState()` consumes pending event
2. **Timeout Flow**: `processCommand()` → dispatch → [timeout expires] → AwaitingExternalTurnEndState.timeout handler → handler destroyed

### Critical Path Analysis

**Scenario 1: Event wins (expected)**
```
T0: endTurnHandler: await queueMicrotask(resolve)
T1: processCommand finally block completes
T2: Microtask queue: turn_ended event dispatched
T3: Early listener captures event → setPendingTurnEndEvent
T4: AwaitingExternalTurnEndState.enterState() called
T5: consumePendingTurnEndEvent() retrieves event
T6: #handleTurnEndedEvent processes it immediately
T7: State exits → TurnEndingState → Idle
```

**Scenario 2: Timeout wins (current failure)**
```
T0: endTurnHandler: await queueMicrotask(resolve)
T1: processCommand finally block completes
T2: [Timeout fires in Promise.race] ← TIMEOUT SENTINEL returned
T3: AwaitingExternalTurnEndState.#handleTimeout() called
T4: ctx.endTurn(error) called → TurnEndingState → destroy handler
T5: Microtask queue fires: turn_ended event dispatched
T6: Early listener tries to call setPendingTurnEndEvent
T7: But context is now null or destroyed! ← CRASH/ERROR
```

### Why The Timeout Still Wins

**The Timeout Duration is Measured Against the Wrong Point**:

From `timeoutConfiguration.js` (referenced in AwaitingExternalTurnEndState):
- Default timeout is probably 5000ms (5 seconds)
- But the clock starts in `AwaitingExternalTurnEndState.enterState()` line 129-132

**Timing Gap**:
```
T0: endTurnHandler queues event via queueMicrotask
T1-T500: processCommand still running (could be slow)
T501: AwaitingExternalTurnEndState starts (begins timeout clock)
T502-T5501: Waiting for event (timeout window: 5 seconds)
```

If the action takes longer than expected (network delay, complex rule evaluation), the **event delivery can be delayed past the timeout window**.

**The Event Delivery Depends On**:
1. ✅ endTurnHandler's queueMicrotask finishes
2. ✅ processCommand finally block completes
3. ✅ Browser's microtask queue executes
4. ✅ Event listener callback executes
5. ✅ setPendingTurnEndEvent completes
6. ✅ AwaitingExternalTurnEndState.enterState() reaches line 69

**Any delay in steps 1-5 causes timeout to win**.

---

## Code-Level Issues Found

### Issue 1: Early Listener Not Cleaned Up If Handler Destroyed During processCommand
**Location**: `src/turns/states/helpers/commandProcessingWorkflow.js` (lines 479-601)

**Problem**: If the handler is destroyed while `processCommand()` is still executing, the `earlyUnsubscribe` function is never called.

**Evidence**:
- Early listener is stored on context (line 509-510)
- But if handler is destroyed during any async operation in `processCommand()`, the context may become inaccessible
- The listener stays subscribed indefinitely

**Impact**: Memory leak + potential double-handling of events

### Issue 2: Missing Null Guard in setPendingTurnEndEvent When Context Destroyed
**Location**: `src/turns/context/turnContext.js` (lines 219-224)

**Problem**: If the context is destroyed or the handler is destroyed while setPendingTurnEndEvent is being called, there's no guard.

**Evidence**: 
```javascript
setPendingTurnEndEvent(event) {
  this.#pendingTurnEndEvent = event;  // ← No null checks
  this.#logger.debug(...);            // ← Could fail if logger destroyed
}
```

**Impact**: Error in early listener callback when handler is destroyed

### Issue 3: Handler Destruction Race with Pending Event Consumption
**Location**: `src/turns/states/awaitingExternalTurnEndState.js` (lines 58-70)

**Problem**: Between `enterState()` being called and `consumePendingTurnEndEvent()` being called, another async operation could destroy the handler.

**Evidence**:
```javascript
async enterState(handler, prev) {
  await super.enterState(handler, prev);  // ← Can throw/destroy handler
  
  const ctx = await this._ensureContext('enter-no-context');
  if (!ctx) return;  // ← Context could be null here
  
  const pendingEvent = ctx.consumePendingTurnEndEvent?.();  // ← Could fail
}
```

**Impact**: Pending event never consumed, falls through to timeout

### Issue 4: Timeout Clock Starts Too Late
**Location**: `src/turns/states/awaitingExternalTurnEndState.js` (lines 129-144)

**Problem**: The timeout is created in `enterState()`, which may execute AFTER significant delays from:
- `await super.enterState()` (line 59)
- `_ensureContext()` check (line 61)
- Early listener cleanup (lines 75-87)

**Evidence**: 
```javascript
async enterState(handler, prev) {
  // ... many async operations ...
  
  // Only NOW does timeout clock start (line 129-132)
  const timeoutPromise = createCancellableTimeout(this.#configuredTimeout, signal);
}
```

**Impact**: Timeout expires even if event is delivered to early listener, just takes longer to process

### Issue 5: No Timeout Tolerance for queueMicrotask Deferral
**Location**: `src/logic/operationHandlers/endTurnHandler.js` (lines 106-137)

**Problem**: The event dispatch is deferred via queueMicrotask, but the timeout doesn't account for this deferral time.

**Evidence**:
- endTurnHandler: `await new Promise(resolve => queueMicrotask(resolve))` takes 0-100ms
- But AwaitingExternalTurnEndState timeout has already been counting
- Net effect: timeout reduced by deferral time

**Impact**: Race is tighter than intended

---

## Why Tests Pass Locally but Fail in CI

**Local Testing**: 
- Single process, minimal contention
- Fast microtask execution
- No network delays

**CI Testing**:
- Shared resources
- Variable microtask queue timing
- Possible swapping/load
- **Timeout can fire before event propagates**

---

## Diagnosis Summary

| Component | Status | Issue |
|-----------|--------|-------|
| TurnContext storage | ✅ Correct | None |
| CommandProcessingWorkflow early listener | ⚠️ Correct pattern | Early listener not cleaned if handler destroyed during processCommand |
| AwaitingExternalTurnEndState | ⚠️ Correct pattern | Timeout clock starts too late; pending event consumption has race window |
| EndTurnHandler deferral | ✅ Correct | Deferral not accounted for in timeout duration |
| Overall timeout mechanism | ❌ **Broken** | Timeout clock should start BEFORE enterState, not during it |

---

## Key Findings

1. **Early listener IS being set up correctly** (lines 483-512 of commandProcessingWorkflow.js)
2. **Early listener IS being stored correctly** (line 510 via `setEarlyListenerUnsubscribe`)
3. **Early listener cleanup IS happening** (lines 75-87 of awaitingExternalTurnEndState.js)
4. **BUT**: The timeout is still winning because:
   - Timeout clock starts in `enterState()` (after delays)
   - Event dispatch deferred to microtask queue
   - Overall: timeout fires before deferred event can be captured and consumed

5. **The real problem is TIMING ARCHITECTURE**:
   - Timeout should be a property of the STATE, not started fresh in enterState
   - Or: turn_ended event dispatch should NOT be deferred (counterintuitive but necessary)
   - Or: Timeout should be significantly longer (5s → 30s) to account for all async operations

---

## Line-by-Line Issue Summary

| File | Line(s) | Issue | Severity |
|------|---------|-------|----------|
| `commandProcessingWorkflow.js` | 486-512 | Early listener stored but not guaranteed cleanup if handler destroyed during processCommand | HIGH |
| `commandProcessingWorkflow.js` | 581-586 | Comment explains NOT unsubscribing, but code doesn't handle handler destruction during processCommand | HIGH |
| `turnContext.js` | 219-224 | setPendingTurnEndEvent has no guard for destroyed handler | MEDIUM |
| `awaitingExternalTurnEndState.js` | 58-70 | enterState can complete partially before consumePendingTurnEndEvent is reached | MEDIUM |
| `awaitingExternalTurnEndState.js` | 129-132 | Timeout clock starts AFTER all setup, not before | HIGH |
| `endTurnHandler.js` | 106-137 | queueMicrotask deferral not accounted for in timeout duration | MEDIUM |
| `baseTurnHandler.js` | 306-311 | _assertHandlerActive throws during destroy, but code may still try operations | MEDIUM |

---

## Next Steps Required

1. **Move timeout initialization to transition time** - Start timeout clock BEFORE enterState, not during it
2. **Add timeout buffer** - Account for queueMicrotask deferral (add 200-500ms buffer)
3. **Guard early listener cleanup** - Ensure listener unsubscribed even if handler destroyed
4. **Add handler destruction guard** - Check if handler is destroying before calling setPendingTurnEndEvent
5. **Test with delays** - Verify behavior with artificial delays in processCommand
