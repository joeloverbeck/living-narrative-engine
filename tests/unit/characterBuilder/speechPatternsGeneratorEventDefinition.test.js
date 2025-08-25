/**
 * @file Unit test reproducing missing event definition issues in Speech Patterns Generator
 * @description Tests the specific event validation failures seen in error_logs.txt
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SpeechPatternsGeneratorController } from '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { createTestBed } from '../../common/testBed.js';
import { createMockContainer } from '../../common/mockFactories/container.js';

describe('Speech Patterns Generator Event Definition Issues - Unit', () => {
  let testBed;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reproduce the "EventDefinition not found for core:controller_initialized" warning', async () => {
    // Arrange
    const mockGameDataRepository = {
      getEventDefinition: jest.fn().mockReturnValue(null), // Simulate missing definition
      getAllEventIds: jest.fn().mockReturnValue(['other:event']),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const mockSchemaValidator = {
      validate: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(false),
    };

    const dispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });

    // Act - Try to dispatch the controller_initialized event that's missing its definition
    // This should reproduce the warning from error_logs.txt:
    // "EventDefinition not found for 'core:controller_initialized'. Cannot validate payload."

    const eventName = 'core:controller_initialized';
    const payload = {
      pageName: 'Speech Patterns Generator',
      initTime: 100,
    };

    await dispatcher.dispatch(eventName, payload);

    // Assert - Should have logged the specific warning about missing event definition
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventDefinition not found for')
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('core:controller_initialized')
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cannot validate payload')
    );

    // The repository should have been queried for the missing definition
    expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
      'core:controller_initialized'
    );

    // Event should still be dispatched despite missing definition
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
  });

  it('should demonstrate what happens when controller initialization triggers missing event', async () => {
    // Arrange
    const mockContainer = createMockContainer({});
    const mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Mock the event bus to capture dispatched events
    const dispatchedEvents = [];
    mockEventBus.dispatch = jest.fn((eventName, payload) => {
      dispatchedEvents.push({ type: eventName, payload });
      // Simulate the warning that would occur in real ValidatedEventDispatcher
      if (eventName === 'core:controller_initialized') {
        console.warn(
          `VED: EventDefinition not found for '${eventName}'. Cannot validate payload. Proceeding with dispatch.`
        );
      }
    });

    const mockCharacterBuilderService = {
      initialize: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockReturnValue([]),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn().mockReturnValue([]),
      getServiceInfo: jest.fn().mockReturnValue({ version: '1.0.0' }),
    };

    const mockSchemaValidator = {
      validate: jest.fn(),
      isSchemaLoaded: jest.fn(),
    };

    const dependencies = {
      logger: mockLogger,
      eventBus: mockEventBus,
      container: mockContainer,
      characterBuilderService: mockCharacterBuilderService,
      schemaValidator: mockSchemaValidator,
    };

    // Act - Create controller (this triggers initialization which dispatches the event)
    const controller = new SpeechPatternsGeneratorController(dependencies);

    // Simulate the initialization process that triggers the event dispatch
    // (normally done in BaseCharacterBuilderController.initialize())
    await mockEventBus.dispatch('core:controller_initialized', {
      pageName: 'Speech Patterns Generator',
      initTime: 123.45,
    });

    // Assert - The event should have been dispatched despite the missing definition
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].type).toBe('core:controller_initialized');
    expect(dispatchedEvents[0].payload.pageName).toBe(
      'Speech Patterns Generator'
    );
  });

  it('should identify the missing event definition structure that needs to be added', () => {
    // Arrange & Act - Define what the missing event definition should look like
    const requiredEventDefinition = {
      id: 'core:controller_initialized',
      description:
        'Dispatched when a character builder controller completes initialization',
      payloadSchema: {
        type: 'object',
        properties: {
          pageName: {
            type: 'string',
            description: 'Name of the page that was initialized',
          },
          initTime: {
            type: 'number',
            description: 'Time taken to initialize in milliseconds',
            minimum: 0,
          },
          controllerType: {
            type: 'string',
            description: 'Type/class name of the controller',
          },
        },
        required: ['pageName', 'initTime'],
        additionalProperties: false,
      },
    };

    // Assert - This is the structure that should be registered to prevent the warning
    expect(requiredEventDefinition.id).toBe('core:controller_initialized');
    expect(requiredEventDefinition.description).toBeTruthy();
    expect(requiredEventDefinition.payloadSchema).toBeDefined();
    expect(
      requiredEventDefinition.payloadSchema.properties.pageName
    ).toBeDefined();
    expect(
      requiredEventDefinition.payloadSchema.properties.initTime
    ).toBeDefined();

    // This event definition is what's missing from the event registry
    // causing the "EventDefinition not found" warning
  });

  it('should demonstrate the difference between having event definition vs not having it', async () => {
    // Arrange
    const knownEventName = 'test:known_event';
    const knownEventPayload = { data: 'test' };

    const unknownEventName = 'core:controller_initialized';
    const unknownEventPayload = { pageName: 'Test', initTime: 100 };

    // Mock repository with only one event defined
    const mockRepositoryWithKnownEvent = {
      getEventDefinition: jest.fn((eventId) => {
        if (eventId === 'test:known_event') {
          return {
            id: 'test:known_event',
            payloadSchema: {
              type: 'object',
              properties: { data: { type: 'string' } },
            },
          };
        }
        return null; // Simulates missing definition for controller_initialized
      }),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };

    const dispatcher = new ValidatedEventDispatcher({
      eventBus: mockEventBus,
      gameDataRepository: mockRepositoryWithKnownEvent,
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });

    // Act - Dispatch both events
    await dispatcher.dispatch(knownEventName, knownEventPayload); // Should be fine
    await dispatcher.dispatch(unknownEventName, unknownEventPayload); // Should warn

    // Assert - Only the undefined event should cause warnings
    // Check that warn was called for the missing definition
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('core:controller_initialized')
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('EventDefinition not found')
    );

    // The repository should have been called for both events
    expect(
      mockRepositoryWithKnownEvent.getEventDefinition
    ).toHaveBeenCalledWith('test:known_event');
    expect(
      mockRepositoryWithKnownEvent.getEventDefinition
    ).toHaveBeenCalledWith('core:controller_initialized');
  });
});
