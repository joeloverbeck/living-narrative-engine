/**
 * @file tests/unit/domUI/AnatomyGraphRendererRadial.test.js
 * @description Unit tests for radial positioning in AnatomyGraphRenderer
 */

import AnatomyGraphRenderer from '../../../src/domUI/AnatomyGraphRenderer.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('AnatomyGraphRenderer - Radial Layout', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockDocument;
  let mockContainer;
  let mockSvg;

  beforeEach(() => {
    // Reset DOM mocks
    mockSvg = {
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      parentElement: null,
      querySelectorAll: jest.fn().mockReturnValue([]),
      addEventListener: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
      style: {},
      id: 'anatomy-graph',
    };

    mockContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
      scrollTop: 0,
    };

    mockDocument = {
      getElementById: jest.fn((id) => {
        if (id === 'anatomy-graph-container') return mockContainer;
        return null;
      }),
      createElementNS: jest.fn((ns, tagName) => {
        if (tagName === 'svg') {
          mockSvg.parentElement = mockContainer;
          return mockSvg;
        }
        return {
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          textContent: '',
          addEventListener: jest.fn(),
          querySelector: jest.fn(),
          style: {},
        };
      }),
      createElement: jest.fn((tagName) => ({
        className: '',
        style: {},
        innerHTML: '',
      })),
      addEventListener: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    renderer = new AnatomyGraphRenderer({
      logger: mockLogger,
      entityManager: mockEntityManager,
      documentContext: { document: mockDocument },
    });
  });

  describe('_calculateLeafCounts', () => {
    it('should calculate leaf counts correctly for a simple tree', async () => {
      // Arrange - Create a simple tree: root -> child -> grandchild
      const mockEntities = {
        root: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Root' };
            if (type === 'anatomy:part') return { subType: 'torso' };
            return null;
          }),
        },
        child: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Child' };
            if (type === 'anatomy:part') return { subType: 'head' };
            if (type === 'anatomy:joint') return { parentId: 'root' };
            return null;
          }),
        },
        grandchild: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Grandchild' };
            if (type === 'anatomy:part') return { subType: 'eye' };
            if (type === 'anatomy:joint') return { parentId: 'child' };
            return null;
          }),
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        Promise.resolve(mockEntities[id])
      );

      // Act
      await renderer.renderGraph('root', {
        root: 'root',
        parts: {
          child: 'child',
          grandchild: 'grandchild',
        },
      });

      // Assert - Access private members for testing
      const nodes = renderer._nodes;
      expect(nodes.get('grandchild').leafCount).toBe(1);
      expect(nodes.get('child').leafCount).toBe(1);
      expect(nodes.get('root').leafCount).toBe(1);
    });

    it('should calculate leaf counts correctly for a branched tree', async () => {
      // Arrange - Create a branched tree: root -> (leftChild, rightChild)
      const mockEntities = {
        root: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Root' };
            if (type === 'anatomy:part') return { subType: 'torso' };
            return null;
          }),
        },
        leftChild: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Left Child' };
            if (type === 'anatomy:part') return { subType: 'arm' };
            if (type === 'anatomy:joint') return { parentId: 'root' };
            return null;
          }),
        },
        rightChild: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Right Child' };
            if (type === 'anatomy:part') return { subType: 'arm' };
            if (type === 'anatomy:joint') return { parentId: 'root' };
            return null;
          }),
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        Promise.resolve(mockEntities[id])
      );

      // Act
      await renderer.renderGraph('root', {
        root: 'root',
        parts: {
          leftChild: 'leftChild',
          rightChild: 'rightChild',
        },
      });

      // Assert
      const nodes = renderer._nodes;
      expect(nodes.get('leftChild').leafCount).toBe(1);
      expect(nodes.get('rightChild').leafCount).toBe(1);
      expect(nodes.get('root').leafCount).toBe(2);
    });
  });

  describe('_polarToCartesian', () => {
    it('should convert polar coordinates correctly', () => {
      // Test basic angles
      const center = { x: 100, y: 100 };
      const radius = 50;

      // 0 radians (right)
      let result = renderer._polarToCartesian(center.x, center.y, radius, 0);
      expect(result.x).toBeCloseTo(150);
      expect(result.y).toBeCloseTo(100);

      // PI/2 radians (down - SVG coordinate system)
      result = renderer._polarToCartesian(
        center.x,
        center.y,
        radius,
        Math.PI / 2
      );
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(150);

      // PI radians (left)
      result = renderer._polarToCartesian(center.x, center.y, radius, Math.PI);
      expect(result.x).toBeCloseTo(50);
      expect(result.y).toBeCloseTo(100);

      // 3*PI/2 radians (up - SVG coordinate system)
      result = renderer._polarToCartesian(
        center.x,
        center.y,
        radius,
        (3 * Math.PI) / 2
      );
      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(50);
    });
  });

  describe('_calculateMinimumRadius', () => {
    it('should calculate radius based on depth and node count', () => {
      // Base case
      expect(renderer._calculateMinimumRadius(1, 1)).toBe(150);

      // Deeper level
      expect(renderer._calculateMinimumRadius(2, 1)).toBe(300);

      // Crowded level
      expect(renderer._calculateMinimumRadius(1, 16)).toBe(300); // 150 * 1 * 2

      // Deep and crowded
      expect(renderer._calculateMinimumRadius(3, 24)).toBe(1350); // 150 * 3 * 3
    });
  });

  describe('Radial positioning', () => {
    it('should position root node at center', async () => {
      // Arrange
      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Root' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act
      await renderer.renderGraph('root', {
        root: 'root',
        parts: {},
      });

      // Assert
      const rootNode = renderer._nodes.get('root');
      expect(rootNode.x).toBe(600);
      expect(rootNode.y).toBe(400);
    });

    it('should position children in a circle around parent', async () => {
      // Arrange - root with 4 children
      const mockEntities = {
        root: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Root' };
            if (type === 'anatomy:part') return { subType: 'torso' };
            return null;
          }),
        },
      };

      // Create 4 children
      for (let i = 1; i <= 4; i++) {
        mockEntities[`child${i}`] = {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: `Child ${i}` };
            if (type === 'anatomy:part') return { subType: 'arm' };
            if (type === 'anatomy:joint') return { parentId: 'root' };
            return null;
          }),
        };
      }

      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        Promise.resolve(mockEntities[id])
      );

      // Act
      await renderer.renderGraph('root', {
        root: 'root',
        parts: {
          child1: 'child1',
          child2: 'child2',
          child3: 'child3',
          child4: 'child4',
        },
      });

      // Assert - children should be at radius 150 from center
      const rootNode = renderer._nodes.get('root');
      const expectedRadius = 150;

      for (let i = 1; i <= 4; i++) {
        const child = renderer._nodes.get(`child${i}`);
        const dx = child.x - rootNode.x;
        const dy = child.y - rootNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeCloseTo(expectedRadius, 1);
      }
    });

    it('should handle single node with no children', async () => {
      // Arrange
      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Lonely Node' };
          if (type === 'anatomy:part') return { subType: 'torso' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Act
      await renderer.renderGraph('lonely', {
        root: 'lonely',
        parts: {},
      });

      // Assert - should not throw and node should be centered
      const node = renderer._nodes.get('lonely');
      expect(node.x).toBe(600);
      expect(node.y).toBe(400);
      expect(node.leafCount).toBe(1);
    });

    it('should handle linear chain correctly', async () => {
      // Arrange - Create a linear chain: A -> B -> C -> D
      const mockEntities = {
        A: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'A' };
            if (type === 'anatomy:part') return { subType: 'torso' };
            return null;
          }),
        },
        B: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'B' };
            if (type === 'anatomy:part') return { subType: 'head' };
            if (type === 'anatomy:joint') return { parentId: 'A' };
            return null;
          }),
        },
        C: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'C' };
            if (type === 'anatomy:part') return { subType: 'eye' };
            if (type === 'anatomy:joint') return { parentId: 'B' };
            return null;
          }),
        },
        D: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'D' };
            if (type === 'anatomy:part') return { subType: 'hair' };
            if (type === 'anatomy:joint') return { parentId: 'C' };
            return null;
          }),
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        Promise.resolve(mockEntities[id])
      );

      // Act
      await renderer.renderGraph('A', {
        root: 'A',
        parts: {
          B: 'B',
          C: 'C',
          D: 'D',
        },
      });

      // Assert - each node should be progressively further from center
      const nodeA = renderer._nodes.get('A');
      const nodeB = renderer._nodes.get('B');
      const nodeC = renderer._nodes.get('C');
      const nodeD = renderer._nodes.get('D');

      expect(nodeA.x).toBe(600);
      expect(nodeA.y).toBe(400);

      // B should be at radius 150
      const distB = Math.sqrt(
        Math.pow(nodeB.x - nodeA.x, 2) + Math.pow(nodeB.y - nodeA.y, 2)
      );
      expect(distB).toBeCloseTo(150, 1);

      // C should be at appropriate radius from B (depth-based)
      const distC = Math.sqrt(
        Math.pow(nodeC.x - nodeB.x, 2) + Math.pow(nodeC.y - nodeB.y, 2)
      );
      expect(distC).toBeGreaterThan(100); // Minimum distance

      // D should be at appropriate radius from C (depth-based)
      const distD = Math.sqrt(
        Math.pow(nodeD.x - nodeC.x, 2) + Math.pow(nodeD.y - nodeC.y, 2)
      );
      expect(distD).toBeGreaterThan(100); // Minimum distance

      // All nodes should be at increasing distances from root
      const distBFromRoot = Math.sqrt(
        Math.pow(nodeB.x - nodeA.x, 2) + Math.pow(nodeB.y - nodeA.y, 2)
      );
      const distCFromRoot = Math.sqrt(
        Math.pow(nodeC.x - nodeA.x, 2) + Math.pow(nodeC.y - nodeA.y, 2)
      );
      const distDFromRoot = Math.sqrt(
        Math.pow(nodeD.x - nodeA.x, 2) + Math.pow(nodeD.y - nodeA.y, 2)
      );

      expect(distCFromRoot).toBeGreaterThan(distBFromRoot);
      expect(distDFromRoot).toBeGreaterThan(distCFromRoot);
    });
  });

  describe('Edge cases', () => {
    it('should handle unbalanced tree', async () => {
      // Arrange - Create unbalanced tree: root -> (left has 3 children, right has 1 child)
      const mockEntities = {
        root: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Root' };
            if (type === 'anatomy:part') return { subType: 'torso' };
            return null;
          }),
        },
        left: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Left' };
            if (type === 'anatomy:part') return { subType: 'arm' };
            if (type === 'anatomy:joint') return { parentId: 'root' };
            return null;
          }),
        },
        right: {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: 'Right' };
            if (type === 'anatomy:part') return { subType: 'arm' };
            if (type === 'anatomy:joint') return { parentId: 'root' };
            return null;
          }),
        },
      };

      // Add 3 children to left
      for (let i = 1; i <= 3; i++) {
        mockEntities[`left-child${i}`] = {
          getComponentData: jest.fn((type) => {
            if (type === 'core:name') return { text: `Left Child ${i}` };
            if (type === 'anatomy:part') return { subType: 'hand' };
            if (type === 'anatomy:joint') return { parentId: 'left' };
            return null;
          }),
        };
      }

      // Add 1 child to right
      mockEntities['right-child1'] = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:name') return { text: 'Right Child 1' };
          if (type === 'anatomy:part') return { subType: 'hand' };
          if (type === 'anatomy:joint') return { parentId: 'right' };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        Promise.resolve(mockEntities[id])
      );

      // Act
      await renderer.renderGraph('root', {
        root: 'root',
        parts: {
          left: 'left',
          right: 'right',
          'left-child1': 'left-child1',
          'left-child2': 'left-child2',
          'left-child3': 'left-child3',
          'right-child1': 'right-child1',
        },
      });

      // Assert - left should get more angle allocation due to more leaf nodes
      const leftNode = renderer._nodes.get('left');
      const rightNode = renderer._nodes.get('right');

      // Left should have larger angle range (3 leaves vs 1 leaf)
      expect(leftNode.angleEnd - leftNode.angleStart).toBeGreaterThan(
        rightNode.angleEnd - rightNode.angleStart
      );
    });
  });
});
