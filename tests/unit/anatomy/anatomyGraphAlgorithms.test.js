import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';

describe('AnatomyGraphAlgorithms', () => {
  let mockCacheManager;
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
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
    };

    mockCacheManager = new AnatomyCacheManager({ logger: mockLogger });

    // Setup a test anatomy graph in cache
    const nodes = {
      'torso-1': {
        entityId: 'torso-1',
        partType: 'torso',
        parentId: null,
        socketId: null,
        children: ['left-arm-1', 'right-arm-1'],
      },
      'left-arm-1': {
        entityId: 'left-arm-1',
        partType: 'arm',
        parentId: 'torso-1',
        socketId: 'left_shoulder',
        children: ['left-hand-1'],
      },
      'left-hand-1': {
        entityId: 'left-hand-1',
        partType: 'hand',
        parentId: 'left-arm-1',
        socketId: 'left_wrist',
        children: [],
      },
      'right-arm-1': {
        entityId: 'right-arm-1',
        partType: 'arm',
        parentId: 'torso-1',
        socketId: 'right_shoulder',
        children: ['right-hand-1'],
      },
      'right-hand-1': {
        entityId: 'right-hand-1',
        partType: 'hand',
        parentId: 'right-arm-1',
        socketId: 'right_wrist',
        children: [],
      },
    };

    for (const [entityId, node] of Object.entries(nodes)) {
      mockCacheManager.set(entityId, node);
    }
  });

  describe('getSubgraph', () => {
    it('should return empty array for invalid inputs', () => {
      expect(
        AnatomyGraphAlgorithms.getSubgraph(null, mockCacheManager)
      ).toEqual([]);
      expect(AnatomyGraphAlgorithms.getSubgraph('torso-1', null)).toEqual([]);
      expect(AnatomyGraphAlgorithms.getSubgraph('', mockCacheManager)).toEqual(
        []
      );
    });

    it('should get all entities in a subgraph', () => {
      const result = AnatomyGraphAlgorithms.getSubgraph(
        'left-arm-1',
        mockCacheManager
      );
      expect(result).toEqual(
        expect.arrayContaining(['left-arm-1', 'left-hand-1'])
      );
      expect(result).toHaveLength(2);
    });

    it('should get entire anatomy from root', () => {
      const result = AnatomyGraphAlgorithms.getSubgraph(
        'torso-1',
        mockCacheManager
      );
      expect(result).toEqual(
        expect.arrayContaining([
          'torso-1',
          'left-arm-1',
          'left-hand-1',
          'right-arm-1',
          'right-hand-1',
        ])
      );
      expect(result).toHaveLength(5);
    });

    it('should handle single node (leaf)', () => {
      const result = AnatomyGraphAlgorithms.getSubgraph(
        'left-hand-1',
        mockCacheManager
      );
      expect(result).toEqual(['left-hand-1']);
    });

    it('should respect max depth limit', () => {
      const result = AnatomyGraphAlgorithms.getSubgraph(
        'torso-1',
        mockCacheManager,
        1
      );
      expect(result).toEqual(
        expect.arrayContaining(['torso-1', 'left-arm-1', 'right-arm-1'])
      );
      expect(result).toHaveLength(3);
    });

    it('should handle non-existent entity', () => {
      const result = AnatomyGraphAlgorithms.getSubgraph(
        'non-existent',
        mockCacheManager
      );
      expect(result).toEqual(['non-existent']);
    });

    it('should handle cycles without infinite loop', () => {
      // Add a cycle
      const cycleNode = mockCacheManager.get('left-hand-1');
      cycleNode.children = ['left-arm-1']; // Create cycle

      const result = AnatomyGraphAlgorithms.getSubgraph(
        'left-arm-1',
        mockCacheManager
      );
      expect(result).toContain('left-arm-1');
      expect(result).toContain('left-hand-1');
    });
  });

  describe('findPartsByType', () => {
    it('should return empty array for invalid inputs', () => {
      expect(
        AnatomyGraphAlgorithms.findPartsByType(null, 'arm', mockCacheManager)
      ).toEqual([]);
      expect(
        AnatomyGraphAlgorithms.findPartsByType(
          'torso-1',
          null,
          mockCacheManager
        )
      ).toEqual([]);
      expect(
        AnatomyGraphAlgorithms.findPartsByType('torso-1', 'arm', null)
      ).toEqual([]);
    });

    it('should find all parts of a specific type', () => {
      const arms = AnatomyGraphAlgorithms.findPartsByType(
        'torso-1',
        'arm',
        mockCacheManager
      );
      expect(arms).toEqual(
        expect.arrayContaining(['left-arm-1', 'right-arm-1'])
      );
      expect(arms).toHaveLength(2);

      const hands = AnatomyGraphAlgorithms.findPartsByType(
        'torso-1',
        'hand',
        mockCacheManager
      );
      expect(hands).toEqual(
        expect.arrayContaining(['left-hand-1', 'right-hand-1'])
      );
      expect(hands).toHaveLength(2);
    });

    it('should return empty array if no parts match', () => {
      const legs = AnatomyGraphAlgorithms.findPartsByType(
        'torso-1',
        'leg',
        mockCacheManager
      );
      expect(legs).toEqual([]);
    });

    it('should find root entity of matching type', () => {
      const torsos = AnatomyGraphAlgorithms.findPartsByType(
        'torso-1',
        'torso',
        mockCacheManager
      );
      expect(torsos).toEqual(['torso-1']);
    });

    it('should respect max depth limit', () => {
      const parts = AnatomyGraphAlgorithms.findPartsByType(
        'torso-1',
        'hand',
        mockCacheManager,
        1
      );
      expect(parts).toEqual([]); // Hands are at depth 2, so shouldn't be found with maxDepth 1
    });

    it('should handle non-existent root entity', () => {
      const result = AnatomyGraphAlgorithms.findPartsByType(
        'non-existent',
        'arm',
        mockCacheManager
      );
      expect(result).toEqual([]);
    });

    it('should prevent revisiting nodes in cyclic graphs', () => {
      const armNode = mockCacheManager.get('left-arm-1');
      const handNode = mockCacheManager.get('left-hand-1');
      handNode.children = ['left-arm-1'];

      const parts = AnatomyGraphAlgorithms.findPartsByType(
        'left-arm-1',
        'hand',
        mockCacheManager
      );

      expect(parts).toEqual(['left-hand-1']);
      expect(handNode.children).toEqual(['left-arm-1']);
      expect(armNode.children).toEqual(['left-hand-1']);
    });

    it('should handle nodes without child collections', () => {
      const handNode = mockCacheManager.get('right-hand-1');
      handNode.children = null;

      const parts = AnatomyGraphAlgorithms.findPartsByType(
        'right-arm-1',
        'hand',
        mockCacheManager
      );

      expect(parts).toEqual(['right-hand-1']);
    });
  });

  describe('getAnatomyRoot', () => {
    it('should return null for invalid input', () => {
      expect(
        AnatomyGraphAlgorithms.getAnatomyRoot(
          null,
          mockCacheManager,
          mockEntityManager
        )
      ).toBeNull();
      expect(
        AnatomyGraphAlgorithms.getAnatomyRoot(
          '',
          mockCacheManager,
          mockEntityManager
        )
      ).toBeNull();
    });

    it('should find root from any part', () => {
      expect(
        AnatomyGraphAlgorithms.getAnatomyRoot(
          'left-hand-1',
          mockCacheManager,
          mockEntityManager
        )
      ).toBe('torso-1');
      expect(
        AnatomyGraphAlgorithms.getAnatomyRoot(
          'left-arm-1',
          mockCacheManager,
          mockEntityManager
        )
      ).toBe('torso-1');
      expect(
        AnatomyGraphAlgorithms.getAnatomyRoot(
          'torso-1',
          mockCacheManager,
          mockEntityManager
        )
      ).toBe('torso-1');
    });

    it('should handle entities not in cache using entity manager fallback', () => {
      const emptyCacheManager = new AnatomyCacheManager({ logger: mockLogger });

      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === 'anatomy:joint') {
            if (id === 'left-hand-1')
              return { parentId: 'left-arm-1', socketId: 'left_wrist' };
            if (id === 'left-arm-1')
              return { parentId: 'torso-1', socketId: 'left_shoulder' };
          }
          return null;
        }
      );

      const result = AnatomyGraphAlgorithms.getAnatomyRoot(
        'left-hand-1',
        emptyCacheManager,
        mockEntityManager
      );
      expect(result).toBe('torso-1');
    });

    it('should return null for cycles', () => {
      // Create a cycle in cache
      const armNode = mockCacheManager.get('left-arm-1');
      const handNode = mockCacheManager.get('left-hand-1');
      armNode.parentId = 'left-hand-1';
      handNode.parentId = 'left-arm-1';

      const result = AnatomyGraphAlgorithms.getAnatomyRoot(
        'left-arm-1',
        mockCacheManager,
        mockEntityManager
      );
      expect(result).toBeNull();
    });

    it('should respect max depth limit', () => {
      const result = AnatomyGraphAlgorithms.getAnatomyRoot(
        'left-hand-1',
        mockCacheManager,
        mockEntityManager,
        1
      );
      expect(result).toBeNull(); // Can't reach root within depth limit
    });
  });

  describe('getPath', () => {
    it('should return null for invalid inputs', () => {
      expect(
        AnatomyGraphAlgorithms.getPath(null, 'right-hand-1', mockCacheManager)
      ).toBeNull();
      expect(
        AnatomyGraphAlgorithms.getPath('left-hand-1', null, mockCacheManager)
      ).toBeNull();
      expect(
        AnatomyGraphAlgorithms.getPath('left-hand-1', 'right-hand-1', null)
      ).toBeNull();
    });

    it('should return single element array for same entity', () => {
      const path = AnatomyGraphAlgorithms.getPath(
        'torso-1',
        'torso-1',
        mockCacheManager
      );
      expect(path).toEqual(['torso-1']);
    });

    it('should find path between different parts', () => {
      const path = AnatomyGraphAlgorithms.getPath(
        'left-hand-1',
        'right-hand-1',
        mockCacheManager
      );
      expect(path).toEqual([
        'left-hand-1',
        'left-arm-1',
        'torso-1',
        'right-arm-1',
        'right-hand-1',
      ]);
    });

    it('should handle direct parent-child relationship', () => {
      const path = AnatomyGraphAlgorithms.getPath(
        'left-arm-1',
        'left-hand-1',
        mockCacheManager
      );
      expect(path).toEqual(['left-arm-1', 'left-hand-1']);
    });

    it('should handle direct child-parent relationship', () => {
      const path = AnatomyGraphAlgorithms.getPath(
        'left-hand-1',
        'left-arm-1',
        mockCacheManager
      );
      expect(path).toEqual(['left-hand-1', 'left-arm-1']);
    });

    it('should return null if no path exists', () => {
      // Create disconnected components
      const isolatedCacheManager = new AnatomyCacheManager({
        logger: mockLogger,
      });
      isolatedCacheManager.set('isolated-1', {
        entityId: 'isolated-1',
        partType: 'isolated',
        parentId: null,
        socketId: null,
        children: [],
      });

      const path = AnatomyGraphAlgorithms.getPath(
        'left-hand-1',
        'isolated-1',
        isolatedCacheManager
      );
      expect(path).toBeNull();
    });

    it('should remove duplicate ancestor entries when target is ancestor', () => {
      const path = AnatomyGraphAlgorithms.getPath(
        'left-hand-1',
        'torso-1',
        mockCacheManager
      );

      expect(path).toEqual(['left-hand-1', 'left-arm-1', 'torso-1']);
    });

    it('should respect depth limits when building ancestor paths', () => {
      const path = AnatomyGraphAlgorithms.getPath(
        'left-hand-1',
        'right-hand-1',
        mockCacheManager,
        1
      );

      expect(path).toBeNull();
    });

    it('should handle missing cache entries when traversing downward paths', () => {
      const baseNodes = {
        'torso-1': { parentId: null },
        'left-arm-1': { parentId: 'torso-1' },
        'left-hand-1': { parentId: 'left-arm-1' },
        'right-arm-1': { parentId: 'torso-1' },
        'right-hand-1': { parentId: 'right-arm-1' },
      };

      const accessCounts = new Map();
      const customCacheManager = {
        get: jest.fn((entityId) => {
          const count = accessCounts.get(entityId) ?? 0;
          accessCounts.set(entityId, count + 1);

          if (entityId === 'right-arm-1' && count >= 1) {
            return undefined;
          }

          return baseNodes[entityId];
        }),
      };

      const path = AnatomyGraphAlgorithms.getPath(
        'left-hand-1',
        'right-hand-1',
        customCacheManager
      );

      expect(path).toEqual([
        'left-hand-1',
        'left-arm-1',
        'torso-1',
        'right-arm-1',
        'right-hand-1',
      ]);
      expect(customCacheManager.get).toHaveBeenCalledWith('right-arm-1');
      expect(accessCounts.get('right-arm-1')).toBeGreaterThan(1);
      expect(
        customCacheManager.get.mock.results.some(
          (call) => call.value === undefined
        )
      ).toBe(true);
    });
  });

  describe('getAllParts', () => {
    it('should return empty array for invalid input', () => {
      expect(
        AnatomyGraphAlgorithms.getAllParts(
          null,
          mockCacheManager,
          mockEntityManager
        )
      ).toEqual([]);
      expect(
        AnatomyGraphAlgorithms.getAllParts(
          '',
          mockCacheManager,
          mockEntityManager
        )
      ).toEqual([]);
    });

    it('should get all parts from root', () => {
      const result = AnatomyGraphAlgorithms.getAllParts(
        'torso-1',
        mockCacheManager,
        mockEntityManager
      );
      expect(result).toEqual(
        expect.arrayContaining([
          'torso-1',
          'left-arm-1',
          'left-hand-1',
          'right-arm-1',
          'right-hand-1',
        ])
      );
      expect(result).toHaveLength(5);
    });

    it('should work with partial cache using entity manager fallback', () => {
      const partialCacheManager = new AnatomyCacheManager({
        logger: mockLogger,
      });
      // Only add torso to cache
      partialCacheManager.set('torso-1', {
        entityId: 'torso-1',
        partType: 'torso',
        parentId: null,
        socketId: null,
        children: [],
      });

      // Mock entity manager to provide joint information
      const entities = [
        { id: 'left-arm-1' },
        { id: 'left-hand-1' },
        { id: 'right-arm-1' },
        { id: 'right-hand-1' },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entityMap = {
          'torso-1': { id: 'torso-1' },
          'left-arm-1': { id: 'left-arm-1' },
          'left-hand-1': { id: 'left-hand-1' },
          'right-arm-1': { id: 'right-arm-1' },
          'right-hand-1': { id: 'right-hand-1' },
        };
        return entityMap[id] || null;
      });
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
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

      const result = AnatomyGraphAlgorithms.getAllParts(
        'torso-1',
        partialCacheManager,
        mockEntityManager
      );
      expect(result).toContain('torso-1');
      expect(result).toContain('left-arm-1');
      expect(result).toContain('right-arm-1');
    });

    it('should respect max depth limit', () => {
      const result = AnatomyGraphAlgorithms.getAllParts(
        'torso-1',
        mockCacheManager,
        mockEntityManager,
        1
      );
      expect(result).toEqual(
        expect.arrayContaining(['torso-1', 'left-arm-1', 'right-arm-1'])
      );
      expect(result).toHaveLength(3);
    });

    it('should handle cycles without infinite loop', () => {
      // Add a cycle
      const handNode = mockCacheManager.get('left-hand-1');
      handNode.children = ['torso-1']; // Create cycle

      const result = AnatomyGraphAlgorithms.getAllParts(
        'torso-1',
        mockCacheManager,
        mockEntityManager
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('torso-1');
    });

    it('should work without entity manager when cache is complete', () => {
      const result = AnatomyGraphAlgorithms.getAllParts(
        'torso-1',
        mockCacheManager,
        null
      );
      expect(result).toEqual(
        expect.arrayContaining([
          'torso-1',
          'left-arm-1',
          'left-hand-1',
          'right-arm-1',
          'right-hand-1',
        ])
      );
      expect(result).toHaveLength(5);
    });

    it('should tolerate entity manager errors during existence checks', () => {
      const emptyCacheManager = new AnatomyCacheManager({ logger: mockLogger });

      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = AnatomyGraphAlgorithms.getAllParts(
        'torso-1',
        emptyCacheManager,
        mockEntityManager
      );

      expect(result).toEqual([]);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'torso-1'
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty cache manager', () => {
      const emptyCacheManager = new AnatomyCacheManager({ logger: mockLogger });

      expect(
        AnatomyGraphAlgorithms.getSubgraph('test', emptyCacheManager)
      ).toEqual(['test']);
      expect(
        AnatomyGraphAlgorithms.findPartsByType('test', 'arm', emptyCacheManager)
      ).toEqual([]);
      expect(
        AnatomyGraphAlgorithms.getAllParts('test', emptyCacheManager, null)
      ).toEqual([]);
    });

    it('should use default max depth values', () => {
      // Test that default values from ANATOMY_CONSTANTS are used

      // These should not throw errors and should use the defaults
      expect(() =>
        AnatomyGraphAlgorithms.getSubgraph('torso-1', mockCacheManager)
      ).not.toThrow();
      expect(() =>
        AnatomyGraphAlgorithms.findPartsByType(
          'torso-1',
          'arm',
          mockCacheManager
        )
      ).not.toThrow();
      expect(() =>
        AnatomyGraphAlgorithms.getAnatomyRoot(
          'left-hand-1',
          mockCacheManager,
          mockEntityManager
        )
      ).not.toThrow();
      expect(() =>
        AnatomyGraphAlgorithms.getPath(
          'left-hand-1',
          'right-hand-1',
          mockCacheManager
        )
      ).not.toThrow();
      expect(() =>
        AnatomyGraphAlgorithms.getAllParts(
          'torso-1',
          mockCacheManager,
          mockEntityManager
        )
      ).not.toThrow();
    });
  });
});
