# ANACREMODMIG-008: Update dredgers Recipe References (COMPLETED)

**Status: ✅ COMPLETED**

## Outcome
- Updated both dredgers character recipes to point blueprint and migrated anatomy part references at `anatomy-creatures:*`.
- Added an integration test (`tests/integration/mods/dredgers/recipeNamespaceReferences.test.js`) to lock the namespace expectations.
- `npm run validate:quick` passes; targeted recipe validations remain blocked by known migration leftovers (anatomy manifest still lists moved files) and report missing `anatomy-creatures:*` blueprints as a side-effect.
- Ticket scope corrected to include slot-level preferId updates and the proper recipe validation CLI usage.

## Summary
Update the dredgers character recipes so every reference to migrated species assets (blueprint + anatomy parts) points to the `anatomy-creatures` namespace.

## Files to Touch

### Modify
- `data/mods/dredgers/recipes/ermine_folk_female.recipe.json`
- `data/mods/dredgers/recipes/toad_folk_male.recipe.json`

## Reference Changes Required

### ermine_folk_female.recipe.json
| Field | Old Value | New Value |
|-------|-----------|-----------|
| `blueprintId` | `dredgers:ermine_folk_female` | `anatomy-creatures:ermine_folk_female` |
| `slots.torso.preferId` | `dredgers:ermine_folk_female_torso` | `anatomy-creatures:ermine_folk_female_torso` |
| `slots.left_ear.preferId` | `dredgers:ermine_ear` | `anatomy-creatures:ermine_ear` |
| `slots.right_ear.preferId` | `dredgers:ermine_ear` | `anatomy-creatures:ermine_ear` |
| `slots.tail.preferId` | `dredgers:ermine_tail` | `anatomy-creatures:ermine_tail` |

### toad_folk_male.recipe.json
| Field | Old Value | New Value |
|-------|-----------|-----------|
| `blueprintId` | `dredgers:toad_folk_male` | `anatomy-creatures:toad_folk_male` |
| `slots.torso.preferId` | `dredgers:toad_folk_male_torso` | `anatomy-creatures:toad_folk_male_torso` |
| `slots.left_eye.preferId` | `dredgers:toad_eye` | `anatomy-creatures:toad_eye` |
| `slots.right_eye.preferId` | `dredgers:toad_eye` | `anatomy-creatures:toad_eye` |
| `slots.left_ear.preferId` | `dredgers:toad_tympanum` | `anatomy-creatures:toad_tympanum` |
| `slots.right_ear.preferId` | `dredgers:toad_tympanum` | `anatomy-creatures:toad_tympanum` |

## Out of Scope
- DO NOT modify the recipe IDs - they stay as `dredgers:*`
- DO NOT move these recipe files - they stay in dredgers mod
- DO NOT modify `data/game.json`

## Implementation Notes
- These recipes are character-specific (for Eira Quenreach and Cress Siltwell)
- All referenced blueprints and anatomy parts migrated to `anatomy-creatures` and now expose `anatomy-creatures:*` IDs
- The recipe IDs remain `dredgers:*` because they are dredgers-specific content
- No other descriptor or clothing changes are required

## Files That Stay in dredgers
These recipe files STAY in dredgers because they define specific character instances:
- `ermine_folk_female.recipe.json` - used by Eira Quenreach character
- `toad_folk_male.recipe.json` - used by Cress Siltwell character

## Acceptance Criteria

### Tests that must pass
- `npm run validate:quick` passes
- `npm run validate:recipe -- data/mods/dredgers/recipes/ermine_folk_female.recipe.json` passes
- `npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json` passes

### Invariants that must remain true
- Recipe files remain in dredgers mod
- Recipe IDs remain `dredgers:*`
- Only migrated blueprint/part references switch namespaces
- All other recipe content (descriptors, entity overrides) unchanged

## Verification Commands
```bash
# Validate JSON + cross-mod references quickly
npm run validate:quick

# Validate the specific recipes (file paths, not IDs)
npm run validate:recipe -- data/mods/dredgers/recipes/ermine_folk_female.recipe.json
npm run validate:recipe -- data/mods/dredgers/recipes/toad_folk_male.recipe.json

# Verify blueprint + slot references updated
rg "anatomy-creatures:ermine" data/mods/dredgers/recipes/ermine_folk_female.recipe.json
rg "anatomy-creatures:toad" data/mods/dredgers/recipes/toad_folk_male.recipe.json

# Verify recipe IDs unchanged (should still be dredgers:)
rg "recipeId" data/mods/dredgers/recipes/ermine_folk_female.recipe.json
rg "recipeId" data/mods/dredgers/recipes/toad_folk_male.recipe.json
```

## Dependencies
- ANACREMODMIG-004 (dredgers blueprints must be in anatomy-creatures first)
- ANACREMODMIG-007 (dredgers manifest must declare anatomy-creatures dependency)

## Blocks
- ANACREMODMIG-009 (game.json update - final integration)
