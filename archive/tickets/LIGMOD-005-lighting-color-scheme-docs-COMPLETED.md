# LIGMOD-005: Lighting color scheme documentation

## Summary
Document the Warm Lantern Glow palette already used by the Lighting mod in the mod color scheme references.

## Status
Completed

## Current State
- The Lighting mod, actions, and visuals already exist under `data/mods/lighting/`.
- The action visuals already use the Warm Lantern Glow palette values from the spec.
- Lighting rule execution tests and fixtures already exist under `tests/integration/mods/lighting/` and `tests/common/mods/lighting/`.

## File List
- `docs/mods/mod-color-schemes-available.md`
- `docs/mods/mod-color-schemes-used.md`

## Out of Scope
- Any gameplay data or mod files.
- Creating new action discovery tests or fixtures (only run existing tests).
- Any changes outside `docs/mods/` and this ticket file.

## Acceptance Criteria
### Tests
- Run the existing Lighting integration tests to confirm no regressions:
  - `npm run test:integration -- --runInBand tests/integration/mods/lighting/`

### Invariants
- The palette values and contrast ratios match the spec exactly.
- The new section is labeled "Illumination/Lighting Colors" and references Warm Lantern Glow.
- The quick reference table entry uses `Lighting | Warm Lantern Glow | 22.1 | #8B5A2B | Active`.
- Since Warm Lantern Glow is already in use, update the "Current Status" counts in both docs and add the definition only to `mod-color-schemes-used.md` (do not list it as available).

## Outcome
- Updated `docs/mods/mod-color-schemes-used.md` with the Lighting assignment, section 22.1 definition, and current status counts.
- Updated `docs/mods/mod-color-schemes-available.md` current status counts without adding the scheme to the available list.
- No mod or gameplay data changes were required (scheme already implemented in Lighting actions).
