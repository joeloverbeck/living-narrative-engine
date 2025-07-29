# Action Migration Guide: Legacy to Multi-Target System

## Executive Summary

This guide provides comprehensive instructions for migrating actions from the legacy single-target format to the new multi-target action system in the Living Narrative Engine. The migration enables more complex interactions while maintaining backward compatibility and improving system flexibility.

## Table of Contents

1. [Action System Overview](#action-system-overview)
2. [Legacy vs Multi-Target Comparison](#legacy-vs-multi-target-comparison)  
3. [Migration Process](#migration-process)
4. [Rule System Integration](#rule-system-integration)
5. [Event Payload Changes](#event-payload-changes)
6. [Testing and Validation](#testing-and-validation)
7. [Best Practices](#best-practices)
8. [Migration Examples](#migration-examples)

## Action System Overview

### Action Pipeline Flow

The action system follows this execution pipeline:

```
Action Definition → Discovery → Validation → Execution → Rule Processing
```

1. **Action Definition**: JSON files in `data/mods/*/actions/` define available actions
2. **Discovery**: Action Discovery Service finds valid actions for current game state
3. **Validation**: Action Validation Service checks prerequisites and target validity
4. **Execution**: Action Pipeline Orchestrator executes the validated action
5. **Rule Processing**: Rules respond to `core:attempt_action` events to modify game state

### Key Components

- **Action Definitions**: JSON schemas defining action structure and requirements
- **Scope DSL**: Query language for finding valid targets in game world
- **JSON Logic**: Condition evaluation for prerequisites and validation
- **Event System**: Communication channel between actions and rules
- **Rules**: JSON-defined operations that handle action execution effects

## Legacy vs Multi-Target Comparison

### Legacy Format (Single Target)

```json
{
  "id": "core:follow",
  "name": "Follow",
  "description": "Follow another character",
  "scope": "core:potential_leaders",
  "template": "follow {target}",
  "prerequisites": [
    {
      "logic": { "condition_ref": "core:actor-can-move" },
      "failure_message": "You cannot move without functioning legs."
    }
  ]
}
```

**Characteristics:**
- Single `scope` property defines target search
- Single `{target}` placeholder in template
- Simple target resolution to `targetId` in events

### Multi-Target Format (Multiple Named Targets)

```json
{
  "id": "examples:throw_item_at_target",
  "name": "Throw Item at Target",
  "description": "Throw an item at someone or something",
  "targets": {
    "primary": {
      "scope": "examples:throwable_items",
      "placeholder": "item",
      "description": "Item to throw"
    },
    "secondary": {
      "scope": "examples:throw_targets", 
      "placeholder": "target",
      "description": "Who or what to throw at"
    }
  },
  "generateCombinations": true,
  "template": "throw {item} at {target}",
  "prerequisites": [
    {
      "logic": {
        ">=": [{ "var": "actor.components.core:stats.dexterity" }, 15]
      },
      "failure_message": "You need better aim or need to get closer to the target."
    }
  ]
}
```

**Characteristics:**
- `targets` object with named target roles (primary, secondary, tertiary)
- Each target has its own scope, placeholder, and description
- Support for context-dependent targets (`contextFrom` property)
- Optional targets support
- Rich template system with multiple placeholders
- Enhanced event payload structure

### Key Differences Summary

| Aspect | Legacy Format | Multi-Target Format |
|--------|---------------|-------------------|
| Target Definition | Single `scope` string | `targets` object with named roles |
| Template | `{target}` placeholder | Multiple named placeholders `{item}`, `{target}` |
| Event Payload | `targetId` field | `targets` object + `targetId` for compatibility |
| Complexity | Simple actions only | Complex multi-step interactions |
| Context Dependencies | Not supported | Context-dependent target resolution |
| Optional Targets | Not supported | Optional tertiary targets |
| Combinations | Manual | Automatic with `generateCombinations` |

## Migration Process

### Step 1: Identify Migration Candidates

Actions should be migrated if they:
- Could logically involve multiple entities
- Have complex target relationships
- Need context-dependent target resolution
- Would benefit from clearer target naming

### Step 2: Convert Action Structure

#### 2.1 Replace `scope` with `targets`

**Before:**
```json
{
  "scope": "core:potential_leaders"
}
```

**After:**
```json
{
  "targets": {
    "primary": {
      "scope": "core:potential_leaders",
      "placeholder": "leader",
      "description": "Character to follow"
    }
  }
}
```

#### 2.2 Update Template Placeholders

**Before:**
```json
{
  "template": "follow {target}"
}
```

**After:**
```json
{
  "template": "follow {leader}"
}
```

#### 2.3 Add Target Descriptions

Each target should have a clear description for UI and documentation:

```json
{
  "primary": {
    "scope": "core:potential_leaders",
    "placeholder": "leader", 
    "description": "Character to follow"
  }
}
```

### Step 3: Handle Complex Scenarios

#### Context-Dependent Targets

For targets that depend on other targets:

```json
{
  "targets": {
    "primary": {
      "scope": "location.objects[{\"==\": [{\"var\": \"components.core:container.locked\"}, true]}]",
      "placeholder": "container",
      "description": "Locked container"
    },
    "secondary": {
      "scope": "actor.inventory[{\"in\": [{\"var\": \"container.components.core:container.lock_type\"}, {\"var\": \"components.core:key.types\"}]}]",
      "placeholder": "key",
      "description": "Matching key",
      "contextFrom": "primary"
    }
  }
}
```

#### Optional Targets

For actions with optional additional targets:

```json
{
  "targets": {
    "primary": {
      "scope": "actor.inventory[]",
      "placeholder": "item",
      "description": "Item to give"
    },
    "secondary": {
      "scope": "location.actors[{\"!=\": [{\"var\": \"id\"}, {\"var\": \"actor.id\"}]}]",
      "placeholder": "recipient", 
      "description": "Person to give to"
    },
    "tertiary": {
      "scope": "actor.inventory[{\"==\": [{\"var\": \"components.core:item.type\"}, \"note\"]}]",
      "placeholder": "note",
      "description": "Optional note",
      "optional": true
    }
  },
  "template": "give {item} to {recipient}{ with {note}}"
}
```

### Step 4: Update Prerequisites

Prerequisites can now reference specific targets:

```json
{
  "prerequisites": [
    {
      "logic": {
        "!=": [{ "var": "primary.id" }, { "var": "secondary.id" }]
      },
      "failure_message": "Cannot use the same item for both targets."
    }
  ]
}
```

## Rule System Integration

### Event Payload Structure Changes

#### Legacy Event Payload

```json
{
  "eventName": "core:attempt_action",
  "actorId": "player_001",
  "actionId": "core:follow", 
  "targetId": "npc_001",
  "originalInput": "follow John"
}
```

#### Multi-Target Event Payload

```json
{
  "eventName": "core:attempt_action",
  "actorId": "player_001",
  "actionId": "examples:throw_item_at_target",
  "targets": {
    "primary": "rock_001",
    "secondary": "goblin_001"
  },
  "targetId": "rock_001",
  "originalInput": "throw rock at goblin"
}
```

**Note:** The `targetId` field is maintained for backward compatibility and contains the primary target ID.

### Accessing Target Data in Rules

#### Legacy Target Access

```json
{
  "type": "SET_VARIABLE",
  "parameters": {
    "variable_name": "targetEntityId",
    "value": "{event.payload.targetId}"
  }
}
```

#### Multi-Target Access

```json
{
  "type": "SET_VARIABLE", 
  "parameters": {
    "variable_name": "primaryTargetId",
    "value": "{event.payload.targets.primary}"
  }
},
{
  "type": "SET_VARIABLE",
  "parameters": {
    "variable_name": "secondaryTargetId", 
    "value": "{event.payload.targets.secondary}"
  }
}
```

#### Backward Compatible Access

For rules that need to work with both formats:

```json
{
  "type": "SET_VARIABLE",
  "parameters": {
    "variable_name": "primaryTarget",
    "value": "{event.payload.targetId}"
  }
}
```

This works because `targetId` is set to the primary target in multi-target actions.

### Conditional Target Processing

Rules can conditionally process different targets:

```json
{
  "type": "IF",
  "parameters": {
    "condition": {
      "!=": [{ "var": "event.payload.targets.secondary" }, null]
    },
    "then_actions": [
      {
        "type": "QUERY_COMPONENT",
        "parameters": {
          "entity_ref": { "entityId": "{event.payload.targets.secondary}" },
          "component_type": "core:health",
          "result_variable": "secondaryTargetHealth"
        }
      }
    ]
  }
}
```

## Event Payload Changes

### Backward Compatibility

The system maintains backward compatibility by:

1. **Dual Format Support**: Events include both `targetId` and `targets` fields
2. **Primary Target Mapping**: `targetId` always contains the primary target ID
3. **Schema Validation**: Both legacy and multi-target formats validate correctly
4. **Rule Processing**: Existing rules continue to work unchanged

### Event Schema

The `core:attempt_action` event schema supports both formats:

```json
{
  "anyOf": [
    {
      "description": "Legacy format: requires targetId",
      "required": ["targetId"]
    },
    {
      "description": "Multi-target format: requires targets and targetId as primary",
      "required": ["targets", "targetId"],
      "properties": {
        "targets": {
          "minProperties": 1
        },
        "targetId": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  ]
}
```

## Testing and Validation

### Test Structure

Multi-target actions should be tested with:

1. **Basic Functionality Tests**: Verify all target combinations work
2. **Context Dependency Tests**: Ensure contextual targets resolve correctly
3. **Optional Target Tests**: Test with and without optional targets
4. **Validation Tests**: Verify prerequisites work with multi-target data
5. **Rule Integration Tests**: Ensure rules process targets correctly

### Example Test Pattern

```javascript
describe('Multi-Target Action Integration', () => {
  it('should process throw action with item and target', async () => {
    // Setup entities
    const thrownItem = await createTestEntity('throwable_item');
    const target = await createTestEntity('target_actor');
    
    // Mock action discovery
    const mockAction = {
      actionId: 'examples:throw_item_at_target',
      targets: {
        primary: { id: thrownItem.id },
        secondary: { id: target.id }
      }
    };
    
    // Execute action
    const result = await actionService.executeAction(mockAction);
    
    // Verify results
    expect(result.success).toBe(true);
    expect(result.targets.primary).toBe(thrownItem.id);
    expect(result.targets.secondary).toBe(target.id);
  });
});
```

### Validation Requirements

1. **Schema Compliance**: All migrated actions must pass schema validation
2. **Target Resolution**: Verify all targets can be resolved in test scenarios
3. **Template Rendering**: Ensure templates render correctly with target data
4. **Rule Processing**: Confirm rules can access all target information
5. **Error Handling**: Test graceful failure when targets are unavailable

## Best Practices

### Action Design

1. **Clear Target Roles**: Use descriptive names (primary, secondary, not target1, target2)
2. **Logical Relationships**: Ensure target dependencies make sense
3. **Optional Targets**: Use sparingly and only when truly optional
4. **Context Dependencies**: Prefer context-dependent over independent when targets relate
5. **Template Clarity**: Write clear, readable command templates

### Performance Considerations

1. **Scope Optimization**: Use specific scopes to limit search space
2. **Combination Generation**: Use `generateCombinations` judiciously for performance
3. **Context Caching**: Context-dependent targets benefit from caching
4. **Target Validation**: Move expensive validation to prerequisites when possible

### Migration Strategy

1. **Gradual Migration**: Migrate actions incrementally, not all at once
2. **Backward Compatibility**: Maintain legacy support during transition
3. **Testing First**: Create comprehensive tests before migration
4. **Documentation**: Update action documentation with new capabilities
5. **User Communication**: Inform users of new action capabilities

## Migration Examples

### Example 1: Simple Single-Target Migration

#### Before (Legacy)
```json
{
  "id": "core:eat",
  "name": "Eat", 
  "description": "Consume an edible item",
  "scope": "core:edible_items",
  "template": "eat {target}",
  "prerequisites": [
    {
      "logic": { "condition_ref": "core:actor-can-eat" },
      "failure_message": "You cannot eat right now."
    }
  ]
}
```

#### After (Multi-Target)
```json
{
  "id": "core:eat",
  "name": "Eat",
  "description": "Consume an edible item", 
  "targets": {
    "primary": {
      "scope": "core:edible_items",
      "placeholder": "food",
      "description": "Item to consume"
    }
  },
  "template": "eat {food}",
  "prerequisites": [
    {
      "logic": { "condition_ref": "core:actor-can-eat" },
      "failure_message": "You cannot eat right now."
    }
  ]
}
```

### Example 2: Complex Multi-Target Action

#### New Multi-Target Action
```json
{
  "id": "crafting:combine_items",
  "name": "Combine Items",
  "description": "Combine two items to create something new",
  "targets": {
    "primary": {
      "scope": "actor.inventory[{\"==\": [{\"var\": \"components.core:item.combinable\"}, true]}]",
      "placeholder": "firstItem", 
      "description": "First item to combine"
    },
    "secondary": {
      "scope": "actor.inventory[{\"in\": [{\"var\": \"firstItem.components.core:item.combines_with\"}, [{\"var\": \"components.core:item.type\"}]]}]",
      "placeholder": "secondItem",
      "description": "Second item to combine with",
      "contextFrom": "primary"
    },
    "tertiary": {
      "scope": "actor.inventory[{\"==\": [{\"var\": \"components.core:item.type\"}, \"catalyst\"]}]",
      "placeholder": "catalyst",
      "description": "Optional crafting catalyst", 
      "optional": true
    }
  },
  "generateCombinations": true,
  "template": "combine {firstItem} with {secondItem}{ using {catalyst}}",
  "prerequisites": [
    {
      "logic": {
        ">=": [{ "var": "actor.components.core:stats.intelligence" }, 10]
      },
      "failure_message": "You need at least 10 intelligence to combine items."
    }
  ]
}
```

### Example 3: Rule Migration for Multi-Target

#### Before (Legacy Rule)
```json
{
  "type": "MODIFY_COMPONENT",
  "parameters": {
    "entity_ref": { "entityId": "{event.payload.targetId}" },
    "component_type": "core:health",
    "field": "current",
    "mode": "add",
    "value": 10
  }
}
```

#### After (Multi-Target Rule)
```json
{
  "type": "MODIFY_COMPONENT", 
  "parameters": {
    "entity_ref": { "entityId": "{event.payload.targets.primary}" },
    "component_type": "core:health", 
    "field": "current",
    "mode": "add", 
    "value": 10
  }
},
{
  "type": "IF",
  "parameters": {
    "condition": {
      "!=": [{ "var": "event.payload.targets.secondary" }, null]
    },
    "then_actions": [
      {
        "type": "MODIFY_COMPONENT",
        "parameters": {
          "entity_ref": { "entityId": "{event.payload.targets.secondary}" },
          "component_type": "core:health",
          "field": "current", 
          "mode": "add",
          "value": 5
        }
      }
    ]
  }
}
```

## Conclusion

The migration from legacy single-target actions to the multi-target system enables more sophisticated and realistic game interactions while maintaining full backward compatibility. By following this guide, developers can:

1. **Enhance Gameplay**: Create more complex and interesting actions
2. **Improve User Experience**: Provide clearer action descriptions and targets
3. **Maintain Compatibility**: Keep existing actions working during migration
4. **Future-Proof Systems**: Build on a more flexible and extensible foundation

The multi-target system represents a significant evolution in the Living Narrative Engine's action handling capabilities, enabling richer storytelling and more engaging player interactions.

## References

- **Action Schema**: `data/schemas/action.schema.json`
- **Event Schema**: `data/mods/core/events/attempt_action.event.json`
- **Test Examples**: `tests/e2e/actions/multiTargetFullPipeline.e2e.test.js`
- **Multi-Target Fixtures**: `tests/e2e/actions/fixtures/multiTargetActions.js`