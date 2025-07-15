/**
 * @file SVGRenderer for anatomy visualization
 * @see VisualizationComposer.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { DomUtils } from '../../utils/domUtils.js';
import { AnatomyRenderError } from '../../errors/anatomyRenderError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('./types/AnatomyNode.js').default} AnatomyNode */
/** @typedef {import('./types/AnatomyEdge.js').default} AnatomyEdge */
/** @typedef {import('./types/RenderContext.js').default} RenderContext */

/**
 * Handles all SVG DOM manipulation for anatomy visualization.
 * Provides methods for creating and managing SVG elements.
 */
class SVGRenderer {
  /**
   * @param {object} dependencies
   * @param {IDocumentContext} dependencies.documentContext
   * @param {ILogger} dependencies.logger
   */
  constructor({ documentContext, logger }) {
    validateDependency(documentContext, 'IDocumentContext');
    validateDependency(logger, 'ILogger');

    this.#document = documentContext.document;
    this.#logger = logger;
    this.#svg = null;
    this.#defs = null;
    this.#layers = new Map();
    this.#tooltip = null;
    this.#container = null;
  }

  /** @type {Document} */
  #document;

  /** @type {ILogger} */
  #logger;

  /** @type {SVGElement|null} */
  #svg;

  /** @type {SVGDefsElement|null} */
  #defs;

  /** @type {Map<string, SVGGElement>} */
  #layers;

  /** @type {HTMLElement|null} */
  #tooltip;

  /** @type {HTMLElement|null} */
  #container;

  /**
   * Create SVG element in container
   *
   * @param {HTMLElement} container - Container element
   * @param {{width: number, height: number}} dimensions - SVG dimensions
   * @param {RenderContext} renderContext - Rendering context
   * @throws {AnatomyRenderError} If SVG creation fails
   */
  createSVG(container, dimensions, renderContext) {
    try {
      this.#container = container;

      // Create SVG element
      this.#svg = this.#document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      this.#svg.setAttribute('width', '100%');
      this.#svg.setAttribute('height', '100%');
      this.#svg.setAttribute('viewBox', renderContext.getViewBoxString());
      this.#svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      this.#svg.id = 'anatomy-graph';
      this.#svg.style.cursor = 'grab';

      // Create defs for reusable elements
      this.#defs = this.#document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );
      this.#svg.appendChild(this.#defs);

      // Create default layers
      this.createLayer('background', 0);
      this.createLayer('edges', 1);
      this.createLayer('nodes', 2);
      this.createLayer('overlay', 3);

      container.appendChild(this.#svg);

      // Create tooltip element
      this.#createTooltip(container);

      this.#logger.debug('SVGRenderer: SVG created successfully');
    } catch (error) {
      throw AnatomyRenderError.svgRenderingFailed('SVG creation', error);
    }
  }

  /**
   * Clear all SVG content
   */
  clearSVG() {
    if (this.#svg && this.#container) {
      this.#svg.remove();
      this.#svg = null;
      this.#defs = null;
      this.#layers.clear();
    }

    if (this.#tooltip) {
      this.#tooltip.remove();
      this.#tooltip = null;
    }

    this.#logger.debug('SVGRenderer: SVG cleared');
  }

  /**
   * Create a layer in the SVG
   *
   * @param {string} name - Layer name
   * @param {number} zIndex - Layer z-index (higher = on top)
   * @returns {SVGGElement} Created layer group
   */
  createLayer(name, zIndex) {
    if (!this.#svg) {
      throw new Error('SVG not initialized');
    }

    // Remove existing layer if present
    if (this.#layers.has(name)) {
      this.#layers.get(name).remove();
    }

    const layer = this.#document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );
    layer.setAttribute('class', `layer-${name}`);
    layer.setAttribute('data-layer', name);
    layer.setAttribute('data-z-index', String(zIndex));

    // Insert layer in correct z-order
    const layers = Array.from(this.#layers.values());
    const insertBefore = layers.find(
      (l) => Number(l.getAttribute('data-z-index')) > zIndex
    );

    if (insertBefore) {
      this.#svg.insertBefore(layer, insertBefore);
    } else {
      this.#svg.appendChild(layer);
    }

    this.#layers.set(name, layer);
    return layer;
  }

  /**
   * Get a layer by name
   *
   * @param {string} name - Layer name
   * @returns {SVGGElement|null} Layer group or null
   */
  getLayer(name) {
    return this.#layers.get(name) || null;
  }

  /**
   * Create a node element
   *
   * @param {AnatomyNode} nodeData - Node data
   * @param {RenderContext} renderContext - Rendering context
   * @returns {SVGGElement} Created node group
   * @throws {AnatomyRenderError} If node creation fails
   */
  createNode(nodeData, renderContext) {
    try {
      const g = this.#document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );
      g.setAttribute('class', 'anatomy-node');
      g.setAttribute('transform', `translate(${nodeData.x}, ${nodeData.y})`);
      g.setAttribute('data-node-id', nodeData.id);

      // Node circle
      const circle = this.#document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
      );
      circle.setAttribute('r', String(renderContext.options.nodeRadius));
      circle.setAttribute('fill', renderContext.getNodeColor(nodeData.type));
      circle.setAttribute('stroke', '#333');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', 'node-circle');
      g.appendChild(circle);

      // Node label
      const text = this.#document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '40');
      text.setAttribute('class', 'node-label');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '12');
      text.textContent = nodeData.name;
      g.appendChild(text);

      return g;
    } catch (error) {
      throw AnatomyRenderError.svgRenderingFailed(
        'Node creation',
        error,
        nodeData
      );
    }
  }

