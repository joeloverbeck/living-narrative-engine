# INJREPANDUSEINT-004: DamagePropagationService

## Description

Create service that handles internal damage propagation from parent parts to children.

## File List

| File | Action |
|------|--------|
| `src/anatomy/services/damagePropagationService.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-core.js` | MODIFY - add token alphabetically |
| `src/dependencyInjection/registrations/orchestrationRegistrations.js` | MODIFY - add registration |
| `tests/unit/anatomy/services/damagePropagationService.test.js` | CREATE |

## Out of Scope

- ApplyDamageHandler integration (INJREPANDUSEINT-007)
- Component schema definitions (INJREPANDUSEINT-001)
- Death checking (INJREPANDUSEINT-005)

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/anatomy/services/damagePropagationService.test.js` - 80%+ branch coverage
- `npm run test:unit` passes
- `npx eslint src/anatomy/services/damagePropagationService.js` passes

### Invariants

- Service extends appropriate base class and follows DI patterns
- `propagateDamage(partEntityId, damageAmount, damageTypeId)` method as specified in section 5.4:
  - Reads `anatomy:damage_propagation` component from source part
  - For each rule in `rules` array:
    - Calculates effective probability = `baseProbability * penetrationModifier`
    - Rolls against probability
    - If successful, applies `damageAmount * damageFraction` to child part
  - Applies penetration modifier from damage type entity
- Dispatches `anatomy:internal_damage_propagated` event for each propagation
- Returns `PropagationResult[]` with:
  - `childPartId` (string)
  - `damageApplied` (number)
  - `previousState` (string)
  - `newState` (string)
  - `effectsTriggered` (array)
- Token `DamagePropagationService` added alphabetically to tokens-core.js

## Dependencies

- INJREPANDUSEINT-001 (Component Definitions)
- INJREPANDUSEINT-002 (Event Definitions)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5.4 for propagation algorithm specification.
