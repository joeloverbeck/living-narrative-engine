# Toad-Folk Male Recipe Specification

## Overview

This specification defines the implementation plan for creating a toad-folk male recipe (`dredgers:toad_folk_male_standard`) for the Living Narrative Engine. The recipe is required by the character `cress_siltwell.character.json` which currently references a non-existent recipe.

### Context

- **Character**: Cress Siltwell - "toad-folk, mud-born, and read as male"
- **Recipe ID**: `dredgers:toad_folk_male_standard`
- **Mod Location**: `data/mods/dredgers/`
- **Fantasy Setting**: Bipedal, humanoid animal-people in a fantasy world

## Toad-Folk Characteristics

Based on real toad biology adapted for humanoid fantasy characters:

| Characteristic | Description | Implementation |
|----------------|-------------|----------------|
| **Skin** | Hairless, bumpy/warty texture | `hairDensity: "hairless"`, `composition: "bumpy"` |
| **Build** | Stocky, squat frame | `build: "stocky"` |
| **Eyes** | Large, bulging, positioned laterally | Custom `toad_eye.entity.json` with `subType: "eye"` |
| **Ears** | Tympanum (external eardrums) instead of external ears | Custom `toad_tympanum.entity.json` with `subType: "ear"` |
| **Skin Color** | Mottled green-brown tones | `skinColor: "olive"` (use existing descriptor) |
| **Smell** | Earthy, muddy scent | `smell: "earthy"` |

## Files to Create

### Dependency Order

Files must be created in this order to satisfy validation dependencies:

1. `parts/amphibian_core.part.json` - Blueprint part (slot definitions)
2. `entities/definitions/toad_eye.entity.json` - Toad-specific eye entity
3. `entities/definitions/toad_tympanum.entity.json` - Toad-specific ear entity
4. `entities/definitions/toad_folk_male_torso.entity.json` - Male torso with proper sockets
5. `blueprints/toad_folk_male.blueprint.json` - Blueprint composing parts
6. `recipes/toad_folk_male.recipe.json` - Final recipe
7. `mod-manifest.json` - Update to register all new content

## File Specifications

### 1. parts/amphibian_core.part.json

Blueprint part defining core amphibian anatomy slots, following the pattern from `mustelid_core.part.json`:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint-part.schema.json",
  "id": "dredgers:amphibian_core",
  "description": "Core amphibian anatomy using slot library",
  "library": "anatomy:humanoid_slots",
  "slots": {
    "head": {
      "$use": "standard_head"
    },
    "left_arm": {
      "$use": "standard_arm",
      "socket": "left_shoulder"
    },
    "right_arm": {
      "$use": "standard_arm",
      "socket": "right_shoulder"
    },
    "left_leg": {
      "$use": "standard_leg",
      "socket": "left_hip"
    },
    "right_leg": {
      "$use": "standard_leg",
      "socket": "right_hip"
    },
    "left_eye": {
      "$use": "standard_eye",
      "socket": "left_eye"
    },
    "right_eye": {
      "$use": "standard_eye",
      "socket": "right_eye"
    },
    "left_ear": {
      "$use": "standard_ear",
      "socket": "left_ear"
    },
    "right_ear": {
      "$use": "standard_ear",
      "socket": "right_ear"
    },
    "nose": {
      "$use": "standard_nose"
    },
    "mouth": {
      "$use": "standard_mouth"
    },
    "teeth": {
      "$use": "standard_teeth"
    },
    "left_hand": {
      "$use": "standard_hand",
      "parent": "left_arm"
    },
    "right_hand": {
      "$use": "standard_hand",
      "parent": "right_arm"
    },
    "left_foot": {
      "$use": "standard_foot",
      "parent": "left_leg"
    },
    "right_foot": {
      "$use": "standard_foot",
      "parent": "right_leg"
    },
    "asshole": {
      "$use": "standard_asshole"
    },
    "left_ass": {
      "$use": "standard_ass_cheek",
      "socket": "left_ass"
    },
    "right_ass": {
      "$use": "standard_ass_cheek",
      "socket": "right_ass"
    },
    "heart": {
      "$use": "standard_heart"
    },
    "spine": {
      "$use": "standard_spine"
    },
    "brain": {
      "$use": "standard_brain",
      "parent": "head"
    }
  },
  "clothingSlotMappings": {
    "head_gear": {
      "$use": "standard_head_gear"
    },
    "face_gear": {
      "$use": "standard_face_gear"
    },
    "torso_upper": {
      "$use": "standard_torso_upper"
    },
    "left_arm_clothing": {
      "$use": "standard_arm_clothing",
      "blueprintSlots": ["left_arm"]
    },
    "right_arm_clothing": {
      "$use": "standard_arm_clothing",
      "blueprintSlots": ["right_arm"]
    },
    "hands": {
      "$use": "standard_hands"
    },
    "legs": {
      "$use": "standard_legs"
    },
    "feet": {
      "$use": "standard_feet"
    },
    "torso_lower": {
      "$use": "standard_torso_lower"
    },
    "back_accessory": {
      "$use": "standard_back_accessory"
    }
  }
}
```

**Note**: Unlike mustelid_core, amphibian_core omits `pubic_hair` slot since toads are hairless.

### 2. entities/definitions/toad_eye.entity.json

Toad-specific eye with large, bulging characteristics:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:toad_eye",
  "description": "A large, bulging toad eye with horizontal pupil",
  "components": {
    "anatomy:part": {
      "subType": "eye",
      "hit_probability_weight": 2,
      "health_calculation_weight": 3
    },
    "anatomy:part_health": {
      "currentHealth": 5,
      "maxHealth": 5,
      "state": "healthy"
    },
    "core:name": {
      "text": "bulging eye"
    },
    "core:weight": {
      "weight": 0.02
    },
    "descriptors:appearance": {
      "size": "large",
      "shape": "bulging",
      "texture": "smooth"
    }
  }
}
```

