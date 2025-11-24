/**
 * @file Edge case tests for AnatomyCacheManager.handleDisconnectedActorAnatomy
 * Validates graceful handling of missing/invalid body.root fields and circular references
 */

import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';

describe('AnatomyCacheManager - Edge Cases', () => {
  let cacheManager;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn((entityId) => ({ id: entityId })),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
    };

    cacheManager = new AnatomyCacheManager({ logger: mockLogger });
  });

  afterEach(() => {
    cacheManager.clear();
  });

  describe('Missing body.root Field', () => {
    it('should log warning when body.root is undefined', async () => {
      // Arrange: Actor with anatomy:body but no body.root
      const actorId = 'test:actor_missing_root';
      const anatomyBody = {
        recipeId: 'anatomy:human_male',
        body: {
          // root field missing
        },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has anatomy:body but no body.root field')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(actorId)
      );
    });

    it('should log warning when body.root is null', async () => {
      // Arrange: Actor with null body.root
      const actorId = 'test:actor_null_root';
      const anatomyBody = {
        recipeId: 'anatomy:human_male',
        body: {
          root: null, // Explicitly null
        },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has anatomy:body but no body.root field')
      );
    });

    it('should not connect parts when body.root is missing', async () => {
      // Arrange: Actor with missing body.root
      const actorId = 'test:actor_no_root';
      const anatomyBody = {
        recipeId: 'anatomy:human_male',
        body: {},
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Get cache node
      const node = cacheManager.get(actorId);

      // Assert: Actor has no anatomy children
      expect(node).toBeDefined();
      expect(node.children).toEqual([]);
    });

    it('should log warning when body object is missing entirely', async () => {
      // Arrange: Actor with anatomy:body but no body object
      const actorId = 'test:actor_no_body_obj';
      const anatomyBody = {
        recipeId: 'anatomy:human_male',
        // body object missing entirely
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Warning logged for missing body.root
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has anatomy:body but no body.root field')
      );
    });
  });

  describe('Invalid body.root Reference', () => {
    it('should log warning when body.root entity does not exist', async () => {
      // Arrange: Actor with non-existent root reference
      const actorId = 'test:actor_invalid_root';
      const anatomyBody = {
        recipeId: 'anatomy:human_male',
        body: {
          root: 'non-existent-entity-id',
        },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        // Return null for non-existent entity's anatomy:part
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('is not an anatomy part')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('non-existent-entity-id')
      );
    });

    it('should log warning when body.root entity has no anatomy:part', async () => {
      // Arrange: Actor with root pointing to non-anatomy entity
      const actorId = 'test:actor_non_part_root';
      const rootId = 'test:not_a_part';

      const anatomyBody = {
        recipeId: 'anatomy:human_male',
        body: {
          root: rootId,
        },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        // Entity exists but has no anatomy:part component
        if (entityId === rootId && componentId === 'anatomy:part') {
          return null;
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('is not an anatomy part')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(rootId)
      );
    });

    it('should not connect parts when body.root is invalid', async () => {
      // Arrange: Actor with invalid root
      const actorId = 'test:actor_invalid';
      const anatomyBody = {
        body: {
          root: 'invalid-reference',
        },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Get cache node
      const node = cacheManager.get(actorId);

      // Assert: Actor has no anatomy children
      expect(node).toBeDefined();
      expect(node.children).toEqual([]);
    });
  });

  describe('Null anatomy:body Component', () => {
    it('should handle entity without anatomy:body gracefully', async () => {
      // Arrange: Entity without anatomy:body
      const entityId = 'test:non_actor_entity';

      mockEntityManager.getComponentData.mockImplementation(() => null);

      // Act: Build cache (should not throw)
      await expect(
        cacheManager.buildCache(entityId, mockEntityManager)
      ).resolves.not.toThrow();

      // Assert: No warnings logged (this is normal for non-actors)
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle undefined anatomy:body gracefully', async () => {
      // Arrange: Entity with undefined component
      const entityId = 'test:undefined_body';

      mockEntityManager.getComponentData.mockImplementation((id, comp) => {
        if (comp === 'anatomy:body') return undefined;
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(entityId, mockEntityManager);

      // Assert: No exceptions, no warnings
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Circular Reference Protection', () => {
    it('should prevent infinite loop when body.root points to actor itself', async () => {
      // Arrange: Actor with circular reference
      const actorId = 'test:circular_actor';
      const anatomyBody = {
        body: {
          root: actorId, // Points to self!
        },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        // When checking if actor is anatomy:part, return null
        if (entityId === actorId && componentId === 'anatomy:part') {
          return null;
        }
        return null;
      });

      // Act: Build cache (should not hang or stack overflow)
      await expect(
        cacheManager.buildCache(actorId, mockEntityManager)
      ).resolves.not.toThrow();

      // Assert: Warning logged about invalid reference
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('is not an anatomy part')
      );
    });

    it('should detect cycles in parent-child relationships via visited set', async () => {
      // Arrange: Create cyclic anatomy graph
      const actorId = 'test:actor_cycle';
      const partA = 'test:part_a';
      const partB = 'test:part_b';
      const partC = 'test:part_c';

      const anatomyBody = {
        body: { root: partA },
      };

      // Mock joints creating cycle: A → B → C → A
      const joints = [
        {
          id: partA,
          component: {
            parentEntityId: partC, // Creates cycle!
            socketId: 'socket_a',
          },
        },
        {
          id: partB,
          component: {
            parentEntityId: partA,
            socketId: 'socket_b',
          },
        },
        {
          id: partC,
          component: {
            parentEntityId: partB,
            socketId: 'socket_c',
          },
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockImplementation((componentId) => {
        if (componentId === 'anatomy:joint') {
          return joints;
        }
        return [];
      });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        if (componentId === 'anatomy:part') {
          // All parts have anatomy:part component
          if ([partA, partB, partC].includes(entityId)) {
            return { subType: 'test_part' };
          }
        }
        if (componentId === 'anatomy:joint') {
          const joint = joints.find((j) => j.id === entityId);
          return joint ? joint.component : null;
        }
        return null;
      });

      // Act: Build cache (should not infinite loop)
      await expect(
        cacheManager.buildCache(actorId, mockEntityManager)
      ).resolves.not.toThrow();

      // Assert: Visited set prevented infinite traversal
      // Cache should have entries but cycle stopped traversal
      const nodeA = cacheManager.get(partA);
      expect(nodeA).toBeDefined();

      // Verify no stack overflow occurred by checking we completed
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle complex multi-level cycles without hanging', async () => {
      // Arrange: Deep cyclic structure
      const actorId = 'test:deep_cycle';
      const rootPart = 'test:root';
      const childPart = 'test:child';
      const grandchildPart = 'test:grandchild';

      const anatomyBody = {
        body: { root: rootPart },
      };

      const joints = [
        {
          id: childPart,
          component: {
            parentEntityId: rootPart,
            socketId: 'child_socket',
          },
        },
        {
          id: grandchildPart,
          component: {
            parentEntityId: childPart,
            socketId: 'grandchild_socket',
          },
        },
        {
          id: rootPart,
          component: {
            parentEntityId: grandchildPart, // Cycle back to top!
            socketId: 'cycle_socket',
          },
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(joints);

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        if (componentId === 'anatomy:part') {
          if ([rootPart, childPart, grandchildPart].includes(entityId)) {
            return { subType: 'test_part' };
          }
        }
        if (componentId === 'anatomy:joint') {
          const joint = joints.find((j) => j.id === entityId);
          return joint ? joint.component : null;
        }
        return null;
      });

      // Act: Build cache
      const startTime = Date.now();
      await cacheManager.buildCache(actorId, mockEntityManager);
      const elapsed = Date.now() - startTime;

      // Assert: Completed quickly (no infinite loop)
      expect(elapsed).toBeLessThan(1000); // Should complete in <1 second

      // Cache contains parts despite cycle
      expect(cacheManager.get(rootPart)).toBeDefined();
    });
  });

  describe('Success Logging', () => {
    it('should log success when valid body.root is connected', async () => {
      // Arrange: Actor with valid anatomy
      const actorId = 'test:valid_actor';
      const rootId = 'test:valid_root';

      const anatomyBody = {
        body: { root: rootId },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        if (entityId === rootId && componentId === 'anatomy:part') {
          return { subType: 'torso' };
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Success logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully connected actor')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(actorId)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(rootId)
      );
    });

    it('should connect actor to anatomy root when all data is valid', async () => {
      // Arrange: Valid actor-anatomy structure
      const actorId = 'test:actor_success';
      const rootId = 'test:root_success';

      const anatomyBody = {
        recipeId: 'anatomy:human_female',
        body: { root: rootId },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return anatomyBody;
        }
        if (entityId === rootId && componentId === 'anatomy:part') {
          return { subType: 'torso' };
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Actor node has root as child
      const actorNode = cacheManager.get(actorId);
      expect(actorNode).toBeDefined();
      expect(actorNode.children).toContain(rootId);

      // Root node exists in cache
      const rootNode = cacheManager.get(rootId);
      expect(rootNode).toBeDefined();
      expect(rootNode.parentId).toBe(actorId);
    });
  });

  describe('Actor Already Has Children', () => {
    it('should skip handleDisconnectedActorAnatomy when actor has children from joints', async () => {
      // Arrange: Actor with joint children and anatomy:body
      const actorId = 'test:actor_with_children';
      const childId = 'test:child_via_joint';

      // Setup joint structure
      const joints = [
        {
          id: childId,
          component: {
            parentEntityId: actorId,
            socketId: 'test_socket',
          },
        },
      ];

      mockEntityManager.getEntitiesWithComponent.mockImplementation((componentId) => {
        if (componentId === 'anatomy:joint') return joints;
        return [];
      });

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (entityId === actorId && componentId === 'anatomy:body') {
          return { body: { root: 'test:root' } };
        }
        if (entityId === childId && componentId === 'anatomy:part') {
          return { subType: 'child_part' };
        }
        if (entityId === childId && componentId === 'anatomy:joint') {
          return joints[0].component;
        }
        return null;
      });

      // Act: Build cache
      await cacheManager.buildCache(actorId, mockEntityManager);

      // Assert: Actor has child from joint, handleDisconnectedActorAnatomy skipped
      const actorNode = cacheManager.get(actorId);
      expect(actorNode).toBeDefined();
      expect(actorNode.children).toContain(childId);

      // No warning about missing anatomy connection
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('has anatomy:body but no body.root field')
      );
    });
  });

  describe('Error Handling in Exceptional Cases', () => {
    it('should catch and log errors during cache building', async () => {
      // Arrange: Setup that throws error during cache building
      const actorId = 'test:error_actor';

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Simulated entity manager error');
      });

      // Act: Build cache (should not throw)
      await expect(
        cacheManager.buildCache(actorId, mockEntityManager)
      ).resolves.not.toThrow();

      // Assert: Error logged but not thrown
      // Error is caught in buildCacheRecursive, not handleDisconnectedActorAnatomy
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to build cache node'),
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });
});
