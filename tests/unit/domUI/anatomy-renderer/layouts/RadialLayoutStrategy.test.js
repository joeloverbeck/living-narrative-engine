/**
 * @file Unit tests for RadialLayoutStrategy
 * @description Tests the radial layout algorithm for anatomy visualization
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RadialLayoutStrategy from '../../../../../src/domUI/anatomy-renderer/layouts/RadialLayoutStrategy.js';
import AnatomyNode from '../../../../../src/domUI/anatomy-renderer/types/AnatomyNode.js';
import AnatomyEdge from '../../../../../src/domUI/anatomy-renderer/types/AnatomyEdge.js';
import RenderContext from '../../../../../src/domUI/anatomy-renderer/types/RenderContext.js';

describe('RadialLayoutStrategy', () => {
  let strategy;
  let mockLogger;
  let renderContext;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    strategy = new RadialLayoutStrategy({ logger: mockLogger });

    // Create a mock render context
    renderContext = new RenderContext();
    renderContext.options.nodeRadius = 20;
    renderContext.updateViewport = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => new RadialLayoutStrategy({})).toThrow();
      expect(() => new RadialLayoutStrategy({ logger: null })).toThrow();
    });

    it('should initialize with default options', () => {
      const strategy = new RadialLayoutStrategy({ logger: mockLogger });
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('radial');
    });
  });

  describe('getName', () => {
    it('should return "radial"', () => {
      expect(strategy.getName()).toBe('radial');
    });
  });

  describe('configure', () => {
    it('should update options with provided values', () => {
      const options = {
        centerX: 800,
        centerY: 600,
        baseRadius: 200,
        minAngle: Math.PI / 8,
        crowdingFactor: 10,
      };

      strategy.configure(options);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RadialLayoutStrategy: Configuration updated',
        expect.objectContaining(options)
      );
    });

    it('should partially update options', () => {
      const options = { centerX: 1000 };
      strategy.configure(options);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RadialLayoutStrategy: Configuration updated',
        expect.objectContaining({ centerX: 1000 })
      );
    });
  });

  describe('getRequiredSpace', () => {
    it('should return a copy of required space', () => {
      const space1 = strategy.getRequiredSpace();
      const space2 = strategy.getRequiredSpace();

      expect(space1).toEqual({ width: 1200, height: 800 });
      expect(space1).not.toBe(space2); // Different objects
    });

    it('should update required space after calculate', () => {
      const nodes = new Map();
      const node = new AnatomyNode('root', { type: 'group', name: 'Root' });
      node.depth = 0;
      node.setPosition(100, 100);
      nodes.set('root', node);

      strategy.calculate(nodes, [], renderContext);

      const space = strategy.getRequiredSpace();
      expect(space.width).toBeGreaterThan(0);
      expect(space.height).toBeGreaterThan(0);
    });
  });

  describe('calculate', () => {
    it('should handle empty nodes gracefully', () => {
      const nodes = new Map();
      const edges = [];

      strategy.calculate(nodes, edges, renderContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RadialLayoutStrategy: Starting layout calculation',
        { nodeCount: 0, edgeCount: 0 }
      );
      expect(renderContext.updateViewport).not.toHaveBeenCalled();
    });

    it('should warn when no root nodes found', () => {
      const nodes = new Map();
      const node = new AnatomyNode('child', { type: 'group', name: 'Child' });
      node.depth = 1; // Not a root
      nodes.set('child', node);

      strategy.calculate(nodes, [], renderContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RadialLayoutStrategy: No root nodes found'
      );
    });

    it('should position single root node at center', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      nodes.set('root', root);

      strategy.calculate(nodes, [], renderContext);

      expect(root.x).toBe(600); // Default centerX
      expect(root.y).toBe(400); // Default centerY
      expect(root.angleStart).toBe(0);
      expect(root.angleEnd).toBe(2 * Math.PI);
    });

    it('should calculate layout for simple parent-child structure', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      const child = new AnatomyNode('child', { type: 'group', name: 'Child' });
      child.depth = 1;

      nodes.set('root', root);
      nodes.set('child', child);

      const edges = [new AnatomyEdge('root', 'child', 'contains')];

      strategy.calculate(nodes, edges, renderContext);

      // Root at center
      expect(root.x).toBe(600);
      expect(root.y).toBe(400);

      // Child positioned radially
      expect(child.x).not.toBe(600);
      // Y might be 400 if angle is 0 or π, so check that child was positioned
      expect(child.angle).toBeDefined();
      expect(child.angle).toBeGreaterThanOrEqual(0);
      expect(child.angle).toBeLessThanOrEqual(2 * Math.PI);
      expect(child.radius).toBeCloseTo(88); // 220 * 1 * 0.4 (baseRadius * depth * rootChildRadiusScale)
    });

    it('should distribute multiple children evenly', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;

      const child1 = new AnatomyNode('child1', {
        type: 'group',
        name: 'Child1',
      });
      child1.depth = 1;
      const child2 = new AnatomyNode('child2', {
        type: 'group',
        name: 'Child2',
      });
      child2.depth = 1;
      const child3 = new AnatomyNode('child3', {
        type: 'group',
        name: 'Child3',
      });
      child3.depth = 1;

      nodes.set('root', root);
      nodes.set('child1', child1);
      nodes.set('child2', child2);
      nodes.set('child3', child3);

      const edges = [
        new AnatomyEdge('root', 'child1', 'contains'),
        new AnatomyEdge('root', 'child2', 'contains'),
        new AnatomyEdge('root', 'child3', 'contains'),
      ];

      strategy.calculate(nodes, edges, renderContext);

      // Children should be distributed around the circle
      expect(child1.angle).toBeDefined();
      expect(child2.angle).toBeDefined();
      expect(child3.angle).toBeDefined();

      // All at same radius (220 * 1 * 0.4 = 88 for depth 1)
      expect(child1.radius).toBeCloseTo(88);
      expect(child2.radius).toBeCloseTo(88);
      expect(child3.radius).toBeCloseTo(88);

      // Different angles
      expect(child1.angle).not.toBe(child2.angle);
      expect(child2.angle).not.toBe(child3.angle);
    });

    it('should handle deep hierarchy', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      const child = new AnatomyNode('child', { type: 'group', name: 'Child' });
      child.depth = 1;
      const grandchild = new AnatomyNode('grandchild', {
        type: 'group',
        name: 'Grandchild',
      });
      grandchild.depth = 2;

      nodes.set('root', root);
      nodes.set('child', child);
      nodes.set('grandchild', grandchild);

      const edges = [
        new AnatomyEdge('root', 'child', 'contains'),
        new AnatomyEdge('child', 'grandchild', 'contains'),
      ];

      strategy.calculate(nodes, edges, renderContext);

      expect(root.x).toBe(600);
      expect(root.y).toBe(400);
      expect(child.radius).toBeCloseTo(88); // 220 * 1 * 0.4 (depth 1 with rootChildRadiusScale)
      expect(grandchild.radius).toBeCloseTo(440); // 220 * 2 * 1 (depth 2 with grandchild multiplier)
    });

    it('should calculate leaf counts correctly', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;

      const branch1 = new AnatomyNode('branch1', {
        type: 'group',
        name: 'Branch1',
      });
      branch1.depth = 1;
      const branch2 = new AnatomyNode('branch2', {
        type: 'group',
        name: 'Branch2',
      });
      branch2.depth = 1;

      const leaf1 = new AnatomyNode('leaf1', { type: 'item', name: 'Leaf1' });
      leaf1.depth = 2;
      const leaf2 = new AnatomyNode('leaf2', { type: 'item', name: 'Leaf2' });
      leaf2.depth = 2;
      const leaf3 = new AnatomyNode('leaf3', { type: 'item', name: 'Leaf3' });
      leaf3.depth = 2;

      nodes.set('root', root);
      nodes.set('branch1', branch1);
      nodes.set('branch2', branch2);
      nodes.set('leaf1', leaf1);
      nodes.set('leaf2', leaf2);
      nodes.set('leaf3', leaf3);

      const edges = [
        new AnatomyEdge('root', 'branch1', 'contains'),
        new AnatomyEdge('root', 'branch2', 'contains'),
        new AnatomyEdge('branch1', 'leaf1', 'contains'),
        new AnatomyEdge('branch1', 'leaf2', 'contains'),
        new AnatomyEdge('branch2', 'leaf3', 'contains'),
      ];

      strategy.calculate(nodes, edges, renderContext);

      // Leaf nodes should have leafCount = 1
      expect(leaf1.leafCount).toBe(1);
      expect(leaf2.leafCount).toBe(1);
      expect(leaf3.leafCount).toBe(1);

      // Branch nodes should sum their children
      expect(branch1.leafCount).toBe(2);
      expect(branch2.leafCount).toBe(1);

      // Root should have total
      expect(root.leafCount).toBe(3);
    });

    it('should enforce minimum angle between nodes', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;

      // Create many children to test crowding
      for (let i = 0; i < 20; i++) {
        const child = new AnatomyNode(`child${i}`, {
          type: 'item',
          name: `Child${i}`,
        });
        child.depth = 1;
        nodes.set(`child${i}`, child);
      }

      nodes.set('root', root);

      const edges = [];
      for (let i = 0; i < 20; i++) {
        edges.push(new AnatomyEdge('root', `child${i}`, 'contains'));
      }

      strategy.calculate(nodes, edges, renderContext);

      // With many children, angles are distributed evenly
      // Even with minAngle set, maxAnglePerChild (2π/20 = π/10) caps the spacing
      // to prevent overflow beyond the parent's angle range
      const child0 = nodes.get('child0');
      const child1 = nodes.get('child1');

      const angleDiff = Math.abs(child1.angle - child0.angle);
      // With 20 children in full circle: maxAnglePerChild = 2π/20 = π/10
      expect(angleDiff).toBeGreaterThanOrEqual(Math.PI / 10);
    });

    it('should apply crowding factor for many nodes', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;

      // Create enough children to trigger crowding
      for (let i = 0; i < 10; i++) {
        const child = new AnatomyNode(`child${i}`, {
          type: 'item',
          name: `Child${i}`,
        });
        child.depth = 1;
        nodes.set(`child${i}`, child);
      }

      nodes.set('root', root);

      const edges = [];
      for (let i = 0; i < 10; i++) {
        edges.push(new AnatomyEdge('root', `child${i}`, 'contains'));
      }

      strategy.calculate(nodes, edges, renderContext);

      // With 10 nodes and crowdingFactor of 6, radius should be increased
      const child0 = nodes.get('child0');
      expect(child0.radius).toBeGreaterThan(154); // More than base scaled radius
    });

    it('should update viewport to fit all nodes', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      const child = new AnatomyNode('child', { type: 'group', name: 'Child' });
      child.depth = 1;

      nodes.set('root', root);
      nodes.set('child', child);

      const edges = [new AnatomyEdge('root', 'child', 'contains')];

      strategy.calculate(nodes, edges, renderContext);

      expect(renderContext.updateViewport).toHaveBeenCalledWith(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        })
      );
    });

    it('should handle linear chain layout', () => {
      const nodes = new Map();
      const edges = [];

      // Create a linear chain: root -> child1 -> child2 -> child3
      for (let i = 0; i < 4; i++) {
        const node = new AnatomyNode(`node${i}`, {
          type: 'group',
          name: `Node${i}`,
        });
        node.depth = i;
        nodes.set(`node${i}`, node);

        if (i > 0) {
          edges.push(new AnatomyEdge(`node${i - 1}`, `node${i}`, 'contains'));
        }
      }

      strategy.calculate(nodes, edges, renderContext);

      // Each node should be at increasing radius
      expect(nodes.get('node0').x).toBe(600);
      expect(nodes.get('node0').y).toBe(400);
      expect(nodes.get('node1').radius).toBeCloseTo(88); // 220 * 1 * 0.4
      expect(nodes.get('node2').radius).toBeCloseTo(440); // 220 * 2 * 1
      expect(nodes.get('node3').radius).toBeCloseTo(660); // 220 * 3 * 1
    });

    it('should handle angle wrap-around near 2π', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      root.angleStart = (3 * Math.PI) / 2; // Start near end of circle
      root.angleEnd = (5 * Math.PI) / 2; // Wrap around

      const child = new AnatomyNode('child', { type: 'group', name: 'Child' });
      child.depth = 1;

      nodes.set('root', root);
      nodes.set('child', child);

      const edges = [new AnatomyEdge('root', 'child', 'contains')];

      strategy.calculate(nodes, edges, renderContext);

      // Child should be positioned correctly despite wrap-around
      expect(child.angle).toBeDefined();
      expect(child.x).toBeDefined();
      expect(child.y).toBeDefined();
    });

    it('should correctly convert polar to cartesian coordinates', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;

      // Position root at origin for easier calculation
      strategy.configure({ centerX: 0, centerY: 0 });

      const child = new AnatomyNode('child', { type: 'group', name: 'Child' });
      child.depth = 1;

      nodes.set('root', root);
      nodes.set('child', child);

      const edges = [new AnatomyEdge('root', 'child', 'contains')];

      strategy.calculate(nodes, edges, renderContext);

      // With root at origin, child position should match polar conversion
      // Radius is 88 (220 * 1 * 0.4) for depth 1
      const expectedX = 88 * Math.cos(child.angle);
      const expectedY = 88 * Math.sin(child.angle);

      expect(child.x).toBeCloseTo(expectedX, 5);
      expect(child.y).toBeCloseTo(expectedY, 5);
    });

    it('should allocate angles proportionally based on leaf counts', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;

      // Branch with many leaves
      const bigBranch = new AnatomyNode('bigBranch', {
        type: 'group',
        name: 'Big Branch',
      });
      bigBranch.depth = 1;

      // Branch with few leaves
      const smallBranch = new AnatomyNode('smallBranch', {
        type: 'group',
        name: 'Small Branch',
      });
      smallBranch.depth = 1;

      nodes.set('root', root);
      nodes.set('bigBranch', bigBranch);
      nodes.set('smallBranch', smallBranch);

      // Add leaves to big branch
      for (let i = 0; i < 5; i++) {
        const leaf = new AnatomyNode(`bigLeaf${i}`, {
          type: 'item',
          name: `Big Leaf ${i}`,
        });
        leaf.depth = 2;
        nodes.set(`bigLeaf${i}`, leaf);
      }

      // Add one leaf to small branch
      const smallLeaf = new AnatomyNode('smallLeaf', {
        type: 'item',
        name: 'Small Leaf',
      });
      smallLeaf.depth = 2;
      nodes.set('smallLeaf', smallLeaf);

      const edges = [
        new AnatomyEdge('root', 'bigBranch', 'contains'),
        new AnatomyEdge('root', 'smallBranch', 'contains'),
      ];

      // Add edges for leaves
      for (let i = 0; i < 5; i++) {
        edges.push(new AnatomyEdge('bigBranch', `bigLeaf${i}`, 'contains'));
      }
      edges.push(new AnatomyEdge('smallBranch', 'smallLeaf', 'contains'));

      strategy.calculate(nodes, edges, renderContext);

      // Big branch should have larger angle range
      const bigBranchAngleRange = bigBranch.angleEnd - bigBranch.angleStart;
      const smallBranchAngleRange =
        smallBranch.angleEnd - smallBranch.angleStart;

      expect(bigBranchAngleRange).toBeGreaterThan(smallBranchAngleRange);

      // With 2 children, maxAnglePerChild = π
      // bigBranch would get (5/6)*2π = 5.236 rad, but is clamped to π = 3.142 rad
      // smallBranch gets (1/6)*2π = 1.047 rad (under the limit)
      // Ratio is now 3.142 / 1.047 ≈ 3:1 (clamped to prevent overflow)
      const ratio = bigBranchAngleRange / smallBranchAngleRange;
      expect(ratio).toBeCloseTo(3, 0); // Clamped by maxAnglePerChild constraint
    });

    it('should update required space with padding', () => {
      const nodes = new Map();

      // Create nodes at extreme positions
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      const farChild = new AnatomyNode('farChild', {
        type: 'group',
        name: 'Far Child',
      });
      farChild.depth = 3; // Will be positioned far from center

      nodes.set('root', root);
      nodes.set('farChild', farChild);

      // Create intermediate nodes
      const mid1 = new AnatomyNode('mid1', { type: 'group', name: 'Mid 1' });
      mid1.depth = 1;
      const mid2 = new AnatomyNode('mid2', { type: 'group', name: 'Mid 2' });
      mid2.depth = 2;

      nodes.set('mid1', mid1);
      nodes.set('mid2', mid2);

      const edges = [
        new AnatomyEdge('root', 'mid1', 'contains'),
        new AnatomyEdge('mid1', 'mid2', 'contains'),
        new AnatomyEdge('mid2', 'farChild', 'contains'),
      ];

      strategy.calculate(nodes, edges, renderContext);

      const space = strategy.getRequiredSpace();

      // Should include padding (100 on each side = 200 total)
      expect(space.width).toBeGreaterThan(200);
      expect(space.height).toBeGreaterThan(200);
    });

    it('should reuse cached leaf counts for shared subtrees', () => {
      const nodes = new Map();

      const rootA = new AnatomyNode('rootA', { type: 'group', name: 'Root A' });
      rootA.depth = 0;
      const rootB = new AnatomyNode('rootB', { type: 'group', name: 'Root B' });
      rootB.depth = 0;
      const sharedBranch = new AnatomyNode('shared', {
        type: 'group',
        name: 'Shared Branch',
      });
      sharedBranch.depth = 1;
      const sharedLeaf = new AnatomyNode('sharedLeaf', {
        type: 'item',
        name: 'Shared Leaf',
      });
      sharedLeaf.depth = 2;

      nodes.set('rootA', rootA);
      nodes.set('rootB', rootB);
      nodes.set('shared', sharedBranch);
      nodes.set('sharedLeaf', sharedLeaf);

      let sharedLeafCountSetCalls = 0;
      let storedSharedLeafCount = 0;
      Object.defineProperty(sharedBranch, 'leafCount', {
        configurable: true,
        get() {
          return storedSharedLeafCount;
        },
        set(value) {
          sharedLeafCountSetCalls += 1;
          if (sharedLeafCountSetCalls > 1) {
            throw new Error(
              'Shared branch leaf count should be calculated once'
            );
          }
          storedSharedLeafCount = value;
        },
      });

      const edges = [
        new AnatomyEdge('rootA', 'shared', 'contains'),
        new AnatomyEdge('rootB', 'shared', 'contains'),
        new AnatomyEdge('shared', 'sharedLeaf', 'contains'),
      ];

      strategy.calculate(nodes, edges, renderContext);

      // Shared subtree should only contribute its leaf count once
      expect(sharedBranch.leafCount).toBe(1);
      expect(sharedLeafCountSetCalls).toBe(1);
      expect(rootA.leafCount).toBe(1);
      expect(rootB.leafCount).toBe(1);
    });

    it('should avoid repositioning nodes when cycles exist', () => {
      const nodes = new Map();

      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      const child = new AnatomyNode('child', { type: 'group', name: 'Child' });
      child.depth = 1;

      // Track how often the child is repositioned to ensure cycles are skipped
      const originalSetPosition = child.setPosition.bind(child);
      child.setPosition = jest.fn(originalSetPosition);

      nodes.set('root', root);
      nodes.set('child', child);

      const edges = [
        new AnatomyEdge('root', 'child', 'contains'),
        new AnatomyEdge('child', 'root', 'contains'),
      ];

      strategy.calculate(nodes, edges, renderContext);

      expect(child.setPosition).toHaveBeenCalledTimes(1);
      expect(renderContext.updateViewport).toHaveBeenCalled();
    });

    it('should default total leaves when parent leaf count becomes invalid', () => {
      const nodes = new Map();

      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      const childA = new AnatomyNode('childA', {
        type: 'group',
        name: 'Child A',
      });
      childA.depth = 1;
      const childB = new AnatomyNode('childB', {
        type: 'group',
        name: 'Child B',
      });
      childB.depth = 1;

      nodes.set('root', root);
      nodes.set('childA', childA);
      nodes.set('childB', childB);

      const edges = [
        new AnatomyEdge('root', 'childA', 'contains'),
        new AnatomyEdge('root', 'childB', 'contains'),
      ];

      const originalRootSetPosition = root.setPosition.bind(root);
      root.setPosition = jest.fn((x, y) => {
        root.leafCount = undefined;
        originalRootSetPosition(x, y);
      });

      strategy.calculate(nodes, edges, renderContext);

      expect(childA.angleEnd - childA.angleStart).toBeGreaterThan(0);
      expect(childB.angleEnd - childB.angleStart).toBeGreaterThan(0);
    });

    it('should skip viewport update when node collection reports empty', () => {
      const backingMap = new Map();

      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;

      backingMap.set('root', root);

      const nodesProxy = new Proxy(backingMap, {
        get(target, prop, receiver) {
          if (prop === 'size') {
            const stack = new Error().stack || '';
            if (stack.includes('RadialLayoutStrategy.size')) {
              return 0;
            }
            return target.size;
          }

          const value = Reflect.get(target, prop, receiver);
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        },
      });

      strategy.calculate(nodesProxy, [], renderContext);

      expect(renderContext.updateViewport).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle nodes with missing edges gracefully', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      const orphan = new AnatomyNode('orphan', {
        type: 'group',
        name: 'Orphan',
      });
      orphan.depth = 0; // Another root

      nodes.set('root', root);
      nodes.set('orphan', orphan);

      // No edges connecting them
      const edges = [];

      expect(() =>
        strategy.calculate(nodes, edges, renderContext)
      ).not.toThrow();

      // Both should be positioned at center
      expect(root.x).toBe(600);
      expect(root.y).toBe(400);
      expect(orphan.x).toBe(600);
      expect(orphan.y).toBe(400);
    });

    it('should handle self-referential edges gracefully', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      nodes.set('root', root);

      // Self-referential edge
      const edges = [new AnatomyEdge('root', 'root', 'contains')];

      expect(() =>
        strategy.calculate(nodes, edges, renderContext)
      ).not.toThrow();

      // Root should still be positioned at center
      expect(root.x).toBe(600);
      expect(root.y).toBe(400);
      // Leaf count should be at least 1
      expect(root.leafCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle circular dependencies gracefully', () => {
      const nodes = new Map();
      const nodeA = new AnatomyNode('nodeA', { type: 'group', name: 'Node A' });
      nodeA.depth = 0;
      const nodeB = new AnatomyNode('nodeB', { type: 'group', name: 'Node B' });
      nodeB.depth = 1;
      const nodeC = new AnatomyNode('nodeC', { type: 'group', name: 'Node C' });
      nodeC.depth = 2;

      nodes.set('nodeA', nodeA);
      nodes.set('nodeB', nodeB);
      nodes.set('nodeC', nodeC);

      // Create circular dependency: A -> B -> C -> B
      const edges = [
        new AnatomyEdge('nodeA', 'nodeB', 'contains'),
        new AnatomyEdge('nodeB', 'nodeC', 'contains'),
        new AnatomyEdge('nodeC', 'nodeB', 'contains'), // Creates cycle
      ];

      expect(() =>
        strategy.calculate(nodes, edges, renderContext)
      ).not.toThrow();

      // All nodes should have leaf counts
      expect(nodeA.leafCount).toBeDefined();
      expect(nodeB.leafCount).toBeDefined();
      expect(nodeC.leafCount).toBeDefined();
    });

    it('should handle invalid edge targets', () => {
      const nodes = new Map();
      const root = new AnatomyNode('root', { type: 'group', name: 'Root' });
      root.depth = 0;
      nodes.set('root', root);

      // Edge to non-existent node
      const edges = [new AnatomyEdge('root', 'nonexistent', 'contains')];

      expect(() =>
        strategy.calculate(nodes, edges, renderContext)
      ).not.toThrow();
    });
  });
});
