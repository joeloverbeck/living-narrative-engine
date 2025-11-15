import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityRepositoryAdapter from '../../../../src/entities/services/entityRepositoryAdapter.js';
import { DuplicateEntityError } from '../../../../src/errors/duplicateEntityError.js';
import { EntityNotFoundError } from '../../../../src/errors/entityNotFoundError.js';
import { MapManager } from '../../../../src/utils/mapManagerUtils.js';

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

  it('checks if entity exists', () => {
    repo.add(entity);
    expect(repo.has('e1')).toBe(true);
    expect(repo.has('missing')).toBe(false);
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

    it('does nothing when removing unindexed component', () => {
      logger.debug.mockClear();

      repo.indexComponentRemove('missing-entity', 'nonexistent-component');

      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('handles removing entity without indexed components', () => {
      const entityWithoutComponents = { id: 'no-components' };
      repo.add(entityWithoutComponents);

      logger.debug.mockClear();

      const result = repo.remove('no-components');

      expect(result).toBe(true);
      expect(logger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Unindexed component')
      );
    });
  });

  describe('MonitoringCoordinator integration', () => {
    let monitoringCoordinator;
    let performanceMonitor;

    beforeEach(() => {
      performanceMonitor = {
        timeSync: jest.fn((name, fn, context) => fn()),
      };
      monitoringCoordinator = {
        executeMonitored: jest.fn(),
        getCircuitBreaker: jest.fn(),
        getPerformanceMonitor: jest.fn(() => performanceMonitor),
      };
      logger = createLogger();
      repo = new EntityRepositoryAdapter({ logger, monitoringCoordinator });
      entity = { id: 'e1', componentTypeIds: ['component1', 'component2'] };
    });

    it('constructs with valid monitoringCoordinator', () => {
      expect(repo).toBeInstanceOf(EntityRepositoryAdapter);
    });

    it('throws error when invalid monitoringCoordinator is provided', () => {
      const invalidCoordinator = { someMethod: jest.fn() };
      expect(() => {
        new EntityRepositoryAdapter({
          logger,
          monitoringCoordinator: invalidCoordinator,
        });
      }).toThrow();
    });

    it('wraps add operation with performance monitoring', () => {
      repo.add(entity);

      expect(performanceMonitor.timeSync).toHaveBeenCalledWith(
        'repository.add',
        expect.any(Function),
        'entity:e1'
      );
      expect(repo.get('e1')).toBe(entity);
    });

    it('wraps get operation with performance monitoring', () => {
      repo.add(entity);
      const result = repo.get('e1');

      expect(performanceMonitor.timeSync).toHaveBeenCalledWith(
        'repository.get',
        expect.any(Function),
        'entity:e1'
      );
      expect(result).toBe(entity);
    });

    it('wraps has operation with performance monitoring', () => {
      repo.add(entity);
      const result = repo.has('e1');

      expect(performanceMonitor.timeSync).toHaveBeenCalledWith(
        'repository.has',
        expect.any(Function),
        'entity:e1'
      );
      expect(result).toBe(true);
    });

    it('wraps remove operation with performance monitoring', () => {
      repo.add(entity);
      const result = repo.remove('e1');

      expect(performanceMonitor.timeSync).toHaveBeenCalledWith(
        'repository.remove',
        expect.any(Function),
        'entity:e1'
      );
      expect(result).toBe(true);
    });
  });

  describe('size and entities methods', () => {
    it('returns correct size when empty', () => {
      expect(repo.size()).toBe(0);
    });

    it('returns correct size with entities', () => {
      repo.add(entity);
      repo.add({ id: 'e2', componentTypeIds: ['component3'] });
      expect(repo.size()).toBe(2);
    });

    it('returns correct size after removing entity', () => {
      repo.add(entity);
      repo.add({ id: 'e2' });
      repo.remove('e1');
      expect(repo.size()).toBe(1);
    });

    it('returns iterator over all entities', () => {
      const entity2 = { id: 'e2', componentTypeIds: ['component3'] };
      repo.add(entity);
      repo.add(entity2);

      const entities = Array.from(repo.entities());
      expect(entities).toHaveLength(2);
      expect(entities).toContain(entity);
      expect(entities).toContain(entity2);
    });

    it('returns empty iterator when no entities', () => {
      const entities = Array.from(repo.entities());
      expect(entities).toHaveLength(0);
    });

    it('returns array of all entity ids', () => {
      repo.add(entity);
      repo.add({ id: 'e2', componentTypeIds: ['component3'] });

      const ids = repo.getAllEntityIds();

      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining(['e1', 'e2']));
    });
  });

  describe('remove edge cases', () => {
    it('suppresses removal log when underlying map delete fails', () => {
      const removeSpy = jest
        .spyOn(MapManager.prototype, 'remove')
        .mockReturnValue(false);

      try {
        repo.add(entity);
        logger.debug.mockClear();

        const result = repo.remove('e1');

        expect(result).toBe(false);
        expect(logger.debug).not.toHaveBeenCalledWith(
          `Entity 'e1' removed from repository and component index.`
        );
      } finally {
        removeSpy.mockRestore();
      }
    });
  });

  describe('batch operations', () => {
    describe('batchAdd', () => {
      it('adds multiple entities successfully', () => {
        const entities = [
          { id: 'e1', componentTypeIds: ['component1'] },
          { id: 'e2', componentTypeIds: ['component2'] },
          { id: 'e3', componentTypeIds: ['component1', 'component2'] },
        ];

        const result = repo.batchAdd(entities);

        expect(result.entities).toHaveLength(3);
        expect(result.errors).toHaveLength(0);
        expect(repo.size()).toBe(3);
        expect(repo.get('e1')).toBe(entities[0]);
        expect(repo.get('e2')).toBe(entities[1]);
        expect(repo.get('e3')).toBe(entities[2]);
      });

      it('handles partial failures in batch add', () => {
        // Add one entity first to create duplicate scenario
        repo.add({ id: 'e1', componentTypeIds: ['component1'] });

        const entities = [
          { id: 'e1', componentTypeIds: ['component1'] }, // This will fail (duplicate)
          { id: 'e2', componentTypeIds: ['component2'] }, // This will succeed
          { id: 'e3', componentTypeIds: ['component1', 'component2'] }, // This will succeed
        ];

        const result = repo.batchAdd(entities);

        expect(result.entities).toHaveLength(2);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].entity).toBe(entities[0]);
        expect(result.errors[0].error).toBeInstanceOf(DuplicateEntityError);
        expect(logger.warn).toHaveBeenCalledWith(
          'Batch add completed with 1 errors'
        );
        expect(repo.size()).toBe(3); // Original 1 + 2 successful adds
      });

      it('handles all failures in batch add', () => {
        // Add entities first to create duplicate scenario
        repo.add({ id: 'e1', componentTypeIds: ['component1'] });
        repo.add({ id: 'e2', componentTypeIds: ['component2'] });

        const entities = [
          { id: 'e1', componentTypeIds: ['component1'] }, // Duplicate
          { id: 'e2', componentTypeIds: ['component2'] }, // Duplicate
        ];

        const result = repo.batchAdd(entities);

        expect(result.entities).toHaveLength(0);
        expect(result.errors).toHaveLength(2);
        expect(logger.warn).toHaveBeenCalledWith(
          'Batch add completed with 2 errors'
        );
      });

      it('handles empty array in batch add', () => {
        const result = repo.batchAdd([]);

        expect(result.entities).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('batchRemove', () => {
      beforeEach(() => {
        // Add some entities for removal tests
        repo.add({ id: 'e1', componentTypeIds: ['component1'] });
        repo.add({ id: 'e2', componentTypeIds: ['component2'] });
        repo.add({ id: 'e3', componentTypeIds: ['component1', 'component2'] });
      });

      it('removes multiple entities successfully', () => {
        const entityIds = ['e1', 'e2', 'e3'];

        const result = repo.batchRemove(entityIds);

        expect(result.removedIds).toHaveLength(3);
        expect(result.errors).toHaveLength(0);
        expect(repo.size()).toBe(0);
      });

      it('handles partial failures in batch remove', () => {
        const entityIds = ['e1', 'nonexistent', 'e2'];

        const result = repo.batchRemove(entityIds);

        expect(result.removedIds).toHaveLength(2);
        expect(result.removedIds).toContain('e1');
        expect(result.removedIds).toContain('e2');
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].entityId).toBe('nonexistent');
        expect(result.errors[0].error).toBeInstanceOf(EntityNotFoundError);
        expect(logger.warn).toHaveBeenCalledWith(
          'Batch remove completed with 1 errors'
        );
        expect(repo.size()).toBe(1); // Only e3 remains
      });

      it('handles all failures in batch remove', () => {
        const entityIds = ['nonexistent1', 'nonexistent2'];

        const result = repo.batchRemove(entityIds);

        expect(result.removedIds).toHaveLength(0);
        expect(result.errors).toHaveLength(2);
        expect(logger.warn).toHaveBeenCalledWith(
          'Batch remove completed with 2 errors'
        );
        expect(repo.size()).toBe(3); // All original entities remain
      });

      it('handles empty array in batch remove', () => {
        const result = repo.batchRemove([]);

        expect(result.removedIds).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(logger.warn).not.toHaveBeenCalled();
        expect(repo.size()).toBe(3); // All original entities remain
      });

      it('skips recording id when remove returns false during batch remove', () => {
        const repoRemoveSpy = jest
          .spyOn(repo, 'remove')
          .mockReturnValue(false);

        const result = repo.batchRemove(['e1']);

        expect(repoRemoveSpy).toHaveBeenCalledWith('e1');
        expect(result.removedIds).toHaveLength(0);

        repoRemoveSpy.mockRestore();
      });
    });
  });
});
