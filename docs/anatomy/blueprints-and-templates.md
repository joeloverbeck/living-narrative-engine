# Anatomy Blueprints and Structure Templates

## Overview

This guide covers Blueprint V2 and structure templates—the system for defining non-human creature anatomy with declarative, template-based definitions. Together, they enable concise anatomy definitions for creatures with repeating limbs and complex body structures.

**What You'll Learn**:
- Blueprint V2 features and when to use them
- Creating structure templates for reusable body plans
- Socket generation and orientation schemes
- Migration from V1 blueprints to V2
- Complete examples for common creature types

**Related Documentation**:
- [Recipe Pattern Matching](./recipe-pattern-matching.md) - Pattern matching for template-generated slots
- [Common Creature Patterns](./recipe-pattern-matching.md#part-4-common-creature-patterns) - Complete creature examples
- [Non-Human Quickstart](./non-human-quickstart.md) - Step-by-step tutorial
- [Pattern Reference](./recipe-pattern-matching.md#part-2-pattern-reference) - Advanced filtering

**Schema Locations**:
- Blueprints: `data/schemas/anatomy.blueprint.schema.json`
- Templates: `data/schemas/anatomy.structure-template.schema.json`

---

# Part 1: Blueprint V2

## Version Comparison

### V1 Anatomy Blueprints (schemaVersion: "1.0" or omitted)

**V1 Features**:
- Manual `slots` definition for every body part attachment
- `parts` array for simple part inclusion
- `compose` array for advanced part composition
- Full control over every socket

**V1 Limitations**:
- Verbose for creatures with many repeating limbs
- Error-prone (easy to forget sockets)
- Difficult to maintain symmetry
- No parametric generation

**V1 Example** (excerpt from existing humanoid):
```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "compose": [
    {
      "part": "anatomy:humanoid_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    "left_arm": {
      "socket": "left_shoulder",
      "requirements": {
        "partType": "arm",
        "components": ["anatomy:part"]
      }
    },
    "right_arm": {
      "socket": "right_shoulder",
      "requirements": {
        "partType": "arm",
        "components": ["anatomy:part"]
      }
    }
    // ... many more manual slots
  }
}
```

### V2 Anatomy Blueprints (schemaVersion: "2.0")

**V2 Features**:
- `structureTemplate` reference for automatic socket generation
- `additionalSlots` for slots beyond template-generated ones
- Parametric socket generation based on limb sets and appendages
- Dramatically reduced verbosity for non-human creatures

**V2 Benefits**:
- Concise definitions for creatures with many limbs
- Guaranteed symmetry and consistency
- Easy to modify (change template, not every socket)
- Declarative and maintainable

**V2 Example** (spider with 8 legs):
```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0",
  "root": "anatomy:spider_cephalothorax",
  "structureTemplate": "anatomy:structure_arachnid_8leg"
}
```

This 6-line blueprint generates 11 sockets automatically: 8 leg sockets (leg_1 through leg_8), 2 pedipalp sockets (pedipalp_1, pedipalp_2), and 1 posterior torso socket (posterior_torso)!

## When to Use V2

### Use V2 When:

1. **Non-human creatures** with repeating limbs (spiders, insects, dragons, centaurs)
2. **Radial symmetry** (starfish, jellyfish, flowers)
3. **Many limbs** (centipedes, octopi, multi-armed creatures)
4. **Parametric designs** where limb count might vary
5. **Consistency matters** (guaranteed symmetry)

### Use V1 When:

1. **Humanoid creatures** where manual control is needed
2. **Asymmetric designs** with unique attachment points
3. **Complex part composition** requiring fine-grained control
4. **Existing blueprints** that don't need template-based generation
5. **Hybrid humanoids** where template generation isn't beneficial

## Schema Version Property

The `schemaVersion` property controls which features are available:

### V1 Mode (default)

```json
{
  "id": "anatomy:example_v1",
  "root": "anatomy:torso",
  // schemaVersion omitted or "1.0"
  "slots": { /* manual slots */ },
  "parts": [ /* blueprint parts */ ],
  "compose": [ /* composition instructions */ ]
}
```

**Available**: `slots`, `parts`, `compose`, `clothingSlotMappings`
**Forbidden**: `structureTemplate`, `additionalSlots`

### V2 Mode (opt-in)

```json
{
  "id": "anatomy:example_v2",
  "schemaVersion": "2.0",
  "root": "anatomy:torso",
  "structureTemplate": "anatomy:structure_example",
  "additionalSlots": { /* optional extra slots */ },
  "clothingSlotMappings": { /* optional */ }
}
```

**Required**: `schemaVersion: "2.0"`, `structureTemplate`
**Available**: `additionalSlots`, `clothingSlotMappings`
**Forbidden**: `slots`, `parts`, `compose`

## Structure Template Reference

The `structureTemplate` property references a structure template by ID.

**Format**: Namespaced ID (e.g., `"anatomy:structure_arachnid_8leg"`)

```json
{
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_arachnid_8leg"
}
```

The referenced template defines:
- Root body part type
- Limb sets (legs, arms, tentacles, wings, etc.)
- Appendages (head, tail, abdomen, etc.)
- Socket generation patterns

The blueprint loader resolves the template and generates all sockets automatically.

### Socket Merging

When a V2 blueprint is processed:
1. Template generates sockets based on `limbSets` and `appendages`
2. Root entity definition may have additional sockets in its `anatomy:sockets` component
3. Template-generated sockets override entity definition sockets for duplicate IDs
4. Final merged socket list is applied to the root entity

## Additional Slots

The `additionalSlots` property allows adding sockets beyond what the template generates. This is useful for:

- Species-specific variations
- Optional body parts not in the template
- Asymmetric features
- Special attachments

**Format**: Object with slot keys and slot definitions (same format as V1 slots).

### Example: Spider with Venom Gland and Spinnerets

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0",
  "root": "anatomy:spider_cephalothorax",
  "structureTemplate": "anatomy:structure_arachnid_8leg",
  "additionalSlots": {
    "venom_gland": {
      "socket": "venom_gland",
      "requirements": {
        "partType": "venom_gland",
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

The template generates 8 leg sockets + 2 pedipalp sockets + 1 posterior torso socket (11 total). The `additionalSlots` adds 2 more sockets: venom gland and spinnerets.

**Actual File**: See `data/mods/anatomy/blueprints/giant_spider.blueprint.json`

## Clothing Slot Mappings

Both V1 and V2 support `clothingSlotMappings` identically. These map clothing slots to anatomy attachment points.

```json
{
  "clothingSlotMappings": {
    "torso_upper": {
      "anatomySockets": ["chest", "upper_back"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    },
    "legs": {
      "blueprintSlots": ["left_leg", "right_leg"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    }
  }
}
```

**See**: [Clothing system documentation](../mods/anatomy-formatting.md) for clothing slot details.

## Blueprint Validation Rules

The schema enforces mutual exclusivity between V1 and V2 features:

### V2 Blueprint Requirements

When `schemaVersion: "2.0"`:
- **Required**: `id`, `root`, `schemaVersion`, `structureTemplate`
- **Allowed**: `additionalSlots`, `clothingSlotMappings`, `description`, `$schema`
- **Forbidden**: `slots`, `parts`, `compose`

Attempting to use V1 features in a V2 blueprint will fail validation:

```json
// ❌ INVALID - Cannot use slots with V2
{
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_arachnid_8leg",
  "slots": {  // ERROR: slots not allowed in V2
    "extra": { /* ... */ }
  }
}
```

Use `additionalSlots` instead:

```json
// ✅ VALID - Use additionalSlots
{
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_arachnid_8leg",
  "additionalSlots": {
    "extra": { /* ... */ }
  }
}
```

### V1 Blueprint Requirements

When `schemaVersion: "1.0"` or omitted:
- **Required**: `id`, `root`
- **Allowed**: `slots`, `parts`, `compose`, `clothingSlotMappings`, `description`, `$schema`
- **Forbidden**: `schemaVersion: "2.0"`, `structureTemplate`, `additionalSlots`

Attempting to use V2 features in a V1 blueprint will fail validation:

```json
// ❌ INVALID - Cannot use structureTemplate without schemaVersion: "2.0"
{
  "id": "anatomy:example",
  "root": "anatomy:torso",
  "structureTemplate": "anatomy:structure_example"  // ERROR: requires schemaVersion: "2.0"
}
```

---

# Part 2: Structure Templates

## Basic Template Structure

Structure templates define the topology of a creature's body using a parameterized template system. They enable declarative definition of non-human body structures with repeating elements like multiple legs, wings, tentacles, or other appendages.

Every structure template requires:
- `id`: Unique namespaced identifier
- `topology`: Defines the root body part type
- `topology.rootType`: Expected entity type for the root part (e.g., "torso", "cephalothorax")

Optional elements:
- `description`: Human-readable description of the template
- `topology.limbSets`: Array of limb set definitions (legs, arms, wings, etc.)
- `topology.appendages`: Array of appendage definitions (head, tail, etc.)

### Minimal Template Example

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_minimal",
  "description": "Minimal structure with just a torso root",
  "topology": {
    "rootType": "torso"
  }
}
```

This minimal template creates a blueprint that expects a single root part of type "torso" with no additional limbs or appendages.

## Limb Sets

Limb sets define repeated limb structures (legs, arms, wings, tentacles) that attach to the root body part. Each limb set generates multiple sockets automatically.

### Limb Set Properties

- **type** (required): Limb type identifier (e.g., "leg", "arm", "tentacle", "wing")
- **count** (required): Number of limbs (1-100)
- **socketPattern** (required): Pattern for generating socket IDs
- **arrangement** (optional): Spatial arrangement pattern
- **optional** (optional, default false): Whether these limbs can be omitted
- **arrangementHint** (optional): Custom arrangement description

### Available Arrangement Types

- **bilateral**: Left/right pairs (e.g., human arms/legs)
- **radial**: Circular arrangement (e.g., starfish arms)
- **quadrupedal**: Four legs arrangement
- **linear**: Line arrangement (e.g., centipede legs)
- **custom**: User-defined with arrangementHint

## Appendages

Appendages define singular or multiple body parts that attach to specific locations on the root part (head, tail, abdomen, stingers, etc.). Unlike limb sets, appendages have explicit attachment locations.

### Appendage Properties

- **type** (required): Appendage type (e.g., "head", "tail", "abdomen")
- **count** (required): Number of appendages (1-10)
- **attachment** (required): Anatomical attachment location
- **socketPattern** (required): Pattern for generating socket IDs
- **optional** (optional, default false): Whether appendage can be omitted

### Attachment Locations

- **anterior**: Front attachment point
- **posterior**: Back attachment point
- **dorsal**: Top attachment point
- **ventral**: Bottom attachment point
- **lateral**: Side attachment point
- **custom**: Specified in socketPattern

## Orientation Schemes

Orientation schemes determine how socket IDs are generated for limbs in a set. The scheme affects the `{{orientation}}` and `{{position}}` template variables and is critical for maintaining synchronization between sockets and slots.

**Architecture Note**: Socket and slot generation use the **OrientationResolver** (`src/anatomy/shared/orientationResolver.js`) as the single source of truth for orientation logic. This shared module ensures synchronization between socket IDs and slot keys.

**Key Design Principles**:
- Accepts 1-based indices (converts internally to 0-based)
- Always returns valid strings (uses `String(index)` as fallback)
- Uses anatomical terms (anterior/posterior) not directional (front/back) for octagonal arrangements
- Position names follow conventions (left_front not front_left)

### bilateral (default for left/right pairs)

Produces orientations: `left`, `right`, or `mid` (for center).

For quadrupedal arrangements (4 limbs), combines with position to produce:
- `left_front`, `right_front`
- `left_rear`, `right_rear`

```json
"socketPattern": {
  "idTemplate": "arm_{{orientation}}",
  "orientationScheme": "bilateral",
  "allowedTypes": ["human_arm"]
}
```

**Generates**: `arm_left`, `arm_right`

**Example Usage**:
```javascript
// Bilateral scheme (2 items)
OrientationResolver.resolveOrientation('bilateral', 1, 2); // 'left'
OrientationResolver.resolveOrientation('bilateral', 2, 2); // 'right'

// Quadrupedal scheme (4 items)
OrientationResolver.resolveOrientation('bilateral', 1, 4); // 'left_front'
OrientationResolver.resolveOrientation('bilateral', 4, 4); // 'right_rear'
```

### radial (for circular arrangements)

Uses angular positions. Configure with `angleStep` or explicit `positions` array.

For 8-item radial arrangements, uses special octagonal layout with anatomical terms:

```json
"socketPattern": {
  "idTemplate": "tentacle_{{position}}",
  "orientationScheme": "radial",
  "allowedTypes": ["tentacle"],
  "positions": ["anterior", "anterior_right", "right", "posterior_right",
                "posterior", "posterior_left", "left", "anterior_left"]
}
```

**Example Usage**:
```javascript
// Radial scheme (8 items - octagonal)
OrientationResolver.resolveOrientation('radial', 1, 8); // 'anterior'
OrientationResolver.resolveOrientation('radial', 3, 8); // 'right'
```

### indexed (for numeric sequences)

Produces numeric indices: 1, 2, 3, ...

```json
"socketPattern": {
  "idTemplate": "leg_{{index}}",
  "orientationScheme": "indexed",
  "allowedTypes": ["spider_leg"]
}
```

**Generates**: `leg_1`, `leg_2`, `leg_3`, etc.

### custom (explicit positions)

Use the `positions` array to specify exact position names.

```json
"socketPattern": {
  "idTemplate": "limb_{{position}}",
  "orientationScheme": "custom",
  "allowedTypes": ["custom_limb"],
  "positions": ["alpha", "beta", "gamma", "delta"]
}
```

**Generates**: `limb_alpha`, `limb_beta`, `limb_gamma`, `limb_delta`

## Socket Pattern Template Variables

Template variables expand during socket generation. Available variables depend on context:

### {{index}}

Numeric index (1-based) for the current limb in the set.

**Usage**: `"leg_{{index}}"` → `leg_1`, `leg_2`, ...

### {{orientation}}

Computed from `orientationScheme`:
- bilateral: `left`, `right`, `mid`
- quadrupedal: `left_front`, `right_front`, `left_rear`, `right_rear`
- radial: computed angle or position name
- indexed: numeric index

**Usage**: `"arm_{{orientation}}"` → `arm_left`, `arm_right`

### {{position}}

Named position from `positions` array (custom/radial schemes).

**Usage**: `"tentacle_{{position}}"` → uses position from positions array

### {{type}}

Part type from `allowedTypes` array.

**Usage**: `"{{type}}_socket"` → `leg_socket`, `arm_socket`

### Static Templates

Templates without variables are valid:

```json
"socketPattern": {
  "idTemplate": "head",
  "allowedTypes": ["dragon_head"]
}
```

**Generates** single socket: `head`

## Name Templates

The `nameTpl` property controls auto-naming of attached parts. Default: `"{{type}} {{index}}"`.

Examples:

```json
"nameTpl": "{{type}} {{index}}"          // "leg 1", "leg 2"
"nameTpl": "{{orientation}} {{type}}"    // "left arm", "right arm"
"nameTpl": "tentacle {{index}}"          // "tentacle 1", "tentacle 2"
"nameTpl": "head"                        // "head" (static)
```

## Template Validation Requirements

Structure templates are validated at load time against the schema:
- **Schema Location**: `data/schemas/anatomy.structure-template.schema.json`
- **Validation Timing**: During mod loading phase
- **Validator**: AJV schema validator in `src/validation/ajvSchemaValidator.js`

**Common Validation Errors**:
- Missing required fields (id, topology.rootType)
- Invalid count ranges (limbSets: 1-100, appendages: 1-10)
- Malformed socket patterns
- Invalid orientation schemes

**Important**: Recipe patterns must match the slot structure generated by your template. If you change a template's socket pattern, update corresponding recipes. See [Troubleshooting](#troubleshooting) for pattern matching issues.

---

# Part 3: Complete Examples

## Example 1: Spider (8 Legs)

### Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_arachnid_8leg",
  "description": "Eight-legged arachnid body plan with pedipalps and abdomen attachment",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "arrangement": "radial",
        "arrangementHint": "four_pairs_bilateral",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_leg"],
          "nameTpl": "leg {{index}}"
        }
      }
    ],
    "appendages": [
      {
        "type": "pedipalp",
        "count": 2,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "pedipalp_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_pedipalp"],
          "nameTpl": "pedipalp {{index}}"
        }
      },
      {
        "type": "torso",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "posterior_torso",
          "allowedTypes": ["spider_abdomen"],
          "nameTpl": "torso"
        }
      }
    ]
  }
}
```

### Blueprint V2

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0",
  "root": "anatomy:spider_cephalothorax",
  "structureTemplate": "anatomy:structure_arachnid_8leg"
}
```

**Generated Sockets**:
- Socket IDs: `leg_1`, `leg_2`, ... `leg_8` for legs
- Socket IDs: `pedipalp_1`, `pedipalp_2` for pedipalps
- Socket ID: `posterior_torso` for the posterior torso/abdomen
- Each socket specifies allowed part types
- Auto-naming for attached parts

**Actual File**: See `data/mods/anatomy/blueprints/giant_spider.blueprint.json` (includes additional venom gland and spinnerets slots)

**Actual Template**: See `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json`

## Example 2: Dragon (Wings + Legs)

### Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_winged_quadruped",
  "description": "Winged quadruped body plan with four legs, bilateral wings, and axial appendages",
  "topology": {
    "rootType": "torso",
    "limbSets": [
      {
        "type": "leg",
        "count": 4,
        "arrangement": "quadrupedal",
        "arrangementHint": "front_rear_pairs",
        "socketPattern": {
          "idTemplate": "leg_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["dragon_leg", "reptilian_leg"],
          "nameTpl": "{{orientation}} leg"
        }
      },
      {
        "type": "wing",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "wing_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["dragon_wing", "bat_wing"],
          "nameTpl": "{{orientation}} wing"
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
          "allowedTypes": ["dragon_head", "reptilian_head"],
          "nameTpl": "head"
        }
      },
      {
        "type": "tail",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "tail",
          "allowedTypes": ["dragon_tail", "reptilian_tail"],
          "nameTpl": "tail"
        }
      }
    ]
  }
}
```

### Blueprint V2

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:red_dragon",
  "schemaVersion": "2.0",
  "root": "anatomy:dragon_torso",
  "structureTemplate": "anatomy:structure_winged_quadruped",
  "additionalSlots": {
    "fire_gland": {
      "socket": "fire_gland",
      "requirements": {
        "partType": "gland",
        "components": ["anatomy:part", "anatomy:fire_breathing"]
      }
    }
  },
  "clothingSlotMappings": {
    "saddle": {
      "anatomySockets": ["back_mount"],
      "allowedLayers": ["armor", "accessory"]
    },
    "wing_harness": {
      "blueprintSlots": ["wing_left", "wing_right"],
      "allowedLayers": ["base", "outer", "armor"]
    }
  }
}
```

**Generated Sockets**:
- Leg sockets: `leg_left_front`, `leg_right_front`, `leg_left_rear`, `leg_right_rear`
- Wing sockets: `wing_left`, `wing_right`
- Head socket: `head`
- Tail socket: `tail`

**Actual File**: See `data/mods/anatomy/blueprints/red_dragon.blueprint.json`

**Actual Template**: See `data/mods/anatomy/structure-templates/structure_winged_quadruped.structure-template.json`

## Example 3: Centaur (Hybrid Structure)

### Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_centauroid",
  "description": "Hybrid centaur body plan with quadruped base and humanoid upper body",
  "topology": {
    "rootType": "torso",
    "limbSets": [
      {
        "type": "leg",
        "count": 4,
        "arrangement": "quadrupedal",
        "arrangementHint": "equine_lower_body",
        "socketPattern": {
          "idTemplate": "leg_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["horse_leg", "equine_leg", "centaur_leg"],
          "nameTpl": "{{orientation}} leg"
        }
      },
      {
        "type": "arm",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "arm_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["human_arm", "humanoid_arm", "centaur_arm"],
          "nameTpl": "{{orientation}} arm"
        }
      }
    ],
    "appendages": [
      {
        "type": "upper_torso",
        "count": 1,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "upper_torso",
          "allowedTypes": ["human_torso", "humanoid_torso", "centaur_upper_torso"],
          "nameTpl": "upper torso"
        }
      },
      {
        "type": "head",
        "count": 1,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "head",
          "allowedTypes": ["human_head", "humanoid_head", "centaur_head"],
          "nameTpl": "head"
        }
      },
      {
        "type": "tail",
        "count": 1,
        "attachment": "posterior",
        "optional": true,
        "socketPattern": {
          "idTemplate": "tail",
          "allowedTypes": ["horse_tail", "equine_tail"],
          "nameTpl": "tail"
        }
      }
    ]
  }
}
```

### Blueprint V2

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:centaur_warrior",
  "schemaVersion": "2.0",
  "root": "anatomy:centaur_torso",
  "structureTemplate": "anatomy:structure_centauroid",
  "additionalSlots": {
    "quiver_mount": {
      "socket": "back_upper",
      "requirements": {
        "partType": "equipment_mount",
        "components": ["anatomy:part"]
      },
      "optional": true
    }
  },
  "clothingSlotMappings": {
    "torso_upper": {
      "blueprintSlots": ["upper_torso", "arm_left", "arm_right"],
      "allowedLayers": ["base", "outer", "armor"]
    },
    "legs_equine": {
      "blueprintSlots": [
        "leg_left_front",
        "leg_right_front",
        "leg_left_rear",
        "leg_right_rear"
      ],
      "allowedLayers": ["base", "outer", "armor"]
    }
  }
}
```

**Actual File**: See `data/mods/anatomy/blueprints/centaur_warrior.blueprint.json`

## Example 4: Gryphon (Mixed Limb Types)

### Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_gryphon",
  "description": "Gryphon with eagle head, wings, and quadrupedal lion body",
  "topology": {
    "rootType": "torso",
    "limbSets": [
      {
        "type": "leg",
        "count": 4,
        "arrangement": "quadrupedal",
        "socketPattern": {
          "idTemplate": "leg_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["lion_leg", "eagle_talon"],
          "nameTpl": "{{orientation}} leg"
        },
        "arrangementHint": "front_talons_rear_paws"
      },
      {
        "type": "wing",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "wing_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["eagle_wing", "feathered_wing"],
          "nameTpl": "{{orientation}} wing"
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
          "allowedTypes": ["eagle_head", "raptor_head"],
          "nameTpl": "head"
        }
      },
      {
        "type": "tail",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "tail",
          "allowedTypes": ["lion_tail", "feline_tail"],
          "nameTpl": "tail"
        }
      }
    ]
  }
}
```

**Generated Sockets**:
- 4 leg sockets: `leg_left_front`, `leg_right_front`, `leg_left_rear`, `leg_right_rear`
- 2 wing sockets: `wing_left`, `wing_right`
- Head socket: `head`
- Tail socket: `tail`

## Example 5: Octopoid (Radial Symmetry)

### Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_octopoid",
  "description": "Octopoid mantle with radial tentacles and anterior head attachment",
  "topology": {
    "rootType": "mantle",
    "limbSets": [
      {
        "type": "tentacle",
        "count": 8,
        "arrangement": "radial",
        "socketPattern": {
          "idTemplate": "tentacle_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["tentacle"],
          "nameTpl": "tentacle {{index}}"
        },
        "arrangementHint": "octagonal_radial"
      }
    ],
    "appendages": [
      {
        "type": "head",
        "count": 1,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "head",
          "allowedTypes": ["head"],
          "nameTpl": "head"
        }
      }
    ]
  }
}
```

---

# Part 4: Migration from V1 to V2

## Step 1: Analyze Your V1 Blueprint

Identify repeating patterns in your V1 slots:

**V1 Example** (excerpt):
```json
{
  "slots": {
    "leg_1": {
      "socket": "leg_1",
      "requirements": { "partType": "spider_leg" }
    },
    "leg_2": {
      "socket": "leg_2",
      "requirements": { "partType": "spider_leg" }
    },
    // ... 6 more legs
  }
}
```

## Step 2: Create a Structure Template

Create a template that generates these sockets:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_arachnid_8leg",
  "description": "Eight-legged arachnid body plan with pedipalps and abdomen attachment",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "arrangement": "radial",
        "arrangementHint": "four_pairs_bilateral",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_leg"],
          "nameTpl": "leg {{index}}"
        }
      }
    ],
    "appendages": [
      {
        "type": "pedipalp",
        "count": 2,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "pedipalp_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_pedipalp"],
          "nameTpl": "pedipalp {{index}}"
        }
      },
      {
        "type": "torso",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "posterior_torso",
          "allowedTypes": ["spider_abdomen"],
          "nameTpl": "torso"
        }
      }
    ]
  }
}
```

