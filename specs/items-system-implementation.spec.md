# Items System Implementation Specification

## Overview

This specification defines a complete items system for the Living Narrative Engine, enabling inventory management, item transfers, containers, and item-based interactions. The system follows the engine's ECS architecture and integrates seamlessly with existing positioning, clothing, and perception systems.

**Based On:** `brainstorming/items-system-design-corrected.md` - Corrected architectural analysis

### Design Philosophy

- **Modular Component Design**: Uses marker components for capabilities, not monolithic property objects
- **Action Discovery Driven**: Multi-target actions with `generateCombinations: true` create specific action instances
- **ECS Architecture Alignment**: Follows established patterns from positioning and clothing systems
- **No Runtime UI Selection**: Action discovery generates all valid combinations at discovery time
- **Integration First**: Works with `core:owned_by`, positioning, and perception systems

## Requirements

### Functional Requirements

1. **Inventory System**
   - Actors can carry items in their inventory
   - Support for stackable items (coins, ammo, etc.)
   - Optional weight/volume capacity limits
   - Item ownership tracking via `core:owned_by`

2. **Item Transfer Actions**
   - Give items to other actors (multi-target: person + item)
   - Take items from containers or ground
   - Drop items to current location
   - Automatic action generation per item-target combination

3. **Container System**
   - World containers (chests, drawers, etc.) can hold items
   - Support for locked containers with key items
   - Capacity limits per container
   - Container interaction actions

4. **Item Properties**
   - Physical properties (weight, volume)
   - Capability markers (portable, stackable, consumable)
   - Item examination and description
   - Consumable items with use counts

5. **Perception Integration**
   - Item transfers logged to perception system
   - Observable by actors in same location
   - Proper turn management and event dispatching

### Non-Functional Requirements

1. **Performance**
   - Atomic updates for multi-entity transactions
   - Batch operations for inventory modifications
   - Efficient capacity calculations

2. **Testability**
   - Comprehensive test coverage (80%+ branches, 90%+ functions/lines)
   - Integration tests for action discovery
   - Unit tests for operation handlers
   - Mock-based testing patterns

3. **Maintainability**
   - Clear separation of concerns
   - Reusable operation handlers
   - Consistent naming conventions
   - Schema-validated JSON files

4. **Schema Compliance**
   - All components validate against schemas
   - All actions follow action.schema.json
   - All rules follow rule.schema.json
   - Proper namespacing (`items:identifier`)

### Integration Requirements

1. **Core Systems**
   - Use `core:owned_by` for ownership tracking
   - Use `core:position` for item location
   - Use `core:name` and `core:description` for item details
   - Integrate with `core:perception` for observable events

2. **Positioning System**
   - Respect `positioning:movement_locked` for drop actions
   - Use `positioning:closeness` for nearby actor queries
   - Integrate with location-based scopes

3. **Perception System**
   - Dispatch `ADD_PERCEPTION_LOG_ENTRY` for transfers
   - Use appropriate perception types
   - Include actor, target, and item IDs in logs

## Component Architecture

### Modular Component Design Pattern

Following the **marker component pattern** from positioning system (not monolithic objects):

```
✅ Correct: Separate marker components for capabilities
❌ Incorrect: Single component with all properties
```

### Component Definitions

#### 1. Base Item Marker

**File:** `data/mods/items/components/item.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:item",
  "description": "Marks an entity as an item that can exist in the game world",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Purpose:** Base marker identifying entities as items.

#### 2. Portable Capability

**File:** `data/mods/items/components/portable.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:portable",
  "description": "Marks an item as portable - can be picked up, carried, and moved",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Purpose:** Capability marker for items that can be carried.

#### 3. Stackable Capability

**File:** `data/mods/items/components/stackable.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:stackable",
  "description": "Marks an item as stackable in inventory with configurable max stack size",
  "dataSchema": {
    "type": "object",
    "required": ["maxStackSize"],
    "properties": {
      "maxStackSize": {
        "type": "integer",
        "minimum": 1,
        "default": 99,
        "description": "Maximum quantity that can stack in a single inventory slot"
      }
    },
    "additionalProperties": false
  }
}
```

**Purpose:** Capability marker for items that stack (coins, ammo, etc.).

#### 4. Consumable Capability

**File:** `data/mods/items/components/consumable.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:consumable",
  "description": "Marks an item as consumable - removed or depleted on use",
  "dataSchema": {
    "type": "object",
    "required": ["uses"],
    "properties": {
      "uses": {
        "type": "integer",
        "minimum": 1,
        "default": 1,
        "description": "Number of uses before item is consumed"
      }
    },
    "additionalProperties": false
  }
}
```

**Purpose:** Capability marker for items that are consumed on use.

#### 5. Physical Properties

**File:** `data/mods/items/components/physical_properties.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:physical_properties",
  "description": "Physical properties of an item (weight, volume) for encumbrance calculations",
  "dataSchema": {
    "type": "object",
    "required": ["weight", "volume"],
    "properties": {
      "weight": {
        "type": "number",
        "minimum": 0,
        "description": "Weight in kilograms"
      },
      "volume": {
        "type": "number",
        "minimum": 0,
        "description": "Volume in cubic meters"
      }
    },
    "additionalProperties": false
  }
}
```

**Purpose:** Physical attributes for optional encumbrance system.

**Note:** Weight/volume limits are **optional** - not all games need encumbrance mechanics.

#### 6. Inventory Component

**File:** `data/mods/items/components/inventory.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
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
              "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId",
              "description": "Reference to item entity"
            },
            "quantity": {
              "type": "integer",
              "minimum": 1,
              "default": 1,
              "description": "Number of items in this stack"
            }
          },
          "additionalProperties": false
        },
        "default": []
      },
      "maxWeight": {
        "type": "number",
        "minimum": 0,
        "description": "Maximum weight capacity in kilograms (optional)"
      },
      "maxVolume": {
        "type": "number",
        "minimum": 0,
        "description": "Maximum volume capacity in cubic meters (optional)"
      }
    },
    "additionalProperties": false
  }
}
```

