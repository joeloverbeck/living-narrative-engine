# Tortoise-Person Anatomy Recipe Specification

## Overview

This specification defines the complete implementation of a bipedal tortoise-person character for the Living Narrative Engine anatomy system. The design creates a fantasy creature that is an upright tortoise approximately 4'2" tall, featuring a massive shell, beak-like mouth, clawed hands and feet, and distinctive reptilian characteristics.

## System Architecture Context

### The Anatomy System Pipeline

The Living Narrative Engine uses a four-tier architecture for anatomy:

```
Structure Template → Blueprint → Recipe → Entity Graph
```

1. **Structure Templates** (V2 approach) - Define procedural body topology with limb sets and appendages
2. **Blueprints** - Reference templates and define root entities with socket attachment points
3. **Recipes** - Fill blueprint slots with specific parts using pattern matching
4. **Entity Definitions** - Define individual anatomy parts with components

### Validation Requirements

All files must pass validation via `npm run validate:recipe`, which checks:

- **Schema Validation** - All JSON files conform to their respective schemas
- **Component Existence** - All component IDs are registered in the system
- **Property Schemas** - Component properties match their defined schemas
- **Blueprint Existence** - Referenced blueprint exists and is valid
- **Socket Compatibility** - Additional slots reference existing blueprint sockets
- **Pattern Dry Run** - Patterns resolve to actual blueprint slots
- **Part Availability** - Entity definitions exist for all referenced part types
- **Constraint Validation** - Required part types are available in the recipe

### Body Descriptor System

From the Body Descriptor Registry (`src/anatomy/registries/bodyDescriptorRegistry.js`):

**Enumerated Values (must use exact strings):**

- `height`: microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic
- `build`: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky, frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky
- `composition`: underweight, lean, average, soft, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting
- `hairDensity`: hairless, sparse, light, moderate, hairy, very-hairy, furred

**Free-form Values (any string):**

- `skinColor`: E.g., "olive-green", "mottled-brown", "grey-green"
- `smell`: E.g., "earthy", "musty", "damp"

### Pattern Matching Strategies

The recipe system supports three pattern matching approaches:

1. **`matchesGroup`** - Template-driven (recommended for limbs):

   ```json
   { "matchesGroup": "limbSet:arm", "partType": "tortoise_arm" }
   ```

2. **`matches`** - Explicit slot list (for specific parts):

   ```json
   { "matches": ["left_eye", "right_eye"], "partType": "tortoise_eye" }
   ```

3. **`matchesPattern`** - Wildcard matching (alternative):
   ```json
   { "matchesPattern": "arm_*", "partType": "tortoise_arm" }
   ```

## Design Specifications

### Species Overview

**Species:** Tortoise-person (bipedal upright tortoise)

**Physical Characteristics:**

- **Height:** Approximately 4'2" (short by humanoid standards)
- **Build:** Stocky, barrel-chested due to shell structure
- **Shell:** Massive dark amber-brown carapace with visible growth rings
- **Skin:** Wrinkled, leathery texture in olive-green to grey-green tones
- **Eyes:** Slow-blinking amber eyes with nictitating membranes
- **Ears:** No visible external ears
- **Mouth:** Pronounced beak-like structure (horny keratin)
- **Limbs:** Scaled arms and legs with prominent claws on hands and feet
- **Digits:** Three clawed fingers per hand, three clawed toes per foot
- **Tail:** Short, thick, conical reptilian tail

### Design Rationale

**Key Decisions:**

1. **Shell as Separate Entities**
   - Following the dragon wing pattern, the shell (carapace and plastron) is implemented as separate entities mounted to torso sockets
   - Allows for shell customization (patterns, damage, growth rings)
   - Enables potential shell-specific interactions (hiding, protection mechanics)

2. **Beak as Mounted Entity**
   - Following the kraken beak example, the beak is a separate entity attached to the head
   - Allows for beak variations (hooked, serrated, worn)
   - Supports potential bite-related actions

3. **Claws via Descriptors**
   - Claws represented through `descriptors:projection` component (`projection: "clawed"`)
   - More efficient than creating separate claw entities
   - Consistent with existing humanoid nail/claw patterns