### 3. entities/definitions/toad_tympanum.entity.json

Toad tympanum (external eardrum) replacing traditional ears:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:toad_tympanum",
  "description": "A circular tympanum (external eardrum) typical of amphibians",
  "components": {
    "anatomy:part": {
      "subType": "ear",
      "hit_probability_weight": 1,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 3,
      "maxHealth": 3,
      "state": "healthy"
    },
    "core:name": {
      "text": "tympanum"
    },
    "core:weight": {
      "weight": 0.005
    },
    "descriptors:appearance": {
      "size": "medium",
      "shape": "circular",
      "texture": "smooth"
    }
  }
}
```

### 4. entities/definitions/toad_folk_male_torso.entity.json

Male torso with all required sockets for male anatomy (following `human_male_torso.entity.json` pattern):

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:toad_folk_male_torso",
  "description": "A stocky toad-folk male torso with bumpy skin",
  "components": {
    "anatomy:damage_propagation": {
      "rules": [
        {
          "childSocketId": "heart_socket",
          "baseProbability": 0.3,
          "damageFraction": 0.5,
          "damageTypeModifiers": {
            "piercing": 1.5,
            "blunt": 0.3,
            "slashing": 0.8
          }
        },
        {
          "childSocketId": "spine_socket",
          "baseProbability": 0.2,
          "damageFraction": 0.5,
          "damageTypeModifiers": {
            "piercing": 1.2,
            "blunt": 0.5,
            "slashing": 0.6
          }
        }
      ]
    },
    "anatomy:part": {
      "subType": "torso",
      "hit_probability_weight": 45,
      "health_calculation_weight": 10
    },
    "anatomy:part_health": {
      "currentHealth": 50,
      "maxHealth": 50,
      "state": "healthy"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "neck",
          "allowedTypes": ["head", "neck"],
          "nameTpl": "{{type}}"
        },
        {
          "id": "left_shoulder",
          "orientation": "left",
          "allowedTypes": ["arm"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "right_shoulder",
          "orientation": "right",
          "allowedTypes": ["arm"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "left_hip",
          "orientation": "left",
          "allowedTypes": ["leg"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "right_hip",
          "orientation": "right",
          "allowedTypes": ["leg"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "left_chest",
          "orientation": "left",
          "allowedTypes": ["breast"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "right_chest",
          "orientation": "right",
          "allowedTypes": ["breast"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "penis",
          "allowedTypes": ["penis"],
          "nameTpl": "{{type}}"
        },
        {
          "id": "left_testicle",
          "orientation": "left",
          "allowedTypes": ["testicle"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "right_testicle",
          "orientation": "right",
          "allowedTypes": ["testicle"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "asshole",
          "allowedTypes": ["asshole"],
          "nameTpl": "{{type}}"
        },
        {
          "id": "left_ass",
          "orientation": "left",
          "allowedTypes": ["ass_cheek"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "right_ass",
          "orientation": "right",
          "allowedTypes": ["ass_cheek"],
          "nameTpl": "{{orientation}} {{type}}"
        },
        {
          "id": "heart_socket",
          "allowedTypes": ["heart"],
          "nameTpl": "{{type}}"
        },
        {
          "id": "spine_socket",
          "allowedTypes": ["spine"],
          "nameTpl": "{{type}}"
        }
      ]
    },
    "anatomy:visibility_rules": {
      "clothingSlotId": "torso_upper",
      "nonBlockingLayers": ["underwear", "accessories"]
    },
    "core:name": {
      "text": "torso"
    },
    "core:weight": {
      "weight": 35
    }
  }
}
```

