# Ermine-Folk Female Anatomy Recipe Specification

## Overview

This specification details the implementation of an ermine-folk female anatomy system for the `dredgers` mod. The implementation follows established patterns from the `anatomy` mod (particularly the `cat_girl` pattern) and creates a reusable mustelid anatomy foundation.

## Goals

1. Create a complete ermine-folk female anatomy recipe that passes `npm run validate:recipe`
2. Establish reusable mustelid anatomy infrastructure (blueprint part, blueprint)
3. Create ermine-specific anatomy parts (ears, tail, torso)
4. Maintain biological authenticity for fantasy ermine-folk

## Architecture

The anatomy system uses a three-tier hierarchy:

```
Blueprint Part (mustelid_core.part.json)
    ↓ composed into
Blueprint (ermine_folk_female.blueprint.json)
    ↓ referenced by
Recipe (ermine_folk_female.recipe.json)
    ↓ uses
Entity Definitions (ermine_ear, ermine_tail, ermine_folk_female_torso)
```

## File List (Implementation Order)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `data/mods/dredgers/parts/mustelid_core.part.json` | Reusable mustelid blueprint part |
| 2 | `data/mods/dredgers/entities/definitions/ermine_ear.entity.json` | Ermine ear part |
| 3 | `data/mods/dredgers/entities/definitions/ermine_tail.entity.json` | Ermine tail part |
| 4 | `data/mods/dredgers/entities/definitions/ermine_folk_female_torso.entity.json` | Root torso with sockets |
| 5 | `data/mods/dredgers/blueprints/ermine_folk_female.blueprint.json` | Blueprint composing mustelid_core |
| 6 | `data/mods/dredgers/recipes/ermine_folk_female.recipe.json` | Recipe filling all slots |
| 7 | `data/mods/dredgers/mod-manifest.json` | Updated manifest |

## Directory Structure

```
data/mods/dredgers/
├── mod-manifest.json
├── blueprints/
│   └── ermine_folk_female.blueprint.json
├── entities/
│   └── definitions/
│       ├── eira_quenreach.character.json (existing)
│       ├── ermine_ear.entity.json
│       ├── ermine_tail.entity.json
│       └── ermine_folk_female_torso.entity.json
├── parts/
│   └── mustelid_core.part.json
└── recipes/
    └── ermine_folk_female.recipe.json
```

---

## Detailed File Specifications

### 1. mustelid_core.part.json

**Path**: `data/mods/dredgers/parts/mustelid_core.part.json`

**Purpose**: Reusable mustelid blueprint part (like `anatomy:feline_core`). Can be reused for other mustelid species (weasels, ferrets, minks).