**Key Design Decisions:**
- Items stored as references (by ID), not copied
- Quantity supports stacking for stackable items
- Capacity limits are **optional** (not all games need encumbrance)
- Capacity calculation done in handlers, not stored in component

#### 7. Container Component

**File:** `data/mods/items/components/container.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:container",
  "description": "Entity can contain items (chest, drawer, furniture, etc.)",
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
          },
          "additionalProperties": false
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
        "default": false,
        "description": "Whether the container is locked"
      },
      "keyItemId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$",
        "description": "Item ID required to unlock (if locked)"
      }
    },
    "additionalProperties": false
  }
}
```

**Note:** Similar structure to inventory for consistency, but adds locking mechanism.

#### 8. Held Item Component

**File:** `data/mods/items/components/held_item.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "items:held_item",
  "description": "Tracks which item an actor is currently holding/wielding",
  "dataSchema": {
    "type": "object",
    "required": ["itemId"],
    "properties": {
      "itemId": {
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId",
        "description": "Item currently being held"
      },
      "hand": {
        "type": "string",
        "enum": ["left", "right", "both"],
        "default": "right",
        "description": "Which hand(s) holding the item"
      }
    },
    "additionalProperties": false
  }
}
```

**Purpose:** Tracks active item being wielded (for future equipment/weapon systems).

## Action Discovery Patterns

### Multi-Target Action Pattern

**Critical Pattern:** Uses `generateCombinations: true` with `contextFrom` to create specific actions.

**Reference Implementation:** `clothing:remove_others_clothing`

#### How It Works

1. **Primary Scope:** Returns list of potential targets (e.g., nearby actors)
2. **Secondary Scope:** Evaluates in context of each primary target (via `contextFrom`)
3. **Combination Generation:** Creates individual action for each valid combination
4. **No Runtime UI:** All combinations generated at discovery time, no selection dialogs

