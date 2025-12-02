# DAMTYPANDSPEEFF-005: Comprehensive testing and performance guardrails for damage effects

**Status**: Complete
**Priority**: Medium
**Estimated Effort**: 2 days
**Dependencies**: DAMTYPANDSPEEFF-002, DAMTYPANDSPEEFF-003, DAMTYPANDSPEEFF-004
**Blocks**: None
**Completed**: 2025-12-02

## Problem / Objective

Add the test coverage called out in the specification (unit, integration, property/statistical, and performance regression) to ensure the new damage types and special effects behave deterministically and scale on large anatomies.

## Scope

- Create/extend unit tests for parsing defaults, bleed application, fracture thresholds with stunChance, burn stacking, poison scope, dismemberment short-circuit, and effect removal.
- Add integration tests for full damage pipeline, concurrent effects, stun/action lockout hook, dismember narrative flow, and mod extensibility with custom flags.
- Implement property/statistical tests for bleed DPS bounds and burn stacking stability (with deterministic RNG/seeding).
- Add a lightweight performance/regression test that exercises tick systems on large anatomies and checks for no duplicate events or leaks when entities are removed.
- Ensure test fixtures and helpers are reusable across suites without mutating shared global state.

## File list (Corrected)

**Note**: This project uses JavaScript (.js), not TypeScript (.ts).

### Already Implemented (No changes needed)
- `tests/unit/anatomy/damage-types.schema.test.js` - ✅ Exists
- `tests/unit/anatomy/services/damageTypeEffectsService.test.js` - ✅ Exists (745 lines, comprehensive)
- `tests/unit/anatomy/services/bleedingTickSystem.test.js` - ✅ Exists (367 lines)
- `tests/unit/anatomy/services/burningTickSystem.test.js` - ✅ Exists (393 lines)
- `tests/unit/anatomy/services/poisonTickSystem.test.js` - ✅ Exists (479 lines)
- `tests/integration/anatomy/damage-type-events.integration.test.js` - ✅ Exists
- `tests/integration/anatomy/damage-application.integration.test.js` - ✅ Exists (full pipeline)

### Created
- `tests/property/anatomy/damage-types.property.test.js` - Property tests for invariants
- `tests/performance/anatomy/damage-effects.performance.test.js` - Performance regression tests

## Out of scope

- Changing runtime systems beyond what is required to enable tests (e.g., avoid production code rewrites; only add small hooks for determinism if needed).
- Coverage thresholds adjustments for the entire repo; keep scope local to new suites.
- UI snapshot or e2e UI flows.

## Acceptance criteria

### Tests that must pass

- `npm run test:unit` with focus on new/updated unit suites.
- `npm run test:integration -- tests/integration/anatomy/`
- Property/statistical suite: `npm run test:property -- tests/property/anatomy/damage-types.property.test.js`
- Performance regression check: `npm run test:performance -- tests/performance/anatomy/damage-effects.performance.test.js`

### Invariants that must remain true

- Tests remain deterministic (seeded RNG) and do not rely on real timeouts beyond existing test harness patterns.
- Large-anatomy performance test does not materially slow down the full suite; keep within existing performance budget.
- No changes to balance values for shipped mods beyond what tests explicitly set in fixtures.
- Test helpers do not introduce global event bus state that could affect unrelated suites.

---

## Outcome

### What was originally planned vs. implemented

The original ticket assumed many test files needed to be created (7 unit test files, 2 integration test files), but **most already existed** with comprehensive coverage. The ticket was also written assuming TypeScript (`.ts` extensions), but the project uses JavaScript.

**Originally planned**: 9 new test files
**Actually needed**: 2 new test files

### Files created

1. **`tests/property/anatomy/damage-types.property.test.js`** (540 lines)
   - 12 property tests using fast-check library with seeded RNG (seed: 42)
   - Tests bleed severity map invariants (positive tickDamage, monotonic increase)
   - Tests bleed DPS bounds (no negative durations, bounded total damage)
   - Tests burn stacking stability (canStack=true/false behavior, duration refresh)
   - Tests bleed application invariants (valid structure for applied components)
   - Tests poison scope invariants (only 'part' and 'entity' valid)
   - Tests damage type definition defaults (graceful handling of missing fields)

2. **`tests/performance/anatomy/damage-effects.performance.test.js`** (555 lines)
   - 15 performance tests with timing budget verification
   - Tests tick systems on 100 parts (< 200ms budget)
   - Tests no duplicate events on expiration (exactly one event per part)
   - Tests cleanup on entity destruction (component removal, proper event dispatch)
   - Tests performance stability across multiple ticks
   - Tests linear scaling with part count
   - Tests memory efficiency (no leaked component references)

### Test results summary

All 143 damage-related tests pass:
- Unit tests: 99 tests (damageTypeEffectsService, bleedingTickSystem, burningTickSystem, poisonTickSystem)
- Integration tests: 17 tests (damage-type-events, damage-application)
- Property tests: 12 tests (damage-types.property)
- Performance tests: 15 tests (damage-effects.performance)

### Performance baselines established

| Test | Time | Budget |
|------|------|--------|
| BleedingTickSystem 100 parts | ~2ms | 200ms |
| BurningTickSystem 100 parts | ~1ms | 200ms |
| PoisonTickSystem 100 parts | ~1ms | 200ms |
| All three systems on 100 parts | ~5ms | 200ms |
| 5 ticks on 50 parts (avg) | ~0.2ms | - |

### Corrections made to ticket

1. Changed file extensions from `.ts` to `.js` throughout
2. Updated file paths to reflect actual directory structure (e.g., `services/` subdirectory)
3. Marked 7 existing test files as "Already Implemented"
4. Scoped "To Be Created" to only the 2 missing test files
