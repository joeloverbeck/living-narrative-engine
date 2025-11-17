/**
 * @file Unit test reproducing missing event definition issues in Speech Patterns Generator
 * @description Tests the specific event validation failures seen in error_logs.txt
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SpeechPatternsGeneratorController } from '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { createTestBed } from '../../common/testBed.js';
import { createMockControllerDependencies } from '../../common/characterBuilder/speechPatternsTestHelpers.js';

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
      controllerName: 'SpeechPatternsGeneratorController',
      initializationTime: 100,
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
    const dependencies = createMockControllerDependencies();
    const dispatchedEvents = [];
    dependencies.eventBus.dispatch.mockImplementation((eventName, payload) => {
      dispatchedEvents.push({ type: eventName, payload });
      // Simulate the warning that would occur in real ValidatedEventDispatcher
      if (eventName === 'core:controller_initialized') {
        console.warn(
          `VED: EventDefinition not found for '${eventName}'. Cannot validate payload. Proceeding with dispatch.`
        );
      }
    });

    dependencies.controllerLifecycleOrchestrator.initialize.mockImplementation(
      async () => {
        dependencies.eventBus.dispatch('core:controller_initialized', {
          controllerName: 'SpeechPatternsGeneratorController',
          initializationTime: 123.45,
        });
      }
    );

    const controller = new SpeechPatternsGeneratorController(dependencies);

    await controller.initialize();

    // Assert - The event should have been dispatched despite the missing definition
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].type).toBe('core:controller_initialized');
    expect(dispatchedEvents[0].payload.controllerName).toBe(
      'SpeechPatternsGeneratorController'
    );
    expect(dispatchedEvents[0].payload.initializationTime).toBeCloseTo(123.45);
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
          controllerName: {
            type: 'string',
            description: 'Name of the controller that finished initialization',
            minLength: 1,
          },
          initializationTime: {
            type: 'number',
            description: 'Time taken to initialize in milliseconds',
            minimum: 0,
          },
        },
        required: ['controllerName', 'initializationTime'],
        additionalProperties: false,
      },
    };

    // Assert - This is the structure that should be registered to prevent the warning
    expect(requiredEventDefinition.id).toBe('core:controller_initialized');
    expect(requiredEventDefinition.description).toBeTruthy();
    expect(requiredEventDefinition.payloadSchema).toBeDefined();
    expect(
      requiredEventDefinition.payloadSchema.properties.controllerName
    ).toBeDefined();
    expect(
      requiredEventDefinition.payloadSchema.properties.initializationTime
    ).toBeDefined();

    // This event definition is what's missing from the event registry
    // causing the "EventDefinition not found" warning
  });

  it('should demonstrate the difference between having event definition vs not having it', async () => {
    // Arrange
    const knownEventName = 'test:known_event';
    const knownEventPayload = { data: 'test' };

    const unknownEventName = 'core:controller_initialized';
    const unknownEventPayload = {
      controllerName: 'SpeechPatternsGeneratorController',
      initializationTime: 100,
    };

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
