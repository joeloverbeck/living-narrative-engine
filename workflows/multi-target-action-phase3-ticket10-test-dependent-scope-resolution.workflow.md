# Ticket: Test Dependent Scope Resolution

## Ticket ID: PHASE3-TICKET10
## Priority: High
## Estimated Time: 5-6 hours
## Dependencies: PHASE3-TICKET8, PHASE3-TICKET9
## Blocks: PHASE4-TICKET11, PHASE4-TICKET14

## Overview

Create comprehensive tests for dependent scope resolution functionality to ensure that context-dependent targets are resolved correctly in various scenarios. These tests validate the entire chain from context building through scope evaluation to target resolution, ensuring robustness and performance.

## Testing Goals

1. **Context Propagation**: Verify context flows correctly between target definitions
2. **Dependency Resolution**: Test proper ordering of dependent target resolution
3. **Error Handling**: Validate graceful handling of missing or invalid context
4. **Performance**: Ensure dependent resolution meets timing requirements
5. **Edge Cases**: Cover complex dependency chains and circular references

## Test Categories

1. **Basic Dependency Tests**: Simple contextFrom relationships
2. **Multi-Level Dependencies**: Tertiary targets depending on secondary
3. **Error Conditions**: Missing context, invalid references
4. **Performance Tests**: Large-scale dependent resolution
5. **Integration Tests**: Full action processing with dependencies

## Implementation Steps

### Step 1: Basic Dependency Resolution Tests

