# MULHITSIMROB-008: Implement Explicit State Machine

## Summary

Replace implicit state tracking (`#isRunning`, `#shouldStop`) with an explicit state machine that enforces valid transitions and makes illegal states unrepresentable.

## Status

Completed

## Background

The current `MultiHitSimulator` uses boolean flags (`#isRunning`, `#shouldStop`) to track state, which can lead to:

1. Invalid state combinations (e.g., `isRunning=true` AND `shouldStop=true` AND still processing)
2. Unclear state transitions
3. Difficulty reasoning about allowed operations in each state

An explicit state machine makes states and transitions clear, testable, and self-documenting.

**Reference**: `specs/multi-hit-simulator-robustness.md` lines 438-459

**Note on current behavior**:
- `setEntityConfig()` sets a usable `#config` without creating a `TargetSelector`; callers can still `run()` without calling `configure()`.
- There is no public `reset()` or `destroy()` API today, so state transitions must align with the existing lifecycle methods.

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/domUI/damage-simulator/SimulationStateMachine.js` | CREATE | New state machine class |
| `src/domUI/damage-simulator/MultiHitSimulator.js` | MODIFY | Use state machine instead of boolean flags |
| `tests/unit/domUI/damage-simulator/SimulationStateMachine.test.js` | CREATE | Unit tests for state machine |

## Out of Scope

- NOT changing external API of MultiHitSimulator
- NOT modifying event types or emission timing
- NOT changing result structure or progress object shape
- NOT modifying DamageExecutionService
- NOT modifying TargetSelector behavior
- NOT adding new simulation features

## Implementation Details

### State Definitions

```javascript
const SimulationState = {
  IDLE: 'IDLE',           // Initial state, no configuration
  CONFIGURED: 'CONFIGURED', // Configuration applied, ready to run
  RUNNING: 'RUNNING',     // Actively executing simulation
  STOPPING: 'STOPPING',   // Stop requested, graceful shutdown
  COMPLETED: 'COMPLETED', // Simulation finished normally
  ERROR: 'ERROR',         // Simulation encountered an error
};
```

### Valid Transitions

```
IDLE ─────────────→ CONFIGURED (via configure() or setEntityConfig())
CONFIGURED ────────→ RUNNING (via run())
RUNNING ───────────→ STOPPING (via stop())
RUNNING ───────────→ COMPLETED (simulation finishes)
RUNNING ───────────→ ERROR (exception during execution)
STOPPING ──────────→ COMPLETED (graceful shutdown completes)
STOPPING ──────────→ ERROR (exception during graceful shutdown)
COMPLETED ─────────→ RUNNING (via run(), config already set)
COMPLETED ─────────→ CONFIGURED (via configure())
ERROR ─────────────→ RUNNING (via run(), config already set)
ERROR ─────────────→ CONFIGURED (via configure())
```

### SimulationStateMachine Class

```javascript
/**
 * @file SimulationStateMachine.js
 * @description Manages simulation lifecycle state with validated transitions.
 */

const SimulationState = Object.freeze({
  IDLE: 'IDLE',
  CONFIGURED: 'CONFIGURED',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
});

const VALID_TRANSITIONS = Object.freeze({
  [SimulationState.IDLE]: [SimulationState.CONFIGURED],
  [SimulationState.CONFIGURED]: [SimulationState.RUNNING],
  [SimulationState.RUNNING]: [SimulationState.STOPPING, SimulationState.COMPLETED, SimulationState.ERROR],
  [SimulationState.STOPPING]: [SimulationState.COMPLETED, SimulationState.ERROR],
  [SimulationState.COMPLETED]: [SimulationState.RUNNING, SimulationState.CONFIGURED],
  [SimulationState.ERROR]: [SimulationState.RUNNING, SimulationState.CONFIGURED],
});

class SimulationStateMachine {
  #currentState;
  #onStateChange;

  /**
   * @param {Function} [onStateChange] - Optional callback for state changes
   */
  constructor(onStateChange = null) {
    this.#currentState = SimulationState.IDLE;
    this.#onStateChange = onStateChange;
  }