  /**
   * Create an edge element
   *
   * @param {AnatomyEdge} edgeData - Edge data
   * @param {AnatomyNode} sourceNode - Source node
   * @param {AnatomyNode} targetNode - Target node
   * @returns {SVGPathElement} Created edge path
   * @throws {AnatomyRenderError} If edge creation fails
   */
  createEdge(edgeData, sourceNode, targetNode) {
    try {
      const path = this.#document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );

      // Calculate bezier curve for radial layout
      const pathData = this.#calculateEdgePath(sourceNode, targetNode);
      edgeData.setPathData(pathData);

      path.setAttribute('d', pathData);
      path.setAttribute('class', 'anatomy-edge');
      path.setAttribute('stroke', edgeData.strokeColor);
      path.setAttribute('stroke-width', String(edgeData.strokeWidth));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-opacity', String(edgeData.strokeOpacity));
      path.setAttribute('data-source', edgeData.source);
      path.setAttribute('data-target', edgeData.target);

      return path;
    } catch (error) {
      throw AnatomyRenderError.svgRenderingFailed(
        'Edge creation',
        error,
        edgeData
      );
    }
  }

  /**
   * Render all nodes
   *
   * @param {Map<string, AnatomyNode>} nodes - Nodes to render
   * @param {RenderContext} renderContext - Rendering context
   */
  renderNodes(nodes, renderContext) {
    const nodeLayer = this.getLayer('nodes');
    if (!nodeLayer) {
      throw new Error('Node layer not found');
    }

    // Clear existing nodes
    DomUtils.clearElement(nodeLayer);

    // Render each node
    for (const node of nodes.values()) {
      const nodeElement = this.createNode(node, renderContext);
      nodeLayer.appendChild(nodeElement);
    }

    this.#logger.debug(`SVGRenderer: Rendered ${nodes.size} nodes`);
  }

  /**
   * Render all edges
   *
   * @param {Array<AnatomyEdge>} edges - Edges to render
   * @param {Map<string, AnatomyNode>} nodes - All nodes (for position lookup)
   */
  renderEdges(edges, nodes) {
    const edgeLayer = this.getLayer('edges');
    if (!edgeLayer) {
      throw new Error('Edge layer not found');
    }

    // Clear existing edges
    DomUtils.clearElement(edgeLayer);

    // Render each edge
    for (const edge of edges) {
      const sourceNode = nodes.get(edge.source);
      const targetNode = nodes.get(edge.target);

      if (sourceNode && targetNode) {
        const edgeElement = this.createEdge(edge, sourceNode, targetNode);
        edgeLayer.appendChild(edgeElement);
      }
    }

    this.#logger.debug(`SVGRenderer: Rendered ${edges.length} edges`);
  }

