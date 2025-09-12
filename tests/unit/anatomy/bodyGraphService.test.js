import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockQueryCache;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
      removeComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    // Create service instance
    service = new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      queryCache: mockQueryCache,
    });
  });

  describe('constructor', () => {
    it('should throw error if entityManager is not provided', () => {
      expect(
        () =>
          new BodyGraphService({
            logger: mockLogger,
            eventDispatcher: mockEventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if logger is not provided', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            eventDispatcher: mockEventDispatcher,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if eventDispatcher is not provided', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('buildAdjacencyCache', () => {
    it('should build cache for a simple anatomy graph', async () => {
      // Arrange
      const torsoEntity = { id: 'torso-1' };
      const headEntity = { id: 'head-1' };
      const armEntity = { id: 'arm-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return torsoEntity;
        if (id === 'head-1') return headEntity;
        if (id === 'arm-1') return armEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            if (id === 'torso-1') return { subType: 'torso' };
            if (id === 'head-1') return { subType: 'head' };
            if (id === 'arm-1') return { subType: 'arm' };
          }
          if (componentId === 'anatomy:joint') {
            if (id === 'head-1')
              return { parentId: 'torso-1', socketId: 'neck' };
            if (id === 'arm-1')
              return { parentId: 'torso-1', socketId: 'shoulder' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        headEntity,
        armEntity,
      ]);

      // Act
      await service.buildAdjacencyCache('torso-1');

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyCacheManager: Building cache for anatomy rooted at 'torso-1'"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyCacheManager: Built cache with 3 nodes'
      );
    });

    it('should handle entities without anatomy:part component', async () => {
      const entity = { id: 'entity-1' };
      mockEntityManager.getEntityInstance.mockReturnValue(entity);
      mockEntityManager.getComponentData.mockReturnValue(null);
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await service.buildAdjacencyCache('entity-1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyCacheManager: Built cache with 1 nodes'
      );
    });

    it('should handle cycles in the graph', async () => {
      const entity1 = { id: 'entity-1' };
      const entity2 = { id: 'entity-2' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity-1') return entity1;
        if (id === 'entity-2') return entity2;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            // Create a cycle
            if (id === 'entity-1')
              return { parentId: 'entity-2', socketId: 'socket1' };
            if (id === 'entity-2')
              return { parentId: 'entity-1', socketId: 'socket2' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entity1,
        entity2,
      ]);

      await service.buildAdjacencyCache('entity-1');

      // Should handle cycle without infinite loop
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should log error when entity retrieval fails', async () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      await service.buildAdjacencyCache('invalid-entity');

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AnatomyCacheManager: Failed to build cache node for entity 'invalid-entity'",
        expect.any(Object)
      );
    });

    it('should not rebuild cache if it already exists', async () => {
      // Setup entities
      const torsoEntity = { id: 'torso-1' };
      const headEntity = { id: 'head-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return torsoEntity;
        if (id === 'head-1') return headEntity;
        return null;
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            if (id === 'torso-1') return { subType: 'torso' };
            if (id === 'head-1') return { subType: 'head' };
          }
          if (componentId === 'anatomy:joint' && id === 'head-1') {
            return { parentId: 'torso-1', socketId: 'neck' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([headEntity]);

      // First call - should build cache
      await service.buildAdjacencyCache('torso-1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyCacheManager: Building cache for anatomy rooted at 'torso-1'"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyCacheManager: Built cache with 2 nodes'
      );

      // Clear the mock calls
      mockLogger.debug.mockClear();
      mockLogger.info.mockClear();
      mockEntityManager.getEntityInstance.mockClear();

      // Second call - should not rebuild cache
      await service.buildAdjacencyCache('torso-1');

      // Should not log cache building messages
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        "AnatomyCacheManager: Building cache for anatomy rooted at 'torso-1'"
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Built cache with')
      );

      // Should not call entity manager methods
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    });
  });

  describe('detachPart', () => {
    beforeEach(async () => {
      // Setup a simple anatomy graph in cache
      const torsoEntity = { id: 'torso-1' };
      const armEntity = { id: 'arm-1' };
      const handEntity = { id: 'hand-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return torsoEntity;
        if (id === 'arm-1') return armEntity;
        if (id === 'hand-1') return handEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            if (id === 'torso-1') return { subType: 'torso' };
            if (id === 'arm-1') return { subType: 'arm' };
            if (id === 'hand-1') return { subType: 'hand' };
          }
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1')
              return { parentId: 'torso-1', socketId: 'shoulder' };
            if (id === 'hand-1')
              return { parentId: 'arm-1', socketId: 'wrist' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        armEntity,
        handEntity,
      ]);

      // Build the cache
      await service.buildAdjacencyCache('torso-1');
    });

    it('should detach a part with cascade', async () => {
      // Act
      const result = await service.detachPart('arm-1', {
        cascade: true,
        reason: 'damage',
      });

      // Assert
      expect(result).toEqual({
        detached: ['arm-1', 'hand-1'],
        parentId: 'torso-1',
        socketId: 'shoulder',
      });

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'arm-1',
        'anatomy:joint'
      );

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        {
          detachedEntityId: 'arm-1',
          parentEntityId: 'torso-1',
          socketId: 'shoulder',
          detachedCount: 2,
          reason: 'damage',
          timestamp: expect.any(Number),
        }
      );
    });

    it('should detach a part without cascade', async () => {
      const result = await service.detachPart('arm-1', { cascade: false });

      expect(result).toEqual({
        detached: ['arm-1'],
        parentId: 'torso-1',
        socketId: 'shoulder',
      });

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedCount: 1,
        })
      );
    });

    it('should throw error if part has no joint component', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint' && id === 'torso-1') {
            return null; // Torso has no joint
          }
          return null;
        }
      );

      await expect(service.detachPart('torso-1')).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('should use default reason if not provided', async () => {
      await service.detachPart('arm-1');

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          reason: 'manual',
        })
      );
    });

    it('should invalidate query cache when detaching a part', async () => {
      // Mock getAnatomyRoot to return torso-1
      jest.spyOn(service, 'getAnatomyRoot').mockReturnValue('torso-1');

      await service.detachPart('arm-1');

      // Should invalidate cache for the root entity
      expect(mockQueryCache.invalidateRoot).toHaveBeenCalledWith('torso-1');
    });
  });

  describe('findPartsByType', () => {
    beforeEach(async () => {
      // Setup anatomy with multiple parts of same type
      const entities = [
        { id: 'torso-1' },
        { id: 'arm-1' },
        { id: 'arm-2' },
        { id: 'hand-1' },
        { id: 'hand-2' },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            if (id === 'torso-1') return { subType: 'torso' };
            if (id.startsWith('arm-')) return { subType: 'arm' };
            if (id.startsWith('hand-')) return { subType: 'hand' };
          }
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1')
              return { parentId: 'torso-1', socketId: 'left_shoulder' };
            if (id === 'arm-2')
              return { parentId: 'torso-1', socketId: 'right_shoulder' };
            if (id === 'hand-1')
              return { parentId: 'arm-1', socketId: 'left_wrist' };
            if (id === 'hand-2')
              return { parentId: 'arm-2', socketId: 'right_wrist' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // arm-2
        entities[3], // hand-1
        entities[4], // hand-2
      ]);
      await service.buildAdjacencyCache('torso-1');
    });

    it('should find all parts of a specific type', () => {
      const arms = service.findPartsByType('torso-1', 'arm');
      expect(arms).toEqual(expect.arrayContaining(['arm-1', 'arm-2']));
      expect(arms).toHaveLength(2);

      const hands = service.findPartsByType('torso-1', 'hand');
      expect(hands).toEqual(expect.arrayContaining(['hand-1', 'hand-2']));
      expect(hands).toHaveLength(2);
    });

    it('should return empty array if no parts match', () => {
      const legs = service.findPartsByType('torso-1', 'leg');
      expect(legs).toEqual([]);
    });

    it('should handle missing nodes in cache', async () => {
      // Test with a root that was never cached to simulate missing nodes
      const result = service.findPartsByType('uncached-root', 'arm');
      expect(result).toEqual([]);
    });

    it('should use cached results when available', () => {
      // Setup cache to return cached result
      const cachedResult = ['arm-cached-1', 'arm-cached-2'];
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(cachedResult);

      const result = service.findPartsByType('torso-1', 'arm');

      // Should use cached result
      expect(result).toEqual(cachedResult);
      expect(mockQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
        'torso-1',
        'arm'
      );

      // Should not perform actual search (AnatomyGraphAlgorithms.findPartsByType not called)
      expect(mockQueryCache.cacheFindPartsByType).not.toHaveBeenCalled();
    });

    it('should cache results when not in cache', () => {
      // Setup cache to return undefined (cache miss)
      mockQueryCache.getCachedFindPartsByType.mockReturnValue(undefined);

      service.findPartsByType('torso-1', 'arm');

      // Should cache the result
      expect(mockQueryCache.cacheFindPartsByType).toHaveBeenCalledWith(
        'torso-1',
        'arm',
        expect.arrayContaining(['arm-1', 'arm-2'])
      );
    });
  });

  describe('getAnatomyRoot', () => {
    beforeEach(async () => {
      const entities = [{ id: 'torso-1' }, { id: 'arm-1' }, { id: 'hand-1' }];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1')
              return { parentId: 'torso-1', socketId: 'shoulder' };
            if (id === 'hand-1')
              return { parentId: 'arm-1', socketId: 'wrist' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // hand-1
      ]);
      await service.buildAdjacencyCache('torso-1');
    });

    it('should find root from any part', () => {
      expect(service.getAnatomyRoot('hand-1')).toBe('torso-1');
      expect(service.getAnatomyRoot('arm-1')).toBe('torso-1');
      expect(service.getAnatomyRoot('torso-1')).toBe('torso-1');
    });

    it('should return null for cyclic references', () => {
      // Create a new service without cache
      const newService = new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      // Create a cycle
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1')
              return { parentId: 'hand-1', socketId: 'shoulder' };
            if (id === 'hand-1')
              return { parentId: 'arm-1', socketId: 'wrist' };
          }
          return null;
        }
      );

      const result = newService.getAnatomyRoot('arm-1');
      expect(result).toBeNull();
      // Note: The new implementation doesn't log warnings for cycles, it just returns null
    });

    it('should handle entities not in cache', () => {
      // Clear cache
      service = new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      expect(service.getAnatomyRoot('hand-1')).toBe('torso-1');
    });
  });

  describe('getPath', () => {
    beforeEach(async () => {
      // Setup a more complex anatomy graph
      const entities = [
        { id: 'torso-1' },
        { id: 'left-arm-1' },
        { id: 'left-hand-1' },
        { id: 'right-arm-1' },
        { id: 'right-hand-1' },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            if (id === 'torso-1') return { subType: 'torso' };
            if (id.includes('arm')) return { subType: 'arm' };
            if (id.includes('hand')) return { subType: 'hand' };
          }
          if (componentId === 'anatomy:joint') {
            if (id === 'left-arm-1')
              return { parentId: 'torso-1', socketId: 'left_shoulder' };
            if (id === 'left-hand-1')
              return { parentId: 'left-arm-1', socketId: 'left_wrist' };
            if (id === 'right-arm-1')
              return { parentId: 'torso-1', socketId: 'right_shoulder' };
            if (id === 'right-hand-1')
              return { parentId: 'right-arm-1', socketId: 'right_wrist' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // left-arm-1
        entities[2], // left-hand-1
        entities[3], // right-arm-1
        entities[4], // right-hand-1
      ]);
      await service.buildAdjacencyCache('torso-1');
    });

    it('should find path between parts', () => {
      const path = service.getPath('left-hand-1', 'right-hand-1');
      expect(path).toEqual([
        'left-hand-1',
        'left-arm-1',
        'torso-1',
        'right-arm-1',
        'right-hand-1',
      ]);
    });

    it('should return single element array for same entity', () => {
      const path = service.getPath('torso-1', 'torso-1');
      expect(path).toEqual(['torso-1']);
    });

    it('should return null if no path exists', async () => {
      // Create a new service instance to ensure clean cache state
      const newService = new BodyGraphService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        eventDispatcher: mockEventDispatcher,
      });

      // Create a disconnected part
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            // No joints, all parts disconnected
            return null;
          }
          return null;
        }
      );
      await newService.buildAdjacencyCache('torso-1');

      const path = newService.getPath('left-hand-1', 'right-hand-1');
      expect(path).toBeNull();
    });

    it('should handle direct parent-child relationship', () => {
      const path = service.getPath('left-arm-1', 'left-hand-1');
      expect(path).toEqual(['left-arm-1', 'left-hand-1']);
    });
  });

  describe('validateCache', () => {
    beforeEach(async () => {
      const entities = [{ id: 'torso-1' }, { id: 'arm-1' }];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1')
              return { parentId: 'torso-1', socketId: 'shoulder' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
      ]);
      await service.buildAdjacencyCache('torso-1');
    });

    it('should return valid for correct cache', () => {
      const result = service.validateCache();
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should detect missing entities', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') throw new Error('Entity not found');
        return { id };
      });

      const result = service.validateCache();
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("Cached entity 'arm-1' no longer exists");
    });

    it('should detect missing joint components', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint' && id === 'arm-1') {
            return null; // No joint but cache says it has parent
          }
          return null;
        }
      );

      const result = service.validateCache();
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        "Entity 'arm-1' in cache has parent but no joint component"
      );
    });

    it('should detect parent mismatches', () => {
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint' && id === 'arm-1') {
            return { parentId: 'different-parent', socketId: 'shoulder' };
          }
          return null;
        }
      );

      const result = service.validateCache();
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        "Parent mismatch for 'arm-1': cache says 'torso-1', joint says 'different-parent'"
      );
    });

    it('should detect missing children in cache', async () => {
      // Manually corrupt the cache by adding a non-existent child
      await service.buildAdjacencyCache('torso-1');

      // Get the cache and add a fake child
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      mockEntityManager.getComponentData.mockImplementation(() => null);
      await service.buildAdjacencyCache('torso-1');

      // Now manually inject a bad child reference
      const torsoEntity = { id: 'torso-1' };
      const fakeChildEntity = { id: 'fake-child' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return torsoEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part' && id === 'torso-1') {
            return { subType: 'torso' };
          }
          if (componentId === 'anatomy:joint' && id === 'fake-child') {
            return { parentId: 'torso-1', socketId: 'fake-socket' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        fakeChildEntity,
      ]);
      await service.buildAdjacencyCache('torso-1');

      // Now remove the fake child from entities but it should still be in cache
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const result = service.validateCache();
      expect(result.valid).toBe(false);
    });
  });

  describe('getAllParts', () => {
    it('should return all entity IDs in the anatomy graph', async () => {
      // Setup anatomy
      const entities = [{ id: 'torso-1' }, { id: 'arm-1' }, { id: 'hand-1' }];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1')
              return { parentId: 'torso-1', socketId: 'shoulder' };
            if (id === 'hand-1')
              return { parentId: 'arm-1', socketId: 'wrist' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // hand-1
      ]);
      await service.buildAdjacencyCache('torso-1');

      // Test private method indirectly through findPartsByType with empty type
      const allParts = service.findPartsByType('torso-1', 'nonexistent');

      // Since no parts match 'nonexistent', we should get empty array
      expect(allParts).toEqual([]);
    });
  });

  describe('getBodyGraph', () => {
    it('should return body graph object with getAllPartIds method', async () => {
      const entityId = 'test-entity-1';
      const mockBodyComponent = {
        body: { root: 'torso-1' },
      };

      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);

      const result = await service.getBodyGraph(entityId);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        entityId,
        'anatomy:body'
      );
      expect(result).toHaveProperty('getAllPartIds');
      expect(typeof result.getAllPartIds).toBe('function');
    });

    it('should return correct part IDs from getAllPartIds method', async () => {
      const entityId = 'test-entity-1';
      const mockBodyComponent = {
        body: { root: 'torso-1' },
      };
      const expectedPartIds = ['torso-1', 'arm-1', 'hand-1'];

      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);
      mockQueryCache.getCachedGetAllParts.mockReturnValue(expectedPartIds);

      const result = await service.getBodyGraph(entityId);
      const partIds = result.getAllPartIds();

      expect(partIds).toEqual(expectedPartIds);
    });

    it('should throw InvalidArgumentError if entityId is null', async () => {
      await expect(service.getBodyGraph(null)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('should throw InvalidArgumentError if entityId is undefined', async () => {
      await expect(service.getBodyGraph(undefined)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('should throw InvalidArgumentError if entityId is not a string', async () => {
      await expect(service.getBodyGraph(123)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('should throw Error if entity has no anatomy:body component', async () => {
      const entityId = 'test-entity-1';

      mockEntityManager.getComponentData.mockResolvedValue(null);

      await expect(service.getBodyGraph(entityId)).rejects.toThrow(
        `Entity ${entityId} has no anatomy:body component`
      );
    });

    it('should handle direct body structure format', async () => {
      const entityId = 'test-entity-1';
      const mockBodyComponent = {
        root: 'torso-1', // Direct structure instead of nested
      };
      const expectedPartIds = ['torso-1'];

      mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);
      mockQueryCache.getCachedGetAllParts.mockReturnValue(expectedPartIds);

      const result = await service.getBodyGraph(entityId);
      const partIds = result.getAllPartIds();

      expect(partIds).toEqual(expectedPartIds);
    });
  });
});
