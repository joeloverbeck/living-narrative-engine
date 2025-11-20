# Specification: Robust AwaitingExternalTurnEndState Configuration

## Context

### Location in Codebase

**Production Code:** `src/turns/states/awaitingExternalTurnEndState.js`

**Module Role:** Turn state machine state that waits for external `core:turn_ended` events with timeout protection

**Class Hierarchy:**
- Extends: `AbstractTurnState` (src/turns/states/abstractTurnState.js)
- Implements: Turn state lifecycle contract (enterState, exitState, destroy)

**Related Components:**
- Turn State Machine: `BaseTurnHandler` (src/turns/handlers/baseTurnHandler.js)
- Other States: TurnIdleState, ProcessingCommandState, TurnEndingState, AwaitingActorDecisionState
- Event System: SafeEventDispatcher, event constants (src/constants/eventIds.js)

### Module Purpose and Responsibilities

The `AwaitingExternalTurnEndState` class is a **critical safety mechanism** in the turn-based game engine that:

1. **Waits for Rule-Triggered Events**: After an action attempt, expects mod rules to emit `core:turn_ended` event
2. **Timeout Protection**: Prevents engine lockup if rules fail to emit the expected event
   - Production: 30 seconds (line 33: `TIMEOUT_MS = IS_DEV ? 3_000 : 30_000`)
   - Development: 3 seconds (faster feedback during development)
3. **Graceful Degradation**: When timeout occurs:
   - Dispatches `SYSTEM_ERROR_OCCURRED` event with diagnostic details
   - Ends turn with failure error (`TURN_END_TIMEOUT`)
   - Keeps game loop alive instead of hard-locking the engine
4. **Resource Cleanup**: Manages event subscriptions and timeout timers across state lifecycle

### Dependencies and Integration Points

**Direct Dependencies:**
- `AbstractTurnState` - Base class providing handler context and lifecycle methods
- `timeoutUtils.js` (line 8) - Timeout error creation utilities
- `safeDispatchErrorUtils.js` (line 9) - Error event dispatching helpers
- `contextUtils.js` (line 10) - Logger and dispatcher extraction from context

**Indirect Dependencies:**
- `ITurnContext` - Turn context interface (actor, services, state management)
- `BaseTurnHandler` - State machine host providing transitions and context
- Timer APIs: `setTimeout`, `clearTimeout` (browser/Node.js global functions)

**Integration Points:**
- **Event System**: Subscribes to `TURN_ENDED_ID` (line 97), dispatches `SYSTEM_ERROR_OCCURRED_ID` (line 116)
- **Turn Context**: Manages `awaitingExternalEvent` flag (lines 101, 176), triggers `endTurn()` (line 121)
- **State Machine**: Lifecycle managed via `enterState()` (line 88) / `exitState()` (line 144) / `destroy()` (line 170)

---

## Problem

### What Failed and How

**Test Failure Location:**
`tests/integration/turns/states/awaitingExternalTurnEndState.production.integration.test.js:111`

**Failure Message:**
```
expect(jest.fn()).toHaveBeenCalledWith(...expected)
Expected: Any<Function>, 30000
Received: [Function anonymous], 3000
```

**Test Expectation:**
The test attempted to verify production behavior:
1. Module loads with `NODE_ENV=production`
2. Timeout configured to 30,000ms (production value)
3. Real `setTimeout`/`clearTimeout` used (not mocks)
4. Timeout fires correctly after 30 seconds
5. Cleanup occurs properly on state exit

**What Actually Happened:**
The test received a 3,000ms timeout (development value) instead of the expected 30,000ms (production value).

### Root Cause Analysis

**Problematic Code** (awaitingExternalTurnEndState.js:30-33):
```javascript
const IS_DEV =
  (typeof process !== 'undefined' && process?.env?.NODE_ENV !== 'production') ||
  false;
const TIMEOUT_MS = IS_DEV ? 3_000 : 30_000;
```

**Why This Failed:**

1. **Module-Level Evaluation**: `IS_DEV` and `TIMEOUT_MS` are top-level constants evaluated **at module load time**
2. **Jest Environment Caching**: In Jest, even with `process.env.NODE_ENV = 'production'`:
   - Modules are cached by default
   - First load in test suite has `NODE_ENV=test`
   - Setting `NODE_ENV=production` later doesn't re-evaluate module constants
3. **Complex Workaround Required**: Test needed `jest.isolateModulesAsync()` with URL cache busting (line 56-70)
4. **Fragile Test Setup**: Test must:
   - Delete `NODE_ENV` (line 59) - but this made condition evaluate as `!== 'production'` → `true` → dev mode
   - Use URL query params for cache busting (line 62: `?prod=${Date.now()}`)
   - Convert to file URLs (line 65: `pathToFileURL`)

**Fix Applied:**
Changed line 59 from `delete process.env.NODE_ENV` to `process.env.NODE_ENV = 'production'`, which made the environment detection evaluate correctly during module import.

### Why This Design Is Fragile

1. **Environment Detection Timing**: Module-level evaluation locks in environment at load time, making dynamic configuration impossible
2. **Test Hostility**: Cannot easily test different environment configurations without complex module isolation
3. **Tight Coupling**: Timeout value tightly coupled to global environment detection
4. **No Override Path**: Constructor accepts `timeoutMs` parameter but class constant is still evaluated at module level
5. **Inconsistent Patterns**: Project has `IEnvironmentProvider` interface (src/interfaces/IEnvironmentProvider.js) and environment utilities (src/utils/environmentUtils.js) that are NOT used here
6. **Module Isolation Tax**: Testing requires `jest.isolateModulesAsync()` with URL cache busting, adding complexity

---

## Truth Sources

### Relevant Documentation

**Turn State System:**
- **Pattern Source**: `AbstractTurnState` implementation (src/turns/states/abstractTurnState.js:1-316)
- **State Lifecycle Contract**: Constructor → enterState() → exitState() → destroy()
- **No Dedicated Docs**: Turn state lifecycle not formally documented in docs/ folder

**Environment Management:**
- **Interface**: `src/interfaces/IEnvironmentProvider.js` - Standard environment abstraction
  ```javascript
  interface IEnvironmentProvider {
    getEnvironment(): { IS_PRODUCTION: boolean, NODE_ENV: string }
  }
  ```
- **Utilities**: `src/utils/environmentUtils.js` - Cross-platform environment detection
  - `getEnvironmentMode()` - Returns 'production' | 'development' | 'test'
  - `isProduction()`, `isDevelopment()`, `isTest()` - Boolean helpers
  - Handles browser, Node.js, and Jest environments correctly
