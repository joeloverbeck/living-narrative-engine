# Ticket: Extend Scope Interpreter Context Handling

## Ticket ID: PHASE3-TICKET8

## Priority: High

## Estimated Time: 6-8 hours

## Dependencies: PHASE1-TICKET2, PHASE2-TICKET4

## Blocks: PHASE3-TICKET9, PHASE3-TICKET10

## Overview

Extend the scope interpreter to properly handle the new target context structure, allowing scope expressions to access previously resolved targets through the `target` and `targets` context variables. This enables dependent target resolution where secondary targets can use primary target data.

## Key Changes

1. **Context Variable Registration**: Add `target` and `targets` to scope context
2. **Variable Resolution**: Update variable resolver to handle new context structure
3. **Type Safety**: Ensure proper entity structure in context
4. **Performance**: Optimize context access for repeated evaluations
5. **Backward Compatibility**: Maintain existing context behavior

## Current State Analysis

The scope interpreter currently supports:

- `actor` - The entity performing the action
- `location` - Current location entity
- `game` - Game state object

We need to add:

- `target` - Primary target entity (when contextFrom is used)
- `targets` - All resolved targets keyed by definition name

## Implementation Steps

### Step 1: Update Scope Interpreter Variable Resolution

Update file: `src/scopeDsl/scopeInterpreter.js`

Look for the variable resolution logic and enhance it:

```javascript
/**
 * Enhanced variable resolution for multi-target context
 * @private
 */
#resolveContextVariable(varPath, context) {
  const parts = varPath.split('.');
  let current = context;

  for (const part of parts) {
    if (current == null) {
      return undefined;
    }

    // Handle array access for targets
    if (part === 'targets' && current.targets) {
      // Special handling for targets object
      current = current.targets;
    } else if (part === 'target' && current.target) {
      // Direct target access
      current = current.target;
    } else if (typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Enhance the evaluateStep method to handle target context
 */
async evaluateStep(node, currentSet, context, trace) {
  // ... existing code ...

  // When evaluating identifiers, check for target/targets
  if (node.type === 'identifier') {
    const identifier = node.value;

    // Check if this is accessing target context
    if (identifier === 'target' && context.target) {
      return [context.target.id];
    }

    if (identifier === 'targets' && context.targets) {
      // Return all target IDs from all definitions
      const allTargetIds = [];
      for (const targetList of Object.values(context.targets)) {
        allTargetIds.push(...targetList.map(t => t.id));
      }
      return allTargetIds;
    }

    // ... existing identifier resolution ...
  }

  // ... rest of method ...
}
```

### Step 2: Update JSON Logic Context Builder

Update the context building for JSON Logic filters to include target data:

```javascript
/**
 * Build JSON Logic evaluation context with target support
 * @private
 */
#buildJsonLogicContext(entity, fullContext) {
  const jsonContext = {
    entity: this.#buildEntityContext(entity),
    actor: fullContext.actor,
    location: fullContext.location,
    game: fullContext.game
  };

  // Add target if available
  if (fullContext.target) {
    jsonContext.target = fullContext.target;
  }

  // Add targets if available
  if (fullContext.targets) {
    jsonContext.targets = fullContext.targets;
  }

  return jsonContext;
}

/**
 * Ensure entity context has proper structure
 * @private
 */
#buildEntityContext(entityOrId) {
  // Handle both entity objects and IDs
  if (typeof entityOrId === 'string') {
    const entity = this.#entityManager.getEntity(entityOrId);
    if (!entity) return null;

    return {
      id: entity.id,
      components: this.#getAllComponents(entity)
    };
  }

  // Already an entity context object
  if (entityOrId && entityOrId.id && entityOrId.components) {
    return entityOrId;
  }

  // Entity object from entity manager
  if (entityOrId && entityOrId.getComponent) {
    return {
      id: entityOrId.id,
      components: this.#getAllComponents(entityOrId)
    };
  }

  return null;
}
```

### Step 3: Create Context-Aware Resolver

Create new file: `src/scopeDsl/resolvers/contextAwareResolver.js`