**Actual File**: See `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json`

## Step 3: Convert Blueprint to V2

Replace manual slots with template reference:

**V2 Conversion**:
```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0",
  "root": "anatomy:spider_cephalothorax",
  "structureTemplate": "anatomy:structure_arachnid_8leg"
}
```

## Step 4: Add Additional Slots (if needed)

If your V1 blueprint had unique sockets not covered by the template:

```json
{
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_arachnid_8leg",
  "additionalSlots": {
    "venom_gland": {
      "socket": "venom_gland",
      "requirements": {
        "partType": "venom_gland",
        "components": ["anatomy:part", "anatomy:venom"]
      },
      "optional": true
    }
  }
}
```

## Step 5: Preserve Clothing Mappings

Copy `clothingSlotMappings` directly (format is identical):

```json
{
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_arachnid_8leg",
  "clothingSlotMappings": {
    "cephalothorax": {
      "anatomySockets": ["chest", "back"],
      "allowedLayers": ["base", "armor"]
    }
  }
}
```

## Complete Migration Example

### Before (V1): Hypothetical Humanoid Dragon

**Note**: This is an illustrative example. The actual codebase uses `anatomy:red_dragon` with `anatomy:structure_winged_quadruped` (a quadruped dragon, not humanoid).

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:dragon_humanoid_v1",
  "root": "anatomy:dragon_torso",
  "slots": {
    "left_arm": {
      "socket": "left_shoulder",
      "requirements": {
        "partType": "arm",
        "components": ["anatomy:part"]
      }
    },
    "right_arm": {
      "socket": "right_shoulder",
      "requirements": {
        "partType": "arm",
        "components": ["anatomy:part"]
      }
    },
    "left_wing": {
      "socket": "left_wing_socket",
      "requirements": {
        "partType": "wing",
        "components": ["anatomy:part"]
      }
    },
    "right_wing": {
      "socket": "right_wing_socket",
      "requirements": {
        "partType": "wing",
        "components": ["anatomy:part"]
      }
    },
    "left_leg": {
      "socket": "left_hip",
      "requirements": {
        "partType": "leg",
        "components": ["anatomy:part"]
      }
    },
    "right_leg": {
      "socket": "right_hip",
      "requirements": {
        "partType": "leg",
        "components": ["anatomy:part"]
      }
    },
    "head": {
      "socket": "neck",
      "requirements": {
        "partType": "head",
        "components": ["anatomy:part"]
      }
    },
    "tail": {
      "socket": "tail_socket",
      "requirements": {
        "partType": "tail",
        "components": ["anatomy:part"]
      }
    }
  },
  "clothingSlotMappings": {
    "torso": {
      "anatomySockets": ["chest", "back"],
      "allowedLayers": ["base", "outer", "armor"]
    }
  }
}
```

**Line count**: ~60 lines
**Sockets**: 8 manually defined

### After (V2): Same Dragon (Hypothetical)

**Structure Template** (`anatomy:structure_humanoid_dragon` - hypothetical):
```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_humanoid_dragon",
  "description": "Humanoid dragon with arms, legs, wings, and tail",
  "topology": {
    "rootType": "torso",
    "limbSets": [
      {
        "type": "arm",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "arm_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["dragon_arm", "scaled_arm"],
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
          "allowedTypes": ["dragon_leg", "scaled_leg"],
          "nameTpl": "{{orientation}} leg"
        }
      },
      {
        "type": "wing",
        "count": 2,
        "arrangement": "bilateral",
        "socketPattern": {
          "idTemplate": "wing_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["dragon_wing", "bat_wing"],
          "nameTpl": "{{orientation}} wing"
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
          "allowedTypes": ["dragon_head", "reptilian_head"],
          "nameTpl": "head"
        }
      },
      {
        "type": "tail",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "tail",
          "allowedTypes": ["dragon_tail", "reptilian_tail"],
          "nameTpl": "tail"
        }
      }
    ]
  }
}
```

**Blueprint V2**:
```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:dragon_humanoid_v2",
  "schemaVersion": "2.0",
  "root": "anatomy:dragon_torso",
  "structureTemplate": "anatomy:structure_humanoid_dragon",
  "clothingSlotMappings": {
    "torso": {
      "anatomySockets": ["chest", "back"],
      "allowedLayers": ["base", "outer", "armor"]
    }
  }
}
```

**Line count**: 13 lines for blueprint + template is reusable
**Sockets**: Same 8 sockets, generated automatically
**Benefit**: Template can be reused for other dragon species

---

# Part 5: Best Practices

## Blueprint Best Practices

### 1. Use V2 for Non-Humanoids

V2 shines for creatures with repeating limbs. Don't use V1 just because you're familiar with it.

```json
// ❌ BAD: V1 for spider (verbose, error-prone)
"slots": {
  "leg_1": { /* ... */ },
  "leg_2": { /* ... */ },
  // ... 6 more manual entries
}

