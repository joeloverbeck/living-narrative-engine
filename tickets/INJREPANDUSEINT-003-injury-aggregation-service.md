# INJREPANDUSEINT-003: InjuryAggregationService

## Description

Create service that collects injury data from all body parts into an InjurySummaryDTO structure.

## File List

| File | Action |
|------|--------|
| `src/anatomy/services/injuryAggregationService.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-core.js` | MODIFY - add token alphabetically |
| `src/dependencyInjection/registrations/orchestrationRegistrations.js` | MODIFY - add registration |
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
