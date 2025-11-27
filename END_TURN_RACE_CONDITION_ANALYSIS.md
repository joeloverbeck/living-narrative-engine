# END_TURN Race Condition Analysis

## Executive Summary

**CONFIRMED RACE CONDITION FOUND**: The `turn_ended` event is dispatched BEFORE the `AwaitingExternalTurnEndState` event listener is set up, causing the timeout to always win the race.

## Execution Flow Order

### Phase 1: Action Dispatch → Directive Strategy Resolution
**Location**: `src/turns/states/helpers/commandProcessingWorkflow.js:478-508`

```
processCommand()
  ├─ await _dispatchAction()           [Line 482-486] ⚡ ACTION DISPATCHES HERE
  │   └─ await commandProcessor.dispatchAction(actor, turnAction)
  │       └─ *** Rules execute immediately ***
  │           └─ Core actions dispatch turn_ended events synchronously
  │
  ├─ await _interpretCommandResult()   [Line 493-497]
  │
  └─ await _executeDirectiveStrategy() [Line 504-508]
      └─ await strategy.execute(turnCtx, directiveType, result)
```

### Phase 2: Directive Strategy Execution (WaitForTurnEndEvent)
**Location**: `src/turns/strategies/waitForTurnEndEventStrategy.js:41-91`

```
execute()
  └─ await turnContext.requestAwaitingExternalTurnEndStateTransition() [Line 81] ⏱️ TRANSITION REQUESTED HERE
```

### Phase 3: State Transition to AwaitingExternalTurnEndState
**Location**: `src/turns/context/turnContext.js:275-277`

```
requestAwaitingExternalTurnEndStateTransition()
  └─ await handlerInstance.requestAwaitingExternalTurnEndStateTransition() [Line 276]
```

### Phase 4: Handler Initiates State Transition
**Location**: `src/turns/handlers/baseTurnHandler.js:690-699`

```
requestAwaitingExternalTurnEndStateTransition()
  └─ await _transitionToState(newState) [Line 696]
      └─ await newState.enterState(handler, prevState) [Line 260]
```

### Phase 5: New State Enters and Sets Up Event Listener
**Location**: `src/turns/states/awaitingExternalTurnEndState.js:59-121`

```
enterState()
  ├─ Create new AbortController [Line 66]
  │
  ├─ Mark context as awaiting external event [Line 78]
  │
  └─ Create racing promises [Line 89-99]
      ├─ const eventPromise = createEventPromise()  [Line 89] 🔴 EVENT LISTENER SET UP HERE
      └─ const timeoutPromise = createCancellableTimeout()
```

## Critical Ordering Problem

### Timeline of Events

```
Time    Action                                              Component
──────────────────────────────────────────────────────────────────────────
T0      [ProcessingCommandState] begins action dispatch
        
T1      commandProcessor.dispatchAction(actor, turnAction)
        └─ Rules execute synchronously
           └─ turn_ended event DISPATCHED HERE ✗✗✗
           └─ Caught by EventBus (no listeners yet!)

T2-T3   _interpretCommandResult() runs
        └─ Returns directive: 'WAIT_FOR_EVENT'

T4      _executeDirectiveStrategy() called
        └─ WaitForTurnEndEventStrategy.execute()
           └─ requestAwaitingExternalTurnEndStateTransition()

T5      State transition begins
        └─ _transitionToState() called
           └─ prevState.exitState()
           └─ this._currentState = newState
           └─ newState.enterState()   [FIRST await]
              └─ createEventPromise(dispatcher, TURN_ENDED_ID...)
                 └─ dispatcher.subscribe(TURN_ENDED_ID, ...)
                 └─ 🟢 Event listener NOW SET UP

T6+     Promise.race([eventPromise, timeoutPromise])
        └─ But turn_ended event already fired at T1!
        └─ Listener was not present when event fired
        └─ Timeout wins the race
```

## Root Cause Analysis

### The Problem

The `turn_ended` event is emitted **synchronously during rule execution** in `_dispatchAction()` (T1), but the event listener is not registered until `enterState()` completes (T5).

### Why Synchronous Events Are Lost

In JavaScript's event bus pattern, when an event is dispatched:
1. Event is added to the event queue
2. All currently-registered listeners are called immediately
3. If no listeners are registered, the event is processed with no callbacks
4. Future listeners registered after dispatch will NOT receive the event

### Code Evidence

**Event dispatch happens here** (`src/turns/states/helpers/commandProcessingWorkflow.js:204`):
```javascript
const commandResult = await this._commandProcessor.dispatchAction(actor, turnAction);
// ↑ This triggers rules synchronously, which emit turn_ended
```

**Event listener setup happens here** (`src/turns/states/awaitingExternalTurnEndState.js:89-94`):
```javascript
const eventPromise = createEventPromise(
  dispatcher,
  TURN_ENDED_ID,  // 'core:turn_ended'
  (event) => event.payload?.entityId === actorId,
  signal
);
```