**Note**: No `pubic_hair` socket since toads are hairless. Slightly heavier weight (35 vs 32) for stocky build.

### 5. blueprints/toad_folk_male.blueprint.json

Blueprint composing the amphibian_core part with male-specific slots:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "dredgers:toad_folk_male",
  "root": "dredgers:toad_folk_male_torso",
  "compose": [
    {
      "part": "dredgers:amphibian_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    "penis": {
      "socket": "penis",
      "requirements": {
        "partType": "penis",
        "components": ["anatomy:part"]
      }
    },
    "left_testicle": {
      "socket": "left_testicle",
      "requirements": {
        "partType": "testicle",
        "components": ["anatomy:part"]
      }
    },
    "right_testicle": {
      "socket": "right_testicle",
      "requirements": {
        "partType": "testicle",
        "components": ["anatomy:part"]
      }
    }
  },
  "clothingSlotMappings": {
    "back_accessory": {
      "anatomySockets": ["upper_back", "lower_back"],
      "allowedLayers": ["accessories", "armor"]
    },
    "torso_lower": {
      "anatomySockets": [
        "left_hip",
        "right_hip",
        "penis",
        "left_testicle",
        "right_testicle",
        "asshole",
        "left_ass",
        "right_ass"
      ],
      "allowedLayers": ["underwear", "base", "outer"]
    },
    "full_body": {
      "blueprintSlots": [
        "head",
        "left_arm",
        "right_arm",
        "left_leg",
        "right_leg"
      ],
      "allowedLayers": ["outer"]
    },
    "torso_upper": {
      "blueprintSlots": ["torso"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    },
    "legs": {
      "blueprintSlots": ["left_leg", "right_leg"],
      "allowedLayers": ["base", "outer"]
    },
    "left_arm_clothing": {
      "blueprintSlots": ["left_arm"],
      "allowedLayers": ["base", "outer"]
    },
    "right_arm_clothing": {
      "blueprintSlots": ["right_arm"],
      "allowedLayers": ["base", "outer"]
    },
    "feet": {
      "blueprintSlots": ["left_foot", "right_foot"],
      "allowedLayers": ["base", "outer"]
    }
  }
}
```

**Note**: No `pubic_hair` in `torso_lower` anatomySockets (hairless species).

### 6. recipes/toad_folk_male.recipe.json

The main recipe assembling all parts:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "id": "dredgers:toad_folk_male_standard",
  "name": "Toad-Folk Male (Standard)",
  "description": "Standard male toad-folk anatomy with stocky build and bumpy skin",
  "blueprintId": "dredgers:toad_folk_male",
  "bodyDescriptors": {
    "height": "average",
    "skinColor": "olive",
    "build": "stocky",
    "composition": "bumpy",
    "hairDensity": "hairless",
    "smell": "earthy"
  },
  "slotAssignments": {
    "torso": {
      "preferId": "dredgers:toad_folk_male_torso"
    },
    "head": {
      "preferId": "anatomy:humanoid_head"
    },
    "left_eye": {
      "preferId": "dredgers:toad_eye"
    },
    "right_eye": {
      "preferId": "dredgers:toad_eye"
    },
    "left_ear": {
      "preferId": "dredgers:toad_tympanum"
    },
    "right_ear": {
      "preferId": "dredgers:toad_tympanum"
    },
    "nose": {
      "preferId": "anatomy:humanoid_nose"
    },
    "mouth": {
      "preferId": "anatomy:humanoid_mouth"
    },
    "teeth": {
      "preferId": "anatomy:humanoid_teeth"
    },
    "left_arm": {
      "preferId": "anatomy:humanoid_arm"
    },
    "right_arm": {
      "preferId": "anatomy:humanoid_arm"
    },
    "left_hand": {
      "preferId": "anatomy:humanoid_hand"
    },
    "right_hand": {
      "preferId": "anatomy:humanoid_hand"
    },
    "left_leg": {
      "preferId": "anatomy:humanoid_leg"
    },
    "right_leg": {
      "preferId": "anatomy:humanoid_leg"
    },
    "left_foot": {
      "preferId": "anatomy:humanoid_foot"
    },
    "right_foot": {
      "preferId": "anatomy:humanoid_foot"
    },
    "penis": {
      "preferId": "anatomy:humanoid_penis"
    },
    "left_testicle": {
      "preferId": "anatomy:humanoid_testicle"
    },
    "right_testicle": {
      "preferId": "anatomy:humanoid_testicle"
    },
    "asshole": {
      "preferId": "anatomy:humanoid_asshole"
    },
    "left_ass": {
      "preferId": "anatomy:humanoid_ass_cheek"
    },
    "right_ass": {
      "preferId": "anatomy:humanoid_ass_cheek"
    },
    "heart": {
      "preferId": "anatomy:humanoid_heart"
    },
    "spine": {
      "preferId": "anatomy:humanoid_spine"
    },
    "brain": {
      "preferId": "anatomy:humanoid_brain"
    }
  }
}
```

