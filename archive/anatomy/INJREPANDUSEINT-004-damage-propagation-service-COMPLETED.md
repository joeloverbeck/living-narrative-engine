# INJREPANDUSEINT-004: DamagePropagationService

## Description

Extract damage propagation logic from `ApplyDamageHandler` into a standalone `DamagePropagationService` for improved testability and separation of concerns.

## Assumption Corrections

**Original Assumption**: DamagePropagationService needs to be created from scratch.

**Actual State (discovered during implementation)**:

- Damage propagation was already implemented in `DAMAPPMEC-004` as the private method `#propagateDamage` in `ApplyDamageHandler` (lines 172-208)
- Existing tests cover propagation at `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` (lines 122-295, 658-702, 768-784)
- The `anatomy:internal_damage_propagated` event schema already exists at `data/mods/anatomy/events/internal_damage_propagated.event.json`

**Scope Adjustment**: This ticket is now an EXTRACTION + REFACTOR task, not a CREATE from scratch task.

## File List

| File                                                                  | Action                                   |
| --------------------------------------------------------------------- | ---------------------------------------- |
| `src/anatomy/services/damagePropagationService.js`                    | CREATE (extract from ApplyDamageHandler) |
| `src/dependencyInjection/tokens/tokens-core.js`                       | MODIFY - add token alphabetically        |
| `src/dependencyInjection/registrations/orchestrationRegistrations.js` | MODIFY - add registration                |
| `src/logic/operationHandlers/applyDamageHandler.js`                   | MODIFY - inject and use service          |
| `tests/unit/anatomy/services/damagePropagationService.test.js`        | CREATE                                   |

## Out of Scope

- Component schema definitions (INJREPANDUSEINT-001)
- Death checking (INJREPANDUSEINT-005)

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/anatomy/services/damagePropagationService.test.js` - 80%+ branch coverage
- `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` - existing tests pass
- `npm run test:unit` passes
- `npx eslint src/anatomy/services/damagePropagationService.js` passes

### Invariants

- Service extends `BaseService` and follows DI patterns
- `propagateDamage(partEntityId, damageAmount, damageTypeId, ownerEntityId)` method:
  - Gets propagation rules from part component
  - For each rule:
    - Checks damage type filter
    - Rolls against probability
    - Verifies child via joint parent check
    - Calculates propagated amount = damageAmount \* damageFraction
  - Dispatches `anatomy:internal_damage_propagated` event for each propagation
- Returns `PropagationResult[]` with:
  - `childPartId` (string)
  - `damageApplied` (number)
  - `damageTypeId` (string)
- `ApplyDamageHandler` injects and uses service instead of private method
- Token `DamagePropagationService` added alphabetically to tokens-core.js

## Dependencies

- INJREPANDUSEINT-001 (Component Definitions) - ✅ Complete
- INJREPANDUSEINT-002 (Event Definitions) - ✅ Complete
- DAMAPPMEC-004 (original implementation) - ✅ Complete

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5.4 for propagation algorithm specification.

---

## Completion Status: ✅ COMPLETED

### Implementation Summary

Successfully extracted damage propagation logic from `ApplyDamageHandler` into a standalone `DamagePropagationService`.

### Files Modified/Created

| File                                                                     | Action   | Lines                                    |
| ------------------------------------------------------------------------ | -------- | ---------------------------------------- |
| `src/anatomy/services/damagePropagationService.js`                       | CREATED  | 287 lines                                |
| `src/dependencyInjection/tokens/tokens-core.js`                          | MODIFIED | Added token                              |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`   | MODIFIED | Added registration                       |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | MODIFIED | Added dependency                         |
| `src/logic/operationHandlers/applyDamageHandler.js`                      | MODIFIED | Injected service, removed private method |
| `tests/unit/anatomy/services/damagePropagationService.test.js`           | CREATED  | 36 tests                                 |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`          | MODIFIED | Added mock, fixed tests                  |

### Test Results

- `damagePropagationService.test.js`: 36 tests passed
- `applyDamageHandler.test.js`: 25 tests passed
- No memory issues (fixed infinite recursion in mocks)

### Key Implementation Decisions

1. **Service returns results, doesn't apply damage**: The service calculates which child parts should receive propagated damage and returns results. `ApplyDamageHandler` iterates results and calls `execute()` for each. This avoids circular dependencies.

2. **Event dispatching**: Service dispatches `anatomy:internal_damage_propagated` events for each propagation.

3. **Mock pattern**: Tests use `mockReturnValueOnce([...]).mockReturnValue([])` to prevent infinite recursion when testing propagation.
