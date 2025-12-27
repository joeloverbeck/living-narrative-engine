# Julia Halstead Recipe Creation Spec

## Overview
Create an anatomy recipe file for Julia Halstead in `data/mods/archive-scenario/recipes/julia_halstead.recipe.json` and update the character file to reference it correctly.

## Julia's Physical Details (Extracted from character file)

From `data/mods/archive-scenario/entities/definitions/julia_halstead.character.json`:

### Core Physical Attributes
- **Height**: 5'9" (maps to `tall` in recipe enum)
- **Build**: Thin from forgetting to eat (maps to `slim` or `gaunt`)
- **Hair**: Dark, straight, usually pulled into low ponytail
- **Skin**: Pale from avoiding sunlight
- **Eyes**: Dark brown
- **Bone structure**: Symmetrical features, photographs well
- **Age**: 26-28 years
- **Gender**: Female

### Additional Physical Notes
- Monochromatic aesthetic: black jeans, grey t-shirt
- Wears Sebastian's oversized Timex watch
- No jewelry
- "Beautiful in a way that makes people uncomfortable"

## Current Issue
The character file references `fantasy:julia_halstead_recipe` at line 238, but:
1. No recipe file exists in `data/mods/archive-scenario/recipes/`
2. The recipes folder doesn't exist in archive-scenario mod
3. The mod manifest only lists entities, no recipes

## Files to Create/Modify

### 1. Create Recipe File
**Path**: `data/mods/archive-scenario/recipes/julia_halstead.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "archive-scenario:julia_halstead_recipe",
  "blueprintId": "anatomy:human_female",
  "bodyDescriptors": {
    "height": "tall",
    "skinColor": "pale, avoids sunlight",
    "build": "slim",
    "composition": "underweight",
    "hairDensity": "light",
    "smell": "chlorine from lake swimming, faint sweat"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_female_torso_slim"
    },
    "head": {
      "partType": "head",
      "preferId": "anatomy:humanoid_head_beautiful"
    },
    "hair": {
      "partType": "hair",
      "preferId": "archive-scenario:human_hair_black_medium_ponytail"
    },
    "nose": {
      "partType": "nose",
      "preferId": "anatomy:humanoid_nose"
    },
    "left_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_c_cup_soft"
    },
    "right_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_c_cup_soft"
    },
    "left_ass": {
      "partType": "ass_cheek",
      "preferId": "anatomy:human_ass_cheek_firm"
    },
    "right_ass": {
      "partType": "ass_cheek",
      "preferId": "anatomy:human_ass_cheek_firm"
    },
    "vagina": {
      "partType": "vagina",
      "preferId": "anatomy:human_vagina"
    }
  },
  "patterns": [
    {
      "matches": ["left_arm", "right_arm"],
      "partType": "arm",
      "preferId": "anatomy:humanoid_arm_slim"
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "leg",
      "preferId": "anatomy:human_leg_long_lean"
    },
    {
      "matches": ["left_hand", "right_hand"],
      "partType": "hand",
      "preferId": "anatomy:human_hand"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "foot",
      "preferId": "anatomy:human_foot"
    },
    {
      "matches": ["left_ear", "right_ear"],
      "partType": "ear",
      "preferId": "anatomy:humanoid_ear"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:human_eye_brown"
    }
  ]
}
```

### 2. Update Character File
**Path**: `data/mods/archive-scenario/entities/definitions/julia_halstead.character.json`

Change line 238 from:
```json
"recipeId": "fantasy:julia_halstead_recipe"
```
to:
```json
"recipeId": "archive-scenario:julia_halstead_recipe"
```

### 3. Update Mod Manifest
**Path**: `data/mods/archive-scenario/mod-manifest.json`

Add recipes section and update dependencies:
```json
{
  "id": "archive-scenario",
  "version": "1.0.0",
  "name": "archive-scenario",
  "dependencies": ["anatomy"],
  "content": {
    "entities": {
      "definitions": [
        "audrey_salgado.character.json",
        "julia_halstead.character.json"
      ],
      "instances": []
    },
    "recipes": [
      "julia_halstead.recipe.json"
    ]
  }
}
```

## Body Part Entity Verification

### Available entities to use (verified from `data/mods/anatomy/entities/definitions/`):

| Slot | preferId | Verified |
|------|----------|----------|
| torso | `anatomy:human_female_torso_slim` | ✅ Exists |
| head | `anatomy:humanoid_head_beautiful` | ✅ Exists (matches "beautiful in a way that makes people uncomfortable") |
| hair | (use properties for dark/medium/ponytail) | N/A |
| nose | `anatomy:humanoid_nose` | ✅ Exists |
| breasts | `anatomy:human_breast_c_cup_soft` | ✅ Exists |
| ass cheeks | `anatomy:human_ass_cheek_firm` | ✅ Exists |
| vagina | `anatomy:human_vagina` | ✅ Exists |
| arms | `anatomy:humanoid_arm_slim` | ✅ Exists |
| legs | `anatomy:human_leg_long_lean` | ✅ Exists |
| hands | `anatomy:human_hand` | ✅ Exists |
| feet | `anatomy:human_foot` | ✅ Exists |
| ears | `anatomy:humanoid_ear` | ✅ Exists |
| eyes | `anatomy:human_eye_brown` | ✅ Exists (Julia has "dark brown eyes")

## Validation Steps

1. Create recipes folder: `mkdir -p data/mods/archive-scenario/recipes`
2. Create the recipe file
3. Update the character file recipeId reference
4. Update the mod manifest
5. Run validation: `npm run validate:recipe data/mods/archive-scenario/recipes/julia_halstead.recipe.json`

## Implementation Checklist

- [x] Create `data/mods/archive-scenario/recipes/` directory
- [x] Create `julia_halstead.recipe.json` with proper schema
- [x] Verify all preferId references exist in anatomy mod
- [x] Update character file recipeId to `archive-scenario:julia_halstead_recipe`
- [x] Update mod-manifest.json with recipes content and anatomy dependency
- [ ] Run `npm run validate:recipe` to verify
- [ ] Fix any validation errors

## Notes for Implementation

1. **No clothingEntities**: Julia's character is set in 1994 Wisconsin. User confirmed: "Only focus on the physique. The clothing we will handle in a future session." Omit clothingEntities section entirely.

2. **Recipe ID namespace**: Must be `archive-scenario:julia_halstead_recipe` to match the mod's namespace, not `fantasy:`.

3. **All body part entities verified**: All preferId references have been verified to exist in the anatomy mod.
