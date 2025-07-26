# Ticket: Create Context-Aware Scope Examples

## Ticket ID: PHASE3-TICKET9
## Priority: High
## Estimated Time: 4-5 hours
## Dependencies: PHASE3-TICKET8
## Blocks: PHASE3-TICKET10, PHASE4-TICKET13

## Overview

Create comprehensive examples of context-aware scope definitions that demonstrate how to use the new `target` and `targets` context variables. These examples serve as both working code and documentation for modders who want to create actions with dependent target resolution.

## Goals

1. **Practical Examples**: Real-world scenarios showing context usage
2. **Progressive Complexity**: Simple to advanced context patterns
3. **Best Practices**: Demonstrate efficient and safe scope patterns
4. **Documentation Value**: Clear, well-commented examples
5. **Testing Support**: Examples that can be used in automated tests

## Example Categories

1. **Basic Context Access**: Simple target property access
2. **Context-Dependent Filtering**: Using target data in JSON Logic
3. **Nested Context Resolution**: Multi-level target dependencies
4. **Performance Optimized**: Efficient context patterns
5. **Error-Safe Patterns**: Robust context handling

## Implementation Steps

### Step 1: Basic Context Access Examples

Create file: `data/mods/examples/scopes/basic_context.scope`

```
# Basic Context-Aware Scope Examples
# Demonstrates simple usage of target context variables

# Access target's inventory items
target_inventory_items := target.core:inventory.items[]

# Access target's equipped clothing
target_equipped_clothing := target.topmost_clothing[]

# Access target's current health
target_health := target.core:health.current

# Access target's skills
target_skills := target.core:skills[]

# Access target's position
target_location := target.core:position.locationId

# Access all actors at target's location
target_location_actors := target.location.core:actors[]

# Access target's social relationships
target_relationships := target.social:relationships[]

# Simple property checks
target_is_conscious := target.core:actor.conscious
target_is_alive := target.core:health.current > 0
target_name := target.core:actor.name
```

### Step 2: Context-Dependent Filtering Examples

Create file: `data/mods/examples/scopes/context_filtering.scope`

```
# Context-Dependent Filtering Examples
# Shows how to use target context in JSON Logic filters

# Items in target's inventory that actor can afford
target_affordable_items := target.core:inventory.items[][{
  "<=": [
    {"var": "entity.components.core:item.price"},
    {"var": "actor.components.core:inventory.gold"}
  ]
}]

# Clothing on target that actor has skill to adjust
target_adjustable_clothing := target.topmost_clothing[][{
  "and": [
    {"in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]},
    {
      ">=": [
        {"var": "actor.components.tailoring:skill.level"},
        {"var": "entity.components.clothing:garment.difficulty"}
      ]
    }
  ]
}]

# Weapons in target's inventory that are lighter than actor's strength
target_liftable_weapons := target.core:inventory.items[][{
  "and": [
    {"==": [{"var": "entity.components.core:item.type"}, "weapon"]},
    {
      "<=": [
        {"var": "entity.components.core:item.weight"},
        {"var": "actor.components.core:stats.strength"}
      ]
    }
  ]
}]

# Items target owns that actor doesn't have
target_unique_items := target.core:inventory.items[][{
  "not": {
    "in": [
      {"var": "entity.components.core:item.name"},
      {"var": "actor.components.core:inventory.item_names"}
    ]
  }
}]

# Skills target has that are higher than actor's
target_superior_skills := target.core:skills[][{
  ">": [
    {"var": "entity.level"},
    {"var": "actor.components.core:skills[entity.name].level"}
  ]
}]

# People at target's location excluding target and actor
target_location_others := target.location.core:actors[][{
  "and": [
    {"!=": [{"var": "entity.id"}, {"var": "target.id"}]},
    {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}
  ]
}]
```

### Step 3: Nested Context and Multiple Targets

Create file: `data/mods/examples/scopes/nested_context.scope`

