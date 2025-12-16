import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionOrchestrator } from '../../../src/anatomy/BodyDescriptionOrchestrator.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

describe('Anatomy Error Event Flow Integration', () => {
  let bodyDescriptionOrchestrator;
  let eventBus;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  let schemaValidator;
  let dataRegistry;
  let gameDataRepository;
  let logger;
  let mockBodyDescriptionComposer;
  let mockBodyGraphService;
  let mockEntityManager;
  let mockPartDescriptionGenerator;
  let eventListener;
  let capturedEvents;

  // Helper to create test entity
  const createTestEntity = (config = {}) => ({
    id: config.id || 'test-entity-1',
    hasComponent: jest.fn().mockImplementation((componentId) => {
      if (componentId === ANATOMY_BODY_COMPONENT_ID) {
        return config.hasAnatomyBody !== false;
      }
      return false;
    }),
    getComponentData: jest.fn().mockImplementation((componentId) => {
      if (componentId === ANATOMY_BODY_COMPONENT_ID) {
        return (
          config.anatomyBodyData || {
            body: { root: 'root-1' },
            recipeId: 'test-recipe',
          }
        );
      }
      if (componentId === 'core:name') {
        return config.nameData || { text: 'Test Character' };
      }
      return null;
    }),
  });

  beforeEach(() => {
    // Create real instances of the event system
    logger = new ConsoleLogger();
    logger.setLogLevel('error'); // Reduce noise in tests

    // Create schema validator
    schemaValidator = new AjvSchemaValidator({ logger });

    // Create data registry and repository
    dataRegistry = new InMemoryDataRegistry({ logger });
    gameDataRepository = new GameDataRepository(dataRegistry, logger);

    // Mock the event definition for system error
    jest
      .spyOn(gameDataRepository, 'getEventDefinition')
      .mockImplementation((id) => {
        if (id === SYSTEM_ERROR_OCCURRED_ID) {
          return {
            id: SYSTEM_ERROR_OCCURRED_ID,
            name: 'System Error Occurred',
            description: 'A system error has occurred',
            payloadSchema: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                details: { type: 'object' },
              },
              required: ['message'],
            },
          };
        }
        // Return null for any non-string ID (like objects)
        if (typeof id !== 'string') {
          return null;
        }
        return null;
      });

    // Create real event system chain
    eventBus = new EventBus({ logger });
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    // Create mocks for anatomy services
    mockBodyDescriptionComposer = {
      composeDescription: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn().mockReturnValue(['part-1', 'part-2']),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockPartDescriptionGenerator = {
      generateMultiplePartDescriptions: jest.fn().mockReturnValue(new Map()),
    };

    // Create the orchestrator with real event dispatcher
    bodyDescriptionOrchestrator = new BodyDescriptionOrchestrator({
      logger,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      bodyGraphService: mockBodyGraphService,
      eventDispatcher: safeEventDispatcher, // Using real dispatcher chain
      entityManager: mockEntityManager,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });

    // Set up event listener to capture events
    capturedEvents = [];
    eventListener = (event) => {
      capturedEvents.push(event);
    };
  });

  describe('Error event dispatch through full system', () => {
    it('should successfully dispatch error event when description is empty', async () => {
      // Subscribe to system error events
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      // Set up the scenario - empty description
      const entity = createTestEntity({ nameData: { text: 'John Doe' } });
      mockBodyDescriptionComposer.composeDescription.mockReturnValue('');

      // Generate body description (which should trigger error)
      const result =
        await bodyDescriptionOrchestrator.generateBodyDescription(entity);

      // Wait for async event dispatch
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify the description result
      expect(result).toBe('');

      // Verify event was captured
      expect(capturedEvents).toHaveLength(1);
      const capturedEvent = capturedEvents[0];

      // Verify event structure
      expect(capturedEvent).toEqual({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: {
          message:
            'Failed to generate body description for entity "John Doe": Description is empty',
          details: {
            raw: 'Entity ID: test-entity-1, Recipe ID: test-recipe',
            timestamp: expect.any(String),
          },
        },
      });
    });

    it('should handle whitespace-only descriptions', async () => {
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entity = createTestEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(
        '   \n\t  '
      );

      bodyDescriptionOrchestrator.generateBodyDescription(entity);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].payload.message).toContain(
        'Description is empty'
      );
    });

    it('should handle null descriptions', async () => {
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entity = createTestEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(null);

      bodyDescriptionOrchestrator.generateBodyDescription(entity);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].payload.message).toContain(
        'Description is empty'
      );
    });

    it('should not dispatch error for valid descriptions', async () => {
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entity = createTestEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(
        'A valid description'
      );

      bodyDescriptionOrchestrator.generateBodyDescription(entity);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(capturedEvents).toHaveLength(0);
    });

    it('should validate event payload structure', async () => {
      // Load a real schema for validation
      const eventSchema = {
        $id: `${SYSTEM_ERROR_OCCURRED_ID}#payload`,
        type: 'object',
        properties: {
          message: { type: 'string' },
          details: {
            type: 'object',
            properties: {
              raw: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
        required: ['message'],
        additionalProperties: false,
      };

      schemaValidator.addSchema(eventSchema, eventSchema.$id);

      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entity = createTestEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue('');

      bodyDescriptionOrchestrator.generateBodyDescription(entity);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Event should pass validation and be dispatched
      expect(capturedEvents).toHaveLength(1);
    });

    it('should handle multiple error events in sequence', async () => {
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entities = [
        createTestEntity({ id: 'entity-1', nameData: { text: 'Character 1' } }),
        createTestEntity({ id: 'entity-2', nameData: { text: 'Character 2' } }),
        createTestEntity({ id: 'entity-3', nameData: { text: 'Character 3' } }),
      ];

      // All return empty descriptions
      mockBodyDescriptionComposer.composeDescription.mockReturnValue('');

      // Generate descriptions for all entities
      for (const entity of entities) {
        await bodyDescriptionOrchestrator.generateBodyDescription(entity);
      }

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Should have 3 error events
      expect(capturedEvents).toHaveLength(3);

      // Verify each event has correct entity info
      expect(capturedEvents[0].payload.message).toContain('Character 1');
      expect(capturedEvents[1].payload.message).toContain('Character 2');
      expect(capturedEvents[2].payload.message).toContain('Character 3');
    });

    it('should maintain event integrity through dispatcher chain', async () => {
      // Spy on each layer
      const eventBusSpy = jest.spyOn(eventBus, 'dispatch');
      const validatedSpy = jest.spyOn(validatedEventDispatcher, 'dispatch');
      const safeSpy = jest.spyOn(safeEventDispatcher, 'dispatch');

      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entity = createTestEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue('');

      bodyDescriptionOrchestrator.generateBodyDescription(entity);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify each layer was called with correct parameters
      expect(safeSpy).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({ message: expect.any(String) })
      );

      expect(validatedSpy).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({ message: expect.any(String) }),
        {} // Default options
      );

      expect(eventBusSpy).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({ message: expect.any(String) })
      );

      // Ensure the first parameter is always a string
      expect(typeof safeSpy.mock.calls[0][0]).toBe('string');
      expect(typeof validatedSpy.mock.calls[0][0]).toBe('string');
      expect(typeof eventBusSpy.mock.calls[0][0]).toBe('string');
    });
  });

  describe('Error scenarios that should be caught', () => {
    it('should detect if event object is passed as first parameter', async () => {
      // SafeEventDispatcher now has fail-fast validation that throws an error
      // when an object is passed as the first parameter instead of a string eventName
      const errorSpy = jest.spyOn(logger, 'error');

      // Test that passing object directly to SafeEventDispatcher throws
      const eventObject = { type: SYSTEM_ERROR_OCCURRED_ID, payload: {} };

      await expect(async () => {
        await safeEventDispatcher.dispatch(eventObject);
      }).rejects.toThrow(
        /SafeEventDispatcher.dispatch\(\) requires \(eventName, payload\) signature/
      );

      // Should log error about incorrect usage
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'SafeEventDispatcher.dispatch() requires (eventName, payload) signature'
        ),
        expect.any(Object)
      );
    });

    it('should handle schema validation failures gracefully', async () => {
      // Set up strict schema that will reject extra properties
      const strictSchema = {
        $id: `${SYSTEM_ERROR_OCCURRED_ID}#payload`,
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
        additionalProperties: false, // This will reject 'details' property
      };

      schemaValidator.addSchema(strictSchema, strictSchema.$id);

      const errorSpy = jest.spyOn(logger, 'error');
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entity = createTestEntity();
      mockBodyDescriptionComposer.composeDescription.mockReturnValue('');

      bodyDescriptionOrchestrator.generateBodyDescription(entity);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Event should be rejected due to schema validation
      expect(capturedEvents).toHaveLength(0);

      // Should see validation error
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.any(Object)
      );
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle rapid sequential error dispatches', async () => {
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);
      mockBodyDescriptionComposer.composeDescription.mockReturnValue('');

      // Generate 10 errors rapidly
      const entities = Array.from({ length: 10 }, (_, i) =>
        createTestEntity({
          id: `entity-${i}`,
          nameData: { text: `Character ${i}` },
        })
      );

      const startTime = Date.now();

      // Dispatch all at once
      await Promise.all(
        entities.map((entity) =>
          bodyDescriptionOrchestrator.generateBodyDescription(entity)
        )
      );
      const endTime = Date.now();

      // Wait a bit more for async events to settle
      await new Promise((resolve) => setTimeout(resolve, 10));

      // All events should be captured
      expect(capturedEvents).toHaveLength(10);

      // Should complete reasonably quickly (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Each event should have unique entity info
      capturedEvents.forEach((event, index) => {
        expect(event.payload.message).toContain(`Character ${index}`);
        expect(event.payload.details.raw).toContain(`entity-${index}`);
      });
    });

    it('should handle concurrent error and success cases', async () => {
      eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, eventListener);

      const entities = [
        createTestEntity({ id: 'fail-1', nameData: { text: 'Fail 1' } }),
        createTestEntity({ id: 'success-1', nameData: { text: 'Success 1' } }),
        createTestEntity({ id: 'fail-2', nameData: { text: 'Fail 2' } }),
        createTestEntity({ id: 'success-2', nameData: { text: 'Success 2' } }),
      ];

      // Alternate between failures and successes
      mockBodyDescriptionComposer.composeDescription
        .mockReturnValueOnce('') // fail-1
        .mockReturnValueOnce('Valid description') // success-1
        .mockReturnValueOnce('   ') // fail-2
        .mockReturnValueOnce('Another valid description'); // success-2

      const results = await Promise.all(
        entities.map(
          async (entity) =>
            await bodyDescriptionOrchestrator.generateBodyDescription(entity)
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have 2 error events (for fail-1 and fail-2)
      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents[0].payload.message).toContain('Fail 1');
      expect(capturedEvents[1].payload.message).toContain('Fail 2');

      // Verify return values
      expect(results[0]).toBe(''); // fail-1
      expect(results[1]).toBe('Valid description'); // success-1
      expect(results[2]).toBe('   '); // fail-2
      expect(results[3]).toBe('Another valid description'); // success-2
    });
  });
});