  get state() {
    return this.#currentState;
  }

  /**
   * Attempts transition to new state.
   * @param {string} newState - Target state
   * @throws {Error} If transition is invalid
   */
  transition(newState) {
    const validNextStates = VALID_TRANSITIONS[this.#currentState];
    if (!validNextStates.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${this.#currentState} → ${newState}. ` +
        `Valid transitions: ${validNextStates.join(', ')}`
      );
    }
    const previousState = this.#currentState;
    this.#currentState = newState;
    this.#onStateChange?.(previousState, newState);
  }

  /**
   * Checks if transition is valid without performing it.
   * @param {string} newState - Target state
   * @returns {boolean}
   */
  canTransition(newState) {
    return VALID_TRANSITIONS[this.#currentState]?.includes(newState) ?? false;
  }

  // Convenience state checks
  get isIdle() { return this.#currentState === SimulationState.IDLE; }
  get isConfigured() { return this.#currentState === SimulationState.CONFIGURED; }
  get isRunning() { return this.#currentState === SimulationState.RUNNING; }
  get isStopping() { return this.#currentState === SimulationState.STOPPING; }
  get isCompleted() { return this.#currentState === SimulationState.COMPLETED; }
  get isError() { return this.#currentState === SimulationState.ERROR; }
  get isActive() { return this.isRunning || this.isStopping; }
}

export { SimulationStateMachine, SimulationState };
export default SimulationStateMachine;
```

### Updated MultiHitSimulator Usage

```javascript
import { SimulationStateMachine, SimulationState } from './SimulationStateMachine.js';

class MultiHitSimulator {
  #stateMachine;
  // Remove: #isRunning, #shouldStop

  constructor({ containerElement, executionService, eventBus, logger }) {
    // ... existing validation
    this.#stateMachine = new SimulationStateMachine((prev, next) => {
      this.#logger?.debug(`State transition: ${prev} → ${next}`);
    });
  }

  configure(options) {
    // Transition to CONFIGURED (valid from IDLE, COMPLETED, or ERROR)
    if (this.#stateMachine.isRunning || this.#stateMachine.isStopping) {
      throw new Error('Cannot configure while simulation is active');
    }
    // ... apply configuration
    if (!this.#stateMachine.isConfigured) {
      this.#stateMachine.transition(SimulationState.CONFIGURED);
    }
  }

  async run() {
    this.#stateMachine.transition(SimulationState.RUNNING);
    try {
      // ... simulation loop
      while (/* condition */ && !this.#stateMachine.isStopping) {
        // ... execute hits
      }
      this.#stateMachine.transition(SimulationState.COMPLETED);
    } catch (err) {
      this.#stateMachine.transition(SimulationState.ERROR);
      throw err;
    }
  }

  stop() {
    if (this.#stateMachine.canTransition(SimulationState.STOPPING)) {
      this.#stateMachine.transition(SimulationState.STOPPING);
      // ... cleanup logic
    }
  }

  // Replace boolean getters
  isRunning() {
    return this.#stateMachine.isActive;
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

- [ ] All existing MultiHitSimulator unit tests pass unchanged
- [ ] New SimulationStateMachine tests achieve 100% coverage
- [ ] State machine enforces all valid transitions
- [ ] Invalid transitions throw descriptive errors
- [ ] State machine integrates seamlessly with MultiHitSimulator

### Invariants That Must Remain True

- Same external API for MultiHitSimulator (isRunning getter, run(), stop(), etc.)
- Same progress event emission timing
- Same result structure and values
- Same error handling behavior from user perspective
- No performance regression (state checks are O(1))

### New Test Coverage Requirements

```javascript
describe('SimulationStateMachine', () => {
  describe('constructor', () => {
    it('should start in IDLE state');
    it('should accept optional onStateChange callback');
  });

  describe('transition', () => {
    it('should allow IDLE → CONFIGURED');
    it('should allow CONFIGURED → RUNNING');
    it('should allow CONFIGURED → IDLE');
    it('should allow RUNNING → STOPPING');
    it('should allow RUNNING → COMPLETED');
    it('should allow RUNNING → ERROR');
    it('should allow STOPPING → COMPLETED');
    it('should allow COMPLETED → IDLE');
    it('should allow ERROR → IDLE');
    it('should throw on invalid transition IDLE → RUNNING');
    it('should throw on invalid transition RUNNING → CONFIGURED');
    it('should throw on invalid transition COMPLETED → RUNNING');
    it('should include helpful error message with valid options');
  });

  describe('canTransition', () => {
    it('should return true for valid transitions');
    it('should return false for invalid transitions');
  });

  describe('state getters', () => {
    it('should correctly report isIdle');
    it('should correctly report isRunning');
    it('should correctly report isActive for RUNNING');
    it('should correctly report isActive for STOPPING');
  });

  describe('onStateChange callback', () => {
    it('should be called on successful transitions');
    it('should receive previous and new state');
    it('should not be called on failed transitions');
  });
});

describe('MultiHitSimulator with StateMachine', () => {
  it('should prevent run() when not configured');
  it('should prevent configure() while running');
  it('should allow reconfigure after completion');
  it('should handle stop() gracefully when not running');
});
```

## Verification Commands

```bash
# Run new state machine tests
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/SimulationStateMachine.test.js --no-coverage --verbose

# Verify MultiHitSimulator tests still pass
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --no-coverage --silent

# Full coverage check for both files
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/ --coverage

# Verify no regressions in integration tests
NODE_ENV=test npx jest tests/integration/domUI/damage-simulator/ --no-coverage --silent
```

## Dependencies

- **Blocks**: None (final ticket in series)
- **Blocked by**: MULHITSIMROB-007 (view extraction simplifies state machine integration)
- **Related**: MULHITSIMROB-006 (invariant assertions can validate state machine constraints)

## Estimated Effort

Medium-Large - new class creation plus careful integration with existing code.

## Migration Strategy

1. **Create state machine first**: Build and fully test `SimulationStateMachine` independently
2. **Add to MultiHitSimulator**: Import state machine, instantiate in constructor
3. **Replace isRunning checks**: Update loop conditions to use `stateMachine.isActive`
4. **Replace shouldStop checks**: Update to `stateMachine.isStopping`
5. **Add transitions**: Insert `transition()` calls at appropriate points
6. **Remove boolean flags**: Delete `#isRunning` and `#shouldStop` after all usages replaced
7. **Update tests**: Add tests for state-specific behavior
8. **Run full test suite**: Verify no regressions

## Design Notes

### Why a Separate Class?

- **Testable in isolation**: State machine logic tested without DOM or simulation complexity
- **Reusable**: Could be used by other simulators or complex UI workflows
- **Single responsibility**: State management separate from simulation logic

### Why Not Use a Library?

- Simple enough to implement inline (~60 lines)
- No external dependencies needed
- Full control over error messages and behavior
- Tailored exactly to simulation needs

### State Machine Benefits

1. **Impossible illegal states**: Can't be "running AND completed"
2. **Self-documenting**: States and transitions clearly defined
3. **Debuggable**: State change callback enables logging
4. **Testable**: Each transition testable independently
5. **Extensible**: Easy to add new states (e.g., PAUSED) later

## Reference Files

- Source: `src/domUI/damage-simulator/MultiHitSimulator.js` (state integration)
- New: `src/domUI/damage-simulator/SimulationStateMachine.js`
- Spec: `specs/multi-hit-simulator-robustness.md` (lines 438-459)
- Pattern: Consider XState concepts but implement simply without the library

## Outcome

Implemented `SimulationStateMachine` and wired `MultiHitSimulator` to use it in place of boolean flags. Added unit tests for state transitions and added guard tests for configure/stop behavior; no public API changes were required beyond enforcing the configure-while-running guard. The state machine now allows reruns after completion or error without requiring explicit reset methods, matching existing usage patterns.