- **Implementations**:
  - `src/environment/ProcessEnvironmentProvider.js` - Production implementation
  - `src/environment/TestEnvironmentProvider.js` - Testing implementation
- **Usage Pattern**: 47+ files use environment detection, mixture of patterns observed

### Domain Rules (Turn State Lifecycle)

**State Lifecycle Contract** (from AbstractTurnState):

1. **Constructor Phase**:
   - Receives `handler` (BaseTurnHandler instance)
   - Stores context reference
   - Initializes private fields
   - **Must not** perform I/O or side effects

2. **enterState(handler, previousState)**:
   - Setup phase: acquire resources, register listeners
   - Set context flags (e.g., `setAwaitingExternalEvent(true)`)
   - Start timers or background operations
   - **Must** handle context absence gracefully (null checks)
   - **Must** log state entry at debug level

3. **exitState(handler, nextState)**:
   - Teardown phase: release resources, cleanup
   - Clear context flags
   - Stop timers, unsubscribe from events
   - **Must** run even on errors (cleanup must not fail)
   - **Must** log state exit at debug level

4. **destroy(handler)**:
   - Final cleanup when state permanently disposed
   - **Must** be idempotent (safe to call multiple times)
   - **Must** release all resources (no leaks)
   - **Should** verify resources released successfully

**Awaiting State Specific Behavior:**

1. **On Enter** (enterState):
   - Subscribe to `TURN_ENDED_ID` event (line 97)
   - Set context flag: `setAwaitingExternalEvent(true, actorId)` (line 101)
   - Start timeout guard rail (line 104)

2. **On Event Arrival** (handleTurnEndedEvent):
   - Verify actor ID matches context actor (line 129-135)
   - Clear timeout guard (line 137)
   - End turn successfully (no error) (line 140)

3. **On Timeout** (_onTimeout):
   - Dispatch `SYSTEM_ERROR_OCCURRED` event (line 116)
   - End turn with `TURN_END_TIMEOUT` error (line 121)

4. **On Exit** (exitState):
   - Clear timeout if still scheduled (line 159-162)
   - Unsubscribe from event (line 164)
   - Reset awaiting flag (line 176)

5. **On Destroy** (destroy):
   - Call exitState to ensure cleanup (line 174)
   - Verify event listener count is zero (line 177-181)

### External Contracts

**Timer APIs (Browser + Node.js):**
- `setTimeout(callback: Function, ms: number): TimeoutID`
  - Returns timeout ID (number in browser, Timeout object in Node.js)
  - Callback invoked after `ms` milliseconds
  - Not guaranteed to be precise (event loop dependent)
- `clearTimeout(id: TimeoutID): void`
  - Cancels scheduled timeout
  - Safe to call with invalid/cleared IDs (no-op)
  - Must work with IDs from `setTimeout`

**Environment Detection:**
Project must handle three environments:
1. **Browser (Production)**: `typeof process === 'undefined'`
   - No `process.env` global
   - Should default to production timeouts (fail-safe)
2. **Node.js (Development/Production)**: `typeof process !== 'undefined'`
   - `process.env.NODE_ENV` available
   - Common values: 'production', 'development', 'test'
3. **Jest (Testing)**: `process.env.NODE_ENV === 'test'`
   - Module caching enabled by default
   - Environment variables can change between tests

**Common Patterns in Project:**
- **Direct checks**: 47+ files use `process.env.NODE_ENV` directly
- **Utils pattern**: `environmentUtils.js` provides standardized helpers
- **DI pattern**: `IEnvironmentProvider` interface for testable environment detection

---

## Desired Behavior

### Normal Cases

**Production Environment (Browser Deployment):**
```javascript
// Given: Browser build without process.env
// When: State enters and waits for turn end event
// Then: Timeout set to 30,000ms (30 seconds)
// And: Uses native browser setTimeout/clearTimeout
// And: Cleanup properly releases resources on exit/destroy
// And: No errors logged for missing environment detection
```

**Development Environment (Node.js Dev Server):**
```javascript
// Given: Development server with NODE_ENV=development
// When: State enters and waits for turn end event
// Then: Timeout set to 3,000ms (3 seconds for fast feedback)
// And: Uses native Node.js setTimeout/clearTimeout
// And: Cleanup properly releases resources on exit/destroy
// And: Faster timeout helps developers iterate quickly
```

**Test Environment (Jest Test Runner):**
```javascript
// Given: Unit test with custom timeout override
// When: State created with { timeoutMs: 1000 }
// Then: Uses injected timeout value (1000ms)
// And: Uses injected mock timers if provided via setTimeoutFn
// And: Configurable independently of NODE_ENV
// And: Test can verify timeout behavior without waiting 30s
```

### Edge Cases

**Undefined/Missing NODE_ENV:**
```javascript
// Given: Browser build without NODE_ENV environment variable injection
// When: Module loads in production browser
// Then: Should default to production timeout (30,000ms)
// Rationale: Fail-safe behavior - err on side of patience
// Implementation: typeof process === 'undefined' → false → production
```

**Custom Timeout Overrides:**
```javascript
// Given: Constructor called with explicit { timeoutMs: 5000 }
// When: State enters
// Then: Uses provided timeout (5000ms), not environment-based default
// Rationale: Explicit configuration overrides environment detection
// Use Case: Staging environment with intermediate timeout
```

**Environment Transition Scenarios:**
```javascript
// Given: Hot module reload changes NODE_ENV
// When: Module already loaded with different NODE_ENV
// Then: Should not require module cache busting to pick up new value
// Rationale: Testing and hot-reload friendly
// Current Problem: Module-level constants lock in first value
```

**Timeout Override with Zero/Negative:**
```javascript
// Given: Constructor called with { timeoutMs: 0 } or { timeoutMs: -1000 }
// When: State enters
// Then: Should throw clear validation error OR use sensible default
// Rationale: Invalid configuration should fail fast
// Prefer: Throw InvalidArgumentError with clear message
```

**Missing Handler Context:**
```javascript
// Given: enterState called but handler.getTurnContext() returns null
// When: Attempting to set timeout
// Then: Should log warning and skip timeout setup (graceful degradation)
// Rationale: State classes must handle missing context per AbstractTurnState pattern
// Implementation: All context access wrapped in null checks (lines 94-96, 99-103, etc.)
```

### Failure Modes

