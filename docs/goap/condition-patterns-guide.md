# Condition Patterns Guide

## Overview

This guide provides a comprehensive reference for common condition patterns used in refinement method conditionals. All patterns use correct operator names as registered in `src/logic/jsonLogicCustomOperators.js`.

**Important**: Always use `has_component` (snake_case), not `hasComponent` (camelCase).

## Table of Contents

1. [Component Existence Checks](#component-existence-checks)
2. [Inventory Patterns](#inventory-patterns)
3. [Location and Positioning](#location-and-positioning)
4. [Knowledge and Visibility](#knowledge-and-visibility)
5. [Health and Status](#health-and-status)
6. [Clothing and Equipment](#clothing-and-equipment)
7. [Spatial Relationships](#spatial-relationships)
8. [Numeric Comparisons](#numeric-comparisons)
9. [Logical Combinations](#logical-combinations)
10. [Safe Property Access](#safe-property-access)

---

## Component Existence Checks

### Check if Entity Has Component

```json
{
  "has_component": [{ "var": "actor" }, "items:inventory"]
}
```

**Use When**: You need to verify an entity has a specific component before accessing its properties.

**Example Context**: Check if actor can carry items before checking inventory contents.

### Check Multiple Components

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:health"] },
    { "has_component": [{ "var": "actor" }, "core:stamina"] },
    { "has_component": [{ "var": "actor" }, "biology:can_eat"] }
  ]
}
```

**Use When**: Action requires multiple actor capabilities.

**Example Context**: Eating requires health system, stamina system, and biological capability.

---

## Inventory Patterns

### Item in Inventory

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    {
      "in": [
        { "var": "task.params.item" },
        { "var": "actor.components.items:inventory.items" }
      ]
    }
  ]
}
```

**Use When**: Checking if actor possesses a specific item.

**Best Practice**: Always check inventory component exists first.

### Inventory Has Space

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    {
      "<": [
        { "var": "actor.components.items:inventory.items.length" },
        { "var": "actor.components.items:inventory.capacity" }
      ]
    }
  ]
}
```

**Use When**: Before picking up items.

**Alternative**: Use weight-based capacity if implemented.

### Has Any Item of Type

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    {
      "some": [
        { "var": "actor.components.items:inventory.items" },
        {
          "has_component": [{ "var": "" }, "items:nourishing"]
        }
      ]
    }
  ]
}
```

**Use When**: Checking for any item with specific properties, not a specific item ID.

**Note**: Uses JSON Logic `some` operator to iterate over inventory.

---

## Location and Positioning

### Same Location Check

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "positioning:position"] },
    {
      "has_component": [{ "var": "task.params.target" }, "positioning:position"]
    },
    {
      "==": [
        { "var": "actor.components.positioning:position.location" },
        { "var": "task.params.target.components.positioning:position.location" }
      ]
    }
  ]
}
```

**Use When**: Verifying two entities are in the same room/location.

**Common Usage**: Before attempting to interact with nearby objects.

### Actor is Standing

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "positioning:position"] },
    {
      "==": [
        { "var": "actor.components.positioning:position.posture" },
        "standing"
      ]
    }
  ]
}
```

**Use When**: Action requires specific posture.

**Variations**: Check for "sitting", "lying", "kneeling", etc.

### Item is on Ground (Not in Container)

```json
{
  "and": [
    {
      "has_component": [{ "var": "task.params.item" }, "positioning:position"]
    },
    {
      "==": [
        { "var": "task.params.item.components.positioning:position.container" },
        null
      ]
    }
  ]
}
```

**Use When**: Checking if item is accessible on the ground vs locked in container.

---

## Knowledge and Visibility

### Actor Knows About Entity

```json
{
  "and": [
    { "has_component": [{ "var": "task.params.item" }, "core:known_to"] },
    {
      "in": [
        { "var": "actor.id" },
        { "var": "task.params.item.components.core:known_to" }
      ]
    }
  ]
}
```

**Use When**: Preventing omniscience - actor can only target known entities.

**Critical**: All planning scopes should filter to known entities.

### Entity is Visible

```json
{
  "and": [
    { "has_component": [{ "var": "task.params.item" }, "core:visible"] },
    {
      "==": [{ "var": "task.params.item.components.core:visible" }, true]
    }
  ]
}
```

**Use When**: Checking if entity is currently visible (not in closed container).

**Note**: Invisible items should not be added to `core:known_to` until observed.

### Entity Recently Observed

```json
{
  "and": [
    { "has_component": [{ "var": "task.params.item" }, "core:last_seen"] },
    {
      "<": [
        {
          "-": [
            { "var": "world.time.currentTurn" },
            { "var": "task.params.item.components.core:last_seen.turn" }
          ]
        },
        10
      ]
    }
  ]
}
```

**Use When**: Checking if knowledge is recent (within last 10 turns).

**Note**: Assumes `core:last_seen` component tracks observation time.

---

## Health and Status

### Low Health Check

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:health"] },
    {
      "<": [
        { "var": "actor.components.core:health.current" },
        { "var": "actor.components.core:health.maximum" }
      ]
    }
  ]
}
```

**Use When**: Determining if healing is needed.

**Variation**: Use percentage threshold: `{ "*": [{ "var": "max" }, 0.5] }`

### Critical Health Check

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:health"] },
    {
      "<": [
        { "var": "actor.components.core:health.current" },
        {
          "*": [{ "var": "actor.components.core:health.maximum" }, 0.25]
        }
      ]
    }
  ]
}
```