Create file: `tests/unit/scopeDsl/dependentScopeResolution.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScopeInterpreter } from '../../../src/scopeDsl/scopeInterpreter.js';
import { TargetContextBuilder } from '../../../src/actions/targetContextBuilder.js';

describe('Dependent Scope Resolution', () => {
  let scopeInterpreter;
  let targetContextBuilder;
  let mockEntityManager;
  let mockScopeRegistry;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: jest.fn(),
      getAllEntities: jest.fn()
    };

    mockScopeRegistry = {
      getScope: jest.fn()
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    scopeInterpreter = new ScopeInterpreter({
      entityManager: mockEntityManager,
      scopeRegistry: mockScopeRegistry,
      logger: mockLogger
    });

    targetContextBuilder = new TargetContextBuilder({
      logger: mockLogger
    });
  });

  describe('Basic Context Dependencies', () => {
    it('should resolve secondary target with primary context', async () => {
      // Mock primary target entity
      const primaryTarget = {
        id: 'npc_001',
        components: {
          'core:inventory': { items: ['item_001', 'item_002'] }
        }
      };

      mockEntityManager.getEntity.mockImplementation(id => {
        if (id === 'npc_001') return primaryTarget;
        if (id === 'item_001') return { id: 'item_001', components: {} };
        if (id === 'item_002') return { id: 'item_002', components: {} };
        return null;
      });

      // Setup context with primary target resolved
      const context = {
        actor: { id: 'player', components: {} },
        target: primaryTarget,
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      // Test scope that accesses target's inventory
      const result = await scopeInterpreter.evaluate(
        'target.core:inventory.items[]',
        context
      );

      expect(result).toEqual(['item_001', 'item_002']);
    });

    it('should handle missing primary target gracefully', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        // No target in context
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target.core:inventory.items[]',
        context
      );

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No target in context'),
        'ContextAwareResolver'
      );
    });

    it('should build context for secondary target resolution', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const primaryTarget = {
        id: 'npc_001',
        components: { 'core:actor': { name: 'Alice' } }
      };

      const result = targetContextBuilder.buildContext(
        { ...baseContext, target: primaryTarget },
        'primary'
      );

      expect(result).toEqual({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
        target: primaryTarget
      });
    });
  });

  describe('Multi-Level Dependencies', () => {
    it('should resolve tertiary target with secondary context', async () => {
      const primaryTarget = { id: 'tool_001', components: {} };
      const secondaryTarget = {
        id: 'container_001',
        components: {
          'core:container': { 
            contents: { items: ['treasure_001', 'treasure_002'] }
          }
        }
      };

      mockEntityManager.getEntity.mockImplementation(id => {
        if (id === 'treasure_001') return { id: 'treasure_001', components: {} };
        if (id === 'treasure_002') return { id: 'treasure_002', components: {} };
        return null;
      });

      const context = {
        actor: { id: 'player', components: {} },
        targets: {
          primary: [primaryTarget],
          secondary: [secondaryTarget]
        },
        target: secondaryTarget, // Current context for tertiary resolution
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target.core:container.contents.items[]',
        context
      );

      expect(result).toEqual(['treasure_001', 'treasure_002']);
    });

    it('should build nested context for multi-level dependencies', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const primaryTarget = { id: 'tool_001', components: {} };
      const secondaryTarget = { id: 'container_001', components: {} };

      // Build context for tertiary resolution
      const contextWithTargets = {
        ...baseContext,
        targets: {
          primary: [primaryTarget],
          secondary: [secondaryTarget]
        },
        target: secondaryTarget
      };

      const result = targetContextBuilder.buildContext(
        contextWithTargets,
        'secondary'
      );

      expect(result.targets).toEqual({
        primary: [primaryTarget],
        secondary: [secondaryTarget]
      });
      expect(result.target).toEqual(secondaryTarget);
    });
  });

  describe('Complex Dependency Chains', () => {
    it('should handle deeply nested dependencies', async () => {
      // Chain: primary → secondary → tertiary → quaternary
      const targets = {
        primary: [{
          id: 'player_001',
          components: { 'core:faction': { name: 'merchants' } }
        }],
        secondary: [{
          id: 'guild_001',
          components: { 
            'guild:members': { list: ['member_001', 'member_002'] }
          }
        }],
        tertiary: [{
          id: 'member_001',
          components: {
            'core:inventory': { items: ['guild_item_001'] }
          }
        }]
      };

      mockEntityManager.getEntity.mockReturnValue({
        id: 'guild_item_001',
        components: {}
      });

      const context = {
        actor: { id: 'player', components: {} },
        targets,
        target: targets.tertiary[0],
        location: { id: 'guild_hall', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target.core:inventory.items[]',
        context
      );

      expect(result).toEqual(['guild_item_001']);
    });

    it('should detect and prevent circular dependencies', () => {
      // This would be caught at the action definition validation level
      // but we should test the scope resolution doesn't infinite loop
      
      const circularTarget = {
        id: 'circular_001',
        components: {
          'core:reference': { target: 'circular_001' }
        }
      };

      const context = {
        actor: { id: 'player', components: {} },
        target: circularTarget,
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      // This should not cause infinite recursion
      expect(async () => {
        await scopeInterpreter.evaluate(
          'target.core:reference.target',
          context
        );
      }).not.toThrow();
    });
  });

  describe('Error Conditions', () => {
    it('should handle broken dependency chains gracefully', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        targets: {
          primary: [{ id: 'valid_001', components: {} }]
          // Missing secondary targets
        },
        target: null, // No current target
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'targets.secondary[0].core:inventory.items[]',
        context
      );

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No targets found for key \'secondary\''),
        'ContextAwareResolver'
      );
    });

    it('should handle invalid target references', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: {
          id: 'incomplete_001',
          components: {
            // Missing expected component
          }
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = await scopeInterpreter.evaluate(
        'target.core:inventory.items[]',
        context
      );

      expect(result).toEqual([]);
      // Should not throw, just return empty result
    });

    it('should handle malformed scope expressions', async () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'valid_001', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      await expect(
        scopeInterpreter.evaluate('target..invalid[]', context)
      ).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should resolve dependencies efficiently with large target sets', async () => {
      // Create large target with many items
      const largeInventory = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
      const largeTarget = {
        id: 'large_target',
        components: {
          'core:inventory': { items: largeInventory }
        }
      };

      mockEntityManager.getEntity.mockImplementation(id => {
        if (id.startsWith('item_')) {
          return { id, components: {} };
        }
        return null;
      });

      const context = {
        actor: { id: 'player', components: {} },
        target: largeTarget,
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const start = performance.now();
      const result = await scopeInterpreter.evaluate(
        'target.core:inventory.items[]',
        context
      );
      const end = performance.now();

      expect(result).toHaveLength(1000);
      expect(end - start).toBeLessThan(100); // < 100ms for 1000 items
    });

    it('should cache context lookups for repeated evaluations', async () => {
      const target = {
        id: 'cached_target',
        components: {
          'core:stats': { health: 100, mana: 50 }
        }
      };

      const context = {
        actor: { id: 'player', components: {} },
        target,
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      // Evaluate same expression multiple times
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await scopeInterpreter.evaluate('target.core:stats.health', context);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(1); // < 1ms per cached lookup
    });
  });
});
```

