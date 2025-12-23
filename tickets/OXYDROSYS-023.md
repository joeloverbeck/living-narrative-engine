# OXYDROSYS-023: Create strangling-states mod

## Description

Create the strangling-states mod with the being_strangled component.

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
2. **Component valid**: being_strangled passes schema validation
3. **Activity metadata**: Template `"{actor} is being strangled"`, priority 85
4. **Dependencies**: core only (minimal)

## Tests That Must Pass

- `npm run validate` - Schema validation
- Mod loads without errors

## Invariants

- Follows liquids-states pattern exactly
- Minimal mod (just marker component)
