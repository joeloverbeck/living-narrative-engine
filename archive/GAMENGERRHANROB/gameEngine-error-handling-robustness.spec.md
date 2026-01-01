# gameEngine.js Error Handling Robustness Specification

## Status: ✅ SPEC COMPLETED

This specification has been fully implemented across tickets GAMENGERRHANROB-001 through GAMENGERRHANROB-008.

### Outcome Summary

| Ticket | Status | Deliverable |
|--------|--------|-------------|
| 001-002 | ✅ | Core migrations (gameEngine.js patterns) |
| 003 | ✅ | Migrate engineErrorUtils.js |
| 004 | ✅ | Migrate safeErrorLogger.js |
| 005 | ✅ | Property test: normalization invariant |
| 006 | ✅ | Property test: preservation invariant |
| 007 | ✅ | Property test: augmentation safety |
| 008 | ✅ | Documentation: boundary-only convention |

### Key Artifacts Created

- `src/utils/errorNormalization.js` - Error normalization utility
- `tests/unit/utils/errorNormalization.test.js` - Unit tests
- `tests/unit/utils/errorNormalization.property.test.js` - Property tests
- `docs/architecture/error-handling-convention.md` - Convention documentation

---

## Context

### Location
`src/engine/gameEngine.js` (~800 lines)

### Module Purpose
The GameEngine is the core game orchestration module responsible for:
- **Lifecycle Management**: `start()`, `stop()`, `shutdown()` methods
- **Turn Execution**: `executeCurrentActorTurn()` for actor decision flow
- **State Management**: Game state initialization, reset, and cleanup
- **LLM Integration**: `previewLlmPromptForCurrentActor()` for AI prompt generation
- **Error Recovery**: Cascading cleanup with error accumulation

### Key Dependencies
- `IEntityManager` - Entity lifecycle operations
- `ISafeEventDispatcher` - Event dispatching with error handling
- `IAvailableActionsProvider` - Action discovery
- `ITurnManager` - Turn order management
- `engineState.js` - Engine state machine

---

## Problem

### What Failed
Achieving 100% unit test coverage for `gameEngine.js` required:
1. Removing unreachable code at line 637 (error normalization ternary)
2. Complex module isolation patterns with `jest.isolateModulesAsync`
3. Property assignment blocking via `Object.defineProperty`
4. Conditional DI container mocking with `isRegistered()` behavior

### Root Causes

#### 1. Redundant Error Normalization (11+ instances)
The same pattern appears throughout the codebase:
```javascript
const normalized = err instanceof Error ? err : new Error(String(err));
```

**Problem**: Private methods like `#resetCoreGameState()` normalize errors internally (lines 147, 164), but outer catch blocks also normalize. This creates unreachable branches because:
- Inner normalization guarantees Error instances
- Outer normalization's `false` branch can never execute

**Evidence**: Line 637's false branch was provably unreachable and was removed.

#### 2. Inconsistent Error Handling Strategy
| Method Layer | Strategy | Issue |
|-------------|----------|-------|
| Private methods | Normalize at throw site | Callers still normalize again |
| Public methods | Normalize at catch boundary | Redundant with internal normalization |
| Cleanup phases | Accumulate errors | Complex property augmentation logic |

No documented convention defines which layer is responsible for normalization.

#### 3. Complex Test Mocking Requirements
| Requirement | Reason |
|-------------|--------|
| `jest.isolateModulesAsync` | Private fields require fresh module instances |
| `jest.doMock` for engineState | Control `#resetEngineState()` failure behavior |
| `Object.defineProperty` | Block `cause` setter to test fallback paths |
| Conditional `isRegistered()` | Simulate partial DI container state |

### Test Evidence
- `tests/unit/engine/gameEngine.branchCoverage.test.js` - Error path coverage
- `tests/unit/engine/gameEngine.errorRecovery.coverage.test.js` - Cleanup error accumulation

---

## Truth Sources

### Internal Documentation
- `CLAUDE.md` - Error handling guidelines (use event dispatching, not direct logging)
- `src/utils/errorUtils.js` - `displayFatalStartupError()` pattern
- `src/utils/safeErrorLogger.js` - Safe error logging with recursion protection
- `src/events/eventBus.js` - Event dispatch error handling patterns

### Domain Rules
1. **ECS Architecture**: Errors should flow through event bus when possible
2. **Dependency Injection**: Services receive dependencies via constructor
3. **Private Fields**: Use `#` prefix for true encapsulation

### External Contracts
- JavaScript Error API: `Error`, `cause` property (ES2022+)
- Jest testing framework: Module isolation patterns

---

## Desired Behavior

### Normal Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| Game starts successfully | Engine enters `PLAYING` state, no errors |
| Turn executes normally | Actor decision processed, state advanced |
| Game stops cleanly | All cleanup phases complete, state reset |
| Prompt preview generated | LLM prompt dispatched via event |

### Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| Dependency throws non-Error value | Normalize once at catch boundary, preserve original as `cause` |
| Multiple cleanup phases fail | Accumulate all errors in `cleanupErrors` array on primary error |
| Property augmentation (`cause`) throws | Fall back to `engineResetError` property |
| Dispatch returns `false` | Log warning, continue execution (non-fatal) |
| Dispatch throws Error | Log error, continue execution (non-fatal) |

### Failure Modes
| Failure Type | Response |
|--------------|----------|
| Single operation failure | Log context, dispatch error event, throw normalized Error |
| Cascading reset failures | Accumulate errors on primary error, throw primary with all context |
| Non-critical dispatch failure | Log warning/error, do not throw |
| Critical state corruption | Attempt emergency reset, throw if reset fails |

---

## Invariants

### Error Handling Invariants
1. **All thrown errors MUST be Error instances**
   - Normalize at catch boundary only, not at throw site
   - Inner methods can trust callers to normalize

