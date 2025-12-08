# APPDAMSTAEFF-002 Wire core APPLY_DAMAGE e2e suites to StatusEffectRegistry

## Status
Completed

## Summary
Ensure the highest-signal APPLY_DAMAGE e2e suites build `DamageTypeEffectsService` with a real `StatusEffectRegistry` fed from the actual status-effect registry JSON (clone `data/mods/anatomy/status-effects/status-effects.registry.json`). ModTestFixture exposes `testEnv.dataRegistry` (no `getAll`/status-effect entries), so the helper should supply a minimal registry provider when constructing `StatusEffectRegistry`. Add an assertion that fails if registry defaults are ignored by mutating a registry default within the test (e.g., stacking count or apply order) before constructing the service.

## File list
- tests/e2e/actions/helpers/damageTypeEffectsServiceFactory.js (new helper to centralize registry-backed construction using cloned registry data)
- tests/e2e/actions/damageEffectsTriggers.e2e.test.js
- tests/e2e/actions/damageSessionEventQueueing.e2e.test.js
- tests/e2e/actions/propagationBookkeeping.e2e.test.js

## Out of scope
- Changing underlying APPLY_DAMAGE logic or handler wiring beyond test setup.
- Altering registry data definitions themselves.
- Migrating every APPLY_DAMAGE e2e consumer; this ticket covers the core suites only.

## Acceptance criteria
- Tests:
  - `npm run test:e2e -- tests/e2e/actions/damageEffectsTriggers.e2e.test.js`
  - `npm run test:e2e -- tests/e2e/actions/damageSessionEventQueueing.e2e.test.js`
  - `npm run test:e2e -- tests/e2e/actions/propagationBookkeeping.e2e.test.js`
- Invariants:
  - E2E fixture behavior (ModTestFixture lifecycle, entity setup) remains unchanged outside of the damage-effect wiring.
  - `DamageTypeEffectsService` fallback defaults remain available for non-registry scenarios (no removal of fallback code paths).

## Outcome
- Added `tests/e2e/actions/helpers/damageTypeEffectsServiceFactory.js` to build `DamageTypeEffectsService` with a `StatusEffectRegistry` backed by the real status-effect registry JSON (cloned per test with optional mutator).
- Wired `damageEffectsTriggers`, `damageSessionEventQueueing`, and `propagationBookkeeping` e2e suites to use the registry-backed helper instead of leaving the registry undefined.
- Added a burn-effect assertion that mutates the registry stacking default and checks logger warnings to ensure registry-driven defaults are honored (detects fallback usage). Tests executed with `--runInBand` due to known worker instability.
