# INJREPANDUSEINT-007: ApplyDamageHandler Integration

**Status: COMPLETED**

## Description

Integrate DeathCheckService into the existing ApplyDamageHandler flow. Note: DamagePropagationService is already integrated.

## File List

| File                                                                     | Action                                    |
| ------------------------------------------------------------------------ | ----------------------------------------- |
| `src/logic/operationHandlers/applyDamageHandler.js`                      | MODIFY                                    |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | MODIFY - add deathCheckService dependency |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`          | MODIFY                                    |
| `tests/integration/anatomy/deathCheckIntegration.test.js`                | CREATE                                    |

## Out of Scope

- Service implementations (INJREPANDUSEINT-004, INJREPANDUSEINT-005)
- Component definitions
- UI updates

## Acceptance Criteria

### Tests That Must Pass

- All existing `applyDamageHandler.test.js` tests continue to pass
- `tests/integration/anatomy/deathCheckIntegration.test.js` passes
- `npm run test:unit` passes
- `npm run test:integration` passes
- `npx eslint src/logic/operationHandlers/applyDamageHandler.js` passes

### Invariants

- `ApplyDamageHandler` constructor accepts `deathCheckService` as a **required** dependency (follows codebase pattern of validated dependencies via BaseOperationHandler)
- Note: `damagePropagationService` is already integrated and NOT in scope for this ticket
- After applying damage to a body part:
  1. Existing propagation logic handles `anatomy:damage_propagation` component
  2. After all propagation completes (when `propagatedFrom` is null), call `deathCheckService.checkDeathConditions(ownerEntityId, attackerId)`
- Existing damage application logic remains unchanged
- Integration test covers:
  - Damage → propagation → death flow
  - Vital organ destruction causing immediate death
  - Low health triggering dying state

## Dependencies

- INJREPANDUSEINT-004 (DamagePropagationService) - **COMPLETED**
- INJREPANDUSEINT-005 (DeathCheckService) - **COMPLETED**

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5 for damage flow integration specification.

## Outcome

### Implementation Summary

- **DeathCheckService integrated as required dependency** (not optional, following BaseOperationHandler validation pattern)
- **Death check timing**: Only at top-level damage calls (when `propagatedFrom` is null), ensuring death is checked exactly once after all propagation completes
- **Integration follows existing patterns**: Uses same dependency injection, validation, and logging patterns as other services

### Files Modified

| File                                                                     | Changes                                                                                             |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `src/logic/operationHandlers/applyDamageHandler.js`                      | Added `#deathCheckService` field, constructor validation, and death check logic at end of execute() |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Added `deathCheckService: c.resolve(tokens.DeathCheckService)`                                      |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`          | Added 5 death condition unit tests                                                                  |
| `tests/integration/anatomy/deathCheckIntegration.test.js`                | Created new integration test file with 7 tests                                                      |

### New Tests Added

| Test File                       | Test Count | Rationale                                                                                                                                           |
| ------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyDamageHandler.test.js`    | 5          | Death check integration: top-level call only, propagated call skipped, death log, dying log, damageCauserId passing                                 |
| `deathCheckIntegration.test.js` | 7          | Full damage→death flow: vital organ death, dying state, death/dying event dispatch, propagation→death, already dead edge case, no anatomy edge case |

### Test Results

- All 31 existing unit tests pass
- All 7 new integration tests pass
- Total: 38 tests passing
- ESLint: Passes with no new warnings

### Key Implementation Details

1. **Death check placement**: Added at end of `execute()` method, after `#propagateDamage()` call
2. **Top-level only**: Uses `propagatedFrom` parameter to determine if this is a top-level or recursive call
3. **Owner entity resolution**: Uses `partComponent?.ownerEntityId || entityId` for death check target
4. **Attacker tracking**: Passes `executionContext?.actorId || null` as killer ID for death attribution
