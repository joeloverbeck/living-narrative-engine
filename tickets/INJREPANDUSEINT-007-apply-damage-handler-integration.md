# INJREPANDUSEINT-007: ApplyDamageHandler Integration

## Description

Integrate DeathCheckService and DamagePropagationService into the existing ApplyDamageHandler flow.

## File List

| File | Action |
|------|--------|
| `src/logic/operationHandlers/applyDamageHandler.js` | MODIFY |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | MODIFY - add new dependencies |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` | MODIFY |
| `tests/integration/anatomy/deathCheckIntegration.test.js` | CREATE |

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

- `ApplyDamageHandler` constructor accepts new optional dependencies:
  - `deathCheckService` (optional for backward compatibility)
  - `damagePropagationService` (optional for backward compatibility)
- After applying damage to a body part:
  1. Check if part has `anatomy:damage_propagation` component
  2. If present, call `damagePropagationService.propagateDamage(partEntityId, damageAmount, damageTypeId)`
  3. After all propagation completes, call `deathCheckService.checkDeathConditions(ownerEntityId, attackerId)`
- Existing damage application logic remains unchanged
- Backward compatible:
  - Handler works correctly if new services are not provided
  - No breaking changes to existing behavior
- Integration test covers:
  - Damage → propagation → death flow
  - Vital organ destruction causing immediate death
  - Low health triggering dying state

## Dependencies

- INJREPANDUSEINT-004 (DamagePropagationService)
- INJREPANDUSEINT-005 (DeathCheckService)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5 for damage flow integration specification.
