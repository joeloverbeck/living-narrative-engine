# Anatomy Blueprint Architecture Analysis: Non-Human Body Structure Support

**Date:** 2025-10-26
**Focus:** Architecture analysis and modernization proposal for supporting non-human body structures
**Scope:** Blueprint system, recipe integration, socket management, and moddability improvements

---

## Executive Summary

The Living Narrative Engine's anatomy system uses a sophisticated 4-layer architecture (Blueprints → Parts → Libraries → Entity Definitions) combined with a flexible recipe system. While excellent for humanoid variations, the current implementation has structural limitations that make creating non-human body structures convoluted:

- **Hardcoded anatomy assumptions**: Socket IDs and slot keys assume bilateral humanoid structure
- **Fixed orientation vocabulary**: Only 7 predefined orientations (left, right, upper, lower, etc.)
- **Manual socket definition**: Every body structure requires exhaustive socket enumeration
- **Limited scalability**: Variable limb counts require entirely new blueprints

This report proposes a **modular architecture** using parameterized structure templates that preserve the existing recipe flexibility while dramatically simplifying non-human body creation.

---

## Table of Contents

1. [Current System Architecture](#1-current-system-architecture)
2. [Recipe-Blueprint Integration](#2-recipe-blueprint-integration)
3. [Limitations for Non-Human Bodies](#3-limitations-for-non-human-bodies)
4. [Proposed Modular Architecture](#4-proposed-modular-architecture)
5. [Non-Human Blueprint Examples](#5-non-human-blueprint-examples)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Migration Strategy](#7-migration-strategy)
8. [Moddability Improvements](#8-moddability-improvements)

---

## 1. Current System Architecture

### 1.1 Four-Layer Hierarchy

```
┌─────────────────────────────────────────┐
│  LAYER 1: Blueprints                    │
│  • Defines structural topology          │
│  • Root entity reference                │
│  • Slot definitions with requirements   │
│  • Clothing slot mappings               │
│  Files: data/mods/anatomy/blueprints/   │
└─────────────────────────────────────────┘
                  ↓ composes
┌─────────────────────────────────────────┐
│  LAYER 2: Blueprint Parts               │
│  • Reusable structure modules           │
│  • Uses slot library references         │
│  • Partial clothing mappings            │
│  Files: data/mods/anatomy/parts/        │
└─────────────────────────────────────────┘
                  ↓ references
┌─────────────────────────────────────────┐
│  LAYER 3: Slot Libraries                │
│  • Named slot definitions ($use refs)   │
│  • Standard clothing definitions        │
│  • Reusable across multiple parts       │
│  Files: data/mods/anatomy/libraries/    │
└─────────────────────────────────────────┘
                  ↓ instantiates
┌─────────────────────────────────────────┐
│  LAYER 4: Entity Definitions            │
│  • Actual body part entities            │
│  • Socket component arrays              │
│  • Physical properties & tags           │
│  Files: data/mods/anatomy/entities/     │
└─────────────────────────────────────────┘
```

### 1.2 Blueprint Structure

Current blueprint format (`human_male.blueprint.json`):

```json
{
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "compose": [
    {
      "part": "anatomy:humanoid_core",
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
    "left_testicle": { "socket": "left_testicle", ... },
    "right_testicle": { "socket": "right_testicle", ... }
  }
}
```

**Key observations:**

- Slot keys (`penis`, `left_testicle`) are rigid identifiers
- Socket IDs must pre-exist on parent entities
- Composition reduces duplication for shared structure
- Extensions add new slots to composed base

### 1.3 Socket System

Entity definitions specify attachment points:

```json
{
  "id": "anatomy:human_male_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
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
        }
      ]
    }
  }
}
```

**Socket properties:**

- `id`: Unique identifier within parent
- `orientation`: Spatial position (enum: left, right, mid, upper, lower, front, back)
- `allowedTypes`: Whitelist of compatible part types
- `nameTpl`: Template for auto-naming attached parts

### 1.4 Processing Flow

```
1. Load blueprint → 2. Compose parts → 3. Load recipe
                                            ↓
                                    4. Merge requirements
                                            ↓
5. Create root entity ← 6. Process slots ← 7. Select parts
        ↓                       ↓
8. Validate sockets    9. Attach parts
        ↓                       ↓
10. Validate constraints ← 11. Build graph
```

The `BodyBlueprintFactory` orchestrates this flow, ensuring:

- Socket availability before attachment
- Part type compatibility with socket whitelist
- Recipe constraints (co-presence, exclusions)
- Graph integrity (no cycles, no orphans)

---

## 2. Recipe-Blueprint Integration

### 2.1 Recipe Flexibility

The recipe system provides excellent modder control:

```json
{
  "recipeId": "p_erotica:layla_agirre_recipe",
  "blueprintId": "anatomy:human_futa",
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_futa_torso",
      "properties": {
        "descriptors:build": { "build": "muscular" }
      }
    },
    "penis": {
      "partType": "penis",
      "properties": {
        "descriptors:size_category": { "size": "large" }
      }
    }
  },
  "patterns": [
    {
      "matches": ["left_arm", "right_arm"],
      "partType": "arm",
      "preferId": "anatomy:humanoid_arm_muscular"
    }
  ]
}
```

**Recipe capabilities:**

- **Per-slot configuration**: Override individual slots with specific parts
- **Pattern matching**: Configure multiple slots with same rules
- **Tag filtering**: Include/exclude parts by component tags
- **Property requirements**: Filter by descriptor values
- **Constraints**: Enforce co-presence or mutual exclusion

### 2.2 Recipe-Blueprint Binding

**Critical insight:** Recipes reference blueprint slot keys directly.

```
Blueprint slots:           Recipe must match:
├─ head                   ├─ "head": { ... }
├─ left_arm              ├─ "left_arm": { ... }
├─ right_arm             ├─ "right_arm": { ... }
├─ penis                  └─ patterns: [{"matches": ["left_arm", "right_arm"]}]
└─ left_testicle
```

**Validation:**

- `#validateRecipeSlots()` ensures recipe keys exist in blueprint
- Special case: `torso` slot overrides root entity
- Invalid keys dispatch `SYSTEM_ERROR_OCCURRED` event

**This tight coupling is both a strength (type safety) and limitation (rigidity).**

### 2.3 Strengths to Preserve

The recipe system excels at:

1. **Declarative part selection** - No code required
2. **Property-based filtering** - Flexible matching
3. **Pattern reuse** - DRY for symmetric parts
4. **Constraint validation** - Prevents invalid combinations
5. **Clothing integration** - Automatic equipment

**Any architecture changes must maintain this flexibility.**

---

## 3. Limitations for Non-Human Bodies

### 3.1 Hardcoded Anatomy Assumptions

**Problem:** Socket IDs and blueprint slots embed human anatomy knowledge.

Current socket IDs in `human_male_torso.entity.json`:

```json
{
  "sockets": [
    "left_shoulder",
    "right_shoulder", // Bilateral arms
    "left_hip",
    "right_hip", // Bilateral legs
    "penis",
    "left_testicle",
    "right_testicle", // Male genitalia
    "left_chest",
    "right_chest" // Chest sockets
  ]
}
```

**Issues for non-human creatures:**

- **Spider (8 legs)**: Would need `leg_1`, `leg_2`, ..., `leg_8` or similar
- **Centaur (4 legs + 2 arms)**: Mix of quadruped + biped structure
- **Octopus (8 tentacles)**: Radial symmetry, not bilateral
- **Dragon (wings + tail)**: New appendage types beyond humanoid

**Workaround:** Create entirely new entities with exhaustive socket lists.
**Cost:** High maintenance, duplication, error-prone.

### 3.2 Fixed Orientation Vocabulary

Current orientation enum (7 values):

```typescript
enum Orientation {
  left,
  right, // Bilateral symmetry
  mid, // Centerline
  upper,
  lower, // Vertical axis
  front,
  back, // Anterior/posterior
}
```

**Limitations:**

- **Radial symmetry**: Cannot represent circular arrangement (e.g., starfish arms)
- **Multi-plane**: Cannot represent dorsal/ventral distinctions
- **Indexed**: Cannot represent enumerated positions (tentacle_1, tentacle_2)
- **Custom schemes**: Cannot define creature-specific coordinates

**Example failure case:**

```json
// Attempting to define spider legs with current system
{
  "id": "spider_cephalothorax",
  "sockets": [
    { "id": "leg_1", "orientation": "left" }, // Wrong! Not left/right
    { "id": "leg_2", "orientation": "right" },
    { "id": "leg_3", "orientation": "???" } // No enum value
    // ... 5 more legs with no valid orientation
  ]
}
```

### 3.3 Manual Socket Definition Overhead

**Current process for new body structure:**

1. Design entity with socket array (50-200 lines JSON)
2. Create blueprint with matching slot definitions
3. Create blueprint part if reusable
4. Update slot library if needed
5. Test socket availability and attachment
6. Write recipes for every character variant

**Example:** Adding a 6-armed creature requires:

- 1 torso entity with 6 shoulder sockets
- 1 blueprint with 6 arm slots
- 6 arm entity definitions (or variant sets)
- Recipe patterns for all 6 arms

**Estimated effort:** 2-4 hours per new body structure
**Error rate:** High (typos in socket IDs, mismatched slot keys)

### 3.4 No Limb Count Parameterization

**Current approach:**

```
human_male (2 arms, 2 legs)     → anatomy:human_male blueprint
centaur (2 arms, 4 legs)        → anatomy:centaur blueprint (NEW)
spider (0 arms, 8 legs)         → anatomy:spider blueprint (NEW)
multi_armed_deity (6 arms)      → anatomy:deity_6arm blueprint (NEW)
```

**Problems:**

- No reuse between similar structures
- Blueprint explosion for variations
- Cannot dynamically adjust limb counts
- Recipes must know exact slot keys upfront

**Example:** Creating spider variants:

- 6-legged spider → New blueprint
- 8-legged spider → New blueprint
- 10-legged spider → New blueprint

Each requires full socket/slot/recipe stack.

### 3.5 Blueprint Slot Key Rigidity

**Issue:** Recipe validation enforces exact slot key matching.

```javascript
// From bodyBlueprintFactory.js:#validateRecipeSlots()
if (!blueprint.slots || !blueprint.slots[slotKey]) {
  throw new ValidationError(
    `Recipe contains invalid slot key '${slotKey}' not in blueprint`
  );
}
```

**Consequence:** Cannot use generic patterns across blueprints.

Desired flexibility:

```json
{
  "patterns": [
    {
      "matchesAll": { "partType": "leg" }, // All legs, regardless of count
      "preferId": "anatomy:spider_leg"
    }
  ]
}
```

Current reality:

```json
{
  "patterns": [
    {
      "matches": [
        "leg_1",
        "leg_2",
        "leg_3",
        "leg_4",
        "leg_5",
        "leg_6",
        "leg_7",
        "leg_8"
      ], // Must enumerate
      "partType": "leg"
    }
  ]
}
```

---

## 4. Proposed Modular Architecture

### 4.1 Design Principles

1. **Backward compatibility**: Existing blueprints work unchanged
2. **Declarative configuration**: Define structure, not implementation
3. **Composition-friendly**: Build complex from simple
4. **Recipe-agnostic**: Recipes work across similar structures
5. **Validation-enforced**: Schema prevents invalid configurations

### 4.2 Body Structure Templates

**New concept:** Define body topology parameters instead of exhaustive slots.

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_arachnid",
  "description": "Spider-like body structure with 8 legs",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "attachment": "radial",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientation": "radial_{{index}}",
          "allowedTypes": ["leg", "arachnid_leg"]
        }
      }
    ],
    "appendages": [
      {
        "type": "abdomen",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "abdomen",
          "allowedTypes": ["abdomen", "thorax"]
        }
      }
    ]
  }
}
```

**Blueprint references structure:**

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0", // Opt-in to new features
  "structureTemplate": "anatomy:structure_arachnid",
  "root": "anatomy:spider_cephalothorax",
  "additionalSlots": {
    "venom_gland": {
      "socket": "venom_gland",
      "requirements": { "partType": "gland" }
    }
  }
}
```

