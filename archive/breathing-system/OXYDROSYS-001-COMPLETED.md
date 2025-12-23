# OXYDROSYS-001: Create breathing mod manifest and directory structure

## Status: COMPLETED ✅

## Description

Initialize the breathing mod with its manifest file and basic directory structure.

## Files to Create

- `data/mods/breathing/mod-manifest.json`

## Files to Modify

- `data/game.json` - Add `"breathing"` to mods array

## Assumptions (Validated)

1. **`anatomy` mod is available**: Not directly in `game.json`, but loaded as a transitive dependency via mods like `violence`, `first-aid`, etc.
2. **`liquids-states` mod is available**: Not directly in `game.json`, but loaded as a transitive dependency via mods like `violence`, `liquids`, etc.
3. **Mod system loads dependencies transitively**: The engine resolves and loads all dependencies declared in mod manifests automatically.

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

## Outcome

### What Was Actually Changed

1. **Created breathing mod structure**:
   - `data/mods/breathing/mod-manifest.json` - Full manifest with dependencies on `core`, `anatomy`, `liquids-states`
   - `data/mods/breathing/components/` - Empty directory for future component definitions
   - `data/mods/breathing/entities/definitions/` - Empty directory for future entity definitions
   - `data/mods/breathing/rules/` - Empty directory for future rule definitions
   - `data/mods/breathing/events/` - Empty directory for future event definitions

2. **Modified `data/game.json`** - Added `"breathing"` to the mods array

### Discrepancies Found and Corrected

The original ticket incorrectly assumed that `anatomy` and `liquids-states` mods would be directly listed in `game.json`. Investigation revealed:

- These mods are loaded **transitively** via other mods (e.g., `violence` depends on both)
- The engine automatically resolves all dependencies declared in mod manifests
- The ticket's "Assumptions" section was corrected to document this actual behavior

### Validation Results

- `npm run validate` ✅ Passed (0 violations, expected "Unused dependencies" warning for empty content arrays)
- Integration tests for validateMods ✅ 13 tests passed
