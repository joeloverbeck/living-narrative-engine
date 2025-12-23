# OXYDROSYS-001: Create breathing mod manifest and directory structure

## Description

Initialize the breathing mod with its manifest file and basic directory structure.

## Files to Create

- `data/mods/breathing/mod-manifest.json`

## Files to Modify

- `data/game.json` - Add `"breathing"` to mods array (after `anatomy` dependency)

## Out of Scope

- Component definitions (separate tickets)
- Entity definitions (separate tickets)
- Rules and events (separate tickets)
- Any JavaScript files

## Acceptance Criteria

1. **Schema validation passes**: `npm run validate` succeeds
2. **Mod loads without errors**: Application starts with breathing mod enabled
3. **Dependencies declared**: Mod declares dependencies on `core`, `anatomy`, `liquids-states`

## Tests That Must Pass

- `npm run validate` - Schema validation
- `npm run start` - Application boots without mod loading errors

## Invariants

- All existing mods continue to load correctly
- No changes to any existing mod's manifest
- Directory structure follows established patterns (components/, entities/definitions/, rules/, events/)