**Key improvements:**

- Slot keys auto-generated from template
- Socket definitions created programmatically
- Count changes only require template parameter update
- Recipes can use wildcards or slot group references

### 4.3 Flexible Orientation Systems

**Problem:** Current 7-value enum insufficient.

**Solution:** Support multiple orientation schemes per structure.

```json
{
  "orientationSchemes": {
    "bilateral": ["left", "right", "mid"],
    "radial": [
      "anterior",
      "posterior",
      "left_lateral",
      "right_lateral",
      "left_anterior_lateral",
      "right_anterior_lateral",
      "left_posterior_lateral",
      "right_posterior_lateral"
    ],
    "indexed": {
      "pattern": "position_{{index}}",
      "count": 8
    },
    "custom": {
      "positions": [
        "dorsal_left",
        "dorsal_right",
        "ventral_left",
        "ventral_right"
      ]
    }
  }
}
```

**Usage in socket pattern:**

```json
{
  "limbSets": [
    {
      "type": "tentacle",
      "count": 6,
      "orientationScheme": "radial",
      "socketPattern": {
        "idTemplate": "tentacle_{{index}}",
        "orientation": "{{scheme.positions[index]}}"
      }
    }
  ]
}
```

**Benefits:**

- Radial creatures: Proper angular positioning
- Multi-limbed: Indexed positions (1, 2, 3, ...)
- Complex anatomy: Custom coordinate systems
- Backward compatible: Default to bilateral

