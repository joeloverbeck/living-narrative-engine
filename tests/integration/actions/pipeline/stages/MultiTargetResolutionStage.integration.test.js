/**
 * @file Integration tests for refactored MultiTargetResolutionStage
 * @see src/actions/pipeline/stages/MultiTargetResolutionStage.js
 * @description Integration tests validating that the refactored MultiTargetResolutionStage
 * integrates correctly with real pipeline components and maintains all functionality.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMultiTargetResolutionStage } from '../../../../common/actions/multiTargetStageTestUtilities.js';
import { EntityManagerTestBed } from '../../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../../src/entities/entityDefinition.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';

describe('MultiTargetResolutionStage - Integration Tests', () => {
  let stage;
  let entityTestBed;
  let entityManager;
  let unifiedScopeResolver;
  let targetResolver;
  let logger;

  beforeEach(async () => {
    // Setup logger
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.info = jest.fn();

    // Setup entity manager test bed
    entityTestBed = new EntityManagerTestBed();
    entityManager = entityTestBed.entityManager;

    // Create unified scope resolver mock
    unifiedScopeResolver = {
      resolve: jest.fn(),
    };

    // Create target resolver mock
    targetResolver = {
      resolveTargets: jest.fn(),
    };

    // Create the stage using the test utility
    stage = createMultiTargetResolutionStage({
      entityManager: entityTestBed.entityManager,
      logger,
      unifiedScopeResolver,
      targetResolver,
    });
  });

  afterEach(() => {
    entityTestBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Pipeline Integration', () => {
    it('should integrate with real EntityManager for target resolution', async () => {
      // Create location entity
      const locationDef = new EntityDefinition('test:location', {
        description: 'Test location',
        components: {
          'core:name': { text: 'Test Room' },
          'core:location': { name: 'Test Room' },
        },
      });

      // Create actor entity
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Hero' },
          'core:actor': { name: 'Hero', health: 100 },
          'core:inventory': { items: ['item-001'] },
          'core:position': { locationId: 'location-001' },
        },
      });

      // Create item entity
      const itemDef = new EntityDefinition('test:item', {
        description: 'Test item',
        components: {
          'core:name': { text: 'Sword' },
          'core:item': { type: 'weapon', weight: 5 },
        },
      });

      entityTestBed.setupDefinitions(locationDef, actorDef, itemDef);

      // Create entities
      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'actor-001',
      });
      await entityManager.createEntityInstance('test:item', {
        instanceId: 'item-001',
      });

      // Setup scope resolver to return the item
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item-001']))
      );

      // Create action definition
      const actionDef = {
        id: 'test:use',
        name: 'Use Item',
        template: 'use {item}',
        targets: {
          primary: {
            scope: 'actor.inventory.items[]',
            placeholder: 'item',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Verify integration worked correctly
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.actionDef).toBe(actionDef);
      expect(actionWithTargets.targetContexts).toHaveLength(1);
      expect(actionWithTargets.targetContexts[0]).toEqual({
        type: 'entity',
        entityId: 'item-001',
        displayName: 'Sword',
        placeholder: 'item',
      });

      // Verify unified scope resolver was called correctly
      expect(unifiedScopeResolver.resolve).toHaveBeenCalledTimes(1);
      expect(unifiedScopeResolver.resolve).toHaveBeenCalledWith(
        'actor.inventory.items[]',
        expect.any(Object),
        expect.any(Object)
      );

      // Verify the context has the correct actor structure
      const actualCall = unifiedScopeResolver.resolve.mock.calls[0];
      expect(actualCall[1]).toHaveProperty('actor');
      expect(actualCall[1].actor).toHaveProperty('id', 'actor-001');
      expect(actualCall[1].actor).toHaveProperty('components');
    });

    it('should handle legacy action format through LegacyTargetCompatibilityLayer', async () => {
      // Create actor
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });

      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock legacy target resolver
      targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'player-001', displayName: 'Player' }],
      });

      // Legacy action format
      const legacyActionDef = {
        id: 'test:examine_self',
        name: 'Examine Self',
        template: 'examine yourself',
        targets: 'self', // Legacy string format
      };

      const context = {
        candidateActions: [legacyActionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Verify legacy compatibility
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.actionDef).toBe(legacyActionDef);
      expect(actionWithTargets.targetContexts).toHaveLength(1);
      expect(actionWithTargets.targetContexts[0].entityId).toBe('player-001');

      // Verify legacy target resolver was called
      expect(targetResolver.resolveTargets).toHaveBeenCalled();
    });

    it('should handle complex multi-target dependencies with ScopeContextBuilder', async () => {
      // Create location entity
      const locationDef = new EntityDefinition('test:location', {
        description: 'Test location',
        components: {
          'core:name': { text: 'Test Room' },
          'core:location': { name: 'Test Room' },
        },
      });

      // Create container and key entities
      const containerDef = new EntityDefinition('test:container', {
        description: 'Test container',
        components: {
          'core:name': { text: 'Chest' },
          'core:container': { locked: true, items: [] },
        },
      });

      const keyDef = new EntityDefinition('test:key', {
        description: 'Test key',
        components: {
          'core:name': { text: 'Chest Key' },
          'core:item': { type: 'key' },
        },
      });

      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Player' },
          'core:actor': { name: 'Player' },
          'core:inventory': { items: ['key-001'] },
          'core:position': { locationId: 'location-001' },
        },
      });

      entityTestBed.setupDefinitions(
        locationDef,
        containerDef,
        keyDef,
        actorDef
      );

      // Create entities
      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });
      await entityManager.createEntityInstance('test:container', {
        instanceId: 'chest-001',
      });
      await entityManager.createEntityInstance('test:key', {
        instanceId: 'key-001',
      });

      // Setup scope resolver for dependent targets
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['chest-001']))) // container
        .mockResolvedValueOnce(ActionResult.success(new Set(['key-001']))); // key

      // Multi-target action with dependencies
      const actionDef = {
        id: 'test:unlock',
        name: 'Unlock Container',
        template: 'unlock {container} with {key}',
        targets: {
          container: {
            scope: 'location.containers',
            placeholder: 'container',
          },
          key: {
            scope: 'actor.inventory.items[type="key"]',
            placeholder: 'key',
            contextFrom: 'container', // Key depends on container context
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Verify multi-target dependency resolution
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(2);

      // Verify container target
      const containerTarget = actionWithTargets.targetContexts.find(
        (tc) => tc.placeholder === 'container'
      );
      expect(containerTarget).toEqual({
        type: 'entity',
        entityId: 'chest-001',
        displayName: 'Chest',
        placeholder: 'container',
      });

      // Verify key target
      const keyTarget = actionWithTargets.targetContexts.find(
        (tc) => tc.placeholder === 'key'
      );
      expect(keyTarget).toEqual({
        type: 'entity',
        entityId: 'key-001',
        displayName: 'Chest Key',
        placeholder: 'key',
      });

      // Verify resolved targets structure
      expect(result.data.resolvedTargets).toEqual({
        container: [
          {
            id: 'chest-001',
            displayName: 'Chest',
            entity: expect.any(Object),
          },
        ],
        key: [
          {
            id: 'key-001',
            displayName: 'Chest Key',
            entity: expect.any(Object),
            contextFromId: 'chest-001',
          },
        ],
      });
    });

    it('should maintain error handling and validation through pipeline', async () => {
      // Create location entity
      const locationDef = new EntityDefinition('test:location', {
        description: 'Test location',
        components: {
          'core:name': { text: 'Test Room' },
          'core:location': { name: 'Test Room' },
        },
      });

      // Create actor
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Player' },
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'location-001' },
        },
      });

      entityTestBed.setupDefinitions(locationDef, actorDef);

      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Mock scope resolver to return failure
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.failure({
          error: 'Invalid scope syntax',
          details: 'Cannot parse scope expression',
        })
      );

      const actionDef = {
        id: 'test:invalid',
        name: 'Invalid Action',
        template: 'invalid action',
        targets: {
          primary: {
            scope: 'invalid..scope..syntax',
            placeholder: 'target',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Verify error handling
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0); // No actions due to error

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve scope'),
        expect.any(Array)
      );
    });

    it('should handle circular dependencies through TargetDependencyResolver', async () => {
      // Create actor
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Player' },
          'core:actor': { name: 'Player' },
        },
      });

      entityTestBed.setupDefinitions(actorDef);
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Action with circular dependency
      const actionDef = {
        id: 'test:circular',
        name: 'Circular Test',
        template: 'test {a} and {b}',
        targets: {
          a: {
            scope: 'test.a',
            placeholder: 'a',
            contextFrom: 'b', // a depends on b
          },
          b: {
            scope: 'test.b',
            placeholder: 'b',
            contextFrom: 'a', // b depends on a - circular!
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Verify circular dependency handling
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0); // No actions due to circular dependency

      // The TargetDependencyResolver should have detected the circular dependency
      // and excluded the action from processing
    });

    it('should preserve backward compatibility in result structure', async () => {
      // Create location entity
      const locationDef = new EntityDefinition('test:location', {
        description: 'Test location',
        components: {
          'core:name': { text: 'Test Room' },
          'core:location': { name: 'Test Room' },
        },
      });

      // Create simple test entities
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Player' },
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'location-001' },
        },
      });

      entityTestBed.setupDefinitions(locationDef, actorDef);

      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['player-001']))
      );

      const actionDef = {
        id: 'test:simple',
        name: 'Simple Action',
        template: 'examine {target}',
        targets: {
          primary: {
            scope: 'self',
            placeholder: 'target',
          },
        },
      };

      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Verify backward compatibility fields are present
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('actionsWithTargets');
      expect(result.data).toHaveProperty('targetContexts');
      expect(result.data).toHaveProperty('resolvedTargets');
      expect(result.data).toHaveProperty('targetDefinitions');

      // Verify structure matches expected format
      expect(result.data.targetContexts).toHaveLength(1);
      expect(result.data.resolvedTargets.primary).toHaveLength(1);
      expect(result.data.targetDefinitions).toEqual(actionDef.targets);

      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.actionDef).toBe(actionDef);
      expect(actionWithTargets.targetContexts).toHaveLength(1);
    });

    it('should handle performance requirements with multiple actions', async () => {
      // Create location entity
      const locationDef = new EntityDefinition('test:location', {
        description: 'Test location',
        components: {
          'core:name': { text: 'Test Room' },
          'core:location': { name: 'Test Room' },
        },
      });

      // Create actor
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Player' },
          'core:actor': { name: 'Player' },
          'core:position': { locationId: 'location-001' },
        },
      });

      entityTestBed.setupDefinitions(locationDef, actorDef);

      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });

      // Create multiple candidate actions
      const candidateActions = [];
      for (let i = 0; i < 10; i++) {
        candidateActions.push({
          id: `test:action${i}`,
          name: `Action ${i}`,
          template: `perform action ${i}`,
          targets: {
            primary: {
              scope: 'self',
              placeholder: 'target',
            },
          },
        });
      }

      // Mock scope resolver for all actions
      unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['player-001']))
      );

      const context = {
        candidateActions,
        actor,
        actionContext: { actor },
        data: {},
      };

      const startTime = Date.now();
      const result = await stage.executeInternal(context);
      const duration = Date.now() - startTime;

      // Verify performance
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(10);
      expect(duration).toBeLessThan(100); // Should process 10 actions in <100ms

      // Verify all actions were processed correctly
      result.data.actionsWithTargets.forEach((actionWithTargets, index) => {
        expect(actionWithTargets.actionDef.id).toBe(`test:action${index}`);
        expect(actionWithTargets.targetContexts).toHaveLength(1);
      });
    });
  });

  describe('Service Integration Validation', () => {
    it('should use all decomposed services correctly', async () => {
      // Create location entity
      const locationDef = new EntityDefinition('test:location', {
        description: 'Test location',
        components: {
          'core:name': { text: 'Test Room' },
          'core:location': { name: 'Test Room' },
        },
      });

      // This test validates that all decomposed services are working together
      const actorDef = new EntityDefinition('test:actor', {
        description: 'Test actor',
        components: {
          'core:name': { text: 'Player' },
          'core:actor': { name: 'Player' },
          'core:inventory': { items: ['item-001'] },
          'core:position': { locationId: 'location-001' },
        },
      });

      const itemDef = new EntityDefinition('test:item', {
        description: 'Test item',
        components: {
          'core:name': { text: 'Magic Wand' },
          'core:item': { type: 'weapon', magical: true },
        },
      });

      entityTestBed.setupDefinitions(locationDef, actorDef, itemDef);

      await entityManager.createEntityInstance('test:location', {
        instanceId: 'location-001',
      });
      const actor = await entityManager.createEntityInstance('test:actor', {
        instanceId: 'player-001',
      });
      await entityManager.createEntityInstance('test:item', {
        instanceId: 'item-001',
      });

      // Complex action that exercises all services
      const complexActionDef = {
        id: 'test:complex_spell',
        name: 'Cast Complex Spell',
        template: 'cast {spell} using {focus} targeting {target}',
        targets: {
          focus: {
            scope: 'actor.inventory.items[magical=true]',
            placeholder: 'focus',
            description: 'Magical focus item',
          },
          target: {
            scope: 'location.actors[!=actor]',
            placeholder: 'target',
            description: 'Target for spell',
            contextFrom: 'focus', // Depends on focus
            optional: true,
          },
          spell: {
            scope: 'focus.spells[]',
            placeholder: 'spell',
            description: 'Available spells',
            contextFrom: 'focus', // Depends on focus
            optional: true,
          },
        },
      };

      // Mock scope resolutions
      unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['item-001']))) // focus
        .mockResolvedValueOnce(ActionResult.success(new Set())) // target (empty)
        .mockResolvedValueOnce(ActionResult.success(new Set())); // spell (empty)

      const context = {
        candidateActions: [complexActionDef],
        actor,
        actionContext: { actor },
        data: {},
      };

      const result = await stage.executeInternal(context);

      // Verify all services worked together
      expect(result.success).toBe(true);

      // The action should be processed but may have limited targets due to empty scopes
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.actionDef).toBe(complexActionDef);

      // At least the focus target should be resolved
      expect(actionWithTargets.targetContexts.length).toBeGreaterThan(0);

      const focusTarget = actionWithTargets.targetContexts.find(
        (tc) => tc.placeholder === 'focus'
      );
      expect(focusTarget).toBeDefined();
      expect(focusTarget.entityId).toBe('item-001');
      expect(focusTarget.displayName).toBe('Magic Wand');

      // Verify TargetDependencyResolver determined correct resolution order
      // (focus should be resolved before target and spell since they depend on it)
      expect(unifiedScopeResolver.resolve).toHaveBeenCalledTimes(3);

      // First call should be for the independent target (focus)
      expect(unifiedScopeResolver.resolve.mock.calls[0][0]).toBe(
        'actor.inventory.items[magical=true]'
      );
    });
  });
});
