import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityRepositoryAdapter from '../../../../src/entities/services/entityRepositoryAdapter.js';
import { DuplicateEntityError } from '../../../../src/errors/duplicateEntityError.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('EntityRepositoryAdapter', () => {
  let repo;
  let logger;
  let entity;

  beforeEach(() => {
    logger = createLogger();
    repo = new EntityRepositoryAdapter({ logger });
    entity = { id: 'e1', componentTypeIds: ['component1', 'component2'] };
  });

  it('adds and retrieves entities', () => {
    repo.add(entity);
    expect(repo.get('e1')).toBe(entity);
  });

  it('throws on duplicate add', () => {
    repo.add(entity);
    expect(() => repo.add(entity)).toThrow(DuplicateEntityError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('removes existing entity', () => {
    repo.add(entity);
    expect(repo.remove('e1')).toBe(true);
  });

  it('throws when removing missing entity', () => {
    expect(() => repo.remove('missing')).toThrow(EntityNotFoundError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('clears all entities', () => {
    repo.add(entity);
    repo.add({ id: 'e2' });
    repo.clear();
    expect(logger.info).toHaveBeenCalled();
  });

  describe('component indexing', () => {
    it('indexes entity components when adding entity', () => {
      repo.add(entity);

      // Check that components are indexed
      const component1Entities = repo.getEntityIdsByComponent('component1');
      const component2Entities = repo.getEntityIdsByComponent('component2');

      expect(component1Entities).toBeInstanceOf(Set);
      expect(component1Entities.has('e1')).toBe(true);
      expect(component2Entities).toBeInstanceOf(Set);
      expect(component2Entities.has('e1')).toBe(true);
    });

    it('returns empty Set for components with no entities', () => {
      const result = repo.getEntityIdsByComponent('nonExistentComponent');
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('indexes multiple entities with same component', () => {
      const entity2 = {
        id: 'e2',
        componentTypeIds: ['component1', 'component3'],
      };
      const entity3 = {
        id: 'e3',
        componentTypeIds: ['component1', 'component2'],
      };

      repo.add(entity);
      repo.add(entity2);
      repo.add(entity3);

      const component1Entities = repo.getEntityIdsByComponent('component1');
      expect(component1Entities.size).toBe(3);
      expect(component1Entities.has('e1')).toBe(true);
      expect(component1Entities.has('e2')).toBe(true);
      expect(component1Entities.has('e3')).toBe(true);
    });

    it('removes entity from index when entity is removed', () => {
      repo.add(entity);

      // Verify component index before removal
      let component1Entities = repo.getEntityIdsByComponent('component1');
      expect(component1Entities.has('e1')).toBe(true);

      // Remove entity
      repo.remove('e1');

      // Verify component index after removal
      component1Entities = repo.getEntityIdsByComponent('component1');
      expect(component1Entities.has('e1')).toBe(false);
      expect(component1Entities.size).toBe(0);
    });

    it('handles entities with no components', () => {
      const entityNoComponents = { id: 'e-no-comp' };
      repo.add(entityNoComponents);

      // Should not throw and should handle gracefully
      expect(repo.get('e-no-comp')).toBe(entityNoComponents);
    });

    it('clears component index when clearing repository', () => {
      const entity2 = { id: 'e2', componentTypeIds: ['component1'] };

      repo.add(entity);
      repo.add(entity2);

      // Verify index before clear
      let component1Entities = repo.getEntityIdsByComponent('component1');
      expect(component1Entities.size).toBe(2);

      // Clear repository
      repo.clear();

      // Verify index after clear
      component1Entities = repo.getEntityIdsByComponent('component1');
      expect(component1Entities.size).toBe(0);
    });

    it('updates index when component is added', () => {
      repo.add(entity);

      // Add a new component
      repo.indexComponentAdd('e1', 'component3');

      const component3Entities = repo.getEntityIdsByComponent('component3');
      expect(component3Entities.has('e1')).toBe(true);
    });

    it('updates index when component is removed', () => {
      repo.add(entity);

      // Remove a component
      repo.indexComponentRemove('e1', 'component1');

      const component1Entities = repo.getEntityIdsByComponent('component1');
      expect(component1Entities.has('e1')).toBe(false);
    });

    it('removes component type from index when last entity is removed', () => {
      repo.add(entity);

      // Remove both components
      repo.indexComponentRemove('e1', 'component1');
      repo.indexComponentRemove('e1', 'component2');

      // The component entries should not exist in the index at all
      const component1Entities = repo.getEntityIdsByComponent('component1');
      const component2Entities = repo.getEntityIdsByComponent('component2');

      expect(component1Entities.size).toBe(0);
      expect(component2Entities.size).toBe(0);
    });

    it('handles duplicate component additions gracefully', () => {
      repo.add(entity);

      // Add same component again
      repo.indexComponentAdd('e1', 'component1');

      const component1Entities = repo.getEntityIdsByComponent('component1');
      expect(component1Entities.size).toBe(1); // Should still be 1, not 2
    });
  });
});
