# LIGMOD-006: Lighting fixtures and action discovery tests

## Summary
Add action discovery coverage for ignite/extinguish using the existing lighting test fixtures.

## File List
- `tests/integration/mods/lighting/ignite_light_source_action_discovery.test.js`
- `tests/integration/mods/lighting/extinguish_light_source_action_discovery.test.js`

## Out of Scope
- Rule execution tests (already covered).
- Mod data or docs changes.
- Any changes outside `tests/integration/mods/lighting/` (fixtures already exist in `tests/common/mods/lighting/lightingFixtures.js`).

## Acceptance Criteria
### Tests
- `npm run test:integration -- tests/integration/mods/lighting/ignite_light_source_action_discovery.test.js`
- `npm run test:integration -- tests/integration/mods/lighting/extinguish_light_source_action_discovery.test.js`

### Invariants
- Fixtures expose the helper functions listed in the spec with the same names.
- Action discovery tests cover combustible vs electric fuel and inventory presence rules.
- Tests use `ModTestFixture.forAction('lighting', ...)`, register lighting scopes, and apply domain matchers per the mod testing guide.

## Assumptions (Reassessed)
- `tests/common/mods/lighting/lightingFixtures.js` already exists and matches the spec helper names.
- Reference action discovery pattern is `tests/integration/mods/items/aimItemActionDiscovery.test.js` (camelCase filename).
- Lighting action discovery requires registering custom lighting scopes in tests (not part of standard scope auto-registration).

## Status
Completed

## Outcome
- Added action discovery tests for ignite/extinguish using the existing lighting fixtures.
- Registered lighting scopes via `ScopeResolverHelpers.registerCustomScope` to match action discovery validation.
- No fixture changes were needed; scope updated to focus on new tests only.
