# OXYDROSYS-007: Add lung slots to humanoid anatomy

## Description

Integrate lung slots into the humanoid anatomy system by modifying existing slot libraries, blueprint parts, blueprints, and recipes.

## Files to Create

- None

## Files to Modify

- `data/mods/anatomy/libraries/humanoid.slot-library.json` - Add lung slot definitions
- `data/mods/anatomy/parts/humanoid_core.part.json` - Add lung slots referencing library
- `data/mods/anatomy/blueprints/human_male.blueprint.json` - Compose includes lungs
- `data/mods/anatomy/blueprints/human_female.blueprint.json` - Compose includes lungs
- `data/mods/anatomy/blueprints/human_futa.blueprint.json` - Compose includes lungs
- `data/mods/anatomy/recipes/human_male.recipe.json` - Add lung slot preferences
- `data/mods/anatomy/recipes/human_female.recipe.json` - Add lung slot preferences
- `data/mods/anatomy/recipes/human_futa.recipe.json` - Add lung slot preferences

## Out of Scope

- Other creature types (feline, amphibian, etc.)
- Respiratory component definition (already done)
- Damage propagation to lungs (future enhancement)

## Acceptance Criteria

1. **Slot library updated**: `standard_lung_left` and `standard_lung_right` slots added to humanoid.slot-library.json
2. **Blueprint part updated**: humanoid_core.part.json references lung slots with `$use`
3. **Blueprints updated**: All human blueprints compose lung slots
4. **Recipes updated**: All human recipes specify `preferId: "breathing:human_lung_left"` etc.
5. **Socket defined**: Lungs attach to torso via `lung_left_socket`, `lung_right_socket`

## Tests That Must Pass

- `npm run validate` - Schema validation
- `npm run validate:mod:anatomy` - Anatomy mod validation
- Integration test: Human male entity created with lung components present

## Invariants

- All three human blueprints (male, female, futa) get identical lung configuration
- Existing anatomy structure unchanged except for lung additions
- Lungs nested under torso (not top-level)
