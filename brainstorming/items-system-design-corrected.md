# Items System Design - Architecture Analysis & Corrections

**Document Type**: Architecture Review & Corrected Specification
**Original Document**: items-system-design.md
**Review Date**: 2025-10-04
**Status**: Corrected Assumptions Against Actual Codebase

---

## Executive Summary

This document provides corrections to the items system design proposal based on analysis of the actual Living Narrative Engine codebase. The original document made several incorrect architectural assumptions that would conflict with established patterns. This corrected version maintains the original structure while aligning with actual engine capabilities.

## Critical Architectural Corrections

### 1. Action Discovery Pattern (CRITICAL)

**INCORRECT ASSUMPTION** (from original document):

```json
{
  "type": "SHOW_ITEM_SELECTION_UI",
  "comment": "Let player select which item to give",
  "parameters": {
    "inventory": "{context.actorInventory}",
    "result_variable": "selectedItemId"
  }
}
```

**ACTUAL PATTERN**:
The action discovery system creates **specific actions for each item** automatically. There is no `SHOW_ITEM_SELECTION_UI` operation.

**How It Actually Works**:

1. Action definition with multi-target pattern:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:give_item",
  "name": "Give Item",
  "description": "Give an item to another actor",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "person",
      "description": "Person to give item to"
    },
    "secondary": {
      "scope": "items:items_in_actor_inventory",
      "placeholder": "item",
      "description": "Item to give",
      "contextFrom": "actor"
    }
  },
  "generateCombinations": true,
  "template": "give {item} to {person}",
  "required_components": {
    "actor": ["items:inventory"]
  }
}
```

2. The ActionDiscoveryService + MultiTargetActionFormatter automatically generates:
   - "give gun to Frank"
   - "give letter to Frank"
   - "give coin to Frank"
   - (one action per item in inventory × each valid target)

3. Player sees a list of specific, pre-formatted actions - NO runtime UI selection needed.

**Key Insight**: The `contextFrom` property and `generateCombinations: true` flag work together to create all valid combinations. See `clothing:remove_others_clothing` for a working example.

### 2. Component Architecture Pattern (CRITICAL)

**INCORRECT ASSUMPTION** (from original document):

```json
{
  "id": "items:item",
  "dataSchema": {
    "type": "object",
    "properties": {
      "weight": { "type": "number" },
      "volume": { "type": "number" },
      "stackable": { "type": "boolean" },
      "portable": { "type": "boolean" },
      "consumable": { "type": "boolean" },
      "tags": { "type": "array" }
    }
  }
}
```

**ACTUAL PATTERN** (Modular Component Design):

The codebase uses **marker components** for capabilities, not monolithic property objects. This follows the pattern seen in positioning system:

- `positioning:sitting_on` - tracks sitting state
- `positioning:kneeling_before` - tracks kneeling state
- `positioning:bending_over` - tracks bending state

**Corrected Component Design**:

```json
// Base marker
{
  "id": "items:item",
  "description": "Marks an entity as an item",
  "dataSchema": {
    "type": "object",
    "properties": {}
  }
}

// Capability markers (separate components)
{
  "id": "items:stackable",
  "description": "Item can stack in inventory",
  "dataSchema": {
    "type": "object",
    "properties": {
      "maxStackSize": {
        "type": "integer",
        "minimum": 1,
        "default": 99
      }
    }
  }
}

{
  "id": "items:portable",
  "description": "Item can be picked up and moved",
  "dataSchema": {
    "type": "object",
    "properties": {}
  }
}

{
  "id": "items:consumable",
  "description": "Item is consumed on use",
  "dataSchema": {
    "type": "object",
    "properties": {
      "uses": {
        "type": "integer",
        "minimum": 1,
        "default": 1
      }
    }
  }
}

{
  "id": "items:physical_properties",
  "description": "Physical properties of item",
  "dataSchema": {
    "type": "object",
    "required": ["weight", "volume"],
    "properties": {
      "weight": {
        "type": "number",
        "minimum": 0
      },
      "volume": {
        "type": "number",
        "minimum": 0
      }
    }
  }
}
```

**Usage in Code**:

```javascript
// Check if stackable
if (entityManager.hasComponent(itemId, 'items:stackable')) {
  const stackData = entityManager.getComponentData(itemId, 'items:stackable');
  const maxStack = stackData.maxStackSize;
}