### Step 2: Context Building Tests

Create file: `tests/unit/actions/targetContextBuilder.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetContextBuilder } from '../../../src/actions/targetContextBuilder.js';

describe('TargetContextBuilder', () => {
  let builder;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    builder = new TargetContextBuilder({ logger: mockLogger });
  });

  describe('Context Building', () => {
    it('should build primary target context', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const primaryTarget = {
        id: 'target_001',
        components: { 'core:actor': { name: 'NPC' } }
      };

      const result = builder.buildContext(
        { ...baseContext, target: primaryTarget },
        'primary'
      );

      expect(result).toEqual({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
        target: primaryTarget
      });
    });

    it('should build secondary target context with targets object', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const primaryTarget = { id: 'primary_001', components: {} };
      const secondaryTarget = { id: 'secondary_001', components: {} };

      const contextWithTargets = {
        ...baseContext,
        targets: {
          primary: [primaryTarget],
          secondary: [secondaryTarget]
        },
        target: secondaryTarget
      };

      const result = builder.buildContext(contextWithTargets, 'secondary');

      expect(result.targets).toEqual({
        primary: [primaryTarget],
        secondary: [secondaryTarget]
      });
      expect(result.target).toEqual(secondaryTarget);
    });

    it('should handle missing context gracefully', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };

      const result = builder.buildContext(baseContext, 'primary');

      expect(result).toEqual(baseContext);
      expect(result.target).toBeUndefined();
    });

    it('should preserve additional context properties', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
        customProperty: 'custom_value',
        target: { id: 'target_001', components: {} }
      };

      const result = builder.buildContext(baseContext, 'primary');

      expect(result.customProperty).toBe('custom_value');
      expect(result.target).toEqual({ id: 'target_001', components: {} });
    });
  });

  describe('Validation', () => {
    it('should validate context types', () => {
      expect(() => {
        builder.buildContext(null, 'primary');
      }).toThrow('Invalid context');

      expect(() => {
        builder.buildContext({}, null);
      }).toThrow('Invalid contextFrom');
    });

    it('should handle invalid target references', () => {
      const baseContext = {
        actor: { id: 'player', components: {} },
        targets: {
          primary: null // Invalid targets array
        }
      };

      const result = builder.buildContext(baseContext, 'secondary');
      expect(result.target).toBeUndefined();
    });
  });
});
```

### Step 3: Integration Tests for Dependent Resolution

