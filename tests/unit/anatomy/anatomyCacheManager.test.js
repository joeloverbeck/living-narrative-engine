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
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyCacheManager: Built cache with 3 nodes'
      );
    });

    it('should invalidate existing cache entries before rebuilding', async () => {
      cacheManager.set('torso-1', {
        entityId: 'torso-1',
        partType: 'legacy-torso',
        parentId: null,
        socketId: null,
        children: ['legacy-arm'],
      });
      cacheManager.set('legacy-arm', {
        entityId: 'legacy-arm',
        partType: 'legacy-arm',
        parentId: 'torso-1',
        socketId: 'legacy-socket',
        children: [],
      });

      const invalidateSpy = jest.spyOn(cacheManager, 'invalidateCacheForRoot');

      await cacheManager.buildCache('torso-1', mockEntityManager);

      expect(invalidateSpy).toHaveBeenCalledWith('torso-1');
      expect(cacheManager.has('legacy-arm')).toBe(false);

      const rebuiltRoot = cacheManager.get('torso-1');
      expect(rebuiltRoot.children).toEqual(['arm-1']);

      invalidateSpy.mockRestore();
    });

    it('should use childSocketId when socketId is missing', async () => {
      const torsoEntity = { id: 'torso-1' };
      const armEntity = { id: 'arm-1' };
      const elbowEntity = { id: 'elbow-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') return torsoEntity;
        if (id === 'arm-1') return armEntity;
        if (id === 'elbow-1') return elbowEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            if (id === 'torso-1') return { subType: 'torso' };
            if (id === 'arm-1') return { subType: 'arm' };
            if (id === 'elbow-1') return { subType: 'hand' };
          }
          if (componentId === 'anatomy:joint') {
            if (id === 'arm-1') {
              return { parentId: 'torso-1', socketId: 'shoulder' };
            }
            if (id === 'elbow-1') {
              return { parentId: 'arm-1', childSocketId: 'elbow-socket' };
            }
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        armEntity,
        elbowEntity,
      ]);

      await cacheManager.buildCache('torso-1', mockEntityManager);

      const elbowNode = cacheManager.get('elbow-1');
      expect(elbowNode.socketId).toBe('elbow-socket');
      expect(elbowNode.parentId).toBe('arm-1');
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
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should skip already visited entities when loops are present', async () => {
      const rootEntity = { id: 'loop-root' };
      const childEntity = { id: 'loop-child' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'loop-root') return rootEntity;
        if (id === 'loop-child') return childEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:part') {
            if (id === 'loop-root') return { subType: 'torso' };
            if (id === 'loop-child') return { subType: 'arm' };
          }
          if (componentId === 'anatomy:joint') {
            if (id === 'loop-child') {
              return { parentId: 'loop-root', socketId: 'shoulder' };
            }
            if (id === 'loop-root') {
              return { parentId: 'loop-child', socketId: 'loop-back' };
            }
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        childEntity,
        rootEntity,
      ]);

      await cacheManager.buildCache('loop-root', mockEntityManager);

      expect(cacheManager.size()).toBe(2);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
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

    it('should handle anatomy:body with structure.rootPartId', async () => {
      // Setup actor with anatomy:body that has structure
      const actorEntity = { id: 'actor-1' };
      const bodyPartEntity = { id: 'body-root-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'body-root-1') return bodyPartEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return {
              structure: {
                rootPartId: 'body-root-1',
              },
            };
          }
          if (id === 'body-root-1' && componentId === 'anatomy:part') {
            return { subType: 'torso' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Verify the actor node has the body part as a child
      const actorNode = cacheManager.get('actor-1');
      expect(actorNode.partType).toBe('body_root');
      expect(actorNode.children).toContain('body-root-1');

      // Verify the body part was processed
      const bodyPartNode = cacheManager.get('body-root-1');
      expect(bodyPartNode).toBeDefined();
      expect(bodyPartNode.parentId).toBe('actor-1');
      expect(bodyPartNode.socketId).toBe('root_connection');
    });

    it('should ignore body structures that reference the actor as the root part', async () => {
      const actorEntity = { id: 'actor-self-root' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-self-root') return actorEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-self-root' && componentId === 'anatomy:body') {
            return {
              structure: {
                rootPartId: 'actor-self-root',
              },
            };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await cacheManager.buildCache('actor-self-root', mockEntityManager);

      const actorNode = cacheManager.get('actor-self-root');
      expect(actorNode.children).toEqual([]);
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "AnatomyCacheManager: Connecting body root 'actor-self-root'"
        )
      );
    });

    it('should handle anatomy:body without structure gracefully', async () => {
      const actorEntity = { id: 'actor-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return {}; // anatomy:body exists but no structure
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Should complete without errors
      const actorNode = cacheManager.get('actor-1');
      expect(actorNode).toBeDefined();
      expect(actorNode.children).toEqual([]);
    });

    it('should handle errors in findAndConnectBodyParts gracefully', async () => {
      const actorEntity = { id: 'actor-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        throw new Error(`Entity ${id} not found`);
      });

      let callCount = 0;
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            callCount++;
            // Return anatomy:body on first call for cache building
            if (callCount === 1) {
              return { type: 'humanoid' };
            }
            // Throw error on second call in findAndConnectBodyParts
            throw new Error('Component data error');
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Should log debug message and continue
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Could not connect body parts for 'actor-1':")
      );

      // Cache should still be built for the actor
      const actorNode = cacheManager.get('actor-1');
      expect(actorNode).toBeDefined();
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

    it('should ignore invalidateCacheForRoot when root id is not provided', () => {
      const node = {
        entityId: 'orphan',
        partType: 'torso',
        parentId: null,
        socketId: null,
        children: [],
      };

      cacheManager.set('orphan', node);
      cacheManager.invalidateCacheForRoot(null);
      cacheManager.invalidateCacheForRoot(undefined);
      cacheManager.invalidateCacheForRoot('');

      expect(cacheManager.size()).toBe(1);
      expect(cacheManager.has('orphan')).toBe(true);
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

  describe('disconnected actor anatomy handling', () => {
    it('should connect disconnected actor to anatomy root', async () => {
      // Setup: Actor with anatomy:body but no direct joint children
      const actorEntity = { id: 'actor-1' };
      const anatomyRootEntity = { id: 'anatomy-root-1' };
      const childPartEntity = { id: 'child-part-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'anatomy-root-1') return anatomyRootEntity;
        if (id === 'child-part-1') return childPartEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return {
              type: 'humanoid',
              body: { root: 'anatomy-root-1' }, // NEW: Fix requires body.root field
            };
          }
          if (id === 'anatomy-root-1' && componentId === 'anatomy:part') {
            return { subType: 'torso' };
          }
          if (id === 'child-part-1' && componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          if (id === 'child-part-1' && componentId === 'anatomy:joint') {
            return { parentEntityId: 'anatomy-root-1', socketId: 'shoulder' };
          }
          return null;
        }
      );

      // anatomy-root-1 is a parent but not a child (no joint)
      // child-part-1 has anatomy-root-1 as parent
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        childPartEntity,
      ]);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Verify actor is connected to anatomy root
      const actorNode = cacheManager.get('actor-1');
      expect(actorNode.children).toContain('anatomy-root-1');

      // Verify anatomy root is properly set up
      const anatomyRootNode = cacheManager.get('anatomy-root-1');
      expect(anatomyRootNode).toBeDefined();
      expect(anatomyRootNode.parentId).toBe('actor-1');
      expect(anatomyRootNode.socketId).toBe('anatomy_root_connection');
      expect(anatomyRootNode.children).toContain('child-part-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Successfully connected actor 'actor-1' to its own anatomy root 'anatomy-root-1'"
        )
      );
    });

    it('should handle multiple anatomy root candidates correctly', async () => {
      // Setup: Multiple entities that are parents but not children
      const actorEntity = { id: 'actor-1' };
      const validRootEntity = { id: 'valid-root-1' };
      const invalidRootEntity = { id: 'invalid-root-1' }; // No anatomy:part
      const childPartEntity = { id: 'child-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'valid-root-1') return validRootEntity;
        if (id === 'invalid-root-1') return invalidRootEntity;
        if (id === 'child-1') return childPartEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return {
              type: 'humanoid',
              body: { root: 'valid-root-1' }, // NEW: Fix requires body.root field
            };
          }
          if (id === 'valid-root-1' && componentId === 'anatomy:part') {
            return { subType: 'torso' };
          }
          // invalid-root-1 has no anatomy:part component
          if (id === 'child-1' && componentId === 'anatomy:joint') {
            return { parentEntityId: 'valid-root-1', socketId: 'socket-1' };
          }
          return null;
        }
      );

      // Create a scenario where invalid-root-1 is also a parent
      const otherChildEntity = { id: 'other-child' };
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        childPartEntity,
        otherChildEntity,
      ]);

      // Store the original implementation
      const originalImpl =
        mockEntityManager.getComponentData.getMockImplementation();

      // Override getComponentData to handle both implementations
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'other-child' && componentId === 'anatomy:joint') {
            return { parentEntityId: 'invalid-root-1', socketId: 'socket-2' };
          }
          // Call the original implementation for other cases
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return {
              type: 'humanoid',
              body: { root: 'valid-root-1' }, // NEW: Fix requires body.root field
            };
          }
          if (id === 'valid-root-1' && componentId === 'anatomy:part') {
            return { subType: 'torso' };
          }
          if (id === 'child-1' && componentId === 'anatomy:joint') {
            return { parentEntityId: 'valid-root-1', socketId: 'socket-1' };
          }
          return null;
        }
      );

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Only the valid root with anatomy:part should be connected
      const actorNode = cacheManager.get('actor-1');
      expect(actorNode.children).toContain('valid-root-1');
      expect(actorNode.children).not.toContain('invalid-root-1');
    });

    it('should handle case with no valid anatomy roots', async () => {
      // Setup: Actor with anatomy:body but all entities are children (no roots)
      const actorEntity = { id: 'actor-1' };
      const part1Entity = { id: 'part-1' };
      const part2Entity = { id: 'part-2' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'part-1') return part1Entity;
        if (id === 'part-2') return part2Entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return { type: 'humanoid', body: { root: 'anatomy-root-1' } };
          }
          if (id === 'part-1' && componentId === 'anatomy:joint') {
            return { parentEntityId: 'part-2', socketId: 'socket-1' };
          }
          if (id === 'part-2' && componentId === 'anatomy:joint') {
            return { parentEntityId: 'part-1', socketId: 'socket-2' };
          }
          return null;
        }
      );

      // Both parts have parents, so neither is a root
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        part1Entity,
        part2Entity,
      ]);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Actor should have no children connected
      const actorNode = cacheManager.get('actor-1');
      expect(actorNode).toBeDefined();
      expect(actorNode.children).toEqual([]);

      // Should not throw any errors
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle null return from getEntitiesWithComponent', async () => {
      const actorEntity = { id: 'actor-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return { type: 'humanoid' };
          }
          return null;
        }
      );

      // Return null instead of empty array
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(null);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Should handle gracefully
      expect(cacheManager.size()).toBe(1);
      expect(cacheManager.has('actor-1')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyCacheManager: No entities with joints found'
      );
    });

    it('should handle error during cache building gracefully', async () => {
      const actorEntity = { id: 'actor-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        throw new Error(`Entity ${id} not found`);
      });

      // Simulate error when trying to get component data
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database connection error');
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Should log error (caught in buildCacheRecursive, not handleDisconnectedActorAnatomy)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to build cache node for entity 'actor-1'"
        ),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should use alternative parent field names for compatibility', async () => {
      // Test that it handles both parentEntityId and parentId field names
      const actorEntity = { id: 'actor-1' };
      const anatomyRootEntity = { id: 'anatomy-root-1' };
      const childPartEntity = { id: 'child-part-1' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-1') return actorEntity;
        if (id === 'anatomy-root-1') return anatomyRootEntity;
        if (id === 'child-part-1') return childPartEntity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-1' && componentId === 'anatomy:body') {
            return { type: 'humanoid', body: { root: 'anatomy-root-1' } };
          }
          if (id === 'anatomy-root-1' && componentId === 'anatomy:part') {
            return { subType: 'torso' };
          }
          if (id === 'child-part-1' && componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          if (id === 'child-part-1' && componentId === 'anatomy:joint') {
            // Use parentId instead of parentEntityId
            return { parentId: 'anatomy-root-1', socketId: 'shoulder' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        childPartEntity,
      ]);

      await cacheManager.buildCache('actor-1', mockEntityManager);

      // Should still work with parentId field
      const anatomyRootNode = cacheManager.get('anatomy-root-1');
      expect(anatomyRootNode).toBeDefined();
      expect(anatomyRootNode.children).toContain('child-part-1');
    });

    it('should retain candidates whose joints do not declare parents', async () => {
      const actorEntity = { id: 'actor-floating-root' };
      const floatingRoot = { id: 'floating-root' };
      const floatingChild = { id: 'floating-child' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-floating-root') return actorEntity;
        if (id === 'floating-root') return floatingRoot;
        if (id === 'floating-child') return floatingChild;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-floating-root' && componentId === 'anatomy:body') {
            return { type: 'humanoid', body: { root: 'floating-root' } };
          }
          if (id === 'floating-root' && componentId === 'anatomy:part') {
            return { subType: 'torso' };
          }
          if (id === 'floating-child' && componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          if (id === 'floating-root' && componentId === 'anatomy:joint') {
            return null;
          }
          if (id === 'floating-child' && componentId === 'anatomy:joint') {
            return {
              parentEntityId: 'floating-root',
              socketId: 'child-socket',
            };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        floatingRoot,
        floatingChild,
      ]);

      await cacheManager.buildCache('actor-floating-root', mockEntityManager);

      const actorNode = cacheManager.get('actor-floating-root');
      expect(actorNode.children).toContain('floating-root');
    });

    it('should skip anatomy root candidates without anatomy:part components', async () => {
      const actorEntity = { id: 'actor-missing-part' };
      const orphanCandidate = { id: 'orphan-root' };
      const orphanChild = { id: 'orphan-child' };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-missing-part') return actorEntity;
        if (id === 'orphan-root') return orphanCandidate;
        if (id === 'orphan-child') return orphanChild;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === 'actor-missing-part' && componentId === 'anatomy:body') {
            return { type: 'humanoid' };
          }
          if (id === 'orphan-root' && componentId === 'anatomy:joint') {
            return { socketId: 'floating-root' };
          }
          if (id === 'orphan-child' && componentId === 'anatomy:joint') {
            return { parentEntityId: 'orphan-root', socketId: 'child-socket' };
          }
          if (id === 'orphan-child' && componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          return null;
        }
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        orphanCandidate,
        orphanChild,
      ]);

      await cacheManager.buildCache('actor-missing-part', mockEntityManager);

      const actorNode = cacheManager.get('actor-missing-part');
      expect(actorNode.children).toEqual([]);
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("Found anatomy root 'orphan-root'")
      );
    });
  });
});
