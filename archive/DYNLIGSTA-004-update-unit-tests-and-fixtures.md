# DYNLIGSTA-004 Update unit tests and fixtures for dynamic lighting

## Summary
Align unit tests and shared fixtures with the removal of locations:light_sources and the new dynamic lighting behavior.

## File list it expects to touch
- tests/unit/locations/services/lightingStateService.test.js
- tests/unit/mods/locations/components/lightingComponents.test.js
- tests/common/mods/lighting/lightingFixtures.js

## Out of scope
- Integration test updates (handled in a separate ticket)
- Runtime lighting logic changes in src/
- Mod data changes in data/mods/

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- tests/unit/locations/services/lightingStateService.test.js --runInBand`
- `npm run test:unit -- tests/unit/mods/locations/components/lightingComponents.test.js --runInBand`

### Invariants that must remain true
- Unit tests no longer reference `locations:light_sources`.
- Fixtures used across suites still produce valid entity/component structures.
- New tests cover lit entities in location and lit entities inside a one-level inventory.
