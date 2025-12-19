# LIGMOD-004: Lighting mod manifest and registration

## Summary
Create the lighting mod manifest and register the mod in game configuration if required. The lighting mod content (actions, components, rules, scopes, conditions) and its integration tests already exist; this ticket only covers manifest/registration alignment to the spec.

## Status
Completed

## File List
- `data/mods/lighting/mod-manifest.json`
- `data/game.json`

## Out of Scope
- Components, scopes, actions, conditions, or rules content.
- Documentation updates (spec calls out mod color scheme docs; track separately).
- Any changes outside `data/mods/lighting/` and `data/game.json`.

## Acceptance Criteria
### Tests
- `npm run validate:fast`
- `npm run test:integration -- tests/integration/mods/lighting/`

### Invariants
- Manifest content list matches the spec filenames and ordering.
- Manifest dependencies include `core` and `items` with the specified version range.
- If `data/game.json` is updated, only the lighting mod entry is added; no other mods or settings change.

## Outcome
Added the lighting mod manifest and registered `lighting` in `data/game.json` as planned; no changes were needed to existing lighting mod content or tests, and documentation updates remain out of scope.