#### Example: Give Item Action

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:give_item",
  "name": "Give Item",
  "description": "Give an item from your inventory to another actor",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "person",
      "description": "Person to give item to"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to give",
      "contextFrom": "primary"
    }
  },
  "generateCombinations": true,
  "template": "give {item} to {person}",
  "required_components": {
    "actor": ["items:inventory"]
  }
}
```

**Results in Actions Like:**
- "give gun to Frank"
- "give letter to Frank"
- "give coin to Frank"
- "give gun to Sarah"
- (one action per item × each valid recipient)

**Key Properties:**
- `contextFrom: "primary"` - resolves secondary scope in primary target's context
- `generateCombinations: true` - creates separate actions for each combination
- No `SHOW_ITEM_SELECTION_UI` operation needed (doesn't exist!)

### Action Definitions

#### 1. Give Item Action

**File:** `data/mods/items/actions/give_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:give_item",
  "name": "Give Item",
  "description": "Give an item from your inventory to another actor",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "person",
      "description": "Person to give item to"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to give",
      "contextFrom": "primary"
    }
  },
  "generateCombinations": true,
  "template": "give {item} to {person}",
  "required_components": {
    "actor": ["items:inventory"]
  },
  "visual": {
    "backgroundColor": "#1976d2",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#1565c0",
    "hoverTextColor": "#ffffff"
  }
}
```

#### 2. Take Item Action

**File:** `data/mods/items/actions/take_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:take_item",
  "name": "Take Item",
  "description": "Take an item from the current location or a container",
  "targets": {
    "primary": {
      "scope": "items:items_at_location",
      "placeholder": "item",
      "description": "Item to take"
    }
  },
  "template": "take {item}",
  "required_components": {
    "actor": ["items:inventory"]
  },
  "visual": {
    "backgroundColor": "#388e3c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#2e7d32",
    "hoverTextColor": "#ffffff"
  }
}
```

#### 3. Drop Item Action

**File:** `data/mods/items/actions/drop_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:drop_item",
  "name": "Drop Item",
  "description": "Drop an item from your inventory to the ground",
  "targets": {
    "primary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to drop",
      "contextFrom": "primary"
    }
  },
  "template": "drop {item}",
  "required_components": {
    "actor": ["items:inventory"]
  },
  "forbidden_components": {
    "actor": ["positioning:movement_locked"]
  },
  "visual": {
    "backgroundColor": "#f57c00",
    "textColor": "#000000",
    "hoverBackgroundColor": "#ef6c00",
    "hoverTextColor": "#212121"
  }
}
```

**Note:** Uses `forbidden_components` to prevent dropping while movement locked.

#### 4. Examine Item Action

**File:** `data/mods/items/actions/examine_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:examine_item",
  "name": "Examine Item",
  "description": "Closely examine an item to see its details",
  "targets": {
    "primary": {
      "scope": "items:actor_inventory_items | items:items_at_location",
      "placeholder": "item",
      "description": "Item to examine",
      "contextFrom": "primary"
    }
  },
  "template": "examine {item}",
  "visual": {
    "backgroundColor": "#5e35b1",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#512da8",
    "hoverTextColor": "#ffffff"
  }
}
```

**Note:** Uses union operator (`|`) to include both inventory items and items at location.

#### 5. Use Item Action

**File:** `data/mods/items/actions/use_item.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:use_item",
  "name": "Use Item",
  "description": "Use or consume an item from your inventory",
  "targets": {
    "primary": {
      "scope": "items:consumable_items_in_inventory",
      "placeholder": "item",
      "description": "Item to use",
      "contextFrom": "primary"
    }
  },
  "template": "use {item}",
  "required_components": {
    "actor": ["items:inventory"]
  },
  "visual": {
    "backgroundColor": "#c62828",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#b71c1c",
    "hoverTextColor": "#ffffff"
  }
}
```

#### 6. Open Container Action

**File:** `data/mods/items/actions/open_container.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:open_container",
  "name": "Open Container",
  "description": "Open a container to access its contents",
  "targets": {
    "primary": {
      "scope": "items:containers_in_location",
      "placeholder": "container",
      "description": "Container to open"
    }
  },
  "template": "open {container}",
  "visual": {
    "backgroundColor": "#6a1b9a",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#4a148c",
    "hoverTextColor": "#ffffff"
  }
}
```

## Rule Definitions

### Give Item Rule

**File:** `data/mods/items/rules/handle_give_item.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_give_item",
  "comment": "Handles the 'items:give_item' action. Transfers item from actor to recipient with validation.",
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
      "comment": "Validate recipient has capacity for item",
      "parameters": {
        "handler": "validateInventoryCapacity",
        "params": {
          "entityId": "{event.payload.targetId}",
          "itemId": "{event.payload.secondaryTargetId}",
          "quantity": 1
        },
        "result_variable": "capacityCheck"
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "var": "context.capacityCheck.hasCapacity" },
        "then_actions": [
          {
            "type": "CALL_OPERATION_HANDLER",
            "comment": "Transfer item between inventories",
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
            "type": "GET_NAME",
            "comment": "Get actor name for perception log",
            "parameters": {
              "entity_ref": "actor",
              "result_variable": "actorName"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get recipient name for perception log",
            "parameters": {
              "entity_ref": "target",
              "result_variable": "recipientName"
            }
          },
          {
            "type": "GET_NAME",
            "comment": "Get item name for perception log",
            "parameters": {
              "entity_ref": "{event.payload.secondaryTargetId}",
              "result_variable": "itemName"
            }
          },
          {
            "type": "QUERY_COMPONENT",
            "comment": "Get actor's position for perception log",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "core:position",
              "result_variable": "actorPosition"
            }
          },
          {
            "type": "SET_VARIABLE",
            "comment": "Build perception log message",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} gives {context.itemName} to {context.recipientName}"
            }
          },
          {
            "type": "ADD_PERCEPTION_LOG_ENTRY",
            "comment": "Log the transfer for observers",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "entry": {
                "descriptionText": "{context.logMessage}",
                "timestamp": "{timestamp}",
                "perceptionType": "item_transfer",
                "actorId": "{event.payload.actorId}",
                "targetId": "{event.payload.targetId}",
                "itemId": "{event.payload.secondaryTargetId}"
              }
            }
          },
          {
            "type": "END_TURN",
            "comment": "End actor's turn after successful transfer"
          }
        ],
        "else_actions": [
          {
            "type": "DISPATCH_EVENT",
            "comment": "Notify that transfer failed due to capacity",
            "parameters": {
              "event_type": "items:transfer_failed",
              "payload": {
                "reason": "insufficient_capacity",
                "actorId": "{event.payload.actorId}",
                "recipientId": "{event.payload.targetId}",
                "itemId": "{event.payload.secondaryTargetId}",
                "details": "{context.capacityCheck}"
              }
            }
          }
        ]
      }
    }
  ]
}
```

**Key Changes from Original Incorrect Design:**
- ❌ No `SHOW_ITEM_SELECTION_UI` (doesn't exist)
- ✅ Item ID from `event.payload.secondaryTargetId` (from action discovery)
- ✅ Uses `CALL_OPERATION_HANDLER` for custom logic
- ✅ Proper error event dispatching

### Drop Item Rule

**File:** `data/mods/items/rules/handle_drop_item.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_drop_item",
  "comment": "Handles the 'items:drop_item' action. Drops item from inventory to current location.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "items:event-is-action-drop-item"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor's position to determine drop location",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "CALL_OPERATION_HANDLER",
      "comment": "Transfer item from inventory to location",
      "parameters": {
        "handler": "transferItem",
        "params": {
          "fromEntityId": "{event.payload.actorId}",
          "toEntityId": "{context.actorPosition.locationId}",
          "itemId": "{event.payload.targetId}",
          "quantity": 1
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Set item's position to current location",
      "parameters": {
        "entity_ref": "{event.payload.targetId}",
        "component_type": "core:position",
        "value": {
          "locationId": "{context.actorPosition.locationId}"
        }
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get actor name for perception log",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Get item name for perception log",
      "parameters": {
        "entity_ref": "{event.payload.targetId}",
        "result_variable": "itemName"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Build perception log message",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} drops {context.itemName}"
      }
    },
    {
      "type": "ADD_PERCEPTION_LOG_ENTRY",
      "comment": "Log the drop for observers",
      "parameters": {
        "location_id": "{context.actorPosition.locationId}",
        "entry": {
          "descriptionText": "{context.logMessage}",
          "timestamp": "{timestamp}",
          "perceptionType": "item_drop",
          "actorId": "{event.payload.actorId}",
          "itemId": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "END_TURN",
      "comment": "End actor's turn after dropping item"
    }
  ]
}
```

## Condition Definitions

**File:** `data/mods/items/conditions/event-is-action-give-item.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-give-item",
  "description": "Checks if the triggering event is for the 'items:give_item' action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:give_item"
    ]
  }
}
```

**File:** `data/mods/items/conditions/event-is-action-drop-item.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-drop-item",
  "description": "Checks if the triggering event is for the 'items:drop_item' action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:drop_item"
    ]
  }
}
```

**Additional Conditions:**
- `items:event-is-action-take-item`
- `items:event-is-action-examine-item`
- `items:event-is-action-use-item`
- `items:event-is-action-open-container`
- `items:has-items-in-inventory`
- `items:container-is-locked`

## Scope DSL Definitions

### Actor Inventory Items

**File:** `data/mods/items/scopes/actor_inventory_items.scope`

```
actor.items:inventory.items[].itemId
```

**Returns:** Array of item entity IDs from actor's inventory.

### Items at Location

**File:** `data/mods/items/scopes/items_at_location.scope`

```
location.entities[
  {"!!": {"var": "items:item"}}
][
  {"!!": {"var": "core:position"}}
]
```

**Returns:** Items at the current location (have both `items:item` and `core:position`).

### Close Actors with Inventory

**File:** `data/mods/items/scopes/close_actors_with_inventory.scope`

```
actor.positioning:closeness.partners[
  {"!!": {"var": "items:inventory"}}
]
```

**Returns:** Nearby actors who have inventory capability.

### Containers in Location

**File:** `data/mods/items/scopes/containers_in_location.scope`

```
location.entities[
  {"!!": {"var": "items:container"}}
]
```

**Returns:** Entities with `items:container` component at current location.

### Consumable Items in Inventory

**File:** `data/mods/items/scopes/consumable_items_in_inventory.scope`

```
actor.items:inventory.items[].itemId[
  {"!!": {"var": "items:consumable"}}
]
```

**Returns:** Items in actor's inventory that have `items:consumable` component.

**Note:** Uses union operators (`+` or `|`) when combining scopes. Both produce identical results.

## Operation Handlers

### Handler Decision Matrix

| Scenario | Use Generic Operations | Use Custom Handler | Rationale |
|----------|----------------------|-------------------|-----------|
| Simple component update | ✓ `ADD_COMPONENT`, `MODIFY_COMPONENT` | ✗ | Built-in operations sufficient |
| Multi-entity updates | ✗ | ✓ | Batch optimization, transaction safety |
| Complex validation | ✗ | ✓ | Business logic, custom checks |
| Invariant maintenance | ✗ | ✓ | E.g., no cycles, bidirectional updates |
| Resource locking | ✗ | ✓ | Exclusive access needed |
| Capacity calculations | ✗ | ✓ | Complex math, multiple checks |

### transferItem Handler

**File:** `src/logic/operationHandlers/transferItemHandler.js`

**Purpose:** Atomically transfer items between inventories with ownership updates.

**Parameters:**
- `fromEntityId` - Source entity (actor or location)
- `toEntityId` - Destination entity (actor or location)
- `itemId` - Item entity ID
- `quantity` - Number to transfer (default: 1)

**Implementation Pattern:**

```javascript
import { assertNonBlankString, assertPresent } from '../../utils/dependencyUtils.js';

