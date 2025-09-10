/**
 * @file Drag handling utility for notification badge
 * @see criticalLogNotifier.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Handles drag-to-reposition functionality for notification badge.
 * Supports both mouse and touch events with long-press activation.
 */
class DragHandler {
  #element;
  #container;
  #isDragging = false;
  #isEnabled = false;
  #startX = 0;
  #startY = 0;
  #currentX = 0;
  #currentY = 0;
  #initialLeft = 0;
  #initialTop = 0;
  #callbacks;
  #logger;
  #boundHandlers = {};
  #snapThreshold = 50; // Pixels from edge to snap
  #longPressTimer = null;
  #longPressDelay = 500; // ms to trigger drag mode

  /**
   * Creates a new DragHandler instance.
   *
   * @param {object} dependencies - Dependencies object
   * @param {HTMLElement} dependencies.element - Element that triggers drag (badge)
   * @param {HTMLElement} dependencies.container - Container to be dragged (notifier)
   * @param {object} [dependencies.callbacks] - Callback functions
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ element, container, callbacks, logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'warn'],
    });

    this.#element = element;
    this.#container = container;
    this.#callbacks = callbacks || {};
    this.#logger = logger;

    this.#initializeDragHandlers();
  }

  /**
   * Initialize event handler bindings.
   *
   * @private
   */
  #initializeDragHandlers() {
    // Mouse events
    this.#boundHandlers.mousedown = this.#handleMouseDown.bind(this);
    this.#boundHandlers.mousemove = this.#handleMouseMove.bind(this);
    this.#boundHandlers.mouseup = this.#handleMouseUp.bind(this);

    // Touch events for mobile
    this.#boundHandlers.touchstart = this.#handleTouchStart.bind(this);
    this.#boundHandlers.touchmove = this.#handleTouchMove.bind(this);
    this.#boundHandlers.touchend = this.#handleTouchEnd.bind(this);

    // Prevent context menu during drag
    this.#boundHandlers.contextmenu = this.#handleContextMenu.bind(this);

