# TurnManager Handler Lifecycle Analysis

## Executive Summary

The issue is a **race condition in handler lifecycle management** where `TurnManager.handleTurnEndedEvent_fn` destroys the handler while `TurnEndingState.enterState` is still executing. The root cause is that handler destruction is triggered **synchronously** (via a fire-and-forget Promise) while state entry/exit cycles may still be running.

---

## 1. Event Subscription Flow

### Location
**File**: `src/turns/turnManager.js` (lines 210-210 & 573-807)

### Subscription Setup
```javascript
// Line 210 in start()
this.#eventSubscription.subscribe((ev) => this.#handleTurnEndedEvent(ev));
```

The subscription wraps `#handleTurnEndedEvent` which is a **synchronous method** (not async).

### TurnEventSubscription Details
**File**: `src/turns/turnEventSubscription.js` (lines 57-98)

The subscription mechanism:
1. Receives `TURN_ENDED_ID` events
2. **Schedules** the callback via `scheduler.setTimeout(callback, 0)` (line 84)
3. Creates a "deferred execution" pattern to avoid synchronous event processing

**Key Point**: The callback is scheduled asynchronously, but `#handleTurnEndedEvent` itself is synchronous.

---

## 2. Handler Destruction in handleTurnEndedEvent

### Location
**File**: `src/turns/turnManager.js` (lines 775-800)

### The Critical Code Section

```javascript
// Lines 775-778: Clear current state
const handlerToDestroy = this.#currentHandler;
this.#currentActor = null;
this.#currentHandler = null;

// Lines 780-800: Destroy the handler
if (handlerToDestroy) {
  if (
    typeof handlerToDestroy.signalNormalApparentTermination === 'function'
  ) {
    handlerToDestroy.signalNormalApparentTermination();
  }
  if (typeof handlerToDestroy.destroy === 'function') {
    logStart(
      this.#logger,
      `Calling destroy() on handler (${handlerToDestroy.constructor?.name || 'Unknown'}) for completed turn ${endedActorId}`
    );
    // destroy() can be async, handle its promise to catch errors
    Promise.resolve(handlerToDestroy.destroy()).catch((destroyError) =>
      logError(
        this.#logger,
        `Error destroying handler for ${endedActorId} after turn end`,
        destroyError
      )
    );
  }
}
```

### Critical Issue

**Line 792**: `Promise.resolve(handlerToDestroy.destroy()).catch(...)`

- ❌ **Fire-and-forget Promise** - the destruction Promise is NOT awaited
- ❌ **Synchronous cleanup** - `#currentHandler` is cleared IMMEDIATELY (line 778)
- ❌ **No coordination** - no wait for any state machine currently executing

---

## 3. State Machine Lifecycle - TurnEndingState

### Location
**File**: `src/turns/states/turnEndingState.js` (lines 49-114)

### enterState Execution Flow

```javascript
async enterState(handler, previousState) {
  const ctx = this._getTurnContext();
  const logger = getLogger(ctx, handler);
  const sameActor = ctx?.getActor()?.id === this.#actorToEndId;
  const success = this.#turnError === null;

  // Line 55: Call parent enterState
  await super.enterState(handler, previousState);

  // Line 60: 1️⃣ NOTIFY TURN END PORT
  if (ctx && sameActor) {
    try {
      await ctx.getTurnEndPort().notifyTurnEnded(this.#actorToEndId, success);
    } catch (err) {
      // Error handling...
    }
  }

  // Line 90: 2️⃣ SIGNAL NORMAL TERMINATION
  if (
    sameActor &&
    typeof handler.signalNormalApparentTermination === 'function'
  ) {
    handler.signalNormalApparentTermination();
  }

  // Line 98: 3️⃣ CLEANUP
  handler.resetStateAndResources(
    `enterState-TurnEndingState-actor-${this.#actorToEndId}`
  );

  // Line 104: 4️⃣ TRANSITION TO IDLE
  if (ctx?.requestIdleStateTransition) {
    await ctx.requestIdleStateTransition();
  }
}
```

### The Race Condition

**When TurnManager calls destroy():**

1. ✅ `TurnManager.#handleTurnEndedEvent()` executes synchronously
2. ✅ Clears `#currentHandler` reference (line 778)
3. ✅ Calls `handlerToDestroy.destroy()` but **does NOT await** (line 792)
4. ⏸️ Meanwhile, `TurnEndingState.enterState()` may still be running:
   - Step 1: Calling `getTurnEndPort().notifyTurnEnded()` (awaited)
   - Step 2: Signaling termination
   - Step 3: Resetting state
   - Step 4: Requesting transition to Idle (awaited)

**The Problem:**