**Use When**: Emergency healing situations (health below 25%).

### Has Status Effect

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:status_effects"] },
    {
      "in": [
        "poisoned",
        { "var": "actor.components.core:status_effects.active" }
      ]
    }
  ]
}
```

**Use When**: Checking for active status conditions.

**Variation**: Check for any debuff vs specific effect.

---

## Clothing and Equipment

### Wearing Clothing in Slot

```json
{
  "!": {
    "isSlotExposed": [{ "var": "actor" }, "torso", { "includeUnderwear": true, "includeAccessories": true }]
  }
}
```

**Use When**: Checking if body slot is occupied.

**Slots**: "head", "torso", "legs", "feet", "hands", "waist", etc.

### Slot Exposure by Layer

```json
{
  "!": {
    "isSlotExposed": [
      { "var": "actor" },
      "torso",
      ["base", "outer", "armor"]
    ]
  }
}
```

**Use When**: Ensuring a slot is covered by any of the listed layers.

### Item Removal Blocked

```json
{
  "isRemovalBlocked": [
    { "var": "actor" },
    { "var": "task.params.clothing_item" }
  ]
}
```

**Use When**: Checking if clothing can be removed (not blocked by other items).

**Example**: Can't remove pants while wearing belt.

### Socket is Covered

```json
{
  "isSocketCovered": [{ "var": "actor" }, "torso:chest"]
}
```

**Use When**: Checking if anatomy socket is covered by clothing.

**Use Case**: Intimacy actions blocked by clothing coverage.

### Weapon Equipped

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:equipped_weapon"] },
    {
      "!=": [{ "var": "actor.components.items:equipped_weapon.current" }, null]
    }
  ]
}
```

**Use When**: Checking if actor has weapon ready for combat.

---

## Spatial Relationships

### Has Sitting Space to Right

```json
{
  "hasSittingSpaceToRight": [
    { "var": "actor" },
    { "var": "task.params.furniture" },
    1
  ]
}
```

**Use When**: Checking if actor can sit next to target on furniture.

**Parameters**: `(actor, furniture, minimum_spaces)`

### Can Scoot Closer

```json
{
  "canScootCloser": [{ "var": "actor" }, { "var": "task.params.target" }]
}
```

**Use When**: Checking if seated actor can move closer to target on same furniture.

### Is Closest Occupant

```json
{
  "isClosestLeftOccupant": [
    { "var": "actor" },
    { "var": "task.params.furniture" },
    { "var": "task.params.target" }
  ]
}
```

**Use When**: Checking relative positioning on shared furniture.

**Variations**: `isClosestLeftOccupant`, `isClosestRightOccupant`

### Has Other Actors at Location

```json
{
  "hasOtherActorsAtLocation": [{ "var": "actor" }]
}
```

**Use When**: Checking if actor is alone in location.

**Use Case**: Privacy-sensitive actions.

---

## Numeric Comparisons

