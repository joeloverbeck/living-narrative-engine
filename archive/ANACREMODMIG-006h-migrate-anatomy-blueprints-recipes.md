# ANACREMODMIG-006h: Migrate Blueprints and Recipes from anatomy Mod

## Status: ✅ COMPLETED

## Summary
Move the 9 non-human blueprints and 9 non-human recipes from `anatomy` to `anatomy-creatures`, update their IDs, and update all internal references to entities, parts, and structure templates that were migrated in previous tickets.

## Outcome

### Migration Completed
All 9 non-human blueprints and 9 non-human recipes were successfully migrated to `anatomy-creatures` mod with proper namespace updates.

#### Blueprints Migrated (9)
- `cat_girl.blueprint.json` → `anatomy-creatures:cat_girl`
- `centaur_warrior.blueprint.json` → `anatomy-creatures:centaur_warrior`
- `giant_spider.blueprint.json` → `anatomy-creatures:giant_spider`
- `hen.blueprint.json` → `anatomy-creatures:hen`
- `kraken.blueprint.json` → `anatomy-creatures:kraken`
- `red_dragon.blueprint.json` → `anatomy-creatures:red_dragon`
- `rooster.blueprint.json` → `anatomy-creatures:rooster`
- `tortoise_person.blueprint.json` → `anatomy-creatures:tortoise_person`
- `writhing_observer.blueprint.json` → `anatomy-creatures:writhing_observer`

#### Recipes Migrated (9)
- `cat_girl.recipe.json` → `anatomy-creatures:cat_girl_standard`
- `centaur_warrior.recipe.json` → `anatomy-creatures:centaur_warrior`
- `giant_forest_spider.recipe.json` → `anatomy-creatures:giant_forest_spider`
- `hen.recipe.json` → `anatomy-creatures:hen`
- `kraken.recipe.json` → `anatomy-creatures:kraken_elder`
- `red_dragon.recipe.json` → `anatomy-creatures:red_dragon`
- `rooster.recipe.json` → `anatomy-creatures:rooster`
- `tortoise_person.recipe.json` → `anatomy-creatures:tortoise_person`
- `writhing_observer.recipe.json` → `anatomy-creatures:writhing_observer`

### Manifest Updated
`data/mods/anatomy-creatures/mod-manifest.json` now includes:
- 11 blueprints (9 migrated + 2 from dredgers)
- 9 recipes
- 3 parts (amphibian_core, feline_core, mustelid_core)
- 6 structure-templates
- 94 entity definitions

### Tests Added
- Extended `tests/integration/mods/anatomy-creatures/blueprintsLoading.test.js` with 91 new tests covering all 9 migrated blueprints
- Created `tests/integration/mods/anatomy-creatures/recipesLoading.test.js` with 67 tests covering all 9 migrated recipes

### Verification
- `npm run validate` passes (0 cross-reference violations)
- All 229 anatomy-creatures integration tests pass
- No remaining `anatomy:` namespace references for migrated creature content
- Humanoid references (`anatomy:humanoid_*`, `anatomy:human_*`) correctly preserved

### Namespace Transformation Applied
- Blueprint IDs: `anatomy:*` → `anatomy-creatures:*`
- Recipe IDs: `anatomy:*` → `anatomy-creatures:*`
- Root entity references: Updated to `anatomy-creatures:*`
- Structure template references: Updated to `anatomy-creatures:*`
- Compose part references: Updated to `anatomy-creatures:*`
- Slot preferId references: Updated for creature entities, preserved for humanoid entities
- Pattern preferId references: Updated for creature entities

---

## Original Ticket Content

### Files to Touch

#### Move - Blueprints (9 files)
| From | To |
|------|-----|
| `data/mods/anatomy/blueprints/cat_girl.blueprint.json` | `data/mods/anatomy-creatures/blueprints/cat_girl.blueprint.json` |
| `data/mods/anatomy/blueprints/centaur_warrior.blueprint.json` | `data/mods/anatomy-creatures/blueprints/centaur_warrior.blueprint.json` |
| `data/mods/anatomy/blueprints/giant_spider.blueprint.json` | `data/mods/anatomy-creatures/blueprints/giant_spider.blueprint.json` |
| `data/mods/anatomy/blueprints/hen.blueprint.json` | `data/mods/anatomy-creatures/blueprints/hen.blueprint.json` |
| `data/mods/anatomy/blueprints/kraken.blueprint.json` | `data/mods/anatomy-creatures/blueprints/kraken.blueprint.json` |
| `data/mods/anatomy/blueprints/red_dragon.blueprint.json` | `data/mods/anatomy-creatures/blueprints/red_dragon.blueprint.json` |
| `data/mods/anatomy/blueprints/rooster.blueprint.json` | `data/mods/anatomy-creatures/blueprints/rooster.blueprint.json` |
| `data/mods/anatomy/blueprints/tortoise_person.blueprint.json` | `data/mods/anatomy-creatures/blueprints/tortoise_person.blueprint.json` |
| `data/mods/anatomy/blueprints/writhing_observer.blueprint.json` | `data/mods/anatomy-creatures/blueprints/writhing_observer.blueprint.json` |