class TransferItemHandler {
  #entityManager;
  #eventBus;
  #logger;

  constructor({ entityManager, eventBus, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(eventBus, 'eventBus is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  async execute(params, executionContext) {
    // 1. Validate parameters
    const { fromEntityId, toEntityId, itemId, quantity = 1 } = params;
    assertNonBlankString(fromEntityId, 'fromEntityId', 'TransferItemHandler.execute', this.#logger);
    assertNonBlankString(toEntityId, 'toEntityId', 'TransferItemHandler.execute', this.#logger);
    assertNonBlankString(itemId, 'itemId', 'TransferItemHandler.execute', this.#logger);

    // 2. Get inventories
    const fromInv = this.#entityManager.getComponentData(fromEntityId, 'items:inventory');
    const toInv = this.#entityManager.getComponentData(toEntityId, 'items:inventory');

    // 3. Validate source has item
    const sourceItem = fromInv.items.find(i => i.itemId === itemId);
    if (!sourceItem || sourceItem.quantity < quantity) {
      this.#logger.error(`Insufficient quantity in source inventory: ${fromEntityId}`);
      throw new Error('Insufficient quantity in source inventory');
    }

    // 4. Check if item is stackable
    const isStackable = this.#entityManager.hasComponent(itemId, 'items:stackable');

    // 5. Update source inventory
    const newFromItems = this.#removeFromInventory(fromInv.items, itemId, quantity);

    // 6. Update destination inventory
    const newToItems = this.#addToInventory(toInv.items, itemId, quantity, isStackable);

    // 7. Atomic batch update both inventories
    await this.#entityManager.batchAddComponentsOptimized([
      {
        instanceId: fromEntityId,
        componentTypeId: 'items:inventory',
        componentData: { items: newFromItems }
      },
      {
        instanceId: toEntityId,
        componentTypeId: 'items:inventory',
        componentData: { items: newToItems }
      }
    ], true);

    // 8. Update ownership
    await this.#entityManager.addComponent(itemId, 'core:owned_by', {
      ownerId: toEntityId
    });

    // 9. Dispatch event for observers
    this.#eventBus.dispatch('items:item_transferred', {
      fromEntityId,
      toEntityId,
      itemId,
      quantity
    });

    this.#logger.info(`Item transferred: ${itemId} from ${fromEntityId} to ${toEntityId}`);
    return { success: true };
  }

  #removeFromInventory(items, itemId, quantity) {
    // Implementation...
  }

  #addToInventory(items, itemId, quantity, isStackable) {
    // Implementation...
  }
}

export default TransferItemHandler;
```

**Key Patterns:**
- Batch atomic updates for consistency
- Event dispatch for system integration
- Stackable logic in handler
- Ownership tracking via `core:owned_by`

### validateInventoryCapacity Handler

**File:** `src/logic/operationHandlers/validateInventoryCapacityHandler.js`

**Purpose:** Validate if an item fits in inventory based on weight/volume limits.

**Parameters:**
- `entityId` - Entity whose inventory to check
- `itemId` - Item to add
- `quantity` - Amount to add (default: 1)

**Implementation Pattern:**

```javascript
import { assertNonBlankString, assertPresent } from '../../utils/dependencyUtils.js';

class ValidateInventoryCapacityHandler {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  async execute(params, executionContext) {
    const { entityId, itemId, quantity = 1 } = params;
    assertNonBlankString(entityId, 'entityId', 'ValidateInventoryCapacityHandler.execute', this.#logger);
    assertNonBlankString(itemId, 'itemId', 'ValidateInventoryCapacityHandler.execute', this.#logger);

    // Get inventory
    const inventory = this.#entityManager.getComponentData(entityId, 'items:inventory');

    // Get item physical properties (if using encumbrance)
    const hasPhysicalProps = this.#entityManager.hasComponent(itemId, 'items:physical_properties');

    if (!hasPhysicalProps) {
      // No physical limits, always fits
      return { hasCapacity: true, reason: 'no_physical_limits' };
    }

    const physProps = this.#entityManager.getComponentData(itemId, 'items:physical_properties');

    // Calculate required capacity
    const requiredWeight = physProps.weight * quantity;
    const requiredVolume = physProps.volume * quantity;

    // Calculate current totals
    const currentWeight = this.#calculateTotalWeight(inventory.items);
    const currentVolume = this.#calculateTotalVolume(inventory.items);

    // Check limits (if defined)
    const hasWeightLimit = inventory.maxWeight !== undefined;
    const hasVolumeLimit = inventory.maxVolume !== undefined;

    if (hasWeightLimit && currentWeight + requiredWeight > inventory.maxWeight) {
      this.#logger.warn(`Weight limit exceeded for ${entityId}`);
      return {
        hasCapacity: false,
        reason: 'weight_exceeded',
        current: currentWeight,
        max: inventory.maxWeight,
        required: requiredWeight
      };
    }

    if (hasVolumeLimit && currentVolume + requiredVolume > inventory.maxVolume) {
      this.#logger.warn(`Volume limit exceeded for ${entityId}`);
      return {
        hasCapacity: false,
        reason: 'volume_exceeded',
        current: currentVolume,
        max: inventory.maxVolume,
        required: requiredVolume
      };
    }

    return {
      hasCapacity: true,
      reason: 'sufficient_capacity'
    };
  }

  #calculateTotalWeight(items) {
    // Implementation...
  }