### Greater Than Threshold

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:stamina"] },
    {
      ">": [{ "var": "actor.components.core:stamina.current" }, 20]
    }
  ]
}
```

**Use When**: Minimum resource requirements.

### Within Range

```json
{
  "and": [
    { "has_component": [{ "var": "task.params.item" }, "items:weight"] },
    {
      "<=": [
        { "var": "task.params.item.components.items:weight.value" },
        { "var": "actor.components.core:strength.carry_capacity" }
      ]
    }
  ]
}
```

**Use When**: Checking if actor can carry item based on weight.

### Percentage Calculation

```json
{
  ">": [
    {
      "/": [
        { "var": "actor.components.core:health.current" },
        { "var": "actor.components.core:health.maximum" }
      ]
    },
    0.75
  ]
}
```

**Use When**: Calculating percentage (health above 75%).

---

## Logical Combinations

### AND - All Must Be True

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "biology:can_eat"] },
    { "has_component": [{ "var": "task.params.item" }, "items:edible"] },
    {
      ">": [{ "var": "actor.components.core:hunger.level" }, 30]
    }
  ]
}
```

**Use When**: Multiple conditions must all be satisfied.

### OR - Any Can Be True

```json
{
  "or": [
    { "has_component": [{ "var": "actor" }, "items:weapon_equipped"] },
    { "has_component": [{ "var": "actor" }, "biology:natural_weapons"] }
  ]
}
```

**Use When**: Alternative conditions, any one sufficient.

### NOT - Negation

```json
{
  "!": {
    "has_component": [{ "var": "actor" }, "positioning:rooted"]
  }
}
```

**Use When**: Checking absence of component or condition.

### Complex Combination

```json
{
  "and": [
    {
      "or": [
        { "has_component": [{ "var": "actor" }, "items:lockpick"] },
        { "has_component": [{ "var": "actor" }, "skills:lockpicking"] }
      ]
    },
    {
      "!": {
        "has_component": [{ "var": "task.params.door" }, "world:magical_lock"]
      }
    }
  ]
}
```

**Use When**: Complex prerequisites with alternatives and exclusions.

---

## Safe Property Access

### Basic Safe Access

```json
{
  "and": [
    { "has_component": [{ "var": "task.params.item" }, "items:food"] },
    {
      "!=": [
        { "var": "task.params.item.components.items:food.nutrition_value" },
        null
      ]
    },
    {
      ">": [
        { "var": "task.params.item.components.items:food.nutrition_value" },
        10
      ]
    }
  ]
}
```

**Pattern**: Check component → Check property not null → Use property

**Why**: Prevents evaluation failures on missing data.

### Safe Array Access

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    {
      "!=": [{ "var": "actor.components.items:inventory.items" }, null]
    },
    {
      ">": [{ "var": "actor.components.items:inventory.items.length" }, 0]
    }
  ]
}
```

**Pattern**: Check component → Check array not null → Check array length

### Safe Nested Access

```json
{
  "and": [
    {
      "has_component": [{ "var": "task.params.item" }, "positioning:position"]
    },
    {
      "!=": [
        { "var": "task.params.item.components.positioning:position.location" },
        null
      ]
    },
    { "has_component": [{ "var": "actor" }, "positioning:position"] },
    {
      "==": [
        { "var": "task.params.item.components.positioning:position.location" },
        { "var": "actor.components.positioning:position.location" }
      ]
    }
  ]
}
```

**Pattern**: Check each level of nesting before accessing deeper properties.

---

## Anti-Patterns to Avoid

### ❌ Accessing Property Without Component Check

```json
// BAD - fails if actor doesn't have health component
{
  ">": [{ "var": "actor.components.core:health.current" }, 50]
}
```

```json
// GOOD - checks component exists first
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:health"] },
    {
      ">": [{ "var": "actor.components.core:health.current" }, 50]
    }
  ]
}
```

### ❌ Using Wrong Operator Name

```json
// BAD - operator name is incorrect (camelCase)
{
  "hasComponent": [{ "var": "actor" }, "core:health"]
}
```

```json
// GOOD - uses correct snake_case operator name
{
  "has_component": [{ "var": "actor" }, "core:health"]
}
```

### ❌ Assuming Entity Exists

```json
// BAD - assumes task.params.item exists and has location
{
  "==": [
    { "var": "task.params.item.components.positioning:position.location" },
    "location_5"
  ]
}
```

```json
// GOOD - checks entity and component exist
{
  "and": [
    { "!=": [{ "var": "task.params.item" }, null] },
    {
      "has_component": [{ "var": "task.params.item" }, "positioning:position"]
    },
    {
      "==": [
        { "var": "task.params.item.components.positioning:position.location" },
        "location_5"
      ]
    }
  ]
}
```

### ❌ Deep Nesting Without Checks

```json
// BAD - multiple levels accessed without validation
{
  ">": [
    {
      "var": "actor.components.items:inventory.items[0].components.items:weight.value"
    },
    10
  ]
}
```

```json
// GOOD - validates each level
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    { ">": [{ "var": "actor.components.items:inventory.items.length" }, 0] },
    {
      "has_component": [
        { "var": "actor.components.items:inventory.items[0]" },
        "items:weight"
      ]
    },
    {
      ">": [
        {
          "var": "actor.components.items:inventory.items[0].components.items:weight.value"
        },
        10
      ]
    }
  ]
}
```

---

## Testing Conditions

### Unit Testing Strategy

1. Create test entity with known components
2. Build condition context manually
3. Evaluate condition using `jsonLogicEvaluationService`
4. Verify expected true/false result

### Edge Cases to Test

- Missing components
- Null property values
- Empty arrays
- Zero numeric values
- Undefined entities
- Evaluation failures

### Example Test

```javascript
const condition = {
  and: [
    { has_component: [{ var: 'actor' }, 'items:inventory'] },
    {
      in: [
        { var: 'task.params.item' },
        { var: 'actor.components.items:inventory.items' },
      ],
    },
  ],
};

