import { describe, it, expect, jest } from '@jest/globals';
import { IEntityManager } from '../../../src/interfaces/IEntityManager.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import EntityManager from '../../../src/entities/entityManager.js';

describe('IEntityManager Interface Compliance', () => {
  describe('SimpleEntityManager', () => {
    it('should implement core query methods', () => {
      const manager = new SimpleEntityManager([]);

      // Core methods that must exist
      expect(typeof manager.getEntityInstance).toBe('function');
      expect(manager.getEntityInstance.length).toBe(1);

      expect(typeof manager.getComponentData).toBe('function');
      expect(manager.getComponentData.length).toBe(2);

      expect(typeof manager.hasComponent).toBe('function');
      expect(manager.hasComponent.length).toBe(2);

      expect(typeof manager.getEntitiesWithComponent).toBe('function');
      expect(manager.getEntitiesWithComponent.length).toBe(1);
    });

    it('should have getEntities method for backward compatibility', () => {
      const manager = new SimpleEntityManager([]);

      expect(typeof manager.getEntities).toBe('function');
      expect(manager.getEntities()).toEqual([]);
    });

    it('should have entities getter for interface compliance', () => {
      const manager = new SimpleEntityManager([
        { id: 'test-1', components: {} },
      ]);

      // Verify getter exists
      expect('entities' in manager).toBe(true);

      // Verify it returns an iterator
      const entities = manager.entities;
      expect(entities).toBeDefined();
      expect(typeof entities[Symbol.iterator]).toBe('function');
    });

    it('should return consistent data from both entities getter and getEntities method', () => {
      const testEntities = [
        { id: 'actor-1', components: { 'core:actor': {} } },
        { id: 'item-1', components: { 'items:item': {} } },
      ];
      const manager = new SimpleEntityManager(testEntities);

      const entitiesArray = manager.getEntities();
      expect(entitiesArray).toHaveLength(2);
      expect(entitiesArray.map((e) => e.id)).toEqual(['actor-1', 'item-1']);

      // Test entities getter returns iterator
      const entitiesIterator = Array.from(manager.entities);
      expect(entitiesIterator).toHaveLength(2);
      expect(entitiesIterator.map((e) => e.id)).toEqual(['actor-1', 'item-1']);
    });

    it('should support for...of iteration with entities getter', () => {
      const testEntities = [
        { id: 'actor-1', components: { 'core:actor': { name: 'Alice' } } },
        { id: 'actor-2', components: { 'core:actor': { name: 'Bob' } } },
      ];
      const manager = new SimpleEntityManager(testEntities);

      const ids = [];
      for (const entity of manager.entities) {
        ids.push(entity.id);
      }

      expect(ids).toEqual(['actor-1', 'actor-2']);
    });

    it('should return entity instances with methods from entities getter', () => {
      const testEntities = [
        { id: 'actor-1', components: { 'core:actor': { name: 'Alice' } } },
      ];
      const manager = new SimpleEntityManager(testEntities);

      const entity = Array.from(manager.entities)[0];
      expect(entity).toBeDefined();
      expect(entity.id).toBe('actor-1');
      expect(typeof entity.hasComponent).toBe('function');
      expect(typeof entity.getComponentData).toBe('function');
      expect(typeof entity.getAllComponents).toBe('function');
    });
  });

  describe('EntityManager (Production)', () => {
    it('should extend IEntityManager', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const mockValidator = { validate: jest.fn() };
      const mockRegistry = { getEntityDefinition: jest.fn() };
      const mockDispatcher = { dispatch: jest.fn() };

      const manager = new EntityManager({
        logger: mockLogger,
        validator: mockValidator,
        registry: mockRegistry,
        dispatcher: mockDispatcher,
      });

      expect(manager instanceof IEntityManager).toBe(true);
    });

    it('should have entities getter not getEntities method', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const mockValidator = { validate: jest.fn() };
      const mockRegistry = { getEntityDefinition: jest.fn() };
      const mockDispatcher = { dispatch: jest.fn() };

      const manager = new EntityManager({
        logger: mockLogger,
        validator: mockValidator,
        registry: mockRegistry,
        dispatcher: mockDispatcher,
      });

      // Production uses getter, not method
      expect('entities' in manager).toBe(true);
      expect(typeof manager.getEntities).toBe('undefined');
    });

    it('should implement all interface methods', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const mockValidator = { validate: jest.fn() };
      const mockRegistry = { getEntityDefinition: jest.fn() };
      const mockDispatcher = { dispatch: jest.fn() };

      const manager = new EntityManager({
        logger: mockLogger,
        validator: mockValidator,
        registry: mockRegistry,
        dispatcher: mockDispatcher,
      });

      // Core interface methods
      expect(typeof manager.getEntityInstance).toBe('function');
      expect(typeof manager.getComponentData).toBe('function');
      expect(typeof manager.hasComponent).toBe('function');
      expect(typeof manager.getEntityIds).toBe('function');
      expect(typeof manager.getEntitiesWithComponent).toBe('function');
    });
  });

  describe('API Compatibility Checks', () => {
    it('should document the entities getter vs getEntities() method difference', () => {
      // This test serves as documentation of the key difference:
      // Production: uses 'entities' getter returning IterableIterator
      // Test: uses 'getEntities()' method returning Array

      const testManager = new SimpleEntityManager([]);
      expect(typeof testManager.getEntities).toBe('function'); // Test convenience
      expect('entities' in testManager).toBe(true); // Now also has getter

      // Production manager would have:
      // expect('entities' in productionManager).toBe(true);
      // expect(typeof productionManager.getEntities).toBe('undefined');
    });

    it('should verify entities getter returns iterator in SimpleEntityManager', () => {
      const testManager = new SimpleEntityManager([
        { id: 'test-1', components: {} },
      ]);

      const entities = testManager.entities;
      expect(typeof entities[Symbol.iterator]).toBe('function');

      // Should be consumable only once (like production iterators)
      const firstPass = Array.from(entities);
      expect(firstPass).toHaveLength(1);

      // New call to getter should return fresh iterator
      const secondPass = Array.from(testManager.entities);
      expect(secondPass).toHaveLength(1);
    });
  });
});
