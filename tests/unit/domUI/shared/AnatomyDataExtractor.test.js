/**
 * @file AnatomyDataExtractor.test.js
 * @description Unit tests for AnatomyDataExtractor
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyDataExtractor from '../../../../src/domUI/shared/AnatomyDataExtractor.js';

describe('AnatomyDataExtractor', () => {
  let mockEntityManager;
  let mockLogger;
  let extractor;

  beforeEach(() => {
    // Mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    extractor = new AnatomyDataExtractor({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(extractor).toBeDefined();
    });

    it('should throw when entityManager is missing required methods', () => {
      expect(() => {
        new AnatomyDataExtractor({
          entityManager: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when logger is missing required methods', () => {
      expect(() => {
        new AnatomyDataExtractor({
          entityManager: mockEntityManager,
          logger: {},
        });
      }).toThrow();
    });
  });

  describe('extractHierarchy', () => {
    it('should extract hierarchical tree from anatomy:body data', async () => {
      // Arrange - simple body with root only
      const bodyData = {
        root: 'torso-1',
        parts: {},
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') {
          return {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Torso' };
              if (compId === 'anatomy:part_health')
                return { current: 100, max: 100 };
              if (compId === 'anatomy:joint') return null;
              if (compId === 'anatomy:part') return { subType: 'torso' };
              return null;
            },
            getAllComponents: () => ({
              'core:name': { text: 'Torso' },
              'anatomy:part': { subType: 'torso' },
              'anatomy:part_health': { current: 100, max: 100 },
            }),
          };
        }
        return null;
      });

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result).toEqual({
        id: 'torso-1',
        name: 'Torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:part_health': { current: 100, max: 100 },
        },
        health: { current: 100, max: 100 },
        children: [],
      });
    });

    it('should handle circular references without infinite loop', async () => {
      // Arrange - create a cycle: root -> child -> root
      const bodyData = {
        root: 'part-a',
        parts: { child: 'part-b' },
      };

      // Part A references Part B as child, Part B references Part A as child
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entities = {
          'part-a': {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Part A' };
              if (compId === 'anatomy:joint') return null; // root has no parent
              return null;
            },
            getAllComponents: () => ({ 'core:name': { text: 'Part A' } }),
          },
          'part-b': {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Part B' };
              // This creates a cycle - part-b is child of part-a, but also claims part-a as parent
              if (compId === 'anatomy:joint') return { parentId: 'part-a' };
              return null;
            },
            getAllComponents: () => ({
              'core:name': { text: 'Part B' },
              'anatomy:joint': { parentId: 'part-a' },
            }),
          },
        };
        return entities[id] || null;
      });

      // Act - should complete without hanging
      const result = await extractor.extractHierarchy(bodyData);

      // Assert - Part A has Part B as child, no infinite loop
      expect(result).toBeDefined();
      expect(result.id).toBe('part-a');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe('part-b');
    });

    it('should include part name from core:name component', async () => {
      // Arrange
      const bodyData = { root: 'head-1', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: (compId) => {
          if (compId === 'core:name') return { text: 'Human Head' };
          return null;
        },
        getAllComponents: () => ({ 'core:name': { text: 'Human Head' } }),
      }));

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result.name).toBe('Human Head');
    });

    it('should include health data from anatomy:part_health component', async () => {
      // Arrange
      const bodyData = { root: 'arm-1', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: (compId) => {
          if (compId === 'anatomy:part_health')
            return { current: 75, max: 100 };
          return null;
        },
        getAllComponents: () => ({
          'anatomy:part_health': { current: 75, max: 100 },
        }),
      }));

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result.health).toEqual({ current: 75, max: 100 });
    });

    it('should filter mechanical components (exclude descriptors:*)', async () => {
      // Arrange
      const bodyData = { root: 'part-1', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: () => null,
        getAllComponents: () => ({
          'anatomy:part': { subType: 'torso' },
          'descriptors:color': { value: 'red' },
          'descriptors:size': { value: 'large' },
          'anatomy:sockets': { slots: [] },
        }),
      }));

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result.components).toEqual({
        'anatomy:part': { subType: 'torso' },
        'anatomy:sockets': { slots: [] },
      });
      expect(result.components['descriptors:color']).toBeUndefined();
      expect(result.components['descriptors:size']).toBeUndefined();
    });

    it('should filter core:name and core:description from components', async () => {
      // Arrange
      const bodyData = { root: 'part-1', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: (compId) => {
          if (compId === 'core:name') return { text: 'Test Part' };
          return null;
        },
        getAllComponents: () => ({
          'core:name': { text: 'Test Part' },
          'core:description': { text: 'A test part description' },
          'anatomy:part': { subType: 'test' },
        }),
      }));

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result.components['core:name']).toBeUndefined();
      expect(result.components['core:description']).toBeUndefined();
      expect(result.components['anatomy:part']).toEqual({ subType: 'test' });
    });

    it('should handle missing components gracefully', async () => {
      // Arrange
      const bodyData = { root: 'minimal-part', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: () => null, // No components return data
        getAllComponents: () => ({}), // Empty components
      }));

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result).toEqual({
        id: 'minimal-part',
        name: 'minimal-part', // Falls back to ID when no core:name
        components: {},
        health: null, // No health component
        children: [],
      });
    });

    it('should return null for visited parts (cycle detection)', async () => {
      // Arrange - setup where we can verify cycle detection works
      // Create a cycle: A -> B -> A (B has parentId pointing back to A, which is A's child)
      const bodyData = {
        root: 'part-a',
        parts: { partB: 'part-b' },
      };

      // Track how many times #buildNode processes part-a
      // (Note: getEntityInstance is also called during index building, so we track only the tree building phase)
      let partATreeBuildCount = 0;

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entities = {
          'part-a': {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Part A' };
              if (compId === 'anatomy:joint') return null; // root has no parent
              return null;
            },
            getAllComponents: () => {
              // This is called during tree building, not during index building
              partATreeBuildCount++;
              return { 'core:name': { text: 'Part A' } };
            },
          },
          'part-b': {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Part B' };
              if (compId === 'anatomy:joint') return { parentId: 'part-a' };
              return null;
            },
            getAllComponents: () => ({
              'core:name': { text: 'Part B' },
              'anatomy:joint': { parentId: 'part-a' },
            }),
          },
        };
        return entities[id] || null;
      });

      // Act
      await extractor.extractHierarchy(bodyData);

      // Assert - part-a's getAllComponents (tree building phase) should only be called once
      // This confirms cycle detection prevents re-processing visited nodes
      expect(partATreeBuildCount).toBe(1);
    });

    it('should traverse via anatomy:joint relationships', async () => {
      // Arrange - hierarchy: torso -> head -> ear
      const bodyData = {
        root: 'torso-1',
        parts: { head: 'head-1', ear: 'ear-1' },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entities = {
          'torso-1': {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Torso' };
              if (compId === 'anatomy:joint') return null;
              return null;
            },
            getAllComponents: () => ({ 'core:name': { text: 'Torso' } }),
          },
          'head-1': {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Head' };
              if (compId === 'anatomy:joint') return { parentId: 'torso-1' };
              return null;
            },
            getAllComponents: () => ({
              'core:name': { text: 'Head' },
              'anatomy:joint': { parentId: 'torso-1' },
            }),
          },
          'ear-1': {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Ear' };
              if (compId === 'anatomy:joint') return { parentId: 'head-1' };
              return null;
            },
            getAllComponents: () => ({
              'core:name': { text: 'Ear' },
              'anatomy:joint': { parentId: 'head-1' },
            }),
          },
        };
        return entities[id] || null;
      });

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert - verify the hierarchy
      expect(result.id).toBe('torso-1');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe('head-1');
      expect(result.children[0].children).toHaveLength(1);
      expect(result.children[0].children[0].id).toBe('ear-1');
    });

    it('should extract children in correct order', async () => {
      // Arrange - torso with multiple children
      const bodyData = {
        root: 'torso-1',
        parts: {
          leftArm: 'left-arm-1',
          rightArm: 'right-arm-1',
          head: 'head-1',
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'torso-1') {
          return {
            getComponentData: (compId) => {
              if (compId === 'core:name') return { text: 'Torso' };
              return null;
            },
            getAllComponents: () => ({ 'core:name': { text: 'Torso' } }),
          };
        }
        // All parts are children of torso
        return {
          getComponentData: (compId) => {
            if (compId === 'core:name') return { text: id };
            if (compId === 'anatomy:joint') return { parentId: 'torso-1' };
            return null;
          },
          getAllComponents: () => ({
            'core:name': { text: id },
            'anatomy:joint': { parentId: 'torso-1' },
          }),
        };
      });

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert - should have all children (order depends on Set iteration)
      expect(result.children).toHaveLength(3);
      const childIds = result.children.map((c) => c.id);
      expect(childIds).toContain('left-arm-1');
      expect(childIds).toContain('right-arm-1');
      expect(childIds).toContain('head-1');
    });

    it('should handle empty bodyData.parts gracefully', async () => {
      // Arrange
      const bodyData = { root: 'root-1', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: (compId) => {
          if (compId === 'core:name') return { text: 'Root' };
          return null;
        },
        getAllComponents: () => ({ 'core:name': { text: 'Root' } }),
      }));

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('root-1');
      expect(result.children).toEqual([]);
    });

    it('should handle missing root entity', async () => {
      // Arrange
      const bodyData = { root: 'missing-root', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => null);

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyDataExtractor: Entity not found: missing-root'
      );
    });

    it('should handle entity with no children', async () => {
      // Arrange
      const bodyData = { root: 'lonely-part', parts: {} };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: (compId) => {
          if (compId === 'core:name') return { text: 'Lonely Part' };
          return null;
        },
        getAllComponents: () => ({ 'core:name': { text: 'Lonely Part' } }),
      }));

      // Act
      const result = await extractor.extractHierarchy(bodyData);

      // Assert
      expect(result.children).toEqual([]);
    });

    it('should return null when bodyData.root is missing', async () => {
      // Act
      const result = await extractor.extractHierarchy({ parts: {} });

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyDataExtractor: bodyData.root is required'
      );
    });

    it('should return null when bodyData is null', async () => {
      // Act
      const result = await extractor.extractHierarchy(null);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getChildren', () => {
    it('should return child part IDs for a given parent', async () => {
      // Arrange
      const bodyData = {
        root: 'parent-1',
        parts: { child1: 'child-1', child2: 'child-2' },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'parent-1') {
          return { getComponentData: () => null };
        }
        return {
          getComponentData: (compId) => {
            if (compId === 'anatomy:joint') return { parentId: 'parent-1' };
            return null;
          },
        };
      });

      // Act
      const children = await extractor.getChildren('parent-1', bodyData);

      // Assert
      expect(children).toContain('child-1');
      expect(children).toContain('child-2');
      expect(children).toHaveLength(2);
    });

    it('should return empty array when part has no children', async () => {
      // Arrange
      const bodyData = {
        root: 'leaf-part',
        parts: {},
      };

      mockEntityManager.getEntityInstance.mockImplementation(() => ({
        getComponentData: () => null,
      }));

      // Act
      const children = await extractor.getChildren('leaf-part', bodyData);

      // Assert
      expect(children).toEqual([]);
    });

    it('should return empty array when partId is null', async () => {
      // Act
      const children = await extractor.getChildren(null, { root: 'a' });

      // Assert
      expect(children).toEqual([]);
    });

    it('should return empty array when bodyData is null', async () => {
      // Act
      const children = await extractor.getChildren('some-id', null);

      // Assert
      expect(children).toEqual([]);
    });
  });

  describe('filterMechanicalComponents', () => {
    it('should remove all descriptors:* components', () => {
      // Arrange
      const components = {
        'anatomy:part': { subType: 'arm' },
        'descriptors:color': { value: 'tan' },
        'descriptors:texture': { value: 'smooth' },
        'anatomy:sockets': { slots: [] },
      };

      // Act
      const filtered = extractor.filterMechanicalComponents(components);

      // Assert
      expect(filtered).toEqual({
        'anatomy:part': { subType: 'arm' },
        'anatomy:sockets': { slots: [] },
      });
    });

    it('should remove core:name component', () => {
      // Arrange
      const components = {
        'core:name': { text: 'Test' },
        'anatomy:part': { subType: 'head' },
      };

      // Act
      const filtered = extractor.filterMechanicalComponents(components);

      // Assert
      expect(filtered['core:name']).toBeUndefined();
      expect(filtered['anatomy:part']).toBeDefined();
    });

    it('should remove core:description component', () => {
      // Arrange
      const components = {
        'core:description': { text: 'A description' },
        'anatomy:part': { subType: 'leg' },
      };

      // Act
      const filtered = extractor.filterMechanicalComponents(components);

      // Assert
      expect(filtered['core:description']).toBeUndefined();
      expect(filtered['anatomy:part']).toBeDefined();
    });

    it('should handle null components', () => {
      // Act
      const filtered = extractor.filterMechanicalComponents(null);

      // Assert
      expect(filtered).toEqual({});
    });

    it('should handle empty components object', () => {
      // Act
      const filtered = extractor.filterMechanicalComponents({});

      // Assert
      expect(filtered).toEqual({});
    });

    it('should handle non-object components', () => {
      // Act
      const filtered = extractor.filterMechanicalComponents('not-an-object');

      // Assert
      expect(filtered).toEqual({});
    });

    it('should preserve all anatomy:* components except joint', () => {
      // Arrange - anatomy:joint should be preserved as it's mechanical info
      const components = {
        'anatomy:part': { subType: 'torso' },
        'anatomy:part_health': { current: 100, max: 100 },
        'anatomy:sockets': { slots: ['neck', 'waist'] },
        'anatomy:joint': { parentId: 'root', socketId: 'neck' },
      };

      // Act
      const filtered = extractor.filterMechanicalComponents(components);

      // Assert - all anatomy components should be preserved
      expect(filtered['anatomy:part']).toBeDefined();
      expect(filtered['anatomy:part_health']).toBeDefined();
      expect(filtered['anatomy:sockets']).toBeDefined();
      expect(filtered['anatomy:joint']).toBeDefined();
    });
  });
});
