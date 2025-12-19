# Furniture Sitting System - Design Brainstorming

**Living Narrative Engine - Component Architecture Proposal**  
_Generated: August 26, 2025_

## Executive Summary

This document explores multiple architectural approaches for implementing a component-based furniture sitting system within the Living Narrative Engine. The system should support furniture entities with configurable seating capacity, track occupancy state, and integrate seamlessly with existing positioning components.

## Design Principles

Based on analysis of existing state-defining components (`kissing`, `closeness`, `facing_away`, `kneeling_before`), the furniture sitting system should follow these principles:

1. **Component-First Architecture**: Furniture behavior defined through component presence
2. **Flexible Capacity**: Support single and multi-seat furniture
3. **State Consistency**: Maintain bidirectional state between sitter and furniture
4. **Movement Constraints**: Sitting restricts movement similar to kneeling
5. **Action Integration**: Enable sitting-specific actions when seated
6. **Modular Design**: Allow extension for different furniture types

---

## Implementation Approaches

### Approach 1: Simple Array-Based Occupancy (Recommended Initial Implementation)

**Component: `sitting:allows_sitting`**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "sitting:allows_sitting",
  "description": "Defines furniture that can be sat upon, tracking available spots and current occupants",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["spots"],
    "properties": {
      "spots": {
        "type": "array",
        "description": "Array of seating positions, null indicates empty spot",
        "minItems": 1,
        "maxItems": 10,
        "items": {
          "oneOf": [
            { "type": "null" },
            {
              "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
            }
          ]
        },
        "default": [null]
      },
      "comfort_level": {
        "type": "number",
        "description": "Comfort rating 0-10, affects AI decision-making",
        "minimum": 0,
        "maximum": 10,
        "default": 5
      }
    }
  }
}
```

**Companion Component: `positioning:sitting_on`**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:sitting_on",
  "description": "Tracks which furniture entity this actor is currently sitting on",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["furniture_id", "spot_index"],
    "properties": {
      "furniture_id": {
        "description": "The furniture entity being sat upon",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "spot_index": {
        "type": "integer",
        "description": "Which spot in the furniture's spots array this actor occupies",
        "minimum": 0
      }
    }
  }
}
```

**Pros:**

- Simple, clear data structure
- Easy to visualize occupancy
- Preserves spot ordering (left-to-right positioning)
- Similar to `closeness` partner arrays

**Cons:**

- Fixed array size limits
- Array manipulation more complex than needed
- Spot index management required

---

### Approach 2: Named Spot System

**Component: `sitting:allows_sitting_named`**

```json
{
  "dataSchema": {
    "type": "object",
    "required": ["seat_configuration"],
    "properties": {
      "seat_configuration": {
        "type": "object",
        "description": "Named seating positions with occupants",
        "properties": {
          "left": {
            "oneOf": [
              { "type": "null" },
              {
                "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
              }
            ]
          },
          "middle": {
            "oneOf": [
              { "type": "null" },
              {
                "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
              }
            ]
          },
          "right": {
            "oneOf": [
              { "type": "null" },
              {
                "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
              }
            ]
          }
        }
      },
      "seat_type": {
        "type": "string",
        "enum": ["chair", "couch", "bench", "throne", "stool"],
        "default": "chair"
      }
    }
  }
}
```

**Pros:**

- Explicit position names
- Better for narrative descriptions
- Easier targeted sitting ("sit on the left side")

**Cons:**

- Inflexible structure
- Each furniture type needs different schema
- Harder to generalize

---

### Approach 3: Dynamic Capacity with Occupant List

**Component: `positioning:seating_capacity`**

```json
{
  "dataSchema": {
    "type": "object",
    "required": ["max_capacity", "occupants"],
    "properties": {
      "max_capacity": {
        "type": "integer",
        "description": "Maximum number of simultaneous occupants",
        "minimum": 1,
        "maximum": 20,
        "default": 1
      },
      "occupants": {
        "type": "array",
        "description": "Currently seated entities",
        "uniqueItems": true,
        "items": {
          "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
        },
        "default": []
      },
      "preferred_capacity": {
        "type": "integer",
        "description": "Comfortable capacity before feeling crowded",
        "minimum": 1
      },
      "allows_squeeze": {
        "type": "boolean",
        "description": "Whether additional people can squeeze in beyond comfort",
        "default": false
      }
    }
  }
}
```

**Pros:**

- Flexible capacity
- Simple occupant tracking
- Supports "squeezing in" mechanics
- No spot index management

**Cons:**

