# Property-Based Filtering Examples

## Overview

This guide provides practical examples of using the `matchesAll` property-based filtering feature in anatomy recipes. Property-based filtering allows you to target slots based on their intrinsic properties rather than naming patterns or slot groups.

**Feature Status**: ✅ Fully Implemented (Phase 3 - Recipe Pattern Enhancement)

**Related Documentation**:
- [Recipe Patterns](./recipe-patterns.md) - Complete pattern matching reference
- [Blueprint V2](./blueprints-v2.md) - Structure template integration
- [Structure Templates](./structure-templates.md) - Socket generation

## When to Use matchesAll

Use `matchesAll` when you need:
- **Fine-grained control** beyond what `matchesGroup` or `matchesPattern` provide
- **Property-based filtering** on slot characteristics (type, orientation, socket)
- **Multiple filter criteria** combined with AND logic
- **Wildcard patterns** on orientation or socket IDs

## Basic Filter Types

### Filter by slotType

Filter slots that require a specific part type.

**Use Case**: Target all leg slots regardless of naming convention.

```json
{
  "patterns": [
    {
      "matchesAll": {
        "slotType": "limb"
      },
      "partType": "spider_leg",
      "tags": ["anatomy:part", "anatomy:segmented"]
    }
  ]
}
```

**How It Works**:
- Checks each slot's `requirements.partType` property
- Matches only slots where `partType === "limb"`
- Exact match only (no wildcards)

**Example Slots Matched**:
```json
{
  "leg_1": {
    "socket": "leg_1",
    "requirements": {
      "partType": "limb"  // ✅ Matches
    }
  },
  "wing_left": {
    "socket": "wing_left",
    "requirements": {
      "partType": "wing"  // ❌ No match
    }
  }
}
```

### Filter by orientation

Filter slots by their orientation property, with wildcard support.

**Use Case**: Target all left-side parts or all front-facing limbs.

#### Exact Orientation Match

```json
{
  "matchesAll": {
    "orientation": "left"
  },
  "partType": "left_arm",
  "tags": ["anatomy:part"]
}
```

Matches slots with exactly `orientation: "left"`.

#### Wildcard Orientation Pattern

```json
{
  "matchesAll": {
    "orientation": "leg_*"
  },
  "partType": "quadruped_leg",
  "tags": ["anatomy:part"]
}
```

**Pattern Matching**:
- `leg_*` matches: `leg_front_left`, `leg_back_right`, `leg_middle`, etc.
- `*_left` matches: `arm_left`, `wing_left`, `leg_front_left`, etc.
- `*front*` matches: `leg_front_left`, `arm_frontal`, etc.

**Example Slots**:
```json
{
  "leg_1": {
    "orientation": "leg_front_left"  // ✅ Matches "leg_*"
  },
  "leg_2": {
    "orientation": "leg_back_right"  // ✅ Matches "leg_*"
  },
  "wing_left": {
    "orientation": "wing_left"  // ❌ No match
  }
}
```

### Filter by socketId

Filter slots by their socket ID, with wildcard support.

**Use Case**: Match slots connected to specific socket patterns.

```json
{
  "matchesAll": {
    "socketId": "leg_socket_*"
  },
  "partType": "spider_leg",
  "tags": ["anatomy:part"]
}
```

**Example Slots**:
```json
{
  "leg_1": {
    "socket": "leg_socket_1"  // ✅ Matches
  },
  "leg_2": {
    "socket": "leg_socket_2"  // ✅ Matches
  },
  "abdomen": {
    "socket": "abdomen_socket"  // ❌ No match
  }
}
```

## Combined Filters

Combine multiple filters for precise targeting. All specified filters must match (AND logic).

### Example 1: Left-Side Legs Only

```json
{
  "matchesAll": {
    "slotType": "limb",
    "orientation": "left_*"
  },
  "partType": "left_leg",
  "tags": ["anatomy:part"],
  "properties": {
    "anatomy:part": {
      "side": "left"
    }
  }
}
```

