# Hyena-Folk Female Recipe Specification

## Overview

This specification defines the anatomy recipe for a female hyena-folk character (`dredgers:hyena_folk_female_standard`), required by the character Kestrel Brune (`dredgers:kestrel_brune`).

## Current State Analysis

### Character Reference

The character `kestrel_brune.character.json` references:
```json
"anatomy:body": {
  "recipeId": "dredgers:hyena_folk_female_standard"
}
```

This recipe does **not currently exist**, causing validation failures.

### Required Components

Based on analysis of existing female creature recipes (cat_girl, ermine_folk_female), the following components are needed:

1. **Blueprint**: `anatomy-creatures:hyena_folk_female` (new)
2. **Recipe**: `dredgers:hyena_folk_female_standard` (new)
3. **Entity Definitions** (new):
   - `hyena_folk_female_torso` - Female hyena-folk torso with breast/vagina sockets
   - `hyena_ear` - Rounded hyena ears
   - `hyena_tail` - Short, bushy hyena tail
   - `hyena_eye` - Hyena-specific eyes (amber/gold coloring)
   - `hyena_muzzle` - Hyena snout/muzzle for head or mouth slot
4. **Part Definition**: `hyena_core` (new) - Core hyena anatomy slots

## Implementation Plan

### Phase 1: Create Hyena Core Part

File: `data/mods/anatomy-creatures/parts/hyena_core.part.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint-part.schema.json",
  "id": "anatomy-creatures:hyena_core",
  "description": "Core hyena-folk anatomy using slot library",
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
    "pubic_hair": {
      "$use": "standard_pubic_hair"
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

### Phase 2: Create Hyena Entity Definitions

#### 2.1 Hyena Folk Female Torso

File: `data/mods/anatomy-creatures/entities/definitions/hyena_folk_female_torso.entity.json`

Based on `cat_girl_torso.entity.json` with female anatomy sockets (breasts, vagina).

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy-creatures:hyena_folk_female_torso",
  "description": "Female hyena-folk torso - muscular build with broad shoulders, tail attachment at lower back",
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
      "currentHealth": 55,
      "maxHealth": 55,
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
          "id": "pubic_hair",
          "allowedTypes": ["pubic_hair"],
          "nameTpl": "pubic hair"
        },
        {
          "id": "vagina",
          "allowedTypes": ["vagina"],
          "nameTpl": "{{type}}"
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
          "id": "lower_back",
          "allowedTypes": ["tail"],
          "nameTpl": "{{type}}"
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
      "weight": 28
    },
    "descriptors:build": {
      "build": "muscular"
    }
  }
}
```

#### 2.2 Hyena Ear

File: `data/mods/anatomy-creatures/entities/definitions/hyena_ear.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy-creatures:hyena_ear",
  "description": "Hyena ear - rounded, mobile, covered in short fur with darker markings",
  "components": {
    "anatomy:part": {
      "subType": "ear",
      "hit_probability_weight": 0.5,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 8,
      "maxHealth": 8,
      "state": "healthy"
    },
    "core:name": {
      "text": "hyena ear"
    },
    "core:weight": {
      "weight": 0.02
    },
    "descriptors:texture": {
      "texture": "fuzzy"
    }
  }
}
```

#### 2.3 Hyena Tail

File: `data/mods/anatomy-creatures/entities/definitions/hyena_tail.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy-creatures:hyena_tail",
  "description": "Hyena tail - short, bushy, with darker tip",
  "components": {
    "anatomy:part": {
      "subType": "tail",
      "hit_probability_weight": 2,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 10,
      "maxHealth": 10,
      "state": "healthy"
    },
    "core:name": {
      "text": "hyena tail"
    },
    "core:weight": {
      "weight": 0.3
    },
    "descriptors:flexibility": {
      "flexibility": "average"
    },
    "descriptors:length_category": {
      "length": "short"
    },
    "descriptors:texture": {
      "texture": "fuzzy"
    }
  }
}
```

#### 2.4 Hyena Eye

File: `data/mods/anatomy-creatures/entities/definitions/hyena_eye.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy-creatures:hyena_eye",
  "description": "Hyena eye - amber/gold coloring with predatory glint",
  "components": {
    "anatomy:part": {
      "subType": "eye",
      "hit_probability_weight": 1,
      "health_calculation_weight": 2
    },
    "anatomy:part_health": {
      "currentHealth": 5,
      "maxHealth": 5,
      "state": "healthy"
    },
    "core:name": {
      "text": "hyena eye"
    },
    "core:weight": {
      "weight": 0.008
    },
    "descriptors:color": {
      "color": "amber"
    }
  }
}
```