- Loses positional information
- Can't specify "sit next to X"
- Less precise than array spots

---

### Approach 4: Hybrid Contextual System (Most Complex)

**Component: `positioning:contextual_seating`**

```json
{
  "dataSchema": {
    "type": "object",
    "required": ["seating_zones"],
    "properties": {
      "seating_zones": {
        "type": "array",
        "description": "Distinct seating areas with properties",
        "items": {
          "type": "object",
          "required": ["zone_id", "capacity", "occupants"],
          "properties": {
            "zone_id": { "type": "string" },
            "zone_name": { "type": "string" },
            "capacity": { "type": "integer", "minimum": 1 },
            "occupants": {
              "type": "array",
              "items": {
                "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
              }
            },
            "properties": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "armrest",
                  "cushioned",
                  "backrest",
                  "intimate",
                  "isolated"
                ]
              }
            }
          }
        }
      },
      "furniture_state": {
        "type": "object",
        "properties": {
          "reclined": { "type": "boolean", "default": false },
          "folded": { "type": "boolean", "default": false },
          "broken": { "type": "boolean", "default": false }
        }
      }
    }
  }
}
```

**Pros:**

- Maximum flexibility
- Supports complex furniture
- Rich interaction possibilities
- Zone-based sitting

**Cons:**

- Over-engineered for most use cases
- Complex to implement
- Harder to validate
- Performance overhead

---

## Recommended Implementation Strategy

### Phase 1: Minimal Viable System (Approach 1 Simplified)