**Pattern**: Based on `data/mods/anatomy/parts/feline_core.part.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint-part.schema.json",
  "id": "dredgers:mustelid_core",
  "description": "Core mustelid anatomy using slot library",
  "library": "anatomy:humanoid_slots",
  "slots": {
    "head": { "$use": "standard_head" },
    "left_arm": { "$use": "standard_arm", "socket": "left_shoulder" },
    "right_arm": { "$use": "standard_arm", "socket": "right_shoulder" },
    "left_leg": { "$use": "standard_leg", "socket": "left_hip" },
    "right_leg": { "$use": "standard_leg", "socket": "right_hip" },
    "left_eye": { "$use": "standard_eye", "socket": "left_eye" },
    "right_eye": { "$use": "standard_eye", "socket": "right_eye" },
    "left_ear": { "$use": "standard_ear", "socket": "left_ear" },
    "right_ear": { "$use": "standard_ear", "socket": "right_ear" },
    "nose": { "$use": "standard_nose" },
    "mouth": { "$use": "standard_mouth" },
    "teeth": { "$use": "standard_teeth" },
    "pubic_hair": { "$use": "standard_pubic_hair" },
    "left_hand": { "$use": "standard_hand", "parent": "left_arm" },
    "right_hand": { "$use": "standard_hand", "parent": "right_arm" },
    "left_foot": { "$use": "standard_foot", "parent": "left_leg" },
    "right_foot": { "$use": "standard_foot", "parent": "right_leg" },
    "asshole": { "$use": "standard_asshole" },
    "left_ass": { "$use": "standard_ass_cheek", "socket": "left_ass" },
    "right_ass": { "$use": "standard_ass_cheek", "socket": "right_ass" },
    "heart": { "$use": "standard_heart" },
    "spine": { "$use": "standard_spine" },
    "brain": { "$use": "standard_brain", "parent": "head" }
  },
  "clothingSlotMappings": {
    "head_gear": { "$use": "standard_head_gear" },
    "face_gear": { "$use": "standard_face_gear" },
    "torso_upper": { "$use": "standard_torso_upper" },
    "left_arm_clothing": { "$use": "standard_arm_clothing", "blueprintSlots": ["left_arm"] },
    "right_arm_clothing": { "$use": "standard_arm_clothing", "blueprintSlots": ["right_arm"] },
    "hands": { "$use": "standard_hands" },
    "legs": { "$use": "standard_legs" },
    "feet": { "$use": "standard_feet" },
    "torso_lower": { "$use": "standard_torso_lower" },
    "back_accessory": { "$use": "standard_back_accessory" }
  }
}
```

---

### 2. ermine_ear.entity.json

**Path**: `data/mods/dredgers/entities/definitions/ermine_ear.entity.json`

**Purpose**: Ermine-specific ear part. Small, rounded (unlike triangular cat ears).

**Pattern**: Based on `data/mods/anatomy/entities/definitions/cat_ear.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:ermine_ear",
  "description": "Ermine ear - small, rounded, covered in short dense fur",
  "components": {
    "anatomy:part": {
      "subType": "ear",
      "hit_probability_weight": 0.4,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 6,
      "maxHealth": 6,
      "state": "healthy"
    },
    "core:name": {
      "text": "ermine ear"
    },
    "core:weight": {
      "weight": 0.008
    },
    "descriptors:texture": {
      "texture": "fuzzy"
    },
    "descriptors:shape_general": {
      "shape": "round"
    }
  }
}
```