**Matches**: Slots with BOTH `slotType: "limb"` AND `orientation` starting with "left_".

### Example 2: Front Legs with Specific Socket Pattern

```json
{
  "matchesAll": {
    "slotType": "leg",
    "orientation": "*_front",
    "socketId": "quadruped_*"
  },
  "partType": "front_leg",
  "tags": ["anatomy:part", "anatomy:clawed"]
}
```

**Matches**: Only slots satisfying ALL three conditions.

### Example 3: Spider Legs by Numbered Sockets

```json
{
  "matchesAll": {
    "slotType": "spider_leg",
    "socketId": "leg_[1-4]"
  },
  "partType": "front_spider_leg",
  "tags": ["anatomy:part"]
}
```

**Note**: Wildcard syntax doesn't support regex ranges. Use explicit patterns or separate patterns.

## Real-World Use Cases

### Use Case 1: Spider Anatomy (8 Radial Legs)

**Scenario**: Create a spider with 8 legs where front pairs have different properties than rear pairs.

**Structure Template Output**:
- Slots: `leg_1`, `leg_2`, ..., `leg_8`
- Orientations: indexed (1-8)

**Recipe with Property Filters**:
```json
{
  "recipeId": "anatomy:spider_garden",
  "blueprintId": "anatomy:spider_common",
  "patterns": [
    {
      "matchesAll": {
        "slotType": "spider_leg",
        "socketId": "leg_[1-2]"
      },
      "partType": "spider_leg_front",
      "tags": ["anatomy:part", "anatomy:sensory"],
      "properties": {
        "anatomy:sensory": {
          "sensitivity": "high"
        }
      }
    },
    {
      "matchesAll": {
        "slotType": "spider_leg",
        "socketId": "leg_*"
      },
      "partType": "spider_leg",
      "tags": ["anatomy:part", "anatomy:segmented"],
      "exclude": {
        "properties": {
          "socketId": "leg_[1-2]"
        }
      }
    }
  ]
}
```

**Result**:
- `leg_1`, `leg_2`: Front legs with sensory properties
- `leg_3`-`leg_8`: Standard legs

### Use Case 2: Dragon with Asymmetric Wings

**Scenario**: Dragon with damaged right wing (different part entity).

**Recipe**:
```json
{
  "recipeId": "anatomy:dragon_wounded",
  "blueprintId": "anatomy:dragon_v2",
  "slots": {
    "wing_right": {
      "partType": "dragon_wing_damaged",
      "preferId": "anatomy:dragon_wing_torn",
      "tags": ["anatomy:part", "anatomy:damaged"]
    }
  },
  "patterns": [
    {
      "matchesAll": {
        "slotType": "wing",
        "orientation": "left"
      },
      "partType": "dragon_wing",
      "tags": ["anatomy:part", "anatomy:membranous"]
    }
  ]
}
```

**Result**:
- Explicit `slots` definition overrides pattern for right wing
- Left wing uses pattern (normal wing)

### Use Case 3: Centaur Hybrid Anatomy

**Scenario**: Centaur with humanoid arms and horse legs.

**Recipe**:
```json
{
  "recipeId": "anatomy:centaur_warrior",
  "blueprintId": "anatomy:centaur_v2",
  "patterns": [
    {
      "matchesAll": {
        "slotType": "limb",
        "orientation": "arm_*"
      },
      "partType": "human_arm",
      "tags": ["anatomy:part", "anatomy:dexterous"]
    },
    {
      "matchesAll": {
        "slotType": "limb",
        "orientation": "leg_*"
      },
      "partType": "horse_leg",
      "tags": ["anatomy:part", "anatomy:hooved"]
    }
  ]
}
```

**Result**:
- Arms: humanoid (dexterous)
- Legs: equine (hooved)

### Use Case 4: Octopus with Specialized Tentacles

**Scenario**: Octopus where two tentacles are modified for manipulation.

