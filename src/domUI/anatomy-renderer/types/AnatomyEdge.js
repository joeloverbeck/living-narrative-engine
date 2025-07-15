/**
 * @file AnatomyEdge data structure for anatomy visualization
 * @see ../VisualizationComposer.js
 */

/**
 * Represents an edge (connection) between anatomy nodes.
 * Each edge corresponds to a joint relationship between anatomy parts.
 */
class AnatomyEdge {
  /**
   * Create a new AnatomyEdge instance
   *
   * @param {string} source - ID of the source node (parent part)
   * @param {string} target - ID of the target node (child part)
   * @param {string} socketId - ID of the socket where the joint connects
   */
  constructor(source, target, socketId) {
    this.source = source;
    this.target = target;
    this.socketId = socketId;

    // Visual properties
    this.strokeWidth = 2;
    this.strokeColor = '#666';
    this.strokeOpacity = 0.6;

    // Path data (set by renderer)
    this.pathData = null;

    // Additional metadata
    this.metadata = {};
  }

  /**
   * Set visual properties for the edge
   *
   * @param {object} properties - Visual properties
   * @param {number} [properties.strokeWidth] - Line width
   * @param {string} [properties.strokeColor] - Line color
   * @param {number} [properties.strokeOpacity] - Line opacity (0-1)
   */
  setVisualProperties({ strokeWidth, strokeColor, strokeOpacity }) {
    if (strokeWidth !== undefined) this.strokeWidth = strokeWidth;
    if (strokeColor !== undefined) this.strokeColor = strokeColor;
    if (strokeOpacity !== undefined) this.strokeOpacity = strokeOpacity;
  }

  /**
   * Set the SVG path data for this edge
   *
   * @param {string} pathData - SVG path data string
   */
  setPathData(pathData) {
    this.pathData = pathData;
  }

  /**
   * Get a unique identifier for this edge
   *
   * @returns {string} Unique edge identifier
   */
  getId() {
    return `${this.source}-${this.target}`;
  }

  /**
   * Check if this edge connects two specific nodes
   *
   * @param {string} nodeId1 - First node ID
   * @param {string} nodeId2 - Second node ID
   * @returns {boolean} True if edge connects these nodes
   */
  connects(nodeId1, nodeId2) {
    return (
      (this.source === nodeId1 && this.target === nodeId2) ||
      (this.source === nodeId2 && this.target === nodeId1)
    );
  }

  /**
   * Clone this edge
   *
   * @returns {AnatomyEdge} A new AnatomyEdge instance with the same properties
   */
  clone() {
    const clone = new AnatomyEdge(this.source, this.target, this.socketId);
    clone.strokeWidth = this.strokeWidth;
    clone.strokeColor = this.strokeColor;
    clone.strokeOpacity = this.strokeOpacity;
    clone.pathData = this.pathData;
    clone.metadata = { ...this.metadata };
    return clone;
  }
}

export default AnatomyEdge;