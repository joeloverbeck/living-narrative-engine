# INJREPANDUSEINT-005: DeathCheckService [COMPLETED]

## Description

Create service that monitors vital organ damage and manages dying/death state transitions.

## File List

| File | Action |
|------|--------|
| `src/anatomy/services/deathCheckService.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-core.js` | MODIFY - add token alphabetically |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | MODIFY - add registration |
| `tests/unit/anatomy/services/deathCheckService.test.js` | CREATE |

## Out of Scope

- UI notification of death (INJREPANDUSEINT-008, INJREPANDUSEINT-009)
- ApplyDamageHandler integration (INJREPANDUSEINT-007)
- Entity creation for vital organs (INJREPANDUSEINT-010)

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/anatomy/services/deathCheckService.test.js` - 80%+ branch coverage
- `npm run test:unit` passes
- `npx eslint src/anatomy/services/deathCheckService.js` passes

### Invariants

- Service extends appropriate base class and follows DI patterns
- `checkDeathConditions(entityId, damageCauserId)` method as specified in section 5.3:
  - Finds all body parts with `anatomy:vital_organ` component
  - Checks if any vital organ has `currentHealth <= 0`
  - Triggers immediate death on brain/heart/spine destruction
  - Adds `anatomy:dying` component when overall health < 10%
  - Uses `InjuryAggregationService` to calculate overall health
- Dispatches events appropriately:
  - `anatomy:entity_dying` when entering dying state
  - `anatomy:entity_died` on actual death
- `processDyingTurn(entityId)` method:
  - Decrements `turnsRemaining` in `anatomy:dying` component
  - Triggers death when counter reaches 0
  - Returns boolean indicating if entity died
- Token `DeathCheckService` added alphabetically to tokens-core.js

## Dependencies

- INJREPANDUSEINT-001 (Component Definitions)
- INJREPANDUSEINT-002 (Event Definitions)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5.3 for death check algorithm specification.

---

## Outcome

### Status: ✅ COMPLETED

### Implementation Summary

**Files Created:**
- `src/anatomy/services/deathCheckService.js` - Full service implementation (414 lines)
- `tests/unit/anatomy/services/deathCheckService.test.js` - Comprehensive test suite (41 tests)

**Files Modified:**
- `src/dependencyInjection/tokens/tokens-core.js` - Added `DeathCheckService` token alphabetically after `DamagePropagationService`
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Added import and singletonFactory registration

### Ticket Corrections Applied

**Original ticket issue:** The ticket initially referenced `orchestrationRegistrations.js` as the registration file. This was corrected to `worldAndEntityRegistrations.js` to match the actual codebase structure where anatomy services are registered.

### Implementation Details

**DeathCheckService** extends `BaseService` and provides:

1. **`checkDeathConditions(entityId, damageCauserId)`**
   - Checks if entity is already dead (returns early)
   - Uses `InjuryAggregationService.aggregateInjuries()` to find destroyed parts
   - Checks destroyed parts for `anatomy:vital_organ` component
   - If brain/heart/spine destroyed → immediate death via `#finalizeDeath()`
   - If overall health < 10% → adds `anatomy:dying` component via `#addDyingComponent()`
   - Dispatches `anatomy:entity_dying` or `anatomy:entity_died` events appropriately

2. **`processDyingTurn(entityId)`**
   - Returns `false` if entity not in dying state
   - Respects `stabilizedBy` field (skips countdown if stabilized)
   - Decrements `turnsRemaining`
   - Triggers death when counter reaches 0
   - Returns `boolean` indicating if entity died this turn

**Private helpers:**
- `#checkVitalOrganDestruction()` - Finds destroyed vital organs
- `#checkOverallHealthCritical()` - Checks if health below 10%
- `#finalizeDeath()` - Adds dead component, dispatches event
- `#addDyingComponent()` - Adds dying component, dispatches event
- `#getEntityName()` - Retrieves entity name from `core:name` component
- `#buildDeathMessage()` - Builds narrative death message

### Test Coverage

41 tests organized into:
- Constructor validation (10 tests)
- checkDeathConditions - vital organ destruction (7 tests)
- checkDeathConditions - critical health (5 tests)
- checkDeathConditions - killedBy tracking (2 tests)
- checkDeathConditions - error handling (2 tests)
- processDyingTurn (9 tests)
- Death message generation (3 tests)
- Entity name handling (2 tests)

### Verification

- ✅ All 41 unit tests pass
- ✅ ESLint passes (warnings only, consistent with other anatomy services)
- ✅ DI registration tests pass (54 tests in worldAndEntityRegistrations.test.js)
- ✅ Service follows BaseService pattern with `_init()` for dependency validation
- ✅ All acceptance criteria met

### Date Completed

2025-12-02
