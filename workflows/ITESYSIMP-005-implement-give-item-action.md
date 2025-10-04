# ITESYSIMP-005: Implement Give Item Action

**Phase:** 1 - Core Infrastructure
**Priority:** Critical
**Estimated Effort:** 2 hours

## Goal

Create the `give_item` multi-target action with correct `contextFrom: "primary"` pattern and `generateCombinations: true` for discovery-time combination generation.

## Context

The give_item action demonstrates the multi-target pattern where the system generates all valid combinations at discovery time. The secondary target uses `contextFrom: "primary"` to access the actor's inventory items.

## Tasks

### 1. Create give_item Action

Create `data/mods/items/actions/give_item.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "items:give_item",
  "name": "Give Item",
  "description": "Give an item from your inventory to another actor",
  "generateCombinations": true,
  "targets": {
    "primary": {
      "scope": "positioning:close_actors",
      "placeholder": "recipient",
      "description": "Actor to give item to",
      "contextFrom": "actor"
    },
    "secondary": {
      "scope": "items:actor_inventory_items",
      "placeholder": "item",
      "description": "Item to give",
      "contextFrom": "primary"
    }
  },
  "conditions": [
    {
      "type": "HAS_COMPONENT",
      "entityRef": "secondary",
      "componentId": "items:portable"
    }
  ],
  "formatTemplate": "Give {secondary.name} to {primary.name}"
}
```

### 2. Create Condition

Create `data/mods/items/conditions/event-is-action-give-item.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "items:event-is-action-give-item",
  "description": "Checks if event is the give_item action",
  "jsonLogic": {
    "==": [
      { "var": "event.payload.actionId" },
      "items:give_item"
    ]
  }
}
```

### 3. Create Rule with Inline Perception Logging

Create `data/mods/items/rules/handle_give_item.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "items:handle_give_item",
  "description": "Handles give_item action with capacity validation and perception logging",
  "priority": 100,
  "eventType": "ATTEMPT_ACTION",
  "conditions": [
    "items:event-is-action-give-item"
  ],
  "operations": [
    {
      "type": "VALIDATE_INVENTORY_CAPACITY",
      "comment": "Check if recipient can carry the item",
      "parameters": {
        "targetEntity": "{event.payload.targetId}",
        "itemEntity": "{event.payload.secondaryTargetId}",
        "result_variable": "capacityCheck"
      }
    },
    {
      "type": "CONDITIONAL_BRANCH",
      "comment": "Branch based on capacity validation",
      "condition": {
        "==": [
          { "var": "context.capacityCheck.valid" },
          false
        ]
      },
      "thenOperations": [
        {
          "type": "GET_COMPONENT",
          "parameters": {
            "entity_id": "{event.payload.actorId}",
            "component_id": "positioning:position",
            "result_variable": "actorPosition"
          }
        },
        {
          "type": "BUILD_MESSAGE",
          "parameters": {
            "template": "{actorName} tried to give {itemName} to {targetName}, but they can't carry it.",
            "result_variable": "logMessage"
          }
        },
        {
          "type": "ADD_PERCEPTION_LOG_ENTRY",
          "parameters": {
            "location_id": "{context.actorPosition.locationId}",
            "entry": {
              "descriptionText": "{context.logMessage}",
              "timestamp": "{timestamp}",
              "perceptionType": "item_transfer_failed",
              "actorId": "{event.payload.actorId}",
              "targetId": "{event.payload.targetId}",
              "itemId": "{event.payload.secondaryTargetId}",
              "reason": "{context.capacityCheck.reason}"
            }
          }
        },
        {
          "type": "DISPATCH_EVENT",
          "parameters": {
            "eventType": "TRANSFER_FAILED",
            "payload": {
              "actorId": "{event.payload.actorId}",
              "targetId": "{event.payload.targetId}",
              "itemId": "{event.payload.secondaryTargetId}",
              "reason": "{context.capacityCheck.reason}"
            }
          }
        }
      ],
      "elseOperations": [
        {
          "type": "TRANSFER_ITEM",
          "comment": "Move item from actor to target",
          "parameters": {
            "fromEntity": "{event.payload.actorId}",
            "toEntity": "{event.payload.targetId}",
            "itemEntity": "{event.payload.secondaryTargetId}",
            "result_variable": "transferResult"
          }
        },
        {
          "type": "GET_COMPONENT",
          "parameters": {
            "entity_id": "{event.payload.actorId}",
            "component_id": "positioning:position",
            "result_variable": "actorPosition"
          }
        },
        {
          "type": "GET_NAME",
          "parameters": {
            "entity_ref": "actor",
            "result_variable": "actorName"
          }
        },
        {
          "type": "GET_NAME",
          "parameters": {
            "entity_ref": "target",
            "result_variable": "targetName"
          }
        },
        {
          "type": "GET_NAME",
          "parameters": {
            "entity_ref": "secondaryTarget",
            "result_variable": "itemName"
          }
        },
        {
          "type": "BUILD_MESSAGE",
          "parameters": {
            "template": "{actorName} gave {itemName} to {targetName}.",
            "result_variable": "logMessage"
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
      ]
    }
  ]
}
```

