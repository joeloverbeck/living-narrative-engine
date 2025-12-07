# APPDAMDATDRIOPP-003: Define status-effect registry schema and defaults

## Status: Completed

Introduce data definitions (and schema) for damage-type/status-effect behaviors so mods can author thresholds, durations, stacking, and payload wiring without code edits.

## Updated assumptions from code/tests review
- Damage type definitions were removed (WEADAMCAPREF); weapons now embed damage entries via the `damage_capabilities` component validated by `damage-capability-entry.schema.json`, not `damage-type.schema.json`.
- `damageTypeEffectsService` still hardcodes component IDs, event IDs, effect order, and defaults (bleed severity map, burn stack defaults, fracture/dismember thresholds, stun duration). It consumes inline `damageEntry` config and expects `poison.tick`, not `tickDamage`, for input.
- No registry, schema, or manifest content type exists for status effects; `StaticConfiguration` only maps damage types, and the anatomy mod manifest cannot list status-effect data.
- Existing tests assert the hardcoded defaults and payload shapes; this ticket should seed data/registry/schema without refactoring the service (that happens in APPDAMDATDRIOPP-004).

## Scope (revised)
- Add a dedicated status-effect registry schema (do not extend `damage-type.schema.json`) that captures per-effect component/event IDs, default thresholds/durations/stacking, and the current application order for dismember → fracture → bleed → burn → poison.
- Seed canonical registry data for bleeding, burning, poisoned, fractured/stunned, and dismembered that mirrors the service defaults (bleed severity tickDamage 1/3/5 with baseDuration 2; burn dps 1, duration 2, stack count 1 when stacking; fracture threshold 0.5 with stun duration 1 and default chance 0; dismember threshold 0.8; poison tickDamage 1, duration 3, scope part).
- Implement a loader + registry accessor that ingests the status-effect registry file at startup via the existing mod content pipeline, storing it in the data registry for future consumers. Do not change `damageTypeEffectsService` behavior yet.
- Add focused schema/loader tests and ensure the new data is validated in `validate:quick`.

## Out of scope
- Changing runtime effect application logic or invocation order (handled in APPDAMDATDRIOPP-004).
- Renaming existing component IDs/events beyond what the schema requires for accurate defaults.
- Broad test rewrites beyond small unit/integration coverage for the new registry.

## Acceptance criteria
- Tests: Relevant schema/loader coverage passes (e.g., targeted unit/integration around the new registry) and `npm run validate:quick` succeeds with the new schema/data.
- Invariants: Registry defaults encode the same effect parameters and ordering as current code constants; no breaking changes to mod manifests or component IDs; damage entry consumption remains unchanged.

## Outcome
- Added a dedicated status-effect registry schema, loader wiring, and anatomy registry data seeded with existing bleed/burn/poison/fracture/dismember defaults and ordering.
- Introduced a simple registry accessor service while leaving `damageTypeEffectsService` unchanged for APPDAMDATDRIOPP-004 to consume.
- Extended manifest/configuration to load the new content type and added focused schema/loader/service tests alongside `validate:quick` coverage.
