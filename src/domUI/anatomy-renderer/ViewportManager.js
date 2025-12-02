/**
 * @file ViewportManager for anatomy visualization
 * @see VisualizationComposer.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { AnatomyRenderError } from '../../errors/anatomyRenderError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Viewport observer function type
 *
 * @typedef {function({viewport: object, transform: object}): void} ViewportObserver
 */

/**
 * Manages viewport transformations, pan/zoom state, and coordinate conversions.
 * Handles the mapping between screen space and world space coordinates.
 */
class ViewportManager {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {object} [dependencies.initialViewport] - Initial viewport configuration
   */
  constructor({ logger, initialViewport = {} }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#viewport = {
      x: initialViewport.x || 0,
      y: initialViewport.y || 0,
      width: initialViewport.width || 800,
      height: initialViewport.height || 600,
    };
    this.#transform = {
      x: 0,
      y: 0,
      scale: 1,
    };
    this.#bounds = null;
    this.#observers = new Set();
    this.#minZoom = 0.1;
    this.#maxZoom = 5;
  }

  /** @type {ILogger} */
  #logger;

  /** @type {{x: number, y: number, width: number, height: number}} */
  #viewport;

  /** @type {{x: number, y: number, scale: number}} */
  #transform;

  /** @type {{minX: number, minY: number, maxX: number, maxY: number}|null} */
  #bounds;

  /** @type {Set<ViewportObserver>} */
  #observers;

  /** @type {number} */
  #minZoom;

  /** @type {number} */
  #maxZoom;

  /**
   * Set viewport configuration
   *
   * @param {{x?: number, y?: number, width?: number, height?: number}} viewport - Viewport settings
   */
  setViewport(viewport) {
    const changed =
      viewport.x !== this.#viewport.x ||
      viewport.y !== this.#viewport.y ||
      viewport.width !== this.#viewport.width ||
      viewport.height !== this.#viewport.height;

    if (changed) {
      Object.assign(this.#viewport, viewport);
      this.#notifyObservers();
      this.#logger.debug('ViewportManager: Viewport updated', this.#viewport);
    }
  }

  /**
   * Get current viewport
   *
   * @returns {{x: number, y: number, width: number, height: number}} Current viewport
   */
  getViewport() {
    return { ...this.#viewport };
  }

  /**
   * Get current transform
   *
   * @returns {{x: number, y: number, scale: number}} Current transform
   */
  getTransform() {
    return { ...this.#transform };
  }

  /**
   * Pan the viewport
   *
   * @param {number} deltaX - X offset in screen coordinates
   * @param {number} deltaY - Y offset in screen coordinates
   */
  pan(deltaX, deltaY) {
    // Use raw screen deltas for consistent pan speed at all zoom levels
    // No division by scale - panning feels the same regardless of zoom
    this.#viewport.x -= deltaX;
    this.#viewport.y -= deltaY;

    // Update transform for smooth panning
    this.#transform.x += deltaX;
    this.#transform.y += deltaY;

    if (this.#bounds) {
      this.constrainToBounds();
    }

    this.#notifyObservers();
  }

  /**
   * Zoom the viewport
   *
   * @param {number} factor - Zoom factor (>1 = zoom in, <1 = zoom out)
   * @param {number} centerX - Zoom center X in screen coordinates
   * @param {number} centerY - Zoom center Y in screen coordinates
   */
  zoom(factor, centerX, centerY) {
    const oldScale = this.#transform.scale;
    const newScale = oldScale * factor;

    // Clamp zoom level
    this.#transform.scale = Math.max(
      this.#minZoom,
      Math.min(this.#maxZoom, newScale)
    );
    const actualFactor = this.#transform.scale / oldScale;

    if (actualFactor === 1) return; // No change

    // Convert center point to world coordinates before zoom
    const worldX = this.#viewport.x + centerX / oldScale;
    const worldY = this.#viewport.y + centerY / oldScale;

    // Update viewport size
    const newWidth = this.#viewport.width * actualFactor;
    const newHeight = this.#viewport.height * actualFactor;

    // Adjust viewport position to maintain center point
    this.#viewport.x = worldX - centerX / this.#transform.scale;
    this.#viewport.y = worldY - centerY / this.#transform.scale;
    this.#viewport.width = newWidth;
    this.#viewport.height = newHeight;

    if (this.#bounds) {
      this.constrainToBounds();
    }

    this.#notifyObservers();
    this.#logger.debug(
      `ViewportManager: Zoomed to ${this.#transform.scale.toFixed(2)}x`
    );
  }

  /**
   * Reset viewport to default state
   */
  reset() {
    this.#viewport = {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    };
    this.#transform = {
      x: 0,
      y: 0,
      scale: 1,
    };
    this.#notifyObservers();
    this.#logger.debug('ViewportManager: Reset to default');
  }

  /**
   * Fit viewport to content bounds
   *
   * @param {{minX: number, minY: number, maxX: number, maxY: number}} contentBounds - Content bounding box
   * @param {number} [padding] - Padding around content
   */
  fitToContent(contentBounds, padding = 50) {
    const contentWidth = contentBounds.maxX - contentBounds.minX;
    const contentHeight = contentBounds.maxY - contentBounds.minY;

    if (contentWidth <= 0 || contentHeight <= 0) {
      this.#logger.warn('ViewportManager: Invalid content bounds for fit');
      return;
    }

    // Add padding
    const paddedWidth = contentWidth + padding * 2;
    const paddedHeight = contentHeight + padding * 2;

    // For radial layouts, ensure viewport is roughly square
    const maxDimension = Math.max(paddedWidth, paddedHeight);

    // Center of content
    const centerX = (contentBounds.minX + contentBounds.maxX) / 2;
    const centerY = (contentBounds.minY + contentBounds.maxY) / 2;

    // Set viewport to center on content
    this.#viewport = {
      x: centerX - maxDimension / 2,
      y: centerY - maxDimension / 2,
      width: maxDimension,
      height: maxDimension,
    };

    // Reset transform
    this.#transform = {
      x: 0,
      y: 0,
      scale: 1,
    };

    this.#notifyObservers();
    this.#logger.debug('ViewportManager: Fit to content', contentBounds);
  }

  /**
   * Convert screen coordinates to world coordinates
   *
   * @param {number} screenX - X in screen space
   * @param {number} screenY - Y in screen space
   * @returns {{x: number, y: number}} World coordinates
   */
  screenToWorld(screenX, screenY) {
    return {
      x: this.#viewport.x + screenX / this.#transform.scale,
      y: this.#viewport.y + screenY / this.#transform.scale,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   *
   * @param {number} worldX - X in world space
   * @param {number} worldY - Y in world space
   * @returns {{x: number, y: number}} Screen coordinates
   */
  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.#viewport.x) * this.#transform.scale,
      y: (worldY - this.#viewport.y) * this.#transform.scale,
    };
  }

  /**
   * Set viewport bounds
   *
   * @param {number} minX - Minimum X coordinate
   * @param {number} minY - Minimum Y coordinate
   * @param {number} maxX - Maximum X coordinate
   * @param {number} maxY - Maximum Y coordinate
   */
  setBounds(minX, minY, maxX, maxY) {
    this.#bounds = { minX, minY, maxX, maxY };
    this.#logger.debug('ViewportManager: Bounds set', this.#bounds);
    this.constrainToBounds();
  }

  /**
   * Clear viewport bounds
   */
  clearBounds() {
    this.#bounds = null;
    this.#logger.debug('ViewportManager: Bounds cleared');
  }

  /**
   * Constrain viewport to bounds
   */
  constrainToBounds() {
    if (!this.#bounds) return;

    let constrained = false;

    // Ensure viewport doesn't go outside bounds
    if (this.#viewport.x < this.#bounds.minX) {
      this.#viewport.x = this.#bounds.minX;
      constrained = true;
    }
    if (this.#viewport.y < this.#bounds.minY) {
      this.#viewport.y = this.#bounds.minY;
      constrained = true;
    }

    const maxViewportX = this.#bounds.maxX - this.#viewport.width;
    const maxViewportY = this.#bounds.maxY - this.#viewport.height;

    if (this.#viewport.x > maxViewportX) {
      this.#viewport.x = maxViewportX;
      constrained = true;
    }
    if (this.#viewport.y > maxViewportY) {
      this.#viewport.y = maxViewportY;
      constrained = true;
    }

    if (constrained) {
      this.#notifyObservers();
    }
  }

  /**
   * Set zoom limits
   *
   * @param {number} minZoom - Minimum zoom level
   * @param {number} maxZoom - Maximum zoom level
   */
  setZoomLimits(minZoom, maxZoom) {
    this.#minZoom = Math.max(0.01, minZoom);
    this.#maxZoom = Math.min(100, maxZoom);

    // Clamp current zoom
    if (this.#transform.scale < this.#minZoom) {
      this.#transform.scale = this.#minZoom;
      this.#notifyObservers();
    } else if (this.#transform.scale > this.#maxZoom) {
      this.#transform.scale = this.#maxZoom;
      this.#notifyObservers();
    }
  }

  /**
   * Subscribe to viewport changes
   *
   * @param {ViewportObserver} observer - Observer function
   * @returns {Function} Unsubscribe function
   */
  subscribe(observer) {
    this.#observers.add(observer);
    // Immediately notify with current state
    observer({
      viewport: this.getViewport(),
      transform: this.getTransform(),
    });

    return () => {
      this.unsubscribe(observer);
    };
  }

  /**
   * Unsubscribe from viewport changes
   *
   * @param {ViewportObserver} observer - Observer function
   */
  unsubscribe(observer) {
    this.#observers.delete(observer);
  }

  /**
   * Get viewport as SVG viewBox string
   *
   * @returns {string} SVG viewBox attribute value
   */
  getViewBoxString() {
    return `${this.#viewport.x} ${this.#viewport.y} ${this.#viewport.width} ${this.#viewport.height}`;
  }

  /**
   * Check if a point is visible in viewport
   *
   * @param {number} worldX - X in world space
   * @param {number} worldY - Y in world space
   * @param {number} [margin] - Additional margin
   * @returns {boolean} True if visible
   */
  isPointVisible(worldX, worldY, margin = 0) {
    return (
      worldX >= this.#viewport.x - margin &&
      worldX <= this.#viewport.x + this.#viewport.width + margin &&
      worldY >= this.#viewport.y - margin &&
      worldY <= this.#viewport.y + this.#viewport.height + margin
    );
  }

  /**
   * Notify observers of viewport changes
   *
   * @private
   */
  #notifyObservers() {
    const state = {
      viewport: this.getViewport(),
      transform: this.getTransform(),
    };

    for (const observer of this.#observers) {
      try {
        observer(state);
      } catch (error) {
        this.#logger.error('ViewportManager: Error in observer', error);
      }
    }
  }
}

export default ViewportManager;
