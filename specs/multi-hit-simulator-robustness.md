# MultiHitSimulator Robustness Specification

**Reference**: Unit test coverage effort for `src/domUI/damage-simulator/MultiHitSimulator.js`

> This spec documents testing challenges encountered and specifies robustness requirements to prevent similar issues in future development.

## Context

- **Location**: `src/domUI/damage-simulator/MultiHitSimulator.js` (831 lines)
- **Test File**: `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` (2,877 lines)
- **Test-to-Code Ratio**: 3.46:1 (indicating high complexity)
- **Purpose**: Browser-based multi-hit damage simulation component for testing damage accumulation with configurable hit counts, delays, and targeting modes

### Architecture Overview

The module consists of two classes:

1. **TargetSelector** (lines 79-137): Helper class managing target part selection across three modes:
   - `random` - Random selection from available parts
   - `round-robin` - Sequential cycling through parts
   - `focus` - Fixed target part ID

2. **MultiHitSimulator** (lines 142-829): Main simulation class with:
   - 9 private fields for state management (`#config`, `#isRunning`, `#shouldStop`, `#delayTimeout`, `#delayResolve`, `#targetSelector`, `#progress`, `#targetableParts`)
   - 11 public methods (lifecycle, state, UI)
   - 6 private methods for DOM interaction

### Key Dependencies

- `DamageExecutionService`: Handles actual damage application via `applyDamage()` and `getTargetableParts()`
- `ISafeEventDispatcher`: Event emission for simulation progress/completion
- `ILogger`: Logging interface
- DOM container element for UI rendering

## Problem

Achieving 100% test coverage required extensive effort due to several architectural patterns that made testing difficult.

### 1. Dead Code Discovered and Removed

**TargetSelector switch default case** (original lines 126-127):
```javascript
// REMOVED - This was dead code
default:
  return null;
```

**Reason**: The `configure()` method validates target modes at lines 258-259 and throws an error for unknown modes BEFORE `TargetSelector` is ever created. The default case was unreachable.

**#updateResultsDisplay zero-hits branch** (original lines 729-733):
```javascript
// REMOVED - This was dead code
const avg = results.hitsExecuted > 0
  ? results.totalDamage / results.hitsExecuted
  : 0;  // <-- This branch was unreachable
```

**Reason**: `hitsExecuted` is always >= 1 when `#updateResultsDisplay` is called because:
1. `configure()` validates `hitCount >= 1`
2. The loop increments `hitsExecuted` before `shouldStop` is checked
3. `#updateResultsDisplay` is only called after successful loop completion

**Test file documentation**: Lines 1082-1084, 2543-2547

### 2. Complex Async Timer Management

The simulation loop uses cancellable delays with a dual-storage pattern (lines 764-773):

```javascript
#delay(ms) {
  return new Promise((resolve) => {
    this.#delayResolve = resolve;  // Store resolve function for stop()
    this.#delayTimeout = setTimeout(() => {
      this.#delayTimeout = null;
      this.#delayResolve = null;
      resolve();
    }, ms);
  });
}
```

**Testing challenges**:
- Required `jest.useFakeTimers()` with `jest.runAllTimersAsync()` in 23+ test suites
- Must verify both timeout completion AND early cancellation paths
- State cleanup must happen in both paths

### 3. Extensive DOM Mocking Requirements

**~1,100 lines of DOM mock helpers** were needed to test DOM interactions:

- `createMockContainerElement()` (lines 16-21): Basic null-returning mock
- `createInteractiveDOMContainer()` (lines 1091-1217): Full event listener capture and dispatch
- `createHandlerCapturingContainer()` (lines 1333-1428): Handler capture pattern
- `createUpdatableContainer()` (lines 1572-1615): DOM state mutation verification

**Root cause**: Tight coupling between rendering (`render()`) and event binding (`#bindEventListeners()`), requiring full DOM simulation to test any UI behavior.

### 4. Private Field Testing Limitations

All state is private (`#field`), making direct inspection impossible:

```javascript
#config              // SimulationConfig | null
#isRunning          // boolean
#shouldStop         // boolean
#delayTimeout       // number | null
#delayResolve       // Function | null
#targetSelector     // TargetSelector | null
#progress           // SimulationProgress
#targetableParts    // Array
```

**Testing workarounds required**:
- Public getter methods (`getProgress()`, `getTargetableParts()`)
- Testing behavior indirectly through mock call verification
- Event emission verification as state proxy

### 5. Multi-Fallback Chains

Damage result handling uses triple-fallback patterns (lines 382-386):

```javascript
const hitPartId = firstResult.targetPartId || targetPartId || 'unknown';
results.partHitCounts[hitPartId] = (results.partHitCounts[hitPartId] || 0) + 1;
```

And optional chaining with nullish coalescing (lines 670-672):

```javascript
damageEntry: this.#config?.damageEntry || { base_damage: 10 },
multiplier: this.#config?.multiplier || 1,
entityId: this.#config?.entityId || '',
```

**Testing required**: 7 dedicated edge case tests (lines 1870-2033) covering every fallback path.

### 6. Event-Driven Result Reporting