```
# Nested Context Examples
# Demonstrates complex target relationships and multiple context usage

# Items in container that primary target (key) can unlock
unlockable_container_contents := targets.secondary[0].core:contents.items[][{
  "and": [
    {"var": "targets.secondary[0].components.core:container.locked"},
    {
      "in": [
        {"var": "targets.secondary[0].components.core:container.lock_type"},
        {"var": "targets.primary[0].components.core:key.types"}
      ]
    }
  ]
}]

# Weapons that can be used with ammunition from target's inventory
compatible_weapon_ammo_pairs := actor.core:inventory.weapons[][{
  "and": [
    {"var": "entity.components.core:weapon.uses_ammo"},
    {
      "in": [
        {"var": "entity.components.core:weapon.ammo_type"},
        {"var": "target.components.core:inventory.ammo_types"}
      ]
    }
  ]
}]

# Recipes that can be crafted using tools from primary target and materials from secondary
craftable_recipes := game.recipes[][{
  "and": [
    {
      "every": [
        {"var": "entity.required_tools"},
        {
          "in": [
            {"var": ""},
            {"var": "targets.primary[0].components.core:inventory.tool_types"}
          ]
        }
      ]
    },
    {
      "every": [
        {"var": "entity.required_materials"},
        {
          "in": [
            {"var": ""},
            {"var": "targets.secondary[0].components.core:inventory.material_types"}
          ]
        }
      ]
    }
  ]
}]

# People who know the target (checking social relationships)
target_acquaintances := location.core:actors[][{
  "and": [
    {"!=": [{"var": "entity.id"}, {"var": "target.id"}]},
    {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]},
    {
      "in": [
        {"var": "target.id"},
        {"var": "entity.components.social:relationships.known_people"}
      ]
    }
  ]
}]
```

### Step 4: Performance-Optimized Context Patterns

Create file: `data/mods/examples/scopes/performance_patterns.scope`

```
# Performance-Optimized Context Examples
# Demonstrates efficient ways to use context to minimize computation

# Cache target's inventory for multiple operations
target_inventory := target.core:inventory.items[]

# Pre-filter before expensive operations
target_valuable_items := target_inventory[][{
  ">": [{"var": "entity.components.core:item.value"}, 100]
}]

# Use early filtering to reduce set size
target_wearable_by_actor := target.topmost_clothing[][{
  "and": [
    {"in": ["removable", {"var": "entity.components.clothing:garment.properties"}]},
    {
      "==": [
        {"var": "entity.components.clothing:garment.size"},
        {"var": "actor.components.core:body.clothing_size"}
      ]
    }
  ]
}]

# Optimize repeated property access
target_stats := target.core:stats
target_combat_ready := target_stats.health > 50 && target_stats.stamina > 25

# Use existence checks before complex operations
target_has_inventory := target.core:inventory != null
target_tradeable_items := target_has_inventory ? target.core:inventory.items[][{
  "and": [
    {"in": ["tradeable", {"var": "entity.components.core:item.properties"}]},
    {"!=": [{"var": "entity.components.core:item.bound_to"}, {"var": "target.id"}]}
  ]
}] : []

# Batch related checks
target_interaction_valid := {
  "and": [
    {"var": "target.components.core:actor.conscious"},
    {"var": "target.components.core:health.current > 0"},
    {"!=": [{"var": "target.components.core:actor.faction"}, "hostile"]}
  ]
}
```

### Step 5: Error-Safe Context Patterns

Create file: `data/mods/examples/scopes/error_safe_patterns.scope`

```
# Error-Safe Context Examples
# Shows robust patterns that handle missing or invalid context data

# Safe property access with defaults
target_name_safe := target.core:actor.name || target.core:item.name || target.id

# Check existence before access
target_inventory_safe := target.core:inventory ? target.core:inventory.items[] : []

# Validate target type before specific operations
target_is_actor := target.core:actor != null
target_actor_items := target_is_actor ? target.core:inventory.items[] : []

# Handle missing components gracefully
target_health_safe := target.core:health ? target.core:health.current : 100

# Safe array operations
target_skills_safe := target.core:skills ? target.core:skills[] : []

# Defensive filtering with existence checks
target_safe_clothing := target.topmost_clothing ? target.topmost_clothing[][{
  "and": [
    {"var": "entity.components.clothing:garment != null"},
    {"in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]}
  ]
}] : []

# Multi-level safety checks
target_container_contents_safe := {
  "if": [
    {"and": [
      {"var": "target.core:container != null"},
      {"var": "target.core:container.contents != null"}
    ]},
    {"var": "target.core:container.contents.items[]"},
    []
  ]
}

# Safe relationship access
target_relationships_safe := {
  "if": [
    {"var": "target.social:relationships != null"},
    {"var": "target.social:relationships[]"},
    []
  ]
}
```