  /**
   * Apply theme to SVG elements
   *
   * @param {object} theme - Theme configuration
   */
  applyTheme(theme) {
    if (!this.#svg) return;

    // Apply background color
    if (theme.backgroundColor) {
      this.#svg.style.backgroundColor = theme.backgroundColor;
    }

    this.#logger.debug('SVGRenderer: Theme applied');
  }

  /**
   * Highlight an element
   *
   * @param {string} elementId - Element ID to highlight
   * @param {boolean} highlight - True to highlight, false to remove
   */
  highlightElement(elementId, highlight = true) {
    if (!this.#svg) return;

    const element = this.#svg.querySelector(`[data-node-id="${elementId}"]`);
    if (element) {
      if (highlight) {
        element.classList.add('highlighted');
      } else {
        element.classList.remove('highlighted');
      }
    }
  }

  /**
   * Update SVG viewBox
   *
   * @param {RenderContext} renderContext - Rendering context with viewport info
   */
  updateViewBox(renderContext) {
    if (this.#svg) {
      this.#svg.setAttribute('viewBox', renderContext.getViewBoxString());
    }
  }

  /**
   * Show tooltip
   *
   * @param {string} content - Tooltip HTML content
   * @param {{x: number, y: number}} position - Position relative to container
   */
  showTooltip(content, position) {
    if (!this.#tooltip) return;

    this.#tooltip.innerHTML = content;
    this.#tooltip.style.visibility = 'visible';
    this.#tooltip.style.opacity = '1';
    this.#tooltip.style.left = `${position.x}px`;
    this.#tooltip.style.top = `${position.y}px`;
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (!this.#tooltip) return;

    this.#tooltip.style.visibility = 'hidden';
    this.#tooltip.style.opacity = '0';
  }

  /**
   * Add debug information to the graph
   *
   * @param {RenderContext} renderContext - Rendering context
   */
  addDebugInfo(renderContext) {
    if (!this.#svg || !renderContext.options.showDebugInfo) return;

    const overlayLayer = this.getLayer('overlay');
    if (!overlayLayer) return;

    // Remove existing debug info
    const existingDebug = overlayLayer.querySelector('.debug-info');
    if (existingDebug) {
      existingDebug.remove();
    }

    const debugGroup = this.#document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );
    debugGroup.setAttribute('class', 'debug-info');
    debugGroup.setAttribute(
      'transform',
      `translate(${renderContext.viewport.x + 10}, ${renderContext.viewport.y + 20})`
    );

    // Background rect
    const bgRect = this.#document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );
    bgRect.setAttribute('x', '-5');
    bgRect.setAttribute('y', '-15');
    bgRect.setAttribute('width', '200');
    bgRect.setAttribute('height', '30');
    bgRect.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
    bgRect.setAttribute('stroke', '#ccc');
    bgRect.setAttribute('rx', '3');
    debugGroup.appendChild(bgRect);

    // Debug text
    const debugText = this.#document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text'
    );
    debugText.setAttribute('x', '0');
    debugText.setAttribute('y', '0');
    debugText.setAttribute('font-size', '12');
    debugText.setAttribute('font-family', 'monospace');
    debugText.setAttribute('fill', '#666');
    debugText.textContent = `Nodes: ${renderContext.performance.nodeCount}, Edges: ${renderContext.performance.edgeCount}`;
    debugGroup.appendChild(debugText);

    overlayLayer.appendChild(debugGroup);
  }

  /**
   * Get the SVG element
   *
   * @returns {SVGElement|null} SVG element or null
   */
  getSVGElement() {
    return this.#svg;
  }

  /**
   * Create tooltip element
   *
   * @private
   * @param {HTMLElement} container - Container element
   */
  #createTooltip(container) {
    this.#tooltip = this.#document.createElement('div');
    this.#tooltip.className = 'anatomy-tooltip';
    this.#tooltip.style.position = 'absolute';
    this.#tooltip.style.visibility = 'hidden';
    this.#tooltip.style.opacity = '0';
    container.appendChild(this.#tooltip);
  }

  /**
   * Calculate edge path between two nodes
   *
   * @private
   * @param {AnatomyNode} sourceNode - Source node
   * @param {AnatomyNode} targetNode - Target node
   * @returns {string} SVG path data
   */
  #calculateEdgePath(sourceNode, targetNode) {
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Control point calculation for radial layout
    const t = 0.3; // Control point at 30% distance from source
    const midX = sourceNode.x + dx * t;
    const midY = sourceNode.y + dy * t;

    // Curvature based on radial structure
    const curvature = 0.15 * (1 + (targetNode.radius || 0) / 500);

    // Perpendicular offset for curve
    const perpX = -dy / distance;
    const perpY = dx / distance;

    const controlX = midX + perpX * curvature * distance;
    const controlY = midY + perpY * curvature * distance;

    // Create quadratic bezier path
    return `M ${sourceNode.x} ${sourceNode.y} Q ${controlX} ${controlY} ${targetNode.x} ${targetNode.y}`;
  }
}

export default SVGRenderer;