**Recipe**:
```json
{
  "recipeId": "anatomy:octopus_intelligent",
  "blueprintId": "anatomy:octopus_common",
  "patterns": [
    {
      "matchesAll": {
        "slotType": "tentacle",
        "socketId": "tentacle_[1-2]"
      },
      "partType": "octopus_tentacle_manipulation",
      "tags": ["anatomy:part", "anatomy:prehensile", "anatomy:dexterous"],
      "properties": {
        "anatomy:prehensile": {
          "strength": 10,
          "dexterity": 8
        }
      }
    },
    {
      "matchesAll": {
        "slotType": "tentacle"
      },
      "partType": "octopus_tentacle",
      "tags": ["anatomy:part", "anatomy:prehensile"],
      "exclude": {
        "properties": {
          "socketId": "tentacle_[1-2]"
        }
      }
    }
  ]
}
```

**Result**:
- First two tentacles: Enhanced manipulation
- Remaining tentacles: Standard

## Pattern Exclusions

Use the `exclude` property to filter out specific slots from a match.

### Exclude by Slot Groups

```json
{
  "matchesAll": {
    "slotType": "leg"
  },
  "partType": "normal_leg",
  "tags": ["anatomy:part"],
  "exclude": {
    "slotGroups": ["limbSet:special_leg"]
  }
}
```

**Effect**: Matches all legs EXCEPT those in the "special_leg" limb set.

### Exclude by Properties

```json
{
  "matchesAll": {
    "slotType": "leg"
  },
  "partType": "outer_leg",
  "tags": ["anatomy:part"],
  "exclude": {
    "properties": {
      "orientation": "mid"
    }
  }
}
```

**Effect**: Matches all legs EXCEPT middle legs.

### Combined Exclusions

```json
{
  "matchesAll": {
    "slotType": "limb",
    "orientation": "leg_*"
  },
  "partType": "standard_leg",
  "tags": ["anatomy:part"],
  "exclude": {
    "slotGroups": ["limbSet:wing"],
    "properties": {
      "socketId": "special_*"
    }
  }
}
```

**Effect**: Matches limbs with `leg_*` orientation, excluding wings and special sockets.

## Wildcard Patterns

Wildcard patterns use `*` to match zero or more characters.

### Common Wildcard Patterns

| Pattern | Matches | Example Slots |
|---------|---------|---------------|
| `leg_*` | Starts with "leg_" | `leg_1`, `leg_front_left`, `leg_back_right` |
| `*_left` | Ends with "_left" | `arm_left`, `wing_left`, `leg_front_left` |
| `*front*` | Contains "front" | `leg_front_left`, `arm_frontal`, `front_claw` |
| `leg_front_*` | Starts with "leg_front_" | `leg_front_left`, `leg_front_right` |
| `*` | Matches everything | All slots (rarely useful) |

### Pattern Conversion

Internally, wildcards are converted to regex:
- `leg_*` → `/^leg_.*$/`
- `*_left` → `/^.*_left$/`
- `*front*` → `/^.*front.*$/`

### Escaping Special Characters

If your socket IDs contain regex special characters, they're automatically escaped:
- `leg_[1]` is treated as literal `leg_[1]`, not a character class
- Use `leg_*` for pattern matching, not `leg_[1-8]`

## Best Practices

### 1. Use Most Specific Filter First

```json
// ✅ GOOD: Specific filter before general
"patterns": [
  {
    "matchesAll": {
      "slotType": "leg",
      "orientation": "front_*"
    },
    "partType": "front_leg"
  },
  {
    "matchesAll": {
      "slotType": "leg"
    },
    "partType": "rear_leg"
  }
]
```

### 2. Combine Filters for Precision

```json
// ❌ BAD: Too broad
{
  "matchesAll": {
    "orientation": "*_left"
  }
}

// ✅ GOOD: Specific
{
  "matchesAll": {
    "slotType": "leg",
    "orientation": "*_left"
  }
}
```