### 4.4 Recipe Pattern Enhancements

**Current limitation:** Must enumerate all matching slots.

**Proposed:** Slot group selectors and wildcards.

```json
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg", // All slots from leg limbSet
      "partType": "leg",
      "tags": ["anatomy:spider_leg"]
    },
    {
      "matchesPattern": "tentacle_*", // Wildcard matching
      "partType": "tentacle",
      "properties": {
        "descriptors:flexibility": { "value": "highly_flexible" }
      }
    },
    {
      "matchesAll": {
        "slotType": "leg",
        "orientation": "left_*" // All left-side legs
      },
      "tags": ["anatomy:left_leg_marker"]
    }
  ]
}
```

**Implementation approach:**

```javascript
// In RecipeProcessor
processPatterns(recipe, blueprint) {
  for (const pattern of recipe.patterns) {
    let matchedSlots = [];

    if (pattern.matchesGroup) {
      // Resolve from structure template limbSet
      matchedSlots = this.#resolveSlotGroup(pattern.matchesGroup, blueprint);
    } else if (pattern.matchesPattern) {
      // Wildcard pattern matching
      matchedSlots = this.#matchSlotPattern(pattern.matchesPattern, blueprint);
    } else if (pattern.matchesAll) {
      // Property-based matching
      matchedSlots = this.#matchSlotProperties(pattern.matchesAll, blueprint);
    }

    // Apply pattern to all matched slots
    for (const slot of matchedSlots) {
      this.#applyPatternToSlot(slot, pattern);
    }
  }
}
```

### 4.5 Socket Generation Pipeline

**New processing stage:** Generate sockets from structure template.

