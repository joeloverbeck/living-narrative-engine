/**
 * @file Concurrency isolation tests for AnatomySocketIndex
 * Tests that composite keys properly isolate data per root entity
 * @see src/anatomy/services/anatomySocketIndex.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomySocketIndex from '../../../../src/anatomy/services/anatomySocketIndex.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomySocketIndex - Concurrency Isolation', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;

  beforeEach(() => {
    mockLogger = createMockLogger();

    // Create mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    // Create mock body graph service
    mockBodyGraphService = {
      getBodyGraph: jest.fn(),
    };

    service = new AnatomySocketIndex({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
    });
  });

  describe('Composite Key Isolation', () => {
    it('should isolate socket data between different root entities', async () => {
      // Setup: Create two root entities with overlapping socket IDs
      const rootA = 'characterA';
      const rootB = 'characterB';
      const sharedSocketId = 'torso:chest'; // Same socket ID in both hierarchies

      // Mock body graphs
      mockBodyGraphService.getBodyGraph.mockImplementation((rootId) => {
        const partIds = rootId === rootA ? ['partA1'] : ['partB1'];
        return Promise.resolve({
          getAllPartIds: () => partIds,
        });
      });

      // Mock socket data - both have same socket ID but different entities
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component !== 'anatomy:sockets') return Promise.resolve(null);

          if (entityId === rootA || entityId === 'partA1') {
            return Promise.resolve({
              sockets: [{ id: sharedSocketId, orientation: 'front' }],
            });
          }
          if (entityId === rootB || entityId === 'partB1') {
            return Promise.resolve({
              sockets: [{ id: sharedSocketId, orientation: 'back' }],
            });
          }
          return Promise.resolve(null);
        }
      );

      // Build indexes for both root entities
      await service.buildIndex(rootA);
      await service.buildIndex(rootB);

      // Verify: Each root entity's socket resolves to the correct entity within that hierarchy
      const entityA = await service.findEntityWithSocket(rootA, sharedSocketId);
      const entityB = await service.findEntityWithSocket(rootB, sharedSocketId);

      // Should find the socket in the correct hierarchy (on the root or its parts)
      // The socket is actually on partA1/partB1, not the root
      expect(entityA).toBe('partA1');
      expect(entityB).toBe('partB1');

      // Verify: Entities with sockets are correctly scoped
      const entitiesA = await service.getEntitiesWithSockets(rootA);
      const entitiesB = await service.getEntitiesWithSockets(rootB);

      expect(entitiesA).toContain(rootA);
      expect(entitiesA).toContain('partA1');
      expect(entitiesA).not.toContain(rootB);
      expect(entitiesA).not.toContain('partB1');

      expect(entitiesB).toContain(rootB);
      expect(entitiesB).toContain('partB1');
      expect(entitiesB).not.toContain(rootA);
      expect(entitiesB).not.toContain('partA1');
    });

    it('should handle concurrent buildIndex calls without cross-contamination', async () => {
      // Setup: Three root entities
      const roots = ['char1', 'char2', 'char3'];
      const socketIds = {
        char1: ['socket1', 'socket2'],
        char2: ['socket1', 'socket3'],
        char3: ['socket2', 'socket3'],
      };

      // Mock body graphs
      mockBodyGraphService.getBodyGraph.mockImplementation((rootId) => ({
        getAllPartIds: () => [],
      }));

      // Mock socket data - each root has unique socket set
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component !== 'anatomy:sockets') return Promise.resolve(null);
          const sockets = socketIds[entityId];
          if (!sockets) return Promise.resolve(null);
          return Promise.resolve({
            sockets: sockets.map((id) => ({ id, orientation: 'neutral' })),
          });
        }
      );

      // Act: Build all indexes concurrently (simulates real scenario)
      await Promise.all(roots.map((root) => service.buildIndex(root)));

      // Verify: Each root entity's sockets are correctly isolated
      for (const root of roots) {
        const expectedSockets = socketIds[root];
        for (const socketId of expectedSockets) {
          const foundEntity = await service.findEntityWithSocket(
            root,
            socketId
          );
          expect(foundEntity).toBe(root);
        }
      }

      // Verify: Cross-root socket lookups return correct results
      const char1HasSocket1 = await service.findEntityWithSocket(
        'char1',
        'socket1'
      );
      const char2HasSocket1 = await service.findEntityWithSocket(
        'char2',
        'socket1'
      );
      expect(char1HasSocket1).toBe('char1');
      expect(char2HasSocket1).toBe('char2');
    });

    it('should properly invalidate only the specified root entity', async () => {
      // Setup: Two root entities
      const rootA = 'charA';
      const rootB = 'charB';

      mockBodyGraphService.getBodyGraph.mockImplementation(() => ({
        getAllPartIds: () => [],
      }));

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component !== 'anatomy:sockets') return Promise.resolve(null);
          return Promise.resolve({
            sockets: [{ id: `${entityId}:socket`, orientation: 'neutral' }],
          });
        }
      );

      // Build indexes for both
      await service.buildIndex(rootA);
      await service.buildIndex(rootB);

      // Verify both work
      const beforeA = await service.findEntityWithSocket(rootA, 'charA:socket');
      const beforeB = await service.findEntityWithSocket(rootB, 'charB:socket');
      expect(beforeA).toBe(rootA);
      expect(beforeB).toBe(rootB);

      // Invalidate only rootA
      service.invalidateIndex(rootA);

      // Verify: rootA is invalidated (will rebuild on next access), rootB still works
      // Note: findEntityWithSocket auto-rebuilds the index, so we check getEntitiesWithSockets instead
      const afterA = await service.getEntitiesWithSockets(rootA);
      const afterB = await service.getEntitiesWithSockets(rootB);

      // After invalidation, rootA rebuilds automatically when accessed
      expect(afterA).toEqual([rootA]); // Index auto-rebuilds
      expect(afterB).toEqual([rootB]); // Still has cached data
    });
  });

  describe('Real-world Scenario: Clothing Generation', () => {
    it('should handle 4 concurrent character anatomy builds without interference', async () => {
      // Simulate the game.html scenario: 4 characters loading simultaneously
      const characters = [
        { id: 'player', sockets: ['torso:chest', 'legs:waist'] },
        { id: 'npc1', sockets: ['torso:chest', 'head:neck'] },
        { id: 'npc2', sockets: ['legs:waist', 'feet:ankle'] },
        { id: 'npc3', sockets: ['torso:chest', 'feet:ankle'] },
      ];

      mockBodyGraphService.getBodyGraph.mockImplementation(() => ({
        getAllPartIds: () => [],
      }));

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component !== 'anatomy:sockets') return Promise.resolve(null);
          const char = characters.find((c) => c.id === entityId);
          if (!char) return Promise.resolve(null);
          return Promise.resolve({
            sockets: char.sockets.map((id) => ({ id, orientation: 'neutral' })),
          });
        }
      );

      // Act: Concurrent builds (simulates Promise.all in game.html)
      await Promise.all(characters.map((char) => service.buildIndex(char.id)));

      // Verify: Each character can find their own sockets
      for (const char of characters) {
        for (const socketId of char.sockets) {
          const foundEntity = await service.findEntityWithSocket(
            char.id,
            socketId
          );
          expect(foundEntity).toBe(char.id);
        }
      }

      // Verify: Overlapping socket IDs (torso:chest appears in 3 characters)
      const playerChest = await service.findEntityWithSocket(
        'player',
        'torso:chest'
      );
      const npc1Chest = await service.findEntityWithSocket(
        'npc1',
        'torso:chest'
      );
      const npc3Chest = await service.findEntityWithSocket(
        'npc3',
        'torso:chest'
      );

      expect(playerChest).toBe('player');
      expect(npc1Chest).toBe('npc1');
      expect(npc3Chest).toBe('npc3');

      // Verify: Each character has correct socket count
      const playerEntities = await service.getEntitiesWithSockets('player');
      const npc1Entities = await service.getEntitiesWithSockets('npc1');
      const npc2Entities = await service.getEntitiesWithSockets('npc2');
      const npc3Entities = await service.getEntitiesWithSockets('npc3');

      expect(playerEntities).toHaveLength(1); // Only player entity has sockets
      expect(npc1Entities).toHaveLength(1);
      expect(npc2Entities).toHaveLength(1);
      expect(npc3Entities).toHaveLength(1);
    });
  });
});