4. **Texture Strategy**
   - **Scaled**: Shell, arms, legs (hard reptilian scales)
   - **Leathery**: Exposed skin on hands, feet, neck (thick, wrinkled)
   - **Ridged**: Beak (horny keratin structure)

5. **Bilateral Limb Arrangement**
   - Standard bipedal configuration (2 arms, 2 legs)
   - Uses `orientation: "bilateral"` for left/right socket generation
   - Matches humanoid interaction patterns for gameplay

## File Specifications

### 1. Structure Template

**File:** `data/mods/anatomy/structure-templates/structure_tortoise_biped.structure-template.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_tortoise_biped",
  "description": "Bipedal tortoise body plan with shell, clawed limbs, and beak",
  "topology": {
    "rootType": "torso_with_shell",
    "limbSets": [
      {
        "type": "arm",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "arm_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["tortoise_arm"],
          "nameTpl": "{{orientation}} arm"
        }
      },
      {
        "type": "leg",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "leg_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["tortoise_leg"],
          "nameTpl": "{{orientation}} leg"
        }
      }
    ],
    "appendages": [
      {
        "type": "head",
        "count": 1,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "head",
          "allowedTypes": ["tortoise_head"],
          "nameTpl": "head"
        }
      },
      {
        "type": "tail",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "tail",
          "allowedTypes": ["tortoise_tail"],
          "nameTpl": "tail"
        }
      }
    ]
  }
}
```

### 2. Blueprint V2 Definition

**File:** `data/mods/anatomy/blueprints/tortoise_person.blueprint.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:tortoise_person",
  "schemaVersion": "2.0",
  "root": "anatomy:tortoise_torso_with_shell",
  "structureTemplate": "anatomy:structure_tortoise_biped",
  "additionalSlots": {
    "shell_upper": {
      "socket": "carapace_mount",
      "requirements": {
        "partType": "shell_carapace",
        "components": ["anatomy:part"]
      }
    },
    "shell_lower": {
      "socket": "plastron_mount",
      "requirements": {
        "partType": "shell_plastron",
        "components": ["anatomy:part"]
      }
    }
  },
  "clothingSlotMappings": {
    "shell_armor": {
      "anatomySockets": ["carapace_mount"],
      "allowedLayers": ["armor", "accessory"]
    }
  }
}
```

**Notes:**

- `additionalSlots` define shell mounting points on the torso
- `clothingSlotMappings` allow shell-specific armor/accessories
- Structure template handles limb and appendage sockets

### 3. Recipe Definition

**File:** `data/mods/anatomy/recipes/tortoise_person.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "anatomy:tortoise_person",
  "blueprintId": "anatomy:tortoise_person",
  "bodyDescriptors": {
    "height": "short",
    "build": "stocky",
    "composition": "average",
    "hairDensity": "hairless",
    "skinColor": "olive-green",
    "smell": "earthy"
  },
  "slots": {
    "shell_upper": {
      "partType": "shell_carapace",
      "preferId": "anatomy:tortoise_carapace",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:texture": {
          "texture": "scaled"
        },
        "descriptors:pattern": {
          "pattern": "hexagonal-scutes"
        },
        "descriptors:color_extended": {
          "color": "dark-amber-brown"
        }
      }
    },
    "shell_lower": {
      "partType": "shell_plastron",
      "preferId": "anatomy:tortoise_plastron",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:texture": {
          "texture": "smooth"
        },
        "descriptors:color_extended": {
          "color": "pale-yellow"
        }
      }
    },
    "head": {
      "partType": "tortoise_head",
      "preferId": "anatomy:tortoise_head",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:texture": {
          "texture": "scaled"
        }
      }
    },
    "beak_mount": {
      "partType": "tortoise_beak",
      "preferId": "anatomy:tortoise_beak",
      "tags": ["anatomy:part"]
    },
    "tail": {
      "partType": "tortoise_tail",
      "preferId": "anatomy:tortoise_tail",
      "tags": ["anatomy:part"]
    }
  },
  "patterns": [
    {
      "matchesGroup": "limbSet:arm",
      "partType": "tortoise_arm",
      "preferId": "anatomy:tortoise_arm",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:texture": {
          "texture": "scaled"
        }
      }
    },
    {
      "matchesGroup": "limbSet:leg",
      "partType": "tortoise_leg",
      "preferId": "anatomy:tortoise_leg",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:texture": {
          "texture": "scaled"
        },
        "descriptors:build": {
          "build": "stocky"
        }
      }
    },
    {
      "matches": ["left_hand", "right_hand"],
      "partType": "tortoise_hand",
      "preferId": "anatomy:tortoise_hand",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:digit_count": {
          "count": 3
        },
        "descriptors:projection": {
          "projection": "clawed"
        }
      }
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "tortoise_foot",
      "preferId": "anatomy:tortoise_foot",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:digit_count": {
          "count": 3
        },
        "descriptors:projection": {
          "projection": "clawed"
        }
      }
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "tortoise_eye",
      "preferId": "anatomy:tortoise_eye",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:color_extended": {
          "color": "amber"
        }
      }
    }
  ],
  "constraints": {
    "requires": [
      {
        "partTypes": ["shell_carapace", "shell_plastron"],
        "validation": {
          "message": "Tortoise anatomy requires both upper and lower shell components"
        }
      },
      {
        "partTypes": ["tortoise_beak"],
        "validation": {
          "message": "Tortoise must have a beak for feeding"
        }
      },
      {
        "partTypes": ["tortoise_eye"],
        "validation": {
          "message": "Tortoise must have eyes"
        }
      }
    ]
  }
}
```

