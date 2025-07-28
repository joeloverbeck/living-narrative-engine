/**
 * @file Integration tests for MultiTargetActionFormatter
 * @see src/actions/formatters/MultiTargetActionFormatter.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { MultiTargetActionFormatter } from '../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ActionFormatter from '../../../../src/actions/actionFormatter.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { ActionTargetContext } from '../../../../src/models/actionTargetContext.js';
import {
  createTestAction,
  createComplexTestAction,
} from '../../../common/actions/actionBuilderHelpers.js';

describe('MultiTargetActionFormatter - Integration Tests', () => {
  let formatter;
  let baseFormatter;
  let logger;
  let testBed;
  let entityManager;
  let actor;

  beforeEach(async () => {
    // Setup test bed with real entity manager
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    // Create logger
    logger = new ConsoleLogger({ enableDebug: false });
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();

    // Create base formatter with proper target formatter map
    const targetFormatterMap = {
      none: (command) => ({ ok: true, value: command }),
      self: (command) => ({
        ok: true,
        value: command.replace('{target}', 'yourself'),
      }),
      entity: (command, targetContext, deps) => {
        const { entityManager, displayNameFn } = deps;
        const entity = entityManager.getEntityInstance(targetContext.entityId);
        if (!entity) {
          return {
            ok: false,
            error: `Entity not found: ${targetContext.entityId}`,
          };
        }
        const name = displayNameFn(entity) || entity.id;
        return { ok: true, value: command.replace('{target}', name) };
      },
    };

    baseFormatter = new ActionFormatter();

    // Create multi-target formatter
    formatter = new MultiTargetActionFormatter(baseFormatter, logger);

    // Create test actor
    const actorDef = new EntityDefinition('test:actor', {
      description: 'Test actor entity',
      components: {
        'core:name': { value: 'Test Actor' },
        'core:actor': { name: 'Test Actor' },
        'core:inventory': { items: [] },
      },
    });
    testBed.setupDefinitions(actorDef);
    actor = await testBed.entityManager.createEntityInstance('test:actor', {
      instanceId: 'test-actor',
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Real Entity Integration', () => {
    it('should format multi-target actions with real entities and components', async () => {
      // Create weapon entity
      const swordDef = new EntityDefinition('test:sword', {
        description: 'Test sword entity',
        components: {
          'core:name': { value: 'Iron Sword' },
          'core:item': {
            type: 'weapon',
            weight: 3.5,
            value: 100,
          },
          'core:weapon': {
            damage: 10,
            damageType: 'slashing',
          },
        },
      });

      // Create enemy entity
      const goblinDef = new EntityDefinition('test:goblin', {
        description: 'Test goblin entity',
        components: {
          'core:name': { value: 'Goblin Warrior' },
          'core:actor': {
            name: 'Goblin Warrior',
            health: 50,
            maxHealth: 50,
          },
          'core:combat': {
            attackBonus: 2,
            armorClass: 12,
          },
        },
      });

      testBed.setupDefinitions(swordDef, goblinDef);

      const sword = await testBed.entityManager.createEntityInstance(
        'test:sword',
        {
          instanceId: 'sword-001',
        }
      );
      const goblin = await testBed.entityManager.createEntityInstance(
        'test:goblin',
        {
          instanceId: 'goblin-001',
        }
      );

      // Add sword to actor's inventory
      await entityManager.addComponent('test-actor', 'core:inventory', {
        items: ['sword-001'],
      });

      const actionDef = {
        id: 'combat:throw',
        name: 'Throw',
        template: 'throw {item} at {target}',
        targets: {
          primary: { scope: 'actor.inventory[]', placeholder: 'item' },
          secondary: { scope: 'location.actors[]', placeholder: 'target' },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'sword-001', displayName: 'Iron Sword' }],
        secondary: [{ id: 'goblin-001', displayName: 'Goblin Warrior' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('throw Iron Sword at Goblin Warrior');
    });

    it('should handle multiple entity types with complex relationships', async () => {
      // Create container entity
      const chestDef = new EntityDefinition('test:chest', {
        description: 'Test chest entity',
        components: {
          'core:name': { value: 'Wooden Chest' },
          'core:container': {
            items: [],
            capacity: 10,
            isOpen: false,
          },
        },
      });

      // Create key entity
      const keyDef = new EntityDefinition('test:key', {
        description: 'Test key entity',
        components: {
          'core:name': { value: 'Iron Key' },
          'core:item': {
            type: 'misc',
            weight: 0.1,
            value: 5,
          },
          'core:key': {
            keyId: 'chest-key-001',
            description: 'A key that opens wooden chests',
          },
        },
      });

      testBed.setupDefinitions(chestDef, keyDef);

      const chest = await testBed.entityManager.createEntityInstance(
        'test:chest',
        {
          instanceId: 'chest-001',
        }
      );
      const key = await testBed.entityManager.createEntityInstance('test:key', {
        instanceId: 'key-001',
      });

      const actionDef = {
        id: 'interact:unlock',
        name: 'Unlock',
        template: 'unlock {container} with {key}',
        targets: {
          primary: { scope: 'location.containers[]', placeholder: 'container' },
          secondary: {
            scope: 'actor.inventory[].hasComponent("core:key")',
            placeholder: 'key',
          },
        },
      };

      const resolvedTargets = {
        primary: [{ id: 'chest-001', displayName: 'Wooden Chest' }],
        secondary: [{ id: 'key-001', displayName: 'Iron Key' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'container' },
        secondary: { placeholder: 'key' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('unlock Wooden Chest with Iron Key');
    });

    it('should generate combinations for entities with relationships', async () => {
      // Create multiple items
      const rockDef = new EntityDefinition('test:rock', {
        description: 'Test rock entity',
        components: {
          'core:name': { value: 'Small Rock' },
          'core:item': { type: 'misc', weight: 0.5 },
        },
      });

      const knifeDef = new EntityDefinition('test:knife', {
        description: 'Test knife entity',
        components: {
          'core:name': { value: 'Throwing Knife' },
          'core:item': { type: 'weapon', weight: 0.3 },
        },
      });

      // Create multiple targets
      const orcDef = new EntityDefinition('test:orc', {
        description: 'Test orc entity',
        components: {
          'core:name': { value: 'Orc Brute' },
          'core:actor': { name: 'Orc Brute' },
        },
      });

      testBed.setupDefinitions(rockDef, knifeDef, orcDef);

      const rock = await testBed.entityManager.createEntityInstance(
        'test:rock',
        {
          instanceId: 'rock-001',
        }
      );
      const knife = await testBed.entityManager.createEntityInstance(
        'test:knife',
        {
          instanceId: 'knife-001',
        }
      );
      const orc = await testBed.entityManager.createEntityInstance('test:orc', {
        instanceId: 'orc-001',
      });

      const actionDef = {
        id: 'combat:multi_throw',
        name: 'Multi Throw',
        template: 'throw {item} at {target}',
        generateCombinations: true,
        targets: {
          primary: { scope: 'actor.inventory[]', placeholder: 'item' },
          secondary: { scope: 'location.actors[]', placeholder: 'target' },
        },
      };

      const resolvedTargets = {
        primary: [
          { id: 'rock-001', displayName: 'Small Rock' },
          { id: 'knife-001', displayName: 'Throwing Knife' },
        ],
        secondary: [
          { id: 'orc-001', displayName: 'Orc Brute' },
          { id: 'goblin-001', displayName: 'Goblin Warrior' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value).toContain('throw Small Rock at Orc Brute');
      expect(result.value).toContain('throw Throwing Knife at Orc Brute');
    });
  });

  describe('Error Handling with Real Entities', () => {
    it('should handle missing entities gracefully', async () => {
      const actionDef = {
        id: 'test:missing_entity',
        name: 'Missing Entity Action',
        template: 'use {item} on {target}',
      };

      const resolvedTargets = {
        primary: [{ id: 'non-existent-item', displayName: 'Missing Item' }],
        secondary: [
          { id: 'non-existent-target', displayName: 'Missing Target' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      // Should still format successfully using display names
      expect(result.ok).toBe(true);
      expect(result.value).toBe('use Missing Item on Missing Target');
    });

    it('should handle entities with missing components', async () => {
      // Create entity without name component
      const brokenDef = new EntityDefinition('test:broken', {
        description: 'Test broken entity',
        components: {
          // No name component
          'core:item': { type: 'misc' },
        },
      });

      testBed.setupDefinitions(brokenDef);

      const broken = await testBed.entityManager.createEntityInstance(
        'test:broken',
        {
          instanceId: 'broken-001',
        }
      );

      const actionDef = {
        id: 'test:use_broken',
        name: 'Use Broken',
        template: 'use {item}',
      };

      const resolvedTargets = {
        primary: [{ id: 'broken-001' }], // No display name
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      // Should use entity ID as fallback
      expect(result.ok).toBe(true);
      expect(result.value).toBe('use broken-001');
    });

    it('should handle formatter exceptions and log errors', async () => {
      const actionDef = {
        id: 'test:error_action',
        name: 'Error Action',
        template: 'error {item}',
      };

      // Pass invalid resolved targets structure to trigger error
      const invalidResolvedTargets = null;

      const result = formatter.formatMultiTarget(
        actionDef,
        invalidResolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions: {} }
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Multi-target formatting failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Error in multi-target formatting:',
        expect.any(Error)
      );
    });

    it('should handle circular entity references', async () => {
      // Create entities with circular references
      const containerDef = new EntityDefinition('test:container', {
        description: 'Container that contains itself',
        components: {
          'core:name': { value: 'Strange Box' },
          'core:container': { items: [] },
        },
      });

      testBed.setupDefinitions(containerDef);

      const container1 = await testBed.entityManager.createEntityInstance(
        'test:container',
        {
          instanceId: 'container-001',
        }
      );
      const container2 = await testBed.entityManager.createEntityInstance(
        'test:container',
        {
          instanceId: 'container-002',
        }
      );

      // Create circular reference
      await entityManager.addComponent('container-001', 'core:container', {
        items: ['container-002'],
      });
      await entityManager.addComponent('container-002', 'core:container', {
        items: ['container-001'],
      });

      const actionDef = {
        id: 'test:move',
        name: 'Move',
        template: 'move {item} to {container}',
      };

      const resolvedTargets = {
        primary: [{ id: 'container-001', displayName: 'Strange Box' }],
        secondary: [{ id: 'container-002', displayName: 'Strange Box' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'container' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      // Should still format successfully
      expect(result.ok).toBe(true);
      expect(result.value).toBe('move Strange Box to Strange Box');
    });
  });

  describe('Placeholder Fallback Logic', () => {
    it('should use correct fallback placeholders for primary targets', async () => {
      const actionDef = {
        id: 'test:primary_fallback',
        name: 'Primary Fallback',
        template: 'activate {item} and {object} with {thing}',
      };

      const resolvedTargets = {
        primary: [{ id: 'entity-001', displayName: 'Test Entity' }],
      };

      // No placeholder defined - should use 'item' first
      const targetDefinitions = {
        primary: {}, // No placeholder
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe(
        'activate Test Entity and {object} with {thing}'
      );
    });

    it('should use correct fallback placeholders for secondary targets', async () => {
      const actionDef = {
        id: 'test:secondary_fallback',
        name: 'Secondary Fallback',
        template: 'send {message} to {target} at {destination} for {recipient}',
      };

      const resolvedTargets = {
        primary: [{ id: 'msg-001', displayName: 'Message' }],
        secondary: [{ id: 'person-001', displayName: 'Person' }],
      };

      // No placeholder defined for secondary - should use 'target' first
      const targetDefinitions = {
        primary: { placeholder: 'message' },
        secondary: {}, // No placeholder
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe(
        'send Message to Person at {destination} for {recipient}'
      );
    });

    it('should handle templates with no standard placeholders', async () => {
      const actionDef = {
        id: 'test:non_standard',
        name: 'Non Standard',
        template: 'configure {widget} using {gizmo}',
      };

      const resolvedTargets = {
        primary: [{ id: 'widget-001', displayName: 'Widget A' }],
        secondary: [{ id: 'gizmo-001', displayName: 'Gizmo B' }],
      };

      // No placeholders defined - should use first available for primary, second for secondary
      const targetDefinitions = {
        primary: {},
        secondary: {},
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('configure Widget A using Gizmo B');
    });

    it('should handle complex placeholder scenarios with entity lookup', async () => {
      // Create real entities
      const toolDef = new EntityDefinition('test:tool', {
        description: 'Test tool entity',
        components: {
          'core:name': { value: 'Hammer' },
          'core:item': { type: 'tool' },
        },
      });

      const materialDef = new EntityDefinition('test:material', {
        description: 'Test material entity',
        components: {
          'core:name': { value: 'Iron Ingot' },
          'core:item': { type: 'material' },
        },
      });

      testBed.setupDefinitions(toolDef, materialDef);

      await testBed.entityManager.createEntityInstance('test:tool', {
        instanceId: 'tool-001',
      });
      await testBed.entityManager.createEntityInstance('test:material', {
        instanceId: 'material-001',
      });

      const actionDef = {
        id: 'craft:forge',
        name: 'Forge',
        template: 'forge {material} using {tool} at {station}',
      };

      const resolvedTargets = {
        primary: [{ id: 'material-001', displayName: 'Iron Ingot' }],
        secondary: [{ id: 'tool-001', displayName: 'Hammer' }],
        tertiary: [{ id: 'forge-001', displayName: 'Forge' }],
      };

      // Mix of defined and undefined placeholders
      const targetDefinitions = {
        primary: { placeholder: 'material' },
        secondary: {}, // No placeholder - should use 'tool'
        tertiary: { placeholder: 'station' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('forge Iron Ingot using Hammer at Forge');
    });
  });

  describe('Combination Generation Edge Cases', () => {
    it('should handle large numbers of combinations efficiently', async () => {
      // Create many entities
      const itemDefs = [];
      const targetDefs = [];

      for (let i = 0; i < 15; i++) {
        itemDefs.push(
          new EntityDefinition(`test:item${i}`, {
            description: `Test item ${i}`,
            components: {
              'core:name': { value: `Item ${i}` },
            },
          })
        );
      }

      for (let i = 0; i < 15; i++) {
        targetDefs.push(
          new EntityDefinition(`test:target${i}`, {
            description: `Test target ${i}`,
            components: {
              'core:name': { value: `Target ${i}` },
            },
          })
        );
      }

      testBed.setupDefinitions(...itemDefs, ...targetDefs);

      // Create entity instances
      const itemIds = [];
      const targetIds = [];

      for (let i = 0; i < 15; i++) {
        const item = await testBed.entityManager.createEntityInstance(
          `test:item${i}`,
          {
            instanceId: `item-${i}`,
          }
        );
        itemIds.push(`item-${i}`);
      }

      for (let i = 0; i < 15; i++) {
        const target = await testBed.entityManager.createEntityInstance(
          `test:target${i}`,
          {
            instanceId: `target-${i}`,
          }
        );
        targetIds.push(`target-${i}`);
      }

      const actionDef = {
        id: 'test:mass_combination',
        name: 'Mass Combination',
        template: 'use {item} on {target}',
        generateCombinations: true,
      };

      const resolvedTargets = {
        primary: itemIds.map((id, i) => ({ id, displayName: `Item ${i}` })),
        secondary: targetIds.map((id, i) => ({
          id,
          displayName: `Target ${i}`,
        })),
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const startTime = Date.now();
      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );
      const endTime = Date.now();

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Should respect the 50 combination limit
      expect(result.value.length).toBeLessThanOrEqual(50);
      // Should be processed efficiently
      expect(endTime - startTime).toBeLessThan(100); // Less than 100ms
    });

    it('should handle combinations with three or more target types', async () => {
      const actionDef = {
        id: 'test:triple_combination',
        name: 'Triple Combination',
        template: 'combine {item1} with {item2} using {tool}',
        generateCombinations: true,
      };

      const resolvedTargets = {
        primary: [
          { id: 'item1-001', displayName: 'Red Gem' },
          { id: 'item1-002', displayName: 'Blue Gem' },
        ],
        secondary: [
          { id: 'item2-001', displayName: 'Gold Dust' },
          { id: 'item2-002', displayName: 'Silver Dust' },
        ],
        tertiary: [
          { id: 'tool-001', displayName: 'Mortar' },
          { id: 'tool-002', displayName: 'Pestle' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item1' },
        secondary: { placeholder: 'item2' },
        tertiary: { placeholder: 'tool' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Should generate combinations with first item from each remaining type
      expect(result.value).toContain(
        'combine Red Gem with Gold Dust using Mortar'
      );
      expect(result.value).toContain(
        'combine Blue Gem with Gold Dust using Mortar'
      );
    });

    it('should handle empty target arrays in multi-type combinations', async () => {
      const actionDef = {
        id: 'test:partial_combination',
        name: 'Partial Combination',
        template: 'process {input} through {processor} to {output}',
        generateCombinations: true,
      };

      const resolvedTargets = {
        primary: [{ id: 'input-001', displayName: 'Raw Material' }],
        secondary: [], // Empty array
        tertiary: [{ id: 'output-001', displayName: 'Container' }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'input' },
        secondary: { placeholder: 'processor' },
        tertiary: { placeholder: 'output' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Should not generate combinations when required targets have no candidates
      expect(result.value.length).toBe(0);
    });

    it('should handle single target type combinations correctly', async () => {
      const actionDef = {
        id: 'test:single_type',
        name: 'Single Type',
        template: 'examine {item}',
        generateCombinations: true,
      };

      const resolvedTargets = {
        primary: [
          { id: 'item-001', displayName: 'Ancient Scroll' },
          { id: 'item-002', displayName: 'Mysterious Orb' },
          { id: 'item-003', displayName: 'Golden Key' },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(3);
      expect(result.value).toContain('examine Ancient Scroll');
      expect(result.value).toContain('examine Mysterious Orb');
      expect(result.value).toContain('examine Golden Key');
    });

    it('should respect maxCombinations limit exactly at boundary', async () => {
      const actionDef = {
        id: 'test:boundary_test',
        name: 'Boundary Test',
        template: 'test {item}',
        generateCombinations: true,
      };

      // Create exactly 51 items to test the 50 limit boundary
      const resolvedTargets = {
        primary: Array.from({ length: 51 }, (_, i) => ({
          id: `item-${i}`,
          displayName: `Item ${i}`,
        })),
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(50); // Should be exactly 50, not 51
      expect(result.value[0]).toBe('test Item 0');
      expect(result.value[49]).toBe('test Item 49');
      // Item 50 should not be included
      expect(result.value).not.toContain('test Item 50');
    });
  });

  describe('Integration with Display Name Functions', () => {
    it('should work with custom display name functions', async () => {
      // Create entity with complex naming
      const npcDef = new EntityDefinition('test:npc', {
        description: 'Test NPC entity',
        components: {
          'core:name': { value: 'John' },
          'core:actor': {
            name: 'John',
            title: 'the Blacksmith',
            level: 5,
          },
        },
      });

      testBed.setupDefinitions(npcDef);

      const npc = await testBed.entityManager.createEntityInstance('test:npc', {
        instanceId: 'npc-001',
      });

      const actionDef = {
        id: 'social:greet',
        name: 'Greet',
        template: 'greet {target}',
      };

      // Custom display name function that includes title
      const customDisplayNameFn = (entity) => {
        if (!entity) return 'Unknown';
        const nameData = entity.getComponentData('core:name');
        const actorData = entity.getComponentData('core:actor');
        if (actorData?.title) {
          return `${nameData?.value || entity.id} ${actorData.title}`;
        }
        return nameData?.value || entity.id;
      };

      const resolvedTargets = {
        primary: [{ id: 'npc-001', displayName: customDisplayNameFn(npc) }],
      };

      const targetDefinitions = {
        primary: { placeholder: 'target' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions, displayNameFn: customDisplayNameFn }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('greet John the Blacksmith');
    });

    it('should handle entities with special characters in names', async () => {
      const specialDef = new EntityDefinition('test:special', {
        description: 'Test special entity',
        components: {
          'core:name': { value: 'The "Cursed" Blade & Soul\'s Edge' },
        },
      });

      testBed.setupDefinitions(specialDef);

      const special = await testBed.entityManager.createEntityInstance(
        'test:special',
        {
          instanceId: 'special-001',
        }
      );

      const actionDef = {
        id: 'test:wield',
        name: 'Wield',
        template: 'wield {weapon}',
      };

      const resolvedTargets = {
        primary: [
          {
            id: 'special-001',
            displayName: 'The "Cursed" Blade & Soul\'s Edge',
          },
        ],
      };

      const targetDefinitions = {
        primary: { placeholder: 'weapon' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      expect(result.ok).toBe(true);
      expect(result.value).toBe('wield The "Cursed" Blade & Soul\'s Edge');
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle memory efficiently with large entity sets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create a moderate number of entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        const def = new EntityDefinition(`test:perf${i}`, {
          description: `Performance test entity ${i}`,
          components: {
            'core:name': { value: `Entity ${i}` },
          },
        });
        testBed.setupDefinitions(def);
        const entity = await testBed.entityManager.createEntityInstance(
          `test:perf${i}`,
          {
            instanceId: `perf-${i}`,
          }
        );
        entities.push(entity);
      }

      const actionDef = {
        id: 'test:performance',
        name: 'Performance Test',
        template: 'process {item}',
        generateCombinations: true,
      };

      const resolvedTargets = {
        primary: entities.slice(0, 50).map((e, i) => ({
          id: e.id,
          displayName: `Entity ${i}`,
        })),
      };

      const targetDefinitions = {
        primary: { placeholder: 'item' },
      };

      const result = formatter.formatMultiTarget(
        actionDef,
        resolvedTargets,
        entityManager,
        { debug: true },
        { targetDefinitions }
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});
