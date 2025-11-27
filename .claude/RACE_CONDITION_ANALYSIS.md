# Race Condition Investigation: Turn Management System

## Executive Summary

After analyzing the turn management system across the entire event flow, I've identified the **ROOT CAUSE** of the persistent race condition:

**The problem is NOT about event listener ordering or timing of when events arrive.** The real issue is that **TWO INDEPENDENT PATHS for ending turns are executing CONCURRENTLY**, and they're stepping on each other:

1. **Path A**: The state machine's normal flow (AwaitingExternalTurnEndState → TurnEndingState)
2. **Path B**: TurnManager's handler destruction (via handleTurnEndedEvent at line 772)

These two paths execute in parallel and conflict, causing:
- Handler destroyed while in TurnEndingState (state machine still running)
- "Operation invoked while handler is destroying" (operation handler invoked after destruction started)
- CRITICAL - Failed to enter TurnIdleState (state transition failures)

## Order of Operations When `turn_ended` Fires

### The Current Flow (Phases 1-9):

```
Time T=0: EndTurnHandler.execute() called
├─ T=0.1: Dispatch turn_ended event (no queueMicrotask, immediate)
│
├─ PARALLEL TRACK A: State Machine Path
│  ├─ T=0.2: EventPromise (in Promise.race) receives event
│  └─ T=0.3: AwaitingExternalTurnEndState.#handleTurnEndedEvent() called
│     ├─ Calls ctx.endTurn(error)
│     └─ Eventually transitions to TurnEndingState
│        └─ TurnEndingState may do cleanup operations
│           └─ May attempt state transitions
│
└─ PARALLEL TRACK B: TurnManager Path
   ├─ Scheduled via TurnEventSubscription.setTimeout(..., 0)
   │  (deferred to next microtask)
   │
   ├─ T=0.5: TurnManager.#handleTurnEndedEvent() executes
   │  ├─ Checks if current actor matches (line 638)
   │  ├─ Updates round manager (line 654)
   │  ├─ AWAITS handler.destroy() (line 772) ← CRITICAL POINT
   │  │  This is where the race condition manifests
   │  │
   │  └─ After destroy completes:
   │     ├─ Dispatches TURN_PROCESSING_ENDED
   │     └─ Schedules advanceTurn()
```

### The Timing Problem:

The issue is that **both paths can start before either completes**:

```
State Machine Timeline:          TurnManager Timeline:
T=0.2: Event received            T=0.2: Event scheduled (via setTimeout)
T=0.3: handleTurnEndedEvent()    T=0.5: handleTurnEndedEvent() starts
T=0.4: Calling ctx.endTurn()     T=0.5: ... still running
T=0.5: Transitioning states      T=0.6: Calls handler.destroy()
T=0.6: Entering TurnEndingState  T=0.7: handler.destroy() completing
T=0.7: TurnEndingState ops       T=0.7: RACE! State machine still in TurnEndingState!
```

## Why TWO Handlers Are Both Receiving The Event

### Listener Registration Order:

1. **TurnManager startup** (line 210 in turnManager.js):
   ```javascript
   this.#eventSubscription.subscribe((ev) => this.#handleTurnEndedEvent(ev));
   ```

2. **CommandProcessingWorkflow** (line 491 in commandProcessingWorkflow.js):
   ```javascript
   earlyUnsubscribe = dispatcher.subscribe(TURN_ENDED_ID, (event) => { ... });
   ```

3. **AwaitingExternalTurnEndState** (line 122-126 in awaitingExternalTurnEndState.js):
   ```javascript
   const eventPromise = createEventPromise(
     dispatcher,
     TURN_ENDED_ID,
     (event) => event.payload?.entityId === actorId,
     signal
   );
   ```

### Why Both Path A & B Execute:

- **Early listener** (CommandProcessingWorkflow): Captures event if it fires during action dispatch
- **State machine listener** (AwaitingExternalTurnEndState): Receives event via Promise.race
- **TurnManager listener** (TurnEventSubscription): ALSO receives event because it's a separate subscription

**ALL THREE LISTENERS RECEIVE THE SAME EVENT.** The early listener is unsubscribed, but TurnManager's listener and the state machine's listener BOTH execute.

## Why The Timeout Still Wins (Even With Early Listener)

The early listener pattern was designed to capture events during dispatch, but the **fundamental timing problem persists**:

1. Event fires at T=0.1 (in EndTurnHandler)
2. TurnEventSubscription defers via `setTimeout(..., 0)` at line 89
3. This deferred call queues AFTER the state machine's Promise.race winner

**The state machine wins the race (correctly), but then:**
- State machine calls `ctx.endTurn()`
- This eventually transitions to TurnEndingState
- Meanwhile, TurnManager's deferred handler ALSO runs
- TurnManager calls `handler.destroy()` while TurnEndingState is still executing

**The timeout "wins" in the sense that it ultimately causes destruction, but it's NOT the timeout in AwaitingExternalTurnEndState winning the Promise.race.** It's the TurnManager's DEFERRED handler execution that interferes with the state machine's normal flow.

## Root Cause Analysis

### Why This Happens:

The issue is **architectural**:

1. **TurnEventSubscription uses setTimeout(..., 0)** to defer handler execution
   - This puts the TurnManager's handler in a DIFFERENT async queue than the state machine
   - Promise.race resolves immediately, but TurnManager's callback is still queued
   - By the time TurnManager runs, the state machine may be mid-state-transition

2. **Handler destruction is NOT coordinated with state machine**
   - TurnManager.destroy() doesn't wait for state machine to complete
   - State machine may be in TurnEndingState when destroy() is called
   - This causes "Handler destroyed while in TurnEndingState" error

