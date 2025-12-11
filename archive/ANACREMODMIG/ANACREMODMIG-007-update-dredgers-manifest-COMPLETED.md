# ANACREMODMIG-007: Update dredgers Mod Manifest

## Summary
Clean up `dredgers/mod-manifest.json` by removing the creature anatomy files that already moved to `anatomy-creatures`, and declare `anatomy-creatures` as a dependency so dredgers content can rely on those migrated assets.

## Status
Completed

## Files to Touch

### Modify
- `data/mods/dredgers/mod-manifest.json`

## Changes Required

### Add Dependency
Add to the `dependencies` array (dependencies currently use caret ranges):
```json
{ "id": "anatomy-creatures", "version": "^1.0.0" }
```

### Remove from Content

Remove the following migrated creature anatomy entries from the manifest content arrays (paths in this manifest omit the subfolders):

- From `content.blueprints`:
  - `ermine_folk_female.blueprint.json`
  - `toad_folk_male.blueprint.json`
- From `content.entities.definitions`:
  - `ermine_ear.entity.json`
  - `ermine_folk_female_torso.entity.json`
  - `ermine_tail.entity.json`
  - `toad_eye.entity.json`
  - `toad_folk_male_torso.entity.json`
  - `toad_tympanum.entity.json`
- From `content.parts`:
  - `amphibian_core.part.json`
  - `mustelid_core.part.json`

## Files That Must Stay in dredgers Manifest
- `recipes/ermine_folk_female.recipe.json` - character-specific
- `recipes/toad_folk_male.recipe.json` - character-specific
- `entities/definitions/cress_siltwell.character.json` - character instance
- `entities/definitions/eira_quenreach.character.json` - character instance
- `entities/definitions/mudsong_vane.character.json` - character instance
- `entities/definitions/canal_vestibule.location.json` - location
- `entities/definitions/concordance_salon.location.json` - location
- Portraits and any other dredgers-specific content already present

## Out of Scope
- DO NOT modify `data/game.json` yet (ANACREMODMIG-009)
- DO NOT modify recipe files yet (ANACREMODMIG-008)
- DO NOT delete empty directories (if any remain)
- DO NOT modify any entity or blueprint JSON files

## Expected Manifest Structure After Changes
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "dredgers",
  "version": "...",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "anatomy", "version": "^1.0.0" },
    { "id": "descriptors", "version": "^1.0.0" },
    { "id": "skills", "version": "^1.0.0" },
    { "id": "accessories", "version": "^1.0.0" },
    { "id": "base-clothing", "version": "^1.0.0" },
    { "id": "outer-clothing", "version": "^1.0.0" },
    { "id": "fantasy", "version": "^1.0.0" },
    { "id": "anatomy-creatures", "version": "^1.0.0" }
  ],
  "content": {
    "actions": [],
    "components": [],
    "conditions": [],
    "rules": [],
    "entities": {
      "definitions": [
        "canal_vestibule.location.json",
        "concordance_salon.location.json",
        "cress_siltwell.character.json",
        "eira_quenreach.character.json",
        "mudsong_vane.character.json"
      ],
      "instances": [
        "cress_siltwell.character.json",
        "eira_quenreach.character.json"
      ]
    },
    "events": [],
    "macros": [],
    "scopes": [],
    "blueprints": [],
    "parts": [],
    "recipes": [
      "ermine_folk_female.recipe.json",
      "toad_folk_male.recipe.json"
    ],
    "portraits": [
      "canal_vestibule.png",
      "concordance_salon.png",
      "eira_quenreach.png"
    ],
    "worlds": []
  }
}
```

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes (catches manifest reference errors)
- `npm run test:integration --runInBand tests/integration/mods/dredgers/toadEyeEntityLoading.test.js tests/integration/mods/dredgers/toadTympanumEntityLoading.test.js` passes (ensures IDs still resolve)

### Invariants that must remain true
- dredgers mod still declares all character-specific content
- dredgers mod depends on anatomy-creatures (for blueprints referenced by recipes)
- No content paths point to non-existent files
- All existing dredgers-specific content remains declared

## Verification Commands
```bash
# Validate manifest
npm run validate

# Verify dependency added
cat data/mods/dredgers/mod-manifest.json | grep "anatomy-creatures"

# Verify migrated content removed
cat data/mods/dredgers/mod-manifest.json | grep -E "ermine_ear|toad_eye|amphibian_core" && echo "ERROR: Still has migrated refs" || echo "Migrated content removed - GOOD"

# Verify character content remains
cat data/mods/dredgers/mod-manifest.json | grep "cress_siltwell"
```

## Outcome
- Removed migrated creature anatomy entries from the dredgers manifest and added the new `anatomy-creatures` dependency using the caret version range.
- Updated dredgers toad anatomy integration tests to load the anatomy-creatures versions so coverage matches the migrated assets.

## Dependencies
- ANACREMODMIG-002 (parts migrated)
- ANACREMODMIG-003 (entities migrated)
- ANACREMODMIG-004 (blueprints migrated)

## Blocks
- ANACREMODMIG-008 (recipe reference updates depend on manifest being correct)
- ANACREMODMIG-009 (game.json update)
