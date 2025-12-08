# APPLY_DAMAGE Status-Effect Workflow Audit

## Findings
- Data-driven status-effect registry is not loaded: `data/mods/anatomy/mod-manifest.json` leaves `content.statusEffects` empty and instead adds a non-standard `status-effects` key, while the loader expects `statusEffects`. Result: `StatusEffectRegistry` receives no entries, logs the fallback warning, and `DamageTypeEffectsService` uses hardcoded defaults instead of `data/mods/anatomy/status-effects/status-effects.registry.json`.
- Existing APPLY_DAMAGE e2e suites construct `DamageTypeEffectsService` without a `StatusEffectRegistry`, so they always exercise the fallback defaults and would keep passing even if registry data changed. Examples: `tests/e2e/actions/damageEffectsTriggers.e2e.test.js` (bleed/burn/poison/fracture/dismember), `tests/e2e/actions/damageSessionEventQueueing.e2e.test.js`, and similar handler wiring in other APPLY_DAMAGE suites.
- Because the registry data currently mirrors the hardcoded defaults (same thresholds/durations/applyOrder), the misload is silent: runtime behavior matches fallback, but any future registry adjustments (e.g., changing burn stacking or apply order) will be ignored.

## Prioritized Fixes
1) **Load the registry**: Move `"status-effects/status-effects.registry.json"` under `content.statusEffects` in `data/mods/anatomy/mod-manifest.json` (remove the extra `status-effects` key). Add a fast integration sanity check that `dataRegistry.getAll('statusEffects')` returns at least one entry to prevent regressions.
2) **Exercise data-driven effects in tests**: In APPLY_DAMAGE e2e fixtures, resolve `DamageTypeEffectsService` with a real `StatusEffectRegistry` (from `testEnv.registry`) instead of leaving it undefined. Add one assertion that the defaults come from the registry (e.g., tweak a registry value in-test or expect `applyOrder` to match the registry) so missing data would fail loudly.
3) **Optional hardening**: Add a loader-level test to assert mod manifests reject unknown content keys like `status-effects`, and log/throw when status-effect registry is empty in non-test environments to surface misconfiguration early.