```
1. Load structure template
        ↓
2. Parse limbSets and appendages
        ↓
3. Generate socket definitions
   (apply idTemplate, orientation, allowedTypes)
        ↓
4. Create slot definitions in blueprint
   (match socket IDs to slot keys)
        ↓
5. Validate completeness
   (ensure all required sockets exist)
        ↓
6. Proceed to existing blueprint processing
```

**Code location:** New service `StructureTemplateProcessor`

```javascript
class StructureTemplateProcessor {
  generateSocketsFromTemplate(structureTemplate, rootEntityType) {
    const sockets = [];

    for (const limbSet of structureTemplate.topology.limbSets) {
      for (let i = 1; i <= limbSet.count; i++) {
        const socket = {
          id: this.#applyTemplate(limbSet.socketPattern.idTemplate, {
            index: i,
          }),
          orientation: this.#resolveOrientation(limbSet, i),
          allowedTypes: limbSet.socketPattern.allowedTypes,
          nameTpl: limbSet.socketPattern.nameTpl || '{{type}} {{index}}',
        };
        sockets.push(socket);
      }
    }

    return sockets;
  }

  generateBlueprintSlots(structureTemplate) {
    const slots = {};

    for (const limbSet of structureTemplate.topology.limbSets) {
      for (let i = 1; i <= limbSet.count; i++) {
        const slotKey = this.#applyTemplate(limbSet.socketPattern.idTemplate, {
          index: i,
        });
        slots[slotKey] = {
          socket: slotKey,
          requirements: {
            partType: limbSet.type,
            components: ['anatomy:part'],
          },
          optional: limbSet.optional || false,
        };
      }
    }

    return slots;
  }
}
```

---

## 5. Non-Human Blueprint Examples

### 5.1 Example: Giant Spider (8 legs, radial symmetry)

**Structure Template:**

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_arachnid_8leg",
  "description": "Eight-legged arachnid body plan",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "attachment": "radial",
        "arrangementHint": "4_pairs_bilateral",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["leg", "arachnid_leg"],
          "nameTpl": "leg {{index}}"
        }
      }
    ],
    "appendages": [
      {
        "type": "abdomen",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "posterior_abdomen",
          "allowedTypes": ["abdomen"],
          "nameTpl": "abdomen"
        }
      },
      {
        "type": "pedipalp",
        "count": 2,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "pedipalp_{{index}}",
          "allowedTypes": ["pedipalp"],
          "nameTpl": "pedipalp {{index}}"
        }
      }
    ]
  }
}
```

**Blueprint:**

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_arachnid_8leg",
  "root": "anatomy:spider_cephalothorax",
  "additionalSlots": {
    "venom_gland": {
      "socket": "venom_gland",
      "requirements": {
        "partType": "gland",
        "components": ["anatomy:part", "anatomy:venom"]
      },
      "optional": true
    },
    "spinnerets": {
      "socket": "spinnerets",
      "requirements": {
        "partType": "spinneret",
        "components": ["anatomy:part"]
      }
    }
  }
}
```

**Recipe:**

```json
{
  "recipeId": "creatures:giant_spider_forest",
  "blueprintId": "anatomy:giant_spider",
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "leg",
      "tags": ["anatomy:chitinous", "anatomy:hairy"],
      "properties": {
        "descriptors:size": { "size": "long" },
        "descriptors:texture": { "texture": "chitinous" }
      }
    },
    {
      "matchesGroup": "appendage:pedipalp",
      "partType": "pedipalp",
      "tags": ["anatomy:sensory"]
    }
  ],
  "slots": {
    "posterior_abdomen": {
      "partType": "abdomen",
      "preferId": "anatomy:spider_abdomen_bulbous",
      "tags": ["anatomy:chitinous"]
    },
    "venom_gland": {
      "partType": "gland",
      "preferId": "anatomy:spider_venom_gland"
    }
  }
}
```

**Generated at runtime:**

- 8 leg slots: `leg_1` through `leg_8`
- 2 pedipalp slots: `pedipalp_1`, `pedipalp_2`
- 1 abdomen slot: `posterior_abdomen`
- Recipe pattern `matchesGroup: "limbSet:leg"` expands to all 8 legs

### 5.2 Example: Dragon (quadruped + wings + tail)

**Structure Template:**

```json
{
  "id": "anatomy:structure_winged_quadruped",
  "description": "Four-legged creature with wings and tail",
  "topology": {
    "rootType": "dragon_torso",
    "limbSets": [
      {
        "type": "leg",
        "count": 4,
        "arrangement": "quadrupedal",
        "socketPattern": {
          "idTemplate": "{{position}}_leg",
          "positions": ["front_left", "front_right", "rear_left", "rear_right"],
          "allowedTypes": ["leg", "dragon_leg"],
          "nameTpl": "{{position}} leg"
        }
      },
      {
        "type": "wing",
        "count": 2,
        "attachment": "dorsal",
        "socketPattern": {
          "idTemplate": "{{orientation}}_wing",
          "orientationScheme": "bilateral",
          "allowedTypes": ["wing", "dragon_wing"],
          "nameTpl": "{{orientation}} wing"
        }
      }
    ],
    "appendages": [
      {
        "type": "tail",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "tail",
          "allowedTypes": ["tail", "dragon_tail"],
          "nameTpl": "tail"
        }
      },
      {
        "type": "head",
        "count": 1,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "neck",
          "allowedTypes": ["head", "dragon_head"],
          "nameTpl": "head"
        }
      }
    ]
  }
}
```

