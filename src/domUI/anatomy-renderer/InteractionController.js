/**
 * @file InteractionController for anatomy visualization
 * @see VisualizationComposer.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { AnatomyRenderError } from '../../errors/anatomyRenderError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */

/**
 * Event handler function type
 *
 * @typedef {function(Event): void} EventHandler
 */

/**
 * Manages all user interactions for anatomy visualization.
 * Handles mouse, touch, and keyboard events with gesture recognition.
 */
class InteractionController {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IEventBus} dependencies.eventBus
   */
  constructor({ logger, eventBus }) {
    validateDependency(logger, 'ILogger');
    validateDependency(eventBus, 'IEventBus');

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#handlers = new Map();
    this.#activeGestures = new Set();
    this.#element = null;
    this.#isPanning = false;
    this.#panStart = { x: 0, y: 0 };
    this.#lastMousePosition = { x: 0, y: 0 };
    this.#boundHandlers = new Map();
  }

  /** @type {ILogger} */
  #logger;

  /** @type {IEventBus} */
  #eventBus;

  /** @type {Map<string, Set<EventHandler>>} */
  #handlers;

  /** @type {Set<string>} */
  #activeGestures;

  /** @type {Element|null} */
  #element;

  /** @type {boolean} */
  #isPanning;

  /** @type {{x: number, y: number}} */
  #panStart;

  /** @type {{x: number, y: number}} */
  #lastMousePosition;

  /** @type {Map<string, EventHandler>} */
  #boundHandlers;

  /**
   * Register an event handler
   *
   * @param {string} eventType - Event type (e.g., 'pan', 'zoom', 'click')
   * @param {EventHandler} handler - Handler function
   */
  registerHandler(eventType, handler) {
    if (!this.#handlers.has(eventType)) {
      this.#handlers.set(eventType, new Set());
    }
    this.#handlers.get(eventType).add(handler);
    this.#logger.debug(
      `InteractionController: Registered handler for ${eventType}`
    );
  }

  /**
   * Unregister an event handler
   *
   * @param {string} eventType - Event type
   * @param {EventHandler} handler - Handler function
   */
  unregisterHandler(eventType, handler) {
    const handlers = this.#handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.#handlers.delete(eventType);
      }
    }
  }

  /**
   * Attach interaction handlers to an element
   *
   * @param {Element} element - Element to attach handlers to
   * @throws {AnatomyRenderError} If interaction setup fails
   */
  attachToElement(element) {
    try {
      this.#element = element;

      // Create bound handlers
      this.#boundHandlers.set('mousedown', this.#handleMouseDown.bind(this));
      this.#boundHandlers.set('mousemove', this.#handleMouseMove.bind(this));
      this.#boundHandlers.set('mouseup', this.#handleMouseUp.bind(this));
      this.#boundHandlers.set('wheel', this.#handleWheel.bind(this));
      this.#boundHandlers.set('click', this.#handleClick.bind(this));
      this.#boundHandlers.set('mouseover', this.#handleMouseOver.bind(this));
      this.#boundHandlers.set('mouseout', this.#handleMouseOut.bind(this));
      this.#boundHandlers.set('touchstart', this.#handleTouchStart.bind(this));
      this.#boundHandlers.set('touchmove', this.#handleTouchMove.bind(this));
      this.#boundHandlers.set('touchend', this.#handleTouchEnd.bind(this));

      // Attach mouse events
      element.addEventListener(
        'mousedown',
        this.#boundHandlers.get('mousedown')
      );
      document.addEventListener(
        'mousemove',
        this.#boundHandlers.get('mousemove')
      );
      document.addEventListener('mouseup', this.#boundHandlers.get('mouseup'));
      element.addEventListener('wheel', this.#boundHandlers.get('wheel'), {
        passive: false,
      });
      element.addEventListener('click', this.#boundHandlers.get('click'));
      element.addEventListener(
        'mouseover',
        this.#boundHandlers.get('mouseover')
      );
      element.addEventListener('mouseout', this.#boundHandlers.get('mouseout'));

      // Attach touch events
      element.addEventListener(
        'touchstart',
        this.#boundHandlers.get('touchstart'),
        { passive: false }
      );
      element.addEventListener(
        'touchmove',
        this.#boundHandlers.get('touchmove'),
        { passive: false }
      );
      element.addEventListener('touchend', this.#boundHandlers.get('touchend'));

      this.#logger.debug('InteractionController: Attached to element');
    } catch (error) {
      throw AnatomyRenderError.interactionSetupFailed(
        'event attachment',
        error
      );
    }
  }

  /**
   * Detach interaction handlers from current element
   */
  detachFromElement() {
    if (!this.#element) return;

    // Remove mouse events
    this.#element.removeEventListener(
      'mousedown',
      this.#boundHandlers.get('mousedown')
    );
    document.removeEventListener(
      'mousemove',
      this.#boundHandlers.get('mousemove')
    );
    document.removeEventListener('mouseup', this.#boundHandlers.get('mouseup'));
    this.#element.removeEventListener(
      'wheel',
      this.#boundHandlers.get('wheel')
    );
    this.#element.removeEventListener(
      'click',
      this.#boundHandlers.get('click')
    );
    this.#element.removeEventListener(
      'mouseover',
      this.#boundHandlers.get('mouseover')
    );
    this.#element.removeEventListener(
      'mouseout',
      this.#boundHandlers.get('mouseout')
    );

    // Remove touch events
    this.#element.removeEventListener(
      'touchstart',
      this.#boundHandlers.get('touchstart')
    );
    this.#element.removeEventListener(
      'touchmove',
      this.#boundHandlers.get('touchmove')
    );
    this.#element.removeEventListener(
      'touchend',
      this.#boundHandlers.get('touchend')
    );

    this.#boundHandlers.clear();
    this.#element = null;
    this.#logger.debug('InteractionController: Detached from element');
  }

  /**
   * Start pan gesture
   *
   * @param {{clientX: number, clientY: number}} event - Mouse/touch event
   */
  startPan(event) {
    this.#isPanning = true;
    this.#panStart = { x: event.clientX, y: event.clientY };
    this.#lastMousePosition = { x: event.clientX, y: event.clientY };
    this.#activeGestures.add('pan');
    this.#triggerHandlers('panstart', { position: this.#panStart });
  }

  /**
   * Update pan gesture
   *
   * @param {{clientX: number, clientY: number}} event - Mouse/touch event
   */
  updatePan(event) {
    if (!this.#isPanning) return;

    const deltaX = event.clientX - this.#lastMousePosition.x;
    const deltaY = event.clientY - this.#lastMousePosition.y;

    this.#triggerHandlers('pan', {
      deltaX,
      deltaY,
      position: { x: event.clientX, y: event.clientY },
    });

    this.#lastMousePosition = { x: event.clientX, y: event.clientY };
  }

  /**
   * End pan gesture
   */
  endPan() {
    if (!this.#isPanning) return;

    this.#isPanning = false;
    this.#activeGestures.delete('pan');
    this.#triggerHandlers('panend', {});
  }

  /**
   * Handle zoom gesture
   *
   * @param {WheelEvent} event - Wheel event
   */
  handleZoom(event) {
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const rect = this.#element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.#triggerHandlers('zoom', { zoomFactor, x, y, deltaY: event.deltaY });
  }

  /**
   * Handle click
   *
   * @param {MouseEvent} event - Click event
   */
  handleClick(event) {
    const target = this.#getEventTarget(event);
    this.#triggerHandlers('click', { event, target });
  }

  /**
   * Handle hover
   *
   * @param {MouseEvent} event - Mouse event
   * @param {boolean} isEntering - True if entering, false if leaving
   */
  handleHover(event, isEntering) {
    const target = this.#getEventTarget(event);
    this.#triggerHandlers(isEntering ? 'hoverenter' : 'hoverleave', {
      event,
      target,
    });
  }

  /**
   * Handle key press
   *
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyPress(event) {
    this.#triggerHandlers('keypress', { key: event.key, event });
  }

  /**
   * Handle touch events
   *
   * @param {TouchEvent} event - Touch event
   * @param {string} phase - Touch phase ('start', 'move', 'end')
   */
  handleTouch(event, phase) {
    if (event.touches.length === 1) {
      // Single touch - treat as mouse-like interaction
      const touch = event.touches[0];
      if (phase === 'start') {
        this.startPan(touch);
      } else if (phase === 'move') {
        this.updatePan(touch);
      } else if (phase === 'end') {
        this.endPan();
      }
    } else if (event.touches.length === 2 && phase === 'move') {
      // Two finger pinch - zoom gesture
      this.#handlePinchZoom(event);
    }
  }

  /**
   * Get current gesture state
   *
   * @returns {{isPanning: boolean, activeGestures: Array<string>}} Gesture state
   */
  getGestureState() {
    return {
      isPanning: this.#isPanning,
      activeGestures: Array.from(this.#activeGestures),
    };
  }

  /**
   * Mouse down handler
   *
   * @private
   * @param {MouseEvent} event
   */
  #handleMouseDown(event) {
    if (event.button === 0) {
      // Left click
      const target = event.target;
      // Don't start pan if clicking on a node
      const anatomyNode =
        target && target.closest && target.closest('.anatomy-node');
      if (!anatomyNode) {
        this.startPan(event);
        event.preventDefault();
      }
    }
  }

  /**
   * Mouse move handler
   *
   * @private
   * @param {MouseEvent} event
   */
  #handleMouseMove(event) {
    if (this.#isPanning) {
      this.updatePan(event);
    }
  }

  /**
   * Mouse up handler
   *
   * @private
   */
  #handleMouseUp() {
    this.endPan();
  }

  /**
   * Wheel handler
   *
   * @private
   * @param {WheelEvent} event
   */
  #handleWheel(event) {
    event.preventDefault();
    this.handleZoom(event);
  }

  /**
   * Click handler
   *
   * @private
   * @param {MouseEvent} event
   */
  #handleClick(event) {
    // Don't handle click if we were panning
    if (this.#activeGestures.has('pan')) return;
    this.handleClick(event);
  }

  /**
   * Mouse over handler
   *
   * @private
   * @param {MouseEvent} event
   */
  #handleMouseOver(event) {
    this.handleHover(event, true);
  }

  /**
   * Mouse out handler
   *
   * @private
   * @param {MouseEvent} event
   */
  #handleMouseOut(event) {
    this.handleHover(event, false);
  }

  /**
   * Touch start handler
   *
   * @private
   * @param {TouchEvent} event
   */
  #handleTouchStart(event) {
    event.preventDefault();
    this.handleTouch(event, 'start');
  }

  /**
   * Touch move handler
   *
   * @private
   * @param {TouchEvent} event
   */
  #handleTouchMove(event) {
    event.preventDefault();
    this.handleTouch(event, 'move');
  }

  /**
   * Touch end handler
   *
   * @private
   * @param {TouchEvent} event
   */
  #handleTouchEnd(event) {
    this.handleTouch(event, 'end');
  }

  /**
   * Handle pinch zoom gesture
   *
   * @private
   * @param {TouchEvent} event
   */
  #handlePinchZoom(event) {
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];

    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    if (this.#lastPinchDistance) {
      const zoomFactor = distance / this.#lastPinchDistance;
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      const rect = this.#element.getBoundingClientRect();
      const x = centerX - rect.left;
      const y = centerY - rect.top;

      this.#triggerHandlers('zoom', { zoomFactor, x, y });
    }

    this.#lastPinchDistance = distance;
  }

  /** @type {number|undefined} */
  #lastPinchDistance;

  /**
   * Get event target info
   *
   * @private
   * @param {Event} event
   * @returns {object} Target information
   */
  #getEventTarget(event) {
    const target = event.target;
    const nodeElement = target.closest('.anatomy-node');

    if (nodeElement) {
      return {
        type: 'node',
        id: nodeElement.getAttribute('data-node-id'),
        element: nodeElement,
      };
    }

    const edgeElement = target.closest('.anatomy-edge');
    if (edgeElement) {
      return {
        type: 'edge',
        source: edgeElement.getAttribute('data-source'),
        target: edgeElement.getAttribute('data-target'),
        element: edgeElement,
      };
    }

    return {
      type: 'background',
      element: target,
    };
  }

  /**
   * Trigger handlers for an event type
   *
   * @private
   * @param {string} eventType
   * @param {object} data
   */
  #triggerHandlers(eventType, data) {
    const handlers = this.#handlers.get(eventType);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        this.#logger.error(
          `InteractionController: Error in ${eventType} handler`,
          error
        );
      }
    }

    // Also dispatch event bus events
    this.#eventBus.dispatch(`anatomy:interaction_${eventType}`, data);
  }
}

export default InteractionController;