**Notes:**

- `slots` handle unique parts (shell, head, tail)
- `patterns` use `matchesGroup` for bilateral limbs (preferred approach)
- `patterns` use `matches` for specific socket lists (eyes, hands, feet)
- `constraints` ensure critical anatomy is present

### 4. Entity Definitions

#### 4.1 Root Torso with Shell Mounts

**File:** `data/mods/anatomy/entities/definitions/tortoise_torso_with_shell.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_torso_with_shell",
  "description": "Tortoise torso with integrated shell mounting points",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_torso"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "carapace_mount",
          "allowedTypes": ["shell_carapace"],
          "nameTpl": "upper shell mount"
        },
        {
          "id": "plastron_mount",
          "allowedTypes": ["shell_plastron"],
          "nameTpl": "lower shell mount"
        }
      ]
    },
    "core:name": {
      "text": "tortoise torso"
    },
    "descriptors:texture": {
      "texture": "leathery"
    },
    "descriptors:color_extended": {
      "color": "olive-green"
    }
  }
}
```

#### 4.2 Shell Parts

**File:** `data/mods/anatomy/entities/definitions/tortoise_carapace.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_carapace",
  "description": "Domed upper shell (carapace) with growth rings",
  "components": {
    "anatomy:part": {
      "subType": "shell_carapace"
    },
    "core:name": {
      "text": "carapace"
    },
    "descriptors:texture": {
      "texture": "scaled"
    },
    "descriptors:pattern": {
      "pattern": "hexagonal-scutes"
    },
    "descriptors:color_extended": {
      "color": "dark-amber-brown"
    },
    "descriptors:shape_general": {
      "shape": "domed"
    }
  }
}
```

**File:** `data/mods/anatomy/entities/definitions/tortoise_plastron.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_plastron",
  "description": "Flat lower shell (plastron) protecting underside",
  "components": {
    "anatomy:part": {
      "subType": "shell_plastron"
    },
    "core:name": {
      "text": "plastron"
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "descriptors:color_extended": {
      "color": "pale-yellow"
    },
    "descriptors:shape_general": {
      "shape": "flat"
    }
  }
}
```

#### 4.3 Head and Facial Features

**File:** `data/mods/anatomy/entities/definitions/tortoise_head.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_head",
  "description": "Reptilian head with beak mount and eye sockets",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_head"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "left_eye",
          "allowedTypes": ["tortoise_eye"],
          "nameTpl": "left eye"
        },
        {
          "id": "right_eye",
          "allowedTypes": ["tortoise_eye"],
          "nameTpl": "right eye"
        },
        {
          "id": "beak_mount",
          "allowedTypes": ["tortoise_beak"],
          "nameTpl": "beak"
        }
      ]
    },
    "core:name": {
      "text": "tortoise head"
    },
    "descriptors:texture": {
      "texture": "scaled"
    },
    "descriptors:shape_general": {
      "shape": "blunt"
    },
    "descriptors:color_extended": {
      "color": "grey-green"
    }
  }
}
```