### Step 6: Real-World Usage Examples

Create file: `data/mods/examples/scopes/real_world_usage.scope`

```
# Real-World Context Usage Examples
# Practical scenarios showing context in actual game mechanics

# Trading: Items target has that actor wants
trading_target_desired_items := target.core:inventory.items[][{
  "and": [
    {"in": ["tradeable", {"var": "entity.components.core:item.properties"}]},
    {
      "in": [
        {"var": "entity.components.core:item.category"},
        {"var": "actor.components.player:preferences.desired_item_types"}
      ]
    },
    {
      "<=": [
        {"var": "entity.components.core:item.price"},
        {"*": [{"var": "actor.components.core:inventory.gold"}, 1.5]}
      ]
    }
  ]
}]

# Combat: Weapons target is holding that actor could potentially disarm
target_disarmable_weapons := target.core:equipment.weapons[][{
  "and": [
    {"var": "entity.components.core:weapon.can_be_disarmed"},
    {
      ">=": [
        {"var": "actor.components.combat:skills.disarm"},
        {"var": "entity.components.core:weapon.disarm_difficulty"}
      ]
    },
    {
      ">": [
        {"var": "actor.components.core:stats.dexterity"},
        {"var": "target.components.core:stats.dexterity"}
      ]
    }
  ]
}]

# Social: Conversation topics target would be interested in
target_conversation_topics := game.conversation_topics[][{
  "some": [
    {"var": "entity.categories"},
    {
      "in": [
        {"var": ""},
        {"var": "target.components.social:interests.categories"}
      ]
    }
  ]
}]

# Crafting: Tools target has that actor needs for specific recipe
target_needed_tools := target.core:inventory.items[][{
  "and": [
    {"==": [{"var": "entity.components.core:item.type"}, "tool"]},
    {
      "in": [
        {"var": "entity.components.core:tool.craft_types"},
        {"var": "actor.components.crafting:current_recipe.required_tool_types"}
      ]
    },
    {"in": ["borrowable", {"var": "entity.components.core:item.properties"}]}
  ]
}]

# Medical: Injuries target has that actor can treat
target_treatable_injuries := target.core:injuries[][{
  "and": [
    {
      ">=": [
        {"var": "actor.components.medical:skill.level"},
        {"var": "entity.treatment_difficulty"}
      ]
    },
    {
      "some": [
        {"var": "actor.components.core:inventory.medical_supplies"},
        {
          "in": [
            {"var": ""},
            {"var": "entity.required_supplies"}
          ]
        }
      ]
    }
  ]
}]

# Magic: Spells that would be effective against target
target_effective_spells := actor.magic:spells[][{
  "and": [
    {"var": "entity.is_offensive"},
    {
      "not": {
        "in": [
          {"var": "entity.school"},
          {"var": "target.components.magic:resistances.schools"}
        ]
      }
    },
    {
      "<=": [
        {"var": "entity.mana_cost"},
        {"var": "actor.components.magic:mana.current"}
      ]
    }
  ]
}]
```

### Step 7: Create Test Suite for Context Examples