Results flow through BOTH return values AND event dispatches:

```javascript
if (results.completed) {
  this.#eventBus.dispatch(SIMULATION_EVENTS.COMPLETE, results);
} else {
  this.#eventBus.dispatch(SIMULATION_EVENTS.STOPPED, results);
}
return results;
```

**Testing required**: Dual verification that return values and emitted events remain consistent.

## Truth Sources

| File | Purpose |
|------|---------|
| `src/domUI/damage-simulator/MultiHitSimulator.js` | Production implementation |
| `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` | Unit tests with 100% coverage |
| `src/domUI/damage-simulator/DamageExecutionService.js` | Damage application interface |
| `src/domUI/damage-simulator/DamageSimulatorUI.js` | Parent UI component |
| `src/interfaces/ISafeEventDispatcher.js` | Event dispatch interface |
| `src/interfaces/coreServices.js` | ILogger interface |

## Desired Behavior

### Normal Cases

1. **Configuration**: Accept valid configurations with hit counts 1-100, delays 0-1000ms, valid target modes
2. **Execution**: Run simulation loop, apply damage per hit, track results, emit progress events
3. **Targeting**:
   - `random`: Select random part from available parts
   - `round-robin`: Cycle through parts sequentially, reset between runs
   - `focus`: Use specified `focusPartId`
4. **Progress**: Update progress after each hit, emit `PROGRESS` event
5. **Completion**: Emit `COMPLETE` event with full results, update UI
6. **DOM Rendering**: Render controls, bind event listeners, update displays

### Edge Cases

1. **Empty parts array**: `getNextTarget()` returns `null`, damage still applies
2. **Null DOM elements**: Skip updates gracefully, no crashes
3. **Failed damage**: Track hit count but not damage, continue simulation
4. **Stopped mid-run**: Emit `STOPPED` event with partial results
5. **Missing config properties**: Use fallback values (`damageEntry: { base_damage: 10 }`, `multiplier: 1`)
6. **Duplicate severity values**: Deduplicate in `effectsTriggered` array
7. **Multiple consecutive runs**: Reset round-robin index, reset progress

### Failure Modes

| Condition | Expected Error |
|-----------|----------------|
| Invalid hit count | `"Hit count must be between 1 and 100"` |
| Invalid delay | `"Delay must be between 0 and 1000ms"` |
| Invalid target mode | `"Target mode must be one of: random, round-robin, focus"` |
| Focus mode without focusPartId | `"Focus mode requires a focusPartId"` |
| Missing entityId | `"Entity ID is required"` |
| Missing damageEntry | `"Damage entry is required"` |
| Already running | `"Simulation already running"` |
| Not configured | `"Simulation not configured"` |

### Invariants

Properties that must ALWAYS hold:

1. **State consistency**: `#isRunning` is true only during active simulation
2. **Event ordering**: `PROGRESS` events precede `COMPLETE`/`STOPPED`
3. **Progress accuracy**: `currentHit <= totalHits`, `percentComplete` in 0-100
4. **Results integrity**: `hitsExecuted >= 1` when `#updateResultsDisplay` called
5. **Timeout cleanup**: Both `#delayTimeout` and `#delayResolve` are nulled after delay
6. **Target mode validation**: Only valid modes reach `TargetSelector`
7. **Round-robin determinism**: Same sequence given same configuration

## API Contracts

### Public Methods (Must Remain Stable)

```typescript
// Configuration
configure(config: SimulationConfig): void

// Lifecycle
run(): Promise<SimulationResult>
stop(): void

// State queries
isRunning(): boolean
getProgress(): SimulationProgress
getTargetableParts(): Array<{id: string, name: string, weight: number}>

// UI
render(): void
setEntityConfig(options: {entityId: string, damageEntry: object, multiplier?: number}): void
```

### Static Constants (Must Remain Stable)

```javascript
MultiHitSimulator.SIMULATION_EVENTS = {
  PROGRESS: 'damage-simulator:simulation-progress',
  COMPLETE: 'damage-simulator:simulation-complete',
  STOPPED: 'damage-simulator:simulation-stopped',
  ERROR: 'damage-simulator:simulation-error',
}

MultiHitSimulator.DEFAULTS = {
  HIT_COUNT: 10,
  DELAY_MS: 100,
  TARGET_MODE: 'random',
  MIN_HITS: 1,
  MAX_HITS: 100,
  MIN_DELAY: 0,
  MAX_DELAY: 1000,
}

MultiHitSimulator.TARGET_MODES = ['random', 'round-robin', 'focus']
```

### Event Payload Contracts

**PROGRESS event**:
```typescript
{
  currentHit: number,
  totalHits: number,
  percentComplete: number,  // 0-100
  status: 'idle' | 'running' | 'stopping' | 'completed'
}
```

**COMPLETE/STOPPED event**:
```typescript
{
  completed: boolean,
  hitsExecuted: number,
  totalDamage: number,
  partHitCounts: Record<string, number>,
  effectsTriggered: string[],
  durationMs: number,
  stoppedReason: string | null
}
```

## What is Allowed to Change

### Internal Implementation