**File:** `data/mods/anatomy/entities/definitions/tortoise_beak.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_beak",
  "description": "Horny beak structure for herbivorous diet",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_beak"
    },
    "core:name": {
      "text": "beak"
    },
    "descriptors:texture": {
      "texture": "ridged"
    },
    "descriptors:color_extended": {
      "color": "charcoal-grey"
    },
    "descriptors:shape_general": {
      "shape": "hooked"
    }
  }
}
```

**File:** `data/mods/anatomy/entities/definitions/tortoise_eye.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_eye",
  "description": "Reptilian eye with protective nictitating membrane",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_eye"
    },
    "core:name": {
      "text": "eye"
    },
    "descriptors:color_extended": {
      "color": "amber"
    },
    "descriptors:shape_eye": {
      "shape": "round"
    }
  }
}
```

**Note:** Nictitating membrane capability can be added via a custom component if needed for gameplay mechanics, or mentioned in formatting descriptions.

#### 4.4 Arms and Hands

**File:** `data/mods/anatomy/entities/definitions/tortoise_arm.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_arm",
  "description": "Scaled reptilian arm with hand socket",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_arm"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "hand",
          "allowedTypes": ["tortoise_hand"],
          "nameTpl": "hand"
        }
      ]
    },
    "core:name": {
      "text": "arm"
    },
    "descriptors:texture": {
      "texture": "scaled"
    },
    "descriptors:color_extended": {
      "color": "olive-green"
    }
  }
}
```

**File:** `data/mods/anatomy/entities/definitions/tortoise_hand.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_hand",
  "description": "Thick-skinned hand with three prominent claws",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_hand"
    },
    "core:name": {
      "text": "hand"
    },
    "descriptors:texture": {
      "texture": "leathery"
    },
    "descriptors:digit_count": {
      "count": 3
    },
    "descriptors:projection": {
      "projection": "clawed"
    },
    "descriptors:color_extended": {
      "color": "grey-green"
    }
  }
}
```

#### 4.5 Legs and Feet

**File:** `data/mods/anatomy/entities/definitions/tortoise_leg.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_leg",
  "description": "Sturdy reptilian leg with foot socket",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_leg"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "foot",
          "allowedTypes": ["tortoise_foot"],
          "nameTpl": "foot"
        }
      ]
    },
    "core:name": {
      "text": "leg"
    },
    "descriptors:texture": {
      "texture": "scaled"
    },
    "descriptors:build": {
      "build": "stocky"
    },
    "descriptors:color_extended": {
      "color": "olive-green"
    }
  }
}
```

**File:** `data/mods/anatomy/entities/definitions/tortoise_foot.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_foot",
  "description": "Broad foot with three clawed toes",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_foot"
    },
    "core:name": {
      "text": "foot"
    },
    "descriptors:texture": {
      "texture": "leathery"
    },
    "descriptors:digit_count": {
      "count": 3
    },
    "descriptors:projection": {
      "projection": "clawed"
    },
    "descriptors:color_extended": {
      "color": "grey-green"
    }
  }
}
```

#### 4.6 Tail

**File:** `data/mods/anatomy/entities/definitions/tortoise_tail.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:tortoise_tail",
  "description": "Short, thick reptilian tail",
  "components": {
    "anatomy:part": {
      "subType": "tortoise_tail"
    },
    "core:name": {
      "text": "tail"
    },
    "descriptors:texture": {
      "texture": "scaled"
    },
    "descriptors:length_category": {
      "length": "short"
    },
    "descriptors:shape_general": {
      "shape": "conical"
    },
    "descriptors:color_extended": {
      "color": "olive-green"
    }
  }
}
```

### 5. Anatomy Formatting Configuration

**File:** `data/mods/anatomy/anatomy-formatting/default.json`

**Required Additions:**

Add the following entries to the formatting configuration to ensure tortoise-person anatomy parts appear correctly in generated descriptions:

```json
{
  "partTypeDescriptions": {
    "tortoise_torso": {
      "singular": "reptilian torso",
      "plural": "reptilian torsos",
      "article": "a",
      "descriptivePatterns": [
        "shell-backed {texture} torso",
        "{color} reptilian torso",
        "stout {texture} torso"
      ]
    },
    "shell_carapace": {
      "singular": "carapace",
      "plural": "carapaces",
      "article": "a",
      "descriptivePatterns": [
        "{color} {texture} carapace",
        "domed upper shell",
        "{color} shell with {pattern}"
      ],
      "prominence": "high"
    },
    "shell_plastron": {
      "singular": "plastron",
      "plural": "plastrons",
      "article": "a",
      "descriptivePatterns": [
        "{color} {texture} plastron",
        "protective lower shell",
        "{color} ventral shell"
      ],
      "prominence": "medium"
    },
    "tortoise_head": {
      "singular": "reptilian head",
      "plural": "reptilian heads",
      "article": "a",
      "descriptivePatterns": [
        "{texture} {color} head",
        "blunt reptilian head",
        "{color} beaked head"
      ]
    },
    "tortoise_beak": {
      "singular": "beak",
      "plural": "beaks",
      "article": "a",
      "descriptivePatterns": [
        "{texture} {color} beak",
        "pronounced horny beak",
        "{shape} {color} beak"
      ],
      "prominence": "high"
    },
    "tortoise_eye": {
      "singular": "eye",
      "plural": "eyes",
      "article": "an",
      "descriptivePatterns": [
        "{color} reptilian eye",
        "slow-blinking {color} eye",
        "{color} eye with nictitating membrane"
      ]
    },
    "tortoise_arm": {
      "singular": "arm",
      "plural": "arms",
      "article": "an",
      "descriptivePatterns": [
        "{texture} {color} arm",
        "scaled reptilian arm",
        "{color} clawed arm"
      ]
    },
    "tortoise_hand": {
      "singular": "hand",
      "plural": "hands",
      "article": "a",
      "descriptivePatterns": [
        "{texture} three-fingered hand",
        "clawed {color} hand",
        "{digit_count}-digit clawed hand"
      ],
      "clawMention": "prominent claws"
    },
    "tortoise_leg": {
      "singular": "leg",
      "plural": "legs",
      "article": "a",
      "descriptivePatterns": [
        "{texture} {build} leg",
        "sturdy reptilian leg",
        "{color} scaled leg"
      ]
    },
    "tortoise_foot": {
      "singular": "foot",
      "plural": "feet",
      "article": "a",
      "descriptivePatterns": [
        "{texture} three-toed foot",
        "clawed {color} foot",
        "broad {digit_count}-digit foot"
      ],
      "clawMention": "sharp claws"
    },
    "tortoise_tail": {
      "singular": "tail",
      "plural": "tails",
      "article": "a",
      "descriptivePatterns": [
        "{length} {texture} tail",
        "thick reptilian tail",
        "{shape} {color} tail"
      ]
    }
  },
  "compositionRules": {
    "tortoise_person": {
      "bodyOverview": [
        "The creature stands at {height}, with a {build} frame dominated by a massive {shell_carapace}.",
        "Its {shell_plastron} provides protection for the underside.",
        "The {tortoise_head} features a {tortoise_beak} and {tortoise_eye}s that blink slowly."
      ],
      "limbDescription": [
        "Its {tortoise_arm}s end in {tortoise_hand}s, each with {digit_count} {projection} digits.",
        "The {tortoise_leg}s support the weight of the shell, ending in {tortoise_foot} with sharp claws."
      ],
      "prominentFeatures": [
        "shell_carapace",
        "tortoise_beak",
        "clawed hands",
        "clawed feet"
      ]
    }
  }
}
```

**Formatting Guidelines:**

1. **Prominence Levels:**
   - `high`: Shell (carapace), beak - mentioned in primary descriptions
   - `medium`: Plastron, eyes - mentioned in detailed descriptions
   - `standard`: Limbs, torso - standard anatomical descriptions

2. **Descriptor Integration:**
   - `{texture}`: Pulls from `descriptors:texture` component
   - `{color}`: Pulls from `descriptors:color_extended` component
   - `{pattern}`: Pulls from `descriptors:pattern` component
   - `{shape}`: Pulls from `descriptors:shape_general` component
   - `{build}`: Pulls from `descriptors:build` component
   - `{digit_count}`: Pulls from `descriptors:digit_count` component
   - `{projection}`: Pulls from `descriptors:projection` component