```javascript
/**
 * @file Resolver that handles context-aware scope expressions
 */

import { BaseResolver } from './baseResolver.js';
import { validateDependency } from '../../utils/validationUtils.js';

/**
 * Resolves scope expressions that use target context
 */
export class ContextAwareResolver extends BaseResolver {
  /**
   * Check if this resolver can handle the expression
   */
  canResolve(expression, context) {
    // Handle expressions starting with 'target' or 'targets'
    return expression.startsWith('target.') ||
           expression.startsWith('targets.') ||
           (context.target && expression.includes('target')) ||
           (context.targets && expression.includes('targets'));
  }

  /**
   * Resolve target-based expressions
   */
  async resolve(expression, context, trace) {
    trace?.step(`Resolving context-aware expression: ${expression}`, 'ContextAwareResolver');

    // Handle target.property expressions
    if (expression.startsWith('target.')) {
      return this.#resolveTargetExpression(expression, context, trace);
    }

    // Handle targets.key expressions
    if (expression.startsWith('targets.')) {
      return this.#resolveTargetsExpression(expression, context, trace);
    }

    // Delegate to base resolver with enhanced context
    return super.resolve(expression, context, trace);
  }

  /**
   * Resolve expressions on the target entity
   * @private
   */
  #resolveTargetExpression(expression, context, trace) {
    if (!context.target) {
      trace?.warn('No target in context for target expression', 'ContextAwareResolver');
      return [];
    }

    // Remove 'target.' prefix and evaluate rest
    const subExpression = expression.substring(7);

    // Create a sub-context with target as the primary entity
    const targetContext = {
      ...context,
      entity: context.target
    };

    // Recursively resolve the sub-expression
    return this.resolve(subExpression, targetContext, trace);
  }

  /**
   * Resolve expressions on specific resolved targets
   * @private
   */
  #resolveTargetsExpression(expression, context, trace) {
    if (!context.targets) {
      trace?.warn('No targets in context for targets expression', 'ContextAwareResolver');
      return [];
    }

    // Parse targets.key.rest
    const parts = expression.split('.');
    if (parts.length < 2) {
      return [];
    }

    const targetKey = parts[1];
    const targetList = context.targets[targetKey];

    if (!targetList || !Array.isArray(targetList)) {
      trace?.warn(`No targets found for key '${targetKey}'`, 'ContextAwareResolver');
      return [];
    }

    // If just accessing the target list
    if (parts.length === 2) {
      return targetList.map(t => t.id);
    }

    // Evaluate rest of expression on each target
    const subExpression = parts.slice(2).join('.');
    const results = [];

    for (const target of targetList) {
      const targetContext = {
        ...context,
        entity: target
      };

      const subResults = await this.resolve(subExpression, targetContext, trace);
      results.push(...subResults);
    }

    return results;
  }
}
```

### Step 4: Update Scope File Examples

Create example scope files that use the new context:

Create file: `data/mods/clothing/scopes/target_clothing.scope`

```
# Scope file demonstrating context-aware target resolution
# This file receives 'target' in context when contextFrom="primary" is used

# Get all clothing items on the target
target_clothing := target.topmost_clothing[]

# Get specific clothing slots
target_torso_upper := target.topmost_clothing.torso_upper
target_torso_lower := target.topmost_clothing.torso_lower

# Get adjustable clothing items on target
target_adjustable := target.topmost_clothing[][{
  "in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]
}]

# Get clothing by layer
target_outer_clothing := target.outer_clothing[]
target_base_clothing := target.base_clothing[]
target_underwear := target.underwear[]

# Complex filtering - waterproof outer clothing
target_waterproof_outer := target.outer_clothing[][{
  "in": ["waterproof", {"var": "entity.components.clothing:garment.properties"}]
}]
```

Create file: `data/mods/combat/scopes/combat_targets.scope`

```
# Combat targeting scopes using multi-target context

# All potential targets in location excluding actor
hostile_targets := location.core:actors[][{
  "and": [
    {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]},
    {"condition_ref": "combat:is_hostile"}
  ]
}]

# Valid throw targets based on item weight (uses primary target context)
# This scope would be used as secondary target with contextFrom="primary"
valid_throw_targets := location.core:actors[][{
  "and": [
    {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]},
    {
      "<=": [
        {"var": "target.components.core:item.weight"},
        {"var": "actor.components.core:stats.strength"}
      ]
    }
  ]
}]

# Get weapons from specific target's inventory
target_weapons := targets.primary[0].core:inventory.items[][{
  "==": [{"var": "entity.components.core:item.type"}, "weapon"]
}]
```

### Step 5: Create Unit Tests

