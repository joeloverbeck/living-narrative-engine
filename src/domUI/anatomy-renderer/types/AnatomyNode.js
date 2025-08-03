/**
 * @file AnatomyNode data structure for anatomy visualization
 * @see ../VisualizationComposer.js
 */

/**
 * Represents a node in the anatomy visualization graph.
 * Each node corresponds to an anatomy part entity.
 */
class AnatomyNode {
  /**
   * Create a new AnatomyNode instance
   *
   * @param {string} id - Entity ID of the anatomy part
   * @param {string} name - Display name of the part
   * @param {string} type - Type of anatomy part (e.g., 'torso', 'head', 'arm')
   * @param {number} depth - Depth level in the anatomy hierarchy
   */
  constructor(id, name, type, depth) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.depth = depth;

    // Position coordinates (set by layout algorithm)
    this.x = 0;
    this.y = 0;

    // Dimensions (for bounding box calculations)
    this.width = 0;
    this.height = 0;

    // Radial layout specific properties
    this.angle = 0;
    this.radius = 0;
    this.angleStart = 0;
    this.angleEnd = 0;
    this.leafCount = 1; // Number of leaf nodes in subtree

    // Additional metadata
    this.description = '';
    this.metadata = {};

    // Descriptor components attached to this anatomy part
    this.descriptorComponents = [];
  }

  /**
   * Set the position of the node
   *
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Set the dimensions of the node
   *
   * @param {number} width - Node width
   * @param {number} height - Node height
   */
  setDimensions(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * Set radial layout properties
   *
   * @param {object} radialProps - Radial layout properties
   * @param {number} radialProps.angle - Angle in radians
   * @param {number} radialProps.radius - Distance from center
   * @param {number} radialProps.angleStart - Start angle of allocated arc
   * @param {number} radialProps.angleEnd - End angle of allocated arc
   */
  setRadialProperties({ angle, radius, angleStart, angleEnd }) {
    this.angle = angle;
    this.radius = radius;
    this.angleStart = angleStart;
    this.angleEnd = angleEnd;
  }

  /**
   * Get the center point of the node
   *
   * @returns {{x: number, y: number}} Center coordinates
   */
  getCenter() {
    return {
      x: this.x,
      y: this.y,
    };
  }

  /**
   * Get the bounding box of the node
   *
   * @returns {{left: number, top: number, right: number, bottom: number}} Bounding box
   */
  getBounds() {
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
    return {
      left: this.x - halfWidth,
      top: this.y - halfHeight,
      right: this.x + halfWidth,
      bottom: this.y + halfHeight,
    };
  }

  /**
   * Clone this node
   *
   * @returns {AnatomyNode} A new AnatomyNode instance with the same properties
   */
  clone() {
    const clone = new AnatomyNode(this.id, this.name, this.type, this.depth);
    clone.x = this.x;
    clone.y = this.y;
    clone.width = this.width;
    clone.height = this.height;
    clone.angle = this.angle;
    clone.radius = this.radius;
    clone.angleStart = this.angleStart;
    clone.angleEnd = this.angleEnd;
    clone.leafCount = this.leafCount;
    clone.description = this.description;
    clone.metadata = { ...this.metadata };
    clone.descriptorComponents = [...this.descriptorComponents];
    return clone;
  }
}

export default AnatomyNode;