**Timeout Expiration (Normal Failure Path):**
```javascript
// Given: State waiting for core:turn_ended event
// When: Timeout expires (30s production, 3s development) without event arrival
// Then:
//   1. Dispatches SYSTEM_ERROR_OCCURRED event with diagnostic details (line 116)
//      - Error code: 'TURN_END_TIMEOUT'
//      - Actor ID: context.actor.id
//      - Timeout value: actual milliseconds used
//   2. Calls context.endTurn() with TURN_END_TIMEOUT error (line 121)
//      - Error message includes timeout duration
//   3. Cleanup releases all resources:
//      - Timeout ID cleared (already fired, but nulled)
//      - Event subscription removed (in exitState)
//      - Awaiting flag reset (in exitState)
// And: Game loop continues (turn ends, state transitions to next)
// And: Error logged for debugging but engine remains operational
```

**State Cleanup on Errors:**
```javascript
// Given: State entered successfully with active timeout and subscription
// When: Unexpected error occurs during event handling or state operation
// Then:
//   - exitState() called with error context
//   - Timeout cleared even if error occurred (line 159-162)
//   - Event subscription removed even if error occurred (line 164)
//   - Awaiting flag reset even if error occurred (line 176)
//   - destroy() clears any remaining resources (line 174)
// And: No resource leaks (memory, subscriptions, timers)
// And: State machine can continue to next state safely
```

**Invalid Configuration (Constructor Validation):**
```javascript
// Given: Constructor called with invalid timeoutMs (NaN, null, "invalid", etc.)
// When: State instantiated
// Then: Should validate and throw clear error
//   - Error type: InvalidArgumentError or TypeError
//   - Error message: "timeoutMs must be positive finite number, got: ${value}"
// Rationale: Fail fast on configuration errors
// Alternative: Log warning and fall back to environment default (more lenient)
```

**Timer Function Injection Errors:**
```javascript
// Given: Constructor called with non-function setTimeoutFn or clearTimeoutFn
// When: State attempts to schedule timeout
// Then:
//   - Option A (Strict): Throw error immediately in constructor validation
//   - Option B (Lenient): Catch error in enterState, log, skip timeout setup
// Recommendation: Option A (fail fast) for better developer experience
```

### Invariants

**Properties that MUST always hold:**

1. **Single Timeout Invariant**:
   - At most one timeout scheduled at any given time
   - Verification: `this.#timeoutId` is either null or a valid timeout ID
   - Violation detection: Setting timeout when `this.#timeoutId !== null`

2. **Single Subscription Invariant**:
   - At most one event subscription active at any time
   - Verification: Event listener count for `TURN_ENDED_ID` ≤ 1
   - Violation detection: `destroy()` verifies count === 0 (lines 177-181)

3. **Flag Consistency Invariant**:
   - `awaitingExternalEvent` flag always cleared on exit/destroy
   - Verification: Context flag reset in exitState (line 176)
   - Violation: Flag left true would block future turns

4. **Resource Cleanup Invariant**:
   - `exitState()` and `destroy()` MUST clear ALL resources
   - Resources: timeout ID, event subscription, awaiting flag
   - Violation: Resource leaks (timers, memory, listeners)

5. **Context Validity Invariant**:
   - All operations verify context exists before use
   - Pattern: `const context = handler?.getTurnContext?.(); if (!context) return;`
   - Violation: NullPointerException/TypeError on missing context

6. **Actor Matching Invariant**:
   - Turn end events only processed if actor ID matches context actor
   - Verification: `event.payload?.actorId === context.actor?.id` (line 129)
   - Violation: Processing events for wrong actor could corrupt state

7. **No Double-End Invariant**:
   - Turn can only end once per state instance
   - Implementation: Timeout clears itself after firing (line 110)
   - Verification: exitState clears timeout before it can fire again

**Timeout Guarantees:**

1. **Bounded Wait**: Turn MUST end within timeout period (no infinite wait)
   - Guaranteed by: setTimeout() contract and _onTimeout() handler
   - Failure mode: Only if timer API completely fails (rare)

2. **Cleanup After Fire**: Timeout callback clears its own ID
   - Implementation: `this.#timeoutId = null;` in _onTimeout (line 110)
   - Purpose: Prevents double-cleanup in exitState

3. **No Orphan Timers**: Timer cleared in all exit paths
   - Paths: Normal event arrival (line 137), exitState (line 159), destroy (line 174)
   - Verification: No timers left after state destruction

**State Transition Contracts:**

1. **Enter Before Use**: No operations before `enterState()` completes
   - Constructor only initializes fields, no side effects
   - All resource acquisition in enterState

2. **Exit Before Transition**: Resources released before state change
   - State machine calls exitState before changing state
   - New state cannot enter until previous exits

3. **Idempotent Cleanup**: Multiple calls to cleanup methods safe
   - clearTimeout(null) is safe (no-op)
   - Unsubscribe on non-existent subscription is safe
   - Flag reset to false is idempotent

### API Contracts

**Public Interface (MUST Remain Stable):**

```javascript
/**
 * State that waits for external turn_ended event with timeout protection
 * @extends AbstractTurnState
 */
class AwaitingExternalTurnEndState extends AbstractTurnState {
  /**
   * Creates new awaiting state instance
   * @param {BaseTurnHandler} handler - Required state machine host
   * @param {object} [options] - Optional configuration
   * @param {number} [options.timeoutMs] - Timeout duration override (ms)
   * @param {Function} [options.setTimeoutFn] - Custom setTimeout implementation
   * @param {Function} [options.clearTimeoutFn] - Custom clearTimeout implementation
   * @throws {InvalidArgumentError} If handler invalid or options malformed
   */
  constructor(handler, options = {})

  /**
   * Enters the state: subscribes to events and starts timeout
   * @param {BaseTurnHandler} handler - State machine host
   * @param {AbstractTurnState|null} previousState - Previous state or null
   * @returns {Promise<void>}
   */
  async enterState(handler, previousState)

  /**
   * Exits the state: clears timeout and unsubscribes from events
   * @param {BaseTurnHandler} handler - State machine host
   * @param {AbstractTurnState|null} nextState - Next state or null
   * @returns {Promise<void>}
   */
  async exitState(handler, nextState)

  /**
   * Destroys the state: ensures all resources released
   * @param {BaseTurnHandler} handler - State machine host
   * @returns {Promise<void>}
   */
  async destroy(handler)

  /**
   * Handles turn ended event from mod rules
   * @param {BaseTurnHandler} handler - State machine host
   * @param {object} event - Event payload with actorId
   * @returns {Promise<void>}
   */
  async handleTurnEndedEvent(handler, event)

  /**
   * No-op while waiting for external event
   * @returns {Promise<void>}
   */
  async handleSubmittedCommand()

  /**
   * Testing introspection (for unit tests only)
   * @returns {object} Internal state snapshot
   */
  getInternalStateForTest()
}
```

