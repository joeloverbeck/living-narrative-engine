# Multi-Target Action System Specification

## Version 1.0 - Context-Based Secondary Scope Approach

### Executive Summary

This specification defines the implementation of a multi-target action system for the Living Narrative Engine. The system extends the current single-target action framework to support actions with multiple targets (e.g., "throw {item} at {target}", "adjust {person}'s {garment}") while maintaining backward compatibility and leveraging the existing scope DSL infrastructure.

### Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Schema Definitions](#schema-definitions)
4. [Scope DSL Extensions](#scope-dsl-extensions)
5. [Pipeline Modifications](#pipeline-modifications)
6. [Event System Updates](#event-system-updates)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Migration Guide](#migration-guide)
10. [Performance Considerations](#performance-considerations)

## Overview

### Goals

1. **Enable Multi-Target Actions**: Support actions that naturally involve multiple targets
2. **Context-Aware Scopes**: Allow secondary scopes to use primary target resolution in their context
3. **Combination Generation**: Generate multiple action candidates from target combinations
4. **Backward Compatibility**: Ensure existing single-target actions continue working
5. **Modder-Friendly**: Provide clear, data-driven configuration without code changes

### Non-Goals

1. Complex dependency graphs between targets (only linear dependencies)
2. Dynamic target count (fixed number of targets per action)
3. Recursive target resolution (no target-of-target scenarios)

## Architecture

### System Overview

```
Action Definition
    ├── targets: {}          # Multi-target configuration
    │   ├── primary: {}      # First target resolution
    │   └── secondary: {}    # Context-aware resolution
    │
    ├── template: string     # Multi-placeholder template
    └── generateCombinations # Enable cartesian product

                    ↓

Action Pipeline
    ├── ComponentFilteringStage    # Unchanged
    ├── PrerequisiteEvaluationStage # Unchanged
    ├── MultiTargetResolutionStage  # NEW: Replaces TargetResolutionStage
    └── ActionFormattingStage       # Enhanced for multi-target

                    ↓

Event System
    └── core:attempt_action
        └── targets: {          # Enhanced payload
            primary: entityId,
            secondary: entityId
        }
```

### Key Components

1. **Multi-Target Schema**: Extended action definition supporting multiple target specifications
2. **Context-Aware Scopes**: Scope files that receive resolved targets in their evaluation context
3. **Resolution Pipeline**: Sequential target resolution with context propagation
4. **Combination Generator**: Creates action candidates from target permutations
5. **Enhanced Formatting**: Multi-placeholder substitution in action templates

## Schema Definitions

### Enhanced Action Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/action.schema.json",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$"
    },
    "targets": {
      "oneOf": [
        {
          "type": "string",
          "description": "Legacy single-target scope (backward compatibility)"
        },
        {
          "type": "object",
          "description": "Multi-target configuration",
          "properties": {
            "primary": {
              "$ref": "#/definitions/targetDefinition"
            },
            "secondary": {
              "$ref": "#/definitions/targetDefinition"
            }
          },
          "required": ["primary"],
          "additionalProperties": false
        }
      ]
    },
    "scope": {
      "type": "string",
      "description": "Deprecated: Use targets instead"
    },
    "template": {
      "type": "string",
      "description": "Action template with {placeholder} substitutions"
    },
    "generateCombinations": {
      "type": "boolean",
      "default": false,
      "description": "Generate all target combinations as separate actions"
    }
  },
  "definitions": {
    "targetDefinition": {
      "type": "object",
      "properties": {
        "scope": {
          "type": "string",
          "description": "Scope ID or inline scope expression"
        },
        "placeholder": {
          "type": "string",
          "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$",
          "description": "Template placeholder name"
        },
        "description": {
          "type": "string",
          "description": "Human-readable target description"
        },
        "contextFrom": {
          "type": "string",
          "enum": ["primary"],
          "description": "Use another target as context"
        },
        "optional": {
          "type": "boolean",
          "default": false,
          "description": "Whether this target is optional"
        }
      },
      "required": ["scope", "placeholder"]
    }
  }
}
```

### Target Context Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/target-context.schema.json",
  "type": "object",
  "properties": {
    "actor": {
      "type": "object",
      "description": "The acting entity"
    },
    "target": {
      "type": "object",
      "description": "Primary target when contextFrom is used"
    },
    "targets": {
      "type": "object",
      "description": "All resolved targets keyed by name",
      "additionalProperties": {
        "type": "object"
      }
    }
  }
}
```

## Scope DSL Extensions

### Context-Aware Scope Files

Scope files can now receive resolved targets in their evaluation context:

```
# File: clothing/scopes/target_clothing.scope
# Receives 'target' from primary resolution via contextFrom

# Get all clothing items on the target
target_clothing := target.topmost_clothing[]

# Get specific clothing categories
target_torso_upper := target.topmost_clothing.torso_upper
target_torso_lower := target.topmost_clothing.torso_lower

# Filter by properties
target_adjustable := target.topmost_clothing[][{
  "in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]
}]
```

### Context Variables

The scope evaluation context includes:
- `actor`: The entity performing the action
- `target`: Primary target (when contextFrom="primary")
- `targets`: Object containing all resolved targets
- `location`: Current location context
- `game`: Game state context

## Pipeline Modifications

### MultiTargetResolutionStage

```javascript
class MultiTargetResolutionStage extends PipelineStage {
  constructor({ 
    scopeInterpreter, 
    entityManager, 
    targetResolver,
    logger 
  }) {
    super({ logger });
    this.#scopeInterpreter = scopeInterpreter;
    this.#entityManager = entityManager;
    this.#targetResolver = targetResolver;
  }

  async executeInternal(context) {
    const { actionDef, actor, actionContext } = context;
    
    // Handle legacy single-target actions
    if (typeof actionDef.targets === 'string' || actionDef.scope) {
      return this.#resolveLegacyTarget(actionDef, actor, actionContext);
    }
    
    // Resolve multi-target actions
    const resolvedTargets = {};
    const resolutionOrder = this.#getResolutionOrder(actionDef.targets);
    
    for (const targetKey of resolutionOrder) {
      const targetDef = actionDef.targets[targetKey];
      const scopeContext = this.#buildScopeContext(
        actor,
        actionContext,
        resolvedTargets,
        targetDef
      );
      
      const candidates = await this.#resolveScope(
        targetDef.scope,
        scopeContext
      );
      
      if (!targetDef.optional && candidates.length === 0) {
        return null; // Action not available
      }
      
      resolvedTargets[targetKey] = candidates;
    }
    
    return {
      ...context,
      resolvedTargets
    };
  }
  
  #buildScopeContext(actor, actionContext, resolvedTargets, targetDef) {
    const context = {
      actor,
      location: actionContext.location,
      game: actionContext.game
    };
    
    // Add primary target to context if requested
    if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
      context.target = resolvedTargets[targetDef.contextFrom][0];
    }
    
    // Add all resolved targets
    context.targets = resolvedTargets;
    
    return context;
  }
  
  #getResolutionOrder(targets) {
    // Ensure targets with contextFrom are resolved after their dependencies
    const order = [];
    const pending = Object.keys(targets);
    
    while (pending.length > 0) {
      const next = pending.find(key => 
        !targets[key].contextFrom || 
        order.includes(targets[key].contextFrom)
      );
      
      if (!next) {
        throw new Error('Circular dependency in target resolution');
      }
      
      order.push(next);
      pending.splice(pending.indexOf(next), 1);
    }
    
    return order;
  }
}
```

### Enhanced ActionFormattingStage

```javascript
class ActionFormattingStage extends PipelineStage {
  async executeInternal(context) {
    const { actionDef, resolvedTargets } = context;
    
    if (actionDef.generateCombinations) {
      return this.#generateCombinations(context);
    }
    
    return this.#formatSingleAction(context);
  }
  
  #generateCombinations(context) {
    const { actionDef, resolvedTargets, actor } = context;
    const combinations = [];
    
    // Get all target keys that have candidates
    const targetKeys = Object.keys(resolvedTargets).filter(
      key => resolvedTargets[key].length > 0
    );
    
    // Generate cartesian product of all targets
    const indices = new Array(targetKeys.length).fill(0);
    
    while (true) {
      // Create combination for current indices
      const targetMap = {};
      targetKeys.forEach((key, i) => {
        targetMap[key] = resolvedTargets[key][indices[i]];
      });
      
      combinations.push({
        actionId: actionDef.id,
        actorId: actor.id,
        targets: targetMap,
        formattedText: this.#formatTemplate(
          actionDef.template,
          targetMap,
          actionDef.targets
        )
      });
      
      // Increment indices
      let carry = 1;
      for (let i = targetKeys.length - 1; i >= 0 && carry; i--) {
        indices[i] += carry;
        if (indices[i] >= resolvedTargets[targetKeys[i]].length) {
          indices[i] = 0;
        } else {
          carry = 0;
        }
      }
      
      if (carry) break; // All combinations generated
    }
    
    return combinations;
  }
  
  #formatTemplate(template, targetMap, targetDefs) {
    let formatted = template;
    
    for (const [key, target] of Object.entries(targetMap)) {
      const placeholder = targetDefs[key].placeholder;
      const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
      const displayName = this.#getTargetDisplayName(target);
      formatted = formatted.replace(regex, displayName);
    }
    
    return formatted;
  }
}
```

## Event System Updates

### Enhanced Event Payload

```javascript
// core:attempt_action event payload
{
  eventName: "core:attempt_action",
  actorId: "entity_123",
  actionId: "combat:throw",
  
  // New multi-target structure
  targets: {
    primary: "knife_456",
    secondary: "goblin_789"
  },
  
  // Backward compatibility
  targetId: "knife_456", // Primary target for legacy rules
  
  // Additional context
  originalInput: "throw knife at goblin",
  timestamp: Date.now()
}
```

### Rule Access Pattern

```javascript
// In rules, access multi-targets
const primaryTarget = event.payload.targets?.primary || event.payload.targetId;
const secondaryTarget = event.payload.targets?.secondary;

// Operations can use target context
{
  "type": "modifyComponent",
  "config": {
    "entityId": {"var": "event.payload.targets.secondary"},
    "componentId": "core:health",
    "changes": {
      "current": {"math": ["-", {"var": "current"}, 10]}
    }
  }
}
```

## Implementation Phases

### Phase 1: Schema and Validation (Week 1)
- [ ] Update action.schema.json with multi-target support
- [ ] Create target-context.schema.json
- [ ] Add validation tests for new schemas
- [ ] Update schema documentation

### Phase 2: Core Pipeline (Week 2-3)
- [ ] Implement MultiTargetResolutionStage
- [ ] Update ActionFormattingStage for combinations
- [ ] Modify pipeline orchestrator to use new stage
- [ ] Add comprehensive unit tests

### Phase 3: Scope DSL Context (Week 3-4)
- [ ] Extend scope interpreter context handling
- [ ] Create context-aware scope examples
- [ ] Test dependent scope resolution
- [ ] Document scope context variables

### Phase 4: Integration (Week 4-5)
- [ ] Update commandProcessor for multi-target payloads
- [ ] Ensure backward compatibility
- [ ] Create example multi-target actions
- [ ] Integration testing

### Phase 5: Documentation and Migration (Week 5-6)
- [ ] Create modder documentation
- [ ] Write migration guide
- [ ] Update existing actions (optional)
- [ ] Performance optimization

## Testing Strategy

### Unit Tests

1. **Schema Validation**
   - Valid multi-target definitions
   - Invalid configurations
   - Backward compatibility

2. **Resolution Pipeline**
   - Independent target resolution
   - Context-dependent resolution
   - Circular dependency detection
   - Optional target handling

3. **Combination Generation**
   - Cartesian product correctness
   - Performance with large sets
   - Empty set handling

### Integration Tests

1. **End-to-End Actions**
   - Throw action with items and targets
   - Clothing adjustment with context
   - Legacy action compatibility

2. **Rule Processing**
   - Multi-target event handling
   - Backward compatible payloads
   - Target validation in rules

### Performance Tests

1. **Resolution Performance**
   - Large scope results
   - Multiple target dependencies
   - Caching effectiveness

2. **Combination Scaling**
   - Actions with many combinations
   - Memory usage monitoring
   - Response time targets

## Migration Guide

### For Modders

#### Converting Single-Target Actions

Before:
```json
{
  "id": "my_mod:simple_action",
  "scope": "my_mod:valid_targets",
  "template": "interact with {target}"
}
```

After (backward compatible):
```json
{
  "id": "my_mod:simple_action",
  "targets": "my_mod:valid_targets",
  "template": "interact with {target}"
}
```

#### Creating Multi-Target Actions

```json
{
  "id": "my_mod:complex_action",
  "targets": {
    "primary": {
      "scope": "my_mod:items_in_inventory",
      "placeholder": "item",
      "description": "The item to use"
    },
    "secondary": {
      "scope": "my_mod:valid_targets",
      "placeholder": "target",
      "description": "The target to use item on",
      "contextFrom": "primary"
    }
  },
  "template": "use {item} on {target}",
  "generateCombinations": true
}
```

### For Engine Developers

1. Update pipeline configuration to use MultiTargetResolutionStage
2. Ensure event handlers check for multi-target payloads
3. Update any custom formatters for multi-placeholder support

## Performance Considerations

### Optimization Strategies

1. **Scope Result Caching**
   - Cache scope results within action resolution
   - Invalidate on entity state changes
   - Share cache between similar scopes

2. **Combination Limits**
   - Set maximum combinations per action (default: 100)
   - Implement pagination for large result sets
   - Provide filtering in UI

3. **Lazy Resolution**
   - Only resolve secondary targets when needed
   - Stream combinations instead of generating all upfront
   - Use async iteration for large sets

### Performance Targets

- Single-target actions: No performance regression
- Multi-target resolution: <50ms for typical cases
- Combination generation: <100ms for up to 100 combinations
- Memory overhead: <1MB for typical game session

## Appendix A: Example Implementations

### Throw Action

```json
{
  "id": "combat:throw",
  "name": "Throw Item",
  "targets": {
    "primary": {
      "scope": "combat:throwable_items_in_inventory",
      "placeholder": "item",
      "description": "Item to throw"
    },
    "secondary": {
      "scope": "combat:valid_throw_targets",
      "placeholder": "target",
      "description": "Target to hit"
    }
  },
  "template": "throw {item} at {target}",
  "generateCombinations": true,
  "prerequisites": [
    {
      "condition": "actor_has_free_hand"
    }
  ]
}
```

### Clothing Adjustment

```json
{
  "id": "intimacy:adjust_clothing",
  "name": "Adjust Clothing",
  "targets": {
    "primary": {
      "scope": "intimacy:nearby_actors",
      "placeholder": "person",
      "description": "Person whose clothing to adjust"
    },
    "secondary": {
      "scope": "clothing:target_adjustable_garments",
      "placeholder": "garment",
      "description": "Specific garment to adjust",
      "contextFrom": "primary"
    }
  },
  "template": "adjust {person}'s {garment}",
  "generateCombinations": false
}
```

## Appendix B: Scope Context Reference

Available variables in scope evaluation context:

```javascript
{
  // Always available
  actor: Entity,          // The acting entity
  location: Entity,       // Current location
  game: GameState,        // Game state object
  
  // When contextFrom is used
  target: Entity,         // Primary target entity
  
  // When multiple targets resolved
  targets: {
    primary: Entity[],    // All primary candidates
    secondary: Entity[]   // All secondary candidates
  }
}
```