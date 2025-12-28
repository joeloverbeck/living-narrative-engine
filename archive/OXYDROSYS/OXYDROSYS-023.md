# OXYDROSYS-023: Create strangling-states mod

## Description

Create the strangling-states mod with a minimal being_strangled marker component.

## Assumptions (Updated)

- There is no `positioning` mod in this repo; the marker will live under the `strangling-states` namespace.
- No existing mod depends on `strangling-states` yet, so the mod is added directly to `data/game.json` to ensure it loads.

## Files to Create

- `data/mods/strangling-states/mod-manifest.json`
- `data/mods/strangling-states/components/being_strangled.component.json`

## Files to Modify

- `data/game.json` - Add `"strangling-states"` to mods array

## Out of Scope

- Strangle action (separate ticket)
- Release/break free actions

## Acceptance Criteria

1. **Mod structure**: Follows *-states mod pattern (like liquids-states)
2. **Component valid**: `strangling-states:being_strangled` passes schema validation
3. **Activity metadata**: Template `"{actor} is being strangled"`, priority 85
4. **Dependencies**: core only (minimal)

## Tests That Must Pass

- `npm run validate` - Schema validation
- Mod loads without errors

## Invariants

- Follows liquids-states pattern exactly
- Minimal mod (just marker component)

## Status

- [ ] In Progress
- [x] Completed

## Outcome

- Created the strangling-states mod and being_strangled marker component.
- Added the mod to `data/game.json` for loading until a parent mod depends on it.
