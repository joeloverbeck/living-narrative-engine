# APPDAMDATDRIOPP-005: Make damage-effects e2e suites data-driven
Status: Completed

Update damage-effects e2e tests so they assert against the data the engine actually consumes (weapon damage entries + status-effect registry defaults) instead of stale hardcoded payloads and fallback guesses.

## Reality check
- The status-effect registry service exists but current mod data does not populate `statusEffects`; `DamageTypeEffectsService` therefore merges fallback defaults with whatever is specified on each weapon damage entry.
- `tests/e2e/actions/damageEffectsTriggers.e2e.test.js` pins bleed expectations (severity, tick damage, duration) that disagree with the mod data in `vespera_rapier.entity.json`, so the test is not currently data-aligned.
- Other burn/poison/fracture/dismember coverage already follows weapon-provided config, but numbers are still hardcoded in assertions instead of being derived from the authored entries/definitions.

## File list (expected touches)
- tests/e2e/actions/damageEffectsTriggers.e2e.test.js
- tests/e2e/actions/burnPoisonExtended.e2e.test.js
- Shared e2e helpers/fixtures for damage-type expectations (if any)

## Tasks
- Derive bleed/fracture/burn/poison/dismember/stun expectations from the weapon damage entries and the status-effect defaults resolved at runtime (registry if present, fallback otherwise) instead of hardcoding constants.
- Keep scenario coverage equivalent (trigger pathways, ticking behavior), but make assertions resilient to registry/populated-data changes (e.g., severity tables, durations, stacking defaults).

## Out of scope
- Changing damage application logic or registry content itself.
- Adding new e2e scenarios beyond adapting existing suites to the data-driven model.
- Modifying unrelated e2e suites outside the listed files.

## Acceptance criteria
- Tests: `npm run test:e2e -- tests/e2e/actions/damageEffectsTriggers.e2e.test.js --runInBand` and `npm run test:e2e -- tests/e2e/actions/burnPoisonExtended.e2e.test.js --runInBand` pass.
- Invariants: Coverage continues to validate sequencing and ticking logic; assertions align with the authored damage entries and runtime-resolved defaults; no stale hardcoded effect constants remain.

## Outcome
- Corrected scope to match current engine reality (registry present but empty) and real mod data (rapier bleed severity/duration differs from prior hardcoded expectations).
- Updated the targeted e2e suites to derive assertions from the damage entries actually used at runtime plus the service defaults, removing stale constants while preserving scenario coverage.
- Verified via the specified e2e commands (`--runInBand`).