2. **Error augmentation MUST NOT throw**
   - Use defensive try-catch around property assignment
   - Fall back to alternative property names on failure

3. **Private methods that throw normalized errors MUST document it**
   - JSDoc: `@throws {Error} Always throws Error instance (normalized internally)`
   - Callers can skip redundant normalization

4. **Cleanup errors MUST be preserved**
   - Never swallow errors during cleanup
   - Use `cleanupErrors: Error[]` array for accumulation
   - Primary error gets all context attached

### State Invariants
5. **Engine state transitions MUST be valid**
   - Cannot execute turns in `STOPPED` state
   - Cannot start already-running engine

6. **Reset operations MUST be idempotent**
   - Multiple reset calls should not compound errors
   - Failed resets leave engine in safe (stopped) state

---

## API Contracts

### Stable Public API (Do Not Change)
```typescript
class GameEngine {
  // Lifecycle
  async start(savedGame?: SavedGame): Promise<void>
  async stop(): Promise<void>
  async shutdown(): Promise<void>

  // Turn Management
  async executeCurrentActorTurn(): Promise<TurnResult>

  // LLM Integration
  async previewLlmPromptForCurrentActor(): Promise<void>

  // State Queries
  isRunning(): boolean
  getCurrentActor(): Entity | null
}
```

### Error Event Types (Stable)
- `SYSTEM_ERROR_OCCURRED` - Critical system failures
- `GAME_STARTUP_FAILED` - Startup-specific errors
- `TURN_EXECUTION_FAILED` - Turn processing errors

### Internal Contracts (May Change)
- Private method signatures (`#resetCoreGameState`, `#resetEngineState`)
- Error accumulation property names (`cleanupErrors`, `engineResetError`)
- Internal state machine transitions

---

## What Is Allowed to Change

### Refactoring Opportunities

#### A. Error Normalization Helper ✅ IMPLEMENTED
Extract reusable utility to eliminate repeated ternaries:
```javascript
// src/utils/errorNormalization.js
export function normalizeError(err, context = '') {
  if (err instanceof Error) return err;
  const normalized = new Error(String(err));
  if (context) normalized.context = context;
  return normalized;
}
```

**Benefits**:
- Eliminates 11+ duplicate patterns
- Single source of truth for normalization logic
- Easier testing of normalization behavior

#### B. Boundary-Only Normalization Convention ✅ DOCUMENTED
Establish clear ownership of error normalization:

| Layer | Responsibility |
|-------|---------------|
| Private methods | Throw raw (whatever they catch) |
| Public methods | Normalize at catch boundary |
| External calls | Always normalize before processing |

**Benefits**:
- Reduces unreachable branches
- Simplifies testing (fewer paths to cover)
- Clear documentation of responsibility

#### C. Error Factory Pattern
Use domain-specific error class:
```javascript
class GameEngineError extends Error {
  static from(err, operation) {
    if (err instanceof GameEngineError) return err;
    return new GameEngineError(
      err instanceof Error ? err.message : String(err),
      { cause: err, operation }
    );
  }
}
```

**Benefits**:
- Type-safe error identification
- Built-in normalization
- Rich error context

### Implementation Changes Allowed
- Internal error handling strategy consolidation
- Error augmentation helper extraction
- Private method signatures (with test updates)
- Test mock complexity reduction

### Changes Requiring Discussion
- Public API modifications
- Error event type changes
- New dependencies

---

## Testing Plan

### Tests to Update
None required - already at 100% coverage after line 637 removal.

### Regression Tests to Maintain
| Test File | Purpose |
|-----------|---------|
| `gameEngine.branchCoverage.test.js` | All error path branches |
| `gameEngine.errorRecovery.coverage.test.js` | Cleanup error accumulation |
| `gameEngine.test.js` | Core functionality |

### Property Tests to Consider ✅ IMPLEMENTED
1. **Error Normalization Invariant**
   ```javascript
   // Property: All caught non-Error values produce valid Error instances
   fc.assert(fc.property(fc.anything(), (value) => {
     const result = normalizeError(value);
     expect(result).toBeInstanceOf(Error);
     expect(result.message).toBeDefined();
   }));
   ```

2. **Error Preservation Invariant**
   ```javascript
   // Property: Cascading failures preserve all error information
   fc.assert(fc.property(fc.array(fc.string()), (errorMessages) => {
     const errors = errorMessages.map(m => new Error(m));
     const accumulated = accumulateErrors(errors);
     expect(accumulated.cleanupErrors).toHaveLength(errors.length - 1);
   }));
   ```

3. **Augmentation Safety Invariant**
   ```javascript
   // Property: Error augmentation never throws
   fc.assert(fc.property(fc.anything(), (value) => {
     expect(() => safeAugmentError(new Error('test'), 'prop', value)).not.toThrow();
   }));
   ```

### Future Test Simplification Goals
After refactoring:
- Reduce `jest.isolateModulesAsync` usage by 50%
- Eliminate `Object.defineProperty` hacks for cause blocking
- Replace conditional `isRegistered()` mocks with proper DI patterns

---

## References

### Related Files
- `src/engine/gameEngine.js` - Primary module
- `src/engine/engineState.js` - State machine
- `src/utils/errorUtils.js` - Error display utilities
- `src/utils/safeErrorLogger.js` - Safe logging utilities

### Test Files
- `tests/unit/engine/gameEngine.test.js`
- `tests/unit/engine/gameEngine.branchCoverage.test.js`
- `tests/unit/engine/gameEngine.errorRecovery.coverage.test.js`

### Documentation
- `CLAUDE.md` - Project coding standards
- `docs/architecture/` - Architecture documentation
- `docs/architecture/error-handling-convention.md` - The documented convention