When `handler.destroy()` executes asynchronously (line 792):
```javascript
async destroy() {
  // From BaseTurnHandler (lines 512-600)
  if (this._currentState?.destroy) {
    try {
      await this._currentState.destroy(this);  // Calls TurnEndingState.destroy()
    } catch (stateErr) {
      // ...
    }
  }
  
  // Forces transition to Idle if needed
  if (needsTransition) {
    await this._transitionToState(
      this._turnStateFactory.createIdleState(this)
    );
  }
}
```

And simultaneously, `TurnEndingState.enterState()` is still executing:
- Line 104: `await ctx.requestIdleStateTransition()` is queued or pending
- Handler state machine is trying to transition to Idle via `enterState()`

**Result**: Both paths try to manage state transitions at the same time:
- `destroy()` path forcing Idle transition
- `enterState()` path requesting Idle transition via ITurnContext

---

## 4. Architecture Relationship Map

```
TurnManager (main turn cycle)
  ├─ #eventSubscription.subscribe(#handleTurnEndedEvent)
  │  └─ Event Bus: TURN_ENDED_ID → scheduler.setTimeout(callback, 0)
  │
  └─ #handleTurnEndedEvent() [SYNCHRONOUS]
     ├─ Lines 573-590: Event validation
     ├─ Lines 642-651: Update round success
     ├─ Lines 683-769: Dispatch TURN_PROCESSING_ENDED & schedule advanceTurn()
     │
     ├─ Lines 775-800: 🔴 DESTROY HANDLER (fire-and-forget)
     │  └─ Promise.resolve(handlerToDestroy.destroy()).catch(...)
     │
     └─ Lines 726-742: Schedule advanceTurn() via scheduler.setTimeout()


ActorTurnHandler (state machine host)
  ├─ extends GenericTurnHandler
  ├─ extends BaseTurnHandler
  │
  └─ StateMachine:
     ├─ TurnIdleState (initial)
     ├─ TurnAwaitingInputState
     ├─ TurnProcessingCommandState
     ├─ TurnEndingState ← currently executing enterState()
     └─ TurnAwaitingExternalTurnEndState


TurnEndingState.enterState()
  ├─ Line 55: await super.enterState()
  ├─ Line 60: await ctx.getTurnEndPort().notifyTurnEnded() 🔴 AWAITED
  ├─ Line 90: handler.signalNormalApparentTermination()
  ├─ Line 98: handler.resetStateAndResources()
  └─ Line 104: await ctx.requestIdleStateTransition() 🔴 AWAITED


BaseTurnHandler._transitionToState()
  ├─ Line 247: await prevState.exitState()
  ├─ Line 260: await newState.enterState() ← TurnEndingState here
  └─ State transition coordination


BaseTurnHandler.destroy()
  ├─ Line 547-558: await this._currentState.destroy(this)
  │  └─ Calls TurnEndingState.destroy()
  │
  ├─ Line 577-579: await this._transitionToState(IdleState) if needed
  │  └─ Can conflict with enterState()'s requestIdleStateTransition()
  │
  └─ Line 593: this._resetTurnStateAndResources()
     └─ Same operation as in TurnEndingState.enterState()
```

---

## 5. Key Code Locations Summary

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| `TurnManager.#handleTurnEndedEvent()` | `turnManager.js` | 573-807 | Event handler, **synchronous** |
| Event subscription | `turnManager.js` | 210 | Subscribes to TURN_ENDED_ID |
| TurnEventSubscription | `turnEventSubscription.js` | 57-98 | Schedules callback via setTimeout |
| Handler destruction call | `turnManager.js` | 792 | **Fire-and-forget Promise** ❌ |
| TurnEndingState.enterState() | `turnEndingState.js` | 49-114 | State entry, requests Idle transition |
| BaseTurnHandler.destroy() | `baseTurnHandler.js` | 512-600 | Full handler teardown |
| BaseTurnHandler._transitionToState() | `baseTurnHandler.js` | 203-301 | State machine coordination |
| BaseTurnHandler._resetTurnStateAndResources() | `baseTurnHandler.js` | 431-484 | Clears context & actor |

---

## 6. The Fundamental Issue

**TurnManager assumes this contract:**
1. Handler destruction is fire-and-forget
2. State machine will complete immediately upon turn end
3. No coordination needed between destroy() and state transitions

**But the actual behavior:**
1. State machines are async (enterState() has awaited operations)
2. TurnEndingState explicitly requests Idle transition (line 104)
3. destroy() also tries to force Idle transition independently
4. No synchronization mechanism prevents both from executing

**The fix requires:**
- ✅ Making handler destruction properly awaited
- ✅ Ensuring TurnEndingState completion before destroy() runs
- ✅ Preventing double state transitions
- ✅ Coordinating resource cleanup between two concurrent paths