**Constructor Parameters (Backward Compatible):**

Current signature (line 57-76):
```javascript
constructor(handler, { timeoutMs, setTimeoutFn, clearTimeoutFn } = {})
```

**Required Parameters:**
- `handler`: BaseTurnHandler instance (validated in AbstractTurnState)

**Optional Parameters (default values maintain backward compatibility):**
- `options.timeoutMs`: Explicit timeout override
  - Type: `number` (positive finite)
  - Default: Environment-based (30s production, 3s dev)
  - Override: Always uses provided value if specified
- `options.setTimeoutFn`: Timer injection for testing
  - Type: `Function(callback, ms) => TimeoutID`
  - Default: Native `setTimeout`
  - Purpose: Allow fake timers in tests
- `options.clearTimeoutFn`: Timer injection for testing
  - Type: `Function(id) => void`
  - Default: Native `clearTimeout`
  - Purpose: Allow fake timers in tests

**State Lifecycle Methods:**
- Inherited from `AbstractTurnState`, MUST call `super` implementations where applicable
- MUST handle context absence gracefully (null checks)
- MUST log transitions at debug level (AbstractTurnState contract)

**Event Handling:**
- `handleTurnEndedEvent`: Processes `TURN_ENDED_ID` events
  - MUST verify actor ID matches
  - MUST clear timeout on event arrival
  - MUST call `context.endTurn()` to complete turn

**Testing Utilities:**
- `getInternalStateForTest()`: Exposes internal state for verification
  - Returns: `{ timeoutId, hasSubscription, ... }`
  - Purpose: Allow tests to verify resource management
  - Not for production use

### What is Allowed to Change

**Internal Implementation (Safe to Modify):**

1. **Environment Detection Mechanism**:
   - ✅ Can switch from module-level constant to instance-level evaluation
   - ✅ Can inject `IEnvironmentProvider` via constructor options
   - ✅ Can use existing `environmentUtils.js` helper functions
   - ✅ Can defer environment detection until `enterState()`
   - ❌ Cannot remove environment-based timeout behavior without migration plan

2. **Configuration Loading**:
   - ✅ Can replace top-level constants with instance fields
   - ✅ Can accept configuration object in constructor (already done)
   - ✅ Can support multiple configuration sources (DI, defaults, overrides)
   - ✅ Can add validation for timeout values
   - ❌ Cannot change constructor signature (only add optional parameters)

3. **Timeout Value Defaults**:
   - ✅ Can adjust dev/prod timeout values (document reasons in comments/CHANGELOG)
   - ✅ Can add intermediate timeout tiers (staging, CI, etc.)
   - ✅ Can make timeouts configurable at application level (via DI)
   - ⚠️ Should maintain production default at 30s (established user expectation)

4. **Error Handling**:
   - ✅ Can improve error messages and diagnostics
   - ✅ Can add error recovery strategies
   - ✅ Can enhance logging verbosity levels
   - ❌ Cannot change error event structure (breaks event handlers)

5. **Testing Utilities**:
   - ✅ Can add more introspection helpers (`getInternalStateForTest`)
   - ✅ Can improve mock-friendliness
   - ✅ Can add builder patterns for test setup
   - ✅ Can provide better test documentation

6. **Private Implementation Details**:
   - ✅ Field names (currently `#timeoutId`, `#setTimeoutFn`, etc.)
   - ✅ Internal method names (currently `_onTimeout`, `_cleanupResources`)
   - ✅ Logging statements and diagnostic info
   - ✅ Code organization and module structure

**Backward Compatibility Requirements:**

1. **Constructor Signature**:
   - ✅ Can ADD optional parameters
   - ❌ Cannot REMOVE existing parameters
   - ❌ Cannot change parameter order
   - ❌ Cannot make optional parameters required

2. **Lifecycle Methods**:
   - ✅ Can improve internal implementation
   - ❌ Cannot change method signatures
   - ❌ Cannot change async/Promise behavior
   - ❌ Cannot remove or rename methods

3. **Event Handling**:
   - ✅ Can improve actor matching logic
   - ❌ Cannot change `TURN_ENDED_ID` event structure expectations
   - ❌ Cannot change `SYSTEM_ERROR_OCCURRED` event payload format
   - ❌ Cannot stop dispatching error events

4. **Timeout Behavior**:
   - ✅ Can improve timeout accuracy
   - ✅ Can add timeout configuration options
   - ❌ Cannot remove timeout mechanism
   - ❌ Cannot change fundamental timeout → error → end turn flow

5. **Cleanup Guarantees**:
   - ✅ Can improve cleanup robustness
   - ❌ Cannot skip cleanup in any code path
   - ❌ Cannot leave resources allocated after destroy
   - ❌ Cannot change cleanup order (timeout → subscription → flag)

---

## Testing Plan

### Tests to Update/Add

#### Unit Tests (`tests/unit/turns/states/`)

**1. Environment Configuration Tests (NEW):**

File: `tests/unit/turns/states/awaitingExternalTurnEndState.environmentConfig.test.js`

```javascript
describe('AwaitingExternalTurnEndState - Environment Configuration', () => {
  describe('with IEnvironmentProvider injection', () => {
    test('uses production timeout when environment provider returns production', () => {
      // Inject mock provider returning { IS_PRODUCTION: true }
      // Verify timeout set to 30_000
    });

    test('uses development timeout when environment provider returns development', () => {
      // Inject mock provider returning { IS_PRODUCTION: false }
      // Verify timeout set to 3_000
    });

    test('uses test timeout when environment provider returns test', () => {
      // Inject TestEnvironmentProvider
      // Verify configurable timeout behavior
    });
  });

  describe('with explicit timeoutMs override', () => {
    test('constructor timeoutMs override takes precedence over environment', () => {
      // Create with { timeoutMs: 5_000 } and production provider
      // Verify timeout set to 5_000 (override wins)
    });

    test('validates timeout value is positive finite number', () => {
      // Create with { timeoutMs: -1000 }, { timeoutMs: NaN }, etc.
      // Verify throws InvalidArgumentError with clear message
    });
  });

  describe('with missing environment provider', () => {
    test('defaults to production timeout when environment provider unavailable', () => {
      // Create without environment provider
      // Verify timeout defaults to 30_000 (fail-safe)
    });
  });
});
```

**2. Timer Injection Tests (UPDATE EXISTING):**

File: `tests/unit/turns/states/awaitingExternalTurnEndState.timers.test.js` (existing)