**Recipe:**

```json
{
  "recipeId": "creatures:red_dragon",
  "blueprintId": "anatomy:red_dragon",
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "leg",
      "tags": ["anatomy:scaled", "anatomy:clawed"],
      "properties": {
        "descriptors:scale_color": { "color": "crimson" }
      }
    },
    {
      "matchesGroup": "limbSet:wing",
      "partType": "wing",
      "tags": ["anatomy:leathery", "anatomy:webbed"],
      "properties": {
        "descriptors:wingspan": { "size": "massive" }
      }
    }
  ],
  "slots": {
    "tail": {
      "partType": "tail",
      "preferId": "anatomy:dragon_tail_spiked",
      "tags": ["anatomy:prehensile"]
    },
    "neck": {
      "partType": "head",
      "preferId": "anatomy:dragon_head_horned"
    }
  }
}
```

### 5.3 Example: Octopoid (8 tentacles, no skeleton)

**Structure Template:**

```json
{
  "id": "anatomy:structure_octopoid",
  "description": "Eight-tentacled cephalopod body plan",
  "topology": {
    "rootType": "mantle",
    "limbSets": [
      {
        "type": "tentacle",
        "count": 8,
        "attachment": "radial",
        "socketPattern": {
          "idTemplate": "tentacle_{{index}}",
          "orientationScheme": "radial",
          "allowedTypes": ["tentacle", "cephalopod_arm"],
          "nameTpl": "tentacle {{index}}"
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
          "allowedTypes": ["head", "cephalopod_head"],
          "nameTpl": "head"
        }
      }
    ]
  }
}
```

**Recipe:**

```json
{
  "recipeId": "creatures:kraken",
  "blueprintId": "anatomy:kraken",
  "patterns": [
    {
      "matchesGroup": "limbSet:tentacle",
      "partType": "tentacle",
      "tags": ["anatomy:prehensile", "anatomy:suckered"],
      "properties": {
        "descriptors:length": { "size": "very_long" },
        "descriptors:flexibility": { "value": "highly_flexible" },
        "descriptors:sucker_count": { "count": 200 }
      }
    }
  ],
  "slots": {
    "head": {
      "partType": "head",
      "preferId": "anatomy:cephalopod_head_beak",
      "tags": ["anatomy:eyestalks"]
    }
  },
  "constraints": {
    "requires": [
      {
        "partTypes": ["tentacle"],
        "components": ["anatomy:chromatophore"]
      }
    ]
  }
}
```

---

## 6. Implementation Roadmap

### Phase 1: Schema Extensions (1-2 weeks)

**Tasks:**

1. Create `anatomy.structure-template.schema.json`
   - Define `topology`, `limbSets`, `appendages` structures
   - Define orientation scheme formats
   - Validate template parameters

2. Extend `anatomy.blueprint.schema.json`
   - Add optional `schemaVersion` field
   - Add optional `structureTemplate` reference
   - Add optional `additionalSlots` for template extensions
   - Keep all existing fields for backward compatibility

3. Extend `anatomy.recipe.schema.json`
   - Add `matchesGroup` pattern type
   - Add `matchesPattern` with wildcard support
   - Add `matchesAll` with property-based filtering
   - Keep existing `matches` array for compatibility

**Deliverables:**

- 3 new/updated schema files
- Schema validation tests
- Documentation with examples

### Phase 2: Structure Template Processor (2-3 weeks)

**New Services:**

1. **StructureTemplateLoader**
   - Loads and validates structure templates
   - Caches parsed templates
   - Resolves template references

2. **SocketGenerator**
   - Generates socket definitions from limbSet patterns
   - Applies orientation schemes
   - Expands template variables ({{index}}, {{orientation}})

3. **SlotGenerator**
   - Creates blueprint slot definitions from templates
   - Generates slot keys matching socket IDs
   - Merges with additional slots

**Integration points:**

- `BodyBlueprintFactory.#loadBlueprint()` - detect schemaVersion
- Route v2 blueprints through template processor
- Fall back to existing logic for v1 blueprints

**Testing:**

- Unit tests for each generator
- Integration tests with example structures
- Performance tests (template expansion overhead)

### Phase 3: Recipe Pattern Enhancement (2 weeks)

**Updates:**

1. **RecipeProcessor**
   - Add `#resolveSlotGroup()` - expand limbSet/appendage groups
   - Add `#matchSlotPattern()` - wildcard pattern matching
   - Add `#matchSlotProperties()` - property-based filtering

2. **Validation**
   - Ensure slot group references exist in template
   - Validate wildcard patterns match at least one slot
   - Property-based filters resolve correctly

**Code example:**

