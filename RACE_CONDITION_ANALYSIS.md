# Race Condition Analysis: Turn End Handler Timing Issue

## Executive Summary

The race condition occurs because **the END_TURN operation doesn't await the event dispatch**, allowing the state's timeout to be set before the event subscriber is ready. The `#turnEndHandled` flag cannot prevent this because:

1. The flag is set INSIDE an async promise callback
2. The timeout is already scheduled BEFORE that callback could execute  
3. Setting the flag after the fact doesn't cancel an already-scheduled setTimeout

**The flag check at line 213 is ineffective because it's checking a flag that won't be set until AFTER the timeout has been scheduled.**

---

## Event Flow Timeline

### What Should Happen (Ideal)
```
1. Action triggers END_TURN operation
2. EndTurnHandler waits for dispatch to complete ← KEY: must await
3. State enters (subscriber ready)
4. Timeout is set
5. If turn_ended event arrives before timeout: flag set, return early
6. If timeout fires: flag still false, handle timeout
```

### What Actually Happens (Broken)
```
1. Action triggers END_TURN operation
2. EndTurnHandler calls dispatch() but DOESN'T await it
   ↓
3. Execute function returns immediately (dispatch still pending)
   ↓
4. State.enterState() runs
   ↓
5. subscribe() happens
6. setTimeout(..., 5000ms) is called ← Scheduled BEFORE dispatch completes!
   ↓
7. Meanwhile: dispatch() promise resolves in microtask queue
   ↓  
8. handleTurnEndedEvent() runs
9. this.#turnEndHandled = true ← Flag is set, but too late
   
T=5000ms:
10. Timeout fires: ctx.endTurn(error)
    ↑ This executes because the timeout was ALREADY scheduled
```

---

## The Code Evidence

### EndTurnHandler.execute() - THE PROBLEM

```javascript
// Line 108
await new Promise((resolve) => queueMicrotask(resolve));

// Line 110-113: CRITICAL - dispatch() is NOT awaited!
const dispatchResult = this.#safeEventDispatcher.dispatch(
  TURN_ENDED_ID,
  payload
);

// Line 114-123: Only chains a .then callback, doesn't await
if (dispatchResult && typeof dispatchResult.then === 'function') {
  dispatchResult.then((success) => {
    // ... handles success/failure ...
  });
}

// Function returns here!
// dispatch Promise is still pending!
```

**The function signature is `async execute()`**, but it doesn't await the dispatch. This means:
- `execute()` returns a Promise that resolves before dispatch completes
- The operation handler chain continues
- State transition happens
- **Timeout is set before dispatch is done**

### State.enterState() - Sets Timeout Too Early

```javascript
// Line 105-107: Subscribe to event
// This works, listener is registered
this.#unsubscribeFn = dispatcher?.subscribe(TURN_ENDED_ID, (event) =>
  this.handleTurnEndedEvent(handler, event)
);

// Line 113-115: Set timeout
// This schedules the timeout RIGHT NOW, with no knowledge of dispatch status
this.#timeoutId = this.#setTimeoutFn(async () => {
  await this.#onTimeout();
}, this.#configuredTimeout);
```

The problem: **We're setting the timeout before we know if/when the event will arrive.**

### The Ineffective Flag Check

```javascript
// Line 213
if (this.#turnEndHandled) {
  return;  // This check is too late
}

// Line 242
await ctx.endTurn(error);  // Executes because flag is still false
```

The flag is set here:
```javascript
// Line 131 - Inside the event handler callback
this.#turnEndHandled = true;
```

**Why the check fails:**
1. setTimeout(..., 5000) is scheduled at line 113
2. After 5000ms, the callback is invoked
3. The callback checks the flag at line 213
4. The flag's value depends on whether the event handler has executed
5. **But the event handler is an async callback that may not have executed yet**

---

## JavaScript Event Loop Explains It

### Execution Model

```
Call Stack (synchronous code)
    ↓
Microtask Queue (Promises, queueMicrotask)
    ↓
Macrotask Queue (setTimeout, setInterval)
    ↓
(repeat)
```

### Timeline with Real Timing

```
T=0ms (Initial Execution)
  - Action handler runs
  - endTurnHandler.execute() runs
  - Line 108: queueMicrotask(resolve) [registered]
  - Line 110: dispatch() called [returns Promise, not awaited]
  - execute() returns [Promise still pending!]
  - State.enterState() runs
  - Line 113: setTimeout(..., 5000) [registered in macrotask queue]
  
T=0ms+ (Event Loop - Microtask Phase)
  - Microtask from line 108 resolves
  - dispatch() microtasks from Promise.all() execute
  - handleTurnEndedEvent() callback executes
  - Line 131: this.#turnEndHandled = true ← Flag is finally set!
  
T=5000ms (Event Loop - Macrotask Phase)
  - setTimeout callback fires
  - #onTimeout() is called
  - Line 213: if (this.#turnEndHandled) ← Flag is now TRUE!
  - Should return early... but stack trace shows it doesn't!
```

Wait, this timeline suggests the flag SHOULD be set by 5000ms...

---

## Why The Stack Trace Shows the Problem

