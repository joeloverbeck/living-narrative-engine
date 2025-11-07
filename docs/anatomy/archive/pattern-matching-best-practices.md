# Pattern Matching Best Practices

## Overview

This guide provides best practices for choosing and using recipe pattern matching features effectively. Understanding when to use each pattern type leads to maintainable, efficient, and clear anatomy recipes.

## Pattern Type Decision Tree

```
Need to populate slots?
├─ Single unique slot → Use explicit slots
├─ Multiple slots from same limb set → Use matchesGroup
├─ Slots follow naming pattern → Use matchesPattern
├─ Need property-based filtering → Use matchesAll
└─ Complex mixed requirements → Combine multiple approaches
```

## When to Use Each Pattern Type

### Explicit slots

**Best For**:
- Single unique slots (head, tail)
- Asymmetric features (damaged wing, prosthetic limb)
- Override a pattern for specific slot
- Slots with unique properties

**Characteristics**:
- Highest priority (overrides all patterns)
- Most explicit and readable
- No ambiguity

**Example**:
```json
{
  "slots": {
    "head": {
      "partType": "dragon_head",
      "preferId": "anatomy:dragon_head_elder",
      "tags": ["anatomy:part", "anatomy:horned"]
    }
  }
}
```

**When NOT to Use**:
- Many repeating limbs (legs, tentacles)
- Template-generated slots
- High maintenance overhead

### matchesGroup

**Best For**:
- Template-generated limb sets
- All slots from one appendage type
- Simple, broad matching

**Characteristics**:
- Works with Structure Templates
- Clean and concise
- Auto-adapts to template changes

**Example**:
```json
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg",
      "tags": ["anatomy:part"]
    }
  ]
}
```

**When NOT to Use**:
- Non-template blueprints
- Need to differentiate within limb set
- Requires property-based filtering

### matchesPattern

**Best For**:
- Slots with consistent naming
- Wildcard matching on slot keys
- Blueprint-agnostic patterns

**Characteristics**:
- Flexible wildcard patterns
- Works with any blueprint structure
- Pattern-based, not template-dependent

**Example**:
```json
{
  "patterns": [
    {
      "matchesPattern": "leg_*",
      "partType": "quadruped_leg",
      "tags": ["anatomy:part"]
    }
  ]
}
```

**When NOT to Use**:
- Inconsistent slot naming
- Need type or orientation filtering
- Template groups available

### matchesAll

**Best For**:
- Fine-grained property filtering
- Combining multiple criteria
- Orientation or socket-based selection
- Complex filtering requirements

**Characteristics**:
- Most powerful and flexible
- Supports wildcards on orientation/socketId
- Multiple filters with AND logic

**Example**:
```json
{
  "patterns": [
    {
      "matchesAll": {
        "slotType": "leg",
        "orientation": "*_left"
      },
      "partType": "left_leg",
      "tags": ["anatomy:part"]
    }
  ]
}
```

**When NOT to Use**:
- Simple cases (use matchesGroup)
- Performance-critical situations (though impact is minimal)
- When simpler patterns suffice

## Complexity Levels

### Level 1: Simple (Explicit Slots Only)

**Use Case**: 1-5 unique slots, no patterns needed.

```json
{
  "slots": {
    "head": { "partType": "human_head", "tags": ["anatomy:part"] },
    "torso": { "partType": "human_torso", "tags": ["anatomy:part"] }
  },
  "patterns": []
}
```

**Pros**: Crystal clear, no ambiguity
**Cons**: Verbose for many slots

### Level 2: Moderate (Single Pattern Type)

**Use Case**: Homogeneous limb sets, consistent structure.

```json
{
  "slots": {},
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg",
      "tags": ["anatomy:part"]
    },
    {
      "matchesGroup": "appendage:abdomen",
      "partType": "spider_abdomen",
      "tags": ["anatomy:part"]
    }
  ]
}
```

**Pros**: Maintainable, scales well
**Cons**: Less control over individual slots

### Level 3: Advanced (Multiple Pattern Types)

**Use Case**: Complex creatures with varied limb requirements.