Create file: `tests/integration/scopeDsl/contextExamples.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Context-Aware Scope Examples', () => {
  let testBed;
  let scopeInterpreter;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    scopeInterpreter = testBed.getService('scopeInterpreter');
    
    // Load example scope definitions
    testBed.loadScopeFile('data/mods/examples/scopes/basic_context.scope');
    testBed.loadScopeFile('data/mods/examples/scopes/context_filtering.scope');
    testBed.loadScopeFile('data/mods/examples/scopes/nested_context.scope');
    testBed.loadScopeFile('data/mods/examples/scopes/performance_patterns.scope');
    testBed.loadScopeFile('data/mods/examples/scopes/error_safe_patterns.scope');
    testBed.loadScopeFile('data/mods/examples/scopes/real_world_usage.scope');
  });

  describe('Basic Context Access', () => {
    it('should access target inventory items', async () => {
      const player = testBed.createEntity('player', {});
      
      const npc = testBed.createEntity('npc_001', {
        'core:inventory': { items: ['sword_001', 'potion_002'] }
      });

      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'npc_001', components: npc.getAllComponents() },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target_inventory_items',
        context
      );

      expect(result).toEqual(['sword_001', 'potion_002']);
    });

    it('should access target equipped clothing', async () => {
      const npc = testBed.createEntity('npc_001', {
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'jacket_001' },
            legs: { base: 'pants_001' }
          }
        }
      });

      testBed.createEntity('jacket_001', {
        'core:item': { name: 'Jacket' },
        'clothing:garment': { slot: 'torso_upper', layer: 'outer' }
      });

      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'npc_001', components: npc.getAllComponents() },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target_equipped_clothing',
        context
      );

      expect(result).toContain('jacket_001');
    });
  });

  describe('Context-Dependent Filtering', () => {
    it('should filter items actor can afford from target inventory', async () => {
      const player = testBed.createEntity('player', {
        'core:inventory': { gold: 100 }
      });

      const merchant = testBed.createEntity('merchant_001', {
        'core:inventory': { items: ['cheap_item', 'expensive_item'] }
      });

      testBed.createEntity('cheap_item', {
        'core:item': { name: 'Cheap Item', price: 50 }
      });

      testBed.createEntity('expensive_item', {
        'core:item': { name: 'Expensive Item', price: 150 }
      });

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        target: { id: 'merchant_001', components: merchant.getAllComponents() },
        location: { id: 'shop', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target_affordable_items',
        context
      );

      expect(result).toContain('cheap_item');
      expect(result).not.toContain('expensive_item');
    });

    it('should filter adjustable clothing by actor skill', async () => {
      const tailor = testBed.createEntity('tailor', {
        'tailoring:skill': { level: 3 }
      });

      const customer = testBed.createEntity('customer_001', {
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'simple_shirt', base: 'complex_vest' }
          }
        }
      });

      testBed.createEntity('simple_shirt', {
        'core:item': { name: 'Simple Shirt' },
        'clothing:garment': {
          properties: ['adjustable'],
          difficulty: 2
        }
      });

      testBed.createEntity('complex_vest', {
        'core:item': { name: 'Complex Vest' },
        'clothing:garment': {
          properties: ['adjustable'],
          difficulty: 5
        }
      });

      const context = {
        actor: { id: 'tailor', components: tailor.getAllComponents() },
        target: { id: 'customer_001', components: customer.getAllComponents() },
        location: { id: 'shop', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target_adjustable_clothing',
        context
      );

      expect(result).toContain('simple_shirt');
      expect(result).not.toContain('complex_vest');
    });
  });

  describe('Error-Safe Patterns', () => {
    it('should handle missing target components gracefully', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'incomplete_entity', components: {} }, // Missing inventory
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target_inventory_safe',
        context
      );

      expect(result).toEqual([]);
    });

    it('should provide safe defaults for missing properties', async () => {
      const entityWithoutName = testBed.createEntity('no_name_entity', {
        // No actor or item component with name
      });

      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'no_name_entity', components: entityWithoutName.getAllComponents() },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target_name_safe',
        context
      );

      expect(result).toBe('no_name_entity'); // Should fall back to entity ID
    });
  });

  describe('Performance Patterns', () => {
    it('should execute performance-optimized scopes efficiently', async () => {
      // Create target with many items
      const itemIds = Array.from({ length: 100 }, (_, i) => `item_${i}`);
      const target = testBed.createEntity('target_001', {
        'core:inventory': { items: itemIds }
      });

      // Create items with varying values
      itemIds.forEach((id, index) => {
        testBed.createEntity(id, {
          'core:item': {
            name: `Item ${index}`,
            value: index * 10 // Some will be > 100
          }
        });
      });

      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'target_001', components: target.getAllComponents() },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const start = performance.now();
      const result = await scopeInterpreter.evaluate(
        'target_valuable_items',
        context
      );
      const end = performance.now();

      expect(result.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(50); // Should be fast even with 100 items
    });
  });

  describe('Real-World Usage', () => {
    it('should identify tradeable items target has that actor wants', async () => {
      const player = testBed.createEntity('player', {
        'core:inventory': { gold: 200 },
        'player:preferences': { desired_item_types: ['weapon', 'armor'] }
      });

      const merchant = testBed.createEntity('merchant_001', {
        'core:inventory': { items: ['sword_for_sale', 'book_for_sale'] }
      });

      testBed.createEntity('sword_for_sale', {
        'core:item': {
          name: 'Iron Sword',
          category: 'weapon',
          price: 150,
          properties: ['tradeable']
        }
      });

      testBed.createEntity('book_for_sale', {
        'core:item': {
          name: 'Spell Book',
          category: 'book',
          price: 100,
          properties: ['tradeable']
        }
      });

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        target: { id: 'merchant_001', components: merchant.getAllComponents() },
        location: { id: 'market', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'trading_target_desired_items',
        context
      );

      expect(result).toContain('sword_for_sale');
      expect(result).not.toContain('book_for_sale');
    });
  });
});
```

