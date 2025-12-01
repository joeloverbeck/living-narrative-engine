# DAMTYPANDSPEEFF-004: Event payloads and propagation integration for damage effects

**Status**: Ready
**Priority**: Medium
**Estimated Effort**: 1 day
**Dependencies**: DAMTYPANDSPEEFF-002, DAMTYPANDSPEEFF-003
**Blocks**: DAMTYPANDSPEEFF-005

## Problem / Objective

Ensure all events defined in the spec are emitted with correct payloads during damage application and ongoing tick processing, and that per-part propagation flows preserve event context (e.g., propagatedFrom). Provide hooks for narrative/mod listeners without altering UI.

## Scope

- Define/centralize event typings/constants for: `anatomy:damage_type_applied`, bleeding/burning/poisoned started/stopped, fractured, dismembered, stunned where applicable.
- Wire event emission from DamageTypeEffectsSystem and tick systems so payloads include entityId, partId, damageTypeId, severity/stackedCount, scopes, and propagatedFrom where relevant.
- Update propagation pipeline so propagated hits forward damage type context to enable correct event emission on downstream parts.
- Add coverage ensuring unknown damage types still emit neutral `damage_type_applied` with warning but without special effect events.
- Document event payload shapes for mod authors (short addition to existing docs if present).

## File list

- `src/events/` shared definitions or helper utilities (new or updated file)
- `src/systems/anatomy/DamageTypeEffectsSystem.ts` (event emission wiring)
- `src/systems/anatomy/BleedingSystem.ts`
- `src/systems/anatomy/BurningSystem.ts`
- `src/systems/anatomy/PoisonSystem.ts`
- Propagation/damage pipeline module that passes `damage_type` through (e.g., `src/systems/anatomy/DamageSystem.ts` or equivalent)
- `docs/` or `specs/` addendum describing event payload contracts (concise)
- `tests/integration/anatomy/damage-type-events.test.ts`

## Out of scope

- UI or narrative consumer changes; only event emission and documentation.
- Balancing or altering damage amounts; focus on event correctness only.
- Adding new event bus implementations beyond existing architecture.

## Acceptance criteria

### Tests that must pass

- `npm run test:integration -- tests/integration/anatomy/damage-type-events.test.ts`
- Relevant unit suites from DAMTYPANDSPEEFF-002 and DAMTYPANDSPEEFF-003 continue to pass after event wiring.
- Lint on touched files, especially event helpers and system updates.

### Invariants that must remain true

- Event payloads match the spec fields (no missing entityId/partId/damageTypeId when applicable).
- Propagated damage continues to respect existing per-part health logic; only context propagation is added.
- No additional console logging beyond warnings for unknown damage types.
- Event emission does not introduce duplicate dispatches per effect lifecycle.