- Private method signatures (`#delay`, `#updateProgressDisplay`, etc.)
- Internal state structure (private fields)
- DOM element IDs and class names (with corresponding test updates)
- Logging messages and levels
- Internal validation order

### Non-Breaking Additions

- New configuration options with defaults
- Additional event types
- New public getter methods
- Enhanced error messages

### Requires Migration

- Event type string changes
- Public method signature changes
- Configuration schema changes
- Result object structure changes

## Testing Plan

### Existing Tests to Maintain

All 94 tests in `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` must remain passing with 100% coverage:

| Suite | Tests | Purpose |
|-------|-------|---------|
| Constructor | 5 | Dependency validation |
| Configuration validation | 10 | Input validation |
| Hit execution | 2 | Basic simulation |
| Delay handling | 2 | Timer behavior |
| Targeting modes | 3 | Mode selection logic |
| Stop functionality | 2 | Cancellation |
| Progress tracking | 3 | State updates |
| Event emission | 4 | Event dispatch |
| Statistics | 5 | Result calculation |
| Error handling | 3 | Exception paths |
| Concurrent protection | 2 | Race conditions |
| State reset | 3 | Multi-run consistency |
| DOM binding | 4 | UI event handlers |
| Damage result handling | 7 | Edge cases |
| Null element handling | 6 | Graceful degradation |

### Property-Based Tests to Add

Consider adding property-based tests using a library like `fast-check`:

1. **Hit count invariant**: For any valid configuration, `hitsExecuted` in results equals `hitCount` when completed
2. **Progress monotonicity**: `percentComplete` never decreases during a run
3. **Round-robin coverage**: After N hits where N = parts.length, each part hit exactly once
4. **Duration bounds**: `durationMs >= delayMs * (hitCount - 1)` for non-stopped runs

### Regression Tests for Discovered Issues

Tests explicitly covering the dead code cases:

```javascript
// Already documented in test file at lines 1082-1084, 2543-2547
// These serve as regression tests to prevent re-introduction

// 1. TargetSelector: No default switch case needed
// configure() validates target modes - see line 258-259

// 2. #updateResultsDisplay: No zero-hits branch needed
// hitsExecuted is always >= 1 when this method is called
```

### Integration Test Recommendations

Add integration tests in `tests/integration/domUI/damage-simulator/`:

1. **Full simulation workflow**: Configure -> Run -> Verify events -> Check UI updates
2. **Stop during execution**: Verify partial results and cleanup
3. **Multiple consecutive runs**: Verify state reset and consistency
4. **Focus mode with real parts**: End-to-end targeting verification

### Coverage Monitoring

Add to CI pipeline:
```bash
# Ensure coverage doesn't regress
npm run test:unit -- tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --coverage --coverageThreshold='{"global":{"statements":100,"branches":100,"functions":100,"lines":100}}'
```

## Design Recommendations for Future Robustness

### 1. Reduce DOM Coupling

Consider extracting DOM logic into a separate `MultiHitSimulatorView` class:

```javascript
// Separation of concerns
class MultiHitSimulatorLogic { /* Pure simulation logic */ }
class MultiHitSimulatorView { /* DOM rendering and binding */ }
class MultiHitSimulator { /* Facade combining both */ }
```

This would allow testing simulation logic without DOM mocks.

### 2. Make TargetSelector Testable Independently

Export `TargetSelector` as a separate module:

```javascript
// src/domUI/damage-simulator/TargetSelector.js
export default class TargetSelector { ... }
```

Benefits:
- Direct unit testing without MultiHitSimulator
- Reusable in other components
- Clearer API contract

### 3. Simplify Fallback Chains

Replace multi-level fallbacks with explicit validation:

```javascript
// Instead of
const hitPartId = firstResult.targetPartId || targetPartId || 'unknown';

// Consider
const hitPartId = this.#resolvePartId(firstResult, targetPartId);

#resolvePartId(result, selectorTarget) {
  if (result.targetPartId) return result.targetPartId;
  if (selectorTarget) return selectorTarget;
  return 'unknown';
}
```

Benefits:
- Each path testable individually
- Clear intent
- Easier to debug

### 4. Document Invariants in Code

Add invariant checks that can be enabled in development:

```javascript
#updateResultsDisplay(results) {
  // Invariant: hitsExecuted must be >= 1
  if (process.env.NODE_ENV !== 'production') {
    console.assert(results.hitsExecuted >= 1,
      'Invariant violation: hitsExecuted must be >= 1');
  }
  // ... rest of method
}
```

### 5. Consider State Machine Pattern

For complex state transitions, use an explicit state machine:

```javascript
const STATES = {
  IDLE: 'idle',
  CONFIGURED: 'configured',
  RUNNING: 'running',
  STOPPING: 'stopping',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// Explicit valid transitions
const TRANSITIONS = {
  [STATES.IDLE]: [STATES.CONFIGURED],
  [STATES.CONFIGURED]: [STATES.RUNNING],
  [STATES.RUNNING]: [STATES.STOPPING, STATES.COMPLETED, STATES.ERROR],
  // ...
};
```

Benefits:
- Impossible to enter invalid states
- Transitions are testable
- Self-documenting state flow