Create file: `tests/unit/scopeDsl/contextAwareEvaluation.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScopeInterpreter } from '../../../src/scopeDsl/scopeInterpreter.js';
import { ContextAwareResolver } from '../../../src/scopeDsl/resolvers/contextAwareResolver.js';

describe('Context-Aware Scope Evaluation', () => {
  let interpreter;
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: jest.fn(),
      getAllEntities: jest.fn(),
    };

    interpreter = new ScopeInterpreter({
      entityManager: mockEntityManager,
      scopeRegistry: { getScope: jest.fn() },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });
  });

  describe('Target Context Access', () => {
    it('should resolve target.property expressions', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: {
          id: 'npc_001',
          components: {
            'core:inventory': {
              items: ['sword_001', 'potion_002'],
            },
          },
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      mockEntityManager.getEntity.mockImplementation((id) => {
        if (id === 'sword_001') return { id, components: {} };
        if (id === 'potion_002') return { id, components: {} };
        return null;
      });

      const result = await interpreter.evaluate(
        'target.core:inventory.items[]',
        context
      );

      expect(result).toEqual(['sword_001', 'potion_002']);
    });

    it('should handle missing target gracefully', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        // No target in context
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      const result = await interpreter.evaluate(
        'target.core:inventory.items[]',
        context
      );

      expect(result).toEqual([]);
    });

    it('should resolve targets.key expressions', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        targets: {
          primary: [
            {
              id: 'item_001',
              components: {
                'core:item': { type: 'weapon' },
              },
            },
            {
              id: 'item_002',
              components: {
                'core:item': { type: 'potion' },
              },
            },
          ],
          secondary: [
            {
              id: 'npc_001',
              components: {
                'core:actor': { name: 'Guard' },
              },
            },
          ],
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      // Test accessing specific target list
      const primaryResult = await interpreter.evaluate(
        'targets.primary',
        context
      );
      expect(primaryResult).toEqual(['item_001', 'item_002']);

      // Test accessing property on targets
      const secondaryNames = await interpreter.evaluate(
        'targets.secondary.core:actor.name',
        context
      );
      expect(secondaryNames).toEqual(['Guard']);
    });
  });

  describe('JSON Logic with Target Context', () => {
    it('should access target in JSON Logic filters', async () => {
      const context = {
        actor: {
          id: 'player',
          components: {
            'core:stats': { strength: 10 },
          },
        },
        target: {
          id: 'chest',
          components: {
            'core:container': { locked: true, difficulty: 5 },
          },
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      // Create a dummy entity to filter
      mockEntityManager.getAllEntities.mockReturnValue([
        { id: 'key_001', components: { 'core:item': { type: 'key' } } },
      ]);

      const result = await interpreter.evaluate(
        'entities(core:item)[][{"and": [' +
          '  {"==": [{"var": "entity.components.core:item.type"}, "key"]},' +
          '  {">=": [{"var": "actor.components.core:stats.strength"}, {"var": "target.components.core:container.difficulty"}]}' +
          ']}]',
        context
      );

      expect(result).toEqual(['key_001']);
    });
  });

  describe('Nested Target Resolution', () => {
    it('should handle complex nested target paths', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: {
          id: 'merchant',
          components: {
            'shop:inventory': {
              forSale: [
                { itemId: 'sword_001', price: 100 },
                { itemId: 'shield_002', price: 150 },
              ],
            },
          },
        },
        location: { id: 'market', components: {} },
        game: { turnNumber: 1 },
      };

      mockEntityManager.getEntity.mockImplementation((id) => {
        if (id === 'sword_001') {
          return {
            id,
            components: {
              'core:item': { name: 'Iron Sword', type: 'weapon' },
            },
          };
        }
        return null;
      });

      // This would need custom resolver for shop items
      // but demonstrates the concept
      const result = await interpreter.evaluate(
        'target.shop:inventory.forSale[].itemId',
        context
      );

      expect(result).toContain('sword_001');
      expect(result).toContain('shield_002');
    });
  });

  describe('Performance', () => {
    it('should cache context lookups efficiently', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: {
          id: 'npc',
          components: {
            'core:stats': { health: 100 },
          },
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };

      // Evaluate same expression multiple times
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await interpreter.evaluate('target.core:stats.health', context);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(1); // Should be very fast with caching
    });
  });
});
```

### Step 6: Integration Tests