    // Escape key to cancel drag
    this.#boundHandlers.keydown = this.#handleKeyDown.bind(this);
  }

  /**
   * Enable drag functionality.
   */
  /**
   * Enable drag functionality.
   */
  enable() {
    // Prevent multiple registrations or operation after destroy
    if (this.#isEnabled || !this.#element) {
      return;
    }

    // Element-level events
    this.#element.addEventListener('mousedown', this.#boundHandlers.mousedown, {
      passive: false,
    });
    this.#element.addEventListener(
      'touchstart',
      this.#boundHandlers.touchstart,
      {
        passive: false,
      }
    );
    this.#element.addEventListener(
      'contextmenu',
      this.#boundHandlers.contextmenu
    );

    // Document-level events for drag operations
    document.addEventListener('mousemove', this.#boundHandlers.mousemove, {
      passive: false,
    });
    document.addEventListener('mouseup', this.#boundHandlers.mouseup, {
      passive: false,
    });
    document.addEventListener('touchmove', this.#boundHandlers.touchmove, {
      passive: false,
    });
    document.addEventListener('touchend', this.#boundHandlers.touchend, {
      passive: false,
    });
    document.addEventListener('keydown', this.#boundHandlers.keydown);

    // Add visual indicator
    this.#element.style.cursor = 'move';
    this.#element.setAttribute('title', 'Hold to drag');

    this.#isEnabled = true;
    this.#logger.debug('Drag functionality enabled');
  }

  /**
   * Disable drag functionality.
   */
  disable() {
    if (!this.#isEnabled || !this.#element) {
      return;
    }

    // Remove element-level event listeners
    this.#element.removeEventListener(
      'mousedown',
      this.#boundHandlers.mousedown
    );
    this.#element.removeEventListener(
      'touchstart',
      this.#boundHandlers.touchstart
    );
    this.#element.removeEventListener(
      'contextmenu',
      this.#boundHandlers.contextmenu
    );

    // Remove document-level listeners
    document.removeEventListener('mousemove', this.#boundHandlers.mousemove);
    document.removeEventListener('mouseup', this.#boundHandlers.mouseup);
    document.removeEventListener('touchmove', this.#boundHandlers.touchmove);
    document.removeEventListener('touchend', this.#boundHandlers.touchend);
    document.removeEventListener('keydown', this.#boundHandlers.keydown);

    // Reset cursor
    this.#element.style.cursor = 'pointer';

    // Clear any active drag
    this.#cancelDrag();

    this.#isEnabled = false;
    this.#logger.debug('Drag functionality disabled');
  }

  /**
   * Handle mouse down event.
   *
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  #handleMouseDown(e) {
    // Start long press timer
    this.#longPressTimer = setTimeout(() => {
      this.#startDrag(e.clientX, e.clientY);
    }, this.#longPressDelay);

    // Prevent text selection
    e.preventDefault();
  }

  /**
   * Handle mouse move event.
   *
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  #handleMouseMove(e) {
    if (!this.#isDragging) return;

    e.preventDefault();
    this.#updateDragPosition(e.clientX, e.clientY);
  }

  /**
   * Handle mouse up event.
   *
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  /**
   * Handle mouse up event.
   *
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  /**
   * Handle mouse up event.
   *
   * @param {MouseEvent} e - Mouse event
   * @private
   */
  #handleMouseUp(e) {
    this.#clearLongPressTimer();

    if (this.#isDragging) {
      e.preventDefault();
      this.#endDrag(e.clientX, e.clientY);
    }
  }

  /**
   * Handle touch start event.
   *
   * @param {TouchEvent} e - Touch event
   * @private
   */
  #handleTouchStart(e) {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];

    // Start long press timer
    this.#longPressTimer = setTimeout(() => {
      this.#startDrag(touch.clientX, touch.clientY);

      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, this.#longPressDelay);

    e.preventDefault();
  }

  /**
   * Handle touch move event.
   *
   * @param {TouchEvent} e - Touch event
   * @private
   */
  #handleTouchMove(e) {
    if (!this.#isDragging) return;
    if (e.touches.length !== 1) return;

    e.preventDefault();
    const touch = e.touches[0];
    this.#updateDragPosition(touch.clientX, touch.clientY);
  }

  /**
   * Handle touch end event.
   *
   * @param {TouchEvent} _e - Touch event
   * @private
   */
  /**
   * Handle touch end event.
   *
   * @param {TouchEvent} e - Touch event
   * @private
   */
  #handleTouchEnd(e) {
    this.#clearLongPressTimer();

    if (this.#isDragging) {
      e.preventDefault();
      // Use last known position
      this.#endDrag(this.#currentX, this.#currentY);
    }
  }

  /**
   * Handle context menu event.
   *
   * @param {Event} e - Context menu event
   * @private
   * @returns {boolean|undefined} False if dragging, undefined otherwise
   */
  #handleContextMenu(e) {
    if (this.#isDragging) {
      e.preventDefault();
      return false;
    }
  }

  /**
   * Handle keyboard events.
   *
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  /**
   * Handle keyboard events.
   *
   * @param {KeyboardEvent} e - Keyboard event
   * @private
   */
  #handleKeyDown(e) {
    // Escape cancels drag
    if (e.key === 'Escape' && this.#isDragging) {
      e.preventDefault();
      this.#cancelDrag();
    }
  }

  /**
   * Start drag operation.
   *
   * @param {number} x - Starting X coordinate
   * @param {number} y - Starting Y coordinate
   * @private
   */
  #startDrag(x, y) {
    this.#isDragging = true;
    this.#startX = x;
    this.#startY = y;
    this.#currentX = x;
    this.#currentY = y;

    // Get initial position
    const rect = this.#container.getBoundingClientRect();
    this.#initialLeft = rect.left;
    this.#initialTop = rect.top;

    // Set container to absolute positioning for dragging
    this.#container.style.position = 'fixed';
    this.#container.style.left = `${this.#initialLeft}px`;
    this.#container.style.top = `${this.#initialTop}px`;
    this.#container.style.right = 'auto';
    this.#container.style.bottom = 'auto';

    // Add dragging class for visual feedback
    this.#container.classList.add('dragging');

    // Disable pointer events on panel during drag
    const panel = this.#container.querySelector('.lne-log-panel');
    if (panel) {
      panel.style.pointerEvents = 'none';
    }

    if (this.#callbacks.onDragStart) {
      this.#callbacks.onDragStart();
    }

    this.#logger.debug('Drag started');
  }

  /**
   * Update drag position.
   *
   * @param {number} x - Current X coordinate
   * @param {number} y - Current Y coordinate
   * @private
   */
  #updateDragPosition(x, y) {
    this.#currentX = x;
    this.#currentY = y;

    const deltaX = x - this.#startX;
    const deltaY = y - this.#startY;

    let newLeft = this.#initialLeft + deltaX;
    let newTop = this.#initialTop + deltaY;

    // Constrain to viewport
    const containerRect = this.#container.getBoundingClientRect();
    const maxX = window.innerWidth - containerRect.width;
    const maxY = window.innerHeight - containerRect.height;

    newLeft = Math.max(0, Math.min(newLeft, maxX));
    newTop = Math.max(0, Math.min(newTop, maxY));

    // Apply position
    this.#container.style.left = `${newLeft}px`;
    this.#container.style.top = `${newTop}px`;

    // Show snap guides if near edges
    this.#showSnapGuides(
      newLeft,
      newTop,
      containerRect.width,
      containerRect.height
    );
  }

  /**
   * End drag operation.
   *
   * @param {number} _x - Final X coordinate
   * @param {number} _y - Final Y coordinate
   * @private
   */
  /**
   * End drag operation.
   *
   * @param {number} _x - Final X coordinate
   * @param {number} _y - Final Y coordinate
   * @private
   */
  /**
   * End drag operation.
   *
   * @param {number} _x - Final X coordinate
   * @param {number} _y - Final Y coordinate
   * @private
   */
  #endDrag(_x, _y) {
    this.#isDragging = false;

    // Remove dragging class
    this.#container.classList.remove('dragging');

    // Re-enable pointer events on panel
    const panel = this.#container.querySelector('.lne-log-panel');
    if (panel) {
      panel.style.pointerEvents = 'auto';
    }

    // Determine final position (with snapping)
    const finalPosition = this.#calculateFinalPosition();

    // Apply final position
    this.#applyPosition(finalPosition);

    if (this.#callbacks.onDragEnd) {
      this.#callbacks.onDragEnd(finalPosition);
    }

    this.#logger.debug(`Drag ended, position: ${finalPosition}`);
  }

  /**
   * Cancel drag operation.
   *
   * @private
   */
  /**
   * Cancel drag operation.
   *
   * @private
   */
  #cancelDrag() {
    this.#clearLongPressTimer();

    if (this.#isDragging) {
      this.#isDragging = false;

      // Remove dragging class
      this.#container.classList.remove('dragging');

      // Re-enable pointer events on panel
      const panel = this.#container.querySelector('.lne-log-panel');
      if (panel) {
        panel.style.pointerEvents = 'auto';
      }

      // Reset to original position
      this.#applyPosition(this.#getOriginalPosition());

      this.#logger.debug('Drag cancelled');
    }
  }

  /**
   * Clear long press timer.
   *
   * @private
   */
  #clearLongPressTimer() {
    if (this.#longPressTimer) {
      clearTimeout(this.#longPressTimer);
      this.#longPressTimer = null;
    }
  }

  /**
   * Calculate final position with snapping.
   *
   * @returns {string} Position identifier
   * @private
   */
  /**
   * Calculate final position with snapping.
   *
   * @returns {string} Position identifier
   * @private
   */
  #calculateFinalPosition() {
    try {
      const rect = this.#container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Determine position based on container's proximity to edges
      let position;

      // Check if within snap threshold of any edge
      const leftDistance = rect.left;
      const rightDistance = viewportWidth - rect.right;
      const topDistance = rect.top;
      const bottomDistance = viewportHeight - rect.bottom;

      // Snap to edges if within threshold
      if (
        leftDistance < this.#snapThreshold ||
        rightDistance < this.#snapThreshold ||
        topDistance < this.#snapThreshold ||
        bottomDistance < this.#snapThreshold
      ) {
        // Determine which edge is closest
        const minDistance = Math.min(
          leftDistance,
          rightDistance,
          topDistance,
          bottomDistance
        );

        if (minDistance === leftDistance) {
          position = centerY < viewportHeight / 2 ? 'top-left' : 'bottom-left';
        } else if (minDistance === rightDistance) {
          position =
            centerY < viewportHeight / 2 ? 'top-right' : 'bottom-right';
        } else if (minDistance === topDistance) {
          position = centerX < viewportWidth / 2 ? 'top-left' : 'top-right';
        } else {
          // bottomDistance
          position =
            centerX < viewportWidth / 2 ? 'bottom-left' : 'bottom-right';
        }
      } else {
        // Not near edges - determine quadrant based on center position
        const isLeft = centerX < viewportWidth / 2;
        const isTop = centerY < viewportHeight / 2;

        if (isLeft && isTop) {
          position = 'top-left';
        } else if (!isLeft && isTop) {
          position = 'top-right';
        } else if (isLeft && !isTop) {
          position = 'bottom-left';
        } else {
          position = 'bottom-right';
        }
      }

      return position;
    } catch (err) {
      this.#logger.warn('Error calculating final position, using default', err);
      return this.#getOriginalPosition();
    }
  }

  /**
   * Apply position to container.
   *
   * @param {string} position - Position identifier
   * @private
   */
  #applyPosition(position) {
    this.#container.setAttribute('data-position', position);

    // Reset to CSS-defined position
    this.#container.style.position = 'fixed';

    const positions = {
      'top-left': {
        top: '20px',
        left: '20px',
        right: 'auto',
        bottom: 'auto',
      },
      'top-right': {
        top: '20px',
        right: '20px',
        left: 'auto',
        bottom: 'auto',
      },
      'bottom-left': {
        bottom: '20px',
        left: '20px',
        top: 'auto',
        right: 'auto',
      },
      'bottom-right': {
        bottom: '20px',
        right: '20px',
        top: 'auto',
        left: 'auto',
      },
    };

    const pos = positions[position];
    Object.assign(this.#container.style, pos);
  }

  /**
   * Get original position from container.
   *
   * @returns {string} Position identifier
   * @private
   */
  #getOriginalPosition() {
    return this.#container.getAttribute('data-position') || 'top-right';
  }

  /**
   * Show snap guides (visual feedback for snap zones).
   *
   * @param {number} _left - Left position
   * @param {number} _top - Top position
   * @param {number} _width - Container width
   * @param {number} _height - Container height
   * @private
   */
  #showSnapGuides(_left, _top, _width, _height) {
    // Visual feedback for snap zones (future enhancement)
    // Could show translucent guides when near edges
  }

  /**
   * Clean up and destroy drag handler.
   */
  destroy() {
    this.disable();
    this.#element = null;
    this.#container = null;
    this.#callbacks = null;
  }
}

export default DragHandler;
