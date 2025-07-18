/**
 * @file RadialLayoutStrategy for anatomy visualization
 * @see ../LayoutEngine.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../types/AnatomyNode.js').default} AnatomyNode */
/** @typedef {import('../types/AnatomyEdge.js').default} AnatomyEdge */
/** @typedef {import('../types/RenderContext.js').default} RenderContext */

/**
 * Radial layout strategy for anatomy visualization.
 * Arranges nodes in a radial tree structure with the root at center.
 */
class RadialLayoutStrategy {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger');

    this.#logger = logger;
    this.#options = {
      centerX: 600,
      centerY: 400,
      baseRadius: 150,
      minAngle: Math.PI / 10, // 18 degrees minimum
      crowdingFactor: 8, // Node count threshold for spacing adjustment
    };
    this.#requiredSpace = { width: 1200, height: 800 };
  }

  /** @type {ILogger} */
  #logger;

  /** @type {object} */
  #options;

  /** @type {{width: number, height: number}} */
  #requiredSpace;

  /**
   * Get strategy name
   *
   * @returns {string} Strategy name
   */
  getName() {
    return 'radial';
  }

  /**
   * Calculate radial layout for nodes and edges
   *
   * @param {Map<string, AnatomyNode>} nodes - Nodes to layout
   * @param {Array<AnatomyEdge>} edges - Edges between nodes
   * @param {RenderContext} renderContext - Rendering context
   */
  calculate(nodes, edges, renderContext) {
    this.#logger.debug('RadialLayoutStrategy: Starting layout calculation', {
      nodeCount: nodes.size,
      edgeCount: edges.length,
    });

    if (nodes.size === 0) {
      return;
    }

    // First, calculate leaf counts for all nodes
    this.#calculateLeafCounts(nodes, edges);

    // Initialize radial properties for all nodes
    for (const node of nodes.values()) {
      node.angle = 0;
      node.radius = 0;
      node.angleStart = 0;
      node.angleEnd = 0;
    }

    // Find root nodes (nodes with depth 0)
    const roots = Array.from(nodes.values()).filter((n) => n.depth === 0);

    if (roots.length === 0) {
      this.#logger.warn('RadialLayoutStrategy: No root nodes found');
      return;
    }

    // Position root at center
    roots.forEach((root) => {
      root.setPosition(this.#options.centerX, this.#options.centerY);
      root.angleStart = 0;
      root.angleEnd = 2 * Math.PI;

      // Recursively position children
      this.#positionChildrenRadially(root, nodes, edges);
    });

    // Update required space based on actual layout
    this.#updateRequiredSpace(nodes);

    // Update viewport to fit content
    this.#updateViewportToFitContent(nodes, renderContext);

    this.#logger.debug('RadialLayoutStrategy: Layout calculation completed');
  }

  /**
   * Configure strategy options
   *
   * @param {object} options - Configuration options
   * @param {number} [options.centerX] - Center X coordinate
   * @param {number} [options.centerY] - Center Y coordinate
   * @param {number} [options.baseRadius] - Base radius for each depth level
   * @param {number} [options.minAngle] - Minimum angle between nodes
   * @param {number} [options.crowdingFactor] - Node count threshold for spacing
   */
  configure(options) {
    Object.assign(this.#options, options);
    this.#logger.debug(
      'RadialLayoutStrategy: Configuration updated',
      this.#options
    );
  }

  /**
   * Get required space for layout
   *
   * @returns {{width: number, height: number}} Required space
   */
  getRequiredSpace() {
    return { ...this.#requiredSpace };
  }

  /**
   * Calculate leaf counts for all nodes (post-order traversal)
   *
   * @private
   * @param {Map<string, AnatomyNode>} nodes - All nodes
   * @param {Array<AnatomyEdge>} edges - All edges
   */
  #calculateLeafCounts(nodes, edges) {
    // Build a map of parent -> children relationships
    const childrenMap = new Map();
    for (const edge of edges) {
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source).push(edge.target);
    }

    // Track visited nodes to prevent infinite recursion
    const visited = new Set();
    const visiting = new Set();

    // Post-order traversal to calculate leaf counts
    const calculateLeafCount = (nodeId) => {
      const node = nodes.get(nodeId);
      if (!node) return 0;

      // If already calculated, return the stored value
      if (visited.has(nodeId)) {
        return node.leafCount || 0;
      }

      // If currently visiting this node, we have a cycle
      if (visiting.has(nodeId)) {
        // Treat cyclic nodes as having no additional leaf contribution
        return 0;
      }

      visiting.add(nodeId);

      const children = childrenMap.get(nodeId) || [];
      if (children.length === 0) {
        // Leaf node
        node.leafCount = 1;
      } else {
        // Sum children's leaf counts
        let totalLeafCount = 0;
        for (const childId of children) {
          // Skip self-references
          if (childId !== nodeId) {
            totalLeafCount += calculateLeafCount(childId);
          }
        }
        node.leafCount = totalLeafCount || 1; // Ensure at least 1 for non-leaf nodes
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      return node.leafCount;
    };

    // Find root nodes (nodes with depth 0)
    for (const node of nodes.values()) {
      if (node.depth === 0) {
        calculateLeafCount(node.id);
      }
    }
  }

  /**
   * Get direct children of a node
   *
   * @private
   * @param {string} parentId - Parent node ID
   * @param {Map<string, AnatomyNode>} nodes - All nodes
   * @param {Array<AnatomyEdge>} edges - All edges
   * @returns {Array<AnatomyNode>} Direct children
   */
  #getDirectChildren(parentId, nodes, edges) {
    const children = [];
    for (const edge of edges) {
      if (edge.source === parentId && edge.target !== parentId) {
        const childNode = nodes.get(edge.target);
        if (childNode) {
          children.push(childNode);
        }
      }
    }
    return children;
  }

  /**
   * Recursively position children in a radial layout
   *
   * @private
   * @param {AnatomyNode} parent - Parent node
   * @param {Map<string, AnatomyNode>} nodes - All nodes
   * @param {Array<AnatomyEdge>} edges - All edges
   * @param {Set<string>} [positioned] - Set of already positioned nodes to prevent cycles
   */
  #positionChildrenRadially(parent, nodes, edges, positioned = new Set()) {
    // Prevent infinite recursion by tracking positioned nodes
    if (positioned.has(parent.id)) {
      return;
    }
    positioned.add(parent.id);

    const children = this.#getDirectChildren(parent.id, nodes, edges);
    if (children.length === 0) return;

    // Calculate radius for this depth level
    const radius = this.#calculateMinimumRadius(
      parent.depth + 1,
      children.length
    );

    // Calculate angle range for each child based on leaf count
    const parentAngleRange = parent.angleEnd - parent.angleStart;
    const totalLeaves = parent.leafCount || 1;

    let currentAngle = parent.angleStart;

    children.forEach((child) => {
      // Skip if this child has already been positioned (cycle detection)
      if (positioned.has(child.id)) {
        return;
      }

      // Proportional angle allocation based on leaf count
      const childAngleRange =
        (child.leafCount / totalLeaves) * parentAngleRange;

      // Enforce minimum angle to prevent overlap
      const actualAngleRange = Math.max(
        childAngleRange,
        this.#options.minAngle
      );

      // Position at center of allocated range
      const childAngle = currentAngle + actualAngleRange / 2;

      // Convert to cartesian coordinates
      const pos = this.#polarToCartesian(
        parent.x,
        parent.y,
        radius,
        childAngle
      );
      child.setPosition(pos.x, pos.y);
      child.setRadialProperties({
        angle: childAngle,
        radius,
        angleStart: currentAngle,
        angleEnd: currentAngle + actualAngleRange,
      });

      currentAngle += actualAngleRange;

      // Recursively position grandchildren
      this.#positionChildrenRadially(child, nodes, edges, positioned);
    });
  }

  /**
   * Calculate minimum radius for a given depth level
   *
   * @private
   * @param {number} depth - Depth level
   * @param {number} nodeCount - Number of nodes at this level
   * @returns {number} Calculated radius
   */
  #calculateMinimumRadius(depth, nodeCount) {
    // Additional spacing for crowded levels
    const crowdingFactor = Math.max(
      1,
      nodeCount / this.#options.crowdingFactor
    );
    return this.#options.baseRadius * depth * crowdingFactor;
  }

  /**
   * Convert polar coordinates to cartesian
   *
   * @private
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @param {number} radius - Distance from center
   * @param {number} angle - Angle in radians
   * @returns {{x: number, y: number}} Cartesian coordinates
   */
  #polarToCartesian(centerX, centerY, radius, angle) {
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  }

  /**
   * Update required space based on actual layout
   *
   * @private
   * @param {Map<string, AnatomyNode>} nodes - All nodes
   */
  #updateRequiredSpace(nodes) {
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    for (const node of nodes.values()) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }

    const padding = 100;
    this.#requiredSpace = {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }

  /**
   * Update viewport to ensure all nodes are visible
   *
   * @private
   * @param {Map<string, AnatomyNode>} nodes - All nodes
   * @param {RenderContext} renderContext - Rendering context
   */
  #updateViewportToFitContent(nodes, renderContext) {
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;
    const nodeRadius = renderContext.options.nodeRadius;
    const padding = 100;

    for (const node of nodes.values()) {
      minX = Math.min(minX, node.x - nodeRadius);
      minY = Math.min(minY, node.y - nodeRadius);
      maxX = Math.max(maxX, node.x + nodeRadius);
      maxY = Math.max(maxY, node.y + nodeRadius);
    }

    if (nodes.size > 0) {
      // Calculate dimensions
      const width = maxX - minX + padding * 2;
      const height = maxY - minY + padding * 2;

      // For radial layouts, ensure viewBox is roughly square
      const maxDimension = Math.max(width, height);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      renderContext.updateViewport({
        x: centerX - maxDimension / 2,
        y: centerY - maxDimension / 2,
        width: maxDimension,
        height: maxDimension,
      });
    }
  }
}

export default RadialLayoutStrategy;
