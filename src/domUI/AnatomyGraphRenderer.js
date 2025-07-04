/**
 * @file AnatomyGraphRenderer.js
 * @description Renders anatomy graphs as interactive SVG visualizations
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */

class AnatomyGraphRenderer {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IEntityManager} dependencies.entityManager
   * @param {IDocumentContext} dependencies.documentContext
   */
  constructor({ logger, entityManager, documentContext }) {
    this._logger = logger;
    this._entityManager = entityManager;
    this._document = documentContext.document;
    this._svg = null;
    this._tooltip = null;
    this._nodes = new Map();
    this._edges = [];
  }

  /**
   * Render the anatomy graph
   *
   * @param {string} rootEntityId - The root entity ID
   * @param {object} bodyData - The body data from anatomy:body component
   * @returns {Promise<void>}
   */
  async renderGraph(rootEntityId, bodyData) {
    this._logger.debug(
      `AnatomyGraphRenderer: Rendering graph for entity ${rootEntityId}`
    );

    this.clear();

    if (!bodyData || !bodyData.root) {
      this._logger.warn('No body data or root found');
      return;
    }

    try {
      // Build graph data structure
      await this._buildGraphData(bodyData);

      // Create SVG
      this._createSVG();

      // Render nodes and edges
      this._renderGraph();

      // Setup tooltips
      this._setupTooltips();
    } catch (error) {
      this._logger.error('Failed to render anatomy graph:', error);
      throw error;
    }
  }

  /**
   * Clear the current graph
   */
  clear() {
    const container = this._document.getElementById('anatomy-graph-container');
    if (container) {
      container.innerHTML = '';
    }
    this._nodes.clear();
    this._edges = [];
    this._svg = null;
    this._tooltip = null;
  }

  /**
   * Build graph data from body data
   *
   * @private
   * @param {object} bodyData
   * @returns {Promise<void>}
   */
  async _buildGraphData(bodyData) {
    const visited = new Set();
    const queue = [{ id: bodyData.root, depth: 0, parent: null }];

    while (queue.length > 0) {
      const { id, depth, parent } = queue.shift();

      if (visited.has(id)) continue;
      visited.add(id);

      try {
        const entity = await this._entityManager.getEntityInstance(id);
        if (!entity) {
          this._logger.warn(`Entity not found: ${id}`);
          continue;
        }

        // Get entity info
        const nameComponent = entity.getComponentData('core:name');
        const descriptionComponent = entity.getComponentData('core:description');
        const partComponent = entity.getComponentData('anatomy:part');
        const jointComponent = entity.getComponentData('anatomy:joint');

        // Create node
        const node = {
          id,
          name: nameComponent?.text || id,
          description: descriptionComponent?.text || 'No description',
          type: partComponent?.subType || 'unknown',
          depth,
          x: 0, // Will be calculated later
          y: depth * 120, // Vertical spacing
        };

        this._nodes.set(id, node);

        // Create edge if has parent
        if (parent && jointComponent) {
          this._edges.push({
            source: parent,
            target: id,
            socketId: jointComponent.socketId,
          });
        }

        // Find children - look for entities with joints pointing to this entity
        for (const [partId] of Object.entries(bodyData.parts || {})) {
          const partEntity = await this._entityManager.getEntityInstance(partId);
          if (partEntity) {
            const partJoint = partEntity.getComponentData('anatomy:joint');
            if (partJoint && partJoint.parentId === id) {
              queue.push({ id: partId, depth: depth + 1, parent: id });
            }
          }
        }
      } catch (error) {
        this._logger.error(`Error processing entity ${id}:`, error);
      }
    }

    // Calculate horizontal positions
    this._calculateNodePositions();
  }

  /**
   * Calculate node positions for tree layout
   *
   * @private
   */
  _calculateNodePositions() {
    // Group nodes by depth
    const levels = new Map();
    for (const node of this._nodes.values()) {
      if (!levels.has(node.depth)) {
        levels.set(node.depth, []);
      }
      levels.get(node.depth).push(node);
    }

    // Position nodes horizontally within each level
    const width = 800;
    for (const [depth, nodes] of levels) {
      const spacing = width / (nodes.length + 1);
      nodes.forEach((node, index) => {
        node.x = spacing * (index + 1);
      });
    }
  }

  /**
   * Create SVG element
   *
   * @private
   */
  _createSVG() {
    const container = this._document.getElementById('anatomy-graph-container');
    if (!container) return;

    // Calculate SVG dimensions
    let maxX = 0;
    let maxY = 0;
    for (const node of this._nodes.values()) {
      maxX = Math.max(maxX, node.x + 100);
      maxY = Math.max(maxY, node.y + 100);
    }

    const width = Math.max(800, maxX);
    const height = Math.max(600, maxY);

    // Create SVG
    const svg = this._document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.id = 'anatomy-graph';

    container.appendChild(svg);
    this._svg = svg;

    // Create tooltip element
    this._tooltip = this._document.createElement('div');
    this._tooltip.className = 'anatomy-tooltip';
    this._tooltip.style.position = 'absolute';
    this._tooltip.style.visibility = 'hidden';
    this._tooltip.style.opacity = '0';
    container.appendChild(this._tooltip);
  }

  /**
   * Render the graph
   *
   * @private
   */
  _renderGraph() {
    if (!this._svg) return;

    // Create defs for markers
    const defs = this._document.createElementNS(
      'http://www.w3.org/2000/svg',
      'defs'
    );
    this._svg.appendChild(defs);

    // Render edges first (so they appear behind nodes)
    const edgeGroup = this._document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );
    edgeGroup.setAttribute('class', 'edges');
    this._svg.appendChild(edgeGroup);

    for (const edge of this._edges) {
      const sourceNode = this._nodes.get(edge.source);
      const targetNode = this._nodes.get(edge.target);

      if (sourceNode && targetNode) {
        const line = this._document.createElementNS(
          'http://www.w3.org/2000/svg',
          'line'
        );
        line.setAttribute('x1', sourceNode.x);
        line.setAttribute('y1', sourceNode.y);
        line.setAttribute('x2', targetNode.x);
        line.setAttribute('y2', targetNode.y);
        line.setAttribute('class', 'anatomy-edge');
        line.setAttribute('stroke', '#666');
        line.setAttribute('stroke-width', '2');
        edgeGroup.appendChild(line);
      }
    }

    // Render nodes
    const nodeGroup = this._document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );
    nodeGroup.setAttribute('class', 'nodes');
    this._svg.appendChild(nodeGroup);

    for (const node of this._nodes.values()) {
      const g = this._document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
      );
      g.setAttribute('class', 'anatomy-node');
      g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
      g.setAttribute('data-node-id', node.id);

      // Node circle
      const circle = this._document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle'
      );
      circle.setAttribute('r', '30');
      circle.setAttribute('fill', this._getNodeColor(node.type));
      circle.setAttribute('stroke', '#333');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', 'node-circle');
      g.appendChild(circle);

      // Node label
      const text = this._document.createElementNS(
        'http://www.w3.org/2000/svg',
        'text'
      );
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '40');
      text.setAttribute('class', 'node-label');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '12');
      text.textContent = node.name;
      g.appendChild(text);

      nodeGroup.appendChild(g);
    }
  }

  /**
   * Get color for node based on type
   *
   * @private
   * @param {string} type
   * @returns {string}
   */
  _getNodeColor(type) {
    const colors = {
      torso: '#e74c3c',
      head: '#3498db',
      arm: '#2ecc71',
      leg: '#f39c12',
      hand: '#27ae60',
      foot: '#e67e22',
      eye: '#9b59b6',
      hair: '#34495e',
      genital: '#e91e63',
      unknown: '#95a5a6',
    };

    return colors[type] || colors.unknown;
  }

  /**
   * Setup tooltips for nodes
   *
   * @private
   */
  _setupTooltips() {
    if (!this._svg || !this._tooltip) return;

    const nodeElements = this._svg.querySelectorAll('.anatomy-node');

    nodeElements.forEach((nodeEl) => {
      const nodeId = nodeEl.getAttribute('data-node-id');
      const node = this._nodes.get(nodeId);

      if (!node) return;

      // Mouse enter
      nodeEl.addEventListener('mouseenter', (e) => {
        this._tooltip.innerHTML = `
          <div class="tooltip-header">${node.name}</div>
          <div class="tooltip-type">Type: ${node.type}</div>
          <div class="tooltip-description">${node.description}</div>
        `;
        this._tooltip.style.visibility = 'visible';
        this._tooltip.style.opacity = '1';

        // Position tooltip
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = this._svg.parentElement.getBoundingClientRect();
        this._tooltip.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
        this._tooltip.style.top = `${rect.top - containerRect.top - 10}px`;
      });

      // Mouse leave
      nodeEl.addEventListener('mouseleave', () => {
        this._tooltip.style.visibility = 'hidden';
        this._tooltip.style.opacity = '0';
      });

      // Add hover effect
      const circle = nodeEl.querySelector('.node-circle');
      if (circle) {
        nodeEl.addEventListener('mouseenter', () => {
          circle.setAttribute('fill-opacity', '0.8');
          circle.style.cursor = 'pointer';
        });

        nodeEl.addEventListener('mouseleave', () => {
          circle.setAttribute('fill-opacity', '1');
        });
      }
    });
  }
}

export default AnatomyGraphRenderer;
