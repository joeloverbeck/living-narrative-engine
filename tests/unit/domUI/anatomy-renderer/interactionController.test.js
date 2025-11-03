/**
 * @file Unit tests for InteractionController
 * @description Tests for anatomy visualization interaction handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import InteractionController from '../../../../src/domUI/anatomy-renderer/InteractionController.js';
import { AnatomyRenderError } from '../../../../src/errors/anatomyRenderError.js';

describe('InteractionController', () => {
  let interactionController;
  let mockLogger;
  let mockEventBus;
  let mockElement;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    // Mock DOM element
    mockElement = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getBoundingClientRect: jest.fn().mockReturnValue({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    };

    // Mock document - ensure it's a Jest mock
    if (global.document) {
      global.document.addEventListener = jest.fn();
      global.document.removeEventListener = jest.fn();
    } else {
      global.document = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      expect(interactionController).toBeInstanceOf(InteractionController);
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new InteractionController({
          logger: null,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error with invalid eventBus', () => {
      expect(() => {
        new InteractionController({
          logger: mockLogger,
          eventBus: null,
        });
      }).toThrow();
    });

    it('should initialize with default state', () => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      const state = interactionController.getGestureState();
      expect(state.isPanning).toBe(false);
      expect(state.activeGestures).toEqual([]);
    });
  });

  describe('Handler Registration', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should register handler for event type', () => {
      const handler = jest.fn();

      interactionController.registerHandler('pan', handler);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'InteractionController: Registered handler for pan'
      );
    });

    it('should register multiple handlers for same event type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      interactionController.registerHandler('pan', handler1);
      interactionController.registerHandler('pan', handler2);

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
    });

    it('should unregister handler', () => {
      const handler = jest.fn();

      interactionController.registerHandler('pan', handler);
      interactionController.unregisterHandler('pan', handler);

      // Should not call handler after unregistering
      interactionController.startPan({ clientX: 100, clientY: 200 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle unregistering non-existent handler', () => {
      const handler = jest.fn();

      // Should not throw when unregistering non-existent handler
      expect(() => {
        interactionController.unregisterHandler('nonexistent', handler);
      }).not.toThrow();
    });
  });

  describe('Element Attachment', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should attach to element successfully', () => {
      interactionController.attachToElement(mockElement);

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        { passive: false }
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'mouseover',
        expect.any(Function)
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'mouseout',
        expect.any(Function)
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { passive: false }
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        { passive: false }
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function)
      );

      // Document event listeners are attached
      expect(global.document.addEventListener).toHaveBeenCalledTimes(2);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'InteractionController: Attached to element'
      );
    });

    it('should throw AnatomyRenderError on attachment failure', () => {
      const errorElement = {
        addEventListener: jest.fn().mockImplementation(() => {
          throw new Error('Attachment failed');
        }),
      };

      expect(() => {
        interactionController.attachToElement(errorElement);
      }).toThrow(AnatomyRenderError);
    });

    it('should detach from element successfully', () => {
      interactionController.attachToElement(mockElement);
      interactionController.detachFromElement();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function)
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function)
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'mouseover',
        expect.any(Function)
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'mouseout',
        expect.any(Function)
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function)
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function)
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function)
      );

      // Document event listeners are removed
      expect(global.document.removeEventListener).toHaveBeenCalledTimes(2);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'InteractionController: Detached from element'
      );
    });

    it('should handle detach when no element attached', () => {
      // Should not throw when detaching without element
      expect(() => {
        interactionController.detachFromElement();
      }).not.toThrow();
    });
  });

  describe('Pan Gesture Methods', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should start pan gesture', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panstart', handler);

      const event = { clientX: 100, clientY: 200 };
      interactionController.startPan(event);

      const state = interactionController.getGestureState();
      expect(state.isPanning).toBe(true);
      expect(state.activeGestures).toContain('pan');

      expect(handler).toHaveBeenCalledWith({
        position: { x: 100, y: 200 },
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:interaction_panstart',
        { position: { x: 100, y: 200 } }
      );
    });

    it('should update pan gesture', () => {
      const handler = jest.fn();
      interactionController.registerHandler('pan', handler);

      // Start pan first
      interactionController.startPan({ clientX: 100, clientY: 200 });

      // Update pan
      const event = { clientX: 120, clientY: 230 };
      interactionController.updatePan(event);

      expect(handler).toHaveBeenCalledWith({
        deltaX: 20,
        deltaY: 30,
        position: { x: 120, y: 230 },
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:interaction_pan',
        {
          deltaX: 20,
          deltaY: 30,
          position: { x: 120, y: 230 },
        }
      );
    });

    it('should not update pan when not panning', () => {
      const handler = jest.fn();
      interactionController.registerHandler('pan', handler);

      // Try to update without starting pan
      const event = { clientX: 120, clientY: 230 };
      interactionController.updatePan(event);

      expect(handler).not.toHaveBeenCalled();
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should end pan gesture', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panend', handler);

      // Start pan first
      interactionController.startPan({ clientX: 100, clientY: 200 });

      // End pan
      interactionController.endPan();

      const state = interactionController.getGestureState();
      expect(state.isPanning).toBe(false);
      expect(state.activeGestures).not.toContain('pan');

      expect(handler).toHaveBeenCalledWith({});

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:interaction_panend',
        {}
      );
    });

    it('should not end pan when not panning', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panend', handler);

      // Try to end without starting pan
      interactionController.endPan();

      expect(handler).not.toHaveBeenCalled();
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should calculate delta correctly for consecutive updates', () => {
      const handler = jest.fn();
      interactionController.registerHandler('pan', handler);

      // Start pan
      interactionController.startPan({ clientX: 100, clientY: 200 });

      // First update
      interactionController.updatePan({ clientX: 120, clientY: 230 });
      expect(handler).toHaveBeenLastCalledWith({
        deltaX: 20,
        deltaY: 30,
        position: { x: 120, y: 230 },
      });

      // Second update (delta should be from last position)
      interactionController.updatePan({ clientX: 140, clientY: 250 });
      expect(handler).toHaveBeenLastCalledWith({
        deltaX: 20,
        deltaY: 20,
        position: { x: 140, y: 250 },
      });
    });
  });

  describe('Zoom Handling', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
      interactionController.attachToElement(mockElement);
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should handle zoom in', () => {
      const handler = jest.fn();
      interactionController.registerHandler('zoom', handler);

      const event = {
        deltaY: 100, // Positive delta = zoom in
        clientX: 400,
        clientY: 300,
      };

      interactionController.handleZoom(event);

      expect(handler).toHaveBeenCalledWith({
        zoomFactor: 1.1,
        x: 400,
        y: 300,
        deltaY: 100,
      });
    });

    it('should handle zoom out', () => {
      const handler = jest.fn();
      interactionController.registerHandler('zoom', handler);

      const event = {
        deltaY: -100, // Negative delta = zoom out
        clientX: 400,
        clientY: 300,
      };

      interactionController.handleZoom(event);

      expect(handler).toHaveBeenCalledWith({
        zoomFactor: 0.9,
        x: 400,
        y: 300,
        deltaY: -100,
      });
    });
  });

  describe('Click Handling', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should handle click on background', () => {
      const handler = jest.fn();
      interactionController.registerHandler('click', handler);

      const mockTarget = {
        closest: jest.fn().mockReturnValue(null),
      };

      const event = { target: mockTarget };
      interactionController.handleClick(event);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: {
          type: 'background',
          element: mockTarget,
        },
      });
    });

    it('should handle click on anatomy node', () => {
      const handler = jest.fn();
      interactionController.registerHandler('click', handler);

      const mockNodeElement = {
        getAttribute: jest.fn().mockReturnValue('node123'),
      };

      const mockTarget = {
        closest: jest.fn().mockImplementation((selector) => {
          if (selector === '.anatomy-node') return mockNodeElement;
          return null;
        }),
      };

      const event = { target: mockTarget };
      interactionController.handleClick(event);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: {
          type: 'node',
          id: 'node123',
          element: mockNodeElement,
        },
      });
    });

    it('should handle click on anatomy edge', () => {
      const handler = jest.fn();
      interactionController.registerHandler('click', handler);

      const mockEdgeElement = {
        getAttribute: jest.fn().mockImplementation((attr) => {
          if (attr === 'data-source') return 'source123';
          if (attr === 'data-target') return 'target456';
          return null;
        }),
      };

      const mockTarget = {
        closest: jest.fn().mockImplementation((selector) => {
          if (selector === '.anatomy-node') return null;
          if (selector === '.anatomy-edge') return mockEdgeElement;
          return null;
        }),
      };

      const event = { target: mockTarget };
      interactionController.handleClick(event);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: {
          type: 'edge',
          source: 'source123',
          target: 'target456',
          element: mockEdgeElement,
        },
      });
    });
  });

  describe('Hover Handling', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should handle hover enter', () => {
      const handler = jest.fn();
      interactionController.registerHandler('hoverenter', handler);

      const mockTarget = {
        closest: jest.fn().mockReturnValue(null),
      };

      const event = { target: mockTarget };
      interactionController.handleHover(event, true);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: {
          type: 'background',
          element: mockTarget,
        },
      });
    });

    it('should handle hover leave', () => {
      const handler = jest.fn();
      interactionController.registerHandler('hoverleave', handler);

      const mockTarget = {
        closest: jest.fn().mockReturnValue(null),
      };

      const event = { target: mockTarget };
      interactionController.handleHover(event, false);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: {
          type: 'background',
          element: mockTarget,
        },
      });
    });
  });

  describe('Key Press Handling', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should handle key press', () => {
      const handler = jest.fn();
      interactionController.registerHandler('keypress', handler);

      const event = { key: 'Enter' };
      interactionController.handleKeyPress(event);

      expect(handler).toHaveBeenCalledWith({
        key: 'Enter',
        event,
      });
    });
  });

  describe('Touch Handling', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
      interactionController.attachToElement(mockElement);
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should handle single touch as pan start', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panstart', handler);

      const event = {
        touches: [
          {
            clientX: 100,
            clientY: 200,
          },
        ],
      };

      interactionController.handleTouch(event, 'start');

      expect(handler).toHaveBeenCalledWith({
        position: { x: 100, y: 200 },
      });
    });

    it('should handle single touch as pan move', () => {
      const handler = jest.fn();
      interactionController.registerHandler('pan', handler);

      // Start pan first
      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      };
      interactionController.handleTouch(startEvent, 'start');

      // Move touch
      const moveEvent = {
        touches: [{ clientX: 120, clientY: 230 }],
      };
      interactionController.handleTouch(moveEvent, 'move');

      expect(handler).toHaveBeenCalledWith({
        deltaX: 20,
        deltaY: 30,
        position: { x: 120, y: 230 },
      });
    });

    it('should handle single touch as pan end', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panend', handler);

      // Start pan first
      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      };
      interactionController.handleTouch(startEvent, 'start');

      // End touch - needs single touch to match the logic
      const endEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      };
      interactionController.handleTouch(endEvent, 'end');

      expect(handler).toHaveBeenCalledWith({});
    });

    it('should handle two finger touch as zoom', () => {
      const handler = jest.fn();
      interactionController.registerHandler('zoom', handler);

      const event = {
        touches: [
          { clientX: 100, clientY: 200 },
          { clientX: 200, clientY: 300 },
        ],
      };

      interactionController.handleTouch(event, 'move');

      // Should not call zoom handler on first touch (no previous distance)
      expect(handler).not.toHaveBeenCalled();

      // Second touch should calculate zoom
      interactionController.handleTouch(event, 'move');

      expect(handler).toHaveBeenCalledWith({
        zoomFactor: 1, // Same distance = no zoom
        x: 150, // Center X
        y: 250, // Center Y
      });
    });

    it('should handle zoom with different distances', () => {
      const handler = jest.fn();
      interactionController.registerHandler('zoom', handler);

      // First touch to establish distance
      const event1 = {
        touches: [
          { clientX: 100, clientY: 200 },
          { clientX: 200, clientY: 300 },
        ],
      };
      interactionController.handleTouch(event1, 'move');

      // Second touch with different distance
      const event2 = {
        touches: [
          { clientX: 50, clientY: 175 },
          { clientX: 250, clientY: 325 },
        ],
      };
      interactionController.handleTouch(event2, 'move');

      expect(handler).toHaveBeenCalledWith({
        zoomFactor: expect.any(Number),
        x: 150, // Center X
        y: 250, // Center Y
      });
    });

    it('should ignore touches with more than 2 fingers', () => {
      const handler = jest.fn();
      interactionController.registerHandler('zoom', handler);

      const event = {
        touches: [
          { clientX: 100, clientY: 200 },
          { clientX: 200, clientY: 300 },
          { clientX: 300, clientY: 400 },
        ],
      };

      interactionController.handleTouch(event, 'move');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should handle errors in event handlers', () => {
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      interactionController.registerHandler('panstart', errorHandler);

      // Should not throw, but log error
      expect(() => {
        interactionController.startPan({ clientX: 100, clientY: 200 });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'InteractionController: Error in panstart handler',
        expect.any(Error)
      );
    });

    it('should continue with other handlers after error', () => {
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const goodHandler = jest.fn();

      interactionController.registerHandler('panstart', errorHandler);
      interactionController.registerHandler('panstart', goodHandler);

      interactionController.startPan({ clientX: 100, clientY: 200 });

      expect(errorHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Event Dispatching', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
    });

    it('should dispatch event bus events for registered handlers', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panstart', handler);

      interactionController.startPan({ clientX: 100, clientY: 200 });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:interaction_panstart',
        { position: { x: 100, y: 200 } }
      );
    });

    it('should dispatch event bus events even without handlers', () => {
      // Register a dummy handler to ensure triggerHandlers doesn't return early
      const dummyHandler = jest.fn();
      interactionController.registerHandler('panstart', dummyHandler);

      interactionController.startPan({ clientX: 100, clientY: 200 });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:interaction_panstart',
        { position: { x: 100, y: 200 } }
      );
    });
  });

  describe('Private Mouse Handlers', () => {
    beforeEach(() => {
      interactionController = new InteractionController({
        logger: mockLogger,
        eventBus: mockEventBus,
      });
      interactionController.attachToElement(mockElement);
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should handle mouse down on left button', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panstart', handler);

      const event = {
        button: 0, // Left button
        clientX: 100,
        clientY: 200,
        target: { closest: jest.fn().mockReturnValue(null) },
        preventDefault: jest.fn(),
      };

      // Get the bound mousedown handler
      const mouseDownHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'mousedown'
      )[1];

      mouseDownHandler(event);

      expect(handler).toHaveBeenCalledWith({
        position: { x: 100, y: 200 },
      });
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not handle mouse down on anatomy node', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panstart', handler);

      const mockNode = { closest: jest.fn().mockReturnValue(true) };
      const event = {
        button: 0, // Left button
        clientX: 100,
        clientY: 200,
        target: mockNode,
        preventDefault: jest.fn(),
      };

      // Get the bound mousedown handler
      const mouseDownHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'mousedown'
      )[1];

      mouseDownHandler(event);

      expect(handler).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should not handle mouse down on right button', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panstart', handler);

      const event = {
        button: 2, // Right button
        clientX: 100,
        clientY: 200,
        target: { closest: jest.fn().mockReturnValue(null) },
        preventDefault: jest.fn(),
      };

      // Get the bound mousedown handler
      const mouseDownHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'mousedown'
      )[1];

      mouseDownHandler(event);

      expect(handler).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should handle mouse move when panning', () => {
      const handler = jest.fn();
      interactionController.registerHandler('pan', handler);

      // Start panning first
      interactionController.startPan({ clientX: 100, clientY: 200 });

      const event = {
        clientX: 120,
        clientY: 230,
      };

      // Get the bound mousemove handler
      const mouseMoveHandler = global.document.addEventListener.mock.calls.find(
        (call) => call[0] === 'mousemove'
      )[1];

      mouseMoveHandler(event);

      expect(handler).toHaveBeenCalledWith({
        deltaX: 20,
        deltaY: 30,
        position: { x: 120, y: 230 },
      });
    });

    it('should handle mouse move when not panning', () => {
      const handler = jest.fn();
      interactionController.registerHandler('pan', handler);

      const event = {
        clientX: 120,
        clientY: 230,
      };

      // Get the bound mousemove handler
      const mouseMoveHandler = global.document.addEventListener.mock.calls.find(
        (call) => call[0] === 'mousemove'
      )[1];

      mouseMoveHandler(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle mouse up', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panend', handler);

      // Start panning first
      interactionController.startPan({ clientX: 100, clientY: 200 });

      // Get the bound mouseup handler
      const mouseUpHandler = global.document.addEventListener.mock.calls.find(
        (call) => call[0] === 'mouseup'
      )[1];

      mouseUpHandler();

      expect(handler).toHaveBeenCalledWith({});
    });

    it('should handle wheel event', () => {
      const handler = jest.fn();
      interactionController.registerHandler('zoom', handler);

      const event = {
        deltaY: 100,
        clientX: 400,
        clientY: 300,
        preventDefault: jest.fn(),
      };

      // Get the bound wheel handler
      const wheelHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'wheel'
      )[1];

      wheelHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith({
        zoomFactor: 1.1,
        x: 400,
        y: 300,
        deltaY: 100,
      });
    });

    it('should handle click when not panning', () => {
      const handler = jest.fn();
      interactionController.registerHandler('click', handler);

      const event = {
        target: { closest: jest.fn().mockReturnValue(null) },
      };

      // Get the bound click handler
      const clickHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )[1];

      clickHandler(event);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: { type: 'background', element: event.target },
      });
    });

    it('should not handle click when panning', () => {
      const handler = jest.fn();
      interactionController.registerHandler('click', handler);

      // Start panning to add 'pan' to active gestures
      interactionController.startPan({ clientX: 100, clientY: 200 });

      const event = {
        target: { closest: jest.fn().mockReturnValue(null) },
      };

      // Get the bound click handler
      const clickHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )[1];

      clickHandler(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle mouseover', () => {
      const handler = jest.fn();
      interactionController.registerHandler('hoverenter', handler);

      const event = {
        target: { closest: jest.fn().mockReturnValue(null) },
      };

      // Get the bound mouseover handler
      const mouseOverHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'mouseover'
      )[1];

      mouseOverHandler(event);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: { type: 'background', element: event.target },
      });
    });

    it('should handle mouseout', () => {
      const handler = jest.fn();
      interactionController.registerHandler('hoverleave', handler);

      const event = {
        target: { closest: jest.fn().mockReturnValue(null) },
      };

      // Get the bound mouseout handler
      const mouseOutHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'mouseout'
      )[1];

      mouseOutHandler(event);

      expect(handler).toHaveBeenCalledWith({
        event,
        target: { type: 'background', element: event.target },
      });
    });

    it('should handle touchstart', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panstart', handler);

      const event = {
        touches: [{ clientX: 100, clientY: 200 }],
        preventDefault: jest.fn(),
      };

      // Get the bound touchstart handler
      const touchStartHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'touchstart'
      )[1];

      touchStartHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith({
        position: { x: 100, y: 200 },
      });
    });

    it('should handle touchmove', () => {
      const handler = jest.fn();
      interactionController.registerHandler('pan', handler);

      // Start panning first
      interactionController.startPan({ clientX: 100, clientY: 200 });

      const event = {
        touches: [{ clientX: 120, clientY: 230 }],
        preventDefault: jest.fn(),
      };

      // Get the bound touchmove handler
      const touchMoveHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'touchmove'
      )[1];

      touchMoveHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith({
        deltaX: 20,
        deltaY: 30,
        position: { x: 120, y: 230 },
      });
    });

    it('should handle touchend', () => {
      const handler = jest.fn();
      interactionController.registerHandler('panend', handler);

      // Start panning first
      interactionController.startPan({ clientX: 100, clientY: 200 });

      const event = {
        touches: [{ clientX: 100, clientY: 200 }],
      };

      // Get the bound touchend handler
      const touchEndHandler = mockElement.addEventListener.mock.calls.find(
        (call) => call[0] === 'touchend'
      )[1];

      touchEndHandler(event);

      expect(handler).toHaveBeenCalledWith({});
    });
  });
});