Create file: `tests/integration/actions/dependentTargetResolution.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Dependent Target Resolution Integration', () => {
  let testBed;
  let actionProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionProcessor = testBed.getService('actionCandidateProcessor');
  });

  describe('Two-Level Dependencies', () => {
    it('should resolve clothing adjustment with person → garment dependency', async () => {
      // Create action with dependent targets
      const adjustAction = {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        description: 'Adjust someone\'s clothing',
        targets: {
          primary: {
            scope: 'location.core:actors[]',
            placeholder: 'person'
          },
          secondary: {
            scope: 'target.topmost_clothing[]',
            placeholder: 'garment',
            contextFrom: 'primary'
          }
        },
        template: 'adjust {person}\'s {garment}',
        generateCombinations: false
      };

      // Create entities
      const player = testBed.createEntity('player', {
        'core:position': { locationId: 'room' }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Alice' },
        'core:position': { locationId: 'room' },
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'jacket_001' }
          }
        }
      });

      const jacket = testBed.createEntity('jacket_001', {
        'core:item': { name: 'Blue Jacket' },
        'clothing:garment': {
          slot: 'torso_upper',
          layer: 'outer',
          properties: ['adjustable']
        }
      });

      const room = testBed.createEntity('room', {
        'core:location': { name: 'Room' },
        'core:actors': { actors: ['player', 'npc_001'] }
      });

      // Register scope for topmost clothing
      testBed.registerScope('location.core:actors[]',
        'location.core:actors[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]'
      );
      testBed.registerScope('target.topmost_clothing[]',
        'target.topmost_clothing[]'
      );

      // Process action
      const result = await actionProcessor.process(
        adjustAction,
        player,
        { location: room }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      
      const action = result.value.actions[0];
      expect(action.command).toBe('adjust Alice\'s Blue Jacket');
      expect(action.params.targets.primary.id).toBe('npc_001');
      expect(action.params.targets.secondary.id).toBe('jacket_001');
    });

    it('should handle empty dependent targets gracefully', async () => {
      const adjustAction = {
        id: 'test:adjust_empty',
        name: 'Adjust Empty',
        targets: {
          primary: {
            scope: 'location.core:actors[]',
            placeholder: 'person'
          },
          secondary: {
            scope: 'target.nonexistent_items[]',
            placeholder: 'item',
            contextFrom: 'primary'
          }
        },
        template: 'adjust {person}\'s {item}'
      };

      const player = testBed.createEntity('player', {
        'core:position': { locationId: 'room' }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Bob' },
        'core:position': { locationId: 'room' }
        // No items to adjust
      });

      const room = testBed.createEntity('room', {
        'core:location': { name: 'Room' },
        'core:actors': { actors: ['player', 'npc_001'] }
      });

      testBed.registerScope('location.core:actors[]',
        'location.core:actors[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]'
      );
      testBed.registerScope('target.nonexistent_items[]', '[]');

      const result = await actionProcessor.process(
        adjustAction,
        player,
        { location: room }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.cause).toContain('targets');
    });
  });

  describe('Three-Level Dependencies', () => {
    it('should resolve complex three-way dependency chain', async () => {
      const complexAction = {
        id: 'test:three_way',
        name: 'Complex Action',
        targets: {
          primary: {
            scope: 'actor.core:inventory.tools[]',
            placeholder: 'tool'
          },
          secondary: {
            scope: 'location.core:containers[]',
            placeholder: 'container',
            contextFrom: 'primary'
          },
          tertiary: {
            scope: 'target.core:contents.items[]',
            placeholder: 'item',
            contextFrom: 'secondary'
          }
        },
        template: 'use {tool} on {container} to get {item}',
        generateCombinations: false
      };

      // Create entities
      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['key_001'] },
        'core:position': { locationId: 'vault' }
      });

      const key = testBed.createEntity('key_001', {
        'core:item': { name: 'Master Key', type: 'tool' }
      });

      const chest = testBed.createEntity('chest_001', {
        'core:container': {
          contents: { items: ['treasure_001'] },
          locked: true
        },
        'core:position': { locationId: 'vault' }
      });

      const treasure = testBed.createEntity('treasure_001', {
        'core:item': { name: 'Gold Coins', type: 'treasure' }
      });

      const vault = testBed.createEntity('vault', {
        'core:location': { name: 'Vault' },
        'core:containers': { containers: ['chest_001'] }
      });

      // Register scopes
      testBed.registerScope('actor.core:inventory.tools[]',
        'actor.core:inventory.items[][{"==": [{"var": "entity.components.core:item.type"}, "tool"]}]'
      );
      testBed.registerScope('location.core:containers[]',
        'location.core:containers.containers[]'
      );
      testBed.registerScope('target.core:contents.items[]',
        'target.core:container.contents.items[]'
      );

      const result = await actionProcessor.process(
        complexAction,
        player,
        { location: vault }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);

      const action = result.value.actions[0];
      expect(action.command).toBe('use Master Key on chest_001 to get Gold Coins');
      expect(action.params.targets.primary.id).toBe('key_001');
      expect(action.params.targets.secondary.id).toBe('chest_001');
      expect(action.params.targets.tertiary.id).toBe('treasure_001');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large dependency chains efficiently', async () => {
      // Create action with many potential targets at each level
      const performanceAction = {
        id: 'test:performance',
        name: 'Performance Test',
        targets: {
          primary: {
            scope: 'location.core:actors[]',
            placeholder: 'person'
          },
          secondary: {
            scope: 'target.core:inventory.items[]',
            placeholder: 'item',
            contextFrom: 'primary'
          }
        },
        template: 'take {item} from {person}',
        generateCombinations: true
      };

      const player = testBed.createEntity('player', {
        'core:position': { locationId: 'market' }
      });

      // Create many NPCs with inventories
      const npcIds = Array.from({ length: 10 }, (_, i) => `npc_${i}`);
      const allActors = ['player', ...npcIds];

      npcIds.forEach(id => {
        const itemIds = Array.from({ length: 20 }, (_, j) => `${id}_item_${j}`);
        
        testBed.createEntity(id, {
          'core:actor': { name: `NPC ${id}` },
          'core:position': { locationId: 'market' },
          'core:inventory': { items: itemIds }
        });

        itemIds.forEach(itemId => {
          testBed.createEntity(itemId, {
            'core:item': { name: `Item ${itemId}` }
          });
        });
      });

      const market = testBed.createEntity('market', {
        'core:location': { name: 'Market' },
        'core:actors': { actors: allActors }
      });

      testBed.registerScope('location.core:actors[]',
        'location.core:actors[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]'
      );
      testBed.registerScope('target.core:inventory.items[]',
        'target.core:inventory.items[]'
      );

      const start = performance.now();
      const result = await actionProcessor.process(
        performanceAction,
        player,
        { location: market }
      );
      const end = performance.now();

      expect(result.success).toBe(true);
      expect(result.value.actions.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(500); // < 500ms for large dependency chain
    });
  });

  describe('Error Recovery', () => {
    it('should recover from broken dependency chains', async () => {
      const brokenAction = {
        id: 'test:broken',
        name: 'Broken Action',
        targets: {
          primary: {
            scope: 'location.core:actors[]',
            placeholder: 'person'
          },
          secondary: {
            scope: 'target.nonexistent.property[]',
            placeholder: 'item',
            contextFrom: 'primary'
          }
        },
        template: 'interact with {person}\'s {item}'
      };

      const player = testBed.createEntity('player', {
        'core:position': { locationId: 'room' }
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Alice' },
        'core:position': { locationId: 'room' }
      });

      const room = testBed.createEntity('room', {
        'core:location': { name: 'Room' },
        'core:actors': { actors: ['player', 'npc_001'] }
      });

      testBed.registerScope('location.core:actors[]',
        'location.core:actors[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]'
      );
      testBed.registerScope('target.nonexistent.property[]', '[]');

      const result = await actionProcessor.process(
        brokenAction,
        player,
        { location: room }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      // Should not throw, just return no actions
    });
  });
});
```