```json
{
  "slots": {
    "head": {
      "partType": "dragon_head_elder",
      "tags": ["anatomy:part", "anatomy:horned"]
    }
  },
  "patterns": [
    {
      "matchesGroup": "limbSet:wing",
      "partType": "dragon_wing",
      "tags": ["anatomy:part"]
    },
    {
      "matchesAll": {
        "slotType": "leg",
        "orientation": "*_front"
      },
      "partType": "front_leg",
      "tags": ["anatomy:part"]
    },
    {
      "matchesAll": {
        "slotType": "leg",
        "orientation": "*_rear"
      },
      "partType": "rear_leg",
      "tags": ["anatomy:part"]
    }
  ]
}
```

**Pros**: Maximum flexibility and control
**Cons**: Higher complexity, more testing needed

### Level 4: Expert (Patterns + Exclusions)

**Use Case**: Complex filtering with exceptions.

```json
{
  "slots": {
    "leg_1": {
      "partType": "golden_leg",
      "tags": ["anatomy:part", "anatomy:golden"]
    }
  },
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "normal_leg",
      "tags": ["anatomy:part"],
      "exclude": {
        "slotGroups": ["limbSet:special_leg"]
      }
    }
  ]
}
```

**Pros**: Surgical precision, handles edge cases
**Cons**: Most complex, hardest to debug

## Pattern Precedence and Priority

### Priority Order (Highest to Lowest)

1. **Explicit `slots` definitions**
2. **Most specific pattern** (matchesAll > matchesPattern > matchesGroup)
3. **First matching pattern** (if equal specificity)

### Example: Priority in Action

```json
{
  "slots": {
    "leg_1": {
      "partType": "special_leg"  // Priority 1: Always wins
    }
  },
  "patterns": [
    {
      "matchesAll": {
        "slotType": "leg",
        "orientation": "leg_front_*"
      },
      "partType": "front_leg"  // Priority 2: More specific
    },
    {
      "matchesPattern": "leg_*",
      "partType": "normal_leg"  // Priority 3: Less specific
    },
    {
      "matchesGroup": "limbSet:leg",
      "partType": "group_leg"  // Priority 4: Least specific
    }
  ]
}
```

**Results**:
- `leg_1` → `special_leg` (explicit slot wins)
- `leg_front_left` → `front_leg` (matchesAll is most specific)
- `leg_back_right` → `normal_leg` (matchesPattern next)

## Performance Considerations

### Pattern Performance (Best to Worst)

1. **Explicit slots**: O(1) lookup
2. **matchesGroup**: O(n) where n = slots in limb set
3. **matchesPattern**: O(n) where n = all blueprint slots
4. **matchesAll**: O(n × m) where m = number of filter criteria

### Performance Tips

**Optimize For**:
- Use matchesGroup for template-generated slots (fastest pattern type)
- Combine filters in single matchesAll (vs multiple patterns)
- Cache-friendly: patterns evaluated once during blueprint processing

**Avoid**:
- Excessive pattern count (>10 patterns)
- Overlapping patterns (causes unnecessary re-evaluation)
- Too-broad wildcards (match more slots than needed)

### Real-World Performance

For typical creatures (10-50 slots):
- All pattern types: <2ms processing time
- Negligible impact on load times
- No runtime performance cost (evaluated once)

**Conclusion**: Choose patterns for maintainability, not performance.

## Maintainability Guidelines

### Rule 1: Prefer Patterns Over Explicit Slots

```json
// ❌ BAD: Verbose, high maintenance
"slots": {
  "leg_1": { "partType": "leg" },
  "leg_2": { "partType": "leg" },
  "leg_3": { "partType": "leg" },
  "leg_4": { "partType": "leg" }
}

// ✅ GOOD: Concise, maintainable
"patterns": [
  {
    "matchesPattern": "leg_*",
    "partType": "leg"
  }
]
```

### Rule 2: Use Most Specific Pattern That Works

```json
// ❌ BAD: Overly broad
"matchesPattern": "*"

// ✅ BETTER: More specific
"matchesPattern": "leg_*"

// ✅ BEST: Most specific (if applicable)
"matchesGroup": "limbSet:leg"
```

### Rule 3: Document Complex Patterns

```json
{
  "recipeId": "anatomy:spider_complex",
  "description": "Spider with golden front legs (1-2) and standard rear legs (3-8). Uses explicit slots for special variants.",
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg"
    }
  ]
}
```

### Rule 4: Keep Patterns Mutually Exclusive