### 4. Update Mod Manifest

Add to `data/mods/items/mod-manifest.json`:

```json
{
  "actions": [
    "give_item.action.json"
  ],
  "conditions": [
    "event-is-action-give-item.condition.json"
  ],
  "rules": [
    "handle_give_item.rule.json"
  ]
}
```

### 5. Create Integration Tests

Create `tests/integration/mods/items/give_item_action_discovery.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Give Item Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should discover give_item with all inventory item + close actor combinations', () => {
    const actor = testBed.createEntity('actor-1', {
      'items:inventory': {
        items: ['item-1', 'item-2'],
        capacity: { maxWeight: 50, maxItems: 10 }
      }
    });

    const recipient = testBed.createEntity('recipient-1', {
      'positioning:position': { locationId: 'loc-1' }
    });

    testBed.setActorPosition(actor, 'loc-1');

    const actions = testBed.discoverActions(actor);
    const giveActions = actions.filter(a => a.actionId === 'items:give_item');

    expect(giveActions).toHaveLength(2); // 2 items × 1 recipient
    expect(giveActions[0].targetId).toBe(recipient);
    expect(giveActions[0].secondaryTargetId).toBe('item-1');
    expect(giveActions[1].secondaryTargetId).toBe('item-2');
  });

  it('should generate combinations at discovery time, not runtime', () => {
    // Test that UI receives pre-generated combinations
    const actor = testBed.createEntityWithInventory(['item-1', 'item-2']);
    const recipient = testBed.createNearbyActor(actor);

    const discovered = testBed.discoverActions(actor);
    expect(discovered.length).toBeGreaterThan(1); // Multiple combinations pre-generated
  });
});
```

Create `tests/integration/mods/items/give_item_rule_execution.test.js` for rule behavior tests.

## Validation

- [ ] Action uses `contextFrom: "primary"` for secondary target
- [ ] `generateCombinations: true` set correctly
- [ ] Condition properly checks action ID
- [ ] Rule includes inline perception logging (no macro calls)
- [ ] Capacity validation prevents overloaded inventories
- [ ] Successful transfer updates both inventories atomically
- [ ] Perception logs created for success and failure
- [ ] Integration tests verify combination generation at discovery time
- [ ] All tests pass
- [ ] Mod manifest updated

## Dependencies

- ITESYSIMP-002: Marker components must exist
- ITESYSIMP-003: Data components must exist
- ITESYSIMP-004: Operation handlers must be implemented
- ITESYSIMP-006: Scopes must be created (for testing)

## Next Steps

After completion, proceed to:
- ITESYSIMP-007: Create test entities