// ✅ GOOD: V2 for spider (concise, maintainable)
"schemaVersion": "2.0",
"structureTemplate": "anatomy:structure_arachnid_8leg"
```

### 2. Use additionalSlots Sparingly

Only add slots that are truly unique. Don't duplicate template-generated sockets:

```json
// ❌ BAD: Duplicating what template generates
"additionalSlots": {
  "leg_9": { /* ... */ }  // Template already generates 8 legs
}

// ✅ GOOD: Adding unique feature
"additionalSlots": {
  "venom_gland": { /* ... */ }  // Not in template
}
```

### 3. Version Control Your Migration

Keep V1 blueprints as backups during migration:
- `anatomy:dragon_v1` (old)
- `anatomy:dragon_v2` (new)

Once tested, you can replace the V1 version.

## Template Best Practices

### 1. Create Reusable Templates

Structure templates should be generic and reusable:

```json
// ✅ GOOD: Generic "arachnid" template
"id": "anatomy:structure_arachnid_8leg",
"description": "Eight-legged arachnid body plan with pedipalps and abdomen attachment"

// ❌ BAD: Over-specific template
"id": "anatomy:structure_garden_spider_red",
"description": "Red garden spider only"
```

### 2. Descriptive Type Names

Use type names that match your entity `partType` values:

```json
// ✅ GOOD
"type": "leg",
"allowedTypes": ["spider_leg", "insect_leg"]