#### Move - Recipes (9 files)
| From | To |
|------|-----|
| `data/mods/anatomy/recipes/cat_girl.recipe.json` | `data/mods/anatomy-creatures/recipes/cat_girl.recipe.json` |
| `data/mods/anatomy/recipes/centaur_warrior.recipe.json` | `data/mods/anatomy-creatures/recipes/centaur_warrior.recipe.json` |
| `data/mods/anatomy/recipes/giant_forest_spider.recipe.json` | `data/mods/anatomy-creatures/recipes/giant_forest_spider.recipe.json` |
| `data/mods/anatomy/recipes/hen.recipe.json` | `data/mods/anatomy-creatures/recipes/hen.recipe.json` |
| `data/mods/anatomy/recipes/kraken.recipe.json` | `data/mods/anatomy-creatures/recipes/kraken.recipe.json` |
| `data/mods/anatomy/recipes/red_dragon.recipe.json` | `data/mods/anatomy-creatures/recipes/red_dragon.recipe.json` |
| `data/mods/anatomy/recipes/rooster.recipe.json` | `data/mods/anatomy-creatures/recipes/rooster.recipe.json` |
| `data/mods/anatomy/recipes/tortoise_person.recipe.json` | `data/mods/anatomy-creatures/recipes/tortoise_person.recipe.json` |
| `data/mods/anatomy/recipes/writhing_observer.recipe.json` | `data/mods/anatomy-creatures/recipes/writhing_observer.recipe.json` |

#### Modify
- All 18 moved files - Update `id` field and ALL internal references
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to blueprints and recipes content arrays

### ID Changes Required

#### Blueprint IDs
| Old ID | New ID |
|--------|--------|
| `anatomy:cat_girl` | `anatomy-creatures:cat_girl` |
| `anatomy:centaur_warrior` | `anatomy-creatures:centaur_warrior` |
| `anatomy:giant_spider` | `anatomy-creatures:giant_spider` |
| `anatomy:hen` | `anatomy-creatures:hen` |
| `anatomy:kraken` | `anatomy-creatures:kraken` |
| `anatomy:red_dragon` | `anatomy-creatures:red_dragon` |
| `anatomy:rooster` | `anatomy-creatures:rooster` |
| `anatomy:tortoise_person` | `anatomy-creatures:tortoise_person` |
| `anatomy:writhing_observer` | `anatomy-creatures:writhing_observer` |

#### Recipe IDs
| Old ID | New ID |
|--------|--------|
| `anatomy:cat_girl` | `anatomy-creatures:cat_girl` |
| `anatomy:centaur_warrior` | `anatomy-creatures:centaur_warrior` |
| `anatomy:giant_forest_spider` | `anatomy-creatures:giant_forest_spider` |
| `anatomy:hen` | `anatomy-creatures:hen` |
| `anatomy:kraken` | `anatomy-creatures:kraken` |
| `anatomy:red_dragon` | `anatomy-creatures:red_dragon` |
| `anatomy:rooster` | `anatomy-creatures:rooster` |
| `anatomy:tortoise_person` | `anatomy-creatures:tortoise_person` |
| `anatomy:writhing_observer` | `anatomy-creatures:writhing_observer` |

### Internal Reference Updates Required

ALL references within blueprints and recipes must be updated:
- `anatomy:feline_core` → `anatomy-creatures:feline_core`
- `anatomy:structure_*` → `anatomy-creatures:structure_*`
- `anatomy:cat_*` → `anatomy-creatures:cat_*`
- `anatomy:centaur_*` → `anatomy-creatures:centaur_*`
- `anatomy:dragon_*` → `anatomy-creatures:dragon_*`
- `anatomy:spider_*` → `anatomy-creatures:spider_*`
- `anatomy:tortoise_*` → `anatomy-creatures:tortoise_*`
- `anatomy:chicken_*` → `anatomy-creatures:chicken_*`
- `anatomy:kraken_*` → `anatomy-creatures:kraken_*`
- `anatomy:eldritch_*` → `anatomy-creatures:eldritch_*`
- `anatomy:horse_tail` → `anatomy-creatures:horse_tail`
- `anatomy:beak` → `anatomy-creatures:beak`
- (etc. for all migrated entity IDs)

### Files That Stay in anatomy Mod
- `human_female.blueprint.json` - humanoid
- `human_male.blueprint.json` - humanoid
- `human_futa.blueprint.json` - humanoid
- `human_female.recipe.json` - humanoid
- `human_male.recipe.json` - humanoid
- `human_futa.recipe.json` - humanoid

### Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify test files yet (ANACREMODMIG-012-015)
- DO NOT modify humanoid blueprints/recipes

### Acceptance Criteria

#### Tests that must pass
- `npm run validate` passes ✅
- `npm run typecheck` passes (pre-existing CLI errors unrelated to migration)

#### Invariants that must remain true
- Blueprint structure is preserved exactly ✅
- Recipe structure is preserved exactly ✅
- All internal references point to `anatomy-creatures:` namespace for migrated content ✅
- References to `anatomy:humanoid_*` or `core:*` remain unchanged ✅
- No dangling `anatomy:` references for migrated entities ✅
- Humanoid blueprints/recipes remain in anatomy mod ✅

### Verification Commands
```bash
# Validate JSON structure
npm run validate

# Verify no old namespace refs for migrated content
grep -r "anatomy:cat_\|anatomy:centaur_\|anatomy:dragon_\|anatomy:spider_\|anatomy:tortoise_\|anatomy:chicken_\|anatomy:kraken_\|anatomy:eldritch_\|anatomy:feline_core\|anatomy:structure_" data/mods/anatomy-creatures/ || echo "No old refs - GOOD"

# Count files
ls data/mods/anatomy-creatures/blueprints/*.blueprint.json | wc -l  # Should be 11 (9 + 2 from dredgers)
ls data/mods/anatomy-creatures/recipes/*.recipe.json | wc -l  # Should be 9
```

### Dependencies
- ANACREMODMIG-001 (mod scaffold)
- ANACREMODMIG-005 (feline_core part)
- ANACREMODMIG-006a (structure templates)
- ANACREMODMIG-006b through 006g (all entity definitions)

### Blocks
- ANACREMODMIG-010 (anatomy manifest update)
- ANACREMODMIG-012-015 (test updates)