// Check if portable
if (entityManager.hasComponent(itemId, 'items:portable')) {
  // Allow pickup
}
```

**Benefits**:

- Matches established architectural pattern
- More flexible composition
- Easier to query and filter
- Better for action prerequisites (`required_components`, `forbidden_components`)

### 3. Multi-Target Action Pattern Details

**Reference Implementation**: `clothing:remove_others_clothing`

```json
{
  "id": "clothing:remove_others_clothing",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "person"
    },
    "secondary": {
      "scope": "clothing:topmost_clothing",
      "placeholder": "item",
      "contextFrom": "primary" // ← Key: resolves in context of primary
    }
  },
  "generateCombinations": true, // ← Generates separate actions
  "template": "remove {person}'s {item}"
}
```

**How It Works**:

1. Primary scope returns: `[Frank, Sarah, Bob]`
2. For each primary, secondary scope evaluates in that context:
   - Frank's topmost clothing: `[jacket, pants]`
   - Sarah's topmost clothing: `[dress, shoes]`
   - Bob's topmost clothing: `[shirt]`
3. Combinations generated:
   - "remove Frank's jacket"
   - "remove Frank's pants"
   - "remove Sarah's dress"
   - "remove Sarah's shoes"
   - "remove Bob's shirt"

**Applied to Items**:

```json
{
  "id": "items:give_item",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "person"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "contextFrom": "actor" // Resolve items in ACTOR's inventory
    }
  },
  "generateCombinations": true,
  "template": "give {item} to {person}"
}
```

Result: Individual actions per item-recipient combination.

### 4. Scope DSL Syntax

**Discovered Feature**: Union operators

The Scope DSL supports **two union operators** that produce identical results:

- `+` (addition operator)
- `|` (pipe operator)

Both create unions of entity sets. Use whichever feels more natural.

**Examples**:

```
actor.followers + actor.partners  // Union of followers and partners
actor.followers | actor.partners  // Identical result
```

**Full Scope DSL Syntax**:

- `.` - Field access (`actor.name`)
- `[]` - Array iteration (`actor.items[]`)
- `[{...}]` - JSON Logic filters (`actor.items[{"==": [{"var": "type"}, "weapon"]}]`)
- `+` or `|` - Union (`actor.followers | actor.partners`)
- `:` - Component namespacing (`core:actor`)

### 5. Inventory Component Structure

**Corrected Design** (maintains backward compatibility):

```json
{
  "id": "items:inventory",
  "description": "Container for items an actor carries",
  "dataSchema": {
    "type": "object",
    "required": ["items"],
    "properties": {
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["itemId"],
          "properties": {
            "itemId": {
              "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
            },
            "quantity": {
              "type": "integer",
              "minimum": 1,
              "default": 1
            }
          }
        },
        "default": []
      },
      "maxWeight": {
        "type": "number",
        "minimum": 0,
        "description": "Maximum weight capacity (optional)"
      },
      "maxVolume": {
        "type": "number",
        "minimum": 0,
        "description": "Maximum volume capacity (optional)"
      }
    }
  }
}
```

**Notes**:

- Weight/volume limits are **optional** (not all games need encumbrance)
- Capacity calculation done in handlers, not stored
- Items referenced by ID (not copied)
- Quantity supports stacking

### 6. Corrected Rule Example

**Give Item Rule** (corrected):

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_give_item",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "items:event-is-action-give-item"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor's inventory",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "items:inventory",
        "result_variable": "actorInventory"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get recipient's inventory",
      "parameters": {
        "entity_ref": "target",
        "component_type": "items:inventory",
        "result_variable": "recipientInventory"
      }
    },
    {
      "type": "CALL_OPERATION_HANDLER",
      "comment": "Validate recipient has capacity",
      "parameters": {
        "handler": "validateInventoryCapacity",
        "params": {
          "entityId": "{event.payload.targetId}",
          "itemId": "{event.payload.secondaryTargetId}",
          "quantity": 1
        },
        "result_variable": "hasSpace"
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "var": "context.hasSpace.hasCapacity" },
        "then_actions": [
          {
            "type": "CALL_OPERATION_HANDLER",
            "comment": "Transfer item",
            "parameters": {
              "handler": "transferItem",
              "params": {
                "fromEntityId": "{event.payload.actorId}",
                "toEntityId": "{event.payload.targetId}",
                "itemId": "{event.payload.secondaryTargetId}",
                "quantity": 1
              }
            }
          },
          {
            "macro": "items:logItemTransferAndEndTurn"
          }
        ],
        "else_actions": [
          {
            "type": "DISPATCH_EVENT",
            "parameters": {
              "event_type": "items:transfer_failed",
              "payload": {
                "reason": "insufficient_capacity",
                "actorId": "{event.payload.actorId}",
                "recipientId": "{event.payload.targetId}",
                "itemId": "{event.payload.secondaryTargetId}"
              }
            }
          }
        ]
      }
    }
  ]
}
```

