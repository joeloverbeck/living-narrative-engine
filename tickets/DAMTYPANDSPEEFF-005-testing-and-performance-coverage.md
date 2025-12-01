# DAMTYPANDSPEEFF-005: Comprehensive testing and performance guardrails for damage effects

**Status**: Ready
**Priority**: Medium
**Estimated Effort**: 2 days
**Dependencies**: DAMTYPANDSPEEFF-002, DAMTYPANDSPEEFF-003, DAMTYPANDSPEEFF-004
**Blocks**: None

## Problem / Objective

Add the test coverage called out in the specification (unit, integration, property/statistical, and performance regression) to ensure the new damage types and special effects behave deterministically and scale on large anatomies.

## Scope

- Create/extend unit tests for parsing defaults, bleed application, fracture thresholds with stunChance, burn stacking, poison scope, dismemberment short-circuit, and effect removal.
- Add integration tests for full damage pipeline, concurrent effects, stun/action lockout hook, dismember narrative flow, and mod extensibility with custom flags.
- Implement property/statistical tests for bleed DPS bounds and burn stacking stability (with deterministic RNG/seeding).
- Add a lightweight performance/regression test that exercises tick systems on large anatomies and checks for no duplicate events or leaks when entities are removed.
- Ensure test fixtures and helpers are reusable across suites without mutating shared global state.

## File list

- `tests/unit/anatomy/damage-types.schema.test.ts` (extend if created earlier)
- `tests/unit/anatomy/damage-type-effects.system.test.ts`
- `tests/unit/anatomy/bleeding.system.test.ts`
- `tests/unit/anatomy/burning.system.test.ts`
- `tests/unit/anatomy/poison.system.test.ts`
- `tests/integration/anatomy/damage-type-events.test.ts`
- `tests/integration/anatomy/full-damage-pipeline.test.ts`
- `tests/property/anatomy/damage-types.property.test.ts` (or equivalent location)
- `tests/performance/anatomy/damage-effects.performance.test.ts`
- Shared fixtures/mocks under `tests/fixtures/anatomy/`

## Out of scope

- Changing runtime systems beyond what is required to enable tests (e.g., avoid production code rewrites; only add small hooks for determinism if needed).
- Coverage thresholds adjustments for the entire repo; keep scope local to new suites.
- UI snapshot or e2e UI flows.

## Acceptance criteria

### Tests that must pass

- `npm run test:unit` with focus on new/updated unit suites.
- `npm run test:integration -- tests/integration/anatomy/full-damage-pipeline.test.ts`
- Property/statistical suite: `npm run test:unit -- tests/property/anatomy/damage-types.property.test.ts` (or equivalent command)
- Performance regression check: `npm run test:performance -- tests/performance/anatomy/damage-effects.performance.test.ts` (or equivalent command supported by repo tooling)

### Invariants that must remain true

- Tests remain deterministic (seeded RNG) and do not rely on real timeouts beyond existing test harness patterns.
- Large-anatomy performance test does not materially slow down the full suite; keep within existing performance budget.
- No changes to balance values for shipped mods beyond what tests explicitly set in fixtures.
- Test helpers do not introduce global event bus state that could affect unrelated suites.