**Ermine-specific traits**:
- Smaller health pool (6 vs cat's 8)
- Lighter weight (0.008 vs cat's 0.01)
- Round shape (vs cat's triangular implied)

---

### 3. ermine_tail.entity.json

**Path**: `data/mods/dredgers/entities/definitions/ermine_tail.entity.json`

**Purpose**: Ermine-specific tail. Thin, medium-length (not bushy like cat tails).

**Pattern**: Based on `data/mods/anatomy/entities/definitions/cat_tail.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:ermine_tail",
  "description": "Ermine tail - thin, medium-length, covered in dense fur with black tip",
  "components": {
    "anatomy:part": {
      "subType": "tail",
      "hit_probability_weight": 2,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 8,
      "maxHealth": 8,
      "state": "healthy"
    },
    "core:name": {
      "text": "ermine tail"
    },
    "core:weight": {
      "weight": 0.08
    },
    "descriptors:flexibility": {
      "flexibility": "highly-flexible"
    },
    "descriptors:length_category": {
      "length": "medium"
    },
    "descriptors:texture": {
      "texture": "fuzzy"
    }
  }
}
```

**Ermine-specific traits**:
- Smaller health pool (8 vs cat's 12)
- Lighter weight (0.08 vs cat's 0.15)
- Medium length (vs cat's long)
- Lower hit probability (2 vs cat's 3)

---

### 4. ermine_folk_female_torso.entity.json

**Path**: `data/mods/dredgers/entities/definitions/ermine_folk_female_torso.entity.json`

**Purpose**: Root torso entity with all required sockets.

**Pattern**: Based on `data/mods/anatomy/entities/definitions/cat_girl_torso.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "dredgers:ermine_folk_female_torso",
  "description": "Ermine-folk female torso - slender humanoid torso with tail attachment",
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
      "currentHealth": 45,
      "maxHealth": 45,
      "state": "healthy"
    },
    "anatomy:sockets": {
      "sockets": [
        { "id": "neck", "allowedTypes": ["head", "neck"], "nameTpl": "{{type}}" },
        { "id": "left_shoulder", "orientation": "left", "allowedTypes": ["arm"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "right_shoulder", "orientation": "right", "allowedTypes": ["arm"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "left_hip", "orientation": "left", "allowedTypes": ["leg"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "right_hip", "orientation": "right", "allowedTypes": ["leg"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "left_chest", "orientation": "left", "allowedTypes": ["breast"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "right_chest", "orientation": "right", "allowedTypes": ["breast"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "pubic_hair", "allowedTypes": ["pubic_hair"], "nameTpl": "pubic hair" },
        { "id": "vagina", "allowedTypes": ["vagina"], "nameTpl": "{{type}}" },
        { "id": "asshole", "allowedTypes": ["asshole"], "nameTpl": "{{type}}" },
        { "id": "left_ass", "orientation": "left", "allowedTypes": ["ass_cheek"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "right_ass", "orientation": "right", "allowedTypes": ["ass_cheek"], "nameTpl": "{{orientation}} {{type}}" },
        { "id": "lower_back", "allowedTypes": ["tail"], "nameTpl": "{{type}}" },
        { "id": "heart_socket", "allowedTypes": ["heart"], "nameTpl": "{{type}}" },
        { "id": "spine_socket", "allowedTypes": ["spine"], "nameTpl": "{{type}}" }
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
      "weight": 20
    },
    "descriptors:build": {
      "build": "lissom"
    }
  }
}
```

**Ermine-specific traits**:
- Lower health (45 vs cat_girl's 50) - smaller frame
- Lighter weight (20 vs cat_girl's 25) - leaner body
- Lissom build (slender, graceful)

---

### 5. ermine_folk_female.blueprint.json

**Path**: `data/mods/dredgers/blueprints/ermine_folk_female.blueprint.json`

**Purpose**: Blueprint composing mustelid_core and adding species/sex-specific slots.

**Pattern**: Based on `data/mods/anatomy/blueprints/cat_girl.blueprint.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "dredgers:ermine_folk_female",
  "root": "dredgers:ermine_folk_female_torso",
  "compose": [
    {
      "part": "dredgers:mustelid_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    "left_ear": {
      "socket": "left_ear",
      "requirements": {
        "partType": "ear",
        "components": ["anatomy:part"]
      }
    },
    "right_ear": {
      "socket": "right_ear",
      "requirements": {
        "partType": "ear",
        "components": ["anatomy:part"]
      }
    },
    "tail": {
      "socket": "lower_back",
      "requirements": {
        "partType": "tail",
        "components": ["anatomy:part"]
      }
    },
    "left_breast": {
      "socket": "left_chest",
      "requirements": {
        "partType": "breast",
        "components": ["anatomy:part"]
      }
    },
    "right_breast": {
      "socket": "right_chest",
      "requirements": {
        "partType": "breast",
        "components": ["anatomy:part"]
      }
    },
    "vagina": {
      "socket": "vagina",
      "requirements": {
        "partType": "vagina",
        "components": ["anatomy:part"]
      }
    }
  },
  "clothingSlotMappings": {
    "back_accessory": {
      "anatomySockets": ["lower_back", "tail"],
      "allowedLayers": ["accessories", "armor"]
    },
    "tail_accessory": {
      "anatomySockets": ["tail"],
      "allowedLayers": ["accessories"]
    },
    "torso_lower": {
      "anatomySockets": [
        "left_hip",
        "right_hip",
        "pubic_hair",
        "vagina",
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
        "right_leg",
        "left_breast",
        "right_breast",
        "tail"
      ],
      "allowedLayers": ["outer"]
    },
    "torso_upper": {
      "anatomySockets": [
        "left_chest",
        "right_chest",
        "left_shoulder",
        "right_shoulder"
      ],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    }
  }
}
```

**Notes**:
- Removed `upper_back` and `chest_center` from anatomySockets (not defined in torso)
- Removed `left_breast`, `right_breast` from torso_upper anatomySockets (they're separate slots, not sockets)

---

### 6. ermine_folk_female.recipe.json

**Path**: `data/mods/dredgers/recipes/ermine_folk_female.recipe.json`

**Purpose**: Recipe filling all blueprint slots with specific parts.

**Pattern**: Based on `data/mods/anatomy/recipes/cat_girl.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "dredgers:ermine_folk_female_standard",
  "blueprintId": "dredgers:ermine_folk_female",
  "bodyDescriptors": {
    "build": "lissom",
    "composition": "lean",
    "skinColor": "winter white",
    "hairDensity": "furred",
    "height": "short"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "dredgers:ermine_folk_female_torso",
      "properties": {
        "descriptors:build": {
          "build": "lissom"
        }
      }
    },
    "head": {
      "partType": "head",
      "preferId": "anatomy:humanoid_head"
    },
    "heart": {
      "partType": "heart",
      "preferId": "anatomy:human_heart"
    },
    "spine": {
      "partType": "spine",
      "preferId": "anatomy:human_spine"
    },
    "brain": {
      "partType": "brain",
      "preferId": "anatomy:human_brain"
    },
    "left_ear": {
      "partType": "ear",
      "preferId": "dredgers:ermine_ear",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        }
      }
    },
    "right_ear": {
      "partType": "ear",
      "preferId": "dredgers:ermine_ear",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        }
      }
    },
    "tail": {
      "partType": "tail",
      "preferId": "dredgers:ermine_tail",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        },
        "descriptors:length_category": {
          "length": "medium"
        }
      }
    },
    "left_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_average"
    },
    "right_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_average"
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
      "preferId": "anatomy:humanoid_arm"
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "leg",
      "preferId": "anatomy:human_leg"
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
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:humanoid_eye"
    },
    {
      "matches": ["hair"],
      "partType": "hair",
      "preferId": "anatomy:human_hair"
    }
  ]
}
```

---

### 7. mod-manifest.json (Updated)

**Path**: `data/mods/dredgers/mod-manifest.json`

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
    {
      "id": "core",
      "version": "^1.0.0"
    },
    {
      "id": "anatomy",
      "version": "^1.0.0"
    },
    {
      "id": "descriptors",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "actions": [],
    "components": [],
    "conditions": [],
    "rules": [],
    "entities": {
      "definitions": [
        "eira_quenreach.character.json",
        "ermine_ear.entity.json",
        "ermine_tail.entity.json",
        "ermine_folk_female_torso.entity.json"
      ],
      "instances": []
    },
    "events": [],
    "macros": [],
    "scopes": [],
    "blueprints": [
      "ermine_folk_female.blueprint.json"
    ],
    "recipes": [
      "ermine_folk_female.recipe.json"
    ],
    "parts": [
      "mustelid_core.part.json"
    ],
    "portraits": [],
    "worlds": []
  }
}
```

---

## Validation Process

### Step 1: Create Directories

```bash
mkdir -p data/mods/dredgers/parts
mkdir -p data/mods/dredgers/blueprints
mkdir -p data/mods/dredgers/recipes
```

### Step 2: Create Files in Order

Create files 1-7 in the order specified above. Order matters because:
- Blueprint part must exist before blueprint references it
- Entity definitions must exist before recipe references them
- Blueprint must exist before recipe references it
- All content must be registered in manifest before validation

### Step 3: Run Validation

```bash
npm run validate:recipe data/mods/dredgers/recipes/ermine_folk_female.recipe.json
```

For verbose output:
```bash
npm run validate:recipe data/mods/dredgers/recipes/ermine_folk_female.recipe.json -- -v
```

---

## Potential Validation Errors and Resolutions

### Error: "Blueprint not found: dredgers:ermine_folk_female"

**Cause**: Blueprint not registered in mod-manifest or file not created.
**Resolution**:
1. Ensure file exists at `data/mods/dredgers/blueprints/ermine_folk_female.blueprint.json`
2. Ensure manifest includes `"blueprints": ["ermine_folk_female.blueprint.json"]`

### Error: "Entity definition not found: dredgers:ermine_folk_female_torso"

**Cause**: Torso entity not registered or file missing.
**Resolution**:
1. Ensure file exists at `data/mods/dredgers/entities/definitions/ermine_folk_female_torso.entity.json`
2. Ensure manifest entities.definitions includes the filename

### Error: "Blueprint part not found: dredgers:mustelid_core"

**Cause**: Part file not registered in mod-manifest.
**Resolution**:
1. Ensure file exists at `data/mods/dredgers/parts/mustelid_core.part.json`
2. Ensure manifest includes `"parts": ["mustelid_core.part.json"]`

### Error: "Slot library not found: anatomy:humanoid_slots"

**Cause**: Missing dependency on anatomy mod.
**Resolution**: Ensure mod-manifest dependencies include:
```json
{ "id": "anatomy", "version": "^1.0.0" }
```

### Error: "Invalid body descriptor value"

**Cause**: Using a bodyDescriptor value not in allowed enum.
**Resolution**: Check valid values:
- `build`: lissom, slim, athletic, toned, etc.
- `hairDensity`: furred, hairy, moderate, etc.
- `composition`: lean, soft, average, etc.
- `height`: short, petite, average, tall, etc.
- `skinColor`: free-form string (any value allowed)

### Error: "Socket 'X' not defined in torso"

**Cause**: Clothing slot mapping references socket not in torso entity.
**Resolution**: Remove undefined sockets from clothingSlotMappings or add missing sockets to torso entity.

---

## Ermine Characteristics Summary

| Feature | Real Ermine | Implementation |
|---------|-------------|----------------|
| Body shape | Long, slender | `build: "lissom"`, `composition: "lean"` |
| Size | Small (12-22 oz) | `height: "short"`, lighter weights |
| Ears | Small, rounded | Custom part with `shape: "round"`, health: 6 |
| Tail | Thin, medium-long, black tip | Custom part with `length: "medium"`, weight: 0.08 |
| Fur | Dense winter coat | `hairDensity: "furred"`, `skinColor: "winter white"` |
| Texture | Soft, fuzzy | `texture: "fuzzy"` on ears and tail |

---

## Validation Script Enhancement Suggestion

If `npm run validate:recipe` doesn't provide sufficient diagnostic information, consider enhancing the validation output to include:

1. **Socket validation**: Report which sockets are defined vs referenced
2. **Part resolution**: Show which parts would be selected for each slot
3. **Dependency chain**: Display blueprint → part → library resolution
4. **Missing entity warnings**: List entity IDs that couldn't be resolved

This would help identify issues faster during recipe development.

---

## Related Files for Reference

- `data/mods/anatomy/recipes/cat_girl.recipe.json` - Recipe pattern
- `data/mods/anatomy/blueprints/cat_girl.blueprint.json` - Blueprint pattern
- `data/mods/anatomy/parts/feline_core.part.json` - Part pattern
- `data/mods/anatomy/entities/definitions/cat_ear.entity.json` - Ear pattern
- `data/mods/anatomy/entities/definitions/cat_tail.entity.json` - Tail pattern
- `data/mods/anatomy/entities/definitions/cat_girl_torso.entity.json` - Torso pattern
- `scripts/validate-recipe-v2.js` - Validation script
