# HUNMETSYS-013: GOAP Goals & Conditions

**Status:** Not Started  
**Phase:** 3 - GOAP Integration  
**Priority:** High  
**Estimated Effort:** 6 hours  
**Dependencies:** HUNMETSYS-011 (is_hungry), HUNMETSYS-012 (predicted_energy, can_consume)

## Objective

Create GOAP goal for hunger satisfaction plus conditions and scopes for food discovery, enabling AI actors to autonomously seek and consume food when needed.

## Context

With JSON Logic operators for hunger detection and energy prediction in place, we can now create:
- GOAP goal that activates when entity is hungry or predicted energy is low
- Conditions for energy thresholds and consumption validation
- Scopes for finding food in inventory, nearby, or in containers

## Files to Touch

### New Files (8)
1. **`data/mods/metabolism/goap/goals/satisfy_hunger.goal.json`**
2. **`data/mods/metabolism/conditions/has_energy_above.condition.json`**
3. **`data/mods/metabolism/conditions/is_hungry.condition.json`**
4. **`data/mods/metabolism/conditions/can_consume.condition.json`**
5. **`data/mods/metabolism/conditions/is_digesting.condition.json`**
6. **`data/mods/metabolism/scopes/nearby_food.scope`**
7. **`data/mods/metabolism/scopes/consumable_items.scope`**
8. **`data/mods/metabolism/scopes/inventory_food.scope`**

### Modified Files (1)
1. **`data/mods/metabolism/mod-manifest.json`**
   - Add goal, conditions, scopes to manifest

## Implementation Details

### satisfy_hunger.goal.json
```json
{
  "$schema": "schema://living-narrative-engine/goap-goal.schema.json",
  "id": "metabolism:satisfy_hunger",
  "name": "Satisfy Hunger",
  "description": "Ensure entity has sufficient energy reserves",
  "priority": 7,
  "preconditions": {
    "and": [
      { "has_component": ["self", "metabolism:metabolic_store"] },
      { "has_component": ["self", "metabolism:fuel_converter"] },
      {
        "or": [
          { "is_hungry": ["self"] },
          { "<": [{ "predicted_energy": ["self"] }, 500] }
        ]
      }
    ]
  },
  "desired_state": {
    "is_hungry": false,
    "predicted_energy_above": 700
  },
  "valid_actions": [
    "metabolism:eat",
    "metabolism:drink"
  ],
  "cost_modifiers": {
    "energy_cost_weight": 0.5,
    "distance_weight": 1.0
  }
}
```

### has_energy_above.condition.json
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "metabolism:has_energy_above",
  "description": "Check if entity's current energy is above threshold",
  "logic": {
    ">": [
      "{component.metabolism:metabolic_store.current_energy}",
      "{param.threshold}"
    ]
  },
  "parameters": {
    "threshold": {
      "type": "number",
      "description": "Minimum energy required",
      "default": 100
    }
  }
}
```

### is_hungry.condition.json
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "metabolism:is_hungry",
  "description": "Check if entity is in hungry/starving/critical state",
  "logic": {
    "is_hungry": ["{context.entityId}"]
  }
}
```

### can_consume.condition.json
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "metabolism:can_consume",
  "description": "Check if consumer can safely eat the item",
  "logic": {
    "can_consume": ["{context.consumerId}", "{context.itemId}"]
  },
  "parameters": {
    "consumerId": {
      "type": "string",
      "description": "Entity attempting to consume"
    },
    "itemId": {
      "type": "string",
      "description": "Item to be consumed"
    }
  }
}
```

### is_digesting.condition.json
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "metabolism:is_digesting",
  "description": "Check if entity has food in buffer being digested",
  "logic": {
    ">": [
      "{component.metabolism:fuel_converter.buffer_storage}",
      0
    ]
  }
}
```

### nearby_food.scope
```
# Find food items near the actor
scope nearby_food {
  # Start with all entities in the same location
  entities_at_location[actor.location]
  
  # Filter to items with fuel_source component
  | filter { has_component[., "metabolism:fuel_source"] }
  
  # Filter to items actor can consume
  | filter { can_consume[actor, .] }
}
```

### consumable_items.scope
```
# Find all consumable items accessible to actor
scope consumable_items {
  # Union of inventory food and nearby food
  inventory_food + nearby_food
}
```

### inventory_food.scope
```
# Find food items in actor's inventory
scope inventory_food {
  # Get actor's inventory items
  actor.items[]
  
  # Filter to items with fuel_source
  | filter { has_component[., "metabolism:fuel_source"] }
  
  # Filter to items actor can consume
  | filter { can_consume[actor, .] }
}
```

## Out of Scope

**Not Included:**
- ❌ GOAP planner implementation (assumed exists)
- ❌ Complex AI behavior tuning (priority balancing, etc.)
- ❌ Multiple eating strategies (feast vs. graze)
- ❌ Food preference system (likes/dislikes)
- ❌ Social eating behaviors (share food, etc.)

## Acceptance Criteria

**Must Have:**
- ✅ Goal file created and validates
- ✅ All 4 condition files created and validate
- ✅ All 3 scope files created and validate
- ✅ All files added to mod manifest
- ✅ Goal activates when is_hungry OR predicted_energy < 500
- ✅ Goal desired state: not hungry AND predicted_energy > 700
- ✅ Valid actions include eat and drink
- ✅ Scopes correctly find food in inventory and nearby
- ✅ can_consume scope filter works correctly
- ✅ No schema validation errors

**Nice to Have:**
- Consider: Multiple hunger satisfaction strategies
- Consider: Food quality preferences
- Consider: Social eating goals (share food with friends)

## References

- **Spec:** Section "GOAP Integration" (p. 21-23)
- **Previous:** HUNMETSYS-011, 012 (JSON Logic operators)
- **Next:** HUNMETSYS-014 (UPDATE_HUNGER_STATE)