### 3. Use Explicit Slots for Unique Cases

```json
{
  "slots": {
    "special_tentacle": {
      "partType": "golden_tentacle",
      "tags": ["anatomy:part", "anatomy:golden"]
    }
  },
  "patterns": [
    {
      "matchesAll": {
        "slotType": "tentacle"
      },
      "partType": "normal_tentacle"
    }
  ]
}
```

### 4. Document Complex Filters

Add comments in your recipe files (if JSON5 or with separate docs):

```json
{
  "patterns": [
    {
      "matchesAll": {
        "slotType": "limb",
        "orientation": "leg_*",
        "socketId": "quadruped_*"
      },
      "partType": "front_leg"
    }
  ]
}
```

Add description: "Targets front quadruped legs with specific socket pattern"

### 5. Test with Debug Entities

Create test entities to verify filter behavior:
- Instantiate entity with your recipe
- Inspect generated anatomy
- Verify correct parts in correct slots

## Troubleshooting

### Filter Doesn't Match Expected Slots

**Problem**: Pattern matches fewer slots than expected.

**Solution**:
1. Check slot property names exactly match (case-sensitive)
2. Verify slots have the properties you're filtering on
3. Use explicit `slots` temporarily to debug slot structure

### Filter Matches Too Many Slots

**Problem**: Pattern matches more slots than intended.

**Solution**:
1. Add more specific filters (combine multiple properties)
2. Use exclusions to filter out unwanted matches
3. Use more specific wildcard patterns

### Wildcard Pattern Not Working

**Problem**: Wildcard pattern like `leg_*` doesn't match.

**Solution**:
1. Verify property supports wildcards (orientation and socketId do, slotType doesn't)
2. Check for typos in pattern
3. Remember patterns are case-sensitive

### Conflicts Between Patterns

**Problem**: Multiple patterns match the same slot.

**Solution**:
1. Use explicit `slots` to override patterns (highest priority)
2. Make patterns mutually exclusive with better filters
3. Use exclusions to prevent overlap

## Performance Considerations

Property-based filtering is efficient for most use cases:

- **Small creatures** (1-20 slots): Negligible performance impact
- **Medium creatures** (20-100 slots): Fast pattern matching
- **Large creatures** (100+ slots): Still performant, filters process in O(n) time

**Optimization Tips**:
- Combine filters when possible (fewer pattern iterations)
- Use slot groups (`matchesGroup`) for template-generated slots when applicable
- Cache-friendly: filters are evaluated once during blueprint processing

## Migration from Other Pattern Types

### From matchesGroup

```json
// Before: matchesGroup
{
  "matchesGroup": "limbSet:leg"
}

// After: matchesAll (if you need more control)
{
  "matchesAll": {
    "slotType": "leg"
  }
}
```

**When to migrate**: Need to filter by additional properties beyond limb set.

### From matchesPattern

```json
// Before: matchesPattern
{
  "matchesPattern": "leg_*"
}

// After: matchesAll
{
  "matchesAll": {
    "socketId": "leg_*"
  }
}
```

**When to migrate**: Need to combine naming patterns with type or orientation filters.

## Reference

**Implementation**: `/src/anatomy/recipePatternResolver.js` (lines 346-395)
**Schema**: `/data/schemas/anatomy.recipe.schema.json` (lines 299-318)
**Tests**: `/tests/unit/anatomy/recipePatternResolver.test.js` (lines 445-577)

## Related Documentation

- [Recipe Patterns](./recipe-patterns.md) - Complete pattern matching reference
- [Blueprint V2](./blueprints-v2.md) - Structure template integration
- [V1 to V2 Migration Guide](./v1-to-v2-pattern-migration.md) - Migration guide
- [Best Practices](./pattern-matching-best-practices.md) - Pattern selection guide
- [Common Non-Human Patterns](./common-non-human-patterns.md) - Species-specific examples
