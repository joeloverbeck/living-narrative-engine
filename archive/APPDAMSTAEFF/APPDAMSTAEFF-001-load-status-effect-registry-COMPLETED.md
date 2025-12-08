# APPDAMSTAEFF-001 Load status-effect registry from anatomy manifest

Status: Completed

## Summary
- Current anatomy manifest leaves `content.statusEffects` empty and instead adds a non-schema `content["status-effects"]` entry, so the status-effect registry never loads.
- The manifest generator (`scripts/updateManifest.js`, invoked via `npm run update-manifest`) does not map `status-effects/` folders to the `statusEffects` content key, so rerunning it would reintroduce the bad manifest shape.
- Fix the manifest to point `statusEffects` at `status-effects.registry.json` (loader already prepends the `status-effects/` folder) and add an integration guard that `dataRegistry.getAll('statusEffects')` returns entries for the anatomy mod.

## File list
- data/mods/anatomy/mod-manifest.json
- scripts/updateManifest.js
- tests/integration/mods/anatomy/statusEffectsRegistryLoading.integration.test.js (new)

## Out of scope
- Changing status-effect registry data values or thresholds (`data/mods/anatomy/status-effects/status-effects.registry.json` content stays the same).
- Modifying other mods’ manifests or loader behavior for unrelated content types.
- Refactoring registry loading infrastructure beyond what is needed to wire this manifest correctly.

## Acceptance criteria
- Tests:
- `npm run test:integration -- tests/integration/mods/anatomy/statusEffectsRegistryLoading.integration.test.js`
- `npm run update-manifest anatomy` picks up `status-effects/status-effects.registry.json` under `content.statusEffects` without emitting unknown keys.
- Invariants:
  - Mod manifest continues to conform to `mod-manifest.schema.json`.
  - Fallback defaults in `DamageTypeEffectsService` remain functional if a registry is intentionally absent (no regression to existing behavior when registry is missing).

## Outcome
- Manifest now lists `status-effects.registry.json` under `content.statusEffects`, allowing the status-effect registry to load without duplicating the folder segment.
- `scripts/updateManifest.js` recognizes `status-effects/` folders and maps them to the `statusEffects` manifest key.
- Added an integration guard to ensure the anatomy status-effect registry is loaded into the data registry through the ModsLoader pipeline.