#### 2.5 Hyena Muzzle (Nose)

File: `data/mods/anatomy-creatures/entities/definitions/hyena_muzzle.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy-creatures:hyena_muzzle",
  "description": "Hyena muzzle - broad, powerful snout with dark nose",
  "components": {
    "anatomy:part": {
      "subType": "nose",
      "hit_probability_weight": 2,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 8,
      "maxHealth": 8,
      "state": "healthy"
    },
    "core:name": {
      "text": "hyena muzzle"
    },
    "core:weight": {
      "weight": 0.05
    }
  }
}
```

#### 2.6 Hyena Mouth

File: `data/mods/anatomy-creatures/entities/definitions/hyena_mouth.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy-creatures:hyena_mouth",
  "description": "Hyena mouth - powerful jaws with distinctive grin",
  "components": {
    "anatomy:part": {
      "subType": "mouth",
      "hit_probability_weight": 2,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 10,
      "maxHealth": 10,
      "state": "healthy"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "teeth",
          "allowedTypes": ["teeth"],
          "nameTpl": "{{type}}"
        }
      ]
    },
    "core:mouth_engagement": {
      "locked": false,
      "forcedOverride": false
    },
    "core:name": {
      "text": "hyena mouth"
    },
    "core:weight": {
      "weight": 0.1
    }
  }
}
```

#### 2.7 Hyena Teeth

File: `data/mods/anatomy-creatures/entities/definitions/hyena_teeth.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy-creatures:hyena_teeth",
  "description": "Hyena teeth - powerful bone-crushing teeth with prominent canines",
  "components": {
    "anatomy:part": {
      "subType": "teeth",
      "hit_probability_weight": 0.5,
      "health_calculation_weight": 1
    },
    "anatomy:part_health": {
      "currentHealth": 12,
      "maxHealth": 12,
      "state": "healthy"
    },
    "core:name": {
      "text": "hyena teeth"
    },
    "core:weight": {
      "weight": 0.05
    }
  }
}
```

### Phase 3: Create Hyena Folk Female Blueprint

