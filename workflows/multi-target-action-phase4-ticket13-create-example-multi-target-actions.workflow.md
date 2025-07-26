# Ticket: Create Example Multi-Target Actions

## Ticket ID: PHASE4-TICKET13
## Priority: Medium
## Estimated Time: 6-8 hours
## Dependencies: PHASE4-TICKET12
## Blocks: PHASE4-TICKET14, PHASE5-TICKET15

## Overview

Create comprehensive example multi-target actions that demonstrate the full capabilities of the multi-target action system. These examples serve as working demonstrations, test cases, and templates for modders who want to create their own multi-target actions.

## Goals

1. **Complete Examples**: Working multi-target actions covering common use cases
2. **Progressive Complexity**: Simple to advanced multi-target patterns
3. **Best Practices**: Demonstrate optimal multi-target action design
4. **Test Coverage**: Examples that validate system functionality
5. **Documentation Value**: Clear, well-documented examples for modders

## Example Categories

1. **Basic Multi-Target**: Simple actions with multiple independent targets
2. **Context-Dependent**: Actions where target resolution depends on other targets
3. **Complex Interactions**: Advanced scenarios with multiple target types
4. **Error Handling**: Robust actions with comprehensive validation
5. **Performance Optimized**: Efficient actions for high-frequency use

## Implementation Steps

### Step 1: Basic Multi-Target Actions

Create file: `data/mods/examples/actions/basic_multi_target.action.json`

```json
{
  "id": "examples:throw_item_at_target",
  "name": "throw {item} at {target}",
  "description": "Throw an item at someone or something",
  "category": "interaction",
  "targetDefinitions": {
    "item": {
      "name": "item",
      "description": "Item to throw",
      "scope": "actor.core:inventory.items[]",
      "required": true,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "throwable": { "type": "boolean", "const": true }
                },
                "required": ["throwable"]
              }
            },
            "required": ["core:item"]
          }
        }
      }
    },
    "target": {
      "name": "target",
      "description": "Who or what to throw at",
      "scope": "location.core:actors[] | location.core:objects[]",
      "required": true,
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
  "conditions": [
    {
      "description": "Actor must have good aim or be close to target",
      "condition": {
        "or": [
          { ">=": [{ "var": "actor.components.core:stats.dexterity" }, 15] },
          { "<=": [{ "var": "distance_to_target" }, 2] }
        ]
      }
    },
    {
      "description": "Target must be reachable",
      "condition": {
        "and": [
          { "!=": [{ "var": "target.components.core:position.locationId" }, null] },
          { "==": [
            { "var": "target.components.core:position.locationId" },
            { "var": "actor.components.core:position.locationId" }
          ]}
        ]
      }
    }
  ],
  "effects": [
    {
      "description": "Remove item from actor inventory",
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
      "description": "Add item to target location",
      "operation": {
        "type": "modifyComponent",
        "entityId": "target.components.core:position.locationId",
        "componentId": "core:contents",
        "modifications": {
          "items": {
            "operation": "add",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Dispatch impact event",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_THROWN_AT_TARGET",
        "payload": {
          "actorId": "actor.id",
          "itemId": "item.id",
          "targetId": "target.id",
          "location": "target.components.core:position.locationId",
          "force": "actor.components.core:stats.strength"
        }
      }
    }
  ],
  "command": "throw {item.components.core:item.name} at {target.components.core:actor.name || target.components.core:object.name}",
  "result": "You throw {item.components.core:item.name} at {target.components.core:actor.name || target.components.core:object.name}."
}
```

### Step 2: Context-Dependent Multi-Target Actions

Create file: `data/mods/examples/actions/context_dependent.action.json`

```json
{
  "id": "examples:unlock_container_with_key",
  "name": "unlock {container} with {key}",
  "description": "Use a key to unlock a container",
  "category": "interaction",
  "targetDefinitions": {
    "container": {
      "name": "container",
      "description": "Container to unlock",
      "scope": "location.core:objects[]",
      "required": true,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:container": {
                "type": "object",
                "properties": {
                  "locked": { "type": "boolean", "const": true }
                },
                "required": ["locked"]
              }
            },
            "required": ["core:container"]
          }
        }
      }
    },
    "key": {
      "name": "key",
      "description": "Key that can unlock the container",
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "required": true,
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
                  }
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
  "conditions": [
    {
      "description": "Key must match container lock",
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
          "locked": false
        }
      }
    },
    {
      "description": "Wear down the key slightly",
      "operation": {
        "type": "modifyComponent",
        "entityId": "key.id",
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
      "description": "Dispatch unlock event",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "CONTAINER_UNLOCKED",
        "payload": {
          "actorId": "actor.id",
          "containerId": "container.id",
          "keyId": "key.id",
          "location": "container.components.core:position.locationId"
        }
      }
    }
  ],
  "command": "unlock {container.components.core:object.name} with {key.components.core:item.name}",
  "result": "You successfully unlock {container.components.core:object.name} with {key.components.core:item.name}."
}
```

