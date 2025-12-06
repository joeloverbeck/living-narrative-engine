# Aldous Potter Anatomy Recipe Spec

## Purpose

- Define `data/mods/fantasy/recipes/aldous.recipe.json` for the character `fantasy:aldous` (see `data/mods/fantasy/entities/definitions/aldous.character.json`).
- Base structure on `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json` while fitting Aldous's described physique: average height, lean build, stained-and-scarred hands, short dirty-blonde hair, sleep-hollowed eyes.

## References

- Schema: `data/schemas/anatomy.recipe.schema.json`
- Baseline recipe: `data/mods/fantasy/recipes/bertram_the_muddy.recipe.json`
- Anatomy parts: `data/mods/anatomy/entities/definitions/` (notably `humanoid_arm_lean`, `human_leg_long_lean`, `humanoid_hand_craftsman_stained`, `humanoid_hand_scarred`, `human_hair_short_brown_wavy`, `humanoid_head_plain`, `human_eye_*`, `human_male_torso`)
- Descriptor components: `data/mods/descriptors/components/` (build, composition, height, hair_style, length_hair, color_extended/basic, nail_condition, skin_condition, expression)

## Descriptor Additions Needed

- Add `dirty-blonde` to `descriptors:color_extended` enum to support the requested hair color.
- Add `sleep-hollowed` (under-eye hollows from exhaustion) to `descriptors:skin_condition.conditions` to express the eye appearance without inventing a new component.

## Target Recipe Definition (`data/mods/fantasy/recipes/aldous.recipe.json`)

- `$schema`: `schema://living-narrative-engine/anatomy.recipe.schema.json`
- `recipeId`: `fantasy:aldous_recipe`
- `blueprintId`: `anatomy:human_male`

### Body Descriptors

- `height`: `average`
- `composition`: `lean`
- `build`: `slim` (closest existing enum to “lean” build)
- `hairDensity`: `moderate` (default; matches short, workable hair)
- `skinColor`: "pale with clay staining" (free-form string)
- `smell`: "kiln smoke, wet clay, and ash" (free-form string)

### Slot Overrides

- `torso`: `partType` `torso`, `preferId` `anatomy:human_male_torso`; properties `descriptors:build { build: "slim" }` and optional `descriptors:texture { texture: "worn" }` to show craft wear.
- `head`: `partType` `head`, `preferId` `anatomy:humanoid_head_plain`; properties `descriptors:expression { demeanor: "weary" }` and `descriptors:skin_condition { conditions: ["sleep-hollowed"] }`.
- `hair`: `partType` `hair`, `preferId` `anatomy:human_hair_short_brown_wavy`; properties `descriptors:color_extended { color: "dirty-blonde" }`, `descriptors:length_hair { length: "short" }`, `descriptors:hair_style { style: "wavy" }`.
- `penis`: `partType` `penis`, `preferId` `anatomy:human_penis` (default sizing acceptable).
- `left_ass` / `right_ass`: `partType` `ass_cheek`, `preferId` `anatomy:human_ass_cheek_firm` (fits lean composition).

### Patterns

- Arms: matches `left_arm`, `right_arm`; `partType` `arm`, `preferId` `anatomy:humanoid_arm_lean`; optional properties `descriptors:skin_condition { conditions: ["work-worn"] }` to reflect manual craft.
- Hands: matches `left_hand`, `right_hand`; `partType` `hand`, `preferId` `anatomy:humanoid_hand_craftsman_stained`; properties
  - `descriptors:nail_condition { cleanliness: "stained", condition: "chipped", length: "short" }` (stained nails with work damage)
  - `descriptors:skin_condition { conditions: ["scarred", "work-worn"] }` to capture scarred hands.
- Legs: matches `left_leg`, `right_leg`; `partType` `leg`, `preferId` `anatomy:human_leg_long_lean` (reinforces lean frame).
- Feet: matches `left_foot`, `right_foot`; `partType` `foot`, `preferId` `anatomy:human_foot`.
- Ears: matches `left_ear`, `right_ear`; `partType` `ear`, `preferId` `anatomy:humanoid_ear`.
- Eyes: matches `left_eye`, `right_eye`; `partType` `eye`, `preferId` `anatomy:human_eye_hazel_almond`; properties `descriptors:shape_eye { shape: "hooded" }` and `descriptors:skin_condition { conditions: ["sleep-hollowed"] }` to show exhaustion.

### Clothing Entities (equip on spawn)

- `underwear:linen_drawers`
- `underwear:linen_footwraps`
- `base-clothing:work_tunic_mud_brown`
- `base-clothing:narrow_trousers_wool_linen_charcoal_brown`
- `outer-clothing:leather_work_apron`
- `accessories:leather_belt_iron_buckle`
- `base-clothing:old_ankle_boots_cracked_leather`

### Validation Notes

- Ensure the new enum values are added before validating the recipe (`npm run validate:ecosystem` or `npm run validate:quick`).
- Keep schema ID consistent with other fantasy recipes using the `schema://living-narrative-engine/anatomy.recipe.schema.json` identifier.
- Mirror Bertram’s pattern usage for consistency (slots for torso/head/hair/genitals, patterns for symmetric limbs and sensory organs).
