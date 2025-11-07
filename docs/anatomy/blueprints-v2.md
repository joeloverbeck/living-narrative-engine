# Blueprint V2: Structure Template Integration

## Overview

Blueprint V2 introduces `structureTemplate` references for declarative anatomy definitions, making it dramatically easier to define non-human creatures with repeating limbs. Instead of manually defining every socket, you reference a template that generates sockets automatically.

**Schema Location**: `data/schemas/anatomy.blueprint.schema.json`

**Related Guides**:
- [Recipe Patterns](./recipe-patterns.md) - Pattern matching system for blueprints
- [Common Non-Human Patterns](./common-non-human-patterns.md) - Complete creature examples using V2
- [Property-Based Filtering](./property-based-filtering-examples.md) - Advanced filtering for generated slots

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

### Template Features

Templates support powerful socket generation capabilities:

- **Socket ID Generation**: `idTemplate` with variables (`{{index}}`, `{{orientation}}`, `{{position}}`, `{{type}}`)
- **Automatic Naming**: `nameTpl` generates entity display names (e.g., "left leg", "tentacle 3")
- **Orientation Schemes**:
  - `bilateral` - Left/right alternation
  - `quadrupedal` - Four-leg arrangement (front-left, front-right, rear-left, rear-right)
  - `radial` - Circular arrangement (supports special octagonal layout for 8 items)
  - `indexed` - Numeric sequence (1, 2, 3, ...)
  - `custom` - Explicit positions array
- **Type Restrictions**: `allowedTypes` array constrains which part types can attach to generated sockets

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

## Migration from V1 to V2

### Step 1: Analyze Your V1 Blueprint

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

### Step 2: Create a Structure Template

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

### Step 3: Convert Blueprint to V2

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

### Step 4: Add Additional Slots (if needed)

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

### Step 5: Preserve Clothing Mappings

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

### Real-World Example: Red Dragon

For an actual implementation, see:
- **Blueprint**: `data/mods/anatomy/blueprints/red_dragon.blueprint.json`
- **Template**: `data/mods/anatomy/structure-templates/structure_winged_quadruped.structure-template.json`

The red dragon uses `anatomy:structure_winged_quadruped` which generates a quadruped body plan with 4 legs, 2 wings, head, and tail.

## Validation Rules

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

## Complete V2 Examples

### Example 1: Basic Spider

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0",
  "root": "anatomy:spider_cephalothorax",
  "structureTemplate": "anatomy:structure_arachnid_8leg"
}
```

**Actual File**: See `data/mods/anatomy/blueprints/giant_spider.blueprint.json` (includes additional venom gland and spinnerets slots)

### Example 2: Dragon with Additional Slots

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
    },
    "treasure_pouch": {
      "socket": "treasure_pouch",
      "requirements": {
        "partType": "storage_organ",
        "components": ["anatomy:part"]
      },
      "optional": true
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

**Actual File**: See `data/mods/anatomy/blueprints/red_dragon.blueprint.json`

### Example 3: Centaur

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

## Best Practices

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

### 2. Create Reusable Templates

Structure templates should be generic and reusable:

```json
// ✅ GOOD: Generic "arachnid" template
"id": "anatomy:structure_arachnid_8leg",
"description": "Eight-legged arachnid body plan with pedipalps and abdomen attachment"

// ❌ BAD: Over-specific template
"id": "anatomy:structure_garden_spider_red",
"description": "Red garden spider only"
```

### 3. Use additionalSlots Sparingly

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

### 4. Document Your Templates

Always include clear `description` in templates:

```json
"description": "Octopoid with 8 tentacles, mantle, head, and siphon"
```

### 5. Test Before Migrating

Create test entities with your V2 blueprint before migrating production content.

### 6. Version Control Your Migration

Keep V1 blueprints as backups during migration:
- `anatomy:dragon_v1` (old)
- `anatomy:dragon_v2` (new)

Once tested, you can replace the V1 version.

## Troubleshooting

### Error: "slots not allowed in schemaVersion 2.0"

**Cause**: Using V1 `slots` property with V2.
**Fix**: Use `additionalSlots` instead, or remove `schemaVersion: "2.0"`.

### Error: "structureTemplate required when schemaVersion is 2.0"

**Cause**: Declared V2 without providing a template reference.
**Fix**: Add `"structureTemplate": "anatomy:your_template_id"`.

### Error: "structureTemplate not allowed in schemaVersion 1.0"

**Cause**: Using V2 feature in V1 blueprint.
**Fix**: Add `"schemaVersion": "2.0"` or remove `structureTemplate`.

### Generated Sockets Don't Match Expectations

**Cause**: Template orientation scheme or idTemplate mismatch.
**Fix**: Review template `socketPattern` settings. Test with a simple blueprint first.

### Cannot Find Structure Template

**Cause**: Template ID doesn't exist or hasn't been loaded.
**Fix**: Verify template exists in `data/mods/anatomy/structure-templates/` (or other mod's structure-templates directory) and is loaded before the blueprint.

## Related Documentation

- **Structure Templates**: [structure-templates.md](./structure-templates.md) - Creating templates
- **Recipe Patterns**: [recipe-patterns.md](./recipe-patterns.md) - Populating template-generated slots with pattern matching
- **Quick Start**: [non-human-quickstart.md](./non-human-quickstart.md) - End-to-end tutorial

## Next Steps

1. Review your existing V1 blueprints
2. Identify candidates for V2 migration (creatures with repeating limbs)
3. Create structure templates for common body plans
4. Convert blueprints to V2
5. Update recipes to match new socket names (see [recipe-patterns.md](./recipe-patterns.md))

## Reference

**Schema File**: `data/schemas/anatomy.blueprint.schema.json`
**Example Blueprints V1**: `data/mods/anatomy/blueprints/human_*.blueprint.json`
**Example Blueprints V2**: `data/mods/anatomy/blueprints/kraken.blueprint.json`, `red_dragon.blueprint.json`, `giant_spider.blueprint.json`, `centaur_warrior.blueprint.json`
**Structure Templates**: See [structure-templates.md](./structure-templates.md)