**Listener subscription** (`src/turns/utils/cancellablePrimitives.js:94`):
```javascript
unsubscribe = dispatcher.subscribe(eventId, (event) => {
  if (!resolved && filter(event)) {
    resolved = true;
    // ...
    resolve(event);
  }
});
```

At the moment `dispatcher.subscribe()` is called, the `turn_ended` event has already been fully processed.

## Fix Locations

### Option A: Set Up Listener BEFORE Directive Execution (Recommended)

**Location**: `src/turns/states/helpers/commandProcessingWorkflow.js`

**Concept**: Create event promise BEFORE dispatching action, allowing it to "catch" the turn_ended event no matter when it fires.

**Advantages**:
- Simple, elegant fix
- No state transition required
- No changes to AwaitingExternalTurnEndState needed
- Event listener is ready from the moment action dispatch begins

**Disadvantages**:
- Changes workflow structure slightly
- Need to handle promise cleanup if action fails

### Option B: Transition to AwaitingState BEFORE Dispatch

**Location**: `src/turns/states/processingCommandState.js` → `commandProcessingWorkflow.js`

**Concept**: Request state transition to AwaitingExternalTurnEndState, THEN dispatch the action from that state's context.

**Advantages**:
- Maintains current state model
- State is "ready" before action happens

**Disadvantages**:
- Requires state machine refactoring
- More complex transition logic
- Current state model assumes action dispatch in ProcessingCommandState

### Option C: Make Event System Replay Recent Events

**Location**: `src/events/eventBus.js` (or similar)

**Concept**: Store recent turn_ended events, replay to new subscribers.

**Advantages**:
- Fixes broader "lost event" patterns
- More robust architecture

**Disadvantages**:
- Higher complexity
- Memory overhead for event replay buffer
- May mask other timing issues

## Code Files Affected

### Core Files in Execution Flow

1. **commandProcessingWorkflow.js** (L478-508)
   - `processCommand()` orchestrates dispatch → interpretation → strategy execution
   - `_dispatchAction()` (L144-277) - WHERE ACTION IS DISPATCHED
   - `_executeDirectiveStrategy()` (L355-468) - WHERE STATE TRANSITION IS TRIGGERED

2. **waitForTurnEndEventStrategy.js** (L41-91)
   - `execute()` - calls `requestAwaitingExternalTurnEndStateTransition()`

3. **turnContext.js** (L275-277)
   - `requestAwaitingExternalTurnEndStateTransition()` - delegates to handler

4. **baseTurnHandler.js** (L690-699)
   - `requestAwaitingExternalTurnEndStateTransition()` - calls `_transitionToState()`
   - `_transitionToState()` (L203-301) - AWAITS enterState()

5. **awaitingExternalTurnEndState.js** (L59-121)
   - `enterState()` - sets up event listener (LINE 89-94)
   - `createEventPromise()` creates the listener subscription

6. **cancellablePrimitives.js** (L82-116)
   - `createEventPromise()` - Creates subscription (LINE 94)
   - `dispatcher.subscribe()` - Event listener registered here

## Impact Assessment

### When This Fails

1. Any action that triggers `END_TURN` directive
2. The action emits `turn_ended` event synchronously
3. Timeout is the only path to resolution
4. User sees timeout error instead of successful completion

### Affected Scenarios

- Character emotes/actions that use turn_ended
- Combat abilities with turn_ended outcomes
- Environment interactions triggering turn_ended
- Any rule that calls the turn_ended dispatcher

## Testing Implications

### Current Test Gaps

- No tests verify listener is set up BEFORE event dispatch
- Tests may pass due to test framework timing differences
- Real browser execution shows the race condition clearly

### How to Verify Fix

1. Add instrumentation to log:
   - Exact timestamp of turn_ended dispatch
   - Exact timestamp of listener subscription
   - Which happens first

2. Test pattern:
   ```javascript
   // Should NOT timeout
   await testBed.executeActionThatEmitsTurnEnded();
   expect(turnEndedEventWasCaught).toBe(true);
   expect(timeoutOccurred).toBe(false);
   ```

## Recommended Resolution

### Primary Fix: Event Listener Before Action Dispatch

**File**: `src/turns/states/helpers/commandProcessingWorkflow.js`

**Changes**:
1. If directive is `WAIT_FOR_EVENT`, pre-create event promise in `_executeDirectiveStrategy()`
2. Keep promise active during `_dispatchAction()` if already in `WAIT_FOR_EVENT` path
3. Ensures listener exists before any event can fire

**Alternative if pre-creation not possible**:
4. Modify `cancellablePrimitives.js` to handle "missed" events via event bus replay

This addresses the fundamental issue: event listeners must exist BEFORE the event is dispatched, not after.
