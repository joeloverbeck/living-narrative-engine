# DAMTYPANDSPEEFF-002: Implement DamageTypeEffectsSystem for immediate effects

**Status**: Ready
**Priority**: High
**Estimated Effort**: 2 days
**Dependencies**: DAMTYPANDSPEEFF-001
**Blocks**: DAMTYPANDSPEEFF-003, DAMTYPANDSPEEFF-004

## Problem / Objective

Implement the runtime system that reads damage type definitions and applies immediate effects (dismemberment, fracture + optional stun, bleed/burn/poison attachment) right after damage resolution. Ensure missing or unknown damage types degrade gracefully with warnings.

## Scope

- Add `src/systems/anatomy/DamageTypeEffectsSystem.ts` (or equivalent) that hooks into damage application pipeline after raw damage and propagation are computed.
- Enforce dismemberment before applying ongoing components; set part health to 0 when thresholds hit and emit the appropriate event.
- Apply fracture with threshold logic, set `anatomy:fractured` component, and probabilistically add `anatomy:stunned` when stunChance triggers (injectable RNG for testability).
- Attach or refresh bleeding, burning, and poisoned components based on damage type configuration and target scope (part vs entity) without performing tick damage yet.
- Emit events per spec when effects are applied; warn (not throw) on unknown damage type ids.

## File list

- `src/systems/anatomy/DamageTypeEffectsSystem.ts`
- `src/` damage pipeline integration point (e.g., `DamageSystem`, dispatcher, or handler where the new system registers)
- `src/events/` or shared event constants/typing files
- `tests/unit/anatomy/damage-type-effects.system.test.ts`
- `tests/fixtures/` for sample damage type definitions and anatomy parts

## Out of scope

- Ongoing tick processing for bleeding, burning, or poison (handled in DAMTYPANDSPEEFF-003).
- UI/narrative rendering of events.
- Balance tuning of damage values beyond deterministic thresholds needed for tests.
- Performance optimizations beyond correctness and basic guardrails.

## Acceptance criteria

### Tests that must pass

- New unit suite covering immediate effect application: `npm run test:unit -- tests/unit/anatomy/damage-type-effects.system.test.ts`.
- Lint on touched files: `npm run lint -- src/systems/anatomy/DamageTypeEffectsSystem.ts tests/unit/anatomy/damage-type-effects.system.test.ts` (or path-appropriate invocation).

### Invariants that must remain true

- Existing damage application math and propagation remain unchanged except for new effect hooks.
- Dismemberment short-circuits other component attachments for the destroyed part as specified.
- Unknown damage type ids do not crash the pipeline; they log/warn and skip special effects.
- RNG for stun application is injectable/mocked so tests are deterministic.
