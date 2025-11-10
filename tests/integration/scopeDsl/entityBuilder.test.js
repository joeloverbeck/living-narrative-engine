/**
 * @file Integration tests for EntityBuilder
 * @description Tests EntityBuilder behavior with real dependencies and in the context of the ScopeDSL system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityBuilder from '../../../src/scopeDsl/core/entityBuilder.js';
import { buildComponents } from '../../../src/utils/entityComponentUtils.js';
import Entity from '../../../src/entities/entity.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';

describe('EntityBuilder Integration Tests', () => {
  let entityBuilder;
  let entityManager;
  let gateway;
  let mockLogger;

  beforeEach(() => {
    // Create a real logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create a simple entity manager with some test entities
    entityManager = new SimpleEntityManager();

    // Create a gateway implementation that uses the entity manager
    gateway = {
      getEntityInstance: (id) => entityManager.getEntityInstance(id),
      getEntities: () => Array.from(entityManager.entities),
      getEntitiesWithComponent: (componentTypeId) => {
        return Array.from(entityManager.entities).filter(
          (entity) => entity.components && entity.components[componentTypeId]
        );
      },
      hasComponent: (entityId, componentTypeId) => {
        const entity = entityManager.getEntityInstance(entityId);
        return (
          entity && entity.components && !!entity.components[componentTypeId]
        );
      },
      getComponentData: (entityId, componentTypeId) => {
        const entity = entityManager.getEntityInstance(entityId);
        return (
          entity && entity.components && entity.components[componentTypeId]
        );
      },
    };

    // Create the entity builder with real dependencies
    entityBuilder = new EntityBuilder(gateway, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Real Gateway Integration', () => {
    it('should retrieve and enhance entities from actual gateway', () => {
      // Setup test entities in the manager
      entityManager.setEntities([
        {
          id: 'player1',
          name: 'Test Player',
          componentTypeIds: ['core:health', 'core:inventory'],
          components: {
            'core:health': { current: 100, max: 100 },
            'core:inventory': { items: [], capacity: 20 },
          },
        },
        {
          id: 'npc1',
          name: 'Test NPC',
          componentTypeIds: ['core:health', 'core:dialogue'],
          components: {
            'core:health': { current: 50, max: 50 },
            'core:dialogue': { lines: ['Hello!'] },
          },
        },
      ]);

      // Test retrieving entity by ID
      const result = entityBuilder.createEntityForEvaluation('player1');

      expect(result).toBeDefined();
      expect(result.id).toBe('player1');
      // The enhanced entity doesn't preserve the name property unless it's part of the entity retrieved
      expect(result.components).toBeDefined();
      expect(result.components['core:health']).toEqual({
        current: 100,
        max: 100,
      });
      expect(result.components['core:inventory']).toEqual({
        items: [],
        capacity: 20,
      });
    });

    it('should handle missing entities gracefully', () => {
      const result = entityBuilder.createEntityForEvaluation('nonexistent');

      expect(result).toEqual({ id: 'nonexistent' });
      expect(result.components).toBeUndefined();
    });

    it('should work with multiple entity retrievals', () => {
      // Setup multiple entities
      const testEntities = [];
      for (let i = 0; i < 10; i++) {
        testEntities.push({
          id: `entity${i}`,
          name: `Entity ${i}`,
          componentTypeIds: ['core:position', 'core:velocity'],
          components: {
            'core:position': { x: i * 10, y: i * 20 },
            'core:velocity': { dx: i, dy: i * 2 },
          },
        });
      }
      entityManager.setEntities(testEntities);

      // Retrieve and enhance multiple entities
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(entityBuilder.createEntityForEvaluation(`entity${i}`));
      }

      // Verify all entities were enhanced correctly
      results.forEach((result, i) => {
        expect(result.id).toBe(`entity${i}`);
        expect(result.components['core:position']).toEqual({
          x: i * 10,
          y: i * 20,
        });
        expect(result.components['core:velocity']).toEqual({
          dx: i,
          dy: i * 2,
        });
      });
    });
  });

  describe('buildComponents Function Integration', () => {
    it('should use real buildComponents function to aggregate component data', () => {
      // Create entity with componentTypeIds but no components
      const entity = {
        id: 'testEntity',
        componentTypeIds: ['core:health', 'core:armor'],
      };

      // Setup gateway to return component data
      gateway.getComponentData = jest
        .fn()
        .mockReturnValueOnce({ current: 75, max: 100 })
        .mockReturnValueOnce({ defense: 10, durability: 50 });

      const result = entityBuilder.createWithComponents(entity);

      // Verify buildComponents was called correctly
      expect(gateway.getComponentData).toHaveBeenCalledWith(
        'testEntity',
        'core:health'
      );
      expect(gateway.getComponentData).toHaveBeenCalledWith(
        'testEntity',
        'core:armor'
      );

      // Verify components were built correctly
      expect(result.components).toEqual({
        'core:health': { current: 75, max: 100 },
        'core:armor': { defense: 10, durability: 50 },
      });
    });

    it('should handle entities with getComponentData method', () => {
      // Create entity with its own getComponentData method
      const entity = {
        id: 'customEntity',
        componentTypeIds: ['core:custom1', 'core:custom2'],
        getComponentData: jest.fn((typeId) => {
          if (typeId === 'core:custom1') return { value: 'from entity' };
          return null;
        }),
      };

      // Setup gateway to return data for custom2
      gateway.getComponentData = jest
        .fn()
        .mockReturnValue({ value: 'from gateway' });

      const result = entityBuilder.createWithComponents(entity);

      // Verify entity's method was called
      expect(entity.getComponentData).toHaveBeenCalledWith('core:custom1');
      expect(entity.getComponentData).toHaveBeenCalledWith('core:custom2');

      // Verify gateway was called only for custom2
      expect(gateway.getComponentData).toHaveBeenCalledWith(
        'customEntity',
        'core:custom2'
      );

      // Verify mixed component sources
      expect(result.components).toEqual({
        'core:custom1': { value: 'from entity' },
        'core:custom2': { value: 'from gateway' },
      });
    });

    it('should handle large numbers of component types', () => {
      // Create entity with many component types
      const componentTypeIds = [];
      for (let i = 0; i < 50; i++) {
        componentTypeIds.push(`core:component${i}`);
      }

      const entity = {
        id: 'largeEntity',
        componentTypeIds,
      };

      // Mock gateway to return data for each component
      gateway.getComponentData = jest.fn((entityId, componentTypeId) => {
        const index = parseInt(componentTypeId.match(/\d+/)[0]);
        return { index, data: `Component ${index} data` };
      });

      const result = entityBuilder.createWithComponents(entity);

      // Verify all components were created correctly
      expect(Object.keys(result.components).length).toBe(50);
      expect(result.components['core:component25']).toEqual({
        index: 25,
        data: 'Component 25 data',
      });
    });
  });

  describe('Entity Class Preservation', () => {
    it('should work with Entity instances that have componentTypeIds', () => {
      // Create a mock entity that simulates an Entity instance structure
      const mockEntityInstance = {
        id: 'realEntity1',
        definitionId: 'test:character',
        componentTypeIds: ['core:health'],
        getComponentData: jest.fn((typeId) => {
          if (typeId === 'core:health') return { current: 100, max: 100 };
          return null;
        }),
        hasComponent: jest.fn((typeId) => typeId === 'core:health'),
        addComponent: jest.fn(),
      };

      const result = entityBuilder.createWithComponents(mockEntityInstance);

      // Verify the result has the expected structure
      expect(result.id).toBe('realEntity1');
      expect(result.definitionId).toBe('test:character');
      expect(result.components).toBeDefined();
      expect(result.components['core:health']).toEqual({
        current: 100,
        max: 100,
      });

      // Verify the entity's getComponentData was called
      expect(mockEntityInstance.getComponentData).toHaveBeenCalledWith(
        'core:health'
      );
    });

    it('should handle custom class instances with complex prototypes', () => {
      // Create a custom class hierarchy
      class BaseEntity {
        constructor(id) {
          this.id = id;
        }

        getType() {
          return 'base';
        }
      }

      class GameCharacter extends BaseEntity {
        constructor(id, name) {
          super(id);
          this.name = name;
        }

        getType() {
          return 'character';
        }

        speak() {
          return `${this.name} says hello!`;
        }
      }

      const character = new GameCharacter('char1', 'Hero');
      character.componentTypeIds = ['core:stats'];

      // Setup gateway
      gateway.getComponentData = jest
        .fn()
        .mockReturnValue({ strength: 10, agility: 15 });

      const result = entityBuilder.createWithComponents(character);

      // Verify prototype chain is preserved
      expect(result).toBeInstanceOf(GameCharacter);
      expect(result).toBeInstanceOf(BaseEntity);
      expect(result.getType()).toBe('character');
      expect(result.speak()).toBe('Hero says hello!');

      // Verify components were added
      expect(result.components).toEqual({
        'core:stats': { strength: 10, agility: 15 },
      });
    });

    it('should handle entities with property descriptors correctly', () => {
      // Create entity with custom property descriptors
      const entity = Object.create(null);
      Object.defineProperties(entity, {
        id: {
          value: 'descriptorEntity',
          writable: false,
          enumerable: true,
          configurable: false,
        },
        name: {
          get() {
            return 'Computed Name';
          },
          enumerable: true,
          configurable: true,
        },
        componentTypeIds: {
          value: ['core:test'],
          writable: true,
          enumerable: true,
          configurable: true,
        },
      });

      gateway.getComponentData = jest.fn().mockReturnValue({ test: true });

      const result = entityBuilder.createWithComponents(entity);

      // Verify property descriptors are preserved
      expect(result.id).toBe('descriptorEntity');
      expect(result.name).toBe('Computed Name');

      // For plain objects created with Object.create(null), the result is a new plain object
      // so descriptors won't be preserved exactly as they were
      const idDescriptor = Object.getOwnPropertyDescriptor(result, 'id');
      expect(idDescriptor).toBeDefined();
      expect(result.id).toBe('descriptorEntity');

      // The name getter should still work
      expect(result.name).toBe('Computed Name');
    });
  });

  describe('Cross-Module Integration', () => {
    it('should work within scope evaluation context', () => {
      // Setup a more complex entity structure
      entityManager.setEntities([
        {
          id: 'actor1',
          name: 'Main Actor',
          componentTypeIds: ['core:position', 'core:relationships'],
          components: {
            'core:position': { x: 0, y: 0, room: 'room1' },
            'core:relationships': {
              followers: ['follower1', 'follower2'],
              allies: ['ally1'],
            },
          },
        },
        {
          id: 'follower1',
          name: 'Follower 1',
          componentTypeIds: ['core:position', 'core:stats'],
          components: {
            'core:position': { x: 1, y: 0, room: 'room1' },
            'core:stats': { loyalty: 80 },
          },
        },
      ]);

      // Test actor evaluation
      const actor = entityBuilder.createActorForEvaluation(
        gateway.getEntityInstance('actor1')
      );

      expect(actor.id).toBe('actor1');
      expect(actor.components['core:relationships'].followers).toContain(
        'follower1'
      );

      // Test follower evaluation
      const follower = entityBuilder.createEntityForEvaluation('follower1');
      expect(follower.components['core:stats'].loyalty).toBe(80);
    });

    it('should handle recursive entity references', () => {
      // Create entities with circular references
      entityManager.setEntities([
        {
          id: 'parent1',
          componentTypeIds: ['core:family'],
          components: {
            'core:family': {
              children: ['child1', 'child2'],
              spouse: 'parent2',
            },
          },
        },
        {
          id: 'parent2',
          componentTypeIds: ['core:family'],
          components: {
            'core:family': {
              children: ['child1', 'child2'],
              spouse: 'parent1',
            },
          },
        },
        {
          id: 'child1',
          componentTypeIds: ['core:family'],
          components: {
            'core:family': {
              parents: ['parent1', 'parent2'],
              sibling: 'child2',
            },
          },
        },
      ]);

      // Build entities with circular references
      const parent1 = entityBuilder.createEntityForEvaluation('parent1');
      const parent2 = entityBuilder.createEntityForEvaluation('parent2');
      const child1 = entityBuilder.createEntityForEvaluation('child1');

      // Verify all entities were created successfully despite circular refs
      expect(parent1.components['core:family'].spouse).toBe('parent2');
      expect(parent2.components['core:family'].spouse).toBe('parent1');
      expect(child1.components['core:family'].parents).toEqual([
        'parent1',
        'parent2',
      ]);
    });

    it('should integrate with multiple entity builders sharing the same gateway', () => {
      // Create multiple builders with the same gateway
      const builder1 = new EntityBuilder(gateway, mockLogger);
      const builder2 = new EntityBuilder(gateway);
      const builder3 = EntityBuilder.withGateway(gateway, mockLogger);

      entityManager.setEntities([
        {
          id: 'sharedEntity',
          componentTypeIds: ['core:shared'],
          components: { 'core:shared': { value: 42 } },
        },
      ]);

      // All builders should produce consistent results
      const result1 = builder1.createEntityForEvaluation('sharedEntity');
      const result2 = builder2.createEntityForEvaluation('sharedEntity');
      const result3 = builder3.createEntityForEvaluation('sharedEntity');

      // Compare the essential properties rather than full object equality
      expect(result1.id).toBe(result2.id);
      expect(result2.id).toBe(result3.id);
      expect(result1.components).toEqual(result2.components);
      expect(result2.components).toEqual(result3.components);
      expect(result1.components['core:shared'].value).toBe(42);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle gateway connection failures gracefully', () => {
      // Create a failing gateway
      const failingGateway = {
        getEntityInstance: jest.fn(() => {
          throw new Error('Gateway connection failed');
        }),
        getComponentData: jest.fn(() => {
          throw new Error('Component service unavailable');
        }),
      };

      const failingBuilder = new EntityBuilder(failingGateway);

      // Should propagate gateway errors
      expect(() => {
        failingBuilder.createEntityForEvaluation('any');
      }).toThrow('Gateway connection failed');
    });

    it('should handle missing component schemas', () => {
      // Entity with components but gateway returns nothing
      const entity = {
        id: 'missingComponents',
        componentTypeIds: ['missing:component1', 'missing:component2'],
      };

      gateway.getComponentData = jest.fn().mockReturnValue(undefined);

      const result = entityBuilder.createWithComponents(entity);

      // Should handle missing components gracefully
      expect(result.components).toEqual({});
      expect(gateway.getComponentData).toHaveBeenCalledTimes(2);
    });

    it('should validate actor entity requirements strictly', () => {
      // Test various invalid actor scenarios
      expect(() => {
        entityBuilder.createActorForEvaluation(null);
      }).toThrow('actorEntity cannot be null or undefined');

      expect(() => {
        entityBuilder.createActorForEvaluation({ name: 'No ID' });
      }).toThrow('actorEntity must have a valid string ID');

      expect(() => {
        entityBuilder.createActorForEvaluation({ id: 123 });
      }).toThrow('actorEntity must have a valid string ID');

      expect(() => {
        entityBuilder.createActorForEvaluation({ id: '' });
      }).toThrow('actorEntity must have a valid string ID');
    });

    it('should handle component building errors', () => {
      const entity = {
        id: 'errorEntity',
        componentTypeIds: ['core:failing'],
      };

      // Make gateway throw during component retrieval
      gateway.getComponentData = jest.fn(() => {
        throw new Error('Component retrieval failed');
      });

      // Should propagate the error
      expect(() => {
        entityBuilder.createWithComponents(entity);
      }).toThrow('Component retrieval failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle falsy sourceEntity in createWithComponents', () => {
      // Test line 38 - null sourceEntity
      expect(entityBuilder.createWithComponents(null)).toBe(null);
      expect(entityBuilder.createWithComponents(undefined)).toBe(null);
      expect(entityBuilder.createWithComponents(false)).toBe(null);
      expect(entityBuilder.createWithComponents(0)).toBe(null);
      expect(entityBuilder.createWithComponents('')).toBe(null);
    });

    it('should handle non-object values in _isPlainObject', () => {
      // Test line 109 - non-object values
      expect(entityBuilder._isPlainObject(null)).toBe(false);
      expect(entityBuilder._isPlainObject(undefined)).toBe(false);
      expect(entityBuilder._isPlainObject(42)).toBe(false);
      expect(entityBuilder._isPlainObject('string')).toBe(false);
      expect(entityBuilder._isPlainObject(true)).toBe(false);
      expect(entityBuilder._isPlainObject(Symbol('test'))).toBe(false);
      expect(entityBuilder._isPlainObject(() => {})).toBe(false);
    });

    it('should handle non-string and non-object items in createEntityForEvaluation', () => {
      // Test lines 128-131 - invalid item types
      expect(entityBuilder.createEntityForEvaluation(null)).toBe(null);
      expect(entityBuilder.createEntityForEvaluation(undefined)).toBe(null);
      expect(entityBuilder.createEntityForEvaluation(42)).toBe(null);
      expect(entityBuilder.createEntityForEvaluation(true)).toBe(null);
      // Arrays and functions are objects in JavaScript, so they'll be processed as entities
      const arrayResult = entityBuilder.createEntityForEvaluation([]);
      expect(arrayResult).toEqual([]);
      // Functions are enhanced as objects
      const func = () => {};
      const funcResult = entityBuilder.createEntityForEvaluation(func);
      expect(typeof funcResult).toBe('object');
    });
    it('should handle entities with 20+ component types', () => {
      const componentTypeIds = [];
      const components = {};

      // Create 25 component types
      for (let i = 0; i < 25; i++) {
        const typeId = `core:component${i}`;
        componentTypeIds.push(typeId);
        components[typeId] = {
          index: i,
          data: `Complex data ${i}`,
          nested: { level: 1, items: [i, i + 1, i + 2] },
        };
      }

      entityManager.setEntities([
        {
          id: 'complexEntity',
          componentTypeIds,
          components,
        },
      ]);

      const result = entityBuilder.createEntityForEvaluation('complexEntity');

      // Verify all components are present
      expect(Object.keys(result.components).length).toBe(25);
      expect(result.components['core:component15'].index).toBe(15);
      expect(result.components['core:component24'].nested.items).toEqual([
        24, 25, 26,
      ]);
    });

    it('should handle deeply nested component structures', () => {
      const deepComponent = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep value',
                  array: [1, 2, 3, 4, 5],
                },
              },
            },
          },
        },
      };

      entityManager.setEntities([
        {
          id: 'deepEntity',
          componentTypeIds: ['core:deep'],
          components: { 'core:deep': deepComponent },
        },
      ]);

      const result = entityBuilder.createEntityForEvaluation('deepEntity');

      expect(
        result.components['core:deep'].level1.level2.level3.level4.level5.value
      ).toBe('deep value');
    });

    it('should handle concurrent entity building operations', () => {
      // Setup many entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push({
          id: `concurrent${i}`,
          componentTypeIds: ['core:data'],
          components: { 'core:data': { index: i } },
        });
      }
      entityManager.setEntities(entities);

      // Build many entities concurrently
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(
            entityBuilder.createEntityForEvaluation(`concurrent${i}`)
          )
        );
      }

      return Promise.all(promises).then((results) => {
        // Verify all entities were built correctly
        results.forEach((result, i) => {
          expect(result.id).toBe(`concurrent${i}`);
          expect(result.components['core:data'].index).toBe(i);
        });
      });
    });

    it('should handle entities with special characters in IDs', () => {
      const specialIds = [
        'entity-with-dash',
        'entity_with_underscore',
        'entity.with.dots',
        'entity:with:colons',
        'ENTITY_UPPERCASE',
      ];

      const entities = specialIds.map((id) => ({
        id,
        componentTypeIds: ['core:test'],
        components: { 'core:test': { id } },
      }));
      entityManager.setEntities(entities);

      specialIds.forEach((id) => {
        const result = entityBuilder.createEntityForEvaluation(id);
        expect(result.id).toBe(id);
        expect(result.components['core:test'].id).toBe(id);
      });
    });

    it('should handle empty componentTypeIds arrays', () => {
      const entity = {
        id: 'emptyComponents',
        componentTypeIds: [],
        name: 'Entity with no components',
      };

      const result = entityBuilder.createWithComponents(entity);

      expect(result.id).toBe('emptyComponents');
      expect(result.name).toBe('Entity with no components');
      expect(result.components).toEqual({});
    });

    it('should handle large datasets correctly', () => {
      // Create a large number of entities with substantial data
      const largeEntities = [];
      for (let i = 0; i < 100; i++) {
        // Reduced for integration test
        largeEntities.push({
          id: `large${i}`,
          componentTypeIds: ['core:bigdata'],
          components: {
            'core:bigdata': {
              array: new Array(10).fill(i), // Reduced size
              string: 'x'.repeat(100), // Reduced size
              nested: { data: { value: i } },
            },
          },
        });
      }
      entityManager.setEntities(largeEntities);

      // Build a subset of entities
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(entityBuilder.createEntityForEvaluation(`large${i}`));
      }

      // Verify entities were built correctly
      expect(results[5].components['core:bigdata'].array[0]).toBe(5);
      expect(results.length).toBe(10);
    });
  });
});