const context = {
  actor: {
    id: 'actor_1',
    components: {
      'items:inventory': {
        items: ['item_7', 'item_9'],
      },
    },
  },
  task: {
    params: {
      item: 'item_7',
    },
  },
};

const result = jsonLogicEvaluationService.evaluate(condition, context);
// Expected: true
```

---

## Performance Considerations

### Order Conditions by Cost

Place cheap checks first (component existence) before expensive checks (complex calculations):

```json
{
  "and": [
    { "has_component": [{ "var": "actor" }, "core:health"] },
    { "has_component": [{ "var": "actor" }, "core:stamina"] },
    {
      ">": [
        {
          "+": [
            { "var": "actor.components.core:health.current" },
            { "var": "actor.components.core:stamina.current" }
          ]
        },
        100
      ]
    }
  ]
}
```

### Avoid Redundant Checks

Don't check the same condition multiple times:

```json
// BAD - checks has_component twice
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    { "in": ["item_7", { "var": "actor.components.items:inventory.items" }] }
  ]
}
```

```json
// GOOD - single component check
{
  "and": [
    { "has_component": [{ "var": "actor" }, "items:inventory"] },
    { "in": ["item_7", { "var": "actor.components.items:inventory.items" }] }
  ]
}
```

---

## Quick Reference

| Pattern          | Operator            | Example                                                     |
| ---------------- | ------------------- | ----------------------------------------------------------- |
| Component exists | `has_component`     | `{"has_component": [{"var": "actor"}, "core:health"]}`      |
| In array         | `in`                | `{"in": ["item_7", {"var": "inventory.items"}]}`            |
| Equals           | `==`                | `{"==": [{"var": "posture"}, "standing"]}`                  |
| Greater than     | `>`                 | `{">": [{"var": "health"}, 50]}`                            |
| Less than        | `<`                 | `{"<": [{"var": "health"}, 25]}`                            |
| And              | `and`               | `{"and": [condition1, condition2]}`                         |
| Or               | `or`                | `{"or": [condition1, condition2]}`                          |
| Not              | `!`                 | `{"!": condition}`                                          |
| Removal blocked  | `isRemovalBlocked`  | `{"isRemovalBlocked": [{"var": "actor"}, {"var": "item"}]}` |

---

## Related Documentation

- [Refinement Condition Context](refinement-condition-context.md) - Complete context specification
- [Custom Operators](../../src/logic/jsonLogicCustomOperators.js) - All available operators
- [JSON Logic Documentation](https://jsonlogic.com/) - Core logic engine
- [Conditional Examples](examples/) - Working refinement method examples
