# APPDAMSTAEFF-003 Migrate remaining APPLY_DAMAGE e2e consumers to registry-backed helper

## Status
Completed

## Summary
`StatusEffectRegistry` is already loaded in anatomy mod manifests, and a shared helper (`tests/e2e/actions/helpers/damageTypeEffectsServiceFactory`) exists and is used by a few APPLY_DAMAGE suites (`damageEffectsTriggers`, `damageSessionEventQueueing`, `propagationBookkeeping`). The remaining APPLY_DAMAGE e2e suites still instantiate `DamageTypeEffectsService` without a registry, so they silently rely on hardcoded defaults. Migrate those suites to the helper so they exercise registry-driven status effects.

## File list
- tests/e2e/actions/deathMechanics.e2e.test.js
- tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js
- tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js
- tests/e2e/actions/damagePropagationMultiTarget.e2e.test.js
- tests/e2e/actions/damagePropagationFlow.e2e.test.js
- tests/e2e/actions/damageMetadataTags.e2e.test.js
- tests/e2e/actions/hitResolutionControls.e2e.test.js
- tests/e2e/actions/damageNarrativeDispatch.e2e.test.js
- tests/e2e/actions/damageEdgeCases.e2e.test.js
- tests/e2e/actions/burnPoisonExtended.e2e.test.js
- tests/e2e/actions/multiTurnCombatScenario.e2e.test.js

## Out of scope
- Changing narratives, action payloads, or entity fixtures used in these tests.
- Altering APPLY_DAMAGE handler logic or non-test engine code.
- Introducing new status-effect scenarios beyond wiring the registry-backed service.
- Reworking suites already on the helper (`damageEffectsTriggers`, `damageSessionEventQueueing`, `propagationBookkeeping`).

## Acceptance criteria
- Tests:
  - `npm run test:e2e -- tests/e2e/actions/damagePropagationFlow.e2e.test.js tests/e2e/actions/damagePropagationMultiTarget.e2e.test.js tests/e2e/actions/damageMetadataTags.e2e.test.js`
  - `npm run test:e2e -- tests/e2e/actions/deathMechanics.e2e.test.js tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js`
  - `npm run test:e2e -- tests/e2e/actions/damageNarrativeDispatch.e2e.test.js tests/e2e/actions/damageEdgeCases.e2e.test.js tests/e2e/actions/hitResolutionControls.e2e.test.js tests/e2e/actions/burnPoisonExtended.e2e.test.js tests/e2e/actions/multiTurnCombatScenario.e2e.test.js`
- Invariants:
  - Scenario setups, assertions, and narrative expectations stay semantically identical; only the damage-effect service wiring shifts to the helper.
  - Tests remain deterministic and continue using the same fixtures and mod data files while exercising registry-backed defaults.

## Outcome
- Updated all listed APPLY_DAMAGE e2e suites to resolve `DamageTypeEffectsService` through the shared helper, ensuring each test runs with the registry-backed status-effect defaults instead of hardcoded fallbacks.
- No gameplay logic, fixtures, or narratives were changed; only handler wiring was adjusted. Tests rerun with `--runInBand` to avoid known Jest worker exits.
