import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ANATOMY_CONSTANTS } from '../../../src/anatomy/constants/anatomyConstants.js';

describe('AnatomyCacheManager', () => {
  let cacheManager;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    cacheManager = new AnatomyCacheManager({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should throw error if logger is not provided', () => {
      expect(() => new AnatomyCacheManager({})).toThrow(InvalidArgumentError);
    });

    it('should initialize with empty cache', () => {
      expect(cacheManager.size()).toBe(0);
    });
  });

  describe('basic cache operations', () => {
    const mockNode = {
      entityId: 'test-entity',
      partType: 'test-part',
      parentId: 'parent-entity',
      socketId: 'test-socket',
      children: ['child-1', 'child-2'],
    };

    it('should set and get nodes', () => {
      cacheManager.set('test-entity', mockNode);
      expect(cacheManager.get('test-entity')).toEqual(mockNode);
    });

    it('should check if entity exists', () => {
      expect(cacheManager.has('test-entity')).toBe(false);
      cacheManager.set('test-entity', mockNode);
      expect(cacheManager.has('test-entity')).toBe(true);
    });

    it('should delete entities', () => {
      cacheManager.set('test-entity', mockNode);
      expect(cacheManager.delete('test-entity')).toBe(true);
      expect(cacheManager.has('test-entity')).toBe(false);
    });

    it('should return false when deleting non-existent entity', () => {
      expect(cacheManager.delete('non-existent')).toBe(false);
    });

    it('should return correct size', () => {
      expect(cacheManager.size()).toBe(0);
      cacheManager.set('entity-1', mockNode);
      expect(cacheManager.size()).toBe(1);
      cacheManager.set('entity-2', { ...mockNode, entityId: 'entity-2' });
      expect(cacheManager.size()).toBe(2);
    });

    it('should return entries iterator', () => {
      cacheManager.set('entity-1', mockNode);
      const entries = Array.from(cacheManager.entries());
      expect(entries).toHaveLength(1);
      expect(entries[0][0]).toBe('entity-1');
      expect(entries[0][1]).toEqual(mockNode);
    });

    it('should clear all entries', () => {
      cacheManager.set('entity-1', mockNode);
      cacheManager.set('entity-2', { ...mockNode, entityId: 'entity-2' });
      expect(cacheManager.size()).toBe(2);

      cacheManager.clear();
      expect(cacheManager.size()).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyCacheManager: Cache cleared'
      );
    });

    it('should throw error when setting with invalid parameters', () => {
      expect(() => cacheManager.set(null, mockNode)).toThrow(
        InvalidArgumentError
      );
      expect(() => cacheManager.set('entity-1', null)).toThrow(
        InvalidArgumentError
      );
    });
  });

  describe('buildCache', () => {
    beforeEach(() => {
      // Setup mock entities
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
    });

    it('should build cache for anatomy graph', async () => {
      await cacheManager.buildCache('torso-1', mockEntityManager);

      expect(cacheManager.size()).toBe(3);
      expect(cacheManager.has('torso-1')).toBe(true);
      expect(cacheManager.has('arm-1')).toBe(true);
      expect(cacheManager.has('hand-1')).toBe(true);

      const torsoNode = cacheManager.get('torso-1');
      expect(torsoNode.partType).toBe('torso');
      expect(torsoNode.children).toEqual(['arm-1']);

      const armNode = cacheManager.get('arm-1');
      expect(armNode.partType).toBe('arm');
      expect(armNode.parentId).toBe('torso-1');
      expect(armNode.children).toEqual(['hand-1']);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyCacheManager: Building cache for anatomy rooted at 'torso-1'"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyCacheManager: Built cache with 3 nodes'
      );
    });

    it('should throw error with invalid parameters', async () => {
      await expect(
        cacheManager.buildCache(null, mockEntityManager)
      ).rejects.toThrow(InvalidArgumentError);
      await expect(cacheManager.buildCache('torso-1', null)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('should handle entities without anatomy:part component', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') return null;
          return null;
        }
      );

      await cacheManager.buildCache('torso-1', mockEntityManager);

      const torsoNode = cacheManager.get('torso-1');
      expect(torsoNode.partType).toBe('unknown');
    });

    it('should build parent-to-children map efficiently in O(n) time', async () => {
      // Setup a larger anatomy tree to test O(n) performance
      const entities = [];
      const ENTITY_COUNT = 100;

      // Create entities
      for (let i = 0; i < ENTITY_COUNT; i++) {
        entities.push({ id: `part-${i}` });
      }

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'part' };
          }
          if (componentId === 'anatomy:joint') {
            const index = parseInt(id.split('-')[1]);
            // Create a tree structure where each entity has parent = index - 1
            if (index > 0) {
              return {
                parentId: `part-${Math.floor((index - 1) / 2)}`,
                socketId: `socket-${index}`,
              };
            }
          }
          return null;
        }
      );

      // Return all entities except the root as having joints
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(
        entities.slice(1)
      );

      // Track how many times getEntitiesWithComponent is called
      const getEntitiesCallCount =
        mockEntityManager.getEntitiesWithComponent.mock.calls.length;

      await cacheManager.buildCache('part-0', mockEntityManager);

      // Should only call getEntitiesWithComponent once (O(n)), not once per entity (O(n²))
      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledTimes(
        getEntitiesCallCount + 1
      );
      expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
        'anatomy:joint'
      );

      // Verify cache is built correctly
      expect(cacheManager.size()).toBeGreaterThan(0);
      const rootNode = cacheManager.get('part-0');
      expect(rootNode).toBeDefined();
      expect(rootNode.children.length).toBeGreaterThan(0);
    });

    it('should handle cycles in the graph', async () => {
      // Create a cycle: arm-1 -> hand-1 -> arm-1
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1')
              return { parentId: 'torso-1', socketId: 'shoulder' };
            if (id === 'hand-1')
              return { parentId: 'arm-1', socketId: 'wrist' };
            if (id === 'torso-1')
              return { parentId: 'hand-1', socketId: 'cycle' };
          }
          return null;
        }
      );

      await cacheManager.buildCache('torso-1', mockEntityManager);

      // Should handle cycle without infinite loop
      expect(cacheManager.size()).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should respect max recursion depth', async () => {
      const originalMaxDepth = ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH;

      // Create a very deep hierarchy
      const entities = Array.from({ length: 10 }, (_, i) => ({
        id: `entity-${i}`,
      }));

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            return { type: 'test-part' };
          }
          if (componentId === 'anatomy:joint') {
            const index = parseInt(id.split('-')[1]);
            if (index > 0) {
              return {
                parentId: `entity-${index - 1}`,
                socketId: 'test-socket',
              };
            }
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(
        entities.slice(1)
      );

      // Temporarily reduce max depth for testing
      Object.defineProperty(ANATOMY_CONSTANTS, 'MAX_RECURSION_DEPTH', {
        value: 3,
        writable: false,
        configurable: true,
      });

      await cacheManager.buildCache('entity-0', mockEntityManager);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Max recursion depth reached')
      );

      // Restore original value
      Object.defineProperty(ANATOMY_CONSTANTS, 'MAX_RECURSION_DEPTH', {
        value: originalMaxDepth,
        writable: false,
        configurable: true,
      });
    });

    it('should log error when entity retrieval fails', async () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      await cacheManager.buildCache('invalid-entity', mockEntityManager);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AnatomyCacheManager: Failed to build cache node for entity 'invalid-entity'",
        expect.any(Object)
      );
    });
  });

  describe('cache persistence', () => {
    it('should check if cache exists for root entity', () => {
      expect(cacheManager.hasCacheForRoot('test-root')).toBe(false);

      const mockNode = {
        entityId: 'test-root',
        partType: 'torso',
        parentId: null,
        socketId: null,
        children: [],
      };

      cacheManager.set('test-root', mockNode);
      expect(cacheManager.hasCacheForRoot('test-root')).toBe(true);
    });

    it('should return false for null or undefined root entity', () => {
      expect(cacheManager.hasCacheForRoot(null)).toBe(false);
      expect(cacheManager.hasCacheForRoot(undefined)).toBe(false);
      expect(cacheManager.hasCacheForRoot('')).toBe(false);
    });

    it('should invalidate cache for specific root', () => {
      // Set up a simple anatomy tree
      const rootNode = {
        entityId: 'root-1',
        partType: 'torso',
        parentId: null,
        socketId: null,
        children: ['arm-1', 'leg-1'],
      };

      const armNode = {
        entityId: 'arm-1',
        partType: 'arm',
        parentId: 'root-1',
        socketId: 'arm-socket',
        children: ['hand-1'],
      };

      const handNode = {
        entityId: 'hand-1',
        partType: 'hand',
        parentId: 'arm-1',
        socketId: 'hand-socket',
        children: [],
      };

      const legNode = {
        entityId: 'leg-1',
        partType: 'leg',
        parentId: 'root-1',
        socketId: 'leg-socket',
        children: [],
      };

      // Build cache
      cacheManager.set('root-1', rootNode);
      cacheManager.set('arm-1', armNode);
      cacheManager.set('hand-1', handNode);
      cacheManager.set('leg-1', legNode);

      expect(cacheManager.size()).toBe(4);

      // Invalidate cache for this root
      cacheManager.invalidateCacheForRoot('root-1');

      // All nodes should be removed
      expect(cacheManager.size()).toBe(0);
      expect(cacheManager.has('root-1')).toBe(false);
      expect(cacheManager.has('arm-1')).toBe(false);
      expect(cacheManager.has('hand-1')).toBe(false);
      expect(cacheManager.has('leg-1')).toBe(false);
    });

    it('should only invalidate cache for specific root, not other trees', () => {
      // Set up two separate anatomy trees
      const tree1Root = {
        entityId: 'tree1-root',
        partType: 'torso',
        parentId: null,
        socketId: null,
        children: ['tree1-arm'],
      };

      const tree1Arm = {
        entityId: 'tree1-arm',
        partType: 'arm',
        parentId: 'tree1-root',
        socketId: 'arm-socket',
        children: [],
      };

      const tree2Root = {
        entityId: 'tree2-root',
        partType: 'torso',
        parentId: null,
        socketId: null,
        children: ['tree2-arm'],
      };

      const tree2Arm = {
        entityId: 'tree2-arm',
        partType: 'arm',
        parentId: 'tree2-root',
        socketId: 'arm-socket',
        children: [],
      };

      // Build caches for both trees
      cacheManager.set('tree1-root', tree1Root);
      cacheManager.set('tree1-arm', tree1Arm);
      cacheManager.set('tree2-root', tree2Root);
      cacheManager.set('tree2-arm', tree2Arm);

      expect(cacheManager.size()).toBe(4);

      // Invalidate only tree1
      cacheManager.invalidateCacheForRoot('tree1-root');

      // Tree1 should be removed, tree2 should remain
      expect(cacheManager.size()).toBe(2);
      expect(cacheManager.has('tree1-root')).toBe(false);
      expect(cacheManager.has('tree1-arm')).toBe(false);
      expect(cacheManager.has('tree2-root')).toBe(true);
      expect(cacheManager.has('tree2-arm')).toBe(true);
    });
  });

  describe('validateCache', () => {
    beforeEach(async () => {
      const torsoEntity = { id: 'torso-1' };
      const armEntity = { id: 'arm-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return torsoEntity;
        if (id === 'arm-1') return armEntity;
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

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([armEntity]);
      await cacheManager.buildCache('torso-1', mockEntityManager);
    });

    it('should throw error with invalid parameters', () => {
      expect(() => cacheManager.validateCache(null)).toThrow(
        InvalidArgumentError
      );
    });

    it('should return valid for correct cache', () => {
      const result = cacheManager.validateCache(mockEntityManager);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should detect missing entities', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') throw new Error('Entity not found');
        return { id };
      });

      const result = cacheManager.validateCache(mockEntityManager);
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

      const result = cacheManager.validateCache(mockEntityManager);
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

      const result = cacheManager.validateCache(mockEntityManager);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        "Parent mismatch for 'arm-1': cache says 'torso-1', joint says 'different-parent'"
      );
    });

    it('should detect missing children in cache', () => {
      // Manually add a child reference that doesn't exist in cache
      const torsoNode = cacheManager.get('torso-1');
      torsoNode.children.push('missing-child');

      const result = cacheManager.validateCache(mockEntityManager);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        "Child 'missing-child' of 'torso-1' not in cache"
      );
    });
  });
});
