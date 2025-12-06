# DAMTYPANDSPEEFF-002: Implement DamageTypeEffectsSystem for immediate effects

**Status**: Completed
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

## Outcome

### Implementation Summary

Implemented `DamageTypeEffectsService` that applies immediate damage type effects after damage resolution in `ApplyDamageHandler`. The service follows the project's established patterns (BaseService, DI container, event-driven architecture).

### Files Created

- `src/anatomy/services/damageTypeEffectsService.js` - Core service implementing immediate damage effects
- `tests/unit/anatomy/services/damageTypeEffectsService.test.js` - Comprehensive unit tests (38 tests)

### Files Modified

- `src/dependencyInjection/tokens/tokens-core.js` - Added `DamageTypeEffectsService` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Registered service factory
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Injected service into ApplyDamageHandler
- `src/logic/operationHandlers/applyDamageHandler.js` - Added service dependency and call to `applyEffectsForDamage()`

### Implementation Details

**Effect Processing Order** (per spec):

1. Dismemberment check - dispatches `anatomy:dismembered`, skips all other effects if triggered
2. Fracture check - adds `anatomy:fractured` component, optionally adds `anatomy:stunned` based on RNG
3. Bleed attachment - adds `anatomy:bleeding` with severity-based tick damage
4. Burn attachment - adds `anatomy:burning` with stacking support
5. Poison attachment - adds `anatomy:poisoned` with configurable scope (part vs entity)

**Key Features**:

- Injectable RNG (`rngProvider`) for deterministic testing
- Unknown damage types log warning and skip effects (no crash)
- Destroyed parts skip ongoing effect attachments (bleed, burn, poison)
- Burn stacking respects `canStack` configuration
- All effects dispatch appropriate events

### Test Results

```
PASS tests/unit/anatomy/services/damageTypeEffectsService.test.js
  38 passing tests covering:
  - Constructor validation
  - Dismemberment threshold logic
  - Fracture with conditional stun
  - Bleed severity mapping
  - Burn stacking behavior
  - Poison scope handling
  - Effect processing order
  - Edge cases (unknown types, disabled effects, zero damage)
```

### Acceptance Criteria Verification

- ✅ Unit tests pass: `npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.test.js`
- ✅ Lint warnings only (no errors in new code; pre-existing duplicate key in tokens-core.js)
- ✅ Existing damage math/propagation unchanged
- ✅ Dismemberment short-circuits other effects
- ✅ Unknown damage types log warning, don't crash
- ✅ RNG is injectable for deterministic tests