```javascript
describe('AwaitingExternalTurnEndState - Timer Injection', () => {
  // EXISTING: Verify custom setTimeoutFn/clearTimeoutFn injection works

  // ADD: Validation tests for invalid timer functions
  test('throws error when setTimeoutFn is not a function', () => {
    expect(() => new AwaitingExternalTurnEndState(handler, {
      setTimeoutFn: "not-a-function"
    })).toThrow(InvalidArgumentError);
  });

  test('throws error when clearTimeoutFn is not a function', () => {
    expect(() => new AwaitingExternalTurnEndState(handler, {
      clearTimeoutFn: null
    })).toThrow(InvalidArgumentError);
  });
});
```

**3. Lifecycle Tests (UPDATE EXISTING):**

File: `tests/unit/turns/states/awaitingExternalTurnEndState.comprehensive.test.js` (existing)

```javascript
describe('AwaitingExternalTurnEndState - Lifecycle', () => {
  // EXISTING: Comprehensive lifecycle tests

  // ADD: Environment provider injection scenarios
  describe('with environment provider', () => {
    test('evaluates environment at construction time', () => {
      // Verify environment checked when instance created
      // Not at module load time
    });

    test('uses same environment throughout instance lifetime', () => {
      // Verify changing environment after construction doesn't affect instance
    });
  });

  // ADD: Configuration validation during construction
  test('validates all constructor options on creation', () => {
    // Verify invalid options detected immediately
    // Not deferred to enterState
  });
});
```

#### Integration Tests (`tests/integration/turns/states/`)

**1. Production Environment Test (UPDATE EXISTING):**

File: `tests/integration/turns/states/awaitingExternalTurnEndState.production.integration.test.js`

**Current State:** Uses complex module isolation with cache busting

**Improvements Needed:**
```javascript
describe('AwaitingExternalTurnEndState production defaults integration', () => {
  // CURRENT: Complex jest.isolateModulesAsync with URL cache busting
  // IMPROVED: Should work without module isolation if using DI

  test('schedules production timeout using environment provider', async () => {
    // Use ProductionEnvironmentProvider or mock returning production
    // Verify timeout = 30_000 without module isolation tricks
    // Verify real setTimeout/clearTimeout used
    // Verify cleanup works correctly
  });

  test('schedules production timeout in browser-like environment', async () => {
    // Simulate browser (typeof process === 'undefined')
    // Verify defaults to production timeout (30_000)
    // Verify no errors from missing process global
  });
});
```

**2. Environment Provider Integration (NEW):**

File: `tests/integration/turns/states/awaitingExternalTurnEndState.environmentProvider.integration.test.js`

```javascript
describe('AwaitingExternalTurnEndState with Environment Providers', () => {
  test('integrates with ProcessEnvironmentProvider', async () => {
    // Create state with ProcessEnvironmentProvider
    // Set NODE_ENV=production
    // Verify production timeout used
  });

  test('integrates with TestEnvironmentProvider', async () => {
    // Create state with TestEnvironmentProvider
    // Configure test timeout value
    // Verify test timeout used
  });

  test('falls back gracefully when provider returns invalid data', async () => {
    // Provider returns malformed environment object
    // Verify state uses safe default (production timeout)
    // Verify warning logged
  });

  test('handles provider throwing errors', async () => {
    // Provider.getEnvironment() throws error
    // Verify state catches and uses safe default
    // Verify error logged
  });
});
```

**3. End-to-End Timeout Scenarios (NEW):**

File: `tests/integration/turns/states/awaitingExternalTurnEndState.timeoutScenarios.integration.test.js`

```javascript
describe('AwaitingExternalTurnEndState - Timeout Behavior E2E', () => {
  test('timeout fires and ends turn with production config', async () => {
    // Production environment provider
    // Enter state, wait for 30s timeout (using fake timers)
    // Verify error dispatched, turn ended, resources cleaned
  });

  test('timeout fires and ends turn with development config', async () => {
    // Development environment provider
    // Enter state, wait for 3s timeout (using fake timers)
    // Verify error dispatched, turn ended, resources cleaned
  });

  test('event arrival prevents timeout from firing', async () => {
    // Enter state, dispatch turn_ended event before timeout
    // Advance timers to timeout point
    // Verify timeout DID NOT fire
    // Verify turn ended successfully (no error)
  });

  test('cleanup prevents memory leaks across multiple state instances', async () => {
    // Create 100 state instances
    // Enter, exit, destroy each
    // Verify no event listener leaks
    // Verify no timer leaks
    // Verify memory usage stable
  });
});
```

### Regression Tests

**Prevent Environment Detection Failures:**

File: `tests/regression/turns/states/awaitingExternalTurnEndState.environmentDetection.regression.test.js` (NEW)

```javascript
describe('Regression: Environment Detection', () => {
  test('does not rely on module load-time NODE_ENV evaluation', () => {
    // Create state with production provider
    // Verify timeout = 30_000
    // Create state with development provider
    // Verify timeout = 3_000
    // Both in same test run, no module cache busting needed
  });

  test('handles Jest test environment correctly', () => {
    // Default Jest environment (NODE_ENV=test)
    // Create state without module isolation
    // Verify works correctly
    // Verify no cache busting needed
  });

  test('handles browser environment without process global', () => {
    // Mock browser environment (typeof process === 'undefined')
    // Create state
    // Verify defaults to production timeout
    // Verify no errors thrown
  });

  test('environment changes after module load are respected', () => {
    // Load module with NODE_ENV=test
    // Change NODE_ENV=production
    // Create new state instance
    // Verify uses production timeout (if using lazy evaluation)
  });
});
```

**Validate Timeout Behavior Consistency:**

File: `tests/regression/turns/states/awaitingExternalTurnEndState.timeoutConsistency.regression.test.js` (NEW)

```javascript
describe('Regression: Timeout Consistency', () => {
  test('timeout value exactly matches environment provider response', () => {
    // Production provider → timeout === 30_000
    // Development provider → timeout === 3_000
    // Custom provider (staging) → timeout === custom value
  });

  test('constructor override always takes precedence', () => {
    // Production provider + { timeoutMs: 5_000 }
    // Verify timeout === 5_000 (explicit wins)
    // Development provider + { timeoutMs: 60_000 }
    // Verify timeout === 60_000 (explicit wins)
  });

  test('cleanup clears timeout in all exit paths', () => {
    // Path 1: Normal event arrival → timeout cleared
    // Path 2: Timeout fires → timeout self-clears
    // Path 3: exitState called → timeout cleared
    // Path 4: destroy called → timeout cleared
    // Path 5: Error during event handling → timeout still cleared
  });

  test('timeout always fires after expected duration', async () => {
    // Set timeout to 1000ms
    // Advance fake timers by 999ms → timeout not fired
    // Advance fake timers by 1ms more → timeout fired
    // Verify error dispatched at exactly 1000ms
  });
});
```

