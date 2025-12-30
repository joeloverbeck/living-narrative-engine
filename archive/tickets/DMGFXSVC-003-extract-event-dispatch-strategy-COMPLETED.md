# DMGFXSVC-003: Extract EventDispatchStrategy (Strategy Pattern)

## Status
Completed

## Summary
Extract the session vs non-session dispatch logic from `DamageTypeEffectsService` into an injectable strategy pattern with two implementations: `ImmediateDispatchStrategy` and `SessionQueueStrategy`.

## Motivation
Current issues (from spec):
- Every effect application method has duplicate `if (damageSession) { ... } else { ... }` blocks
- 365+ lines of test code (lines 966-1331) dedicated to session variations
- Same dispatch logic repeated in 5 different effect methods
- Cannot test dispatch behavior in isolation

## Corrections to Assumptions & Scope
- Anatomy-related DI registrations live in `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`, not `anatomyRegistrations.js`.
- The current session-dispatch logic does not emit warnings when `pendingEvents`/`entries` are missing; the strategy mirrors existing behavior rather than adding new logging.

## Files to Touch

### Create
- `src/anatomy/services/eventDispatchStrategy.js` - Strategy interface and implementations
- `tests/unit/anatomy/services/eventDispatchStrategy.test.js` - Unit tests

### Modify
- `src/dependencyInjection/tokens/tokens-core.js` - Add strategy tokens
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register strategies (current anatomy services live here)

## Out of Scope
- **DO NOT** modify `damageTypeEffectsService.js` in this ticket (integration is DMGFXSVC-009)
- **DO NOT** modify existing `damageTypeEffectsService.test.js` tests
- **DO NOT** change event payload structures
- **DO NOT** change session data structures (entries, pendingEvents, effectsTriggered)
- **DO NOT** modify the `ISafeEventDispatcher` interface

## Implementation Details

### Strategy Interface (JSDoc-based)
```javascript
/**
 * @typedef {Object} IEventDispatchStrategy
 * @property {function(string, Object, Object?): void} dispatch - Dispatch or queue an event
 * @property {function(string, string, Object?): void} recordEffect - Record an effect trigger
 */
```

### ImmediateDispatchStrategy
```javascript
class ImmediateDispatchStrategy {
  #dispatcher;

  constructor({ safeEventDispatcher }) {
    // Validate dispatcher dependency
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Dispatch event immediately via safeEventDispatcher.
   * @param {string} eventType - Event type to dispatch
   * @param {Object} payload - Event payload
   * @param {Object} [sessionContext] - Ignored in immediate mode
   */
  dispatch(eventType, payload, sessionContext = null) {
    this.#dispatcher.dispatch(eventType, payload);
  }

  /**
   * No-op in immediate mode (no session to record to).
   * @param {string} partId
   * @param {string} effectName
   * @param {Object} [sessionContext]
   */
  recordEffect(partId, effectName, sessionContext = null) {
    // No-op: immediate dispatch has no session tracking
  }
}
```

### SessionQueueStrategy
```javascript
class SessionQueueStrategy {
  /**
   * Queue event to session's pendingEvents array.
   * @param {string} eventType - Event type to queue
   * @param {Object} payload - Event payload
   * @param {Object} sessionContext - Must include damageSession
   */
  dispatch(eventType, payload, sessionContext) {
    const { damageSession } = sessionContext;
    damageSession.pendingEvents.push({ eventType, payload });
  }

  /**
   * Record effect in session entry's effectsTriggered array.
   * @param {string} partId - Part ID to find in entries
   * @param {string} effectName - Effect name to record
   * @param {Object} sessionContext - Must include damageSession
   */
  recordEffect(partId, effectName, sessionContext) {
    const { damageSession } = sessionContext;
    const entry = damageSession.entries.find((e) => e.partId === partId);
    if (!entry) {
      return;
    }
    entry.effectsTriggered = entry.effectsTriggered || [];
    entry.effectsTriggered.push(effectName);
    // Gracefully handle missing entry (per spec edge case)
  }
}
```

### Strategy Factory Helper
```javascript
/**
 * Create appropriate dispatch strategy based on session presence.
 * @param {Object} safeEventDispatcher - Dispatcher for immediate mode
 * @param {Object|null} damageSession - Session object if present
 * @returns {IEventDispatchStrategy}
 */
export function createDispatchStrategy(safeEventDispatcher, damageSession) {
  if (damageSession) {
    return new SessionQueueStrategy();
  }
  return new ImmediateDispatchStrategy({ safeEventDispatcher });
}
```

### DI Tokens
Add to `tokens-core.js`:
```javascript
ImmediateDispatchStrategy: 'ImmediateDispatchStrategy',
SessionQueueStrategy: 'SessionQueueStrategy',
```

### Registration
Add to anatomy registrations:
```javascript
// Note: These are typically created at call-time via factory, but registered for testing
registrar.factory(tokens.ImmediateDispatchStrategy, (c) => {
  return new ImmediateDispatchStrategy({
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
  });
});

registrar.factory(tokens.SessionQueueStrategy, (c) => {
  return new SessionQueueStrategy();
});
```

## Acceptance Criteria

### Tests That Must Pass

#### New Tests (eventDispatchStrategy.test.js)

**ImmediateDispatchStrategy**:
1. `constructor - validates safeEventDispatcher dependency`
2. `dispatch - calls dispatcher.dispatch with eventType and payload`
3. `dispatch - ignores sessionContext parameter`
4. `recordEffect - is a no-op (does not throw)`
5. `recordEffect - does not modify sessionContext`

**SessionQueueStrategy**:
1. `dispatch - pushes event to damageSession.pendingEvents`
2. `recordEffect - adds effectName to matching entry's effectsTriggered`
3. `recordEffect - initializes effectsTriggered array if absent`
4. `recordEffect - gracefully handles missing entry (no throw)`

**createDispatchStrategy factory**:
1. `returns ImmediateDispatchStrategy when damageSession is null`
2. `returns ImmediateDispatchStrategy when damageSession is undefined`
3. `returns SessionQueueStrategy when damageSession is provided`

#### Existing Tests
- All 68 existing `damageTypeEffectsService.test.js` tests must pass unchanged

### Invariants That Must Remain True
- **INV-5**: Every effect application dispatches (or queues) exactly one event
- Immediate dispatch calls `dispatcher.dispatch()` exactly once per call
- Session dispatch pushes exactly one entry to `pendingEvents` per call
- Effect recording pushes exactly one entry to `effectsTriggered` per call
- Session data structure is not corrupted by strategy operations

## Verification Commands
```bash
# Run new tests
npm run test:unit -- tests/unit/anatomy/services/eventDispatchStrategy.test.js

# Verify existing tests still pass
npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js

# Verify DI registration compiles
npm run typecheck
```

## Size Estimate
- ~80 lines of implementation code (both strategies + factory)
- ~150 lines of test code
- ~10 lines of DI registration

## Outcome
- Added `ImmediateDispatchStrategy`, `SessionQueueStrategy`, and `createDispatchStrategy` with behavior matching current session dispatch (no new warning logging).
- Registered strategy tokens in `tokens-core.js` and factories in `worldAndEntityRegistrations.js`.
- Added unit tests for strategies and factory; existing `DamageTypeEffectsService` tests remain unchanged.