Create file: `tests/integration/scopeDsl/multiTargetScopeIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Multi-Target Scope Integration', () => {
  let testBed;
  let scopeInterpreter;
  let actionProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    scopeInterpreter = testBed.getService('scopeInterpreter');
    actionProcessor = testBed.getService('actionCandidateProcessor');
  });

  it('should resolve clothing adjustment with target context', async () => {
    // Create entities
    const player = testBed.createEntity('player', {
      'core:position': { locationId: 'room' },
    });

    const npc = testBed.createEntity('npc_001', {
      'core:actor': { name: 'Alice' },
      'core:position': { locationId: 'room' },
      'clothing:equipment': {
        equipped: {
          torso_upper: {
            outer: 'jacket_001',
            base: 'shirt_001',
          },
          torso_lower: {
            base: 'pants_001',
          },
        },
      },
    });

    const jacket = testBed.createEntity('jacket_001', {
      'core:item': { name: 'Red Jacket' },
      'clothing:garment': {
        slot: 'torso_upper',
        layer: 'outer',
        properties: ['adjustable', 'removable'],
      },
    });

    const shirt = testBed.createEntity('shirt_001', {
      'core:item': { name: 'White Shirt' },
      'clothing:garment': {
        slot: 'torso_upper',
        layer: 'base',
      },
    });

    // Create action that uses target context
    const adjustAction = {
      id: 'test:adjust',
      name: 'Adjust',
      description: 'Adjust clothing',
      targets: {
        primary: {
          scope: 'test:nearby_people',
          placeholder: 'person',
        },
        secondary: {
          scope: 'test:adjustable_clothing',
          placeholder: 'garment',
          contextFrom: 'primary',
        },
      },
      template: "adjust {person}'s {garment}",
    };

    // Register test scopes
    testBed.registerScope('test:nearby_people', 'location.core:actors[]');
    testBed.registerScope(
      'test:adjustable_clothing',
      'target.topmost_clothing[][{"in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]}]'
    );

    // Build context with target
    const context = {
      actor: { id: 'player', components: player.getAllComponents() },
      target: { id: 'npc_001', components: npc.getAllComponents() },
      location: { id: 'room', components: {} },
      game: { turnNumber: 1 },
    };

    // Test scope evaluation
    const result = await scopeInterpreter.evaluate(
      'target.topmost_clothing[]',
      context
    );

    expect(result).toContain('jacket_001');
    // Should only get topmost items
    expect(result).not.toContain('shirt_001');
  });

  it('should handle multi-level target dependencies', async () => {
    // Create a three-target action scenario
    const action = {
      id: 'test:complex',
      name: 'Complex Action',
      description: 'Action with three targets',
      targets: {
        primary: {
          scope: 'actor.core:inventory.items[]',
          placeholder: 'tool',
        },
        secondary: {
          scope: 'location.core:containers[]',
          placeholder: 'container',
          contextFrom: 'primary',
        },
        tertiary: {
          scope: 'targets.secondary[0].core:contents.items[]',
          placeholder: 'content',
        },
      },
      template: 'use {tool} on {container} to get {content}',
    };

    // Setup would be complex but demonstrates the capability
  });
});
```

## Testing Strategy

### Unit Tests

1. Basic target/targets access
2. Nested property resolution
3. JSON Logic filter integration
4. Missing context handling
5. Performance and caching

### Integration Tests

1. Full action processing with context
2. Complex multi-target scenarios
3. Real scope file evaluation
4. Error cases and edge conditions

## Acceptance Criteria

1. ✅ Scope expressions can access `target` when contextFrom is used
2. ✅ Scope expressions can access `targets` object with all resolved targets
3. ✅ JSON Logic filters can reference target context variables
4. ✅ Missing context handled gracefully (returns empty results)
5. ✅ Nested property access works (e.g., `target.components.property`)
6. ✅ Performance remains fast with context lookups
7. ✅ Backward compatibility maintained for existing scopes
8. ✅ Clear error messages for invalid context access
9. ✅ Integration tests pass with real scope files
10. ✅ Documentation updated with context examples

## Documentation Updates

Update the scope DSL documentation:

````markdown
## Context Variables in Scope Expressions

When evaluating scope expressions, the following context variables are available:

### Always Available

- `actor` - The entity performing the action
- `location` - Current location entity
- `game` - Global game state

### Multi-Target Context

- `target` - Primary target entity (when contextFrom="primary")
- `targets` - Object with all resolved targets keyed by name

### Example Usage

```dsl
# Access target's inventory
target.core:inventory.items[]

# Access specific resolved target group
targets.primary[0].components

# Use target in JSON Logic
entities(core:item)[][{
  "==": [
    {"var": "entity.components.core:item.ownerId"},
    {"var": "target.id"}
  ]
}]
```
````

```

## Performance Considerations

1. **Context Caching**: Cache entity lookups within evaluation
2. **Lazy Loading**: Only resolve context paths that are accessed
3. **Batch Operations**: Group entity lookups when possible
4. **Memory Management**: Clear context after evaluation

## Security Considerations

1. Validate all entity IDs in context
2. Prevent circular references in context
3. Limit context depth to prevent stack overflow
4. Sanitize context data before evaluation

## Future Enhancements

1. Support for more complex context paths
2. Context variable aliases for readability
3. Type checking for context access
4. Context debugging tools
5. Performance profiling for context usage
```