### 7. mod-manifest.json Update

Update the mod manifest to register all new content:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "dredgers",
  "version": "1.0.0",
  "name": "dredgers",
  "description": "Scenario.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    { "id": "core", "version": "^1.0.0" },
    { "id": "anatomy", "version": "^1.0.0" },
    { "id": "descriptors", "version": "^1.0.0" },
    { "id": "skills", "version": "^1.0.0" },
    { "id": "accessories", "version": "^1.0.0" },
    { "id": "base-clothing", "version": "^1.0.0" },
    { "id": "outer-clothing", "version": "^1.0.0" },
    { "id": "fantasy", "version": "^1.0.0" }
  ],
  "content": {
    "actions": [],
    "components": [],
    "conditions": [],
    "rules": [],
    "entities": {
      "definitions": [
        "cress_siltwell.character.json",
        "eira_quenreach.character.json",
        "ermine_ear.entity.json",
        "ermine_folk_female_torso.entity.json",
        "ermine_tail.entity.json",
        "toad_eye.entity.json",
        "toad_tympanum.entity.json",
        "toad_folk_male_torso.entity.json"
      ],
      "instances": [
        "eira_quenreach.character.json"
      ]
    },
    "events": [],
    "macros": [],
    "scopes": [],
    "blueprints": [
      "ermine_folk_female.blueprint.json",
      "toad_folk_male.blueprint.json"
    ],
    "parts": [
      "mustelid_core.part.json",
      "amphibian_core.part.json"
    ],
    "recipes": [
      "ermine_folk_female.recipe.json",
      "toad_folk_male.recipe.json"
    ],
    "portraits": [
      "eira_quenreach.png"
    ],
    "worlds": []
  }
}
```

## Validation Checkpoints

Run `npm run validate:recipe` after each file creation to catch issues early:

### Checkpoint 1: After amphibian_core.part.json
```bash
npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
```
**Expected**: Fail with "blueprint not found" (blueprint doesn't exist yet)

### Checkpoint 2: After entity definitions
```bash
npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
```
**Expected**: Fail with "blueprint not found" (still creating)

### Checkpoint 3: After blueprint
```bash
npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
```
**Expected**: Fail with "recipe not found"

### Checkpoint 4: After recipe
```bash
npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
```
**Expected**: Should pass all validation

### Checkpoint 5: After mod-manifest update
```bash
npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard
```
**Expected**: Full validation pass

## Validation Pipeline Details

From `config/validation-config.json`, the recipe validation runs these validators in order:

| Priority | Validator | Purpose |
|----------|-----------|---------|
| 0 | component_existence | Verify required components exist (failFast) |
| 1 | property_schemas | Validate against JSON schemas |
| 2 | body_descriptors | Check body descriptor values |
| 3 | blueprint_existence | Verify blueprint exists |
| 4 | socket_slot_compatibility | Check socket-slot matching |
| 5 | pattern_matching | Validate ID patterns |
| 6 | descriptor_coverage | Check descriptor completeness |
| 7 | part_availability | Verify parts are loadable |
| 8 | generated_slot_parts | Check generated parts |
| 9 | load_failures | Report any load failures |
| 10 | recipe_usage | Verify recipe is used |

## Suggested Improvements to validate:recipe

Based on this implementation experience, the following improvements would help:

### 1. Dependency Order Guidance
**Problem**: No guidance on which files to create first when building new recipes
**Suggestion**: Add a `--dry-run` mode that analyzes a recipe spec and outputs the required file creation order

### 2. Missing File Detection
**Problem**: When validation fails due to missing referenced files, error messages don't clearly indicate which files are missing
**Suggestion**: Add specific error messages like "Missing blueprint part: dredgers:amphibian_core at path data/mods/dredgers/parts/amphibian_core.part.json"

### 3. Template Generation
**Problem**: Creating new recipes requires manually copying patterns from existing files
**Suggestion**: Add `--generate-template` flag to create skeleton files:
```bash
npm run validate:recipe -- --generate-template male --mod dredgers --species toad_folk
```

### 4. Cross-Reference Validation
**Problem**: Easy to create orphaned entities not referenced by any recipe
**Suggestion**: Add `--check-orphans` to find unused entity definitions in a mod

### 5. Descriptor Value Suggestions
**Problem**: Not clear what valid values are for body descriptors
**Suggestion**: Add `--list-descriptors` to show all valid descriptor values:
```bash
npm run validate:recipe -- --list-descriptors build
# Output: athletic, average, heavyset, lean, muscular, slim, stocky
```

### 6. Blueprint Part Library Inspection
**Problem**: Unclear what slots are available in humanoid_slots library
**Suggestion**: Add `--inspect-library anatomy:humanoid_slots` to list available slot definitions

## Testing Strategy

After implementation, verify with:

1. **Validation**: `npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard`
2. **Load Test**: Start game and verify Cress Siltwell loads without errors
3. **Visual Test**: Check anatomy visualizer shows correct parts
4. **Integration**: Verify character can equip clothing (torso coverage works)

## Implementation Notes

### Differences from Ermine Folk Female

| Aspect | Ermine Folk | Toad Folk |
|--------|-------------|-----------|
| Hair | Has pubic hair slot | No hair (hairless) |
| Ears | External ears (ermine_ear) | Tympanum (toad_tympanum) |
| Eyes | Standard eyes | Bulging eyes (toad_eye) |
| Build | Standard | Stocky |
| Skin | Fur-like | Bumpy |
| Genitals | Female (vagina) | Male (penis, testicles) |

### Shared Anatomy Parts

These parts are shared with anatomy mod (no need to create):
- humanoid_head, humanoid_arm, humanoid_leg, humanoid_hand, humanoid_foot
- humanoid_nose, humanoid_mouth, humanoid_teeth
- humanoid_penis, humanoid_testicle, humanoid_asshole, humanoid_ass_cheek
- humanoid_heart, humanoid_spine, humanoid_brain

### Custom Parts Created

Only species-specific parts need creation:
- `toad_eye.entity.json` - Bulging eyes
- `toad_tympanum.entity.json` - Tympanum ears
- `toad_folk_male_torso.entity.json` - Male torso with sockets

## Completion Criteria

This spec is considered complete when:

1. All 7 files are created as specified
2. `npm run validate:recipe -- --recipe dredgers:toad_folk_male_standard` passes
3. Cress Siltwell character loads in game without errors
4. Anatomy visualizer correctly displays toad-folk male anatomy