3. **Composition Rules:**
   - Define how multiple parts combine in full body descriptions
   - Order: body overview → limb description → prominent features
   - Ensure shell and beak are mentioned early (high prominence)

## Implementation Checklist

Follow this sequence to ensure proper dependency order and validation:

### Phase 1: Core Structure Files

- [ ] **1.1** Create structure template: `structure_tortoise_biped.structure-template.json`
  - Defines topology with limb sets and appendages
  - Validation: `npm run validate`

- [ ] **1.2** Create blueprint V2: `tortoise_person.blueprint.json`
  - References structure template
  - Defines root entity and shell slots
  - Validation: `npm run validate`

### Phase 2: Entity Definitions

Create all 10 entity definition files in `data/mods/anatomy/entities/definitions/`:

- [ ] **2.1** `tortoise_torso_with_shell.entity.json` (root entity with shell sockets)
- [ ] **2.2** `tortoise_carapace.entity.json` (upper shell)
- [ ] **2.3** `tortoise_plastron.entity.json` (lower shell)
- [ ] **2.4** `tortoise_head.entity.json` (with eye and beak sockets)
- [ ] **2.5** `tortoise_beak.entity.json`
- [ ] **2.6** `tortoise_eye.entity.json`
- [ ] **2.7** `tortoise_arm.entity.json` (with hand socket)
- [ ] **2.8** `tortoise_hand.entity.json`
- [ ] **2.9** `tortoise_leg.entity.json` (with foot socket)
- [ ] **2.10** `tortoise_foot.entity.json`
- [ ] **2.11** `tortoise_tail.entity.json`

**Validation after each file:** `npm run validate`

### Phase 3: Formatting Configuration

- [ ] **3.1** Update `data/mods/anatomy/anatomy-formatting/default.json`
  - Add all 11 part type descriptions
  - Add composition rules for tortoise_person
  - Validation: `npm run validate`

### Phase 4: Recipe Definition

- [ ] **4.1** Create recipe: `tortoise_person.recipe.json`
  - References all entity definitions
  - Uses pattern matching for limbs
  - Defines constraints
  - Validation: `npm run validate`

### Phase 5: Mod Manifest Update

- [ ] **5.1** Update `data/mods/anatomy/mod-manifest.json`
  - Add structure template to manifest
  - Add blueprint to manifest
  - Add all 11 entity definitions to manifest
  - Add recipe to manifest
  - Validation: `npm run validate`

### Phase 6: Validation

- [ ] **6.1** Full schema validation: `npm run validate`
- [ ] **6.2** Recipe-specific validation: `npm run validate:recipe`
- [ ] **6.3** Verify no AJV errors or warnings

### Phase 7: Testing

- [ ] **7.1** Test in anatomy visualizer: `anatomy-visualizer.html`
  - Load tortoise_person recipe
  - Verify all parts render
  - Check shell, beak, and claw visibility

- [ ] **7.2** Create integration test (recommended):
  - Use `AnatomyIntegrationTestBed`
  - Verify complete anatomy graph generation
  - Validate part count and structure
  - Test formatting output

## Testing Strategy

### Integration Test Template