### Step 8: Create Documentation

Create file: `docs/examples/context-aware-scopes.md`

```markdown
# Context-Aware Scope Examples

This document provides comprehensive examples of using context variables in scope definitions for multi-target actions.

## Overview

Context-aware scopes allow scope expressions to access data from previously resolved targets, enabling sophisticated dependent target resolution patterns.

### Available Context Variables

- `target` - The primary target entity (when contextFrom="primary")
- `targets` - Object containing all resolved targets keyed by definition name
- `actor` - The entity performing the action (always available)
- `location` - Current location entity (always available)
- `game` - Global game state (always available)

## Basic Context Access

### Simple Property Access

```dsl
# Access target's inventory
target_inventory_items := target.core:inventory.items[]

# Access target's name
target_name := target.core:actor.name

# Access target's current health
target_health := target.core:health.current
```

### Nested Property Access

```dsl
# Access items in target's container
target_container_contents := target.core:container.contents.items[]

# Access target's location's other actors
target_location_others := target.location.core:actors[]
```

## Context-Dependent Filtering

### Using Target Data in Filters

```dsl
# Items in target's inventory that actor can afford
target_affordable_items := target.core:inventory.items[][{
  "<=": [
    {"var": "entity.components.core:item.price"},
    {"var": "actor.components.core:inventory.gold"}
  ]
}]
```

### Cross-Entity Comparisons

```dsl
# Weapons target has that are lighter than actor can carry
target_liftable_weapons := target.core:inventory.items[][{
  "and": [
    {"==": [{"var": "entity.components.core:item.type"}, "weapon"]},
    {
      "<=": [
        {"var": "entity.components.core:item.weight"},
        {"var": "actor.components.core:stats.strength"}
      ]
    }
  ]
}]
```

## Advanced Patterns

### Multiple Target Context

```dsl
# Items that can be unlocked by primary target (key) from secondary target (container)
unlockable_items := targets.secondary[0].core:contents.items[][{
  "and": [
    {"var": "targets.secondary[0].components.core:container.locked"},
    {
      "in": [
        {"var": "targets.secondary[0].components.core:container.lock_type"},
        {"var": "targets.primary[0].components.core:key.types"}
      ]
    }
  ]
}]
```

### Conditional Context Usage

```dsl
# Safe access with existence checks
target_items := target.core:inventory ? target.core:inventory.items[] : []
```

## Error-Safe Patterns

### Defensive Programming

```dsl
# Handle missing components
target_health_safe := target.core:health ? target.core:health.current : 100

# Provide fallback values
target_name_safe := target.core:actor.name || target.core:item.name || target.id
```

### Validation Before Access

```dsl
# Check target type before operations
target_is_actor := target.core:actor != null
target_actor_items := target_is_actor ? target.core:inventory.items[] : []
```

## Performance Considerations

### Efficient Context Access

```dsl
# Cache frequently accessed data
target_stats := target.core:stats
target_combat_ready := target_stats.health > 50 && target_stats.stamina > 25