### Step 3: Integration Tests

Create file: `tests/integration/actions/multiTargetActions.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Multi-Target Action Examples', () => {
  let testBed;
  let actionCandidateProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionCandidateProcessor = testBed.getService('actionCandidateProcessor');

    // Load example action definitions
    testBed.loadAction('data/mods/examples/actions/basic_multi_target.action.json');
    testBed.loadAction('data/mods/examples/actions/context_dependent.action.json');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Basic Multi-Target Actions', () => {
    it('should process throw item at target action', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' },
        'core:position': { locationId: 'room_001' },
        'core:stats': { dexterity: 20 },
        'core:inventory': { items: ['rock_001'] }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Guard', conscious: true },
        'core:position': { locationId: 'room_001' }
      });

      const rock = testBed.createEntity('rock_001', {
        'core:item': { name: 'Small Rock', throwable: true }
      });

      const room = testBed.createEntity('room_001', {
        'core:location': { name: 'Training Room' },
        'core:actors': ['player', 'npc_001'],
        'core:contents': { items: [] }
      });

      const result = await actionCandidateProcessor.process(
        'examples:throw_item_at_target',
        'player',
        {
          actor: { id: 'player' },
          location: { id: 'room_001' },
          game: { turnNumber: 1 }
        }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0].command).toContain('throw Small Rock at Guard');
    });
  });
});
```

### Step 4: Create Documentation

Create file: `docs/examples/multi-target-actions.md`

```markdown
# Multi-Target Action Examples

This document provides comprehensive examples of multi-target actions that demonstrate the full capabilities of the multi-target action system.

## Overview

Multi-target actions allow a single action to work with multiple entities simultaneously, enabling complex interactions that would be difficult or impossible to achieve with single-target actions.

### Key Features

- **Multiple Target Types**: Actions can define multiple different types of targets
- **Context-Dependent Resolution**: Later targets can use data from earlier targets
- **Validation**: Each target can have complex validation rules
- **Performance Optimization**: Built-in limits prevent excessive combination generation

## Action Categories

### 1. Basic Multi-Target Actions

Simple actions that work with multiple independent targets.

#### Throw Item at Target
```json
{
  "id": "examples:throw_item_at_target",
  "name": "throw {item} at {target}",
  "targetDefinitions": {
    "item": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "throwable": true }
    },
    "target": {
      "scope": "location.core:actors[] | location.core:objects[]"
    }
  }
}
```

**Use Case**: Combat, interaction, puzzle-solving

### 2. Context-Dependent Actions

Actions where target resolution depends on previously resolved targets.

#### Unlock Container with Key
```json
{
  "id": "examples:unlock_container_with_key",
  "name": "unlock {container} with {key}",
  "targetDefinitions": {
    "container": {
      "scope": "location.core:objects[]",
      "validation": { "locked": true }
    },
    "key": {
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "validation": {
        "key_types_match_container_lock": true
      }
    }
  }
}
```

**Use Case**: Puzzle-solving, exploration, security systems

## Best Practices

### 1. Target Definition Design

**Clear Naming**: Use descriptive names that clearly indicate the target's role
**Appropriate Scopes**: Use scopes that make logical sense for the target type
**Meaningful Validation**: Include validation that ensures action feasibility

### 2. Context Usage

**Logical Dependencies**: Only use context when there's a logical relationship
**Performance Awareness**: Be mindful of context complexity

### 3. Performance Optimization

**Combination Limits**: Use maxCombinations for multiple targets
**Early Filtering**: Put the most restrictive validation first
**Scope Optimization**: Use specific scopes rather than broad ones
```

## Acceptance Criteria

1. ✅ Basic multi-target actions demonstrate simple multi-target patterns
2. ✅ Context-dependent actions show target interdependencies
3. ✅ Complex actions illustrate advanced multi-target scenarios
4. ✅ Performance-optimized actions handle large datasets efficiently
5. ✅ Error-safe actions handle missing/invalid data gracefully
6. ✅ All examples have comprehensive integration tests
7. ✅ Performance benchmarks validate efficiency claims
8. ✅ Documentation provides clear usage guidance
9. ✅ Examples serve as templates for modders
10. ✅ Actions demonstrate real-world gameplay scenarios

## Documentation Requirements

### For Modders
- Complete action templates with explanations
- Best practices for multi-target action design
- Common patterns and their use cases
- Troubleshooting guide for common issues

### For Developers
- Performance benchmarking results
- Integration testing strategies
- Extension patterns for new target types
- Optimization techniques and limits

## Future Enhancements

1. **Interactive Examples**: Web-based examples that can be run and modified
2. **Action Builder**: GUI tool for creating multi-target actions visually
3. **AI Validation**: AI-powered validation of action logic and performance
4. **Dynamic Actions**: Runtime generation of actions based on game state
5. **Advanced Context**: More sophisticated context variable systems