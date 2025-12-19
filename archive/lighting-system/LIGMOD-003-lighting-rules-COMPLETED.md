# LIGMOD-003: Lighting rule execution

## Summary
Implement the ignite and extinguish rule definitions for lighting actions.

## Current State Check
- `data/mods/lighting/` already contains actions, components, conditions, and scopes.
- `data/mods/lighting/rules/` does not exist yet.
- No lighting-specific rule tests or fixtures exist yet.
- Lighting mod manifest is still absent; this ticket remains focused on rule execution and tests (loading via `ModTestFixture` is sufficient for coverage).
- `physical.light_change` is not a valid `perception_type` in the schema; use an allowed value while keeping the narrative text intact.

## File List
- `data/mods/lighting/rules/handle_ignite_light_source.rule.json`
- `data/mods/lighting/rules/handle_extinguish_light_source.rule.json`
- `tests/common/mods/lighting/lightingFixtures.js`
- `tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js`
- `tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js`

## Out of Scope
- Components, scopes, actions, conditions, or mod manifest.
- Documentation updates.
- Any gameplay data outside the lighting rules/fixtures/test coverage needed for this ticket.

## Acceptance Criteria
### Tests
- `npm run validate:fast`
- `npm run test:integration -- --runInBand tests/integration/mods/lighting`

### Invariants
- Rules listen to `core:attempt_action` and use the matching lighting conditions.
- Ignite adds `lighting:is_lit`, updates `lighting:active_light_sources`, and uses `push_unique`.
- Extinguish removes `lighting:is_lit` and uses `remove_by_value` on `lighting:active_light_sources.sources`.
- Perceptible event payloads and UI success messages match the spec text exactly.
- Perceptible events use a schema-valid `perception_type` (use `state.observable_change`).
- Turn ends with `success: true` for both actions.

## Status
Completed

## Outcome
- Added ignite/extinguish rule files plus lighting fixtures and integration tests.
- Adjusted `perception_type` to `state.observable_change` to satisfy schema constraints while keeping spec text intact.
