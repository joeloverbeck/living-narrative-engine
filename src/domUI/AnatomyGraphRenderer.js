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
    this._viewBox = { x: 0, y: 0, width: 800, height: 600 };
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._zoom = 1;
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
      // Remove any existing SVG elements
      const existingSvg = container.querySelector('svg');
      if (existingSvg) {
        existingSvg.remove();
      }
      // Remove any existing tooltip
      const existingTooltip = container.querySelector('.anatomy-tooltip');
      if (existingTooltip) {
        existingTooltip.remove();
      }
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
    this._logger.debug('Building graph data from bodyData:', {
      root: bodyData.root,
      partsCount: Object.keys(bodyData.parts || {}).length,
      parts: bodyData.parts
    });
    
    const visited = new Set();
    const queue = [{ id: bodyData.root, depth: 0, parent: null }];
    
    // First, collect all part IDs from the body data
    const allPartIds = new Set();
    if (bodyData.parts) {
      Object.values(bodyData.parts).forEach(partId => allPartIds.add(partId));
    }
    allPartIds.add(bodyData.root);
    
    this._logger.debug('All part IDs collected:', Array.from(allPartIds));

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
        
        this._logger.debug(`Processing entity ${id} at depth ${depth}`);

        // Get entity info
        const nameComponent = entity.getComponentData('core:name');
        const descriptionComponent = entity.getComponentData('core:description');
        const partComponent = entity.getComponentData('anatomy:part');
        const jointComponent = entity.getComponentData('anatomy:joint');
        
        this._logger.debug(`Entity ${id} components:`, {
          hasName: !!nameComponent,
          nameText: nameComponent?.text,
          hasPartComponent: !!partComponent,
          partType: partComponent?.subType,
          hasJointComponent: !!jointComponent,
          jointParentId: jointComponent?.parentId
        });

        // Create node
        const node = {
          id,
          name: nameComponent?.text || id,
          description: descriptionComponent?.text || 'No description',
          type: partComponent?.subType || 'unknown',
          depth,
          x: 0, // Will be calculated later
          y: depth * 150 + 80, // Increased vertical spacing for better visibility
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

        // Find children by checking all parts for connections to this entity
        const children = [];
        // Check from allPartIds set
        for (const partId of allPartIds) {
          if (!visited.has(partId)) {
            try {
              const partEntity = await this._entityManager.getEntityInstance(partId);
              if (partEntity) {
                const partJoint = partEntity.getComponentData('anatomy:joint');
                if (partJoint && partJoint.parentId === id) {
                  const partName = partEntity.getComponentData('core:name')?.text || partId;
                  children.push({ id: partId, name: partName });
                  queue.push({ id: partId, depth: depth + 1, parent: id });
                }
              }
            } catch (err) {
              this._logger.warn(`Failed to check entity ${partId}:`, err);
            }
          }
        }
        
        // Also check from bodyData.parts map to ensure we don't miss any
        if (bodyData.parts) {
          for (const [partName, partId] of Object.entries(bodyData.parts)) {
            if (!visited.has(partId) && !children.some(child => child.id === partId)) {
              try {
                const partEntity = await this._entityManager.getEntityInstance(partId);
                if (partEntity) {
                  const partJoint = partEntity.getComponentData('anatomy:joint');
                  if (partJoint && partJoint.parentId === id) {
                    children.push({ id: partId, name: partName });
                    queue.push({ id: partId, depth: depth + 1, parent: id });
                  }
                }
              } catch (err) {
                this._logger.warn(`Failed to check entity ${partId} (${partName}):`, err);
              }
            }
          }
        }
        
        this._logger.debug(`Found ${children.length} children for ${id}:`, children);
      } catch (error) {
        this._logger.error(`Error processing entity ${id}:`, error);
      }
    }
    
    // Check for any parts that weren't visited
    const unvisitedParts = [];
    for (const [partName, partId] of Object.entries(bodyData.parts || {})) {
      if (!visited.has(partId)) {
        unvisitedParts.push({ name: partName, id: partId });
      }
    }
    
    if (unvisitedParts.length > 0) {
      this._logger.warn(`Found ${unvisitedParts.length} unconnected parts:`, unvisitedParts);
      
      // Add unconnected parts as orphaned nodes (for debugging)
      for (const { name, id } of unvisitedParts) {
        try {
          const entity = await this._entityManager.getEntityInstance(id);
          if (entity) {
            const nameComponent = entity.getComponentData('core:name');
            const partComponent = entity.getComponentData('anatomy:part');
            
            const node = {
              id,
              name: nameComponent?.text || name || id,
              description: 'Unconnected part',
              type: partComponent?.subType || 'unknown',
              depth: 0, // Place at root level
              x: 0,
              y: 0
            };
            
            this._nodes.set(id, node);
            this._logger.debug(`Added unconnected part: ${node.name} (${id})`);
          }
        } catch (err) {
          this._logger.error(`Failed to add unvisited part ${id}:`, err);
        }
      }
    }
    
    this._logger.info(`Graph building complete: ${this._nodes.size} nodes, ${this._edges.length} edges`);

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

    // Calculate width based on maximum number of nodes at any level
    let maxNodesInLevel = 0;
    for (const nodes of levels.values()) {
      maxNodesInLevel = Math.max(maxNodesInLevel, nodes.length);
    }
    
    const minSpacing = 120; // Minimum spacing between nodes
    const width = Math.max(800, maxNodesInLevel * minSpacing + 200);
    
    // Position nodes horizontally within each level
    for (const [depth, nodes] of levels) {
      const spacing = width / (nodes.length + 1);
      nodes.forEach((node, index) => {
        node.x = spacing * (index + 1);
      });
    }
    
    // Update viewBox to fit all content
    this._updateViewBoxToFitContent();
  }
  
  /**
   * Update viewBox to ensure all nodes are visible
   *
   * @private
   */
  _updateViewBoxToFitContent() {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    const nodeRadius = 30;
    const padding = 80;
    
    for (const node of this._nodes.values()) {
      minX = Math.min(minX, node.x - nodeRadius);
      minY = Math.min(minY, node.y - nodeRadius);
      maxX = Math.max(maxX, node.x + nodeRadius);
      maxY = Math.max(maxY, node.y + nodeRadius);
    }
    
    if (this._nodes.size > 0) {
      this._viewBox.x = minX - padding;
      this._viewBox.y = minY - padding;
      this._viewBox.width = (maxX - minX) + padding * 2;
      this._viewBox.height = (maxY - minY) + padding * 2;
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

    // Create SVG with viewBox
    const svg = this._document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `${this._viewBox.x} ${this._viewBox.y} ${this._viewBox.width} ${this._viewBox.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.id = 'anatomy-graph';
    svg.style.cursor = 'grab';

    container.appendChild(svg);
    this._svg = svg;

    // Setup pan and zoom handlers
    this._setupPanAndZoom();

    // Create tooltip element
    this._tooltip = this._document.createElement('div');
    this._tooltip.className = 'anatomy-tooltip';
    this._tooltip.style.position = 'absolute';
    this._tooltip.style.visibility = 'hidden';
    this._tooltip.style.opacity = '0';
    container.appendChild(this._tooltip);
  }
  
  /**
   * Setup pan and zoom functionality
   *
   * @private
   */
  _setupPanAndZoom() {
    if (!this._svg) return;
    
    // Mouse events for panning
    this._svg.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        this._isPanning = true;
        this._panStart = { x: e.clientX, y: e.clientY };
        this._svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    
    this._document.addEventListener('mousemove', (e) => {
      if (this._isPanning && this._svg) {
        const dx = (e.clientX - this._panStart.x) / this._zoom;
        const dy = (e.clientY - this._panStart.y) / this._zoom;
        
        this._viewBox.x -= dx;
        this._viewBox.y -= dy;
        
        this._updateViewBox();
        
        this._panStart = { x: e.clientX, y: e.clientY };
      }
    });
    
    this._document.addEventListener('mouseup', () => {
      if (this._isPanning && this._svg) {
        this._isPanning = false;
        this._svg.style.cursor = 'grab';
      }
    });
    
    // Wheel event for zooming
    this._svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const rect = this._svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Convert mouse position to SVG coordinates
      const svgX = (x / rect.width) * this._viewBox.width + this._viewBox.x;
      const svgY = (y / rect.height) * this._viewBox.height + this._viewBox.y;
      
      // Zoom factor
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      this._zoom *= zoomFactor;
      this._zoom = Math.max(0.1, Math.min(this._zoom, 5)); // Limit zoom
      
      // Update viewBox maintaining mouse position
      const newWidth = this._viewBox.width * zoomFactor;
      const newHeight = this._viewBox.height * zoomFactor;
      
      this._viewBox.x = svgX - (x / rect.width) * newWidth;
      this._viewBox.y = svgY - (y / rect.height) * newHeight;
      this._viewBox.width = newWidth;
      this._viewBox.height = newHeight;
      
      this._updateViewBox();
    });
  }
  
  /**
   * Update SVG viewBox attribute
   *
   * @private
   */
  _updateViewBox() {
    if (this._svg) {
      this._svg.setAttribute('viewBox', 
        `${this._viewBox.x} ${this._viewBox.y} ${this._viewBox.width} ${this._viewBox.height}`);
    }
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
        // Create curved path instead of straight line
        const path = this._document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path'
        );
        
        // Calculate control point for quadratic Bezier curve
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        const curvature = 0.2;
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        
        // Control point perpendicular to the line
        const controlX = midX - dy * curvature;
        const controlY = midY + dx * curvature;
        
        // Create curved path
        const d = `M ${sourceNode.x} ${sourceNode.y} Q ${controlX} ${controlY} ${targetNode.x} ${targetNode.y}`;
        
        path.setAttribute('d', d);
        path.setAttribute('class', 'anatomy-edge');
        path.setAttribute('stroke', '#666');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-opacity', '0.6');
        edgeGroup.appendChild(path);
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
    
    // Add debug info
    this._addDebugInfo();
  }
  
  /**
   * Add debug information to the graph
   * 
   * @private
   */
  _addDebugInfo() {
    if (!this._svg) return;
    
    const debugGroup = this._document.createElementNS('http://www.w3.org/2000/svg', 'g');
    debugGroup.setAttribute('class', 'debug-info');
    debugGroup.setAttribute('transform', `translate(${this._viewBox.x + 10}, ${this._viewBox.y + 20})`);
    
    // Background rect for readability
    const bgRect = this._document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '-5');
    bgRect.setAttribute('y', '-15');
    bgRect.setAttribute('width', '200');
    bgRect.setAttribute('height', '30');
    bgRect.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
    bgRect.setAttribute('stroke', '#ccc');
    bgRect.setAttribute('rx', '3');
    debugGroup.appendChild(bgRect);
    
    // Debug text
    const debugText = this._document.createElementNS('http://www.w3.org/2000/svg', 'text');
    debugText.setAttribute('x', '0');
    debugText.setAttribute('y', '0');
    debugText.setAttribute('font-size', '12');
    debugText.setAttribute('font-family', 'monospace');
    debugText.setAttribute('fill', '#666');
    debugText.textContent = `Nodes: ${this._nodes.size}, Edges: ${this._edges.length}`;
    debugGroup.appendChild(debugText);
    
    this._svg.appendChild(debugGroup);
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

        // Position tooltip relative to the node
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = this._svg.parentElement.getBoundingClientRect();
        
        // Calculate position accounting for scroll
        const tooltipX = rect.left - containerRect.left + rect.width / 2;
        const tooltipY = rect.top - containerRect.top - 10;
        
        this._tooltip.style.left = `${tooltipX}px`;
        this._tooltip.style.top = `${tooltipY}px`;
      });

      // Mouse leave
      nodeEl.addEventListener('mouseleave', () => {
        this._tooltip.style.visibility = 'hidden';
        this._tooltip.style.opacity = '0';
      });

      // Add hover effect with smooth transitions
      const circle = nodeEl.querySelector('.node-circle');
      if (circle) {
        // Store original values
        const originalRadius = circle.getAttribute('r');
        const originalStrokeWidth = circle.getAttribute('stroke-width');
        
        nodeEl.addEventListener('mouseenter', () => {
          // Slightly increase radius and stroke for hover effect
          circle.setAttribute('r', String(Number(originalRadius) + 3));
          circle.setAttribute('stroke-width', '3');
          circle.setAttribute('fill-opacity', '0.9');
        });

        nodeEl.addEventListener('mouseleave', () => {
          // Restore original values
          circle.setAttribute('r', originalRadius);
          circle.setAttribute('stroke-width', originalStrokeWidth);
          circle.setAttribute('fill-opacity', '1');
        });
      }
      
      // Prevent panning when interacting with nodes
      nodeEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    });
  }
}

export default AnatomyGraphRenderer;