File: `data/mods/anatomy-creatures/blueprints/hyena_folk_female.blueprint.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy-creatures:hyena_folk_female",
  "root": "anatomy-creatures:hyena_folk_female_torso",
  "compose": [
    {
      "part": "anatomy-creatures:hyena_core",
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

### Phase 4: Create Hyena Folk Female Recipe

File: `data/mods/dredgers/recipes/hyena_folk_female.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "dredgers:hyena_folk_female_standard",
  "blueprintId": "anatomy-creatures:hyena_folk_female",
  "bodyDescriptors": {
    "build": "muscular",
    "composition": "lean",
    "skinColor": "tawny",
    "hairDensity": "furred",
    "height": "tall",
    "smell": "musky"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy-creatures:hyena_folk_female_torso",
      "properties": {
        "descriptors:build": {
          "build": "muscular"
        }
      }
    },
    "head": {
      "partType": "head",
      "preferId": "anatomy:humanoid_head"
    },
    "nose": {
      "partType": "nose",
      "preferId": "anatomy-creatures:hyena_muzzle"
    },
    "mouth": {
      "partType": "mouth",
      "preferId": "anatomy-creatures:hyena_mouth"
    },
    "teeth": {
      "partType": "teeth",
      "preferId": "anatomy-creatures:hyena_teeth"
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
      "preferId": "anatomy-creatures:hyena_ear",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        }
      }
    },
    "right_ear": {
      "partType": "ear",
      "preferId": "anatomy-creatures:hyena_ear",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        }
      }
    },
    "tail": {
      "partType": "tail",
      "preferId": "anatomy-creatures:hyena_tail",
      "properties": {
        "descriptors:texture": {
          "texture": "fuzzy"
        },
        "descriptors:length_category": {
          "length": "short"
        }
      }
    },
    "left_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_c_cup_firm"
    },
    "right_breast": {
      "partType": "breast",
      "preferId": "anatomy:human_breast_c_cup_firm"
    },
    "vagina": {
      "partType": "vagina",
      "preferId": "anatomy:human_vagina"
    }
  },
  "patterns": [
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy-creatures:hyena_eye"
    },
    {
      "matches": ["left_arm", "right_arm"],
      "partType": "arm",
      "preferId": "anatomy:humanoid_arm_muscular"
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "leg",
      "preferId": "anatomy:human_leg_muscular"
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
      "matches": ["left_ass", "right_ass"],
      "partType": "ass_cheek",
      "preferId": "anatomy:human_ass_cheek_firm_muscular_shelf"
    }
  ],
  "clothingEntities": []
}
```

### Phase 5: Update Mod Manifests

#### 5.1 Update anatomy-creatures mod-manifest.json

Add to `blueprints` array:
```json
"hyena_folk_female.blueprint.json"
```

Add to `parts` array:
```json
"hyena_core.part.json"
```

Add to `entities.definitions` array:
```json
"hyena_ear.entity.json",
"hyena_eye.entity.json",
"hyena_folk_female_torso.entity.json",
"hyena_mouth.entity.json",
"hyena_muzzle.entity.json",
"hyena_tail.entity.json",
"hyena_teeth.entity.json"
```

#### 5.2 Update dredgers mod-manifest.json

Add to `recipes` array:
```json
"hyena_folk_female.recipe.json"
```

## File Creation Order

The files must be created in this order to satisfy dependencies:

1. Entity definitions (no dependencies on other new files):
   - `data/mods/anatomy-creatures/entities/definitions/hyena_ear.entity.json`
   - `data/mods/anatomy-creatures/entities/definitions/hyena_eye.entity.json`
   - `data/mods/anatomy-creatures/entities/definitions/hyena_tail.entity.json`
   - `data/mods/anatomy-creatures/entities/definitions/hyena_muzzle.entity.json`
   - `data/mods/anatomy-creatures/entities/definitions/hyena_mouth.entity.json`
   - `data/mods/anatomy-creatures/entities/definitions/hyena_teeth.entity.json`
   - `data/mods/anatomy-creatures/entities/definitions/hyena_folk_female_torso.entity.json`

2. Part definition (references slot library):
   - `data/mods/anatomy-creatures/parts/hyena_core.part.json`

3. Blueprint (references part and torso entity):
   - `data/mods/anatomy-creatures/blueprints/hyena_folk_female.blueprint.json`

4. Recipe (references blueprint and entities):
   - `data/mods/dredgers/recipes/hyena_folk_female.recipe.json`

5. Mod manifest updates:
   - `data/mods/anatomy-creatures/mod-manifest.json`
   - `data/mods/dredgers/mod-manifest.json`

## Validation

After creating all files, run:

```bash
npm run validate:recipe data/mods/dredgers/recipes/hyena_folk_female.recipe.json
```

Expected output: Validation passes with no errors.

## Character Alignment

The recipe is designed to match Kestrel Brune's character description:

- **Build**: Muscular ("all muscle and sinew", "shoulders bulging with strength", "built for hauling and grappling")
- **Composition**: Lean (athletic, not soft)
- **Height**: Tall ("fills any space I enter")
- **Skin Color**: Tawny (hyena coloring)
- **Hair Density**: Furred ("thick, rough fur with darker patches")
- **Smell**: Musky (natural animal scent)
- **Features**:
  - Predatory grin (hyena mouth/teeth)
  - Rounded hyena ears
  - Amber eyes with predatory glint
  - Short bushy tail
  - Powerful build with muscular arms and legs
  - Firm athletic posterior

## Dependencies

### Required Mods
- `core` ^1.0.0
- `anatomy` ^1.0.0
- `anatomy-creatures` ^1.0.0
- `descriptors` ^1.0.0

### Referenced Entities from anatomy mod
- `anatomy:humanoid_head`
- `anatomy:human_heart`
- `anatomy:human_spine`
- `anatomy:human_brain`
- `anatomy:humanoid_arm_muscular`
- `anatomy:human_leg_muscular`
- `anatomy:human_hand`
- `anatomy:human_foot`
- `anatomy:human_breast_c_cup_firm`
- `anatomy:human_vagina`
- `anatomy:human_ass_cheek_firm_muscular_shelf`

## Completion Criteria

This specification is considered complete when:

1. All files listed in "File Creation Order" have been created
2. All mod manifests have been updated
3. `npm run validate:recipe data/mods/dredgers/recipes/hyena_folk_female.recipe.json` passes validation
4. The Kestrel Brune character can be loaded without anatomy errors