```javascript
// In RecipeProcessor
#resolveSlotGroup(groupRef, blueprint) {
  // groupRef format: "limbSet:leg" or "appendage:tail"
  const [groupType, groupName] = groupRef.split(':');

  const template = this.#loadStructureTemplate(blueprint.structureTemplate);
  let limbSet;

  if (groupType === 'limbSet') {
    limbSet = template.topology.limbSets.find(ls => ls.type === groupName);
  } else if (groupType === 'appendage') {
    limbSet = template.topology.appendages.find(a => a.type === groupName);
  }

  if (!limbSet) {
    throw new ValidationError(`Slot group '${groupRef}' not found in template`);
  }

  // Generate slot keys from limbSet pattern
  return this.#generateSlotKeysFromLimbSet(limbSet);
}
```

### Phase 4: Backward Compatibility Layer (1 week)

**Objectives:**

- All existing blueprints work without modification
- v1 blueprints bypass template processing
- Clear upgrade path documented

**Implementation:**

```javascript
// In BodyBlueprintFactory
#loadBlueprint(blueprintId) {
  const blueprint = this.#dataRegistry.get('anatomyBlueprints', blueprintId);

  if (!blueprint) {
    throw new InvalidArgumentError(`Blueprint '${blueprintId}' not found`);
  }

  // Check schema version
  if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
    // New path: process template
    return this.#processTemplatedBlueprint(blueprint);
  } else {
    // Legacy path: return as-is
    return blueprint;
  }
}

#processTemplatedBlueprint(blueprint) {
  const template = this.#structureTemplateLoader.load(blueprint.structureTemplate);
  const generatedSlots = this.#slotGenerator.generate(template);

  // Merge generated slots with additionalSlots
  return {
    ...blueprint,
    slots: {
      ...generatedSlots,
      ...blueprint.additionalSlots
    }
  };
}
```

### Phase 5: Example Content & Documentation (1-2 weeks)

**New Content:**

1. **Structure Templates**
   - `anatomy:structure_arachnid_8leg`
   - `anatomy:structure_winged_quadruped`
   - `anatomy:structure_octopoid`
   - `anatomy:structure_centauroid`

2. **Blueprints**
   - `anatomy:giant_spider`
   - `anatomy:red_dragon`
   - `anatomy:kraken`
   - `anatomy:centaur_warrior`

3. **Entity Definitions**
   - Spider parts (leg, pedipalp, abdomen)
   - Dragon parts (wing, scaled leg, tail)
   - Tentacle parts with suckers

4. **Recipes**
   - At least 2 recipes per new blueprint
   - Demonstrate pattern matching features

**Documentation:**

- Tutorial: "Creating Non-Human Body Structures"
- Reference: Structure template format
- Migration guide: Converting v1 to v2 blueprints
- Best practices for orientation schemes

### Phase 6: Validation & Tooling (1 week)

**Validation Rules:**

1. **Template validation**
   - limbSet counts are positive integers
   - Socket ID templates generate unique IDs
   - Orientation schemes are valid

2. **Blueprint validation**
   - Referenced templates exist
   - Additional slots don't conflict with generated
   - Root entity type matches template expectation

3. **Recipe validation**
   - Slot groups resolve to actual slots
   - Wildcard patterns match existing slots
   - Property filters reference valid components

**Tooling:**

```bash
# CLI tool for blueprint migration
npm run migrate:blueprint -- --input data/mods/my_mod/blueprints/old.json \
                              --output data/mods/my_mod/blueprints/new.json \
                              --template-name structure_custom

# Validation tool
npm run validate:anatomy-structure -- data/mods/my_mod/

# Generate template from existing blueprint (reverse engineering)
npm run generate:template -- --blueprint anatomy:human_male \
                              --output data/mods/anatomy/templates/humanoid.template.json
```

---

## 7. Migration Strategy

### 7.1 Three-Phase Migration

**Phase A: Coexistence (Months 1-2)**

- v1 and v2 blueprints work simultaneously
- New content uses v2
- Legacy content unchanged
- No pressure on modders

**Phase B: Conversion Tools (Month 3)**

- Release migration CLI tools
- Provide automated conversion where possible
- Document manual conversion for edge cases
- Convert core humanoid blueprints to v2 as examples

**Phase C: Deprecation Notice (Month 6+)**

- Announce v1 support will remain indefinitely
- Recommend v2 for new mods
- Highlight benefits (flexibility, less code, easier maintenance)

### 7.2 Migration Example

**Before (v1 - manual sockets):**

```json
{
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "compose": [
    {
      "part": "anatomy:humanoid_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    "penis": { "socket": "penis", "requirements": { "partType": "penis" } },
    "left_testicle": {
      "socket": "left_testicle",
      "requirements": { "partType": "testicle" }
    },
    "right_testicle": {
      "socket": "right_testicle",
      "requirements": { "partType": "testicle" }
    }
  }
}
```

**After (v2 - template-based):**

```json
{
  "id": "anatomy:human_male",
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_humanoid_bilateral",
  "root": "anatomy:human_male_torso",
  "additionalSlots": {
    "penis": { "socket": "penis", "requirements": { "partType": "penis" } },
    "left_testicle": {
      "socket": "left_testicle",
      "requirements": { "partType": "testicle" }
    },
    "right_testicle": {
      "socket": "right_testicle",
      "requirements": { "partType": "testicle" }
    }
  }
}
```