```json
// ❌ BAD: Overlapping patterns
"patterns": [
  {
    "matchesPattern": "leg_*",
    "partType": "normal_leg"
  },
  {
    "matchesPattern": "leg_front_*",
    "partType": "front_leg"  // Overlaps with above
  }
]

// ✅ GOOD: Use specificity or exclusions
"patterns": [
  {
    "matchesPattern": "leg_front_*",
    "partType": "front_leg"  // More specific, evaluated first
  },
  {
    "matchesPattern": "leg_*",
    "partType": "normal_leg",
    "exclude": {
      "properties": {
        "orientation": "leg_front_*"
      }
    }
  }
]
```

### Rule 5: Test Pattern Changes

```bash
# Always test after modifying patterns
1. Create test entity
2. Verify slot population
3. Check part properties
4. Validate anatomy visualization
```

## Common Patterns by Creature Type

### Spiders (8 Radial Legs)

**Recommended**: matchesGroup

```json
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg",
      "tags": ["anatomy:part", "anatomy:segmented"]
    }
  ]
}
```

**Why**: Structure template generates all 8 legs consistently.

### Dragons (Wings + Quadrupedal)

**Recommended**: matchesGroup for each limb set

```json
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "dragon_leg"
    },
    {
      "matchesGroup": "limbSet:wing",
      "partType": "dragon_wing"
    }
  ]
}
```

**Why**: Clear separation between limb types.

### Centaurs (Hybrid)

**Recommended**: matchesAll or matchesPattern

```json
{
  "patterns": [
    {
      "matchesAll": {
        "slotType": "limb",
        "orientation": "arm_*"
      },
      "partType": "human_arm"
    },
    {
      "matchesAll": {
        "slotType": "limb",
        "orientation": "leg_*"
      },
      "partType": "horse_leg"
    }
  ]
}
```

**Why**: Need to differentiate arms from legs in hybrid anatomy.

### Octopi (8 Tentacles)

**Recommended**: matchesGroup

```json
{
  "patterns": [
    {
      "matchesGroup": "limbSet:tentacle",
      "partType": "octopus_tentacle",
      "tags": ["anatomy:part", "anatomy:prehensile"]
    }
  ]
}
```

**Why**: Homogeneous tentacle set from template.

### Humanoids (Complex Asymmetry)

**Recommended**: Explicit slots

```json
{
  "slots": {
    "left_arm": { "partType": "human_arm", "tags": ["anatomy:part"] },
    "right_arm": { "partType": "human_arm", "tags": ["anatomy:part"] },
    "left_leg": { "partType": "human_leg", "tags": ["anatomy:part"] },
    "right_leg": { "partType": "human_leg", "tags": ["anatomy:part"] }
  }
}
```

**Why**: Humanoids often have unique per-limb requirements.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Overlapping Patterns Without Priority

```json
// ❌ BAD: Which pattern wins for leg_front_left?
"patterns": [
  {
    "matchesPattern": "leg_*",
    "partType": "normal_leg"
  },
  {
    "matchesPattern": "*_left",
    "partType": "left_leg"
  }
]
```

**Fix**: Use property-based filtering or explicit slots.

### Anti-Pattern 2: Too Many Explicit Slots

```json
// ❌ BAD: Verbose and error-prone
"slots": {
  "tentacle_1": { "partType": "tentacle" },
  "tentacle_2": { "partType": "tentacle" },
  // ... 6 more
}
```

**Fix**: Use matchesGroup or matchesPattern.

### Anti-Pattern 3: Wildcard Everything

```json
// ❌ BAD: Matches way too much
"matchesPattern": "*"
```

**Fix**: Be specific with patterns.

### Anti-Pattern 4: Ignoring Structure Templates

```json
// ❌ BAD: Manual pattern when template available
"matchesPattern": "leg_1|leg_2|leg_3|leg_4|leg_5|leg_6|leg_7|leg_8"
```

**Fix**: Use matchesGroup: "limbSet:leg"

### Anti-Pattern 5: Property Filters When Not Needed

```json
// ❌ OVERCOMPLICATED: matchesAll not needed
"matchesAll": {
  "slotType": "leg"
}

// ✅ SIMPLER: Use matchesGroup
"matchesGroup": "limbSet:leg"
```

**Fix**: Use simplest pattern that works.

## Testing Strategies

### Unit Testing Patterns

```javascript
describe('Spider Recipe Pattern', () => {
  it('should populate all 8 leg slots', () => {
    const entity = createEntity('spider', recipe);
    expect(entity.slots).toHaveLength(8);
    expect(entity.slots.every(s => s.partType === 'spider_leg')).toBe(true);
  });
});
```

### Integration Testing

