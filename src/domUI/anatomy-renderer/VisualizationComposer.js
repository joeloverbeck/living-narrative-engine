/**
 * @file VisualizationComposer - Main orchestrator for anatomy visualization
 * @description Replaces the monolithic AnatomyGraphRenderer with a modular architecture
 * @see AnatomyVisualizerUI.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { DomUtils } from '../../utils/domUtils.js';
import { AnatomyRenderError } from '../../errors/anatomyRenderError.js';
import AnatomyNode from './types/AnatomyNode.js';
import AnatomyEdge from './types/AnatomyEdge.js';
import RenderContext from './types/RenderContext.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('./LayoutEngine.js').default} LayoutEngine */
/** @typedef {import('./SVGRenderer.js').default} SVGRenderer */
/** @typedef {import('./InteractionController.js').default} InteractionController */
/** @typedef {import('./ViewportManager.js').default} ViewportManager */

/**
 * Orchestrates all components for anatomy visualization.
 * Manages the rendering lifecycle and coordinates between layout, rendering, and interaction.
 */
class VisualizationComposer {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IEntityManager} dependencies.entityManager
   * @param {IDocumentContext} dependencies.documentContext
   * @param {LayoutEngine} dependencies.layoutEngine
   * @param {SVGRenderer} dependencies.svgRenderer
   * @param {InteractionController} dependencies.interactionController
   * @param {ViewportManager} dependencies.viewportManager
   */
  constructor({
    logger,
    entityManager,
    documentContext,
    layoutEngine,
    svgRenderer,
    interactionController,
    viewportManager,
  }) {
    validateDependency(logger, 'ILogger');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(documentContext, 'IDocumentContext');
    validateDependency(layoutEngine, 'LayoutEngine');
    validateDependency(svgRenderer, 'SVGRenderer');
    validateDependency(interactionController, 'InteractionController');
    validateDependency(viewportManager, 'ViewportManager');

    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#documentContext = documentContext;
    this.#layoutEngine = layoutEngine;
    this.#svgRenderer = svgRenderer;
    this.#interactionController = interactionController;
    this.#viewportManager = viewportManager;

    this.#nodes = new Map();
    this.#edges = [];
    this.#renderContext = new RenderContext();
    this.#container = null;
    this.#isInitialized = false;

    // Bind interaction handlers
    this.#setupInteractionHandlers();
  }

  /** @type {ILogger} */
  #logger;

  /** @type {IEntityManager} */
  #entityManager;

  /** @type {IDocumentContext} */
  #documentContext;

  /** @type {LayoutEngine} */
  #layoutEngine;

  /** @type {SVGRenderer} */
  #svgRenderer;

  /** @type {InteractionController} */
  #interactionController;

  /** @type {ViewportManager} */
  #viewportManager;

  /** @type {Map<string, AnatomyNode>} */
  #nodes;

  /** @type {Array<AnatomyEdge>} */
  #edges;

  /** @type {RenderContext} */
  #renderContext;

  /** @type {HTMLElement|null} */
  #container;

  /** @type {boolean} */
  #isInitialized;

  /**
   * Initialize the visualization composer
   *
   * @param {HTMLElement} container - Container element for visualization
   */
  initialize(container) {
    assertPresent(container, 'Container element is required');

    this.#container = container;
    this.#isInitialized = true;

    this.#logger.debug('VisualizationComposer: Initialized');
  }

  /**
   * Render the anatomy graph - main public API matching AnatomyGraphRenderer
   *
   * @param {string} rootEntityId - The root entity ID
   * @param {object} bodyData - The body data from anatomy:body component
   * @returns {Promise<void>}
   */
  async renderGraph(rootEntityId, bodyData) {
    assertNonBlankString(
      rootEntityId,
      'rootEntityId',
      'VisualizationComposer.renderGraph',
      this.#logger
    );
    assertPresent(bodyData, 'Body data is required');

    this.#logger.debug(
      `VisualizationComposer: Rendering graph for entity ${rootEntityId}`
    );

    // Clear any existing visualization
    this.clear();

    if (!bodyData || !bodyData.root) {
      this.#logger.warn('No body data or root found');
      return;
    }

    try {
      // Build graph data structure
      await this.buildGraphData(bodyData);

      // Perform layout calculation
      this.performLayout();

      // Render visualization
      await this.renderVisualization();

      this.#logger.info(
        `VisualizationComposer: Rendered ${this.#nodes.size} nodes and ${this.#edges.length} edges`
      );
    } catch (error) {
      this.#logger.error(
        'VisualizationComposer: Failed to render anatomy graph',
        error
      );
      throw error;
    }
  }

  /**
   * Clear the current graph - main public API matching AnatomyGraphRenderer
   */
  clear() {
    if (!this.#container) {
      return;
    }

    // Clear SVG renderer
    this.#svgRenderer.clearSVG();

    // Detach interaction handlers
    const svgElement = this.#svgRenderer.getSVGElement();
    if (svgElement) {
      this.#interactionController.detachFromElement();
    }

    // Clear data
    this.#nodes.clear();
    this.#edges = [];

    // Reset viewport
    this.#viewportManager.reset();

    this.#logger.debug('VisualizationComposer: Cleared');
  }

  /**
   * Set the layout strategy
   *
   * @param {string} layoutName - Name of layout strategy
   */
  setLayout(layoutName) {
    this.#layoutEngine.setStrategy(layoutName);
  }

  /**
   * Set the theme
   *
   * @param {object} theme - Theme configuration
   */
  setTheme(theme) {
    this.#renderContext.updateTheme(theme);
    this.#svgRenderer.applyTheme(theme);
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.clear();
    this.#isInitialized = false;
    this.#container = null;
  }

  /**
   * Build graph data from body data
   *
   * @param {object} bodyData - Body data containing anatomy structure
   * @returns {Promise<void>}
   */
  async buildGraphData(bodyData) {
    this.#logger.debug('VisualizationComposer: Building graph data', {
      root: bodyData.root,
      partsCount: Object.keys(bodyData.parts || {}).length,
    });

    const visited = new Set();
    const queue = [{ id: bodyData.root, depth: 0, parent: null }];

    // Collect all part IDs
    const allPartIds = new Set();
    if (bodyData.parts) {
      Object.values(bodyData.parts).forEach((partId) => allPartIds.add(partId));
    }
    allPartIds.add(bodyData.root);

    // DIAGNOSTIC 1: Log initial collection - shows what entities are in bodyData.parts
    this.#logger.debug(
      `VisualizationComposer: Initial collection - ${allPartIds.size} entities in bodyData`,
      {
        root: bodyData.root,
        allPartIds: Array.from(allPartIds),
        partsObject: bodyData.parts,
      }
    );

    // Process nodes breadth-first
    while (queue.length > 0) {
      const { id, depth, parent } = queue.shift();

      // DIAGNOSTIC 2: Log node processing start
      this.#logger.debug(
        `VisualizationComposer: Processing entity '${id}' at depth ${depth}`,
        { id, depth, parent, queueSize: queue.length }
      );

      if (visited.has(id)) continue;
      visited.add(id);

      try {
        const entity = await this.#entityManager.getEntityInstance(id);
        if (!entity) {
          this.#logger.warn(`Entity not found: ${id}`);
          continue;
        }

        // Get entity components
        const nameComponent = entity.getComponentData('core:name');
        const descriptionComponent =
          entity.getComponentData('core:description');
        const partComponent = entity.getComponentData('anatomy:part');
        const jointComponent = entity.getComponentData('anatomy:joint');

        // Create node
        const node = new AnatomyNode(
          id,
          nameComponent?.text || id,
          partComponent?.subType || 'unknown',
          depth
        );
        node.description = descriptionComponent?.text || 'No description';

        // Collect descriptor components
        const descriptorComponents = [];
        const allComponents = entity.getAllComponents();
        for (const [componentId] of Object.entries(allComponents)) {
          if (componentId.startsWith('descriptors:')) {
            // Extract the component name after the namespace
            const componentName = componentId.split(':')[1];
            descriptorComponents.push(componentName);
          }
        }
        node.descriptorComponents = descriptorComponents;

        this.#nodes.set(id, node);

        // Create edge if has parent
        if (parent && jointComponent) {
          const edge = new AnatomyEdge(parent, id, jointComponent.socketId);
          this.#edges.push(edge);
        }

        // Find children
        const children = [];
        for (const partId of allPartIds) {
          if (!visited.has(partId)) {
            try {
              const partEntity =
                await this.#entityManager.getEntityInstance(partId);
              if (partEntity) {
                const partJoint = partEntity.getComponentData('anatomy:joint');
                if (partJoint && partJoint.parentId === id) {
                  children.push(partId);
                  queue.push({ id: partId, depth: depth + 1, parent: id });

                  // DIAGNOSTIC 3: Log successful parent-child match
                  this.#logger.debug(
                    `VisualizationComposer: MATCH - Entity '${partId}' has parent '${id}'`,
                    {
                      childId: partId,
                      parentId: id,
                      jointSocketId: partJoint.socketId,
                    }
                  );
                } else {
                  // DIAGNOSTIC 4: Log parent-child match failure
                  this.#logger.debug(
                    `VisualizationComposer: NO MATCH - Entity '${partId}' parent is '${partJoint?.parentId || 'none'}', checking against '${id}'`,
                    {
                      partId,
                      checkingAgainstParent: id,
                      actualParent: partJoint?.parentId || 'none',
                      hasJoint: !!partJoint,
                    }
                  );
                }
              }
            } catch (err) {
              this.#logger.warn(`Failed to check entity ${partId}:`, err);
            }
          }
        }

        this.#logger.debug(`Found ${children.length} children for ${id}`);
      } catch (error) {
        this.#logger.error(`Error processing entity ${id}:`, error);
      }
    }

    // DIAGNOSTIC 5: Log BFS completion - shows visited vs. unvisited entities
    const unvisitedIds = Array.from(allPartIds).filter(
      (partId) => !visited.has(partId)
    );
    this.#logger.debug(
      `VisualizationComposer: BFS complete - ${visited.size} visited, ${unvisitedIds.length} unvisited`,
      {
        visitedCount: visited.size,
        visitedIds: Array.from(visited),
        unvisitedCount: unvisitedIds.length,
        unvisitedIds,
      }
    );

    // Handle unconnected parts
    this.#handleUnconnectedParts(bodyData, visited);

    // Update render context
    this.#renderContext.updatePerformance({
      nodeCount: this.#nodes.size,
      edgeCount: this.#edges.length,
    });
  }

  /**
   * Perform layout calculation
   */
  performLayout() {
    this.#logger.debug('VisualizationComposer: Performing layout');

    try {
      this.#layoutEngine.calculateLayout(
        this.#nodes,
        this.#edges,
        this.#renderContext
      );
    } catch (error) {
      throw AnatomyRenderError.layoutCalculationFailed(
        this.#layoutEngine.getCurrentStrategyName() || 'unknown',
        { nodes: this.#nodes.size, edges: this.#edges.length },
        error
      );
    }
  }

  /**
   * Render the visualization
   *
   * @returns {Promise<void>}
   */
  async renderVisualization() {
    if (!this.#container) {
      throw AnatomyRenderError.domElementNotFound(
        'anatomy-graph-container',
        'rendering'
      );
    }

    this.#logger.debug('VisualizationComposer: Rendering visualization');

    try {
      // Create SVG
      this.#svgRenderer.createSVG(
        this.#container,
        { width: 800, height: 600 },
        this.#renderContext
      );

      // Render edges and nodes
      this.#svgRenderer.renderEdges(this.#edges, this.#nodes);
      this.#svgRenderer.renderNodes(this.#nodes, this.#renderContext);

      // Add debug info if enabled
      this.#svgRenderer.addDebugInfo(this.#renderContext);

      // Setup interactions
      const svgElement = this.#svgRenderer.getSVGElement();
      if (svgElement) {
        this.#interactionController.attachToElement(svgElement);
      }

      // Setup tooltips
      this.#setupTooltips();

      // Subscribe to viewport changes
      this.#viewportManager.subscribe((viewportState) => {
        // Update the render context with the new viewport state
        this.#renderContext.updateViewport(viewportState.viewport);
        // Update the SVG viewBox with the updated context
        this.#svgRenderer.updateViewBox(this.#renderContext);
      });
    } catch (error) {
      throw AnatomyRenderError.svgRenderingFailed(
        'visualization rendering',
        error,
        { nodeCount: this.#nodes.size, edgeCount: this.#edges.length }
      );
    }
  }

  /**
   * Handle unconnected parts
   *
   * @private
   * @param {object} bodyData - Body data
   * @param {Set<string>} visited - Visited part IDs
   */
  async #handleUnconnectedParts(bodyData, visited) {
    const unvisitedParts = [];
    for (const [partName, partId] of Object.entries(bodyData.parts || {})) {
      if (!visited.has(partId)) {
        unvisitedParts.push({ name: partName, id: partId });
      }
    }

    // DIAGNOSTIC 6: Log unconnected parts handler activation
    this.#logger.debug(
      `VisualizationComposer: Unconnected parts handler - processing ${unvisitedParts.length} orphaned entities`,
      { unvisitedParts }
    );

    if (unvisitedParts.length > 0) {
      this.#logger.warn(
        `Found ${unvisitedParts.length} unconnected parts:`,
        unvisitedParts
      );

      // Add unconnected parts as orphaned nodes
      for (const { name, id } of unvisitedParts) {
        try {
          const entity = await this.#entityManager.getEntityInstance(id);
          if (entity) {
            const nameComponent = entity.getComponentData('core:name');
            const partComponent = entity.getComponentData('anatomy:part');

            const node = new AnatomyNode(
              id,
              nameComponent?.text || name || id,
              partComponent?.subType || 'unknown',
              0 // Place at root level
            );
            node.description = 'Unconnected part';

            this.#nodes.set(id, node);
          }
        } catch (err) {
          this.#logger.error(`Failed to add unvisited part ${id}:`, err);
        }
      }
    }
  }

  /**
   * Setup interaction handlers
   *
   * @private
   */
  #setupInteractionHandlers() {
    // Pan handler
    this.#interactionController.registerHandler('pan', (data) => {
      this.#viewportManager.pan(data.deltaX, data.deltaY);
    });

    // Zoom handler
    this.#interactionController.registerHandler('zoom', (data) => {
      this.#viewportManager.zoom(data.zoomFactor, data.x, data.y);
    });

    // Pan start/end handlers for cursor
    this.#interactionController.registerHandler('panstart', () => {
      const svg = this.#svgRenderer.getSVGElement();
      if (svg) svg.style.cursor = 'grabbing';
    });

    this.#interactionController.registerHandler('panend', () => {
      const svg = this.#svgRenderer.getSVGElement();
      if (svg) svg.style.cursor = 'grab';
    });

    // Click handler
    this.#interactionController.registerHandler('click', (data) => {
      if (data.target.type === 'node') {
        this.#logger.debug(`Clicked node: ${data.target.id}`);
      }
    });
  }

  /**
   * Setup tooltips for nodes
   *
   * @private
   */
  #setupTooltips() {
    const nodeElements = this.#container.querySelectorAll('.anatomy-node');

    nodeElements.forEach((nodeEl) => {
      const nodeId = nodeEl.getAttribute('data-node-id');
      const node = this.#nodes.get(nodeId);

      if (!node) return;

      // Mouse enter
      nodeEl.addEventListener('mouseenter', (e) => {
        const descriptionHtml = DomUtils.textToHtml(node.description);
        const descriptorsText =
          node.descriptorComponents.length > 0
            ? node.descriptorComponents.join(', ')
            : 'none';

        const content = `
          <div class="tooltip-header">${DomUtils.escapeHtml(node.name)}</div>
          <div class="tooltip-type">Type: ${DomUtils.escapeHtml(node.type)}</div>
          <div class="tooltip-description">${descriptionHtml}</div>
          <div class="tooltip-descriptors">Descriptors: ${DomUtils.escapeHtml(descriptorsText)}</div>
        `;

        // Calculate position
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = this.#container.getBoundingClientRect();
        const tooltipX = rect.left - containerRect.left + rect.width / 2;
        const tooltipY = rect.top - containerRect.top - 10;

        this.#svgRenderer.showTooltip(content, { x: tooltipX, y: tooltipY });
      });

      // Mouse leave
      nodeEl.addEventListener('mouseleave', () => {
        this.#svgRenderer.hideTooltip();
      });

      // Hover effects
      const circle = nodeEl.querySelector('.node-circle');
      if (circle) {
        const originalRadius = circle.getAttribute('r');
        const originalStrokeWidth = circle.getAttribute('stroke-width');

        nodeEl.addEventListener('mouseenter', () => {
          circle.setAttribute('r', String(Number(originalRadius) + 3));
          circle.setAttribute('stroke-width', '3');
          circle.setAttribute('fill-opacity', '0.9');
        });

        nodeEl.addEventListener('mouseleave', () => {
          circle.setAttribute('r', originalRadius);
          circle.setAttribute('stroke-width', originalStrokeWidth);
          circle.setAttribute('fill-opacity', '1');
        });
      }

      // Prevent panning when clicking nodes
      nodeEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    });
  }
}

export default VisualizationComposer;
