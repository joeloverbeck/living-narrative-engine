# Specification: anatomy-creatures Mod Migration

## Status: ✅ COMPLETED

## Overview

This specification documents the migration of all non-human anatomy files from the `anatomy` mod and the `dredgers` mod into a new dedicated `anatomy-creatures` mod. The purpose is to separate creature-specific anatomy definitions from the core humanoid anatomy system, improving maintainability and enabling better modular organization.

## Motivation

Previously, non-human anatomy content was scattered across two locations:
1. **anatomy mod** - Contained mixed humanoid and creature content (blueprints, recipes, entities, parts, structure-templates)
2. **dredgers mod** - Contained creature anatomy files (ermine_folk, toad_folk) that are reusable species definitions mixed with character-specific content

This migration achieved:
- Clean separation of concerns: humanoid anatomy vs creature anatomy
- Allow the `dredgers` mod to focus purely on scenario-specific content (characters, locations, recipes)
- Enable future creature mods to depend on `anatomy-creatures` without pulling in all humanoid anatomy
- Improve discoverability of creature anatomy resources

## Final File Counts

| Category | Count |
|----------|-------|
| Blueprints | 11 |
| Recipes | 9 |
| Parts | 3 |
| Structure Templates | 6 |
| Entity Definitions | 91 |
| **TOTAL MIGRATED** | **120** |

Note: Entity count was 91 (not 85 as originally estimated).

## Migration Summary

### Files Migrated from dredgers
- 2 blueprints (ermine_folk_female, toad_folk_male)
- 6 entity definitions (ermine_ear, ermine_tail, ermine_folk_female_torso, toad_eye, toad_tympanum, toad_folk_male_torso)
- 2 parts (amphibian_core, mustelid_core)

### Files Migrated from anatomy
- 9 blueprints (cat_girl, centaur_warrior, giant_spider, hen, kraken, red_dragon, rooster, tortoise_person, writhing_observer)
- 9 recipes (corresponding to blueprints)
- 1 part (feline_core)
- 6 structure templates (arachnid_8leg, centauroid, eldritch_abomination, octopoid, tortoise_biped, winged_quadruped)
- 91 entity definitions (feline, centaur, dragon, spider, tortoise, chicken/avian, kraken/cephalopod, eldritch, horse, misc)

### Files That Stayed in dredgers
- Character-specific recipes (ermine_folk_female.recipe.json, toad_folk_male.recipe.json) - These define specific characters
- Character instances (eira_quenreach.character.json, cress_siltwell.character.json)
- Location definitions (canal_vestibule.location.json, concordance_salon.location.json)

### Files That Stayed in anatomy
- Humanoid content (human_male, human_female, human_futa blueprints/recipes)
- Core part definitions (humanoid_core.part.json)
- Shared components and libraries

## ID Changes Applied

### From dredgers namespace
`dredgers:*` → `anatomy-creatures:*` for all migrated blueprints, entities, and parts

### From anatomy namespace
`anatomy:*` → `anatomy-creatures:*` for all migrated blueprints, recipes, entities, parts, and structure-templates

## Dependencies Updated

### anatomy-creatures mod
- Depends on: `core` (1.0.0), `anatomy` (1.0.0)

### dredgers mod
- Added dependency: `anatomy-creatures` (1.0.0)
- Updated recipe references to use `anatomy-creatures:` namespace

### fantasy mod
- Updated creature entity references (feline_eye_*, hen, rooster) to use `anatomy-creatures:` namespace

### patrol mod
- Updated character entity references (creature anatomy) to use `anatomy-creatures:` namespace

## Test Updates Applied

### Integration Tests
- Updated file paths from `data/mods/anatomy/` to `data/mods/anatomy-creatures/`
- Updated entity IDs from `anatomy:creature_*` to `anatomy-creatures:creature_*`
- Updated `anatomyIntegrationTestBed.js` with new namespace references

### Source Code Fixes
- Fixed hardcoded entity IDs in `partSelectionService.js` (dragon_wing, kraken_head, kraken_tentacle)

## Final Mod Structure

```
data/mods/anatomy-creatures/
├── mod-manifest.json
├── blueprints/ (11 files)
├── recipes/ (9 files)
├── parts/ (3 files)
├── structure-templates/ (6 files)
└── entities/definitions/ (91 files)
```

## Validation Results

- ✅ All 120 files migrated with correct namespace
- ✅ All manifests updated correctly
- ✅ All unit tests pass (4238 tests)
- ✅ All integration tests pass (2198+ tests)
- ✅ No dangling references in production mod files

## Outcome

The anatomy-creatures mod migration is complete and successful. All creature anatomy content has been cleanly separated from the humanoid anatomy system.

---
**Started**: 2025-12-10
**Completed**: 2025-12-11
**Archived**: 2025-12-11
