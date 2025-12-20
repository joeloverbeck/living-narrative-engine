# DYNLIGSTA-003 Compute lighting dynamically in LightingStateService

## Summary
Update the lighting state service to derive lit status from entities in the location and one-level inventories, removing dependency on locations:light_sources.

## File list it expects to touch
- src/locations/services/lightingStateService.js

## Out of scope
- Mod data/component deletions
- Lighting rule updates
- Test updates beyond lighting state service unit tests
- Any inventory traversal beyond one level

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- tests/unit/locations/services/lightingStateService.test.js --runInBand`

### Invariants that must remain true
- If `locations:naturally_dark` is absent, the service returns `{ isLit: true, lightSources: [] }`.
- When naturally dark, lit status is true iff a lit entity is in the location or in a one-level inventory of a location entity.
- `lightSources` in the return value only contains entity IDs and is de-duplicated.
- No nested-container traversal is introduced.