  #calculateTotalVolume(items) {
    // Implementation...
  }
}

export default ValidateInventoryCapacityHandler;
```

### Handlers NOT Needed

- ❌ `showItemSelectionUIHandler` - action discovery handles this
- ❌ `addItemToInventoryHandler` - use `transferItemHandler`
- ❌ `removeItemFromInventoryHandler` - use `transferItemHandler`

## Event Definitions

**File:** `data/mods/items/events/item_transferred.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:item_transferred",
  "description": "Dispatched when an item is successfully transferred between entities",
  "payloadSchema": {
    "type": "object",
    "required": ["fromEntityId", "toEntityId", "itemId", "quantity"],
    "properties": {
      "fromEntityId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "toEntityId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "itemId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$"
      },
      "quantity": {
        "type": "integer",
        "minimum": 1
      }
    }
  }
}
```

**File:** `data/mods/items/events/transfer_failed.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "items:transfer_failed",
  "description": "Dispatched when an item transfer fails",
  "payloadSchema": {
    "type": "object",
    "required": ["reason", "actorId", "recipientId", "itemId"],
    "properties": {
      "reason": {
        "type": "string",
        "enum": ["insufficient_capacity", "item_not_found", "invalid_target"]
      },
      "actorId": {
        "type": "string"
      },
      "recipientId": {
        "type": "string"
      },
      "itemId": {
        "type": "string"
      },
      "details": {
        "type": "object"
      }
    }
  }
}
```

**Additional Events:**
- `items:item_used` - Consumable item used
- `items:container_opened` - Container accessed
- `items:container_locked` - Container locked/unlocked

## Example Item Entities

### Portable Item (Letter)

**File:** `data/mods/items/entities/definitions/letter_to_sheriff.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "items:letter_to_sheriff",
  "name": "Letter to Sheriff",
  "components": {
    "core:name": {
      "value": "Letter to Sheriff"
    },
    "core:description": {
      "value": "A sealed letter addressed to the Sheriff. The wax seal bears an official-looking stamp."
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

### Stackable Item (Gold Coin)

**File:** `data/mods/items/entities/definitions/gold_coin.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "items:gold_coin",
  "name": "Gold Coin",
  "components": {
    "core:name": {
      "value": "Gold Coin"
    },
    "core:description": {
      "value": "A gleaming gold coin stamped with the royal seal."
    },
    "items:item": {},
    "items:portable": {},
    "items:stackable": {
      "maxStackSize": 999
    },
    "items:physical_properties": {
      "weight": 0.01,
      "volume": 0.001
    },
    "core:owned_by": {
      "ownerId": "none"
    }
  }
}
```

### Container Entity (Treasure Chest)

**File:** `data/mods/items/entities/definitions/treasure_chest.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "items:treasure_chest",
  "name": "Treasure Chest",
  "components": {
    "core:name": {
      "value": "Treasure Chest"
    },
    "core:description": {
      "value": "An ornate wooden chest with iron bindings. It appears to be locked."
    },
    "items:container": {
      "contents": [],
      "capacity": 50,
      "locked": true,
      "keyItemId": "items:brass_key"
    },
    "core:position": {
      "locationId": "location:tavern"
    }
  }
}
```

## File Structure

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
│   ├── give_item.action.json           # Multi-target: person + item
│   ├── take_item.action.json
│   ├── drop_item.action.json
│   ├── examine_item.action.json
│   ├── use_item.action.json
│   └── open_container.action.json
├── rules/
│   ├── handle_give_item.rule.json
│   ├── handle_take_item.rule.json
│   ├── handle_drop_item.rule.json
│   ├── handle_examine_item.rule.json
│   ├── handle_use_item.rule.json
│   └── handle_open_container.rule.json
├── conditions/
│   ├── event-is-action-give-item.condition.json
│   ├── event-is-action-take-item.condition.json
│   ├── event-is-action-drop-item.condition.json
│   ├── event-is-action-examine-item.condition.json
│   ├── event-is-action-use-item.condition.json
│   ├── event-is-action-open-container.condition.json
│   ├── has-items-in-inventory.condition.json
│   └── container-is-locked.condition.json
├── scopes/
│   ├── actor_inventory_items.scope
│   ├── items_at_location.scope
│   ├── close_actors_with_inventory.scope
│   ├── containers_in_location.scope
│   └── consumable_items_in_inventory.scope
├── events/
│   ├── item_transferred.event.json
│   ├── transfer_failed.event.json
│   ├── item_used.event.json
│   └── container_opened.event.json
└── entities/
    └── definitions/
        ├── letter_to_sheriff.entity.json
        ├── gold_coin.entity.json
        ├── treasure_chest.entity.json
        └── brass_key.entity.json
```

## Mod Manifest

**File:** `data/mods/items/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "items",
  "version": "1.0.0",
  "name": "Items System",
  "description": "Complete items, inventory, and container management system",
  "dependencies": ["core", "positioning"],
  "content": {
    "components": [
      "item.component.json",
      "portable.component.json",
      "stackable.component.json",
      "consumable.component.json",
      "physical_properties.component.json",
      "inventory.component.json",
      "container.component.json",
      "held_item.component.json"
    ],
    "actions": [
      "give_item.action.json",
      "take_item.action.json",
      "drop_item.action.json",
      "examine_item.action.json",
      "use_item.action.json",
      "open_container.action.json"
    ],
    "rules": [
      "handle_give_item.rule.json",
      "handle_take_item.rule.json",
      "handle_drop_item.rule.json",
      "handle_examine_item.rule.json",
      "handle_use_item.rule.json",
      "handle_open_container.rule.json"
    ],
    "conditions": [
      "event-is-action-give-item.condition.json",
      "event-is-action-take-item.condition.json",
      "event-is-action-drop-item.condition.json",
      "event-is-action-examine-item.condition.json",
      "event-is-action-use-item.condition.json",
      "event-is-action-open-container.condition.json",
      "has-items-in-inventory.condition.json",
      "container-is-locked.condition.json"
    ],
    "scopes": [
      "actor_inventory_items.scope",
      "items_at_location.scope",
      "close_actors_with_inventory.scope",
      "containers_in_location.scope",
      "consumable_items_in_inventory.scope"
    ],
    "events": [
      "item_transferred.event.json",
      "transfer_failed.event.json",
      "item_used.event.json",
      "container_opened.event.json"
    ],
    "entities": [
      "letter_to_sheriff.entity.json",
      "gold_coin.entity.json",
      "treasure_chest.entity.json",
      "brass_key.entity.json"
    ]
  }
}
```

## Test Requirements

### Test Organization

```
tests/
├── unit/
│   └── logic/
│       └── operationHandlers/
│           ├── transferItemHandler.test.js
│           └── validateInventoryCapacityHandler.test.js
└── integration/
    └── mods/
        └── items/
            ├── give_item_action_discovery.test.js
            ├── give_item_action.test.js
            ├── give_item_rule.test.js
            ├── take_item_action_discovery.test.js
            ├── drop_item_action_discovery.test.js
            ├── inventory_capacity.test.js
            └── container_system.test.js
```

### Action Discovery Tests

**File:** `tests/integration/mods/items/give_item_action_discovery.test.js`

**Test Scenarios:**

1. **Multi-Target Action Generation**
   - Verify action generates for each item × recipient combination
   - Verify `contextFrom: "primary"` resolves in primary target's context
   - Verify `generateCombinations: true` creates separate actions
   - Expected: "give gun to Frank", "give letter to Frank", etc.

2. **Discovery with Valid Prerequisites**
   - Setup: Actor with inventory containing items, nearby actors
   - Expected: Actions appear for each valid combination
   - Verify: Action instances have correct target IDs

3. **Discovery Blocked - No Items**
   - Setup: Actor with empty inventory
   - Expected: No give actions appear
   - Verify: Action discovery respects inventory state

4. **Discovery Blocked - No Recipients**
   - Setup: Actor with items but no nearby actors
   - Expected: No give actions appear
   - Verify: Primary scope returns empty set

5. **Stacking Verification**
   - Setup: Multiple stackable items (e.g., 50 coins)
   - Expected: Single action "give coin to Frank" (not 50 actions)
   - Verify: Stackable items treated as one entry

**Test Implementation Pattern:**

```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('items:give_item action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:give_item'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should generate separate actions for each item-recipient combination', async () => {
    // Setup actor with 2 items
    const actorId = await testFixture.createActor({
      components: {
        'items:inventory': {
          items: [
            { itemId: 'items:gun', quantity: 1 },
            { itemId: 'items:letter', quantity: 1 }
          ]
        }
      }
    });

    // Setup 2 nearby recipients
    const frank = await testFixture.createActor({ name: 'Frank' });
    const sarah = await testFixture.createActor({ name: 'Sarah' });

    // Make recipients close
    await testFixture.makeActorsClose(actorId, [frank, sarah]);

    // Discover actions
    const actions = await testFixture.discoverActions(actorId);

    // Verify combinations
    expect(actions).toContainAction('give gun to Frank');
    expect(actions).toContainAction('give letter to Frank');
    expect(actions).toContainAction('give gun to Sarah');
    expect(actions).toContainAction('give letter to Sarah');
  });

  // More tests...
});
```

### Action Behavior Tests

**File:** `tests/integration/mods/items/give_item_action.test.js`

**Test Scenarios:**

1. **Action Properties Validation**
   - Verify ID: `items:give_item`
   - Verify targets structure with primary/secondary
   - Verify `contextFrom: "primary"`
   - Verify `generateCombinations: true`
   - Verify template format

2. **Visual Styling Validation**
   - Verify blue theme colors (#1976d2)
   - Verify WCAG 2.1 AA contrast
   - Use `validateVisualStyling` helper
   - Use `validateAccessibilityCompliance` helper

3. **Component Requirements**
   - Verify `required_components.actor` includes `items:inventory`
   - Use `validateComponentRequirements` helper

4. **Schema Compliance**
   - Verify against action.schema.json
   - Use `validateRequiredActionProperties` helper

### Rule Behavior Tests

**File:** `tests/integration/mods/items/give_item_rule.test.js`

**Test Scenarios:**

1. **Successful Transfer**
   - Verify item removed from actor inventory
   - Verify item added to recipient inventory
   - Verify `core:owned_by` updated
   - Verify perception log entry created
   - Verify turn ended

2. **Capacity Exceeded**
   - Setup recipient with full inventory
   - Verify transfer fails
   - Verify `items:transfer_failed` event dispatched
   - Verify actor retains item
   - Verify failure reason is `insufficient_capacity`

3. **Stacking Behavior**
   - Give stackable item to actor who already has some
   - Verify quantity increments (not new stack)
   - Verify max stack size respected

4. **Ownership Tracking**
   - Verify `core:owned_by.ownerId` updated to recipient
   - Verify old owner relationship severed

### Operation Handler Tests

**File:** `tests/unit/logic/operationHandlers/transferItemHandler.test.js`

**Test Scenarios:**

1. **Atomic Updates**
   - Verify both inventories updated in single transaction
   - Verify rollback on partial failure
   - Use mock `batchAddComponentsOptimized`

2. **Stackable Logic**
   - Transfer to inventory with existing stack
   - Verify quantity increments correctly
   - Verify respects `maxStackSize`

3. **Non-Stackable Logic**
   - Transfer to inventory
   - Verify creates new inventory entry
   - Verify doesn't stack

4. **Event Dispatching**
   - Verify `items:item_transferred` dispatched
   - Verify correct payload structure

**File:** `tests/unit/logic/operationHandlers/validateInventoryCapacityHandler.test.js`

**Test Scenarios:**

1. **No Physical Limits**
   - Item without `items:physical_properties`
   - Expected: Always returns `hasCapacity: true`

2. **Weight Limit Exceeded**
   - Item would exceed `maxWeight`
   - Expected: Returns `hasCapacity: false`, reason: `weight_exceeded`

3. **Volume Limit Exceeded**
   - Item would exceed `maxVolume`
   - Expected: Returns `hasCapacity: false`, reason: `volume_exceeded`

4. **Within Limits**
   - Item fits within both limits
   - Expected: Returns `hasCapacity: true`

### Coverage Targets

- **Unit Tests**: 90%+ functions/lines, 80%+ branches
- **Integration Tests**: 80%+ functions/lines, 70%+ branches
- **Operation Handlers**: 100% coverage (critical business logic)
- **Action Discovery**: 90%+ coverage (core functionality)

## Implementation Phases

### Phase 1: Core Infrastructure
**Goal:** Support basic "give item" use case with corrected patterns

**Tasks:**

1. Create mod structure
   - [ ] Create `data/mods/items/` directory structure
   - [ ] Create `mod-manifest.json`

2. Implement modular components
   - [ ] Create `items:item` (marker)
   - [ ] Create `items:portable` (marker)
   - [ ] Create `items:physical_properties`
   - [ ] Create `items:inventory`

3. Implement operation handlers
   - [ ] Implement `transferItemHandler.js`
   - [ ] Implement `validateInventoryCapacityHandler.js`
   - [ ] Register handlers in DI container

4. Create give_item action with correct multi-target pattern
   - [ ] Create `give_item.action.json`
   - [ ] Create `event-is-action-give-item.condition.json`
   - [ ] Create `handle_give_item.rule.json` with inline perception logging

5. Create scopes
   - [ ] Create `actor_inventory_items.scope`
   - [ ] Create `close_actors_with_inventory.scope`

6. Create test item entities
   - [ ] Create `letter_to_sheriff.entity.json`
   - [ ] Create `gun.entity.json`

7. Write comprehensive tests
   - [ ] Unit tests for handlers
   - [ ] Integration tests for action discovery
   - [ ] Integration tests for rule behavior

**Success Criteria:**
- Player can give letter to NPC
- Actions appear as "give letter to Frank", "give gun to Frank", etc.
- No UI selection dialogs (handled by action discovery)
- Ownership tracking works correctly
- All tests pass with 80%+ coverage

### Phase 2: Inventory Management
**Goal:** Full inventory system with capacity (optional feature)

**Tasks:**

1. Add stackable capability
   - [ ] Create `items:stackable` component
   - [ ] Update `transferItemHandler` for stacking logic
   - [ ] Create stackable item entities (coins, ammo)

2. Add take and drop actions
   - [ ] Create `take_item.action.json`
   - [ ] Create `drop_item.action.json`
   - [ ] Create corresponding rules and conditions
   - [ ] Create `items_at_location.scope`

3. Implement capacity validation (optional)
   - [ ] Test weight/volume validation
   - [ ] Create failure event handling
   - [ ] Add capacity UI feedback

4. Create inventory UI display
   - [ ] Display current items
   - [ ] Show capacity bars (if limits enabled)
   - [ ] Item tooltips with details

5. Write tests
   - [ ] Take/drop action tests
   - [ ] Stacking behavior tests
   - [ ] Capacity validation tests

**Success Criteria:**
- Items can be taken from ground/containers
- Items can be dropped to ground
- Stackable items work correctly
- Optional capacity limits enforced
- Inventory UI displays correctly

### Phase 3: Container System
**Goal:** Chests, storage furniture, locked containers

**Tasks:**

1. Implement container component
   - [ ] Create `items:container` component
   - [ ] Create container entities (chest, drawer, etc.)

2. Add container interactions
   - [ ] Create `open_container.action.json`
   - [ ] Create locking/unlocking logic
   - [ ] Create key item system
   - [ ] Create `containers_in_location.scope`

3. Extend transfer handler
   - [ ] Support container as source/destination
   - [ ] Add locked container checks

4. Create container UI
   - [ ] Container contents display
   - [ ] Transfer to/from container
   - [ ] Lock status indication

5. Write tests
   - [ ] Container opening tests
   - [ ] Locked container tests
   - [ ] Key item tests
   - [ ] Container capacity tests

**Success Criteria:**
- Containers can be opened/closed
- Locked containers require keys
- Items can be stored in containers
- Container UI works correctly

### Phase 4: Advanced Features
**Goal:** Polish and gameplay depth

**Tasks:**

1. Implement consumable system
   - [ ] Create `items:consumable` component
   - [ ] Create `use_item.action.json`
   - [ ] Implement use logic (decrement uses)
   - [ ] Create consumable item entities

2. Add examine action
   - [ ] Create `examine_item.action.json`
   - [ ] Show detailed item info
   - [ ] Display physical properties

3. Add held item system (optional)
   - [ ] Create `items:held_item` component
   - [ ] Equip/unequip actions
   - [ ] Visual indicators for held items

4. Polish and optimization
   - [ ] Performance optimization for large inventories
   - [ ] Cache capacity calculations
   - [ ] Optimize action discovery

5. Write comprehensive tests
   - [ ] Consumable item tests
   - [ ] Examine action tests
   - [ ] Equipment system tests (if implemented)
   - [ ] Performance tests

**Success Criteria:**
- Consumable items work correctly
- Items can be examined for details
- Optional equipment system functional
- All systems optimized and tested

## Validation Criteria

### Code Quality

- [ ] All JSON files validate against their schemas
- [ ] No ESLint errors or warnings (run `npx eslint <modified-files>`)
- [ ] Code follows project conventions from CLAUDE.md
- [ ] All files use proper namespacing (`items:identifier`)
- [ ] Dependency injection used for all services

### Test Coverage

- [ ] Action discovery tests: >90% coverage
- [ ] Action behavior tests: >90% coverage
- [ ] Rule behavior tests: >80% coverage
- [ ] Operation handler tests: 100% coverage
- [ ] All edge cases and failure scenarios covered
- [ ] Mock-based testing for external dependencies

### Functional Validation

- [ ] Actions appear when prerequisites met
- [ ] Actions blocked when prerequisites not met
- [ ] Multi-target combinations generated correctly
- [ ] `contextFrom` resolves in correct context
- [ ] Item transfers work atomically
- [ ] Ownership tracking updates correctly
- [ ] Perception logs created for observable actions
- [ ] Turn management functions properly
- [ ] Visual styling renders correctly in UI
- [ ] Stacking behavior works for stackable items
- [ ] Capacity validation works (if enabled)
- [ ] Container system works correctly

### Schema Compliance

- [ ] Run `npm run scope:lint` - all scopes valid
- [ ] Run `npm run typecheck` - no type errors
- [ ] All components follow component.schema.json
- [ ] All actions follow action.schema.json
- [ ] All rules follow rule.schema.json
- [ ] All events follow event.schema.json

### Integration Validation

- [ ] Works with positioning system
- [ ] Works with perception system
- [ ] Works with `core:owned_by`
- [ ] Works with `core:position`
- [ ] No conflicts with existing mods

## Reference Documentation

### Related Files Analyzed

**Core Architecture:**
- `CLAUDE.md` - Project patterns and conventions
- `brainstorming/items-system-design-corrected.md` - Corrected architectural analysis

**Reference Implementations:**
- `data/mods/clothing/actions/remove_others_clothing.action.json` - Multi-target pattern
- `data/mods/positioning/components/sitting_on.component.json` - Marker component pattern
- `data/mods/positioning/components/kneeling_before.component.json` - Marker component pattern

**Test Patterns:**
- `tests/integration/mods/seduction/draw_attention_to_breasts_action_discovery.test.js`
- `tests/integration/mods/sex/fondle_breasts_over_clothes_action_discovery.test.js`
- `tests/common/mods/ModTestFixture.js` - Test fixture usage
- `tests/common/mods/actionPropertyHelpers.js` - Validation helpers

**Handler Patterns:**
- `src/logic/operationHandlers/BaseOperationHandler.js` - Base class
- `src/dependencyInjection/minimalContainerConfig.js` - Handler registration

### Key Architectural Findings

**Action Discovery System:**
- ✅ Uses `generateCombinations: true` with multi-target
- ✅ `contextFrom` property resolves secondary scope in context of specified entity
- ✅ Creates individual actions at discovery time (no runtime selection)
- ❌ No `SHOW_ITEM_SELECTION_UI` operation exists

**Component Architecture:**
- ✅ Modular marker components (positioning pattern)
- ✅ Separate components for capabilities
- ✅ Composition over monolithic objects
- ❌ Not single component with all properties

**Scope DSL:**
- ✅ Supports union operators: `+` and `|` (identical behavior)
- ✅ Field access: `.`
- ✅ Array iteration: `[]`
- ✅ JSON Logic filters: `[{...}]`
- ✅ Component namespacing: `:`

**Operation Handlers:**
- ✅ Custom handlers for complex logic only
- ✅ Use `CALL_OPERATION_HANDLER` in rules
- ✅ Atomic batch updates for consistency
- ✅ Event dispatching for system integration

**Integration Points:**
- ✅ `core:owned_by` for ownership tracking
- ✅ `core:position` for item location
- ✅ `positioning:closeness` for nearby actors
- ✅ `ADD_PERCEPTION_LOG_ENTRY` for observable events

## Notes

**Critical Corrections from Original Design:**

1. **contextFrom Value**
   - ❌ Original spec incorrectly used `"contextFrom": "actor"`
   - ✅ Corrected to `"contextFrom": "primary"` per action.schema.json
   - ✅ Only `"primary"` is valid according to schema enum

2. **Perception Logging Pattern**
   - ❌ Original used macro-based approach (macros don't exist in codebase)
   - ✅ Corrected to inline ADD_PERCEPTION_LOG_ENTRY operations in rules
   - ✅ Matches actual pattern used in positioning and other mods

3. **Operation Handler Pattern**
   - ❌ Original showed extending BaseOperationHandler with execute() method
   - ✅ Corrected to show actual pattern: standalone class with constructor DI
   - ✅ BaseOperationHandler is a utility class, not for extension

4. **Action Discovery Pattern**
   - ✅ Multi-target with `generateCombinations: true` (correct)
   - ✅ Result: "give gun to Frank", "give letter to Frank" (individual actions)
   - ❌ No `SHOW_ITEM_SELECTION_UI` operation exists

5. **Component Architecture**
   - ✅ Modular marker components (`items:item`, `items:portable`, etc.)
   - ✅ Pattern matches positioning system architecture
   - ❌ Not monolithic component with all properties

6. **Item ID Resolution**
   - ✅ `event.payload.secondaryTargetId` from action discovery
   - ✅ Comes automatically from multi-target action
   - ❌ No UI selection storing `selectedItemId`

**Design Philosophy Alignment:**

- **Modding-First**: All content in mod files, engine interprets
- **ECS Architecture**: Components are data, systems are rules
- **Event-Driven**: Communication via event bus
- **Action Discovery**: Actions generated at discovery time
- **Schema Validation**: All JSON validated against schemas

**Future Considerations:**

- **Equipment System**: Extend with weapon/armor slots
- **Crafting System**: Combine items to create new items
- **Durability System**: Items degrade over time/use
- **Weight Categories**: Light/medium/heavy item classifications
- **Quality Levels**: Common/rare/legendary item tiers