### Property Tests

**Configuration Invariants:**

File: `tests/property/turns/states/awaitingExternalTurnEndState.configuration.property.test.js` (NEW)

```javascript
import * as fc from 'fast-check';

describe('Property Tests: Configuration Invariants', () => {
  test('timeout value always positive finite number', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (timeoutMs) => {
        const state = new AwaitingExternalTurnEndState(handler, { timeoutMs });
        const actualTimeout = state.getInternalStateForTest().configuredTimeout;
        return Number.isFinite(actualTimeout) && actualTimeout > 0;
      })
    );
  });

  test('invalid timeout values always rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity),
          fc.integer({ max: 0 }),
          fc.constant(null),
          fc.constant(undefined),
          fc.string()
        ),
        (invalidTimeout) => {
          expect(() => {
            new AwaitingExternalTurnEndState(handler, { timeoutMs: invalidTimeout });
          }).toThrow();
        }
      )
    );
  });

  test('timer functions always callable', () => {
    fc.assert(
      fc.property(
        fc.func(fc.nat()), // arbitrary setTimeout-like function
        fc.func(fc.constant(undefined)), // arbitrary clearTimeout-like function
        (setTimeoutFn, clearTimeoutFn) => {
          const state = new AwaitingExternalTurnEndState(handler, {
            setTimeoutFn,
            clearTimeoutFn
          });
          // State should be constructible with any callable functions
          return state !== null;
        }
      )
    );
  });

  test('environment provider always returns valid environment object', () => {
    fc.assert(
      fc.property(
        fc.record({
          IS_PRODUCTION: fc.boolean(),
          NODE_ENV: fc.constantFrom('production', 'development', 'test')
        }),
        (env) => {
          const mockProvider = { getEnvironment: () => env };
          const state = new AwaitingExternalTurnEndState(handler, {
            environmentProvider: mockProvider
          });
          // Should construct successfully with any valid environment
          return state !== null;
        }
      )
    );
  });
});
```

**State Transition Properties:**

File: `tests/property/turns/states/awaitingExternalTurnEndState.stateTransition.property.test.js` (NEW)

```javascript
import * as fc from 'fast-check';

describe('Property Tests: State Lifecycle', () => {
  test('enterState always sets exactly one timeout', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.nat({ max: 100_000 }),
        async (timeoutMs) => {
          const setTimeoutSpy = jest.fn((cb, ms) => setTimeout(cb, ms));
          const state = new AwaitingExternalTurnEndState(handler, {
            timeoutMs,
            setTimeoutFn: setTimeoutSpy
          });

          await state.enterState(handler, null);

          // Exactly one setTimeout call
          return setTimeoutSpy.mock.calls.length === 1;
        }
      )
    );
  });

  test('exitState always clears all resources', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.nat({ max: 100_000 }),
        async (timeoutMs) => {
          const clearTimeoutSpy = jest.fn();
          const unsubscribeSpy = jest.fn();

          // Setup state with spies
          const state = new AwaitingExternalTurnEndState(handler, {
            timeoutMs,
            clearTimeoutFn: clearTimeoutSpy
          });

          await state.enterState(handler, null);
          await state.exitState(handler, null);

          // Verify cleanup occurred
          return (
            clearTimeoutSpy.mock.calls.length >= 1 && // timeout cleared
            context.isAwaitingExternalEvent() === false // flag reset
            // subscription removed (verify via listener count)
          );
        }
      )
    );
  });

  test('destroy always idempotent', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (destroyCallCount) => {
          const state = new AwaitingExternalTurnEndState(handler);
          await state.enterState(handler, null);

          // Call destroy multiple times
          for (let i = 0; i < destroyCallCount; i++) {
            await state.destroy(handler);
          }

          // No errors, resources cleaned exactly once
          return eventBus.listenerCount(TURN_ENDED_ID) === 0;
        }
      )
    );
  });

  test('cleanup never throws even with invalid state', async () => {
    fc.assert(
      await fc.asyncProperty(
        fc.constantFrom(
          'timeout_already_cleared',
          'subscription_missing',
          'context_null',
          'multiple_exits'
        ),
        async (invalidStateType) => {
          const state = new AwaitingExternalTurnEndState(handler);

          // Corrupt state based on type
          switch (invalidStateType) {
            case 'timeout_already_cleared':
              await state.enterState(handler, null);
              await state.exitState(handler, null); // clears resources
              // Try exiting again
              break;
            case 'subscription_missing':
              // enterState but manually remove subscription
              await state.enterState(handler, null);
              // ... corrupt subscription ...
              break;
            // ... other corruption scenarios ...
          }

          // cleanup should never throw
          try {
            await state.exitState(handler, null);
            await state.destroy(handler);
            return true; // Success = no errors
          } catch (err) {
            return false; // Failure = threw error
          }
        }
      )
    );
  });
});
```

---

## Proposed Improvements

### 1. Configuration Injection Pattern (Recommended)

**Problem:** Module-level constants (`IS_DEV`, `TIMEOUT_MS`) evaluated at load time

**Solution:** Lazy evaluation with dependency injection via `IEnvironmentProvider`

**Implementation:**

