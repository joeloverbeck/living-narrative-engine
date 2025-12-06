# PERPARHEAANDNARTHR-004: MODIFY_PART_HEALTH Handler Implementation

**Status:** Completed
**Priority:** Critical (Phase 2)
**Estimated Effort:** 0.5 day (tests only - handler already exists)
**Dependencies:**

- PERPARHEAANDNARTHR-001 (Part Health Component)
- PERPARHEAANDNARTHR-003 (MODIFY_PART_HEALTH Schema)

---

## Objective

~~Implement the `ModifyPartHealthHandler` operation handler that changes a body part's health value by a delta amount, clamps to valid bounds, and dispatches the `anatomy:part_health_changed` event.~~

**Updated Objective:** Create comprehensive unit tests for the existing `ModifyPartHealthHandler` implementation.

---

## Implementation Status Update

**Note:** A previous Claude Code session has already implemented:

- ✅ `src/logic/operationHandlers/modifyPartHealthHandler.js` (359 lines, production-ready)
- ✅ DI token in `tokens-core.js`
- ✅ Handler registration in `operationHandlerRegistrations.js`
- ✅ Operation mapping in `interpreterRegistrations.js`
- ✅ Whitelist entry in `preValidationUtils.js`

The existing implementation is **superior** to the originally proposed code in this ticket:

- Uses `safeDispatchError` for graceful error handling (vs throwing errors)
- Implements full state calculation with `HEALTH_STATE_THRESHOLDS`
- Manages `turnsInState` correctly
- Uses proper `addComponent` API (vs incorrect `updateComponent`)

---

## Files to Touch

### New Files

- `tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js`

### Already Implemented (No Changes Needed)

- `src/logic/operationHandlers/modifyPartHealthHandler.js` (existing, 359 lines)
- DI registration (all completed in previous session)

---

## Out of Scope

**DO NOT modify:**

- The existing `modifyPartHealthHandler.js` (already complete and working)
- Any DI registration files (already done)
- `preValidationUtils.js` (already done)
- Any component files
- Any event schema files

**DO NOT implement:**

- State recalculation (that's UPDATE_PART_HEALTH_STATE's job)
- Damage type handling (future iteration)
- Armor calculations (future iteration)

---

## Implementation Details

### Handler Implementation (ALREADY COMPLETE)

The handler at `src/logic/operationHandlers/modifyPartHealthHandler.js` implements:

1. **State thresholds** (matching component definition):
   - healthy: 76-100%
   - bruised: 51-75%
   - wounded: 26-50%
   - badly_damaged: 1-25%
   - destroyed: 0%

2. **Core functionality**:
   - Validates params via `#validateParams()`
   - Resolves entity ref (string or JSON Logic)
   - Resolves delta value (number or JSON Logic)
   - Calculates new health with optional clamping
   - Updates state based on health percentage
   - Manages `turnsInState` (increment if same, reset to 0 if changed)
   - Dispatches `anatomy:part_health_changed` event

3. **Event payload**:
   - partEntityId, ownerEntityId, partType
   - previousHealth, newHealth, maxHealth, healthPercentage
   - previousState, newState, delta, timestamp

### Unit Test Structure (TO BE CREATED)

Create `tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js` mirroring `updateHungerStateHandler.test.js`:

**1. Constructor Tests**

- Creates instance with valid dependencies
- Throws if logger is missing
- Throws if entityManager is missing
- Throws if safeEventDispatcher is missing
- Throws if jsonLogicService is missing

**2. Health State Thresholds**

- healthy state (76-100%)
- bruised state (51-75%)
- wounded state (26-50%)
- badly_damaged state (1-25%)
- destroyed state (0%)

**3. Damage and Healing**

- Positive delta (healing) increases health
- Negative delta (damage) decreases health
- Clamps to maxHealth when healing exceeds max
- Clamps to 0 when damage exceeds current health

**4. Clamping Behavior**

- `clamp_to_bounds: true` (default) respects [0, maxHealth]
- `clamp_to_bounds: false` allows overflow/underflow

**5. State Transitions and turnsInState**

- Increments turnsInState when state unchanged
- Resets turnsInState to 0 when state changes

**6. Event Dispatch**

- Dispatches `anatomy:part_health_changed` on every operation
- Event payload includes all required fields

**7. Entity Reference Handling**

