/**
 * @file RenderContext data structure for anatomy visualization
 * @see ../VisualizationComposer.js
 */

/**
 * Represents the current rendering context and state.
 * Contains viewport information, theme settings, and performance metrics.
 */
class RenderContext {
  constructor() {
    // Viewport configuration
    this.viewport = {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      scale: 1,
    };

    // Theme settings
    this.theme = {
      nodeColors: {
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
      },
      edgeColor: '#666',
      backgroundColor: '#ffffff',
      tooltipBackground: '#333',
      tooltipText: '#fff',
    };

    // Render options
    this.options = {
      showDebugInfo: true,
      enableTooltips: true,
      enableInteractions: true,
      animationDuration: 300,
      nodeRadius: 30,
      minNodeSpacing: 20,
    };

    // Performance metrics
    this.performance = {
      nodeCount: 0,
      edgeCount: 0,
      renderTime: 0,
      layoutTime: 0,
      lastFrameTime: 0,
      fps: 0,
    };

    // Container dimensions
    this.containerBounds = {
      width: 0,
      height: 0,
      left: 0,
      top: 0,
    };

    // Mouse/touch state
    this.interactionState = {
      isPanning: false,
      panStart: { x: 0, y: 0 },
      mousePosition: { x: 0, y: 0 },
      hoveredNodeId: null,
      selectedNodeId: null,
    };
  }

  /**
   * Update viewport configuration
   *
   * @param {object} viewport - Viewport settings
   * @param {number} [viewport.x] - X offset
   * @param {number} [viewport.y] - Y offset
   * @param {number} [viewport.width] - Viewport width
   * @param {number} [viewport.height] - Viewport height
   * @param {number} [viewport.scale] - Zoom scale
   */
  updateViewport(viewport) {
    Object.assign(this.viewport, viewport);
  }

  /**
   * Update theme settings
   *
   * @param {object} theme - Theme configuration
   */
  updateTheme(theme) {
    if (theme.nodeColors) {
      Object.assign(this.theme.nodeColors, theme.nodeColors);
    }
    if (theme.edgeColor !== undefined) this.theme.edgeColor = theme.edgeColor;
    if (theme.backgroundColor !== undefined) {
      this.theme.backgroundColor = theme.backgroundColor;
    }
  }

  /**
   * Update render options
   *
   * @param {object} options - Render options
   */
  updateOptions(options) {
    Object.assign(this.options, options);
  }

  /**
   * Update performance metrics
   *
   * @param {object} metrics - Performance metrics
   */
  updatePerformance(metrics) {
    Object.assign(this.performance, metrics);
  }

  /**
   * Update container bounds
   *
   * @param {DOMRect} bounds - Container bounding rectangle
   */
  updateContainerBounds(bounds) {
    this.containerBounds = {
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
    };
  }

  /**
   * Get the color for a node type
   *
   * @param {string} nodeType - Type of anatomy node
   * @returns {string} Color hex code
   */
  getNodeColor(nodeType) {
    return this.theme.nodeColors[nodeType] || this.theme.nodeColors.unknown;
  }

  /**
   * Get the viewBox string for SVG
   *
   * @returns {string} SVG viewBox attribute value
   */
  getViewBoxString() {
    const { x, y, width, height } = this.viewport;
    return `${x} ${y} ${width} ${height}`;
  }

  /**
   * Calculate FPS from frame time
   *
   * @param {number} frameTime - Time since last frame in milliseconds
   */
  calculateFPS(frameTime) {
    if (frameTime > 0) {
      this.performance.fps = Math.round(1000 / frameTime);
    }
    this.performance.lastFrameTime = frameTime;
  }

  /**
   * Clone this context
   *
   * @returns {RenderContext} A new RenderContext instance with the same properties
   */
  clone() {
    const clone = new RenderContext();
    clone.viewport = { ...this.viewport };
    clone.theme = {
      nodeColors: { ...this.theme.nodeColors },
      edgeColor: this.theme.edgeColor,
      backgroundColor: this.theme.backgroundColor,
      tooltipBackground: this.theme.tooltipBackground,
      tooltipText: this.theme.tooltipText,
    };
    clone.options = { ...this.options };
    clone.performance = { ...this.performance };
    clone.containerBounds = { ...this.containerBounds };
    clone.interactionState = { ...this.interactionState };
    return clone;
  }
}

export default RenderContext;
