# DYNLIGSTA-005 Update integration tests for dynamic lighting

## Summary
Adjust integration tests to remove expectations around locations:light_sources and verify lighting behavior derived from lit entities and inventories.

## File list it expects to touch
- tests/integration/mods/locations/modManifestValidation.test.js
- tests/integration/mods/dredgers/lightingComponents.integration.test.js
- tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js
- tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js
- tests/integration/prompting/locationSummaryProviderLighting.integration.test.js

## Out of scope
- Unit test updates (handled in a separate ticket)
- Data/model changes in data/mods/
- Runtime lighting computation changes in src/

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- tests/integration/mods/locations/modManifestValidation.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/dredgers/lightingComponents.integration.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js --runInBand`
- `npm run test:integration -- tests/integration/prompting/locationSummaryProviderLighting.integration.test.js --runInBand`

### Invariants that must remain true
- Integration tests no longer assert any presence or mutation of `locations:light_sources`.
- Prompting/location summary lighting still reflects the lighting state service output.
- Ignition/extinguish flows continue to toggle `lighting:is_lit` only.
