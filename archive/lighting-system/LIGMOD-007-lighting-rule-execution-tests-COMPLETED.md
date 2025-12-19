# LIGMOD-007: Lighting rule execution tests

## Summary
Audit and adjust integration tests for ignite/extinguish rule execution behavior.

## Current State Check
- Rule files and the rule execution tests already exist.
- Perceptible events use `state.observable_change` (schema-valid) rather than `physical.light_change`.

## File List
- `tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js`
- `tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js`

## Out of Scope
- Action discovery tests or fixtures.
- Mod data or docs changes.
- Any changes outside `tests/integration/mods/lighting/`.

## Acceptance Criteria
### Tests
- `npm run test:integration -- --runInBand tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js`
- `npm run test:integration -- --runInBand tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js`

### Invariants
- Tests assert `lighting:is_lit` add/remove behavior and `lighting:active_light_sources` updates.
- Tests verify perceptible event payloads and UI success messages match the spec text.
- Tests confirm perceptible events use `state.observable_change` (schema-valid).
- Tests confirm `END_TURN` is dispatched with `success: true`.

## Status
Completed

## Outcome
- Updated rule execution tests to assert `perceptionType` uses `state.observable_change`.
- Adjusted ticket expectations to reflect schema-valid perception types and run-in-band test invocation.
