/**
 * @file Integration tests for ContextAssemblyService with real entity data
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import ContextAssemblyError from '../../../src/goap/errors/contextAssemblyError.js';

describe('ContextAssemblyService - Integration', () => {
  let service;
  let entityManager;
  let logger;

  beforeEach(() => {
    const testBed = createTestBed();
    entityManager = new SimpleEntityManager();
    logger = testBed.createMockLogger();

    service = new ContextAssemblyService({
      entityManager,
      logger,
    });
  });

  describe('assemblePlanningContext with real entities', () => {
    it('should assemble context for actor with multiple components', () => {
      // Create actor with multiple components
      const actorId = 'hero-123';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Hero', level: 5 });
      entityManager.addComponent(actorId, 'core:position', { location: 'tavern-1', x: 10, y: 20 });
      entityManager.addComponent(actorId, 'core:health', { current: 80, max: 100 });
      entityManager.addComponent(actorId, 'core:inventory', { items: ['sword-1', 'potion-1'], maxWeight: 50 });

      const context = service.assemblePlanningContext(actorId);

      expect(context.actor.id).toBe(actorId);
      expect(context.actor.components['core:actor']).toEqual({
        name: 'Hero',
        level: 5,
      });
      expect(context.actor.components['core:position']).toEqual({
        location: 'tavern-1',
        x: 10,
        y: 20,
      });
      expect(context.actor.components['core:health']).toBeDefined();
      expect(context.actor.components['core:inventory']).toBeDefined();
    });

    it('should not mutate entity data when assembling context', () => {
      const actorId = 'actor-456';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Original Name' });

      const context = service.assemblePlanningContext(actorId);

      // Modify context
      context.actor.components['core:actor'].name = 'Modified Name';

      // Verify original entity is unchanged
      const entity = entityManager.getEntity(actorId);
      expect(entity.components['core:actor'].name).toBe('Original Name');
    });

    it('should include world state structure', () => {
      const actorId = 'actor-789';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test Actor' });

      const context = service.assemblePlanningContext(actorId);

      expect(context.world).toBeDefined();
      expect(context.world.locations).toBeDefined();
      expect(context.world.time).toBeDefined();
    });
  });

  describe('assembleRefinementContext with real entities', () => {
    it('should assemble context with task and empty localState', () => {
      const actorId = 'hero-001';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Hero' });
      entityManager.addComponent(actorId, 'core:inventory', { items: [] });

      const task = {
        id: 'core:consume_nourishing_item',
        params: {
          item: 'potion-1',
        },
      };

      const context = service.assembleRefinementContext(actorId, task);

      expect(context.actor.id).toBe(actorId);
      expect(context.task.id).toBe('core:consume_nourishing_item');
      expect(context.task.params.item).toBe('potion-1');
      expect(context.refinement.localState).toEqual({});
    });

    it('should assemble context with task and populated localState', () => {
      const actorId = 'hero-002';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Hero' });

      const task = {
        id: 'core:complex_task',
        params: {
          target: 'entity-789',
          method: 'stealthy',
        },
      };

      const localState = {
        currentStep: 2,
        completedSteps: ['step1', 'step2'],
        variables: {
          targetLocation: 'room-5',
          approachDirection: 'north',
        },
      };

      const context = service.assembleRefinementContext(
        actorId,
        task,
        localState
      );

      expect(context.refinement.localState.currentStep).toBe(2);
      expect(context.refinement.localState.completedSteps).toHaveLength(2);
      expect(context.refinement.localState.variables.targetLocation).toBe(
        'room-5'
      );
    });

    it('should not mutate task data when assembling context', () => {
      const actorId = 'actor-003';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Actor' });

      const originalTask = {
        id: 'core:test_task',
        params: {
          value: 'original',
        },
      };

      const context = service.assembleRefinementContext(actorId, originalTask);

      // Modify context
      context.task.params.value = 'modified';

      // Verify original task is unchanged
      expect(originalTask.params.value).toBe('original');
    });
  });

  describe('assembleConditionContext with real contexts', () => {
    it('should transform planning context for JSON Logic evaluation', () => {
      const actorId = 'actor-logic-1';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test Actor', level: 10 });
      entityManager.addComponent(actorId, 'core:position', { location: 'dungeon-1' });

      const planningContext = service.assemblePlanningContext(actorId);
      const conditionContext = service.assembleConditionContext(planningContext);

      // Verify structure suitable for JSON Logic
      expect(conditionContext.actor).toBeDefined();
      expect(conditionContext.actor.components['core:actor'].level).toBe(10);
      expect(conditionContext.world).toBeDefined();
      expect(conditionContext.task).toBeUndefined();
      expect(conditionContext.refinement).toBeUndefined();
    });

    it('should transform refinement context for JSON Logic evaluation', () => {
      const actorId = 'actor-logic-2';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test Actor' });

      const task = {
        id: 'core:test_task',
        params: { target: 'entity-123' },
      };

      const localState = {
        stepResults: ['result1', 'result2'],
      };

      const refinementContext = service.assembleRefinementContext(
        actorId,
        task,
        localState
      );
      const conditionContext =
        service.assembleConditionContext(refinementContext);

      // Verify structure suitable for JSON Logic
      expect(conditionContext.actor).toBeDefined();
      expect(conditionContext.world).toBeDefined();
      expect(conditionContext.task).toBeDefined();
      expect(conditionContext.task.id).toBe('core:test_task');
      expect(conditionContext.refinement).toBeDefined();
      expect(conditionContext.refinement.localState.stepResults).toHaveLength(2);
    });
  });

  describe('knowledge limitation integration', () => {
    it('should include known entities from core:known_to component when enabled', () => {
      // Create multiple entities
      const actor1 = 'actor-1';
      const actor2 = 'actor-2';
      const item1 = 'item-1';

      entityManager.createEntity(actor1);
      entityManager.addComponent(actor1, 'core:actor', { name: 'Actor 1' });
      // Add core:known_to component with knowledge of other entities
      entityManager.addComponent(actor1, 'core:known_to', {
        entities: [actor1, actor2, item1],
      });

      entityManager.createEntity(actor2);
      entityManager.addComponent(actor2, 'core:actor', { name: 'Actor 2' });

      entityManager.createEntity(item1);
      entityManager.addComponent(item1, 'core:item', { name: 'Sword' });

      const serviceWithKnowledge = new ContextAssemblyService({
        entityManager,
        logger,
        enableKnowledgeLimitation: true,
      });

      const context = serviceWithKnowledge.assemblePlanningContext(actor1);

      expect(context.actor.knowledge).toContain(actor1);
      expect(context.actor.knowledge).toContain(actor2);
      expect(context.actor.knowledge).toContain(item1);
      expect(context.actor.knowledge.length).toBe(3);
    });

    it('should not include knowledge array when feature flag is disabled', () => {
      const actorId = 'actor-no-knowledge';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Actor' });

      const context = service.assemblePlanningContext(actorId);

      expect(context.actor.knowledge).toBeUndefined();
    });

    it('should return minimal knowledge when core:known_to component is missing', () => {
      const actorId = 'actor-without-knowledge-component';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Actor Without Knowledge' });
      // Note: NOT adding core:known_to component

      const serviceWithKnowledge = new ContextAssemblyService({
        entityManager,
        logger,
        enableKnowledgeLimitation: true,
      });

      const context = serviceWithKnowledge.assemblePlanningContext(actorId);

      // Should fallback to minimal knowledge (self only)
      expect(context.actor.knowledge).toEqual([actorId]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Actor missing core:known_to component'),
        expect.any(Object)
      );
    });
  });

  describe('error scenarios with real entities', () => {
    it('should throw ContextAssemblyError when actor is deleted during assembly', () => {
      const actorId = 'temp-actor';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Temporary Actor' });

      // Delete entity
      entityManager.deleteEntity(actorId);

      expect(() => {
        service.assemblePlanningContext(actorId);
      }).toThrow(ContextAssemblyError);
    });

    it('should handle actor with empty components', () => {
      const actorId = 'empty-actor';
      entityManager.createEntity(actorId);

      const context = service.assemblePlanningContext(actorId);

      expect(context.actor.id).toBe(actorId);
      expect(context.actor.components).toEqual({});
    });

    it('should handle task with empty params', () => {
      const actorId = 'simple-actor';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Actor' });

      const task = {
        id: 'core:simple_task',
        params: {},
      };

      const context = service.assembleRefinementContext(actorId, task);

      expect(context.task.params).toEqual({});
    });
  });

  describe('context structure validation', () => {
    it('should produce valid planning context structure', () => {
      const actorId = 'struct-test-1';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test' });

      const context = service.assemblePlanningContext(actorId);

      // Validate structure
      expect(context).toHaveProperty('actor');
      expect(context).toHaveProperty('world');
      expect(context.actor).toHaveProperty('id');
      expect(context.actor).toHaveProperty('components');
      expect(context.world).toHaveProperty('locations');
      expect(context.world).toHaveProperty('time');
    });

    it('should produce valid refinement context structure', () => {
      const actorId = 'struct-test-2';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test' });

      const task = {
        id: 'core:test_task',
        params: { value: 1 },
      };

      const context = service.assembleRefinementContext(actorId, task);

      // Validate structure
      expect(context).toHaveProperty('actor');
      expect(context).toHaveProperty('world');
      expect(context).toHaveProperty('task');
      expect(context).toHaveProperty('refinement');
      expect(context.task).toHaveProperty('id');
      expect(context.task).toHaveProperty('params');
      expect(context.refinement).toHaveProperty('localState');
    });

    it('should produce valid condition context structure', () => {
      const actorId = 'struct-test-3';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:actor', { name: 'Test' });

      const planningContext = service.assemblePlanningContext(actorId);
      const conditionContext = service.assembleConditionContext(planningContext);

      // Validate structure
      expect(conditionContext).toHaveProperty('actor');
      expect(conditionContext).toHaveProperty('world');
      expect(typeof conditionContext.actor).toBe('object');
      expect(typeof conditionContext.world).toBe('object');
    });
  });
});