3. **Two independent path architecture**
   - State machine: Handles event → transitions states
   - TurnManager: Handles event → destroys handler
   - These execute concurrently without coordination

### Why Previous Fixes Didn't Work:

- **Phase 7 (early listener)**: Correctly captures events, but doesn't prevent TurnManager from destroying the handler
- **Phase 8 (await destroy)**: TurnManager waits for destroy, but state machine may not have finished transitioning when destroy starts
- **Phase 9 (no queueMicrotask)**: Removed deferral in EndTurnHandler, but TurnEventSubscription still defers TurnManager

## Critical Insight: The setTimeout Problem

**TurnEventSubscription at line 89 is the culprit:**

```javascript
timeoutId = this.#scheduler.setTimeout(invokeCallback, 0);
```

This defers the TurnManager's handler, creating two separate execution timelines:

1. **Immediate**: State machine receives event and processes it
2. **Deferred (via setTimeout)**: TurnManager receives event and starts destruction

**The state machine is INTERRUPTED during state transitions by TurnManager's destruction.**

## Recommended Fix Approach

### Solution 1: Remove the setTimeout deferral in TurnEventSubscription (BEST)

**Rationale**: TurnManager doesn't need deferral since:
- EndTurnHandler no longer uses queueMicrotask
- Early listener (Phase 7) already captures events during dispatch
- Immediate execution allows TurnManager to destroy handler BEFORE state machine enters new state

**Changes**:
```javascript
// In TurnEventSubscription.subscribe()
// REMOVE the setTimeout deferral
const wrapped = (ev) => {
  // Immediate execution instead of setTimeout
  await cb(ev);
  // ... rest of logic
};
```

### Solution 2: Coordinate handler destruction with state machine

**Rationale**: Ensure state machine completes before destruction

**Changes**:
1. State machine signals when it's "safe to destroy"
2. TurnManager waits for this signal before calling destroy()
3. TurnManager then destroys handler safely

### Solution 3: Single event handler architecture

**Rationale**: Replace dual-listener with single coordinated handler

**Changes**:
1. TurnManager subscribes ONCE
2. TurnManager coordinates both state machine and handler destruction
3. Eliminates concurrent path execution

## Detailed Timeline: What Actually Happens Now

```
T=0ms:     EndTurnHandler.execute() called
T=0.1ms:   dispatcher.dispatch(TURN_ENDED_ID, payload)
           
           ├─ Immediate: Early listener (if still active) captures event
           │  └─ Stores in context as pendingTurnEndEvent
           │
           ├─ Immediate: State machine's createEventPromise() receives event
           │  └─ Promise.race([eventPromise, timeoutPromise]) resolves immediately
           │
           └─ Immediate: TurnEventSubscription.wrapped() runs
              └─ Schedules setTimeout(callback, 0)

T=1ms:     State machine's Promise.race wins
           └─ AwaitingExternalTurnEndState.#handleTurnEndedEvent() starts
              └─ Calls ctx.endTurn(error)
                 └─ Transitions to TurnEndingState
                    └─ TurnEndingState does cleanup

T=2ms:     setTimeout(0) microtask fires
           └─ TurnEventSubscription calls callback
              └─ TurnManager.#handleTurnEndedEvent() starts
                 └─ Calls handler.destroy() WHILE STATE MACHINE IN TURNENDINSTATE
                    └─ RACE CONDITION: "Handler destroyed while in TurnEndingState"
```

## Files Involved

1. **src/turns/turnManager.js** (line 210, 772)
   - Subscribes to turn_ended event
   - Calls handler.destroy() after event

2. **src/turns/turnEventSubscription.js** (line 89)
   - **THE PROBLEM**: Uses setTimeout(..., 0) to defer callback
   - Causes TurnManager handler to run asynchronously

3. **src/turns/states/awaitingExternalTurnEndState.js** (line 122-143)
   - State machine receives event via Promise.race
   - Transitions to TurnEndingState

4. **src/logic/operationHandlers/endTurnHandler.js** (line 114)
   - Dispatches turn_ended event
   - No longer uses queueMicrotask (good)

5. **src/turns/states/helpers/commandProcessingWorkflow.js** (line 491)
   - Sets up early listener
   - Stores pending event in context

## Next Steps For Investigation

1. **Verify TurnEventSubscription timing** - Confirm setTimeout is the issue
2. **Test removing setTimeout deferral** - See if immediate execution fixes the race
3. **Verify state machine completion** - Ensure TurnEndingState completes before destroy
4. **Check handler.destroy() implementation** - Ensure it's safe to call mid-transition

## Questions Answered

✅ **Is TurnManager's `handleTurnEndedEvent` called before or after the state machine's event listener?**
   - The state machine's listener wins the Promise.race immediately, but TurnManager's listener (via setTimeout) executes in parallel, starting a deferred task that runs while state machine is still transitioning.

✅ **Why are BOTH the timeout path AND the TurnManager destruction path executing?**
   - They're not both timing out. TurnEventSubscription's setTimeout(..., 0) defers TurnManager's execution, creating two parallel execution paths that don't coordinate.

✅ **What is the order of event listener registration?**
   - TurnManager (earliest), CommandProcessingWorkflow (early), createEventPromise (state machine)
   - But all three can receive the event independently.

✅ **Why does the timeout still win even with the early listener pattern?**
   - The timeout doesn't "win" in Promise.race. The state machine wins. But TurnManager's deferred execution (setTimeout) causes it to interfere with state transitions.
