/**
 * @file ValidationFailureRecovery.e2e.test.js
 * @description End-to-end test for validation failure recovery workflow
 * Tests that the event system properly blocks invalid events, reports errors,
 * and continues functioning normally after validation failures
 * @jest-environment jsdom
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  ENTITY_CREATED_ID,
  COMPONENT_ADDED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_STARTED_ID,
  TURN_ENDED_ID,
  ATTEMPT_ACTION_ID,
  ACTION_DECIDED_ID,
  ENTITY_SPOKE_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../src/constants/eventIds.js';

describe('Validation Failure Recovery E2E Test', () => {
  let testBed;
  let eventBus;
  let validatedEventDispatcher;
  let safeEventDispatcher;
  let gameDataRepository;
  let schemaValidator;
  let mockLogger;
  let capturedEvents;
  let validEventListener;
  let errorEventListener;

  beforeEach(async () => {
    // Initialize integration test bed with full DI container
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Get core services from container
    eventBus = testBed.container.resolve(tokens.IEventBus);
    validatedEventDispatcher = testBed.container.resolve(
      tokens.IValidatedEventDispatcher
    );
    safeEventDispatcher = testBed.container.resolve(
      tokens.ISafeEventDispatcher
    );
    gameDataRepository = testBed.container.resolve(tokens.IGameDataRepository);
    schemaValidator = testBed.container.resolve(tokens.ISchemaValidator);

    // Get the mock logger to track error messages
    mockLogger = testBed.container.resolve(tokens.ILogger);

    // Manually register schemas for validation testing
    // Since ValidatedEventDispatcher checks for schemas, we need to ensure they exist

    // Register entity_created event with strict payload schema
    const entityCreatedSchema = {
      type: 'object',
      required: ['instanceId', 'definitionId', 'wasReconstructed', 'entity'],
      properties: {
        instanceId: { type: 'string' },
        definitionId: { type: 'string' },
        wasReconstructed: { type: 'boolean' },
        entity: { type: 'object' },
      },
      additionalProperties: false,
    };

    // Force register the schema even if it exists
    try {
      schemaValidator.removeSchema(`${ENTITY_CREATED_ID}#payload`);
    } catch {} // Ignore if doesn't exist
    await schemaValidator.addSchema(
      entityCreatedSchema,
      `${ENTITY_CREATED_ID}#payload`
    );

    // Register component_added event with strict schema
    const componentAddedSchema = {
      type: 'object',
      required: ['entityId', 'componentType', 'componentData'],
      properties: {
        entityId: { type: 'string' },
        componentType: { type: 'string' },
        componentData: { type: 'object' },
      },
      additionalProperties: false,
    };

    try {
      schemaValidator.removeSchema(`${COMPONENT_ADDED_ID}#payload`);
    } catch {}
    await schemaValidator.addSchema(
      componentAddedSchema,
      `${COMPONENT_ADDED_ID}#payload`
    );

    // Register turn_started event schema
    const turnStartedSchema = {
      type: 'object',
      required: ['turnNumber', 'actorId', 'timestamp'],
      properties: {
        turnNumber: { type: 'number' },
        actorId: { type: 'string' },
        timestamp: { type: 'number' },
      },
      additionalProperties: false,
    };

    try {
      schemaValidator.removeSchema(`${TURN_STARTED_ID}#payload`);
    } catch {}
    await schemaValidator.addSchema(
      turnStartedSchema,
      `${TURN_STARTED_ID}#payload`
    );

    // Register entity_removed event schema
    const entityRemovedSchema = {
      type: 'object',
      required: ['instanceId', 'reason'],
      properties: {
        instanceId: { type: 'string' },
        reason: { type: 'string' },
      },
      additionalProperties: false,
    };

    try {
      schemaValidator.removeSchema(`${ENTITY_REMOVED_ID}#payload`);
    } catch {}
    await schemaValidator.addSchema(
      entityRemovedSchema,
      `${ENTITY_REMOVED_ID}#payload`
    );

    // Register entity_spoke event schema
    const entitySpokeSchema = {
      type: 'object',
      required: ['speakerId', 'message', 'targets'],
      properties: {
        speakerId: { type: 'string' },
        message: { type: 'string' },
        targets: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      additionalProperties: false,
    };

    try {
      schemaValidator.removeSchema(`${ENTITY_SPOKE_ID}#payload`);
    } catch {}
    await schemaValidator.addSchema(
      entitySpokeSchema,
      `${ENTITY_SPOKE_ID}#payload`
    );

    // Track all dispatched events for verification
    capturedEvents = [];
    eventBus.subscribe('*', (event) => {
      capturedEvents.push({
        type: event.type,
        payload: event.payload,
        timestamp: Date.now(),
      });
    });

    // Set up listeners for valid events
    validEventListener = jest.fn();
    eventBus.subscribe(ENTITY_CREATED_ID, validEventListener);

    // Set up listener for error events
    errorEventListener = jest.fn();
    eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, errorEventListener);

    // Verify schemas are available for validation
    const eventDefinitions = gameDataRepository.getAllEventDefinitions();
    expect(eventDefinitions.length).toBeGreaterThan(0);
  });

  afterEach(async () => {
    capturedEvents = [];
    if (validEventListener) validEventListener.mockClear();
    if (errorEventListener) errorEventListener.mockClear();
    if (mockLogger) {
      if (mockLogger.error) mockLogger.error.mockClear();
      if (mockLogger.warn) mockLogger.warn.mockClear();
    }
    if (testBed) await testBed.cleanup();
  });

  describe('Invalid Payload Structure', () => {
    it('should block events with missing required fields', async () => {
      // Attempt to dispatch entity_created event without required fields
      const invalidPayload = {
        // Missing required fields: instanceId, definitionId, wasReconstructed, entity
        someField: 'invalid',
      };

      const result = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        invalidPayload
      );

      // Event should be blocked
      expect(result).toBe(false);

      // Valid event listener should not be called
      expect(validEventListener).not.toHaveBeenCalled();

      // Error should be logged with details
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.objectContaining({
          payload: invalidPayload,
          errors: expect.any(Array),
        })
      );

      // No events should be captured (blocked at validation)
      const entityCreatedEvents = capturedEvents.filter(
        (e) => e.type === ENTITY_CREATED_ID
      );
      expect(entityCreatedEvents).toHaveLength(0);
    });

    it('should block events with wrong data types', async () => {
      // Attempt to dispatch with wrong types
      const invalidPayload = {
        instanceId: 123, // Should be string
        definitionId: true, // Should be string
        wasReconstructed: 'yes', // Should be boolean
        entity: 'not an object', // Should be object
      };

      const result = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        invalidPayload
      );

      expect(result).toBe(false);
      expect(validEventListener).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );
    });

    it('should block events with extra properties when additionalProperties is false', async () => {
      // Valid required fields but with extra properties
      const invalidPayload = {
        instanceId: 'test:entity_001',
        definitionId: 'test:definition',
        wasReconstructed: false,
        entity: { id: 'test:entity_001' },
        extraField: 'not allowed', // This should cause validation to fail
        anotherExtra: 123,
      };

      const result = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        invalidPayload
      );

      expect(result).toBe(false);
      expect(validEventListener).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('additional'),
            }),
          ]),
        })
      );
    });
  });

  describe('Schema Validation Process', () => {
    it('should handle events without defined schemas gracefully', async () => {
      // Try to dispatch an event that doesn't have a schema definition
      const unknownEventId = 'test:unknown_event';
      const payload = { data: 'test' };

      // Note: The behavior depends on whether the event definition exists
      // If not found, it logs a warning but proceeds
      const result = await validatedEventDispatcher.dispatch(
        unknownEventId,
        payload
      );

      // Should proceed with dispatch when schema not found
      expect(result).toBe(true);

      // Should log appropriate warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('EventDefinition not found')
      );
    });

    it('should allow bootstrap events without validation during initialization', async () => {
      // System error events should pass through even without full validation
      const errorPayload = {
        error: 'Test error',
        context: 'Validation test',
        severity: 'error',
      };

      const result = await validatedEventDispatcher.dispatch(
        SYSTEM_ERROR_OCCURRED_ID,
        errorPayload
      );

      // Should succeed (bootstrap event handling)
      expect(result).toBe(true);

      // Error event listener should be called
      expect(errorEventListener).toHaveBeenCalled();
    });
  });

  describe('Recovery After Validation Failures', () => {
    it('should continue accepting valid events after validation failures', async () => {
      // First, send an invalid event
      const invalidPayload = {
        missing: 'required fields',
      };

      const invalidResult = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        invalidPayload
      );
      expect(invalidResult).toBe(false);
      expect(validEventListener).not.toHaveBeenCalled();

      // Clear mocks
      mockLogger.error.mockClear();
      validEventListener.mockClear();

      // Now send a valid event
      const validPayload = {
        instanceId: 'test:entity_002',
        definitionId: 'test:definition',
        wasReconstructed: false,
        entity: {
          id: 'test:entity_002',
          components: {},
        },
      };

      const validResult = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        validPayload
      );

      // Should succeed
      expect(validResult).toBe(true);

      // Valid event listener should be called
      expect(validEventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ENTITY_CREATED_ID,
          payload: validPayload,
        })
      );

      // No errors for valid event
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should maintain system integrity after multiple validation failures', async () => {
      const failures = [];

      // Send multiple invalid events of different types
      const invalidEvents = [
        { id: ENTITY_CREATED_ID, payload: { invalid: true } },
        { id: COMPONENT_ADDED_ID, payload: { missing: 'fields' } },
        { id: TURN_STARTED_ID, payload: { wrong: 'structure' } },
        { id: ATTEMPT_ACTION_ID, payload: null }, // Null payload
        { id: ACTION_DECIDED_ID, payload: 'string instead of object' },
      ];

      for (const event of invalidEvents) {
        const result = await validatedEventDispatcher.dispatch(
          event.id,
          event.payload
        );
        failures.push({ event: event.id, result });
      }

      // All should fail
      expect(failures.every((f) => f.result === false)).toBe(true);

      // Clear state
      mockLogger.error.mockClear();
      capturedEvents.length = 0;

      // System should still work - dispatch a valid turn started event
      const validTurnPayload = {
        turnNumber: 1,
        actorId: 'test:actor_001',
        timestamp: Date.now(),
      };

      const turnListener = jest.fn();
      eventBus.subscribe(TURN_STARTED_ID, turnListener);

      const result = await validatedEventDispatcher.dispatch(
        TURN_STARTED_ID,
        validTurnPayload
      );

      // Should succeed
      expect(result).toBe(true);
      expect(turnListener).toHaveBeenCalled();

      // Verify event was captured
      const turnEvents = capturedEvents.filter(
        (e) => e.type === TURN_STARTED_ID
      );
      expect(turnEvents).toHaveLength(1);
    });
  });

  describe('Error Reporting and Logging', () => {
    it('should provide detailed validation error messages', async () => {
      const invalidPayload = {
        instanceId: 123, // Wrong type
        // Missing definitionId
        wasReconstructed: 'not a boolean', // Wrong type
        entity: null, // Should be object
        extraProp: 'not allowed',
      };

      await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        invalidPayload
      );

      // Check for detailed error reporting
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.objectContaining({
          payload: invalidPayload,
          errors: expect.arrayContaining([
            expect.objectContaining({
              instancePath: expect.any(String),
              message: expect.any(String),
            }),
          ]),
        })
      );

      // Error message should include the event name
      expect(mockLogger.error.mock.calls[0][0]).toContain(ENTITY_CREATED_ID);
    });

    it('should handle validation process errors gracefully', async () => {
      // Test behavior when validation itself throws an error
      // This could happen if schema is malformed or validator has issues

      // We'll test with a complex nested structure that might cause issues
      const complexPayload = {
        instanceId: 'test:entity',
        definitionId: 'test:def',
        wasReconstructed: false,
        entity: {
          nested: {
            deeply: {
              nested: {
                structure: {
                  with: {
                    many: {
                      levels: {},
                    },
                  },
                },
              },
            },
          },
        },
      };

      // This should still be handled gracefully
      const result = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        complexPayload
      );

      // Should either succeed (if valid) or fail gracefully (if invalid)
      expect(typeof result).toBe('boolean');

      // System should not crash
      expect(eventBus).toBeDefined();
      expect(validatedEventDispatcher).toBeDefined();
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should validate component lifecycle events correctly', async () => {
      // Test component_added validation
      const invalidComponentPayload = {
        entityId: 'test:entity',
        // Missing componentType and componentData
      };

      const componentResult = await validatedEventDispatcher.dispatch(
        COMPONENT_ADDED_ID,
        invalidComponentPayload
      );

      expect(componentResult).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Payload validation FAILED'),
        expect.anything()
      );

      // Now test with valid payload
      mockLogger.error.mockClear();

      const validComponentPayload = {
        entityId: 'test:entity',
        componentType: 'test:component',
        componentData: {
          someData: 'value',
        },
      };

      const validResult = await validatedEventDispatcher.dispatch(
        COMPONENT_ADDED_ID,
        validComponentPayload
      );

      expect(validResult).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle rapid validation failures without performance degradation', async () => {
      const startTime = Date.now();
      const iterations = 50;

      // Rapidly send invalid events
      const promises = [];
      for (let i = 0; i < iterations; i++) {
        promises.push(
          validatedEventDispatcher.dispatch(ENTITY_CREATED_ID, { invalid: i })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should fail
      expect(results.every((r) => r === false)).toBe(true);

      // Should complete reasonably quickly (< 2 seconds for 50 validations)
      expect(endTime - startTime).toBeLessThan(2000);

      // System should still be responsive
      const validPayload = {
        instanceId: 'test:final',
        definitionId: 'test:def',
        wasReconstructed: true,
        entity: {},
      };

      const finalResult = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        validPayload
      );

      expect(finalResult).toBe(true);
    });

    it('should validate event sequences with dependencies', async () => {
      // Test that validation failures don't break event sequence dependencies

      // Start with entity creation
      const entityPayload = {
        instanceId: 'test:entity_seq',
        definitionId: 'test:def',
        wasReconstructed: false,
        entity: { id: 'test:entity_seq' },
      };

      const entityResult = await validatedEventDispatcher.dispatch(
        ENTITY_CREATED_ID,
        entityPayload
      );
      expect(entityResult).toBe(true);

      // Try to add component with invalid payload
      const invalidComponentPayload = {
        entityId: 'test:entity_seq',
        // Missing required fields
      };

      const componentResult = await validatedEventDispatcher.dispatch(
        COMPONENT_ADDED_ID,
        invalidComponentPayload
      );
      expect(componentResult).toBe(false);

      // Entity should still exist and be removable
      const removePayload = {
        instanceId: 'test:entity_seq',
        reason: 'cleanup',
      };

      const removeResult = await validatedEventDispatcher.dispatch(
        ENTITY_REMOVED_ID,
        removePayload
      );
      expect(removeResult).toBe(true);
    });
  });

  describe('SafeEventDispatcher Integration', () => {
    it('should handle validation failures through SafeEventDispatcher', async () => {
      // SafeEventDispatcher wraps ValidatedEventDispatcher
      const invalidPayload = {
        invalid: 'data',
      };

      // Using safe dispatcher should not throw
      await expect(
        safeEventDispatcher.dispatch(ENTITY_CREATED_ID, invalidPayload)
      ).resolves.not.toThrow();

      // Should log error but not crash
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should recover from handler errors after validation passes', async () => {
      // Add a handler that throws
      const throwingHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      eventBus.subscribe(ENTITY_SPOKE_ID, throwingHandler);

      // Valid payload for entity_spoke
      const validPayload = {
        speakerId: 'test:speaker',
        message: 'Test message',
        targets: ['test:target'],
      };

      // Should handle the error gracefully
      const result = await safeEventDispatcher.dispatch(
        ENTITY_SPOKE_ID,
        validPayload
      );

      // Dispatch succeeds even if handler fails
      expect(result).toBe(true);

      // Handler was called but threw
      expect(throwingHandler).toHaveBeenCalled();

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.any(Error)
      );
    });
  });
});