```javascript
// src/turns/states/awaitingExternalTurnEndState.js

import { ProcessEnvironmentProvider } from '../../environment/ProcessEnvironmentProvider.js';

/**
 * State that waits for external turn_ended event with timeout protection
 */
class AwaitingExternalTurnEndState extends AbstractTurnState {
  // Configuration constants
  static DEFAULT_TIMEOUT_PRODUCTION = 30_000; // 30 seconds
  static DEFAULT_TIMEOUT_DEVELOPMENT = 3_000; // 3 seconds

  // Private fields
  #environmentProvider;
  #timeoutConfig;
  #setTimeoutFn;
  #clearTimeoutFn;
  #timeoutId = null;

  /**
   * @param {BaseTurnHandler} handler
   * @param {object} [options]
   * @param {number} [options.timeoutMs] - Explicit timeout override
   * @param {IEnvironmentProvider} [options.environmentProvider] - Environment detection
   * @param {Function} [options.setTimeoutFn] - setTimeout implementation
   * @param {Function} [options.clearTimeoutFn] - clearTimeout implementation
   */
  constructor(handler, {
    timeoutMs,
    environmentProvider = new ProcessEnvironmentProvider(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  } = {}) {
    super(handler);

    // Store environment provider
    this.#environmentProvider = environmentProvider;

    // Resolve timeout: explicit override > environment default
    this.#timeoutConfig = timeoutMs ?? this.#getDefaultTimeout();

    // Validate timeout value
    if (!Number.isFinite(this.#timeoutConfig) || this.#timeoutConfig <= 0) {
      throw new InvalidArgumentError(
        `timeoutMs must be positive finite number, got: ${this.#timeoutConfig}`
      );
    }

    // Validate and store timer functions
    if (typeof setTimeoutFn !== 'function') {
      throw new InvalidArgumentError(
        `setTimeoutFn must be a function, got: ${typeof setTimeoutFn}`
      );
    }
    if (typeof clearTimeoutFn !== 'function') {
      throw new InvalidArgumentError(
        `clearTimeoutFn must be a function, got: ${typeof clearTimeoutFn}`
      );
    }

    this.#setTimeoutFn = setTimeoutFn;
    this.#clearTimeoutFn = clearTimeoutFn;
  }

  /**
   * Get default timeout based on environment
   * @private
   * @returns {number} Timeout in milliseconds
   */
  #getDefaultTimeout() {
    try {
      const env = this.#environmentProvider.getEnvironment();
      return env.IS_PRODUCTION
        ? AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_PRODUCTION
        : AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_DEVELOPMENT;
    } catch (err) {
      // Fail-safe: default to production timeout on error
      console.warn(
        'Failed to get environment, defaulting to production timeout:',
        err
      );
      return AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_PRODUCTION;
    }
  }

  async enterState(handler, prev) {
    await super.enterState(handler, prev);

    const context = handler?.getTurnContext?.();
    if (!context) {
      this.#getLogger(handler)?.warn?.(
        'AwaitingExternalTurnEndState: No context, skipping timeout setup'
      );
      return;
    }

    // Subscribe to turn ended event
    const dispatcher = this.#getDispatcher(handler);
    dispatcher?.subscribe?.(TURN_ENDED_ID, (event) =>
      this.handleTurnEndedEvent(handler, event)
    );

    // Set awaiting flag
    context.setAwaitingExternalEvent?.(true, context.actor?.id);

    // Start timeout with configured value
    this.#timeoutId = this.#setTimeoutFn(() => this.#onTimeout(handler), this.#timeoutConfig);

    this.#getLogger(handler)?.debug?.(
      `AwaitingExternalTurnEndState: Timeout set to ${this.#timeoutConfig}ms`
    );
  }

  // ... rest of implementation unchanged ...
}
```

**Benefits:**
- ✅ **Testable**: Inject `TestEnvironmentProvider` for predictable behavior
- ✅ **Flexible**: Supports runtime environment changes between instances
- ✅ **Standard**: Uses existing `IEnvironmentProvider` interface (project pattern)
- ✅ **Backward Compatible**: Optional parameter with sensible default
- ✅ **No Module Isolation**: Tests work without cache busting
- ✅ **Fail-Safe**: Defaults to production timeout on provider errors

**Migration Path:**
1. Add `environmentProvider` option to constructor (optional, defaults to `ProcessEnvironmentProvider`)
2. Replace module-level `IS_DEV` with instance method `#getDefaultTimeout()`
3. Update tests to inject `TestEnvironmentProvider` instead of module isolation
4. Document new pattern in developer guide

### 2. Alternative: Use Existing Environment Utilities

**Problem:** Reinventing environment detection when project has standardized utilities

**Solution:** Use `environmentUtils.js` directly for consistency

**Implementation:**

```javascript
// src/turns/states/awaitingExternalTurnEndState.js

import { getEnvironmentMode } from '../../utils/environmentUtils.js';

class AwaitingExternalTurnEndState extends AbstractTurnState {
  static DEFAULT_TIMEOUT_PRODUCTION = 30_000;
  static DEFAULT_TIMEOUT_DEVELOPMENT = 3_000;

  #timeoutConfig;

  constructor(handler, { timeoutMs, setTimeoutFn, clearTimeoutFn } = {}) {
    super(handler);

    // Use standardized environment detection
    this.#timeoutConfig = timeoutMs ?? this.#resolveDefaultTimeout();

    // Validate
    if (!Number.isFinite(this.#timeoutConfig) || this.#timeoutConfig <= 0) {
      throw new InvalidArgumentError(
        `timeoutMs must be positive finite number, got: ${this.#timeoutConfig}`
      );
    }

    this.#setTimeoutFn = setTimeoutFn ?? setTimeout;
    this.#clearTimeoutFn = clearTimeoutFn ?? clearTimeout;
  }

  /**
   * Resolve default timeout based on environment mode
   * @private
   * @returns {number} Timeout in milliseconds
   */
  #resolveDefaultTimeout() {
    // Use project's standard environment detection
    const mode = getEnvironmentMode(); // 'production' | 'development' | 'test'

    switch (mode) {
      case 'production':
        return AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_PRODUCTION;
      case 'test':
      case 'development':
      default:
        return AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_DEVELOPMENT;
    }
  }

  // ... rest of implementation ...
}
```

**Benefits:**
- ✅ **Consistent**: Matches 47+ other files using `environmentUtils.js`
- ✅ **Robust**: Handles browser/Node.js/Jest correctly in one place
- ✅ **Maintained**: Single source of truth for environment logic
- ✅ **Simple**: No DI complexity, straightforward implementation
- ⚠️ **Less Testable**: Still couples to global environment (but matches project pattern)

**When to Choose:**
- Project prefers consistency over DI purity
- Other state classes use direct `environmentUtils.js` calls
- Testing can tolerate environment variable manipulation

### 3. Separation of Concerns with Configuration Class

**Problem:** State class handles configuration, timers, events, cleanup (too many responsibilities)

**Solution:** Extract timeout configuration to dedicated class

**Implementation:**

```javascript
// src/turns/config/timeoutConfiguration.js

/**
 * Encapsulates timeout configuration logic with environment awareness
 */
export class TimeoutConfiguration {
  static DEFAULT_PRODUCTION = 30_000;
  static DEFAULT_DEVELOPMENT = 3_000;

  #environmentProvider;
  #explicitTimeout;

  /**
   * @param {object} [options]
   * @param {number} [options.timeoutMs] - Explicit timeout override
   * @param {IEnvironmentProvider} [options.environmentProvider] - Environment detection
   */
  constructor({ timeoutMs, environmentProvider } = {}) {
    this.#explicitTimeout = timeoutMs;
    this.#environmentProvider = environmentProvider ?? new ProcessEnvironmentProvider();
  }

