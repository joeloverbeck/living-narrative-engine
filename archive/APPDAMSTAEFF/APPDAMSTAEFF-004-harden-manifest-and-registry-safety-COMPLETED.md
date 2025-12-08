# APPDAMSTAEFF-004 Harden manifest validation and empty-registry signaling

## Status
Completed

## Summary
The mod-manifest schema already rejects unknown content keys via `additionalProperties: false`, and `StatusEffectRegistry` already logs a warning when no registry entries exist (in all environments, including tests). We need regression coverage to ensure manifest loaders surface schema failures for stray content keys (e.g., `status-effects`) and that an injected, empty status-effect registry produces clear warnings while still falling back safely.

## Adjusted scope
- Add a ModManifestLoader unit test that demonstrates the loader propagates schema validation failures when a manifest includes an unknown content key (keeps existing schema behavior covered).
- Add a DamageTypeEffectsService unit test that shows an empty status-effect registry triggers warnings and falls back to built-in defaults.
- No runtime behavior changes beyond the added coverage.

## File list
- src/modding/modManifestLoader.js (test subject only)
- tests/unit/modding/modManifestLoader.coreBehavior.test.js
- tests/unit/modding/modManifestLoader.additionalHelpers.test.js
- src/anatomy/services/damageTypeEffectsService.js (test subject only)
- tests/unit/anatomy/services/damageTypeEffectsService.*.test.js

## Out of scope
- Changing manifest schema definitions beyond enforcing existing allowed keys.
- Altering runtime behavior for valid, populated registries.
- Introducing new configuration sources for status effects.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- tests/unit/modding/modManifestLoader.coreBehavior.test.js tests/unit/modding/modManifestLoader.additionalHelpers.test.js`
  - `npm run test:unit -- tests/unit/anatomy/services/damageTypeEffectsService.*.test.js`
- Invariants:
  - Valid manifests with supported keys continue to load without new warnings.
  - Status-effect registry fallback behavior remains unchanged when explicitly bypassing data (e.g., controlled test doubles).

## Outcome
- Added a ModManifestLoader unit test proving schema validation failures for unknown content keys are surfaced and logged with detail; no runtime loader changes were required because the schema already enforces allowed keys.
- Added a DamageTypeEffectsService unit test exercising the empty status-effect registry path to ensure the warning signaling stays loud while fallback defaults remain functional.