- String entity reference
- JSON Logic object reference
- Object with `id` property
- Object with `entityId` property

**8. Delta Resolution**

- Numeric delta value
- JSON Logic expression delta

**9. Error Scenarios**

- Missing `anatomy:part_health` component → dispatches error
- Invalid entity reference → dispatches error
- Invalid delta → dispatches error
- Null params object → dispatches error
- Exception during component update → dispatches error

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit tests:**

   ```bash
   NODE_ENV=test npx jest tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js --no-coverage --verbose
   ```

2. **Full test suite:**

   ```bash
   npm run test:ci
   ```

3. **Type checking:**
   ```bash
   npm run typecheck
   ```

### Invariants That Must Remain True

1. All existing operation handlers remain unchanged
2. Handler follows `BaseOperationHandler` pattern
3. Event payload matches spec REQ-5 exactly
4. Health never goes negative when clamped
5. Health never exceeds maxHealth when clamped
6. No breaking changes to existing systems

---

## Verification Steps

```bash
# 1. Run handler unit tests
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js --no-coverage --verbose

# 2. Run type checking
npm run typecheck

# 3. Run full test suite
npm run test:ci

# 4. Lint the new files
npx eslint src/logic/operationHandlers/modifyPartHealthHandler.js tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js
```

---

## Reference Files

- Handler pattern: `src/logic/operationHandlers/updateHungerStateHandler.js`
- Base class: `src/logic/operationHandlers/baseOperationHandler.js`
- Event dispatch: `src/events/safeEventDispatcher.js`
- Test pattern: `tests/unit/logic/operationHandlers/updateHungerStateHandler.test.js`

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned (per ticket):**

- Implement `ModifyPartHealthHandler` from scratch
- Add DI token, handler registration, operation mapping, whitelist entry
- Create unit tests

**What Actually Happened:**

- Handler was already implemented by a previous Claude Code session
- All DI registration was already complete
- Only unit tests were missing

### Files Created

| File                                                                 | Purpose                                         |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| `tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js` | Comprehensive unit tests (45 tests, 1146 lines) |

### Files Modified

| File                                                           | Change                               |
| -------------------------------------------------------------- | ------------------------------------ |
| `tickets/PERPARHEAANDNARTHR-004-modify-part-health-handler.md` | Updated assumptions, marked complete |

### No Handler Code Changes

The existing handler implementation at `src/logic/operationHandlers/modifyPartHealthHandler.js` was already production-ready and superior to the ticket's proposed code:

- Uses `safeDispatchError` for graceful error handling
- Implements full state calculation with `HEALTH_STATE_THRESHOLDS`
- Manages `turnsInState` correctly
- Uses proper `addComponent` API

### Test Coverage Summary

**45 tests organized in 10 describe blocks:**

| Category                  | Tests | Coverage                                   |
| ------------------------- | ----- | ------------------------------------------ |
| Constructor validation    | 5     | DI contract enforcement                    |
| Health state thresholds   | 5     | All 5 states (healthy through destroyed)   |
| Damage and healing        | 4     | Core delta application                     |
| Clamping behavior         | 3     | Bounds enforcement                         |
| State transitions         | 2     | turnsInState management                    |
| Event dispatch            | 4     | Event payload correctness                  |
| Entity reference handling | 4     | String/JSON Logic/object variations        |
| Delta resolution          | 2     | Numeric/JSON Logic expressions             |
| Error scenarios           | 11    | Graceful degradation via safeDispatchError |
| Edge cases                | 5     | Boundary conditions and defaults           |

### Test Rationale

| Test Category     | Rationale                                           |
| ----------------- | --------------------------------------------------- |
| Constructor       | Validates DI contract enforcement                   |
| Health Thresholds | Ensures state boundaries match component definition |
| Damage/Healing    | Core functionality - delta application              |
| Clamping          | Edge case - prevents invalid health values          |
| turnsInState      | State management consistency                        |
| Event Dispatch    | Integration contract - event payload correctness    |
| Entity Reference  | JSON Logic expression support                       |
| Delta Resolution  | JSON Logic expression support                       |
| Error Scenarios   | Graceful degradation via safeDispatchError          |

### Verification Results

```bash
# Unit tests: 45 passed
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js --no-coverage --verbose
# Result: PASS - 45 tests passed
```

### Completion Date

2025-11-28
