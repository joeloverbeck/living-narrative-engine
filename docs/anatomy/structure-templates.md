# Structure Templates

## Overview

Body structure templates define the topology of a creature's body using a parameterized template system. They enable declarative definition of non-human body structures with repeating elements like multiple legs, wings, tentacles, or other appendages.

**Schema Location**: `data/schemas/anatomy.structure-template.schema.json`

Structure templates are the foundation for creating Blueprint V2 anatomy definitions for non-human creatures. They provide:

- **Declarative topology**: Define body structure without manually creating every socket
- **Parametric generation**: Automatically generate sockets for repeating limbs
- **Flexible arrangements**: Support bilateral, radial, linear, and custom arrangements
- **Template variables**: Use placeholders that expand to specific values during generation

## Basic Template Structure

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

### Example: Spider (8 Legs)

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_spider",
  "description": "Spider body structure with 8 radially arranged legs",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "arrangement": "radial",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_leg"],
          "nameTpl": "leg {{index}}"
        },
        "arrangementHint": "octagonal_radial"
      }
    ],
    "appendages": [
      {
        "type": "abdomen",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "abdomen",
          "allowedTypes": ["spider_abdomen"],
          "nameTpl": "abdomen"
        }
      }
    ]
  }
}
```

This template generates:
- Socket IDs: `leg_1`, `leg_2`, ... `leg_8` for legs
- Socket ID: `abdomen` for the abdomen
- Each socket specifies allowed part types
- Auto-naming for attached parts

### Example: Dragon (Wings + Legs)

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_dragon",
  "description": "Dragon with 4 legs and 2 wings",
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
          "allowedTypes": ["dragon_leg"],
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

This template generates:
- Leg sockets: `leg_left_front`, `leg_right_front`, `leg_left_rear`, `leg_right_rear`
- Wing sockets: `wing_left`, `wing_right`
- Head socket: `head`
- Tail socket: `tail`

### Example: Centaur (Hybrid Structure)

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_centaur",
  "description": "Centaur with humanoid upper body and quadruped lower body",
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
          "allowedTypes": ["horse_leg"],
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
          "allowedTypes": ["human_arm", "humanoid_arm"],
          "nameTpl": "{{orientation}} arm"
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
          "allowedTypes": ["human_head", "humanoid_head"],
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
          "allowedTypes": ["horse_tail"],
          "nameTpl": "tail"
        }
      }
    ]
  }
}
```

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

### Example: Octopoid (Multiple Appendages)

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_octopoid",
  "description": "Octopoid creature with mantle, head, and 8 tentacles",
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
          "allowedTypes": ["octopus_tentacle", "squid_tentacle"],
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
          "allowedTypes": ["octopus_head", "cephalopod_head"],
          "nameTpl": "head"
        }
      },
      {
        "type": "siphon",
        "count": 1,
        "attachment": "ventral",
        "socketPattern": {
          "idTemplate": "siphon",
          "allowedTypes": ["cephalopod_siphon"],
          "nameTpl": "siphon"
        }
      }
    ]
  }
}
```

## Orientation Schemes

Orientation schemes determine how socket IDs are generated for limbs in a set. The scheme affects the `{{orientation}}` template variable.

### bilateral (default for left/right pairs)

Produces orientations: `left`, `right`, or `mid` (for center).

For quadrupedal arrangements, combines with position to produce:
- `left_front`, `right_front`
- `left_rear`, `right_rear`

```json
"socketPattern": {
  "idTemplate": "arm_{{orientation}}",
  "orientationScheme": "bilateral",
  "allowedTypes": ["human_arm"]
}
```

Generates: `arm_left`, `arm_right`

### radial (for circular arrangements)

Uses angular positions. Configure with `angleStep` or explicit `positions`.

```json
"socketPattern": {
  "idTemplate": "tentacle_{{position}}",
  "orientationScheme": "radial",
  "allowedTypes": ["tentacle"],
  "positions": ["anterior", "anterior_right", "right", "posterior_right",
                "posterior", "posterior_left", "left", "anterior_left"]
}
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

Generates: `leg_1`, `leg_2`, `leg_3`, etc.

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

Generates: `limb_alpha`, `limb_beta`, `limb_gamma`, `limb_delta`

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

Generates single socket: `head`

## Name Templates

The `nameTpl` property controls auto-naming of attached parts. Default: `"{{type}} {{index}}"`.

Examples:

```json
"nameTpl": "{{type}} {{index}}"          // "leg 1", "leg 2"
"nameTpl": "{{orientation}} {{type}}"    // "left arm", "right arm"
"nameTpl": "tentacle {{index}}"          // "tentacle 1", "tentacle 2"
"nameTpl": "head"                        // "head" (static)
```

## Best Practices

### 1. Descriptive Type Names

Use type names that match your entity `partType` values:

```json
// Good
"type": "leg",
"allowedTypes": ["spider_leg", "insect_leg"]

// Avoid ambiguous types
"type": "limb",
"allowedTypes": ["thing"]
```

### 2. Reasonable Counts

Keep counts manageable:
- **limbSets**: 1-100 (schema enforces maximum)
- **appendages**: 1-10 (schema enforces maximum)
- **Practical**: Most creatures need ≤20 limbs, ≤5 appendages

```json
// Reasonable
"count": 8  // spider legs

// Excessive (but valid)
"count": 100  // centipede legs
```

### 3. Choose Appropriate Orientation Scheme

Match the arrangement to the orientation scheme:

- **bilateral**: Pairs (arms, wings)
- **quadrupedal**: Four legs
- **radial**: Circular (starfish, spider)
- **indexed**: Simple sequences
- **custom**: Irregular patterns

### 4. Document Custom Arrangements

Use `arrangementHint` for custom layouts:

```json
"arrangementHint": "4_pairs_bilateral"
"arrangementHint": "hexagonal_radial"
"arrangementHint": "staggered_linear"
```

### 5. Test Templates by Creating Blueprints

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

## Complete Example: Gryphon

Here's a complete structure template for a gryphon (eagle head, wings, lion body):

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

This generates:
- 4 leg sockets: `leg_left_front`, `leg_right_front`, `leg_left_rear`, `leg_right_rear`
- 2 wing sockets: `wing_left`, `wing_right`
- Head socket: `head`
- Tail socket: `tail`

## Related Documentation

- **Blueprint V2**: [blueprints-v2.md](./blueprints-v2.md) - How to use structure templates in blueprints
- **Recipe Patterns**: [recipe-patterns.md](./recipe-patterns.md) - Matching slots generated by templates
- **Quick Start**: [non-human-quickstart.md](./non-human-quickstart.md) - Step-by-step tutorial
- **Formatting System**: [../mods/anatomy-formatting.md](../mods/anatomy-formatting.md) - Description generation (separate system)

## Next Steps

1. Create a structure template for your creature
2. Create a Blueprint V2 that references it (see [blueprints-v2.md](./blueprints-v2.md))
3. Create a recipe that populates the slots (see [recipe-patterns.md](./recipe-patterns.md))
4. Test by instantiating entities with your anatomy

## Reference

**Schema File**: `data/schemas/anatomy.structure-template.schema.json`
**Example Templates**: Coming in future mods
**Existing Blueprints**: `data/mods/anatomy/blueprints/` (V1 format - for reference only)