**File:** `tests/integration/anatomy/tortoisePerson.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AnatomyIntegrationTestBed } from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Tortoise Person Anatomy Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Complete Anatomy Generation', () => {
    it('should generate complete tortoise anatomy with all required parts', async () => {
      const result = await testBed.generateAnatomy(
        'anatomy:tortoise_person',
        'anatomy:tortoise_person'
      );

      // Verify root
      expect(result.root).toBeDefined();
      expect(result.root.id).toContain('torso');

      // Verify shell components
      expect(result.partsMap).toHaveProperty('carapace');
      expect(result.partsMap).toHaveProperty('plastron');

      // Verify head and facial features
      expect(result.partsMap).toHaveProperty('head');
      expect(result.partsMap).toHaveProperty('beak');
      expect(result.partsMap).toHaveProperty('left_eye');
      expect(result.partsMap).toHaveProperty('right_eye');

      // Verify limbs
      expect(result.partsMap).toHaveProperty('left_arm');
      expect(result.partsMap).toHaveProperty('right_arm');
      expect(result.partsMap).toHaveProperty('left_leg');
      expect(result.partsMap).toHaveProperty('right_leg');

      // Verify extremities
      expect(result.partsMap).toHaveProperty('left_hand');
      expect(result.partsMap).toHaveProperty('right_hand');
      expect(result.partsMap).toHaveProperty('left_foot');
      expect(result.partsMap).toHaveProperty('right_foot');

      // Verify tail
      expect(result.partsMap).toHaveProperty('tail');

      // Total expected parts:
      // 1 torso + 2 shell + 1 head + 1 beak + 2 eyes + 2 arms + 2 hands + 2 legs + 2 feet + 1 tail = 16 parts
      expect(result.bodyParts).toHaveLength(16);
    });

    it('should have correct body descriptors', async () => {
      const result = await testBed.generateAnatomy(
        'anatomy:tortoise_person',
        'anatomy:tortoise_person'
      );

      const bodyDescriptors = result.bodyDescriptors || {};

      expect(bodyDescriptors.height).toBe('short');
      expect(bodyDescriptors.build).toBe('stocky');
      expect(bodyDescriptors.composition).toBe('average');
      expect(bodyDescriptors.hairDensity).toBe('hairless');
      expect(bodyDescriptors.skinColor).toBe('olive-green');
      expect(bodyDescriptors.smell).toBe('earthy');
    });

    it('should have shell parts with correct descriptors', async () => {
      const result = await testBed.generateAnatomy(
        'anatomy:tortoise_person',
        'anatomy:tortoise_person'
      );

      const carapace = result.partsMap.carapace;
      expect(carapace).toBeDefined();
      expect(carapace.components['descriptors:texture'].texture).toBe('scaled');
      expect(carapace.components['descriptors:shape_general'].shape).toBe(
        'domed'
      );

      const plastron = result.partsMap.plastron;
      expect(plastron).toBeDefined();
      expect(plastron.components['descriptors:texture'].texture).toBe('smooth');
      expect(plastron.components['descriptors:shape_general'].shape).toBe(
        'flat'
      );
    });

    it('should have clawed hands and feet', async () => {
      const result = await testBed.generateAnatomy(
        'anatomy:tortoise_person',
        'anatomy:tortoise_person'
      );

      // Check hands
      const leftHand = result.partsMap.left_hand;
      expect(leftHand.components['descriptors:projection'].projection).toBe(
        'clawed'
      );
      expect(leftHand.components['descriptors:digit_count'].count).toBe(3);

      const rightHand = result.partsMap.right_hand;
      expect(rightHand.components['descriptors:projection'].projection).toBe(
        'clawed'
      );
      expect(rightHand.components['descriptors:digit_count'].count).toBe(3);

      // Check feet
      const leftFoot = result.partsMap.left_foot;
      expect(leftFoot.components['descriptors:projection'].projection).toBe(
        'clawed'
      );
      expect(leftFoot.components['descriptors:digit_count'].count).toBe(3);

      const rightFoot = result.partsMap.right_foot;
      expect(rightFoot.components['descriptors:projection'].projection).toBe(
        'clawed'
      );
      expect(rightFoot.components['descriptors:digit_count'].count).toBe(3);
    });

    it('should have beak properly attached to head', async () => {
      const result = await testBed.generateAnatomy(
        'anatomy:tortoise_person',
        'anatomy:tortoise_person'
      );

      const head = result.partsMap.head;
      const beak = result.partsMap.beak;

      expect(head).toBeDefined();
      expect(beak).toBeDefined();
      expect(beak.components['descriptors:texture'].texture).toBe('ridged');
      expect(beak.components['descriptors:shape_general'].shape).toBe('hooked');
    });
  });

  describe('Formatting Output', () => {
    it('should include shell, beak, and claw mentions in description', async () => {
      const result = await testBed.generateAnatomy(
        'anatomy:tortoise_person',
        'anatomy:tortoise_person'
      );

      const description = await testBed.formatAnatomyDescription(result);

      // Verify prominent features are mentioned
      expect(description.toLowerCase()).toMatch(/carapace|shell/);
      expect(description.toLowerCase()).toMatch(/beak/);
      expect(description.toLowerCase()).toMatch(/claw/);
      expect(description.toLowerCase()).toMatch(/amber.*eye/);
    });
  });
});
```

### Manual Testing in Anatomy Visualizer