// ❌ BAD: Ambiguous types
"type": "limb",
"allowedTypes": ["thing"]
```

### 3. Reasonable Counts

Keep counts manageable:
- **limbSets**: 1-100 (schema enforces maximum)
- **appendages**: 1-10 (schema enforces maximum)
- **Practical**: Most creatures need ≤20 limbs, ≤5 appendages

```json
// ✅ Reasonable
"count": 8  // spider legs

// ⚠️ Excessive (but valid)
"count": 100  // centipede legs
```

### 4. Choose Appropriate Orientation Scheme

Match the arrangement to the orientation scheme:

- **bilateral**: Pairs (arms, wings)
- **quadrupedal**: Four legs
- **radial**: Circular (starfish, spider)
- **indexed**: Simple sequences
- **custom**: Irregular patterns

### 5. Document Custom Arrangements

Use `arrangementHint` for custom layouts:

```json
"arrangementHint": "4_pairs_bilateral"
"arrangementHint": "hexagonal_radial"
"arrangementHint": "staggered_linear"
```

### 6. Allow Type Flexibility

Include multiple `allowedTypes` for flexibility:

```json
"allowedTypes": ["dragon_leg", "reptilian_leg", "scaled_leg"]
```

This allows recipe authors to choose between different part variations.

### 7. Mark Optional Elements

Use `optional: true` for parts that can be omitted:

```json
{
  "type": "tail",
  "count": 1,
  "attachment": "posterior",
  "optional": true,
  "socketPattern": { /* ... */ }
}
```

### 8. Test Templates by Creating Blueprints

Always test structure templates by creating a Blueprint V2 that references them:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:test_spider",
  "schemaVersion": "2.0",
  "root": "anatomy:spider_cephalothorax",
  "structureTemplate": "anatomy:structure_spider"
}
```