### Step 4: End-to-End Dependency Tests

Create file: `tests/e2e/dependentTargetActions.e2e.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { E2ETestBed } from '../common/e2eTestBed.js';

describe('Dependent Target Actions E2E', () => {
  let testBed;
  let gameEngine;

  beforeEach(() => {
    testBed = new E2ETestBed();
    gameEngine = testBed.getGameEngine();
    
    // Load example mods with dependent actions
    testBed.loadMod('clothing');
    testBed.loadMod('intimacy');
    testBed.loadMod('examples');
  });

  describe('Real Gameplay Scenarios', () => {
    it('should allow player to adjust NPC clothing in realistic scenario', async () => {
      // Setup realistic game world
      const world = testBed.createWorld('clothing_shop');
      
      // Create player character
      const player = testBed.createPlayer('tailor', {
        'core:actor': { name: 'Master Tailor' },
        'tailoring:skill': { level: 5 },
        'core:position': { locationId: 'shop_interior' }
      });

      // Create customer NPC
      const customer = testBed.createNPC('customer_001', {
        'core:actor': { name: 'Lady Catherine' },
        'core:position': { locationId: 'shop_interior' },
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'ballgown_top' },
            torso_lower: { base: 'ballgown_skirt' },
            feet: { base: 'dress_shoes' }
          }
        },
        'social:trust_level': 'friendly'
      });

      // Create clothing items
      testBed.createItem('ballgown_top', {
        'core:item': { name: 'Silk Ballgown Top' },
        'clothing:garment': {
          slot: 'torso_upper',
          layer: 'outer',
          properties: ['adjustable', 'formal', 'expensive'],
          condition: 'good'
        }
      });

      // Create location
      testBed.createLocation('shop_interior', {
        'core:location': { name: 'Tailor Shop Interior' },
        'core:actors': { actors: ['tailor', 'customer_001'] }
      });

      // Discover available actions
      const actions = await gameEngine.getAvailableActions(player);
      
      const adjustActions = actions.filter(a => 
        a.id === 'intimacy:adjust_clothing'
      );

      expect(adjustActions.length).toBeGreaterThan(0);

      // Find specific adjustment action
      const adjustBallgown = adjustActions.find(a =>
        a.command.includes('Lady Catherine') && 
        a.command.includes('Silk Ballgown Top')
      );

      expect(adjustBallgown).toBeDefined();
      expect(adjustBallgown.command).toBe('adjust Lady Catherine\'s Silk Ballgown Top');

      // Execute action
      const result = await gameEngine.executeAction(player, adjustBallgown);
      
      expect(result.success).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'clothing:adjustment_completed',
          payload: expect.objectContaining({
            actor: 'tailor',
            target: 'customer_001',
            garment: 'ballgown_top'
          })
        })
      );
    });

    it('should handle complex multi-character clothing interactions', async () => {
      // Scenario: Player helps one NPC adjust another NPC's clothing
      const world = testBed.createWorld('social_gathering');

      const player = testBed.createPlayer('helper', {
        'core:actor': { name: 'Helpful Person' },
        'tailoring:skill': { level: 3 },
        'core:position': { locationId: 'party_room' }
      });

      // Create multiple NPCs
      const bride = testBed.createNPC('bride_001', {
        'core:actor': { name: 'Bride Emma' },
        'core:position': { locationId: 'party_room' },
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'wedding_dress' }
          }
        }
      });

      const bridesmaid = testBed.createNPC('bridesmaid_001', {
        'core:actor': { name: 'Bridesmaid Sarah' },
        'core:position': { locationId: 'party_room' },
        'social:relationships': {
          'bride_001': { relationship: 'friend', trust: 'high' }
        }
      });

      // Test various combinations are available
      const actions = await gameEngine.getAvailableActions(player);
      
      const clothingActions = actions.filter(a => 
        a.id.includes('clothing') || a.id.includes('adjust')
      );

      expect(clothingActions.length).toBeGreaterThan(0);

      // Verify dependency resolution worked correctly
      const brideDressAction = clothingActions.find(a =>
        a.command.includes('Bride Emma') && 
        a.command.includes('wedding_dress')
      );

      if (brideDressAction) {
        expect(brideDressAction.params.targets.primary.id).toBe('bride_001');
        expect(brideDressAction.params.targets.secondary.id).toBe('wedding_dress');
      }
    });
  });

  describe('Error Handling in Real Scenarios', () => {
    it('should gracefully handle NPCs with no adjustable clothing', async () => {
      const world = testBed.createWorld('simple_room');

      const player = testBed.createPlayer('tailor', {
        'core:actor': { name: 'Tailor' },
        'tailoring:skill': { level: 2 },
        'core:position': { locationId: 'room' }
      });

      const npc = testBed.createNPC('npc_001', {
        'core:actor': { name: 'Nude Person' },
        'core:position': { locationId: 'room' }
        // No clothing equipped
      });

      const actions = await gameEngine.getAvailableActions(player);
      
      const adjustActions = actions.filter(a => 
        a.id === 'intimacy:adjust_clothing'
      );

      // Should not find any adjustment actions for nude NPC
      const nudeAdjustments = adjustActions.filter(a =>
        a.command.includes('Nude Person')
      );

      expect(nudeAdjustments).toHaveLength(0);
    });

    it('should handle insufficient skill levels correctly', async () => {
      const world = testBed.createWorld('skill_test');

      const novice = testBed.createPlayer('novice_tailor', {
        'core:actor': { name: 'Novice Tailor' },
        'tailoring:skill': { level: 1 }, // Low skill
        'core:position': { locationId: 'room' }
      });

      const expert = testBed.createNPC('expert_001', {
        'core:actor': { name: 'Master Craftsman' },
        'core:position': { locationId: 'room' },
        'clothing:equipment': {
          equipped: {
            torso_upper: { outer: 'complex_robe' }
          }
        }
      });

      testBed.createItem('complex_robe', {
        'core:item': { name: 'Master\'s Robe' },
        'clothing:garment': {
          properties: ['adjustable'],
          difficulty: 5 // Requires high skill
        }
      });

      const actions = await gameEngine.getAvailableActions(novice);
      
      const adjustActions = actions.filter(a =>
        a.command.includes('Master\'s Robe')
      );

      // Should not be available due to skill requirement
      expect(adjustActions).toHaveLength(0);
    });
  });

  describe('Performance in Complex Scenarios', () => {
    it('should handle large social gatherings efficiently', async () => {
      const world = testBed.createWorld('large_party');

      // Create player
      const player = testBed.createPlayer('party_host', {
        'core:actor': { name: 'Party Host' },
        'tailoring:skill': { level: 10 },
        'core:position': { locationId: 'ballroom' }
      });

      // Create many NPCs with various clothing
      const npcCount = 50;
      const npcIds = [];

      for (let i = 0; i < npcCount; i++) {
        const npcId = `guest_${i}`;
        npcIds.push(npcId);

        testBed.createNPC(npcId, {
          'core:actor': { name: `Guest ${i}` },
          'core:position': { locationId: 'ballroom' },
          'clothing:equipment': {
            equipped: {
              torso_upper: { outer: `outfit_${i}` }
            }
          }
        });

        // Create clothing item
        testBed.createItem(`outfit_${i}`, {
          'core:item': { name: `Outfit ${i}` },
          'clothing:garment': {
            properties: ['adjustable'],
            difficulty: Math.floor(Math.random() * 5) + 1
          }
        });
      }

      // Create location with all guests
      testBed.createLocation('ballroom', {
        'core:location': { name: 'Grand Ballroom' },
        'core:actors': { actors: ['party_host', ...npcIds] }
      });

      const start = performance.now();
      const actions = await gameEngine.getAvailableActions(player);
      const end = performance.now();

      const adjustActions = actions.filter(a => 
        a.id === 'intimacy:adjust_clothing'
      );

      expect(adjustActions.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(1000); // < 1 second for 50 NPCs
    });
  });
});
```

