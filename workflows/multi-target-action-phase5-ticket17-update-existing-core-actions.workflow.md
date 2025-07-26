# Ticket: Update Existing Core Actions

## Ticket ID: PHASE5-TICKET17
## Priority: Low
## Estimated Time: 10-12 hours
## Dependencies: PHASE5-TICKET16
## Blocks: PHASE5-TICKET18

## Overview

Update a selected set of existing core actions to demonstrate the multi-target action system capabilities while maintaining backward compatibility. This will provide working examples for modders and validate the migration process with real actions.

## Goals

1. **Demonstrate Multi-Target Features**: Show practical use of multi-target capabilities
2. **Maintain Backward Compatibility**: Ensure existing actions continue working
3. **Provide Examples**: Create reference implementations for modders
4. **Validate Migration**: Test migration process with real core actions
5. **Performance Optimization**: Apply new performance features to existing actions

## Action Selection Criteria

1. **High Usage**: Actions frequently used by players
2. **Migration Benefit**: Actions that benefit from multi-target improvements
3. **Example Value**: Actions that demonstrate different patterns
4. **Complexity Range**: Mix of simple, moderate, and complex actions
5. **System Coverage**: Actions covering different game systems

## Implementation Steps

### Step 1: Analyze Existing Core Actions

Create file: `analysis/core-actions-migration-analysis.md`

```markdown
# Core Actions Migration Analysis

Analysis of existing core actions for multi-target migration potential.

## Action Inventory

### Current Core Actions (from data/mods/core/actions/)

1. **talk_to_actor.action.json** - Simple single-target
2. **examine_object.action.json** - Simple single-target
3. **move_to_location.action.json** - Simple single-target
4. **give_item.action.json** - Could benefit from explicit item selection
5. **use_item.action.json** - Could become "use item on target"
6. **attack_target.action.json** - Could benefit from weapon selection
7. **unlock_container.action.json** - Perfect for context-dependent targeting

## Migration Priority Matrix

### High Priority (Immediate Migration)

#### 1. Give Item Action
**Current**: Implicit item selection
**Benefit**: Explicit item and recipient selection
**Pattern**: Independent multi-target
**Complexity**: Moderate

```json
// Before
{
  "id": "core:give_item",
  "name": "give item to {target}",
  "target": {
    "scope": "location.core:actors[]",
    "validation": { "conscious": true }
  }
}

// After
{
  "id": "core:give_item_v2", 
  "name": "give {item} to {person}",
  "targetDefinitions": {
    "item": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "tradeable": true }
    },
    "person": {
      "scope": "location.core:actors[]", 
      "validation": { "conscious": true }
    }
  }
}
```

#### 2. Use Item Action
**Current**: Generic item usage
**Benefit**: Specific tool usage on targets
**Pattern**: Tool + target selection
**Complexity**: Moderate

```json
// Before
{
  "id": "core:use_item",
  "name": "use {target}",
  "target": {
    "scope": "actor.core:inventory.items[]"
  }
}