### 9. Document Your Templates

Always include clear `description` in templates:

```json
"description": "Octopoid with 8 tentacles, mantle, head, and siphon"
```

---

# Part 6: Troubleshooting

## Error: "slots not allowed in schemaVersion 2.0"

**Cause**: Using V1 `slots` property with V2.
**Fix**: Use `additionalSlots` instead, or remove `schemaVersion: "2.0"`.

## Error: "structureTemplate required when schemaVersion is 2.0"

**Cause**: Declared V2 without providing a template reference.
**Fix**: Add `"structureTemplate": "anatomy:your_template_id"`.

## Error: "structureTemplate not allowed in schemaVersion 1.0"

**Cause**: Using V2 feature in V1 blueprint.
**Fix**: Add `"schemaVersion": "2.0"` or remove `structureTemplate`.

## Generated Sockets Don't Match Expectations

**Cause**: Template orientation scheme or idTemplate mismatch.
**Fix**: Review template `socketPattern` settings. Test with a simple blueprint first.

## Cannot Find Structure Template

**Cause**: Template ID doesn't exist or hasn't been loaded.
**Fix**: Verify template exists in `data/mods/anatomy/structure-templates/` (or other mod's structure-templates directory) and is loaded before the blueprint.

## Recipe Patterns Don't Match Generated Slots

**Cause**: Recipe pattern doesn't match the socket pattern generated by the template.
**Fix**:
1. Check what sockets your template generates (use the OrientationResolver logic)
2. Update recipe patterns to match the generated socket IDs
3. See [Recipe Pattern Matching](./recipe-pattern-matching.md) for pattern matching strategies
4. See [Troubleshooting Guide](./troubleshooting.md) for detailed diagnostics

## Orientation Mismatch (Slots vs Sockets)

**Cause**: Recipe uses different orientation scheme than template.
**Fix**:
1. Check the template's `orientationScheme` setting
2. Ensure recipes use matching patterns
3. Remember: OrientationResolver is the single source of truth
4. See [Common Creature Patterns](./recipe-pattern-matching.md#part-4-common-creature-patterns) for examples

---

# Related Documentation

## Core Documentation
- **Recipe Pattern Matching**: [recipe-pattern-matching.md](./recipe-pattern-matching.md) - Pattern matching for template-generated slots
- **Common Creature Patterns**: [recipe-pattern-matching.md#part-4-common-creature-patterns](./recipe-pattern-matching.md#part-4-common-creature-patterns) - Complete creature examples
- **Quick Start**: [non-human-quickstart.md](./non-human-quickstart.md) - End-to-end tutorial
- **Pattern Reference**: [recipe-pattern-matching.md#part-2-pattern-reference](./recipe-pattern-matching.md#part-2-pattern-reference) - Advanced filtering

## System Documentation
- **Troubleshooting Guide**: [troubleshooting.md](./troubleshooting.md) - General troubleshooting
- **Clothing System**: [../mods/anatomy-formatting.md](../mods/anatomy-formatting.md) - Clothing slot details
- **Anatomy System Guide**: [anatomy-system-guide.md](./anatomy-system-guide.md) - System architecture overview

## Code References
- **OrientationResolver**: `src/anatomy/shared/orientationResolver.js` - Orientation logic
- **Blueprint Schema**: `data/schemas/anatomy.blueprint.schema.json` - Blueprint validation
- **Template Schema**: `data/schemas/anatomy.structure-template.schema.json` - Template validation
- **Example Blueprints V1**: `data/mods/anatomy/blueprints/human_*.blueprint.json`
- **Example Blueprints V2**: `data/mods/anatomy/blueprints/kraken.blueprint.json`, `red_dragon.blueprint.json`, `giant_spider.blueprint.json`, `centaur_warrior.blueprint.json`
- **Example Templates**: `data/mods/anatomy/structure-templates/` (includes structure_arachnid_8leg, structure_centauroid, structure_octopoid, structure_winged_quadruped)

---

# Next Steps

1. Review your existing V1 blueprints
2. Identify candidates for V2 migration (creatures with repeating limbs)
3. Create structure templates for common body plans
4. Convert blueprints to V2
5. Update recipes to match new socket names (see [recipe-pattern-matching.md](./recipe-pattern-matching.md))
6. Test by instantiating entities with your anatomy
