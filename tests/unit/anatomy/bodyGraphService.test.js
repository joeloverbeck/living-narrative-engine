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

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getAllEntities: jest.fn(),
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

    // Create service instance
    service = new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
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
    it('should build cache for a simple anatomy graph', () => {
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

      mockEntityManager.getAllEntities.mockReturnValue([
        torsoEntity,
        headEntity,
        armEntity,
      ]);

      // Act
      service.buildAdjacencyCache('torso-1');

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BodyGraphService: Building adjacency cache for anatomy rooted at 'torso-1'"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'BodyGraphService: Built adjacency cache with 3 nodes'
      );
    });

    it('should handle entities without anatomy:part component', () => {
      const entity = { id: 'entity-1' };
      mockEntityManager.getEntityInstance.mockReturnValue(entity);
      mockEntityManager.getComponentData.mockReturnValue(null);
      mockEntityManager.getAllEntities.mockReturnValue([entity]);

      service.buildAdjacencyCache('entity-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'BodyGraphService: Built adjacency cache with 1 nodes'
      );
    });

    it('should handle cycles in the graph', () => {
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

      mockEntityManager.getAllEntities.mockReturnValue([entity1, entity2]);

      service.buildAdjacencyCache('entity-1');

      // Should handle cycle without infinite loop
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log error when entity retrieval fails', () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      service.buildAdjacencyCache('invalid-entity');

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to build cache node for entity 'invalid-entity'",
        expect.any(Object)
      );
    });
  });

  describe('detachPart', () => {
    beforeEach(() => {
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

      mockEntityManager.getAllEntities.mockReturnValue([
        torsoEntity,
        armEntity,
        handEntity,
      ]);

      // Build the cache
      service.buildAdjacencyCache('torso-1');
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

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: LIMB_DETACHED_EVENT_ID,
        payload: {
          detachedEntityId: 'arm-1',
          parentEntityId: 'torso-1',
          socketId: 'shoulder',
          detachedCount: 2,
          reason: 'damage',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should detach a part without cascade', async () => {
      const result = await service.detachPart('arm-1', { cascade: false });

      expect(result).toEqual({
        detached: ['arm-1'],
        parentId: 'torso-1',
        socketId: 'shoulder',
      });

      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            detachedCount: 1,
          }),
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
        expect.objectContaining({
          payload: expect.objectContaining({
            reason: 'manual',
          }),
        })
      );
    });
  });

  describe('findPartsByType', () => {
    beforeEach(() => {
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

      mockEntityManager.getAllEntities.mockReturnValue(entities);
      service.buildAdjacencyCache('torso-1');
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

    it('should handle missing nodes in cache', () => {
      // Clear cache to simulate missing nodes
      service.buildAdjacencyCache('invalid-root');

      const result = service.findPartsByType('torso-1', 'arm');
      expect(result).toEqual([]);
    });
  });

  describe('getAnatomyRoot', () => {
    beforeEach(() => {
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

      mockEntityManager.getAllEntities.mockReturnValue(entities);
      service.buildAdjacencyCache('torso-1');
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
      expect(mockLogger.warn).toHaveBeenCalled();
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

  describe('shouldDetachFromDamage', () => {
    it('should return true if damage exceeds threshold', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso-1',
        socketId: 'shoulder',
        breakThreshold: 50,
      });

      expect(service.shouldDetachFromDamage('arm-1', 60)).toBe(true);
    });

    it('should return false if damage is below threshold', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso-1',
        socketId: 'shoulder',
        breakThreshold: 50,
      });

      expect(service.shouldDetachFromDamage('arm-1', 30)).toBe(false);
    });

    it('should return false if threshold is 0 (unbreakable)', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso-1',
        socketId: 'shoulder',
        breakThreshold: 0,
      });

      expect(service.shouldDetachFromDamage('arm-1', 1000)).toBe(false);
    });

    it('should return false if no joint component', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      expect(service.shouldDetachFromDamage('arm-1', 50)).toBe(false);
    });

    it('should handle missing breakThreshold property', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        parentId: 'torso-1',
        socketId: 'shoulder',
        // No breakThreshold
      });

      expect(service.shouldDetachFromDamage('arm-1', 50)).toBe(false);
    });
  });

  describe('getPath', () => {
    beforeEach(() => {
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

      mockEntityManager.getAllEntities.mockReturnValue(entities);
      service.buildAdjacencyCache('torso-1');
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

    it('should return null if no path exists', () => {
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
      service.buildAdjacencyCache('torso-1');

      const path = service.getPath('left-hand-1', 'right-hand-1');
      expect(path).toBeNull();
    });

    it('should handle direct parent-child relationship', () => {
      const path = service.getPath('left-arm-1', 'left-hand-1');
      expect(path).toEqual(['left-arm-1', 'left-hand-1']);
    });
  });

  describe('validateCache', () => {
    beforeEach(() => {
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

      mockEntityManager.getAllEntities.mockReturnValue(entities);
      service.buildAdjacencyCache('torso-1');
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

    it('should detect missing children in cache', () => {
      // Manually corrupt the cache by adding a non-existent child
      service.buildAdjacencyCache('torso-1');

      // Get the cache and add a fake child
      mockEntityManager.getAllEntities.mockReturnValue([{ id: 'torso-1' }]);
      mockEntityManager.getComponentData.mockImplementation(() => null);
      service.buildAdjacencyCache('torso-1');

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

      mockEntityManager.getAllEntities.mockReturnValue([
        torsoEntity,
        fakeChildEntity,
      ]);
      service.buildAdjacencyCache('torso-1');

      // Now remove the fake child from entities but it should still be in cache
      mockEntityManager.getAllEntities.mockReturnValue([torsoEntity]);

      const result = service.validateCache();
      expect(result.valid).toBe(false);
    });
  });

  describe('getAllParts', () => {
    it('should return all entity IDs in the anatomy graph', () => {
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

      mockEntityManager.getAllEntities.mockReturnValue(entities);
      service.buildAdjacencyCache('torso-1');

      // Test private method indirectly through findPartsByType with empty type
      const allParts = service.findPartsByType('torso-1', 'nonexistent');

      // Since no parts match 'nonexistent', we should get empty array
      expect(allParts).toEqual([]);
    });
  });
});