**Created structure template:**

```json
{
  "id": "anatomy:structure_humanoid_bilateral",
  "topology": {
    "rootType": "torso",
    "limbSets": [
      {
        "type": "arm",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "{{orientation}}_arm",
          "orientationScheme": "bilateral",
          "allowedTypes": ["arm"]
        }
      },
      {
        "type": "leg",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "{{orientation}}_leg",
          "orientationScheme": "bilateral",
          "allowedTypes": ["leg"]
        }
      }
    ],
    "appendages": [
      {
        "type": "head",
        "count": 1,
        "attachment": "anterior",
        "socketPattern": { "idTemplate": "neck", "allowedTypes": ["head"] }
      }
    ]
  }
}
```

**Benefit:** Other humanoid variations reuse `structure_humanoid_bilateral`

### 7.3 Risk Mitigation

**Risks:**

1. **Breaking changes** - v2 processing breaks existing recipes
   - **Mitigation:** Strict version checking, isolated code paths
   - **Test coverage:** 100% of existing test suite passes with v1 blueprints

2. **Performance regression** - Template expansion adds overhead
   - **Mitigation:** Cache generated slots, profile critical paths
   - **Benchmark:** <5ms overhead per blueprint load

3. **Complexity increase** - Harder to understand system
   - **Mitigation:** Comprehensive documentation, clear examples
   - **Training:** Video tutorials, interactive examples

4. **Modder confusion** - Uncertain which format to use
   - **Mitigation:** Clear upgrade guide, decision flowchart
   - **Support:** Discord channel for questions

**Rollback plan:**

- Feature flag: `ENABLE_STRUCTURE_TEMPLATES=false`
- Falls back to v1-only processing
- No data loss, instant revert

---

## 8. Moddability Improvements

### 8.1 Lower Barrier to Entry

**Before (v1):**

- Modder must understand: sockets, slots, blueprints, parts, libraries
- Must create 50-200 lines of socket definitions
- Must enumerate every attachment point
- Trial-and-error to get socket IDs matching

**After (v2):**

- Modder defines high-level structure
- Socket generation is automatic
- Focus on "what" (8 legs) not "how" (leg_1 through leg_8)
- Recipes use semantic patterns (matchesGroup)

**Effort reduction: ~60-70% for non-humanoid creatures**

### 8.2 Declarative Over Imperative

**Philosophy shift:**

```
OLD: "Define every socket ID, slot key, and requirement explicitly"
NEW: "Describe the body structure, system generates details"
```

**Example:**

```json
// OLD: Imperative
{
  "slots": {
    "leg_1": { "socket": "leg_1", "requirements": { "partType": "leg" }},
    "leg_2": { "socket": "leg_2", "requirements": { "partType": "leg" }},
    "leg_3": { "socket": "leg_3", "requirements": { "partType": "leg" }},
    "leg_4": { "socket": "leg_4", "requirements": { "partType": "leg" }},
    "leg_5": { "socket": "leg_5", "requirements": { "partType": "leg" }},
    "leg_6": { "socket": "leg_6", "requirements": { "partType": "leg" }},
    "leg_7": { "socket": "leg_7", "requirements": { "partType": "leg" }},
    "leg_8": { "socket": "leg_8", "requirements": { "partType": "leg" }}
  }
}

// NEW: Declarative
{
  "limbSets": [
    { "type": "leg", "count": 8 }
  ]
}
```

**Lines of code: 24 → 3 (87.5% reduction)**

### 8.3 Reusability Through Templates

**Structure templates as libraries:**

```
anatomy:structure_humanoid_bilateral  → Used by human_male, human_female, human_futa, elf, dwarf
anatomy:structure_arachnid_8leg       → Used by spider, scorpion, harvestman
anatomy:structure_winged_quadruped    → Used by dragon, griffon, wyvern
anatomy:structure_octopoid            → Used by octopus, squid, jellyfish
```

**Community benefit:**

- Modders share templates
- Standard structures emerge
- Easier to remix and extend
- Fewer duplicate definitions

### 8.4 Improved Error Messages

**Current error (v1):**

```
ValidationError: Recipe 'my_spider' contains invalid slot key 'leg_3' not in blueprint 'spider'
```

**Improved error (v2):**

```
ValidationError: Recipe 'my_spider' contains invalid slot key 'leg_3'.

Blueprint 'anatomy:spider' uses structure template 'anatomy:structure_arachnid_8leg'
which generates slots: leg_1, leg_2, leg_4, leg_5, leg_6, leg_7, leg_8, pedipalp_1,
pedipalp_2, posterior_abdomen

Did you mean: 'leg_4'?

Hint: Use pattern matching to target all legs:
{
  "patterns": [{
    "matchesGroup": "limbSet:leg",
    "partType": "leg"
  }]
}
```

**Features:**

- Shows available slots from template
- Suggests corrections
- Provides pattern matching hint

### 8.5 Visual Tooling Potential

**Future enhancements:**

1. **Structure Template Editor**
   - Drag-and-drop limb placement
   - Visual orientation scheme selector
   - Live preview of generated slots