**Key Changes from Original**:

- ❌ Removed `SHOW_ITEM_SELECTION_UI` (doesn't exist)
- ✅ Item ID comes from `event.payload.secondaryTargetId` (from action discovery)
- ✅ Uses `CALL_OPERATION_HANDLER` for custom logic
- ✅ Proper error event dispatching

### 7. Operation Handlers - When to Create

**Decision Matrix**:

| Scenario                | Generic Operations                    | Custom Handler | Rationale                                  |
| ----------------------- | ------------------------------------- | -------------- | ------------------------------------------ |
| Simple component update | ✓ `ADD_COMPONENT`, `MODIFY_COMPONENT` | ✗              | Built-in ops sufficient                    |
| Multi-entity updates    | ✗                                     | ✓              | Batch optimization, transaction safety     |
| Complex validation      | ✗                                     | ✓              | Business logic, custom checks              |
| Invariant maintenance   | ✗                                     | ✓              | E.g., no cycles, bidirectional consistency |
| Resource locking        | ✗                                     | ✓              | Exclusive access needed                    |
| Capacity calculations   | ✗                                     | ✓              | Complex math, multiple checks              |

**Items System Handlers Needed**:

1. **transferItemHandler** - Move items between inventories
   - Validates source has item
   - Validates destination capacity
   - Updates both inventories atomically
   - Updates `core:owned_by` component
   - Dispatches events

2. **validateInventoryCapacityHandler** - Check if item fits
   - Gets item physical properties
   - Calculates current inventory totals
   - Checks against limits
   - Returns boolean + details

3. **updateInventoryTotalsHandler** - Recalculate weight/volume (if using encumbrance)
   - Iterates items in inventory
   - Sums weights and volumes
   - Updates cached totals

**NOT Needed**:

- ❌ `showItemSelectionUIHandler` - action discovery handles this
- ❌ `addItemToInventoryHandler` - use `transferItemHandler`
- ❌ `removeItemFromInventoryHandler` - use `transferItemHandler`

### 8. Corrected Scope Definitions

```
// items:actor_inventory_items.scope
// Returns item IDs from actor's inventory
actor.items:inventory.items[].itemId
```

```
// items:close_actors_with_inventory.scope
// Close actors who have inventory capability
actor.positioning:closeness.partners[
  {"!!": {"var": "items:inventory"}}
]
```

```
// containers-core:containers_in_location.scope
// Furniture/objects that can contain items
location.entities[
  {"!!": {"var": "containers-core:container"}}
]
```

### 9. Container Component (Corrected)

```json
{
  "id": "containers-core:container",
  "description": "Entity can contain items (chest, drawer, etc.)",
  "dataSchema": {
    "type": "object",
    "required": ["contents"],
    "properties": {
      "contents": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["itemId"],
          "properties": {
            "itemId": {
              "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
            },
            "quantity": {
              "type": "integer",
              "minimum": 1,
              "default": 1
            }
          }
        },
        "default": [],
        "maxItems": 100
      },
      "capacity": {
        "type": "integer",
        "minimum": 1,
        "description": "Maximum number of item stacks"
      },
      "locked": {
        "type": "boolean",
        "default": false
      },
      "keyItemId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "Item required to unlock"
      }
    }
  }
}
```

**Similar Structure to Inventory**: Reuses same pattern for consistency.

### 10. Example Item Entity (Corrected)

```json
{
  "id": "items:letter_to_sheriff",
  "name": "Letter to Sheriff",
  "components": {
    "core:name": {
      "value": "Letter to Sheriff"
    },
    "core:description": {
      "value": "A sealed letter addressed to the Sheriff"
    },
    "items:item": {},
    "items:portable": {},
    "items:physical_properties": {
      "weight": 0.1,
      "volume": 0.05
    },
    "core:owned_by": {
      "ownerId": "none"
    }
  }
}
```

**Changes**:

- Separate marker components instead of properties in `items:item`
- Physical properties in dedicated component
- Includes `core:owned_by` for ownership tracking

### 11. Example Stackable Item (Corrected)

```json
{
  "id": "items:gold_coin",
  "name": "Gold Coin",
  "components": {
    "core:name": {
      "value": "Gold Coin"
    },
    "items:item": {},
    "items:portable": {},
    "items:stackable": {
      "maxStackSize": 999
    },
    "items:physical_properties": {
      "weight": 0.01,
      "volume": 0.001
    }
  }
}
```

**Key Difference**: `items:stackable` is a **separate component**, not a property.

## Corrected Integration Patterns

### Integration with `core:owned_by`

**Pattern**:

```javascript
// In transferItemHandler.js
async #updateItemOwnership(itemId, newOwnerId) {
  await this.#entityManager.addComponent(itemId, 'core:owned_by', {
    ownerId: newOwnerId
  });

  this.#logger.debug(`Updated ownership of ${itemId} to ${newOwnerId}`);
}
```

### Integration with Positioning System

Items should be aware of actor position for drop/pickup:

```json
{
  "type": "IF",
  "comment": "Can only drop if not movement locked",
  "parameters": {
    "condition": {
      "!": { "var": "actor.positioning:movement_locked" }
    },
    "then_actions": [
      {
        "type": "CALL_OPERATION_HANDLER",
        "parameters": {
          "handler": "transferItem",
          "params": {
            "fromEntityId": "{actorId}",
            "toEntityId": "{locationId}",
            "itemId": "{selectedItemId}"
          }
        }
      },
      {
        "type": "ADD_COMPONENT",
        "parameters": {
          "entity_ref": "{selectedItemId}",
          "component_type": "core:position",
          "value": {
            "locationId": "{actor.position.locationId}"
          }
        }
      }
    ]
  }
}
```

### Integration with Perception System

**Corrected Pattern**:

```json
{
  "type": "ADD_PERCEPTION_LOG_ENTRY",
  "parameters": {
    "location_id": "{actor.position.locationId}",
    "entry": {
      "descriptionText": "{actorName} gives {itemName} to {recipientName}",
      "timestamp": "{timestamp}",
      "perceptionType": "item_transfer",
      "actorId": "{actorId}",
      "targetId": "{recipientId}",
      "itemId": "{itemId}"
    }
  }
}
```

## Corrected File Structure

```
data/mods/items/
├── mod-manifest.json
├── components/
│   ├── item.component.json              # Base marker
│   ├── portable.component.json          # Capability marker
│   ├── stackable.component.json         # Capability marker
│   ├── consumable.component.json        # Capability marker
│   ├── physical_properties.component.json
│   ├── inventory.component.json
│   ├── container.component.json
│   └── held_item.component.json
├── actions/
│   ├── give_item.action.json           # Uses generateCombinations
│   ├── take_item.action.json
│   ├── drop_item.action.json
│   ├── examine_item.action.json
│   ├── use_item.action.json
│   └── open_container.action.json
├── rules/
│   ├── handle_give_item.rule.json
│   ├── handle_take_item.rule.json
│   └── [... etc]
├── conditions/
│   ├── event-is-action-give-item.condition.json
│   ├── has-items-in-inventory.condition.json
│   └── [... etc]
├── scopes/
│   ├── actor_inventory_items.scope
│   ├── close_actors_with_inventory.scope
│   └── containers_in_location.scope
├── events/
│   ├── item_transferred.event.json
│   ├── transfer_failed.event.json
│   └── item_used.event.json
├── macros/
│   └── logItemTransferAndEndTurn.macro.json
└── entities/
    └── definitions/
        ├── letter_to_sheriff.entity.json
        ├── gold_coin.entity.json
        └── treasure_chest.entity.json
```

## Operation Handler Implementation Notes

### transferItemHandler.js Structure

```javascript
class TransferItemHandler extends BaseOperationHandler {
  async execute(params, executionContext) {
    // 1. Validate parameters
    const { fromEntityId, toEntityId, itemId, quantity } =
      this.#validateParams(params);

    // 2. Get inventories
    const fromInv = await this.#getInventory(fromEntityId);
    const toInv = await this.#getInventory(toEntityId);

    // 3. Validate source has item
    const sourceItem = fromInv.items.find((i) => i.itemId === itemId);
    if (!sourceItem || sourceItem.quantity < quantity) {
      throw new Error('Insufficient quantity in source inventory');
    }

    // 4. Check if item is stackable
    const isStackable = this.#entityManager.hasComponent(
      itemId,
      'items:stackable'
    );

    // 5. Update source inventory
    const newFromItems = this.#removeFromInventory(
      fromInv.items,
      itemId,
      quantity
    );

    // 6. Update destination inventory
    const newToItems = this.#addToInventory(
      toInv.items,
      itemId,
      quantity,
      isStackable
    );

    // 7. Atomic update both inventories
    await this.#entityManager.batchAddComponentsOptimized(
      [
        {
          instanceId: fromEntityId,
          componentTypeId: 'items:inventory',
          componentData: { items: newFromItems },
        },
        {
          instanceId: toEntityId,
          componentTypeId: 'items:inventory',
          componentData: { items: newToItems },
        },
      ],
      true
    );

    // 8. Update ownership
    await this.#entityManager.addComponent(itemId, 'core:owned_by', {
      ownerId: toEntityId,
    });

    // 9. Dispatch event
    this.#eventBus.dispatch('items:item_transferred', {
      fromEntityId,
      toEntityId,
      itemId,
      quantity,
    });

    return { success: true };
  }
}
```

**Key Patterns**:

- Batch atomic updates for consistency
- Event dispatch for observers
- Stackable logic in handler
- Ownership tracking

### validateInventoryCapacityHandler.js Structure

```javascript
class ValidateInventoryCapacityHandler extends BaseOperationHandler {
  async execute(params, executionContext) {
    const { entityId, itemId, quantity } = params;

    // Get inventory
    const inventory = this.#entityManager.getComponentData(
      entityId,
      'items:inventory'
    );

    // Get item physical properties (if using encumbrance)
    const hasPhysicalProps = this.#entityManager.hasComponent(
      itemId,
      'items:physical_properties'
    );

    if (!hasPhysicalProps) {
      // No physical limits, always fits
      return { hasCapacity: true, reason: 'no_physical_limits' };
    }

    const physProps = this.#entityManager.getComponentData(
      itemId,
      'items:physical_properties'
    );

    // Calculate required capacity
    const requiredWeight = physProps.weight * quantity;
    const requiredVolume = physProps.volume * quantity;

    // Calculate current totals
    const currentWeight = this.#calculateTotalWeight(inventory.items);
    const currentVolume = this.#calculateTotalVolume(inventory.items);

    // Check limits (if defined)
    const hasWeightLimit = inventory.maxWeight !== undefined;
    const hasVolumeLimit = inventory.maxVolume !== undefined;

    if (
      hasWeightLimit &&
      currentWeight + requiredWeight > inventory.maxWeight
    ) {
      return {
        hasCapacity: false,
        reason: 'weight_exceeded',
        current: currentWeight,
        max: inventory.maxWeight,
        required: requiredWeight,
      };
    }

    if (
      hasVolumeLimit &&
      currentVolume + requiredVolume > inventory.maxVolume
    ) {
      return {
        hasCapacity: false,
        reason: 'volume_exceeded',
        current: currentVolume,
        max: inventory.maxVolume,
        required: requiredVolume,
      };
    }

    return {
      hasCapacity: true,
      reason: 'sufficient_capacity',
    };
  }
}
```

## Implementation Roadmap (Corrected)

### Phase 1: Core Infrastructure

**Goal**: Support basic "give item" use case with corrected patterns

1. Create mod structure
2. Implement modular components:
   - `items:item` (marker)
   - `items:portable` (marker)
   - `items:physical_properties`
   - `items:inventory`
3. Implement `transferItemHandler`
4. Create `give_item` action with **correct multi-target pattern**
5. Create test item entities

**Success Criteria**:

- Player can give letter to NPC
- Actions appear as "give letter to Frank", "give gun to Frank", etc.
- No UI selection dialogs (handled by action discovery)

### Phase 2: Inventory Management

**Goal**: Full inventory with capacity (optional feature)

1. Implement `validateInventoryCapacityHandler`
2. Add `items:stackable` component
3. Add `take_item`, `drop_item` actions
4. Weight/volume validation (if desired)
5. Inventory UI display

### Phase 3: Container System

**Goal**: Chests, storage furniture

1. Implement `containers-core:container` component
2. Add container interaction actions
3. Locked container logic
4. Container UI

### Phase 4: Advanced Features

**Goal**: Polish and gameplay depth

1. `items:consumable` component
2. Item use system
3. Equipment slots (if needed)
4. Crafting/combination (if needed)

## Testing Strategy (Corrected)

### Critical Tests

1. **Multi-Target Action Discovery**
   - Verify individual actions generated per item
   - Verify `contextFrom` resolves correctly
   - Verify `generateCombinations` works

2. **Modular Component System**
   - Test component composition
   - Test querying by component presence
   - Test action prerequisites with component checks

3. **Transfer Handler**
   - Atomic updates succeed/fail together
   - Ownership tracking updates
   - Events dispatched correctly

4. **Capacity Validation**
   - Weight/volume limits respected
   - Stackable items handled correctly
   - Optional limits work (no limits defined)

## Key Takeaways

### ✅ What Works Correctly

1. **Action Discovery**: Automatically creates specific actions, no runtime UI needed
2. **Multi-Target Pattern**: `contextFrom` + `generateCombinations: true` creates combinations
3. **Component Architecture**: Modular marker components, not monolithic objects
4. **Scope DSL**: Supports union operators (`+` and `|`)
5. **Handler Pattern**: Custom handlers for complex logic, generic ops for simple updates

### ❌ What Was Incorrect in Original

1. **SHOW_ITEM_SELECTION_UI**: This operation doesn't exist
2. **Monolithic components**: Should be modular markers
3. **UI selection in rules**: Action discovery handles this at discovery time
4. **Property-based capabilities**: Should be separate components

### 🎯 Architectural Alignment

This corrected design:

- ✅ Follows ECS principles (composition over properties)
- ✅ Uses established action discovery patterns
- ✅ Matches positioning system architecture
- ✅ Integrates with existing systems correctly
- ✅ Enables flexible querying and prerequisites

## Conclusion

The items system design is fundamentally sound but required significant architectural corrections to align with the Living Narrative Engine's actual patterns. The key insights are:

1. **Trust the action discovery system** - it handles UI generation automatically
2. **Use modular components** - follow the marker pattern, not monolithic objects
3. **Leverage multi-target actions** - `contextFrom` and `generateCombinations` are powerful
4. **Custom handlers for complexity** - but only when generic operations aren't sufficient

With these corrections, the items system will integrate seamlessly with the engine's established architecture while providing the desired gameplay functionality.

---

**Next Steps**:

1. Review this corrected document with stakeholders
2. Update original design document or replace with this version
3. Begin Phase 1 implementation with corrected patterns
4. Create comprehensive tests for multi-target discovery
5. Document learned patterns for future mod development