// After
{
  "id": "core:use_tool_on_target",
  "name": "use {tool} on {target}",
  "targetDefinitions": {
    "tool": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "usable": true }
    },
    "target": {
      "scope": "location.core:actors[] | location.core:objects[]"
    }
  }
}
```

#### 3. Unlock Container Action
**Current**: Manual key selection
**Benefit**: Context-dependent key selection
**Pattern**: Context-dependent targets
**Complexity**: High

```json
// After
{
  "id": "core:unlock_with_key",
  "name": "unlock {container} with {key}",
  "targetDefinitions": {
    "container": {
      "scope": "location.core:objects[]",
      "validation": { "locked": true }
    },
    "key": {
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "validation": { "key_matches_lock": true }
    }
  }
}
```

### Medium Priority (Phase 2)

#### 4. Attack Action
**Current**: Simple target selection
**Benefit**: Weapon + target selection
**Pattern**: Equipment + target
**Complexity**: Moderate

#### 5. Trade Action
**Current**: Basic trading
**Benefit**: Item + person + trade item selection
**Pattern**: Multi-item exchange
**Complexity**: High

### Low Priority (Future Enhancement)

#### 6. Craft Action
**Current**: Recipe selection
**Benefit**: Recipe + tool + materials selection
**Pattern**: Complex dependency chain
**Complexity**: Very High

## Migration Strategy by Action

### Give Item Action Migration

**Migration Type**: Independent Multi-Target
**Backward Compatibility**: Keep original, add enhanced version
**Testing Priority**: High (frequently used)

**Before**:
```json
{
  "id": "core:give_item",
  "name": "give item to {target}",
  "target": {
    "scope": "location.core:actors[]",
    "validation": { "conscious": true }
  },
  "conditions": [
    {
      "description": "Actor must have items to give",
      "condition": { ">": [{ "var": "actor.inventory.items.length" }, 0] }
    }
  ],
  "effects": [
    {
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_GIVEN",
        "payload": { "recipient": "target.id" }
      }
    }
  ]
}
```

**After**:
```json
{
  "id": "core:give_item_enhanced",
  "name": "give {item} to {person}",
  "targetDefinitions": {
    "item": {
      "name": "item",
      "description": "Item to give away",
      "scope": "actor.core:inventory.items[]",
      "required": true,
      "maxCombinations": 10,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "tradeable": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    },
    "person": {
      "name": "person",
      "description": "Person to receive the item",
      "scope": "location.core:actors[]",
      "required": true,
      "maxCombinations": 5,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    }
  },
  "maxCombinations": 25,
  "conditions": [
    {
      "description": "Both parties must be conscious and willing",
      "condition": {
        "and": [
          { "var": "actor.components.core:actor.conscious" },
          { "var": "person.components.core:actor.conscious" },
          { "!=": [{ "var": "person.id" }, { "var": "actor.id" }] }
        ]
      }
    }
  ],
  "effects": [
    {
      "description": "Remove item from actor's inventory",
      "operation": {
        "type": "modifyComponent",
        "entityId": "actor.id",
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "remove",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Add item to person's inventory",
      "operation": {
        "type": "modifyComponent",
        "entityId": "person.id", 
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "add",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Dispatch enhanced give event",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_GIVEN_ENHANCED",
        "payload": {
          "giver": "actor.id",
          "recipient": "person.id",
          "item": "item.id",
          "itemName": "item.components.core:item.name",
          "location": "actor.components.core:position.locationId"
        }
      }
    }
  ],
  "command": "give {item.components.core:item.name} to {person.components.core:actor.name}",
  "result": "You give {item.components.core:item.name} to {person.components.core:actor.name}."
}
```

**Benefits**:
- Explicit item selection prevents confusion
- Better validation ensures only tradeable items
- Enhanced event payload for rule system
- Performance optimization with combination limits
- Improved user experience with descriptive names
```

### Step 2: Implement Enhanced Give Item Action

Create file: `data/mods/core/actions/give_item_enhanced.action.json`

```json
{
  "id": "core:give_item_enhanced",
  "name": "give {item} to {person}",
  "description": "Give a specific item from your inventory to another person",
  "category": "social",
  "targetDefinitions": {
    "item": {
      "name": "item",
      "description": "Item from your inventory to give away",
      "scope": "actor.core:inventory.items[]",
      "required": true,
      "maxCombinations": 10,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "tradeable": { "type": "boolean", "const": true },
                  "weight": { "type": "number", "maximum": 50 }
                },
                "required": ["tradeable"]
              }
            },
            "required": ["core:item"]
          }
        }
      }
    },
    "person": {
      "name": "person",
      "description": "Person who will receive the item",
      "scope": "location.core:actors[]",
      "required": true,
      "maxCombinations": 5,
      "validation": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "not": { "const": "actor.id" }
          },
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true },
                  "alive": { "type": "boolean", "const": true }
                },
                "required": ["conscious", "alive"]
              }
            },
            "required": ["core:actor"]
          }
        }
      }
    }
  },
  "maxCombinations": 25,
  "conditions": [
    {
      "description": "Actor must be conscious and able to give items",
      "condition": {
        "and": [
          { "var": "actor.components.core:actor.conscious" },
          { "var": "actor.components.core:actor.alive" }
        ]
      }
    },
    {
      "description": "Person must be willing to receive items",
      "condition": {
        "or": [
          { "==": [{ "var": "person.components.core:actor.faction" }, "friendly"] },
          { "==": [{ "var": "person.components.core:actor.faction" }, "neutral"] }
        ]
      }
    },
    {
      "description": "Both characters must be in the same location",
      "condition": {
        "==": [
          { "var": "actor.components.core:position.locationId" },
          { "var": "person.components.core:position.locationId" }
        ]
      }
    }
  ],
  "effects": [
    {
      "description": "Remove item from actor's inventory",
      "operation": {
        "type": "modifyComponent",
        "entityId": "actor.id",
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "remove",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Add item to person's inventory",
      "operation": {
        "type": "modifyComponent",
        "entityId": "person.id",
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "add",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Update relationship between giver and receiver",
      "operation": {
        "type": "modifyComponent",
        "entityId": "person.id",
        "componentId": "social:relationships",
        "modifications": {
          "relationships": {
            "operation": "updateRelationship",
            "targetId": "actor.id",
            "changes": {
              "generosity": { "operation": "add", "value": 1 },
              "last_interaction": { "operation": "set", "value": "game.timestamp" }
            }
          }
        }
      }
    },
    {
      "description": "Dispatch enhanced give event for rule processing",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_GIVEN_ENHANCED",
        "payload": {
          "giver": "actor.id",
          "giverName": "actor.components.core:actor.name",
          "recipient": "person.id",
          "recipientName": "person.components.core:actor.name",
          "item": "item.id",
          "itemName": "item.components.core:item.name",
          "itemValue": "item.components.core:item.value",
          "location": "actor.components.core:position.locationId",
          "timestamp": "game.timestamp",
          "turnNumber": "game.turnNumber"
        }
      }
    }
  ],
  "command": "give {item.components.core:item.name} to {person.components.core:actor.name}",
  "result": "You give {item.components.core:item.name} to {person.components.core:actor.name}. They seem {person.components.core:actor.mood || 'pleased'} with the gift."
}
```

### Step 3: Implement Use Tool On Target Action

Create file: `data/mods/core/actions/use_tool_on_target.action.json`

```json
{
  "id": "core:use_tool_on_target",
  "name": "use {tool} on {target}",
  "description": "Use a tool or item from your inventory on a target",
  "category": "interaction",
  "targetDefinitions": {
    "tool": {
      "name": "tool",
      "description": "Tool or usable item from your inventory",
      "scope": "actor.core:inventory.items[]",
      "required": true,
      "maxCombinations": 8,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "usable": { "type": "boolean", "const": true },
                  "durability": { "type": "number", "minimum": 1 }
                },
                "required": ["usable"]
              }
            },
            "required": ["core:item"]
          }
        }
      }
    },
    "target": {
      "name": "target",
      "description": "Object, person, or location to use the tool on",
      "scope": "location.core:actors[] | location.core:objects[] | location.core:features[]",
      "required": true,
      "maxCombinations": 10,
      "validation": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "not": { "const": "actor.id" }
          }
        }
      }
    }
  },
  "maxCombinations": 40,
  "conditions": [
    {
      "description": "Actor must be conscious and able to use tools",
      "condition": {
        "and": [
          { "var": "actor.components.core:actor.conscious" },
          { "var": "actor.components.core:actor.alive" }
        ]
      }
    },
    {
      "description": "Tool must be compatible with target type",
      "condition": {
        "or": [
          {
            "and": [
              { "in": ["medical", { "var": "tool.components.core:item.categories" }] },
              { "!=": [{ "var": "target.components.core:health" }, null] }
            ]
          },
          {
            "and": [
              { "in": ["repair", { "var": "tool.components.core:item.categories" }] },
              { "!=": [{ "var": "target.components.core:durability" }, null] }
            ]
          },
          {
            "and": [
              { "in": ["key", { "var": "tool.components.core:item.categories" }] },
              { "!=": [{ "var": "target.components.core:container" }, null] }
            ]
          }
        ]
      }
    },
    {
      "description": "Actor must be close enough to target",
      "condition": {
        "<=": [{ "var": "distance_to_target" }, 2]
      }
    }
  ],
  "effects": [
    {
      "description": "Reduce tool durability from use",
      "operation": {
        "type": "modifyComponent",
        "entityId": "tool.id",
        "componentId": "core:item",
        "modifications": {
          "durability": {
            "operation": "subtract",
            "value": 1
          }
        }
      }
    },
    {
      "description": "Dispatch tool usage event for specific handling",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "TOOL_USED_ON_TARGET",
        "payload": {
          "user": "actor.id",
          "tool": "tool.id",
          "toolName": "tool.components.core:item.name",
          "toolCategory": "tool.components.core:item.categories",
          "target": "target.id",
          "targetType": "target.components.core:actor ? 'actor' : (target.components.core:object ? 'object' : 'feature')",
          "location": "actor.components.core:position.locationId",
          "timestamp": "game.timestamp"
        }
      }
    }
  ],
  "command": "use {tool.components.core:item.name} on {target.components.core:actor.name || target.components.core:object.name || target.components.core:feature.name}",
  "result": "You use {tool.components.core:item.name} on {target.components.core:actor.name || target.components.core:object.name || target.components.core:feature.name}."
}
```

### Step 4: Implement Context-Dependent Unlock Action

Create file: `data/mods/core/actions/unlock_with_key.action.json`

```json
{
  "id": "core:unlock_with_key",
  "name": "unlock {container} with {key}",
  "description": "Use a specific key to unlock a locked container",
  "category": "interaction",
  "targetDefinitions": {
    "container": {
      "name": "container",
      "description": "Locked container to unlock",
      "scope": "location.core:objects[]",
      "required": true,
      "maxCombinations": 5,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:container": {
                "type": "object",
                "properties": {
                  "locked": { "type": "boolean", "const": true },
                  "lock_type": { "type": "string" }
                },
                "required": ["locked", "lock_type"]
              }
            },
            "required": ["core:container"]
          }
        }
      }
    },
    "key": {
      "name": "key",
      "description": "Key that can unlock this specific container",
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "required": true,
      "maxCombinations": 3,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:key": {
                "type": "object",
                "properties": {
                  "types": {
                    "type": "array",
                    "contains": {
                      "const": { "var": "target.components.core:container.lock_type" }
                    }
                  },
                  "durability": { "type": "number", "minimum": 1 }
                },
                "required": ["types"]
              }
            },
            "required": ["core:key"]
          }
        }
      }
    }
  },
  "maxCombinations": 15,
  "conditions": [
    {
      "description": "Actor must be conscious and able to unlock",
      "condition": {
        "and": [
          { "var": "actor.components.core:actor.conscious" },
          { "var": "actor.components.core:actor.alive" }
        ]
      }
    },
    {
      "description": "Key must match container lock type",
      "condition": {
        "in": [
          { "var": "container.components.core:container.lock_type" },
          { "var": "key.components.core:key.types" }
        ]
      }
    },
    {
      "description": "Actor must be close to container",
      "condition": {
        "<=": [{ "var": "distance_to_container" }, 1]
      }
    },
    {
      "description": "Container must not be magically protected",
      "condition": {
        "or": [
          { "==": [{ "var": "container.components.core:container.magical_protection" }, false] },
          { "==": [{ "var": "container.components.core:container.magical_protection" }, null] }
        ]
      }
    }
  ],
  "effects": [
    {
      "description": "Unlock the container",
      "operation": {
        "type": "modifyComponent",
        "entityId": "container.id",
        "componentId": "core:container",
        "modifications": {
          "locked": false,
          "last_unlocked_by": "actor.id",
          "unlock_timestamp": "game.timestamp"
        }
      }
    },
    {
      "description": "Wear down the key slightly",
      "operation": {
        "type": "modifyComponent",
        "entityId": "key.id",
        "componentId": "core:key",
        "modifications": {
          "durability": {
            "operation": "subtract",
            "value": 1
          }
        }
      }
    },
    {
      "description": "Dispatch unlock event for rule processing",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "CONTAINER_UNLOCKED_WITH_KEY",
        "payload": {
          "unlocker": "actor.id",
          "container": "container.id",
          "containerName": "container.components.core:object.name",
          "key": "key.id",
          "keyName": "key.components.core:item.name",
          "lockType": "container.components.core:container.lock_type",
          "location": "container.components.core:position.locationId",
          "timestamp": "game.timestamp"
        }
      }
    }
  ],
  "command": "unlock {container.components.core:object.name} with {key.components.core:item.name}",
  "result": "You successfully unlock {container.components.core:object.name} with {key.components.core:item.name}. The lock clicks open."
}
```

### Step 5: Create Integration Tests

Create file: `tests/integration/coreActions/enhancedCoreActions.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Enhanced Core Actions Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Give Item Enhanced Action', () => {
    it('should process give item with explicit selection', async () => {
      // Create test entities
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: ['potion_001'] }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Friendly NPC', conscious: true, alive: true, faction: 'friendly' },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: [] },
        'social:relationships': { relationships: [] }
      });

      const potion = testBed.createEntity('potion_001', {
        'core:item': { name: 'Health Potion', tradeable: true, value: 10, weight: 1 }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Test Room' },
        'core:actors': ['player', 'npc_001']
      });

      // Load enhanced give action
      testBed.loadAction('data/mods/core/actions/give_item_enhanced.action.json');

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room_001', components: room.getAllComponents() },
        game: { turnNumber: 1, timestamp: Date.now() }
      };

      // Process action
      const result = await testBed.processAction('core:give_item_enhanced', 'player', context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      
      const action = result.value.actions[0];
      expect(action.command).toContain('give Health Potion to Friendly NPC');
      expect(action.effects).toHaveLength(4); // Remove item, add item, update relationship, dispatch event

      // Verify item transfer
      const updatedPlayer = testBed.getEntity('player');
      const updatedNpc = testBed.getEntity('npc_001');
      
      expect(updatedPlayer.getComponent('core:inventory').items).not.toContain('potion_001');
      expect(updatedNpc.getComponent('core:inventory').items).toContain('potion_001');
    });

    it('should only show tradeable items', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: ['tradeable_item', 'bound_item'] }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'NPC', conscious: true, alive: true, faction: 'friendly' },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: [] }
      });

      const tradeableItem = testBed.createEntity('tradeable_item', {
        'core:item': { name: 'Tradeable Item', tradeable: true }
      });

      const boundItem = testBed.createEntity('bound_item', {
        'core:item': { name: 'Bound Item', tradeable: false }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Test Room' },
        'core:actors': ['player', 'npc_001']
      });

      testBed.loadAction('data/mods/core/actions/give_item_enhanced.action.json');

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room_001', components: room.getAllComponents() },
        game: { turnNumber: 1 }
      };

      const result = await testBed.processAction('core:give_item_enhanced', 'player', context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1); // Only one action for tradeable item
      expect(result.value.actions[0].command).toContain('Tradeable Item');
    });
  });

  describe('Use Tool On Target Action', () => {
    it('should use medical tool on injured character', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: ['bandage_001'] }
      });

      const injuredNpc = testBed.createEntity('injured_npc', {
        'core:actor': { name: 'Injured NPC', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:health': { current: 25, maximum: 100 }
      });

      const bandage = testBed.createEntity('bandage_001', {
        'core:item': { 
          name: 'Medical Bandage', 
          usable: true, 
          durability: 3,
          categories: ['medical']
        }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Medical Room' },
        'core:actors': ['player', 'injured_npc']
      });

      testBed.loadAction('data/mods/core/actions/use_tool_on_target.action.json');

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room_001', components: room.getAllComponents() },
        game: { turnNumber: 1, timestamp: Date.now() }
      };

      const result = await testBed.processAction('core:use_tool_on_target', 'player', context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      
      const action = result.value.actions[0];
      expect(action.command).toContain('use Medical Bandage on Injured NPC');

      // Verify tool durability reduced
      const updatedBandage = testBed.getEntity('bandage_001');
      expect(updatedBandage.getComponent('core:item').durability).toBe(2);
    });

    it('should reject incompatible tool-target combinations', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: ['sword_001'] }
      });

      const container = testBed.createEntity('container_001', {
        'core:object': { name: 'Wooden Chest' },
        'core:position': { locationId: 'room_001' },
        'core:container': { locked: true }
      });

      const sword = testBed.createEntity('sword_001', {
        'core:item': { 
          name: 'Iron Sword', 
          usable: true, 
          durability: 50,
          categories: ['weapon']
        }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Storage Room' },
        'core:actors': ['player'],
        'core:objects': ['container_001']
      });

      testBed.loadAction('data/mods/core/actions/use_tool_on_target.action.json');

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room_001', components: room.getAllComponents() },
        game: { turnNumber: 1 }
      };

      const result = await testBed.processAction('core:use_tool_on_target', 'player', context);

      // Should not find valid combinations (sword not compatible with locked container)
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
    });
  });

  describe('Unlock With Key Action', () => {
    it('should unlock container with matching key', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: ['brass_key'] }
      });

      const chest = testBed.createEntity('locked_chest', {
        'core:object': { name: 'Treasure Chest' },
        'core:position': { locationId: 'room_001' },
        'core:container': { 
          locked: true, 
          lock_type: 'brass',
          magical_protection: false,
          contents: []
        }
      });

      const key = testBed.createEntity('brass_key', {
        'core:item': { name: 'Brass Key' },
        'core:key': { types: ['brass'], durability: 10 }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Treasure Room' },
        'core:actors': ['player'],
        'core:objects': ['locked_chest']
      });

      testBed.loadAction('data/mods/core/actions/unlock_with_key.action.json');

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room_001', components: room.getAllComponents() },
        game: { turnNumber: 1, timestamp: Date.now() }
      };

      const result = await testBed.processAction('core:unlock_with_key', 'player', context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      
      const action = result.value.actions[0];
      expect(action.command).toContain('unlock Treasure Chest with Brass Key');

      // Verify container unlocked
      const updatedChest = testBed.getEntity('locked_chest');
      expect(updatedChest.getComponent('core:container').locked).toBe(false);

      // Verify key durability reduced
      const updatedKey = testBed.getEntity('brass_key');
      expect(updatedKey.getComponent('core:key').durability).toBe(9);
    });

    it('should not find keys that do not match lock type', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items: ['silver_key'] }
      });

      const chest = testBed.createEntity('locked_chest', {
        'core:object': { name: 'Treasure Chest' },
        'core:position': { locationId: 'room_001' },
        'core:container': { 
          locked: true, 
          lock_type: 'brass', // Requires brass key
          magical_protection: false
        }
      });

      const wrongKey = testBed.createEntity('silver_key', {
        'core:item': { name: 'Silver Key' },
        'core:key': { types: ['silver'], durability: 10 } // Wrong type
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Treasure Room' },
        'core:actors': ['player'],
        'core:objects': ['locked_chest']
      });

      testBed.loadAction('data/mods/core/actions/unlock_with_key.action.json');

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room_001', components: room.getAllComponents() },
        game: { turnNumber: 1 }
      };

      const result = await testBed.processAction('core:unlock_with_key', 'player', context);

      // Should not find valid combinations (wrong key type)
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
    });
  });

  describe('Performance Comparison', () => {
    it('should perform well with many items and targets', async () => {
      // Create many items and actors for performance testing
      const items = [];
      const actors = [];
      
      for (let i = 0; i < 20; i++) {
        const item = testBed.createEntity(`item_${i}`, {
          'core:item': { name: `Item ${i}`, tradeable: true }
        });
        items.push(item.id);
      }

      for (let i = 0; i < 10; i++) {
        const actor = testBed.createEntity(`actor_${i}`, {
          'core:actor': { name: `Actor ${i}`, conscious: true, alive: true, faction: 'friendly' },
          'core:position': { locationId: 'room_001' },
          'core:inventory': { items: [] }
        });
        actors.push(actor.id);
      }

      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player', conscious: true, alive: true },
        'core:position': { locationId: 'room_001' },
        'core:inventory': { items }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Crowded Room' },
        'core:actors': ['player', ...actors]
      });

      testBed.loadAction('data/mods/core/actions/give_item_enhanced.action.json');

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room_001', components: room.getAllComponents() },
        game: { turnNumber: 1 }
      };

      const start = performance.now();
      const result = await testBed.processAction('core:give_item_enhanced', 'player', context);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(result.value.actions.length).toBeLessThanOrEqual(25); // maxCombinations limit
      expect(duration).toBeLessThan(200); // Should be fast even with many combinations
    });
  });
});
```

### Step 6: Update Core Mod Manifest

Create file: `data/mods/core/mod-manifest.json` (updated)

```json
{
  "id": "core",
  "version": "2.1.0",
  "name": "Core Game Systems",
  "description": "Enhanced core game systems with multi-target action support",
  "author": "Living Narrative Engine Team",
  "dependencies": [],
  "actions": [
    "actions/talk_to_actor.action.json",
    "actions/examine_object.action.json", 
    "actions/move_to_location.action.json",
    "actions/give_item.action.json",
    "actions/give_item_enhanced.action.json",
    "actions/use_item.action.json",
    "actions/use_tool_on_target.action.json",
    "actions/unlock_container.action.json",
    "actions/unlock_with_key.action.json",
    "actions/attack_target.action.json"
  ],
  "components": [
    "components/actor.component.json",
    "components/inventory.component.json",
    "components/item.component.json",
    "components/key.component.json",
    "components/container.component.json",
    "components/object.component.json",
    "components/location.component.json",
    "components/position.component.json",
    "components/health.component.json"
  ],
  "rules": [
    "rules/social_interactions.rule.json",
    "rules/item_transactions.rule.json",
    "rules/container_operations.rule.json"
  ],
  "events": [
    "events/item_given.event.json",
    "events/item_given_enhanced.event.json",
    "events/tool_used_on_target.event.json",
    "events/container_unlocked_with_key.event.json"
  ],
  "entities": [
    "entities/default_player.entity.json"
  ],
  "changelog": {
    "2.1.0": [
      "Added enhanced multi-target actions",
      "Improved action validation and performance",
      "Added context-dependent unlock action",
      "Enhanced give item action with explicit selection",
      "Added use tool on target action",
      "Maintained backward compatibility with existing actions"
    ],
    "2.0.0": [
      "Initial core systems implementation"
    ]
  }
}
```

## Acceptance Criteria

1.  Three enhanced core actions implemented (give, use tool, unlock)
2.  Actions demonstrate different multi-target patterns
3.  Full backward compatibility maintained with existing actions
4.  Performance optimization applied with combination limits
5.  Comprehensive validation using JSON Schema
6.  Enhanced event payloads for rule system integration
7.  Complete integration test suite
8.  Performance benchmarks within acceptable limits
9.  Updated mod manifest with version increment
10.  Actions serve as reference examples for modders

## Documentation Requirements

### For Modders
- Working examples of multi-target action patterns
- Reference implementations showing best practices
- Performance optimization techniques demonstrated
- Context-dependent targeting examples

### For Developers
- Integration test patterns for multi-target actions
- Performance benchmarking methodologies
- Event payload design for rule compatibility
- Validation schema patterns for different action types

## Future Enhancements

1. **Additional Enhanced Actions**: More core actions converted to multi-target
2. **Action Chaining**: Support for dependent action sequences
3. **Dynamic Validation**: Runtime validation based on game state
4. **AI Integration**: Enhanced actions that work better with AI memory systems
5. **Performance Analytics**: Monitoring and optimization of action performance