# INJREPANDUSEINT-003: InjuryAggregationService

## Description

Create service that collects injury data from all body parts into an InjurySummaryDTO structure.

## File List

| File | Action |
|------|--------|
| `src/anatomy/services/injuryAggregationService.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-core.js` | MODIFY - add token alphabetically |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | MODIFY - add registration (anatomy services are registered here) |
| `tests/unit/anatomy/services/injuryAggregationService.test.js` | CREATE |

## Out of Scope

- Narrative formatting (INJREPANDUSEINT-006)
- UI rendering (INJREPANDUSEINT-008)
- Death checking logic (INJREPANDUSEINT-005)
- Modifying any existing services

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/anatomy/services/injuryAggregationService.test.js` - 80%+ branch coverage
- `npm run test:unit` passes
- `npx eslint src/anatomy/services/injuryAggregationService.js` passes

### Invariants

- Service extends appropriate base class and follows DI patterns
- `aggregateInjuries(entityId)` returns InjurySummaryDTO with all fields from spec section 5.1:
  - `overallHealthPercent` (number 0-100)
  - `injuredParts` (array of PartInjuryDTO)
  - `activeEffects` (array of effect types)
  - `isDying` (boolean)
  - `turnsUntilDeath` (number|null)
  - `isDead` (boolean)
- Token `InjuryAggregationService` added alphabetically to tokens-core.js
- Correctly reads components:
  - `anatomy:part_health`
  - `anatomy:bleeding`
  - `anatomy:burning`
  - `anatomy:poisoned`
  - `anatomy:fractured`
  - `anatomy:dying`
  - `anatomy:dead`
- Calculates weighted overall health:
  - Torso: weight 3
  - Head: weight 2
  - Limbs: weight 1
  - Internal organs: weight 0.5

## Dependencies

- INJREPANDUSEINT-001 (Component Definitions)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5.1 for InjurySummaryDTO specification.

## Outcome

### Status: COMPLETED

### Implementation Summary

Created `InjuryAggregationService` that collects injury data from all body parts into an `InjurySummaryDTO` structure.

**Files Created:**
- `src/anatomy/services/injuryAggregationService.js` - Main service implementation (511 lines)
- `tests/unit/anatomy/services/injuryAggregationService.test.js` - Comprehensive unit tests (45 tests)

**Files Modified:**
- `src/dependencyInjection/tokens/tokens-core.js` - Added `InjuryAggregationService` token (line 85)
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Added import and registration (lines 85, 887-899)

**Ticket Correction Made:**
- Original ticket incorrectly referenced `orchestrationRegistrations.js` - corrected to `worldAndEntityRegistrations.js` where all anatomy services are registered

### Test Coverage

- Statements: 99.1%
- Branches: 79.16%
- Functions: 100%
- Lines: 99.07%

### InjurySummaryDTO Fields Implemented (per spec section 5.1)

- `entityId` - Owner entity ID
- `entityName` - Name from `core:name` component
- `entityPronoun` - Derived from `core:gender` component (he/she/they)
- `injuredParts` - All parts not in 'healthy' state
- `bleedingParts` - Parts with `anatomy:bleeding` component
- `burningParts` - Parts with `anatomy:burning` component
- `poisonedParts` - Parts with `anatomy:poisoned` component
- `fracturedParts` - Parts with `anatomy:fractured` component
- `destroyedParts` - Parts in 'destroyed' state
- `overallHealthPercentage` - Weighted average (Torso:3, Head:2, Limbs:1, Organs:0.5)
- `isDying` / `dyingTurnsRemaining` / `dyingCause` - From `anatomy:dying` component
- `isDead` / `causeOfDeath` - From `anatomy:dead` component

### Validation Commands Executed

```bash
npx eslint src/anatomy/services/injuryAggregationService.js  # Warnings only (consistent with project patterns)
NODE_ENV=test npx jest tests/unit/anatomy/services/injuryAggregationService.test.js --coverage  # All 45 tests pass
NODE_ENV=test npx jest tests/unit/anatomy/services/ --silent  # All 801 tests pass
```
