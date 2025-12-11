# ANACREMODMIG-001: Create anatomy-creatures Mod Scaffold (COMPLETED)

## Summary
Set up the new `anatomy-creatures` mod shell (directories + manifest) without migrating any content yet. The manifest should align with the migration spec (creature content will move here in later tickets) but keep empty content arrays for now so validation passes with the current state where all creature data still lives under `anatomy` and `dredgers`.

## Assumptions Reassessed
- No `anatomy-creatures` mod currently exists; all creature content is still under `anatomy` and `dredgers` (see `specs/anatomy-creatures-mod-migration.spec.md`).
- This ticket only scaffolds the mod so future tickets can migrate the 120 referenced files; do **not** list files in the manifest yet because they have not moved.
- Dependency and version strings should follow existing mod conventions (`^1.0.0` ranges; `gameVersion` as `">=0.0.1"`).

## Files to Touch

### Create (New Files)
- `data/mods/anatomy-creatures/mod-manifest.json`
- `.gitkeep` placeholders inside each new empty directory so the scaffold is tracked

### Create (New Directories)
- `data/mods/anatomy-creatures/`
- `data/mods/anatomy-creatures/blueprints/`
- `data/mods/anatomy-creatures/recipes/`
- `data/mods/anatomy-creatures/parts/`
- `data/mods/anatomy-creatures/structure-templates/`
- `data/mods/anatomy-creatures/entities/`
- `data/mods/anatomy-creatures/entities/definitions/`

## Out of Scope
- DO NOT move any files yet
- DO NOT modify `data/game.json` yet (separate ticket)
- DO NOT modify `anatomy` or `dredgers` mod manifests yet
- DO NOT create any entity/blueprint/recipe files yet
- DO NOT populate the content arrays in manifest (leave empty or minimal placeholder)

## Implementation Details

Create `mod-manifest.json` with:
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "anatomy-creatures",
  "version": "1.0.0",
  "name": "Creature Anatomy",
  "description": "Non-human anatomy definitions including blueprints, recipes, and body part entities for various creature types: feline, centaur, dragon, spider, tortoise, avian, kraken/cephalopod, eldritch, amphibian, and mustelid creatures.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "anatomy", "version": "^1.0.0" }
  ],
  "content": {
    "blueprints": [],
    "recipes": [],
    "parts": [],
    "structure-templates": [],
    "entities": {
      "definitions": []
    }
  }
}
```

## Acceptance Criteria

### Tests that must pass
- `npm run validate` (validates new manifest against schema)
- `npm run test:unit` (regression check; no creature refs should change yet)
- `npm run typecheck` (no regressions)

### Invariants that must remain true
- Existing mods (`anatomy`, `dredgers`) remain unchanged
- `data/game.json` remains unchanged
- All existing tests pass without modification
- The new mod is NOT yet loaded by the game (not in game.json)

## Verification Commands
```bash
# Validate new manifest
npm run validate

# Ensure no regressions
npm run test:unit
npm run typecheck
```

## Dependencies
- None (this is the first ticket)

## Blocks
- All subsequent ANACREMODMIG tickets depend on this one

## Outcome
- Created `data/mods/anatomy-creatures/` scaffold with empty subdirectories and `.gitkeep` placeholders tracked.
- Added minimal `mod-manifest.json` with schema pointer, dependencies on `core` and `anatomy`, and empty content arrays (no content migration performed yet).
- No changes to existing mods or `data/game.json`; mod is not yet loaded.
- Validation succeeded; unit tests executed but failed only on pre-existing global coverage threshold; typecheck currently fails on longstanding validation CLI typings.
