# DYNLIGSTA-001 Remove light_sources component data

## Summary
Remove the locations:light_sources component definition and references in mod data/manifests, and switch runtime lighting to derive state dynamically from lit entities (including lit items in inventories).

## File list it expects to touch
- src/locations/services/lightingStateService.js
- data/mods/locations/components/light_sources.component.json
- data/mods/locations/mod-manifest.json
- data/mods/dredgers/entities/definitions/*.location.json (remove locations:light_sources where present)
- data/mods/lighting/rules/handle_ignite_light_source.rule.json
- data/mods/lighting/rules/handle_extinguish_light_source.rule.json
- tests/ (see Tests)

## Out of scope
- Changes to lighting:is_lit semantics.
- Inventory traversal beyond a single level (no nested containers).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- tests/unit/locations/services/lightingStateService.test.js --runInBand`
- `npm run test:unit -- tests/unit/mods/locations/components/lightingComponents.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/locations/modManifestValidation.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/dredgers/lightingComponents.integration.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js --runInBand`
- `npm run test:integration -- tests/integration/prompting/locationSummaryProviderLighting.integration.test.js --runInBand`

### Invariants that must remain true
- `locations:naturally_dark` remains unchanged and still marks ambient darkness.
- No new component schema is introduced as a replacement.
- Location definition JSON remains valid per existing schema rules.
- Lighting checks include lit entities in location inventories (single level).

## Status
Completed

## Outcome
- Removed the `locations:light_sources` component and references from location manifests/data.
- Updated lighting rules to stop mutating location light sources; runtime now derives lighting from lit entities and inventories.
- Adjusted unit/integration tests and fixtures to reflect the dynamic lighting model.
