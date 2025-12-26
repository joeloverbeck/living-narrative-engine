# OXYDROSYS-019: Implement HypoxiaTickSystem service

## Status: COMPLETED

## Description

Create the JavaScript tick system that processes hypoxia progression each turn.

## Files to Create

- `src/breathing/services/hypoxiaTickSystem.js`
- `src/breathing/index.js`
- `tests/unit/breathing/services/hypoxiaTickSystem.test.js`

## Files to Modify

- None (DI registration in separate ticket)

## Out of Scope

- DI registration
- Integration with existing systems

## Acceptance Criteria

1. **Follows BleedingTickSystem pattern exactly** ✅
2. **Subscribes to**: `core:turn_ended` ✅
3. **Processes entities with**: `breathing:hypoxic` component ✅
4. **Severity escalation**: mild (0-2 turns) → moderate (3-4 turns) → severe (5-6 turns) → unconscious (7+ turns) ✅
5. **Brain damage**: After 2+ turns unconscious, applies anoxic damage to brain ✅
6. **Events dispatched**: Uses appropriate breathing events ✅
7. **Tests**: Unit tests with >80% coverage ✅ (98.91% statements, 90.74% branches)

## Tests That Must Pass

- `npm run test:unit -- tests/unit/breathing/services/hypoxiaTickSystem.test.js` ✅ (29/29 tests pass)
- `npm run typecheck` ✅ (no new errors introduced)

## Invariants

- Follows established tick system patterns ✅
- Uses BaseService for dependency validation ✅
- Properly cleans up subscriptions in destroy() ✅

---

## Outcome

### What Was Implemented

All files were created exactly as specified in the ticket:

1. **`src/breathing/services/hypoxiaTickSystem.js`** (389 lines)
   - Extends `BaseService` following BleedingTickSystem pattern exactly
   - Subscribes to `TURN_ENDED_ID` (`core:turn_ended`)
   - Processes entities with `breathing:hypoxic` component
   - Implements severity escalation thresholds:
     - mild: turnsInState 0-2
     - moderate: turnsInState 3-4 (actionPenalty: 2)
     - severe: turnsInState 5-6 (actionPenalty: 4)
     - unconscious: turnsInState 7+
   - When reaching unconsciousness:
     - Adds `breathing:unconscious_anoxia` component
     - Dispatches `breathing:anoxic_unconsciousness_started` event
   - After 2+ turns unconscious:
     - Applies 5 anoxic damage to brain organ per turn
     - Dispatches `breathing:brain_damage_started` event (first time only)
   - Properly cleans up subscriptions in `destroy()`

2. **`src/breathing/index.js`** (5 lines)
   - Barrel export for HypoxiaTickSystem

3. **`tests/unit/breathing/services/hypoxiaTickSystem.test.js`** (486 lines)
   - 29 unit tests covering all functionality
   - Coverage: 98.91% statements, 90.74% branches, 100% functions

### Deviations from Plan

None. Implementation matched the ticket exactly.

### Test Coverage

| Metric     | Coverage |
|------------|----------|
| Statements | 98.91%   |
| Branches   | 90.74%   |
| Functions  | 100%     |
| Lines      | 98.90%   |

### New Tests Added

| Test | Rationale |
|------|-----------|
| Constructor tests (7) | Validates dependency injection and BaseService pattern |
| processTick tests (10) | Tests severity escalation, unconsciousness transition, edge cases |
| Brain damage tests (8) | Tests brain damage application, clamping, organ lookup edge cases |
| Event handling tests (1) | Validates TURN_ENDED_ID subscription works |
| Destroy tests (2) | Validates cleanup and idempotency |
