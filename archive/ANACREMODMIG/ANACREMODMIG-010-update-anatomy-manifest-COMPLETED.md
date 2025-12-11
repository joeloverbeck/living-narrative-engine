# ANACREMODMIG-010: Update anatomy Mod Manifest

## Summary
Update `data/mods/anatomy/mod-manifest.json` to stop loading creature anatomy that has already been migrated into `anatomy-creatures` (blueprints, recipes, parts, structure-templates, entities). The content still exists in `data/mods/anatomy/`, but only the manifest needs to drop the references.

## Status
Completed

## Files to Touch

### Modify
- `data/mods/anatomy/mod-manifest.json`

## Content to Remove

### Remove from `content.blueprints` (9 entries)
- `blueprints/cat_girl.blueprint.json`
- `blueprints/centaur_warrior.blueprint.json`
- `blueprints/giant_spider.blueprint.json`
- `blueprints/hen.blueprint.json`
- `blueprints/kraken.blueprint.json`
- `blueprints/red_dragon.blueprint.json`
- `blueprints/rooster.blueprint.json`
- `blueprints/tortoise_person.blueprint.json`
- `blueprints/writhing_observer.blueprint.json`

### Remove from `content.recipes` (9 entries)
- `recipes/cat_girl.recipe.json`
- `recipes/centaur_warrior.recipe.json`
- `recipes/giant_forest_spider.recipe.json`
- `recipes/hen.recipe.json`
- `recipes/kraken.recipe.json`
- `recipes/red_dragon.recipe.json`
- `recipes/rooster.recipe.json`
- `recipes/tortoise_person.recipe.json`
- `recipes/writhing_observer.recipe.json`

### Remove from `content.parts` (1 entry)
- `parts/feline_core.part.json`

### Remove from `content.structure-templates` (6 entries - entire section if all moved)
- `structure-templates/structure_arachnid_8leg.structure-template.json`
- `structure-templates/structure_centauroid.structure-template.json`
- `structure-templates/structure_eldritch_abomination.structure-template.json`
- `structure-templates/structure_octopoid.structure-template.json`
- `structure-templates/structure_tortoise_biped.structure-template.json`
- `structure-templates/structure_winged_quadruped.structure-template.json`

### Remove from `content.entities.definitions` (85 entries)
All creature entity definitions that were migrated:
- All `cat_*`, `feline_*` entities (7)
- All `centaur_*` entities (5)
- All `dragon_*` entities (5)
- All `spider_*` entities (5)
- All `tortoise_*` entities (11)
- All `chicken_*` entities (27)
- All `kraken_*`, `octopus_*`, `squid_*`, `ink_reservoir` entities (8)
- All `eldritch_*` entities (15)
- `horse_tail.entity.json` (1)
- `beak.entity.json` (1)

## Content That Must Stay in anatomy Manifest

### Blueprints (stay)
- `blueprints/human_female.blueprint.json`
- `blueprints/human_male.blueprint.json`
- `blueprints/human_futa.blueprint.json`

### Recipes (stay)
- `recipes/human_female.recipe.json`
- `recipes/human_male.recipe.json`
- `recipes/human_futa.recipe.json`

### Parts (stay)
- `parts/humanoid_core.part.json`

### Libraries (stay)
- `libraries/humanoid.slot-library.json` (critical - referenced by anatomy-creatures parts)

### Components (stay)
- All anatomy component definitions

### Entities (stay)
- All humanoid body part entities (head, torso, arms, legs, hands, feet, etc.)
- All human-specific variant entities

## Out of Scope
- DO NOT add anatomy-creatures as dependency (anatomy doesn't depend on it)
- DO NOT modify any remaining content files
- DO NOT delete empty directories yet

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` currently fails repository-wide due to existing JS-to-TS typing issues in validation scripts; record the result for visibility

### Invariants that must remain true
- anatomy mod still contains all humanoid content
- `humanoid.slot-library.json` library remains (critical for anatomy-creatures parts)
- `humanoid_core` part remains
- Human blueprints and recipes remain
- No content paths point to non-existent files

## Verification Commands
```bash
# Validate manifest
npm run validate

# Verify humanoid content remains
cat data/mods/anatomy/mod-manifest.json | grep "human_"

# Verify humanoid slot library remains
cat data/mods/anatomy/mod-manifest.json | grep "humanoid\\.slot-library.json"

# Verify creature content removed
cat data/mods/anatomy/mod-manifest.json | grep -E "cat_girl|centaur|dragon|spider|tortoise|chicken|kraken|eldritch" && echo "ERROR: Creature content still present" || echo "Creature content removed - GOOD"

# Count remaining blueprints (should be 3)
cat data/mods/anatomy/mod-manifest.json | grep -c "blueprint.json"
```

## Outcome
- Removed all creature anatomy references from `anatomy` manifest (blueprints, recipes, parts, structure templates, entity definitions) while keeping humanoid content and the `humanoid.slot-library.json` reference.
- Validation now passes with anatomy loading only humanoid assets; typecheck remains failing for pre-existing validation script typing errors (unchanged by this work).

## Dependencies
- ANACREMODMIG-005 (feline_core part migrated)
- ANACREMODMIG-006a through 006h (all anatomy content migrated)

## Blocks
- None directly, but should be completed before final validation
