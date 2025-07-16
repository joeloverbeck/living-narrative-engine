import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import InteractionController from '../../../src/domUI/anatomy-renderer/InteractionController.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Anatomy Visualizer Panning Integration', () => {
  let interactionController;
  let eventBus;
  let validatedEventDispatcher;
  let schemaValidator;
  let dataRegistry;
  let gameDataRepository;
  let logger;
  let mockElement;
  let capturedEvents;
  let eventListener;
  let mockDocumentAddEventListener;
  let mockDocumentRemoveEventListener;

  // Mock DOM element for testing
  const createMockElement = () => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getBoundingClientRect: jest.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    }),
    closest: jest.fn().mockReturnValue(null), // No anatomy nodes clicked
  });

  // Mock mouse event
  const createMockMouseEvent = (clientX, clientY, button = 0) => ({
    clientX,
    clientY,
    button,
    target: mockElement,
    preventDefault: jest.fn(),
  });

  beforeEach(() => {
    // Mock document.addEventListener and removeEventListener for InteractionController
    mockDocumentAddEventListener = jest.fn();
    mockDocumentRemoveEventListener = jest.fn();
    
    // Mock document methods on the actual document object
    document.addEventListener = mockDocumentAddEventListener;
    document.removeEventListener = mockDocumentRemoveEventListener;

    // Create real instances of the event system
    logger = new ConsoleLogger();
    logger.setLogLevel('error'); // Reduce noise in tests

    // Create schema validator
    schemaValidator = new AjvSchemaValidator({ logger });

    // Create data registry and repository
    dataRegistry = new InMemoryDataRegistry({ logger });
    gameDataRepository = new GameDataRepository(dataRegistry, logger);

    // Load the actual event definitions for panning
    const panstartEventDef = {
      id: 'anatomy:interaction_panstart',
      description: 'Fired when a pan gesture starts on the anatomy visualization',
      payloadSchema: {
        type: 'object',
        required: ['position'],
        properties: {
          position: {
            type: 'object',
            required: ['x', 'y'],
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    };

    const panEventDef = {
      id: 'anatomy:interaction_pan',
      description: 'Fired during a pan gesture on the anatomy visualization',
      payloadSchema: {
        type: 'object',
        required: ['deltaX', 'deltaY', 'position'],
        properties: {
          deltaX: { type: 'number' },
          deltaY: { type: 'number' },
          position: {
            type: 'object',
            required: ['x', 'y'],
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    };

    const panendEventDef = {
      id: 'anatomy:interaction_panend',
      description: 'Fired when a pan gesture ends on the anatomy visualization',
      payloadSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    };

    // Mock the event definition retrieval
    jest
      .spyOn(gameDataRepository, 'getEventDefinition')
      .mockImplementation((id) => {
        switch (id) {
          case 'anatomy:interaction_panstart':
            return panstartEventDef;
          case 'anatomy:interaction_pan':
            return panEventDef;
          case 'anatomy:interaction_panend':
            return panendEventDef;
          default:
            return null;
        }
      });

    // Create real event system chain
    eventBus = new EventBus({ logger });
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });

    // Create interaction controller
    interactionController = new InteractionController({
      logger,
      eventBus: validatedEventDispatcher,
    });

    // Create mock DOM element
    mockElement = createMockElement();

    // Set up event listener to capture events
    capturedEvents = [];
    eventListener = (event) => {
      capturedEvents.push(event);
    };

    // Subscribe to all pan events
    eventBus.subscribe('anatomy:interaction_panstart', eventListener);
    eventBus.subscribe('anatomy:interaction_pan', eventListener);
    eventBus.subscribe('anatomy:interaction_panend', eventListener);
  });

  describe('Pan gesture event dispatch', () => {
    beforeEach(() => {
      interactionController.attachToElement(mockElement);
      
      // Register dummy handlers to ensure event dispatch happens
      interactionController.registerHandler('panstart', () => {});
      interactionController.registerHandler('pan', () => {});
      interactionController.registerHandler('panend', () => {});
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should dispatch panstart event with correct payload', async () => {
      const mouseEvent = createMockMouseEvent(100, 200);

      // Debug: Log what's being dispatched
      const dispatchSpy = jest.spyOn(validatedEventDispatcher, 'dispatch');

      interactionController.startPan(mouseEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      console.log('Dispatch spy calls:', dispatchSpy.mock.calls);
      console.log('Captured events:', capturedEvents);

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      expect(event.type).toBe('anatomy:interaction_panstart');
      expect(event.payload).toEqual({
        position: { x: 100, y: 200 },
      });
    });

    it('should dispatch pan event with correct payload', async () => {
      // Start panning
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      // Clear captured events to focus on pan event
      capturedEvents.length = 0;

      // Update pan position
      const moveEvent = createMockMouseEvent(120, 230);
      interactionController.updatePan(moveEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      expect(event.type).toBe('anatomy:interaction_pan');
      expect(event.payload).toEqual({
        deltaX: 20,
        deltaY: 30,
        position: { x: 120, y: 230 },
      });
    });

    it('should dispatch panend event with correct payload', async () => {
      // Start panning
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      // Clear captured events to focus on panend event
      capturedEvents.length = 0;

      // End panning
      interactionController.endPan();

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      expect(event.type).toBe('anatomy:interaction_panend');
      expect(event.payload).toEqual({});
    });

    it('should handle complete pan workflow', async () => {
      // Start pan
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      // Move during pan
      const moveEvent1 = createMockMouseEvent(120, 230);
      interactionController.updatePan(moveEvent1);

      const moveEvent2 = createMockMouseEvent(140, 250);
      interactionController.updatePan(moveEvent2);

      // End pan
      interactionController.endPan();

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(capturedEvents).toHaveLength(4);

      // Verify event sequence
      expect(capturedEvents[0].type).toBe('anatomy:interaction_panstart');
      expect(capturedEvents[1].type).toBe('anatomy:interaction_pan');
      expect(capturedEvents[2].type).toBe('anatomy:interaction_pan');
      expect(capturedEvents[3].type).toBe('anatomy:interaction_panend');

      // Verify pan deltas are calculated correctly
      expect(capturedEvents[1].payload.deltaX).toBe(20);
      expect(capturedEvents[1].payload.deltaY).toBe(30);
      expect(capturedEvents[2].payload.deltaX).toBe(20);
      expect(capturedEvents[2].payload.deltaY).toBe(20);
    });

    it('should not dispatch pan events when not panning', async () => {
      // Try to update pan without starting
      const moveEvent = createMockMouseEvent(120, 230);
      interactionController.updatePan(moveEvent);

      // Wait a bit to ensure no events are dispatched
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(0);
    });

    it('should not dispatch panend event when not panning', async () => {
      // Try to end pan without starting
      interactionController.endPan();

      // Wait a bit to ensure no events are dispatched
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(0);
    });
  });

  describe('Event validation', () => {
    beforeEach(() => {
      interactionController.attachToElement(mockElement);
      
      // Register dummy handlers to ensure event dispatch happens
      interactionController.registerHandler('panstart', () => {});
      interactionController.registerHandler('pan', () => {});
      interactionController.registerHandler('panend', () => {});
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should validate panstart event payload against schema', async () => {
      const mouseEvent = createMockMouseEvent(100, 200);

      interactionController.startPan(mouseEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      // Event should pass validation and be dispatched
      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      // Payload should match schema exactly
      expect(event.payload).toEqual({
        position: { x: 100, y: 200 },
      });
    });

    it('should validate pan event payload against schema', async () => {
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      capturedEvents.length = 0;

      const moveEvent = createMockMouseEvent(120, 230);
      interactionController.updatePan(moveEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      // Event should pass validation and be dispatched
      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      // Payload should match schema exactly
      expect(event.payload).toEqual({
        deltaX: 20,
        deltaY: 30,
        position: { x: 120, y: 230 },
      });
    });

    it('should validate panend event payload against schema', async () => {
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      capturedEvents.length = 0;

      interactionController.endPan();

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      // Event should pass validation and be dispatched
      expect(capturedEvents).toHaveLength(1);
      const event = capturedEvents[0];

      // Payload should match schema exactly
      expect(event.payload).toEqual({});
    });
  });

  describe('Mouse event integration', () => {
    beforeEach(() => {
      interactionController.attachToElement(mockElement);
      
      // Register dummy handlers to ensure event dispatch happens
      interactionController.registerHandler('panstart', () => {});
      interactionController.registerHandler('pan', () => {});
      interactionController.registerHandler('panend', () => {});
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should handle mouse down event to start panning', async () => {
      const mouseDownEvent = createMockMouseEvent(100, 200, 0); // Left click
      
      // Get the bound handler that was added to the element
      const mouseDownHandler = mockElement.addEventListener.mock.calls
        .find(call => call[0] === 'mousedown')[1];

      mouseDownHandler(mouseDownEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('anatomy:interaction_panstart');
      expect(mouseDownEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle mouse move event during panning', async () => {
      // Start panning first
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      capturedEvents.length = 0;

      // Simulate mouse move
      const mouseMoveEvent = createMockMouseEvent(120, 230);
      
      // Get the bound handler that was added to document
      const mouseMoveHandler = mockDocumentAddEventListener.mock.calls
        .find(call => call[0] === 'mousemove')[1];

      mouseMoveHandler(mouseMoveEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('anatomy:interaction_pan');
    });

    it('should handle mouse up event to end panning', async () => {
      // Start panning first
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      capturedEvents.length = 0;

      // Simulate mouse up
      const mouseUpEvent = createMockMouseEvent(120, 230);
      
      // Get the bound handler that was added to document
      const mouseUpHandler = mockDocumentAddEventListener.mock.calls
        .find(call => call[0] === 'mouseup')[1];

      mouseUpHandler(mouseUpEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe('anatomy:interaction_panend');
    });

    it('should not start panning when clicking on anatomy nodes', async () => {
      // Mock clicking on an anatomy node
      const mockAnatomyNodeElement = { classList: { contains: jest.fn() } };
      const mockAnatomyNode = { 
        closest: jest.fn().mockReturnValue(mockAnatomyNodeElement) 
      };
      const mouseDownEvent = createMockMouseEvent(100, 200, 0);
      mouseDownEvent.target = mockAnatomyNode;

      const mouseDownHandler = mockElement.addEventListener.mock.calls
        .find(call => call[0] === 'mousedown')[1];

      mouseDownHandler(mouseDownEvent);

      // Wait a bit to ensure no events are dispatched
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(0);
      expect(mouseDownEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Gesture state management', () => {
    beforeEach(() => {
      interactionController.attachToElement(mockElement);
      
      // Register dummy handlers to ensure event dispatch happens
      interactionController.registerHandler('panstart', () => {});
      interactionController.registerHandler('pan', () => {});
      interactionController.registerHandler('panend', () => {});
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should track panning state correctly', async () => {
      let state = interactionController.getGestureState();
      expect(state.isPanning).toBe(false);
      expect(state.activeGestures).toEqual([]);

      // Start panning
      const startEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(startEvent);

      state = interactionController.getGestureState();
      expect(state.isPanning).toBe(true);
      expect(state.activeGestures).toEqual(['pan']);

      // End panning
      interactionController.endPan();

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      state = interactionController.getGestureState();
      expect(state.isPanning).toBe(false);
      expect(state.activeGestures).toEqual([]);
    });

    it('should handle multiple rapid pan operations', async () => {
      const positions = [
        { x: 100, y: 200 },
        { x: 120, y: 230 },
        { x: 140, y: 250 },
        { x: 160, y: 270 },
      ];

      // Start panning
      interactionController.startPan(createMockMouseEvent(positions[0].x, positions[0].y));

      // Rapid pan updates
      for (let i = 1; i < positions.length; i++) {
        interactionController.updatePan(createMockMouseEvent(positions[i].x, positions[i].y));
      }

      // End panning
      interactionController.endPan();

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should have 1 start + 3 updates + 1 end = 5 events
      expect(capturedEvents).toHaveLength(5);
      expect(capturedEvents[0].type).toBe('anatomy:interaction_panstart');
      expect(capturedEvents[1].type).toBe('anatomy:interaction_pan');
      expect(capturedEvents[2].type).toBe('anatomy:interaction_pan');
      expect(capturedEvents[3].type).toBe('anatomy:interaction_pan');
      expect(capturedEvents[4].type).toBe('anatomy:interaction_panend');
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      interactionController.attachToElement(mockElement);
      
      // Register dummy handlers to ensure event dispatch happens
      interactionController.registerHandler('panstart', () => {});
      interactionController.registerHandler('pan', () => {});
      interactionController.registerHandler('panend', () => {});
    });

    afterEach(() => {
      interactionController.detachFromElement();
    });

    it('should handle invalid event payloads gracefully', async () => {
      const errorSpy = jest.spyOn(logger, 'error');

      // Mock invalid event definition that would cause validation to fail
      jest.spyOn(gameDataRepository, 'getEventDefinition').mockImplementation((id) => {
        if (id === 'anatomy:interaction_panstart') {
          return {
            id: 'anatomy:interaction_panstart',
            payloadSchema: {
              type: 'object',
              required: ['invalidField'], // This will cause validation to fail
              properties: {
                invalidField: { type: 'string' },
              },
            },
          };
        }
        return null;
      });

      // Add the invalid schema to the validator
      const invalidSchema = {
        $id: 'anatomy:interaction_panstart#payload',
        type: 'object',
        required: ['invalidField'],
        properties: {
          invalidField: { type: 'string' },
        },
      };
      schemaValidator.addSchema(invalidSchema, invalidSchema.$id);

      const mouseEvent = createMockMouseEvent(100, 200);
      interactionController.startPan(mouseEvent);

      // Wait for async event dispatch
      await new Promise(resolve => setTimeout(resolve, 10));

      // Event should be rejected due to validation failure
      expect(capturedEvents).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.any(Object)
      );
    });
  });
});