1. Open `anatomy-visualizer.html` in browser
2. Select recipe: `anatomy:tortoise_person`
3. Generate anatomy
4. Verify visual representation:
   - Shell parts visible and properly colored
   - Bilateral symmetry of limbs
   - Beak attached to head
   - Eyes present
   - Clawed hands and feet indicated
5. Check generated description includes prominent features

## Available Descriptor Values

### Texture Values (from `descriptors:texture.component.json`)

Valid values for `texture` property:

- `bumpy`, `chitinous`, `coarse`, `faceted`, `fuzzy`, `glossy`, `leathery`, `matte`, `mucous`, `ridged`, `rough`, `rugged`, `scarred`, `scaled`, `serrated-edges`, `silky`, `slick`, `slimy`, `smooth`, `soft`, `translucent`, `velvety`, `webbed-clawed`

**Recommended for Tortoise:**

- Shell: `scaled` (scute texture)
- Exposed skin: `leathery` (thick, wrinkled)
- Beak: `ridged` (horny keratin)

### Pattern Values (if applicable)

Common patterns for shells:

- `hexagonal-scutes` (suggested for carapace)
- `growth-rings` (alternative for aged appearance)
- `mottled` (color variation)

### Shape Values

From `descriptors:shape_general.component.json`:

- `domed` (for carapace)
- `flat` (for plastron)
- `blunt` (for head)
- `hooked` (for beak)
- `conical` (for tail)

## Common Issues and Solutions

### Issue: Recipe validation fails with "unknown part type"

**Cause:** Entity definition not yet created or not in mod manifest
**Solution:** Ensure all entity definitions exist and are listed in `mod-manifest.json` before creating recipe

### Issue: Pattern matching doesn't resolve slots

**Cause:** Pattern doesn't match socket IDs generated by structure template
**Solution:** Use `matchesGroup: "limbSet:arm"` for template-generated sockets, not `matchesPattern`

### Issue: Shell parts not appearing in visualization

**Cause:** `additionalSlots` in blueprint don't reference correct socket IDs
**Solution:** Verify torso entity has matching socket IDs (`carapace_mount`, `plastron_mount`)

### Issue: Body descriptors fail validation

**Cause:** Using invalid enumerated values
**Solution:** Check Body Descriptor Registry for exact valid strings (case-sensitive)

### Issue: Formatting doesn't show claws or beak

**Cause:** Part types not added to formatting configuration
**Solution:** Add all 11 part types to `anatomy-formatting/default.json` with descriptive patterns

## References

### Existing Creature Examples

- **Spider (`spider_person.recipe.json`)**: 8-limbed creature, demonstrates multi-limb patterns
- **Dragon (`dragon.recipe.json`)**: Wing mounting system, similar to shell approach
- **Kraken (`kraken.recipe.json`)**: Beak mounting pattern, tentacle arrays

### Key Documentation Files

- `docs/anatomy/anatomy-system-overview.md` - High-level architecture
- `docs/anatomy/blueprint-system.md` - Blueprint V2 specifications
- `docs/anatomy/recipe-system.md` - Recipe creation guide
- `docs/anatomy/body-descriptors-complete.md` - Body descriptor registry guide
- `docs/anatomy/structure-templates.md` - Template topology patterns

### Validation Scripts

- `npm run validate` - Schema validation for all JSON files
- `npm run validate:recipe` - Recipe-specific validation with dry run
- `npm run validate:body-descriptors` - Body descriptor system validation

## Conclusion

This specification provides a complete blueprint for implementing a tortoise-person character in the Living Narrative Engine. The design follows established patterns from existing creature recipes while introducing unique tortoise-specific features:

- **Protective shell** (carapace and plastron) as mounted entities
- **Beak structure** for herbivorous diet
- **Clawed extremities** for grip and defense
- **Reptilian texture and appearance** throughout
- **Compact stature** (4'2") with stocky build

All components are designed to pass validation and integrate seamlessly with the anatomy system's description generation, action discovery, and clothing systems.

**Implementation Status:** Specification complete, ready for file creation

**Estimated Part Count:** 16 total anatomy parts (1 torso + 2 shell + 1 head + 1 beak + 2 eyes + 2 arms + 2 hands + 2 legs + 2 feet + 1 tail)

**Next Steps:** Follow implementation checklist to create all files in dependency order, validating at each stage.
