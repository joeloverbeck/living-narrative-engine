# INJREPANDUSEINT-005: DeathCheckService

## Description

Create service that monitors vital organ damage and manages dying/death state transitions.

## File List

| File | Action |
|------|--------|
| `src/anatomy/services/deathCheckService.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-core.js` | MODIFY - add token alphabetically |
| `src/dependencyInjection/registrations/orchestrationRegistrations.js` | MODIFY - add registration |
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
