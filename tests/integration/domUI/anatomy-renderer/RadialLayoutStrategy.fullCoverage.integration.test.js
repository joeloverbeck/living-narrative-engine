import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RadialLayoutStrategy from '../../../../src/domUI/anatomy-renderer/layouts/RadialLayoutStrategy.js';
import AnatomyNode from '../../../../src/domUI/anatomy-renderer/types/AnatomyNode.js';
import AnatomyEdge from '../../../../src/domUI/anatomy-renderer/types/AnatomyEdge.js';
import RenderContext from '../../../../src/domUI/anatomy-renderer/types/RenderContext.js';

/**
 * @returns {import('../../../../src/interfaces/coreServices.js').ILogger}
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('RadialLayoutStrategy integration coverage', () => {
  /** @type {ReturnType<typeof createTestLogger>} */
  let logger;
  /** @type {RadialLayoutStrategy} */
  let strategy;
  /** @type {RenderContext} */
  let renderContext;

  beforeEach(() => {
    logger = createTestLogger();
    strategy = new RadialLayoutStrategy({ logger });
    renderContext = new RenderContext();
  });

  const createNode = (id, depth, name = id, type = 'torso') =>
    new AnatomyNode(id, name, type, depth);

  const mapFromNodes = (...nodes) => new Map(nodes.map((n) => [n.id, n]));

  it('lays out a hierarchical anatomy graph and updates viewport & required space', () => {
    const root = createNode('root', 0, 'Torso', 'torso');
    const leftArm = createNode('leftArm', 1, 'Left Arm', 'arm');
    const rightArm = createNode('rightArm', 1, 'Right Arm', 'arm');
    const leftHand = createNode('leftHand', 2, 'Left Hand', 'hand');
    const rightHand = createNode('rightHand', 2, 'Right Hand', 'hand');

    const nodes = mapFromNodes(root, leftArm, rightArm, leftHand, rightHand);
    const edges = [
      new AnatomyEdge('root', 'leftArm', 'shoulder-left'),
      new AnatomyEdge('root', 'rightArm', 'shoulder-right'),
      new AnatomyEdge('leftArm', 'leftHand', 'wrist-left'),
      new AnatomyEdge('rightArm', 'rightHand', 'wrist-right'),
    ];

    strategy.calculate(nodes, edges, renderContext);

    expect(root.x).toBeCloseTo(600);
    expect(root.y).toBeCloseTo(400);

    for (const node of nodes.values()) {
      expect(node.angleEnd).not.toBe(node.angleStart);
      expect(node.radius).toBeGreaterThanOrEqual(0);
    }

    const requiredSpace = strategy.getRequiredSpace();
    expect(requiredSpace.width).toBeGreaterThan(0);
    expect(requiredSpace.height).toBeGreaterThan(0);

    expect(renderContext.viewport.width).toBe(renderContext.viewport.height);
    expect(logger.debug).toHaveBeenCalledWith(
      'RadialLayoutStrategy: Layout calculation completed'
    );
  });

  it('enforces minimum angle spacing and crowding radius for dense levels', () => {
    const root = createNode('root', 0);
    const childCount = 24;
    const nodes = mapFromNodes(root);
    const edges = [];

    strategy.configure({ baseRadius: 120, minAngle: 0.45 });

    for (let i = 0; i < childCount; i += 1) {
      const child = createNode(`child-${i}`, 1, `Child ${i}`, 'arm');
      nodes.set(child.id, child);
      edges.push(new AnatomyEdge('root', child.id, `socket-${i}`));
    }

    // add duplicate edge and self-loop to exercise safety guards
    edges.push(new AnatomyEdge('root', 'child-0', 'duplicate-socket'));
    edges.push(new AnatomyEdge('root', 'root', 'self-loop'));

    strategy.calculate(nodes, edges, renderContext);

    const firstChild = nodes.get('child-0');
    expect(firstChild).toBeDefined();
    if (firstChild) {
      const expectedRadius = 120 * ((childCount + 1) / 8);
      expect(firstChild.radius).toBeCloseTo(expectedRadius);
      expect(firstChild.angleEnd - firstChild.angleStart).toBeGreaterThanOrEqual(0.45);
    }

    const angles = Array.from(nodes.values())
      .filter((node) => node.depth === 1)
      .map((node) => node.angleEnd - node.angleStart);
    expect(Math.min(...angles)).toBeGreaterThanOrEqual(0.45 - 1e-6);
  });

  it('handles cyclical graphs without infinite recursion', () => {
    const root = createNode('root', 0);
    const child = createNode('child', 1);

    const nodes = mapFromNodes(root, child);
    const edges = [
      new AnatomyEdge('root', 'child', 'socket'),
      new AnatomyEdge('child', 'root', 'socket-back'),
    ];

    strategy.calculate(nodes, edges, renderContext);

    expect(root.leafCount).toBeGreaterThanOrEqual(1);
    expect(child.leafCount).toBeGreaterThanOrEqual(1);
  });

  it('skips layout gracefully when nodes are missing or lack roots', () => {
    const emptyNodes = new Map();
    strategy.calculate(emptyNodes, [], renderContext);
    expect(logger.warn).not.toHaveBeenCalled();

    const childOnly = mapFromNodes(createNode('floating', 1));
    strategy.calculate(childOnly, [], renderContext);
    expect(logger.warn).toHaveBeenCalledWith(
      'RadialLayoutStrategy: No root nodes found'
    );
    expect(childOnly.get('floating')?.x).toBe(0);
  });

  it('allows configuration updates and returns copies for required space', () => {
    const root = createNode('root', 0);
    const child = createNode('child', 1);
    const nodes = mapFromNodes(root, child);
    const edges = [new AnatomyEdge('root', 'child', 'socket')];

    strategy.configure({ centerX: 200, centerY: 100, baseRadius: 200, minAngle: 0.2 });
    strategy.calculate(nodes, edges, renderContext);

    expect(root.x).toBeCloseTo(200);
    expect(root.y).toBeCloseTo(100);

    const spaceBefore = strategy.getRequiredSpace();
    spaceBefore.width = -10;
    expect(strategy.getRequiredSpace().width).not.toBe(-10);
    expect(strategy.getName()).toBe('radial');
  });
});
