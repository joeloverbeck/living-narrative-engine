# APPDAME2ECOV-002: Hit Resolution Controls E2E Coverage

## Summary

Add e2e test coverage for hit resolution controls: `hit_strategy` (`reuse_cached` toggles), `hint_part`, named RNG (`rng_ref`), and multi-entry weapons hitting different parts when caching is disabled.

## Background

Per `specs/apply-damage-e2e-coverage-spec.md`, the existing e2e suites do not exercise:

- `hit_strategy` parameter with `reuse_cached` behavior
- `hint_part` parameter for targeting specific body parts
- Named RNG via `rng_ref` for deterministic hit resolution
- Multi-entry weapons hitting different parts when cache reuse is disabled

## Files Expected to Touch

### New Files

- `tests/e2e/actions/hitResolutionControls.e2e.test.js` - New e2e test suite

### Files Referenced (Read-Only for Context)

- `src/logic/operationHandlers/applyDamageHandler.js` - Hit resolution logic
- `data/mods/weapons/macros/handleMeleeHit.macro.json` - Macro entry point
- `tests/common/mods/ModTestFixture.js` - Test fixture utilities
- `tests/common/mods/ModEntityBuilder.js` - Entity building helpers

## Out of Scope

- Modifications to production code (`src/`)
- Modifications to existing e2e test files
- Changes to `ApplyDamageHandler` implementation
- Changes to macro definitions
- Narrative dispatch coverage (APPDAME2ECOV-001)
- Metadata/tags coverage (APPDAME2ECOV-003)
- Schema changes

## Acceptance Criteria

### Tests That Must Pass

1. **Hit strategy reuse_cached enabled**
   - Test: `should reuse cached hit location when hit_strategy.reuse_cached is true`
   - Verifies: Multiple damage entries hit the same body part when cache reuse is enabled

2. **Hit strategy reuse_cached disabled**
   - Test: `should resolve different parts for each damage entry when reuse_cached is false`
   - Verifies: Multi-entry weapon hits different parts when caching is disabled

3. **hint_part targeting**
   - Test: `should target specified part when hint_part is provided`
   - Verifies: Damage is applied to the exact part specified by `hint_part`

4. **Named RNG determinism**
   - Test: `should produce consistent hit locations when using same rng_ref seed`
   - Verifies: Same `rng_ref` produces identical hit resolution results

5. **Different RNG seeds**
   - Test: `should produce different hit locations with different rng_ref seeds`
   - Verifies: Different seeds produce different (but deterministic) hit patterns

6. **Multi-entry weapon distribution**
   - Test: `should distribute damage across multiple parts for multi-entry weapon without caching`
   - Verifies: A weapon with multiple damage entries can hit multiple distinct body parts

### Invariants That Must Remain True

- Existing e2e tests in `tests/e2e/actions/` continue to pass
- No changes to production behavior (tests only)
- Test follows existing patterns in `swingAtTargetFullFlow.e2e.test.js`
- Uses `ModTestFixture` and `ModEntityBuilder` from test utilities
- Properly cleans up test resources in `afterEach`
- Hit resolution remains probabilistic unless deterministic controls are used

## Implementation Notes

- Create custom execution contexts with controlled `rng_ref` values
- Build target entities with multiple distinct body parts (head, torso, arms, legs)
- Create weapons with multiple damage entries to test distribution
- Track which parts receive damage via event bus listeners
- Compare hit locations across multiple executions with same/different RNG seeds
- Use `filterEligibleHitTargets` indirectly through full APPLY_DAMAGE flow

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/hitResolutionControls.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file)

## Estimated Size

Medium - Single test file with ~6-8 test cases, requires multi-part entity setup

## Outcome

- Created `tests/e2e/actions/hitResolutionControls.e2e.test.js` with comprehensive coverage.
- Implemented `setupScenario` that correctly initializes `ModTestFixture` and installs real operation handlers on the active environment.
- Created a multi-part target using `ModEntityBuilder`, ensuring `anatomy:joint` components and `ownerEntityId` are properly set to allow `BodyGraphService` traversal.
- Implemented 5 tests covering:
    - Cache reuse (default behavior).
    - Cache bypass (`reuse_cached: false`) verifying different hit locations.
    - Hint part targeting.
    - Deterministic RNG (`rng_ref`) verifying consistent results.
    - RNG variance verifying different results with different seeds (while bypassing cache).
- Verified all tests pass.