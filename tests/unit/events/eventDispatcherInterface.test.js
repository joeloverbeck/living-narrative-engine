import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';

describe('Event Dispatcher Interface Verification', () => {
  let mockLogger;
  let mockSchemaValidator;
  let mockGameDataRepository;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockSchemaValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };

    mockGameDataRepository = {
      getEventDefinition: jest.fn().mockImplementation((id) => {
        if (typeof id === 'string') {
          return {
            id: 'core:test_event',
            payloadSchema: { type: 'object' },
          };
        }
        return null;
      }),
    };
  });

  describe('Parameter passing through dispatcher chain', () => {
    it('should pass parameters correctly from SafeEventDispatcher to ValidatedEventDispatcher', async () => {
      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus: new EventBus({ logger: mockLogger }),
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      const dispatchSpy = jest.spyOn(validatedDispatcher, 'dispatch');

      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: validatedDispatcher,
        logger: mockLogger,
      });

      const eventName = 'core:test_event';
      const payload = { message: 'Test message', value: 42 };
      const options = { allowSchemaNotFound: true };

      await safeDispatcher.dispatch(eventName, payload, options);

      // Verify ValidatedEventDispatcher received correct parameters
      expect(dispatchSpy).toHaveBeenCalledWith(eventName, payload, options);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Verify parameter types
      const [receivedEventName, receivedPayload, receivedOptions] =
        dispatchSpy.mock.calls[0];
      expect(typeof receivedEventName).toBe('string');
      expect(typeof receivedPayload).toBe('object');
      expect(typeof receivedOptions).toBe('object');
    });

    it('should pass parameters correctly from ValidatedEventDispatcher to EventBus', async () => {
      const eventBus = new EventBus({ logger: mockLogger });
      const dispatchSpy = jest.spyOn(eventBus, 'dispatch');

      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      const eventName = 'core:test_event';
      const payload = { message: 'Test message' };

      await validatedDispatcher.dispatch(eventName, payload);

      // Verify EventBus received correct parameters
      expect(dispatchSpy).toHaveBeenCalledWith(eventName, payload);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);

      // Verify parameter types and order
      const [receivedEventName, receivedPayload] = dispatchSpy.mock.calls[0];
      expect(typeof receivedEventName).toBe('string');
      expect(receivedEventName).toBe(eventName);
      expect(typeof receivedPayload).toBe('object');
      expect(receivedPayload).toEqual(payload);
    });

    it('should handle event objects incorrectly passed as event names', async () => {
      const eventBus = new EventBus({ logger: mockLogger });
      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: validatedDispatcher,
        logger: mockLogger,
      });

      // Simulate incorrect usage - passing event object as first parameter
      const eventObject = {
        type: 'core:test_event',
        payload: { message: 'Test' },
      };

      // With fail-fast validation, SafeEventDispatcher now throws immediately
      // when an object with type/payload properties is passed as first argument
      await expect(safeDispatcher.dispatch(eventObject, {})).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires (eventName, payload) signature'
      );

      // Verify the error was logged before throwing
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Received object with "type" and "payload"'),
        expect.objectContaining({ receivedObject: eventObject })
      );
    });

    it('should reject non-string event names at EventBus level', async () => {
      const testLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const eventBus = new EventBus({ logger: testLogger });
      let listenerCalled = false;

      // Subscribe a listener that should NOT be called
      eventBus.subscribe('core:test_event', () => {
        listenerCalled = true;
      });

      // Try to dispatch with an object as event name
      const eventObject = { type: 'core:test_event', payload: {} };
      await eventBus.dispatch(eventObject, {});

      // Verify the listener was NOT called due to invalid event name
      expect(listenerCalled).toBe(false);

      // The error should have been logged
      expect(testLogger.error).toHaveBeenCalledTimes(1);
      expect(testLogger.error.mock.calls[0][0]).toContain('Invalid event name');
    });

    it('should maintain parameter integrity through full dispatcher chain', async () => {
      const eventBus = new EventBus({ logger: mockLogger });
      const eventBusSpy = jest.spyOn(eventBus, 'dispatch');

      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });
      const validatedSpy = jest.spyOn(validatedDispatcher, 'dispatch');

      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: validatedDispatcher,
        logger: mockLogger,
      });
      const safeSpy = jest.spyOn(safeDispatcher, 'dispatch');

      const eventName = 'core:system_error_occurred';
      const payload = {
        message: 'Failed to generate body description',
        details: { raw: 'Entity ID: 123', timestamp: '2024-01-01' },
      };

      await safeDispatcher.dispatch(eventName, payload);

      // Verify each layer received and passed correct parameters
      expect(safeSpy).toHaveBeenCalledWith(eventName, payload);
      expect(validatedSpy).toHaveBeenCalledWith(eventName, payload, {});
      expect(eventBusSpy).toHaveBeenCalledWith(eventName, payload);

      // Verify no parameter transformation occurred
      const safeCall = safeSpy.mock.calls[0];
      const validatedCall = validatedSpy.mock.calls[0];
      const eventBusCall = eventBusSpy.mock.calls[0];

      expect(safeCall[0]).toBe(eventName);
      expect(validatedCall[0]).toBe(eventName);
      expect(eventBusCall[0]).toBe(eventName);

      expect(safeCall[1]).toEqual(payload);
      expect(validatedCall[1]).toEqual(payload);
      expect(eventBusCall[1]).toEqual(payload);
    });
  });

  describe('Error handling for incorrect dispatch signatures', () => {
    it('should handle when dispatch is called with wrong parameter order', async () => {
      const eventBus = new EventBus({ logger: mockLogger });
      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      // Mock incorrect parameter order (payload first, then event name)
      const payload = { message: 'Test' };
      const eventName = 'core:test_event';

      // This simulates calling dispatch(payload, eventName) instead of dispatch(eventName, payload)
      await validatedDispatcher.dispatch(payload, eventName);

      // GameDataRepository should receive the payload object as ID
      expect(mockGameDataRepository.getEventDefinition).toHaveBeenCalledWith(
        payload
      );
      // The mock should return null for non-string IDs, triggering a warning
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('should detect when event object is passed instead of event ID string', async () => {
      const eventBus = new EventBus({ logger: mockLogger });
      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: validatedDispatcher,
        logger: mockLogger,
      });

      // This simulates code that incorrectly passes an event object
      const eventObject = {
        type: 'core:system_error_occurred',
        payload: { message: 'Error occurred' },
      };

      // With fail-fast validation, SafeEventDispatcher now throws immediately
      // when an object with type/payload properties is passed as first argument
      await expect(safeDispatcher.dispatch(eventObject)).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires (eventName, payload) signature'
      );

      // Verify the error was logged before throwing
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Received object with "type" and "payload"'),
        expect.objectContaining({ receivedObject: eventObject })
      );

      // The underlying dispatcher should NOT have been called due to fail-fast
      expect(mockGameDataRepository.getEventDefinition).not.toHaveBeenCalled();
    });

    it('should verify SafeEventDispatcher executeSafely preserves parameters', async () => {
      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus: new EventBus({ logger: mockLogger }),
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });

      let capturedParams = null;
      validatedDispatcher.dispatch = jest.fn().mockImplementation((...args) => {
        capturedParams = args;
        return Promise.resolve(true);
      });

      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: validatedDispatcher,
        logger: mockLogger,
      });

      const eventName = 'core:test_event';
      const payload = { test: true };
      const options = { validate: false };

      await safeDispatcher.dispatch(eventName, payload, options);

      // Verify parameters were preserved through executeSafely
      expect(capturedParams).toEqual([eventName, payload, options]);
      expect(capturedParams[0]).toBe(eventName);
      expect(capturedParams[1]).toBe(payload);
      expect(capturedParams[2]).toBe(options);
    });
  });

  describe('EventBus parameter validation', () => {
    it('should validate event name is a string before processing', async () => {
      const testLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const eventBus = new EventBus({ logger: testLogger });
      const listeners = [];

      // Subscribe a listener
      eventBus.subscribe('core:test_event', (event) => {
        listeners.push(event);
      });

      // Test with valid string event name
      await eventBus.dispatch('core:test_event', { data: 'valid' });
      expect(listeners).toHaveLength(1);
      expect(listeners[0]).toEqual({
        type: 'core:test_event',
        payload: { data: 'valid' },
      });

      // Test with invalid non-string event name
      listeners.length = 0;
      const invalidEventName = { type: 'core:test_event' };
      await eventBus.dispatch(invalidEventName, { data: 'invalid' });

      // Should not reach listener
      expect(listeners).toHaveLength(0);

      // Error should have been logged
      expect(testLogger.error).toHaveBeenCalled();
      const errorCall = testLogger.error.mock.calls.find((call) =>
        call[0].includes('Invalid event name')
      );
      expect(errorCall).toBeDefined();
    });

    it('should construct correct event object for listeners', async () => {
      const eventBus = new EventBus({ logger: mockLogger });
      let receivedEvent = null;

      eventBus.subscribe('core:system_error_occurred', (event) => {
        receivedEvent = event;
      });

      const eventName = 'core:system_error_occurred';
      const payload = {
        message: 'Test error',
        details: { timestamp: '2024-01-01' },
      };

      await eventBus.dispatch(eventName, payload);

      // Verify listener received correctly formatted event
      expect(receivedEvent).toEqual({
        type: eventName,
        payload: payload,
      });
      expect(receivedEvent.type).toBe(eventName);
      expect(receivedEvent.payload).toBe(payload); // Same reference
    });
  });

  describe('Integration with actual error scenario', () => {
    it('should simulate the exact error from BodyDescriptionOrchestrator', async () => {
      const eventBus = new EventBus({ logger: mockLogger });
      const validatedDispatcher = new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository: mockGameDataRepository,
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });
      const safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: validatedDispatcher,
        logger: mockLogger,
      });

      // Mock the event definition lookup for system error
      mockGameDataRepository.getEventDefinition.mockImplementation((id) => {
        if (id === 'core:system_error_occurred') {
          return { id, payloadSchema: { type: 'object' } };
        }
        return null;
      });

      // Track what reaches the event bus
      const eventBusSpy = jest.spyOn(eventBus, 'dispatch');

      // Simulate the exact call from BodyDescriptionOrchestrator
      const SYSTEM_ERROR_OCCURRED_ID = 'core:system_error_occurred';
      await safeDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message:
          'Failed to generate body description for entity "Iker Aguirre": Description is empty',
        details: {
          raw: 'Entity ID: 123, Recipe ID: human-male',
          timestamp: new Date().toISOString(),
        },
      });

      // Verify correct parameters reached EventBus
      expect(eventBusSpy).toHaveBeenCalledTimes(1);
      const [eventName, eventPayload] = eventBusSpy.mock.calls[0];
      expect(typeof eventName).toBe('string');
      expect(eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
      expect(typeof eventPayload).toBe('object');
      expect(eventPayload).toHaveProperty('message');
      expect(eventPayload).toHaveProperty('details');

      // Ensure no errors were logged about invalid event names
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid event name provided')
      );
    });
  });
});
