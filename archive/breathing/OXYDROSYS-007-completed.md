# OXYDROSYS-007: Add lung slots to humanoid anatomy

## Status: ✅ COMPLETED

**Completed**: 2024-12-24

## Description

Integrate lung slots into the humanoid anatomy system by modifying existing slot libraries, blueprint parts, blueprints, and recipes.

## Circular Dependency Resolution

**Issue Found**: The `breathing` mod depends on `anatomy`. Referencing `breathing:human_lung_*` entities from `anatomy` recipes would create a circular dependency. Additionally, lung entities require the `respiratory_organ` component which was in the `breathing` mod.

**Solution**:
1. Move lung entity files from `breathing` mod to `anatomy` mod with updated IDs (`anatomy:human_lung_*`)
2. Create new `breathing-states` mod (following existing `-states` mod pattern) with no dependencies
3. Move `respiratory_organ.component.json` from `breathing` to `breathing-states` with updated ID (`breathing-states:respiratory_organ`)
4. Add `breathing-states` as dependency to both `anatomy` and `breathing` mods
5. Update all component references from `breathing:respiratory_organ` to `breathing-states:respiratory_organ`

## Files Moved

- `data/mods/breathing/entities/definitions/human_lung_left.entity.json` → `data/mods/anatomy/entities/definitions/human_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/human_lung_right.entity.json` → `data/mods/anatomy/entities/definitions/human_lung_right.entity.json`

## Files Modified

- `data/mods/anatomy/libraries/humanoid.slot-library.json` - Added lung slot definitions
- `data/mods/anatomy/parts/humanoid_core.part.json` - Added lung slots referencing library
- `data/mods/anatomy/recipes/human_male.recipe.json` - Added lung slot preferences
- `data/mods/anatomy/recipes/human_female.recipe.json` - Added lung slot preferences
- `data/mods/anatomy/recipes/human_futa.recipe.json` - Added lung slot preferences
- `data/mods/anatomy/mod-manifest.json` - Added lung entity references and breathing-states dependency
- `data/mods/breathing/mod-manifest.json` - Removed lung entity references
- All human torso entity files - Added `lung_left_socket` and `lung_right_socket`

## Files Created

- `data/mods/breathing-states/mod-manifest.json`
- `data/mods/breathing-states/components/respiratory_organ.component.json`
- `tests/integration/anatomy/lungSlotIntegration.test.js`

## Acceptance Criteria - All Met

1. ✅ **Slot library updated**: `standard_lung_left` and `standard_lung_right` slots added to humanoid.slot-library.json
2. ✅ **Blueprint part updated**: humanoid_core.part.json references lung slots with `$use`
3. ✅ **Blueprints updated**: All human blueprints compose lung slots (via inheritance from humanoid_core)
4. ✅ **Recipes updated**: All human recipes specify `preferId: "anatomy:human_lung_left"` etc.
5. ✅ **Socket defined**: Lungs attach to torso via `lung_left_socket`, `lung_right_socket`
6. ✅ **Entities moved**: Lung entities relocated from `breathing` to `anatomy` mod with updated IDs
7. ✅ **Mod manifests updated**: Entity references moved between mod manifests

## Tests Passing

- ✅ Integration test: `tests/integration/anatomy/lungSlotIntegration.test.js` - All 7 tests pass
  - Human male anatomy generates with left and right lungs
  - Human female anatomy generates with both lungs
  - Human futa anatomy generates with both lungs
  - Lungs have correct `anatomy:part` subType ("lung") and orientation
  - Lungs have `breathing-states:respiratory_organ` component

## Invariants Verified

- ✅ All three human blueprints (male, female, futa) get identical lung configuration
- ✅ Existing anatomy structure unchanged except for lung additions
- ✅ Lungs nested under torso (not top-level)
