import { describe, it, expect, beforeEach } from '@jest/globals';
import TestEntityManagerAdapter from '../../common/entities/TestEntityManagerAdapter.js';

describe('Entity Manager API Compatibility', () => {
  let logger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  });

  describe('IEntityManager Interface', () => {
    it('TestEntityManagerAdapter should match production EntityManager API', () => {
      const adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Required methods from IEntityManager
      const requiredMethods = [
        'getEntityInstance',
        'getComponentData',
        'hasComponent',
        'getEntitiesWithComponent',
        'findEntities',
        'getAllComponentTypesForEntity',
        'getEntityIds',
        'getEntitiesInLocation'
      ];

      for (const method of requiredMethods) {
        expect(typeof adapter[method]).toBe('function');
      }

      // Check entities getter (not a function, but a getter)
      expect(adapter.entities).toBeDefined();
    });

    it('TestEntityManagerAdapter should provide test-specific convenience methods', () => {
      const adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Test-specific convenience methods (not in production)
      const testMethods = [
        'getEntities',      // Array convenience method (not in production)
        'addEntity',        // Test setup method
        'deleteEntity',     // Test cleanup method
        'clearAll',         // Test reset method
        'setEntities'       // Test setup method
      ];

      for (const method of testMethods) {
        expect(typeof adapter[method]).toBe('function');
      }
    });
  });

  describe('Behavioral Compatibility', () => {
    let adapter;

    beforeEach(() => {
      adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Add test entities
      adapter.addEntity({
        id: 'actor-1',
        components: {
          'core:actor': {},
          'positioning:standing': {},
          'core:position': { locationId: 'room1' }
        }
      });

      adapter.addEntity({
        id: 'actor-2',
        components: {
          'core:actor': {},
          'positioning:sitting': { furniture_id: 'couch' },
          'core:position': { locationId: 'room1' }
        }
      });

      adapter.addEntity({
        id: 'item-1',
        components: {
          'items:portable': {},
          'core:position': { locationId: 'room2' }
        }
      });
    });

    describe('entities getter', () => {
      it('should return iterator over all entities', () => {
        const entities = Array.from(adapter.entities);

        expect(Array.isArray(entities)).toBe(true);
        expect(entities.length).toBe(3);
        expect(entities.map(e => e.id).sort()).toEqual(['actor-1', 'actor-2', 'item-1']);
      });
    });

    describe('getEntities (test convenience)', () => {
      it('should return all entities as array', () => {
        const entities = adapter.getEntities();

        expect(Array.isArray(entities)).toBe(true);
        expect(entities.length).toBe(3);
        expect(entities.map(e => e.id).sort()).toEqual(['actor-1', 'actor-2', 'item-1']);
      });
    });

    describe('getEntitiesWithComponent', () => {
      it('should filter entities by component', () => {
        const actors = adapter.getEntitiesWithComponent('core:actor');

        expect(actors.length).toBe(2);
        expect(actors.map(e => e.id).sort()).toEqual(['actor-1', 'actor-2']);
      });

      it('should return empty array when no entities have component', () => {
        const result = adapter.getEntitiesWithComponent('nonexistent:component');

        expect(result).toEqual([]);
      });
    });

    describe('getEntitiesInLocation', () => {
      it('should return Set of entity IDs at location', () => {
        const room1EntityIds = adapter.getEntitiesInLocation('room1');

        expect(room1EntityIds instanceof Set).toBe(true);
        expect(room1EntityIds.size).toBe(2);
        expect(Array.from(room1EntityIds).sort()).toEqual(['actor-1', 'actor-2']);
      });

      it('should return empty Set for empty location', () => {
        const result = adapter.getEntitiesInLocation('empty-room');

        expect(result instanceof Set).toBe(true);
        expect(result.size).toBe(0);
      });
    });

    describe('getAllComponentTypesForEntity', () => {
      it('should return all component types for entity', () => {
        const components = adapter.getAllComponentTypesForEntity('actor-1');

        expect(components.sort()).toEqual([
          'core:actor',
          'core:position',
          'positioning:standing'
        ]);
      });

      it('should return empty array for nonexistent entity', () => {
        const components = adapter.getAllComponentTypesForEntity('nonexistent');

        expect(components).toEqual([]);
      });
    });

    describe('findEntities', () => {
      it('should find entities matching complex query', () => {
        const result = adapter.findEntities({
          withAll: ['core:actor'],
          without: ['positioning:sitting']
        });

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('actor-1');
      });

      it('should return empty array when no matches', () => {
        const result = adapter.findEntities({
          withAll: ['nonexistent:component']
        });

        expect(result).toEqual([]);
      });
    });
  });

  describe('SimpleEntityManager Passthrough', () => {
    it('should support test-specific methods', () => {
      const adapter = new TestEntityManagerAdapter({ logger, initialEntities: [] });

      // Test-specific methods should work
      const entity = { id: 'test', components: {} };
      adapter.addEntity(entity);

      expect(adapter.getEntityInstance('test')).toBeDefined();
      expect(adapter.getEntityInstance('test').id).toBe('test');

      adapter.deleteEntity('test');
      expect(adapter.getEntityInstance('test')).toBeUndefined();

      adapter.addEntity({ id: 'test2', components: {} });
      adapter.clearAll();
      expect(adapter.getEntities()).toEqual([]);
    });
  });

  describe('Migration Support', () => {
    it('should warn when accessing SimpleEntityManager directly', () => {
      const adapter = new TestEntityManagerAdapter({ logger });

      adapter.getSimpleManager();

      expect(logger.warn).toHaveBeenCalledWith(
        'TestEntityManagerAdapter.getSimpleManager() is deprecated',
        expect.objectContaining({
          hint: expect.stringContaining('Use adapter methods directly')
        })
      );
    });
  });
});