# Use early filtering
target_valuable_items := target.core:inventory.items[][{
  ">": [{"var": "entity.components.core:item.value"}, 100]
}]
```

### Minimize Context Lookups

```dsl
# Batch related operations
target_interaction_data := {
  "conscious": {"var": "target.components.core:actor.conscious"},
  "alive": {">": [{"var": "target.components.core:health.current"}, 0]},
  "friendly": {"!=": [{"var": "target.components.core:actor.faction"}, "hostile"]}
}
```

## Common Use Cases

### Trading Systems

```dsl
# Items target has that actor wants to buy
tradeable_items := target.core:inventory.items[][{
  "and": [
    {"in": ["tradeable", {"var": "entity.components.core:item.properties"}]},
    {
      "in": [
        {"var": "entity.components.core:item.category"},
        {"var": "actor.components.player:preferences.desired_categories"}
      ]
    }
  ]
}]
```

### Clothing Systems

```dsl
# Clothing on target that actor can adjust
adjustable_clothing := target.topmost_clothing[][{
  "and": [
    {"in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]},
    {
      ">=": [
        {"var": "actor.components.tailoring:skill.level"},
        {"var": "entity.components.clothing:garment.adjustment_difficulty"}
      ]
    }
  ]
}]
```

### Combat Systems

```dsl
# Weapons target has that actor could disarm
disarmable_weapons := target.core:equipment.weapons[][{
  "and": [
    {"var": "entity.components.core:weapon.can_be_disarmed"},
    {
      ">": [
        {"var": "actor.components.combat:skills.disarm"},
        {"var": "entity.components.core:weapon.disarm_difficulty"}
      ]
    }
  ]
}]
```

## Best Practices

### 1. Use Descriptive Names
```dsl
# Good
target_affordable_items := ...

# Bad
items := ...
```

### 2. Include Safety Checks
```dsl
# Always check for component existence
target_items := target.core:inventory ? target.core:inventory.items[] : []
```

### 3. Optimize for Performance
```dsl
# Cache expensive lookups
target_inventory := target.core:inventory.items[]
target_weapons := target_inventory[][{"==": [{"var": "entity.components.core:item.type"}, "weapon"]}]
```

### 4. Document Complex Logic
```dsl
# Items that can be used to unlock the target container
# Checks if actor has correct key type and sufficient lockpicking skill
unlockable_with_items := actor.core:inventory.items[][{
  "or": [
    # Direct key match
    {
      "in": [
        {"var": "target.components.core:container.lock_type"},
        {"var": "entity.components.core:key.types"}
      ]
    },
    # Lockpicking tools with sufficient skill
    {
      "and": [
        {"==": [{"var": "entity.components.core:item.type"}, "lockpick"]},
        {
          ">=": [
            {"var": "actor.components.thievery:lockpicking.level"},
            {"var": "target.components.core:container.lock_difficulty"}
          ]
        }
      ]
    }
  ]
}]
```

## Testing Context Scopes

### Unit Testing
```javascript
const context = {
  actor: { id: 'player', components: playerComponents },
  target: { id: 'npc', components: npcComponents },
  location: { id: 'room', components: roomComponents },
  game: { turnNumber: 1 }
};

const result = await scopeInterpreter.evaluate('target_items', context);
expect(result).toEqual(['expected_item_ids']);
```

### Integration Testing
```javascript
// Test full action processing with context-dependent targets
const result = await actionProcessor.process(contextAction, player, context);
expect(result.success).toBe(true);
expect(result.value.actions[0].command).toBe('expected command text');
```
```

## Acceptance Criteria

1. ✅ Basic context access examples work correctly
2. ✅ Context-dependent filtering examples function properly
3. ✅ Nested context resolution examples operate correctly
4. ✅ Error-safe patterns handle missing data gracefully
5. ✅ Performance patterns execute efficiently
6. ✅ Real-world usage examples demonstrate practical scenarios
7. ✅ All examples have comprehensive test coverage
8. ✅ Documentation clearly explains each pattern
9. ✅ Examples can be used as templates for modders
10. ✅ Integration tests validate examples in realistic scenarios

## Documentation Requirements

### For Modders
- Step-by-step tutorials for each pattern type
- Common pitfalls and how to avoid them
- Performance guidelines for context usage
- Debugging tips for context-related issues

### For Developers
- Implementation details for context handling
- Extension patterns for new context types
- Performance profiling results
- Security considerations for context access

## Future Enhancements

1. **Context Debugging Tools**: Visual tools for inspecting context data
2. **Context Type Validation**: Compile-time checking for context access
3. **Context Performance Profiler**: Tools for optimizing context usage
4. **Dynamic Context**: Runtime context variable registration
5. **Context Caching**: Intelligent caching of expensive context operations