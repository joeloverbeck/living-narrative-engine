/**
 * @file Unit tests for InMemoryDataRegistry convenience methods to achieve 100% coverage
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

describe('InMemoryDataRegistry Convenience Methods', () => {
  let registry;

  beforeEach(() => {
    registry = new InMemoryDataRegistry();
  });

  describe('World methods', () => {
    it('should store and retrieve world definitions using convenience methods', () => {
      const worldData = { name: 'Test World', startLocation: 'start' };
      registry.store('worlds', 'test:world', worldData);

      expect(registry.getWorldDefinition('test:world')).toBe(worldData);
    });

    it('should get all world definitions using convenience method', () => {
      const world1 = { name: 'World 1' };
      const world2 = { name: 'World 2' };

      registry.store('worlds', 'test:world1', world1);
      registry.store('worlds', 'test:world2', world2);

      const allWorlds = registry.getAllWorldDefinitions();
      expect(allWorlds).toHaveLength(2);
      expect(allWorlds).toEqual(expect.arrayContaining([world1, world2]));
    });

    it('should return undefined for non-existent world definition', () => {
      expect(registry.getWorldDefinition('nonexistent')).toBeUndefined();
    });

    it('should return empty array when no world definitions exist', () => {
      expect(registry.getAllWorldDefinitions()).toEqual([]);
    });
  });

  describe('Event methods', () => {
    it('should store and retrieve event definitions using convenience methods', () => {
      const eventData = { type: 'test_event', payload: {} };
      registry.store('events', 'test:event', eventData);

      expect(registry.getEventDefinition('test:event')).toBe(eventData);
    });

    it('should get all event definitions using convenience method', () => {
      const event1 = { type: 'event1' };
      const event2 = { type: 'event2' };

      registry.store('events', 'test:event1', event1);
      registry.store('events', 'test:event2', event2);

      const allEvents = registry.getAllEventDefinitions();
      expect(allEvents).toHaveLength(2);
      expect(allEvents).toEqual(expect.arrayContaining([event1, event2]));
    });

    it('should return undefined for non-existent event definition', () => {
      expect(registry.getEventDefinition('nonexistent')).toBeUndefined();
    });

    it('should return empty array when no event definitions exist', () => {
      expect(registry.getAllEventDefinitions()).toEqual([]);
    });
  });

  describe('Component methods', () => {
    it('should store and retrieve component definitions using convenience methods', () => {
      const componentData = { schema: { type: 'object' } };
      registry.store('components', 'test:component', componentData);

      expect(registry.getComponentDefinition('test:component')).toBe(
        componentData
      );
    });

    it('should get all component definitions using convenience method', () => {
      const comp1 = { name: 'Component 1' };
      const comp2 = { name: 'Component 2' };

      registry.store('components', 'test:comp1', comp1);
      registry.store('components', 'test:comp2', comp2);

      const allComponents = registry.getAllComponentDefinitions();
      expect(allComponents).toHaveLength(2);
      expect(allComponents).toEqual(expect.arrayContaining([comp1, comp2]));
    });

    it('should return undefined for non-existent component definition', () => {
      expect(registry.getComponentDefinition('nonexistent')).toBeUndefined();
    });

    it('should return empty array when no component definitions exist', () => {
      expect(registry.getAllComponentDefinitions()).toEqual([]);
    });
  });

  describe('Condition methods', () => {
    it('should store and retrieve condition definitions using convenience methods', () => {
      const conditionData = { logic: { var: 'test' } };
      registry.store('conditions', 'test:condition', conditionData);

      expect(registry.getConditionDefinition('test:condition')).toBe(
        conditionData
      );
    });

    it('should get all condition definitions using convenience method', () => {
      const cond1 = { logic: { var: 'test1' } };
      const cond2 = { logic: { var: 'test2' } };

      registry.store('conditions', 'test:cond1', cond1);
      registry.store('conditions', 'test:cond2', cond2);

      const allConditions = registry.getAllConditionDefinitions();
      expect(allConditions).toHaveLength(2);
      expect(allConditions).toEqual(expect.arrayContaining([cond1, cond2]));
    });

    it('should return undefined for non-existent condition definition', () => {
      expect(registry.getConditionDefinition('nonexistent')).toBeUndefined();
    });

    it('should return empty array when no condition definitions exist', () => {
      expect(registry.getAllConditionDefinitions()).toEqual([]);
    });
  });

  describe('Entity Instance methods', () => {
    it('should store and retrieve entity instance definitions using convenience methods', () => {
      const instanceData = {
        instanceId: 'test:instance',
        definitionId: 'test:entity',
      };
      registry.store('entityInstances', 'test:instance', instanceData);

      expect(registry.getEntityInstanceDefinition('test:instance')).toBe(
        instanceData
      );
    });

    it('should get all entity instance definitions using convenience method', () => {
      const inst1 = { instanceId: 'test:inst1', definitionId: 'test:entity1' };
      const inst2 = { instanceId: 'test:inst2', definitionId: 'test:entity2' };

      registry.store('entityInstances', 'test:inst1', inst1);
      registry.store('entityInstances', 'test:inst2', inst2);

      const allInstances = registry.getAllEntityInstanceDefinitions();
      expect(allInstances).toHaveLength(2);
      expect(allInstances).toEqual(expect.arrayContaining([inst1, inst2]));
    });

    it('should return undefined for non-existent entity instance definition', () => {
      expect(
        registry.getEntityInstanceDefinition('nonexistent')
      ).toBeUndefined();
    });

    it('should return empty array when no entity instance definitions exist', () => {
      expect(registry.getAllEntityInstanceDefinitions()).toEqual([]);
    });
  });

  describe('Goal methods', () => {
    it('should store and retrieve goal definitions using convenience methods', () => {
      const goalData = { description: 'Test goal', conditions: [] };
      registry.store('goals', 'test:goal', goalData);

      expect(registry.getGoalDefinition('test:goal')).toBe(goalData);
    });

    it('should get all goal definitions using convenience method', () => {
      const goal1 = { description: 'Goal 1' };
      const goal2 = { description: 'Goal 2' };

      registry.store('goals', 'test:goal1', goal1);
      registry.store('goals', 'test:goal2', goal2);

      const allGoals = registry.getAllGoalDefinitions();
      expect(allGoals).toHaveLength(2);
      expect(allGoals).toEqual(expect.arrayContaining([goal1, goal2]));
    });

    it('should return undefined for non-existent goal definition', () => {
      expect(registry.getGoalDefinition('nonexistent')).toBeUndefined();
    });

    it('should return empty array when no goal definitions exist', () => {
      expect(registry.getAllGoalDefinitions()).toEqual([]);
    });
  });

  describe('Cross-type isolation', () => {
    it('should maintain isolation between different data types', () => {
      const worldData = { name: 'Test World' };
      const eventData = { type: 'test_event' };
      const componentData = { schema: {} };
      const conditionData = { logic: {} };
      const instanceData = { instanceId: 'test:instance' };
      const goalData = { description: 'Test goal' };

      // Store different types with same ID
      const sameId = 'test:same_id';
      registry.store('worlds', sameId, worldData);
      registry.store('events', sameId, eventData);
      registry.store('components', sameId, componentData);
      registry.store('conditions', sameId, conditionData);
      registry.store('entityInstances', sameId, instanceData);
      registry.store('goals', sameId, goalData);

      // Each convenience method should return the correct data
      expect(registry.getWorldDefinition(sameId)).toBe(worldData);
      expect(registry.getEventDefinition(sameId)).toBe(eventData);
      expect(registry.getComponentDefinition(sameId)).toBe(componentData);
      expect(registry.getConditionDefinition(sameId)).toBe(conditionData);
      expect(registry.getEntityInstanceDefinition(sameId)).toBe(instanceData);
      expect(registry.getGoalDefinition(sameId)).toBe(goalData);
    });
  });

  describe('Error propagation', () => {
    it('should propagate errors from underlying get method for invalid parameters', () => {
      // These should throw the same errors as the underlying get() method
      expect(() => registry.getWorldDefinition('')).toThrow();
      expect(() => registry.getEventDefinition(null)).toThrow();
      expect(() => registry.getComponentDefinition()).toThrow();
      expect(() => registry.getConditionDefinition('')).toThrow();
      expect(() => registry.getEntityInstanceDefinition(null)).toThrow();
      expect(() => registry.getGoalDefinition('')).toThrow();
    });

    it('should propagate errors from underlying getAll method for invalid parameters', () => {
      // Create a spy to verify the methods call the underlying getAll
      const getAllSpy = jest.spyOn(registry, 'getAll');

      registry.getAllWorldDefinitions();
      expect(getAllSpy).toHaveBeenCalledWith('worlds');

      registry.getAllEventDefinitions();
      expect(getAllSpy).toHaveBeenCalledWith('events');

      registry.getAllComponentDefinitions();
      expect(getAllSpy).toHaveBeenCalledWith('components');

      registry.getAllConditionDefinitions();
      expect(getAllSpy).toHaveBeenCalledWith('conditions');

      registry.getAllEntityInstanceDefinitions();
      expect(getAllSpy).toHaveBeenCalledWith('entityInstances');

      registry.getAllGoalDefinitions();
      expect(getAllSpy).toHaveBeenCalledWith('goals');

      getAllSpy.mockRestore();
    });
  });

  describe('Edge case coverage for remaining uncovered lines', () => {
    it('should handle getContentSource when typeMap exists but id does not', () => {
      // Store an item to create the typeMap
      registry.store('worlds', 'existing:world', {
        modId: 'testMod',
        name: 'Test World',
      });

      // Try to get content source for non-existent id in existing type
      expect(registry.getContentSource('worlds', 'nonexistent:id')).toBeNull();
    });

    it('should handle listContentByMod when result[type] already exists', () => {
      // Store multiple items of same type for same mod
      registry.store('components', 'mod1:comp1', {
        modId: 'mod1',
        name: 'Component 1',
      });
      registry.store('components', 'mod1:comp2', {
        modId: 'mod1',
        name: 'Component 2',
      });

      const result = registry.listContentByMod('mod1');
      expect(result.components).toHaveLength(2);
      expect(result.components).toEqual(
        expect.arrayContaining(['mod1:comp1', 'mod1:comp2'])
      );
    });
  });
});