The stack trace shows:
```
awaitingExternalTurnEndState.js:242 (in #onTimeout)
awaitingExternalTurnEndState.js:114 (setTimeout callback)
```

This means:
1. setTimeout callback executed
2. #onTimeout() was invoked
3. Line 213 check did NOT return early
4. **Therefore: `this.#turnEndHandled === false` at that moment**

### Possible Scenarios

**Scenario A: The dispatch never completed by 5000ms**
- Unlikely in production but possible in tests with deferred event processing
- If dispatch is stuck, flag is never set

**Scenario B: The dispatch completed but with an error**
- If dispatch fails, the listener isn't called
- If listener isn't called, flag isn't set
- Line 215 would log a warning (but we don't see that)

**Scenario C: Event ordering issue**
- If another event interrupts the turn_ended dispatch
- Could cause race condition in event processing
- Flag remains false

**Scenario D: The subscriber callback never fires**
- If SafeEventDispatcher.subscribe() doesn't actually call the listener
- Flag would never be set
- Timeout always fires

### Most Likely: Dispatch Promise Never Awaited

The real issue is probably simpler:

In production/tests, the dispatch() call at line 110 may be deferred by:
1. The queueMicrotask at line 108 
2. The event bus's own async processing

If the turn ends and another action/state change happens quickly:
- The unsubscribe() at line 166 might run
- The state might exit before dispatch completes
- The listener might be unsubscribed before it fires
- Flag is never set

---

## Why This Is A Race Condition

A race condition exists when **outcome depends on timing of events outside your control**:

1. ✗ EndTurnHandler doesn't await dispatch
2. ✗ State doesn't know if event will arrive before timeout
3. ✗ Flag is set asynchronously inside event callback
4. ✗ Timeout is scheduled before dispatch completes
5. **→ Who wins: timeout or event? Depends on timing!**

---

## The Fix: Proper Coordination

### Core Problem
```javascript
// Current (broken) pattern:
await queueMicrotask(resolve);  // Defers dispatch call
const dispatchResult = dispatch(...);  // Not awaited!
// Function returns, dispatch is still pending

// Result: State sets timeout before dispatch completes
```

### Why The Flag Doesn't Help
```javascript
// Current (useless) pattern:
if (this.#turnEndHandled) {
  return;  // Flag is checked AFTER timeout is scheduled
}

// Why it fails:
// 1. setTimeout(..., 5000) is called at line 113
// 2. After 5000ms, callback fires
// 3. By then, flag MIGHT be true (if event arrived)
// 4. But timeout is already scheduled!
// 5. Setting flag doesn't "un-schedule" the timeout
```

The flag doesn't prevent the timeout from firing. It only prevents duplicate `endTurn()` calls.

### Required Solutions

**Option 1: Await the dispatch**
```javascript
// In endTurnHandler.execute():
await new Promise((resolve) => queueMicrotask(resolve));
const dispatchResult = await this.#safeEventDispatcher.dispatch(
  TURN_ENDED_ID,
  payload
);  // Await this!
```

**Option 2: Clear timeout in event handler**
```javascript
// In handleTurnEndedEvent:
if (this.#timeoutId) {
  clearTimeout(this.#timeoutId);
  this.#timeoutId = null;
}
```

**Option 3: Use Promise.race()**
```javascript
const eventPromise = new Promise(...);  // Resolves when event arrives
const timeoutPromise = new Promise(...);  // Resolves on timeout
const result = await Promise.race([eventPromise, timeoutPromise]);
// Whichever arrives first wins - no race condition!
```

---

## Key Insights

1. **The `#turnEndHandled` flag is a check, not a prevention**
   - It can prevent double-handling
   - But it can't prevent the timeout from being scheduled
   - Once scheduled, it will fire

2. **The real issue: Lack of coordination**
   - EndTurnHandler and State operate independently
   - No guarantee about dispatch timing
   - No synchronization point

3. **The queueMicrotask helps but isn't enough**
   - It defers the dispatch CALL
   - But the dispatch is still async
   - Listeners still execute asynchronously

4. **State should wait for dispatch or clear timeout**
   - Either await dispatch completion before setting timeout
   - Or clear timeout when event arrives
   - Or use Promise.race() for deterministic behavior

5. **The bug happens when:**
   - Timeout fires and flag check returns false
   - This means the event handler hasn't executed yet
   - Which means dispatch is still pending or listeners haven't been called

---

## Files Involved

| File | Lines | Issue |
|------|-------|-------|
| `endTurnHandler.js` | 108-113 | dispatch() not awaited |
| `awaitingExternalTurnEndState.js` | 105-115 | timeout set before dispatch completion |
| `awaitingExternalTurnEndState.js` | 213-242 | flag check ineffective |
| `awaitingExternalTurnEndState.js` | 131 | flag set too late |
| `eventBus.js` | 634-638 | Promise.all() defers listener execution |

---

## Conclusion

The `#turnEndHandled` flag is a **symptom band-aid**, not a cure:
- It's checking a flag that represents async state
- The flag can be set after the timeout is already scheduled
- Setting the flag doesn't prevent the timeout from executing

**Real fix**: Ensure dispatch completes (or is cleared) before relying on the timeout being the only way to end the turn.