  /**
   * Get resolved timeout value in milliseconds
   * @returns {number}
   */
  getTimeoutMs() {
    // Explicit override takes precedence
    if (this.#explicitTimeout !== undefined) {
      return this.#explicitTimeout;
    }

    // Otherwise use environment default
    try {
      const env = this.#environmentProvider.getEnvironment();
      return env.IS_PRODUCTION
        ? TimeoutConfiguration.DEFAULT_PRODUCTION
        : TimeoutConfiguration.DEFAULT_DEVELOPMENT;
    } catch (err) {
      console.warn('Failed to get environment, using production default:', err);
      return TimeoutConfiguration.DEFAULT_PRODUCTION;
    }
  }

  /**
   * Validate configuration
   * @throws {InvalidArgumentError} If timeout invalid
   */
  validate() {
    const timeout = this.getTimeoutMs();
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new InvalidArgumentError(
        `Invalid timeout configuration: ${timeout}. Must be positive finite number.`
      );
    }
  }
}

// src/turns/states/awaitingExternalTurnEndState.js

import { TimeoutConfiguration } from '../config/timeoutConfiguration.js';

class AwaitingExternalTurnEndState extends AbstractTurnState {
  #timeoutConfig;

  constructor(handler, options = {}) {
    super(handler);

    // Delegate configuration to specialized class
    this.#timeoutConfig = new TimeoutConfiguration(options);
    this.#timeoutConfig.validate();

    this.#setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.#clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  }

  async enterState(handler, prev) {
    // ... setup code ...

    // Use configuration
    const timeoutMs = this.#timeoutConfig.getTimeoutMs();
    this.#timeoutId = this.#setTimeoutFn(() => this.#onTimeout(handler), timeoutMs);

    this.#getLogger(handler)?.debug?.(
      `AwaitingExternalTurnEndState: Timeout set to ${timeoutMs}ms`
    );
  }

  // ... rest of implementation ...
}
```

**Benefits:**
- ✅ **Single Responsibility**: `TimeoutConfiguration` handles ONLY timeout logic
- ✅ **Testable**: Can unit test configuration independently
- ✅ **Reusable**: Other states could use same configuration pattern
- ✅ **Maintainable**: Timeout logic isolated from state machine logic
- ✅ **Extensible**: Easy to add new configuration options (staging tier, custom validators)

**When to Choose:**
- Multiple states need similar timeout configuration
- Configuration logic is complex enough to warrant extraction
- Project values separation of concerns highly

---

## Implementation Strategy

### Phase 1: Minimal Change (Quick Fix)

**Goal:** Fix immediate test fragility with minimal risk

**Changes:**
1. Replace module-level `IS_DEV` constant with constructor call to `getEnvironmentMode()` from `environmentUtils.js`
2. Move timeout resolution from module-level to constructor
3. Add validation for `timeoutMs` parameter
4. Keep all existing test infrastructure working

**Code Diff:**
```javascript
// BEFORE (lines 30-33)
const IS_DEV =
  (typeof process !== 'undefined' && process?.env?.NODE_ENV !== 'production') ||
  false;
const TIMEOUT_MS = IS_DEV ? 3_000 : 30_000;

// AFTER
import { getEnvironmentMode } from '../../utils/environmentUtils.js';

class AwaitingExternalTurnEndState extends AbstractTurnState {
  static DEFAULT_TIMEOUT_PRODUCTION = 30_000;
  static DEFAULT_TIMEOUT_DEVELOPMENT = 3_000;

  #configuredTimeout;

  constructor(handler, options = {}) {
    super(handler);
    this.#configuredTimeout = options.timeoutMs ?? this.#resolveDefaultTimeout();
    // ... validation ...
  }

  #resolveDefaultTimeout() {
    const mode = getEnvironmentMode();
    return mode === 'production'
      ? AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_PRODUCTION
      : AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_DEVELOPMENT;
  }
}
```

**Testing:**
- Update production integration test to remove module isolation
- Verify all existing tests pass
- Add regression test to prevent module-level constant pattern

**Risk:** ⚠️ LOW - Internal change only, no API modifications

### Phase 2: Standard Patterns (Alignment)

**Goal:** Align with project patterns (DI, IEnvironmentProvider)

**Changes:**
1. Add `environmentProvider` option to constructor (optional, defaults to `ProcessEnvironmentProvider`)
2. Use `IEnvironmentProvider` interface for environment detection
3. Add `TestEnvironmentProvider` injection in tests
4. Remove need for environment variable manipulation in tests

**Code Additions:**
```javascript
constructor(handler, {
  timeoutMs,
  environmentProvider = new ProcessEnvironmentProvider(),  // NEW
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) {
  super(handler);
  this.#environmentProvider = environmentProvider;  // NEW
  this.#configuredTimeout = timeoutMs ?? this.#getDefaultTimeout();  // CHANGED
  // ... rest ...
}

#getDefaultTimeout() {
  const env = this.#environmentProvider.getEnvironment();  // CHANGED
  return env.IS_PRODUCTION ? 30_000 : 3_000;
}
```

**Testing:**
- Add environment provider integration tests
- Update existing tests to use `TestEnvironmentProvider` injection
- Verify backward compatibility (default provider works)

**Risk:** ⚠️ LOW - Backward compatible optional parameter

### Phase 3: Robustness (Full Solution)

**Goal:** Complete separation of concerns and comprehensive validation

**Changes:**
1. Extract `TimeoutConfiguration` class
2. Add comprehensive validation for all configuration options
3. Add detailed configuration documentation
4. Update all tests to use new patterns
5. Add property tests for invariants

**New Files:**
- `src/turns/config/timeoutConfiguration.js`
- `tests/unit/turns/config/timeoutConfiguration.test.js`

**Documentation:**
- Add JSDoc for all configuration options
- Document migration path for future timeout changes
- Add examples in developer guide

**Risk:** ⚠️ MEDIUM - New abstraction, requires comprehensive testing

---

## Recommended Approach

**Immediate (This Sprint):**
- ✅ Apply Phase 1 (Minimal Change) - Fix test fragility NOW
- ✅ Add regression tests to prevent recurrence

**Short-term (Next Sprint):**
- Phase 2 (Standard Patterns) - Align with project DI patterns
- Add environment provider integration tests
- Update developer documentation

**Long-term (Backlog):**
- Phase 3 (Robustness) - IF multiple states need similar configuration
- Extract shared configuration patterns
- Add comprehensive property tests

**Breaking Change Assessment:**
- Phase 1: ✅ No breaking changes (internal only)
- Phase 2: ✅ No breaking changes (optional parameter with default)
- Phase 3: ✅ No breaking changes (new class, optional usage)

All phases maintain full backward compatibility with existing constructor signatures and behavior.