## Testing Strategy

### Unit Test Coverage
1. **Scope Interpreter Context**: Target context access and resolution
2. **Context Builder**: Proper context construction for dependencies
3. **Error Handling**: Missing context, invalid references, malformed expressions
4. **Performance**: Large target sets, repeated evaluations, caching

### Integration Test Coverage
1. **Two-Level Dependencies**: Primary → Secondary resolution
2. **Three-Level Dependencies**: Primary → Secondary → Tertiary chains
3. **Error Recovery**: Broken chains, missing targets, invalid scopes
4. **Performance**: Large dependency chains, many potential targets

### End-to-End Test Coverage
1. **Real Gameplay**: Actual game scenarios with dependent actions
2. **Complex Interactions**: Multi-character, multi-item scenarios
3. **Edge Cases**: Skill requirements, trust levels, equipment states
4. **Performance**: Large social gatherings, complex environments

## Acceptance Criteria

1. ✅ Basic two-level dependencies resolve correctly
2. ✅ Multi-level dependency chains work properly  
3. ✅ Missing context handled gracefully without errors
4. ✅ Invalid references return empty results, not exceptions
5. ✅ Performance targets met for large target sets
6. ✅ Context caching improves repeated evaluation performance
7. ✅ Integration tests validate real action scenarios
8. ✅ End-to-end tests demonstrate gameplay functionality
9. ✅ Error conditions recover gracefully
10. ✅ All test categories achieve >95% coverage

## Performance Benchmarks

- Simple dependency resolution: < 10ms
- Complex three-level chains: < 50ms
- Large target sets (100+ items): < 100ms
- Repeated context access: < 1ms (cached)
- Full action processing with dependencies: < 200ms

## Documentation Requirements

### Test Documentation
- Dependency resolution flow explanations
- Context building strategies and patterns
- Performance optimization techniques
- Error handling and recovery procedures

### Developer Documentation
- Debugging tools for dependency issues
- Performance profiling for dependency chains
- Best practices for complex dependencies
- Testing patterns for new dependency types

## Future Testing Enhancements

1. **Stress Testing**: Very large dependency networks
2. **Concurrency Testing**: Parallel dependency resolution
3. **Mutation Testing**: Verify test quality through code mutation
4. **Property-Based Testing**: Generate random dependency structures
5. **Visual Testing**: Dependency graph visualization for debugging