Start with the simplest possible implementation:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "sitting:allows_sitting",
  "description": "Indicates furniture can be sat upon and tracks occupants",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["spots"],
    "properties": {
      "spots": {
        "type": "array",
        "description": "Seating positions (null = empty, entity ID = occupied)",
        "minItems": 1,
        "maxItems": 6,
        "items": {
          "oneOf": [
            { "type": "null" },
            { "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$" }
          ]
        },
        "default": [null]
      }
    }
  }
}
```

### Custom Operations Required

#### `SIT_ON_FURNITURE`

```json
{
  "type": "SIT_ON_FURNITURE",
  "parameters": {
    "actor_id": "{actorId}",
    "furniture_id": "{targetId}",
    "spot_preference": "any|first|last|index",
    "spot_index": 0
  }
}
```

This operation would:

1. Find available spot in furniture's `spots` array
2. Update furniture's `spots` array with actor ID
3. Add `positioning:sitting_on` component to actor
4. Lock movement (similar to kneeling)

#### `STAND_UP_FROM_FURNITURE`

```json
{
  "type": "STAND_UP_FROM_FURNITURE",
  "parameters": {
    "actor_id": "{actorId}"
  }
}
```

This operation would:

1. Query actor's `sitting_on` component
2. Remove actor from furniture's spots array
3. Remove `positioning:sitting_on` from actor
4. Unlock movement

---

## Integration Patterns

### Action Availability

**Action: `positioning:sit_down`**

```json
{
  "id": "positioning:sit_down",
  "name": "Sit down",
  "targets": "positioning:available_furniture",
  "forbidden_components": {
    "actor": ["positioning:sitting_on", "positioning:kneeling_before"]
  },
  "required_components": {
    "target": ["sitting:allows_sitting"]
  }
}
```

### Scope Definitions

**Available Furniture Scope**

```
positioning:available_furniture := entities(sitting:allows_sitting)[][{
  "and": [
    {"==": [{"var": "components.core:position.locationId"}, {"var": "actor.components.core:position.locationId"}]},
    {"some": [{"var": "components.sitting:allows_sitting.spots"}, {"==": [{"var": ""}, null]}]}
  ]
}]
```

**Occupied Furniture Scope**

```
positioning:furniture_im_sitting_on := entities(sitting:allows_sitting)[][{
  "in": [{"var": "actor.id"}, {"var": "components.sitting:allows_sitting.spots"}]
}]
```

### Sitting-Specific Actions

Once seated, enable contextual actions:

- `intimate:lean_against` (if multiple occupants)
- `social:whisper_to_neighbor`
- `positioning:scoot_over`
- `deference:stand_up`

---

## State Synchronization Patterns

### Bidirectional State Management

Similar to the `intimacy:kissing` pattern:

1. **Furniture tracks occupants** in its spots array
2. **Actor tracks furniture** via `sitting_on` component
3. **Both updated atomically** in rules

### Movement Constraints

Following `kneeling_before` pattern:

1. **Lock movement** when sitting
2. **Store position context** for restoration
3. **Unlock on standing**

### Group Dynamics

For multi-seat furniture, consider:

1. **Proximity effects** - sitting together enables social actions
2. **Order preservation** - maintain left-to-right positioning
3. **Cascade effects** - standing might affect others

---

## Edge Cases & Validation

### Critical Validations

1. **Capacity Overflow**
   - Prevent sitting when all spots occupied
   - Handle "squeeze in" mechanics if enabled

2. **State Consistency**
   - Actor can't sit on multiple furniture
   - Furniture spots match sitting actors
   - Handle entity destruction gracefully

3. **Location Validation**
   - Furniture and actor must be co-located
   - Handle furniture movement/destruction

4. **Component Cleanup**
   - Remove sitting_on when furniture destroyed
   - Clear spots array when actors removed

### Race Conditions

1. **Simultaneous Sitting**
   - Use operation queuing
   - First-come-first-served spot allocation

2. **Stand/Sit Conflicts**
   - Atomic state transitions
   - Clear operation ordering

---

## Example Furniture Entities

### Simple Chair

```json
{
  "entity_id": "furniture:wooden_chair",
  "components": {
    "sitting:allows_sitting": {
      "spots": [null]
    },
    "core:description": {
      "short": "wooden chair",
      "long": "A simple wooden chair with a worn cushion"
    }
  }
}
```

### Three-Person Couch

```json
{
  "entity_id": "furniture:leather_couch",
  "components": {
    "sitting:allows_sitting": {
      "spots": [null, null, null]
    },
    "core:description": {
      "short": "leather couch",
      "long": "A comfortable three-person leather couch"
    }
  }
}
```

---

## Migration Path

### Phase 1: Basic Implementation

- Single-spot chairs only
- Simple sit/stand actions
- Movement lock integration

### Phase 2: Multi-Occupancy

- Multi-spot furniture
- Spot selection logic
- Social sitting actions

### Phase 3: Advanced Features

- Named positions
- Comfort mechanics
- Squeeze-in dynamics
- Furniture state changes

### Phase 4: Extended Integration

- Sitting-specific action trees
- AI behavior preferences
- Narrative generation hooks

---

## Performance Considerations

### Optimization Strategies

1. **Indexed Lookups**
   - Cache furniture-at-location
   - Index by available spots
   - Quick occupancy checks

2. **Batch Operations**
   - Group spot updates
   - Combine state changes
   - Reduce event dispatches

3. **Lazy Evaluation**
   - Check availability on-demand
   - Cache scope results
   - Invalidate on state change

---

## Testing Strategy

### Unit Tests Required

- Component schema validation
- Spot allocation logic
- Movement lock integration
- State synchronization

### Integration Tests

- Multi-actor sitting scenarios
- Furniture capacity limits
- Location-based filtering
- Action availability changes

### Edge Case Tests

- Furniture destruction while occupied
- Actor removal while sitting
- Concurrent sitting attempts
- Movement during sitting

---

## Recommendations

### Start With

1. **Approach 1 (Simple Array)** - Most straightforward, follows existing patterns
2. **Single-spot furniture** - Chairs and stools first
3. **Basic sit/stand** - Minimal action set
4. **Movement locks** - Reuse existing system

### Avoid Initially

1. Complex furniture states
2. Named positions
3. Comfort mechanics
4. Dynamic capacity

### Consider for Future

1. Social sitting mechanics
2. Furniture conditions (broken, comfortable)
3. Sitting preferences for AI
4. Positional advantages in combat

---

## Conclusion

The recommended implementation uses a simple array-based approach that mirrors existing component patterns in the engine. This provides:

- **Clear mental model** - spots are either empty (null) or occupied (entity ID)
- **Predictable behavior** - follows established patterns from closeness/kissing
- **Extensibility** - can add properties without breaking changes
- **Performance** - simple array operations, minimal overhead

The key insight is that furniture sitting is fundamentally similar to the `kneeling_before` pattern (positional state with movement lock) combined with the `closeness` pattern (array-based multi-entity tracking). By leveraging these existing patterns, the implementation will feel consistent with the rest of the engine.

### Next Steps

1. Create component schemas for `sitting:allows_sitting` and `positioning:sitting_on`
2. Implement custom operations `SIT_ON_FURNITURE` and `STAND_UP_FROM_FURNITURE`
3. Define actions and rules for sitting/standing
4. Create test furniture entities
5. Write comprehensive tests
6. Document integration patterns

This approach balances simplicity with functionality, providing a solid foundation that can be extended based on actual gameplay needs rather than speculative features.