2. **Blueprint Visualizer**
   - Graph view of anatomy tree
   - Socket occupancy display
   - Recipe application preview

3. **Recipe Builder**
   - Auto-complete for slot groups
   - Property picker for descriptors
   - Constraint validation in real-time

---

## Conclusion

The proposed modular architecture preserves all strengths of the current system (recipe flexibility, validation, composition) while dramatically simplifying non-human body structure creation. Key benefits:

1. **60-70% effort reduction** for non-humanoid creatures
2. **Declarative configuration** instead of exhaustive enumeration
3. **Template reuse** across similar structures
4. **Recipe portability** with semantic patterns
5. **Complete backward compatibility** with existing content

The implementation roadmap provides a safe, incremental migration path with clear phases, tooling support, and risk mitigation. Modders gain powerful new capabilities while existing content continues working unchanged.

**Recommended next steps:**

1. Review and approve architectural approach
2. Begin Phase 1 (schema extensions)
3. Create proof-of-concept spider blueprint
4. Gather modder feedback on usability

---

## Appendix A: Schema Definitions

### A.1 Structure Template Schema (Draft)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "title": "Anatomy Structure Template",
  "description": "Parameterized body structure definition for generating blueprints",
  "type": "object",
  "properties": {
    "id": {
      "$ref": "./common.schema.json#/definitions/namespacedId"
    },
    "description": {
      "type": "string"
    },
    "topology": {
      "type": "object",
      "properties": {
        "rootType": {
          "type": "string",
          "description": "Expected entity type for root"
        },
        "limbSets": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/limbSetDefinition"
          }
        },
        "appendages": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/appendageDefinition"
          }
        }
      },
      "required": ["rootType"]
    }
  },
  "required": ["id", "topology"],
  "definitions": {
    "limbSetDefinition": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "description": "Type of limb (leg, arm, tentacle, wing, etc.)"
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of limbs in this set"
        },
        "arrangement": {
          "type": "string",
          "enum": ["bilateral", "radial", "quadrupedal", "linear", "custom"]
        },
        "socketPattern": {
          "$ref": "#/definitions/socketPattern"
        },
        "optional": {
          "type": "boolean",
          "default": false
        }
      },
      "required": ["type", "count", "socketPattern"]
    },
    "socketPattern": {
      "type": "object",
      "properties": {
        "idTemplate": {
          "type": "string",
          "description": "Template for socket ID generation. Variables: {{index}}, {{orientation}}, {{position}}"
        },
        "orientationScheme": {
          "type": "string",
          "enum": ["bilateral", "radial", "indexed", "custom"],
          "default": "indexed"
        },
        "allowedTypes": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1
        },
        "nameTpl": {
          "type": "string",
          "description": "Template for part naming"
        }
      },
      "required": ["idTemplate", "allowedTypes"]
    }
  }
}
```

### A.2 Extended Recipe Schema (Additions)

```json
{
  "definitions": {
    "enhancedPatternDefinition": {
      "type": "object",
      "properties": {
        "matchesGroup": {
          "type": "string",
          "pattern": "^(limbSet|appendage):[a-zA-Z_]+$",
          "description": "Slot group selector: 'limbSet:leg' or 'appendage:tail'"
        },
        "matchesPattern": {
          "type": "string",
          "description": "Wildcard pattern: 'leg_*', 'tentacle_*'"
        },
        "matchesAll": {
          "type": "object",
          "description": "Property-based matching",
          "properties": {
            "slotType": { "type": "string" },
            "orientation": { "type": "string" }
          }
        },
        "partType": { "type": "string" },
        "tags": { "type": "array" },
        "properties": { "type": "object" }
      },
      "oneOf": [
        { "required": ["matchesGroup"] },
        { "required": ["matchesPattern"] },
        { "required": ["matchesAll"] }
      ]
    }
  }
}
```

---

## Appendix B: Code Impact Analysis

### Files to Modify

**Schemas (3 files):**

- `data/schemas/anatomy.blueprint.schema.json` - Add schemaVersion, structureTemplate
- `data/schemas/anatomy.recipe.schema.json` - Add enhanced pattern types
- `data/schemas/anatomy.structure-template.schema.json` - NEW

**Services (5 files):**

- `src/anatomy/bodyBlueprintFactory.js` - Add template processing branch
- `src/anatomy/recipeProcessor.js` - Add pattern resolution methods
- `src/anatomy/repositories/anatomyBlueprintRepository.js` - Support template loading

**New Services (3 files):**

- `src/anatomy/structureTemplateLoader.js` - NEW
- `src/anatomy/socketGenerator.js` - NEW
- `src/anatomy/slotGenerator.js` - NEW

**Validation (2 files):**

- `src/anatomy/validation/blueprintValidator.js` - NEW
- `src/anatomy/validation/templateValidator.js` - NEW

**Tests (~15 files):**

- Unit tests for each new service
- Integration tests for template processing
- Regression tests for v1 compatibility
- Performance tests for template expansion

**Estimated total changes:** ~2000-3000 lines of code
**Estimated testing:** ~1500 lines of tests

---

**End of Report**
