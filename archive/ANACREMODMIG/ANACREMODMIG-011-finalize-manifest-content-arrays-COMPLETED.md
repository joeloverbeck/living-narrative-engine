# ANACREMODMIG-011: Finalize anatomy-creatures Manifest Content Arrays

## Status
Completed — manifest already aligns with on-disk content; ticket corrected to match actual counts.

## Summary
Ensure the `anatomy-creatures` mod-manifest.json stays complete and accurate. The current manifest already matches the on-disk files; this ticket now confirms the final counts (total 120 content entries, including 91 entity definitions: 85 migrated from `anatomy` + 6 from `dredgers`) and keeps the arrays in sync/alphabetical.

## Files to Touch

### Modify
- `data/mods/anatomy-creatures/mod-manifest.json`

## Expected Final Content

### Blueprints (11 total)
```json
"blueprints": [
  "blueprints/cat_girl.blueprint.json",
  "blueprints/centaur_warrior.blueprint.json",
  "blueprints/ermine_folk_female.blueprint.json",
  "blueprints/giant_spider.blueprint.json",
  "blueprints/hen.blueprint.json",
  "blueprints/kraken.blueprint.json",
  "blueprints/red_dragon.blueprint.json",
  "blueprints/rooster.blueprint.json",
  "blueprints/toad_folk_male.blueprint.json",
  "blueprints/tortoise_person.blueprint.json",
  "blueprints/writhing_observer.blueprint.json"
]
```

### Recipes (9 total)
```json
"recipes": [
  "recipes/cat_girl.recipe.json",
  "recipes/centaur_warrior.recipe.json",
  "recipes/giant_forest_spider.recipe.json",
  "recipes/hen.recipe.json",
  "recipes/kraken.recipe.json",
  "recipes/red_dragon.recipe.json",
  "recipes/rooster.recipe.json",
  "recipes/tortoise_person.recipe.json",
  "recipes/writhing_observer.recipe.json"
]
```

### Parts (3 total)
```json
"parts": [
  "parts/amphibian_core.part.json",
  "parts/feline_core.part.json",
  "parts/mustelid_core.part.json"
]
```

### Structure Templates (6 total)
```json
"structure-templates": [
  "structure-templates/structure_arachnid_8leg.structure-template.json",
  "structure-templates/structure_centauroid.structure-template.json",
  "structure-templates/structure_eldritch_abomination.structure-template.json",
  "structure-templates/structure_octopoid.structure-template.json",
  "structure-templates/structure_tortoise_biped.structure-template.json",
  "structure-templates/structure_winged_quadruped.structure-template.json"
]
```

### Entity Definitions (91 total)
85 migrated from `anatomy` + 6 migrated from `dredgers`. All entity definition files are already listed in manifest; keep the list alphabetical and in sync with `data/mods/anatomy-creatures/entities/definitions/`.

## Out of Scope
- DO NOT create or modify any entity/blueprint/recipe/part files
- DO NOT modify other mod manifests
- This ticket only ensures the manifest content arrays are complete

## Implementation Notes
- Cross-reference against actual files in `data/mods/anatomy-creatures/`
- Ensure alphabetical ordering for maintainability
- Verify file paths match actual file locations

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- All content files referenced in manifest exist
- No extra files in directories that aren't in manifest

### Invariants that must remain true
- Every file in anatomy-creatures directories is listed in manifest
- Every manifest entry points to an existing file
- File count matches: 11 blueprints, 9 recipes, 3 parts, 6 templates, 91 entities (85 from anatomy + 6 from dredgers)

## Verification Commands
```bash
# Validate manifest
npm run validate

# Count actual files vs manifest entries
echo "Blueprints:"
ls data/mods/anatomy-creatures/blueprints/*.blueprint.json | wc -l  # Should be 11

echo "Recipes:"
ls data/mods/anatomy-creatures/recipes/*.recipe.json | wc -l  # Should be 9

echo "Parts:"
ls data/mods/anatomy-creatures/parts/*.part.json | wc -l  # Should be 3

echo "Structure Templates:"
ls data/mods/anatomy-creatures/structure-templates/*.structure-template.json | wc -l  # Should be 6

echo "Entities:"
ls data/mods/anatomy-creatures/entities/definitions/*.entity.json | wc -l  # Should be 91

# Verify no missing files
npm run validate 2>&1 | grep -i "not found" && echo "ERROR: Missing files" || echo "All files found - GOOD"
```

## Dependencies
- ANACREMODMIG-002 through 006h (all content must be migrated first)

## Blocks
- ANACREMODMIG-009 (game.json update should happen after manifest is finalized)

## Outcome
- Ticket assumptions corrected: anatomy-creatures manifest holds 91 entity definitions (85 from anatomy + 6 from dredgers), not 85.
- Manifest already complete and aligned with on-disk files; no content changes were required.
- Validation confirmed via `npm run validate`.