```javascript
describe('Dragon Recipe Integration', () => {
  it('should correctly differentiate wings from legs', () => {
    const entity = createEntity('dragon', recipe);
    const wings = entity.slots.filter(s => s.partType === 'dragon_wing');
    const legs = entity.slots.filter(s => s.partType === 'dragon_leg');

    expect(wings).toHaveLength(2);
    expect(legs).toHaveLength(4);
  });
});
```

### Manual Testing Checklist

- [ ] All slots populated (no empty slots)
- [ ] Correct part types in each slot
- [ ] Properties applied correctly
- [ ] No unexpected parts
- [ ] Anatomy visualization looks correct
- [ ] Recipe validates against schema

## Debugging Techniques

### Technique 1: Temporary Explicit Slots

```json
{
  "slots": {
    // Add explicit slots to see what pattern SHOULD match
    "leg_1": { "partType": "debug_leg" }
  },
  "patterns": [
    {
      "matchesPattern": "leg_*",
      "partType": "spider_leg"
    }
  ]
}
```

**Purpose**: Verify slot keys and structure.

### Technique 2: Pattern Elimination

```json
{
  "patterns": [
    // Comment out patterns one by one
    // {
    //   "matchesGroup": "limbSet:leg",
    //   "partType": "spider_leg"
    // },
    {
      "matchesGroup": "appendage:abdomen",
      "partType": "spider_abdomen"
    }
  ]
}
```

**Purpose**: Isolate which pattern is causing issues.

### Technique 3: Enable Debug Logging

The RecipePatternResolver includes built-in debug logging that shows pattern resolution details. Debug messages include:
- Pattern validation progress
- Number of slots matched by each pattern type (e.g., `matchesGroup 'limbSet:leg' resolved to 4 slots`)
- Exclusion filtering results

To see these messages, ensure your logger is configured to show debug-level output.

**Purpose**: See pattern resolution progress and matched slot counts.

### Technique 4: Schema Validation

```bash
# Validate recipe against schema
npx ajv validate -s data/schemas/anatomy.recipe.schema.json -d data/mods/*/recipes/*.recipe.json
```

**Purpose**: Catch structural issues early.

## Migration Best Practices

### From V1 to V2

**Step 1**: Start with simplest recipes
**Step 2**: Use matchesGroup where possible
**Step 3**: Fall back to matchesPattern for non-template cases
**Step 4**: Use matchesAll only when necessary
**Step 5**: Keep explicit slots for unique cases

**See**: [V1 to V2 Migration Guide](./v1-to-v2-pattern-migration.md)

## Documentation Standards

### Recipe-Level Documentation

```json
{
  "recipeId": "anatomy:spider_garden",
  "description": "Garden spider with 8 segmented legs and bulbous abdomen. Front legs (1-2) have enhanced sensory capabilities.",
  "patterns": [
    // Patterns here
  ]
}
```

### Pattern-Level Comments (in supporting docs)

```markdown
## Pattern Strategy

- **Pattern 1** (matchesGroup:leg): Applies to all 8 template-generated legs
- **Pattern 2** (matchesGroup:appendage:abdomen): Single abdomen attachment
- **Explicit leg_1, leg_2**: Front legs with sensory enhancement
```

## Checklist for Pattern Selection

```
[ ] Understand blueprint structure (V1 or V2?)
[ ] Identify structure template (if V2)
[ ] List all slot keys that need populating
[ ] Identify patterns in slot naming
[ ] Determine if template groups exist
[ ] Check for unique/asymmetric slots
[ ] Choose simplest pattern type that works
[ ] Consider future maintainability
[ ] Test with multiple entity instances
[ ] Document pattern strategy
```

## Reference

**Implementation**: `/src/anatomy/recipePatternResolver/patternResolver.js`
**Schema**: `/data/schemas/anatomy.recipe.schema.json`
**Tests**: `/tests/unit/anatomy/recipePatternResolver.test.js`

## Related Documentation

- [Recipe Patterns](./recipe-patterns.md) - Complete pattern reference
- [Property-Based Filtering Examples](./property-based-filtering-examples.md) - matchesAll guide
- [V1 to V2 Migration](./v1-to-v2-pattern-migration.md) - Migration strategies
- [Common Non-Human Patterns](./common-non-human-patterns.md) - Species examples
- [Structure Templates](./structure-templates.md) - Template documentation
- [Blueprint V2](./blueprints-v2.md) - V2 blueprint features
