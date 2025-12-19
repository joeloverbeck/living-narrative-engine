# LIGMOD-001: Lighting mod scaffolding, components, and scopes

## Summary
Create the lighting mod directory structure and add the core component and scope definitions.

## Status
Completed

## Assumptions (reassessed)
- No existing `data/mods/lighting/` content is present yet.
- The component schemas should match `specs/lighting-mod-spec.md`, including `fuelType` enums for electricity and magic.
- Scopes should only return combustible fuel types (oil, candle, wood, coal, gas) per spec, excluding electricity.

## File List
- `data/mods/lighting/components/is_light_source.component.json`
- `data/mods/lighting/components/is_lit.component.json`
- `data/mods/lighting/components/active_light_sources.component.json`
- `data/mods/lighting/scopes/unlit_combustible_light_sources_in_inventory.scope`
- `data/mods/lighting/scopes/lit_combustible_light_sources_in_inventory.scope`

## Out of Scope
- Actions, conditions, rules, or mod manifest.
- New tests or fixtures (validation-only).
- Documentation updates.
- Any changes outside `data/mods/lighting/`.

## Acceptance Criteria
### Tests
- `npm run validate:fast`

### Invariants
- `lighting:is_light_source` schema matches the spec enum and requires `fuelType`.
- `lighting:is_lit` remains a marker component with no properties.
- `lighting:active_light_sources.sources` uses the ID pattern from the spec.
- Scopes include only combustible fuel types (`oil`, `candle`, `wood`, `coal`, `gas`) and exclude electricity.
- Scopes filter inventory items based on `lighting:is_light_source` and `lighting:is_lit` presence per spec.

## Outcome
- Created the lighting mod scaffolding with component and scope definitions only, matching the spec enums and scope filters.
- No actions, rules, manifests, or docs were added (as originally planned).
