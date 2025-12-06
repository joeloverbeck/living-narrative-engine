/**
 * @file duplicateEventRegistration.test.js
 * @description Integration test to verify handling of duplicate event registration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import {
  registerSchema,
  registerInlineSchema,
} from '../../../src/utils/schemaUtils.js';

describe('Duplicate Event Registration - Integration Test', () => {
  let logger;
  let schemaValidator;
  let warnSpy;

  beforeEach(() => {
    // Set logger to 'warn' level to capture warning messages
    logger = new ConsoleLogger('warn');
    warnSpy = jest.spyOn(logger, 'warn');

    schemaValidator = new AjvSchemaValidator({ logger });
  });

  describe('Schema Registration Behavior', () => {
    it('should warn when registering the same schema ID twice', async () => {
      // Use non-payload schema ID to trigger warning behavior
      const schemaId = 'core:direction_deleted';
      const schema = {
        type: 'object',
        properties: {
          directionId: {
            type: 'string',
            minLength: 1,
          },
        },
        required: ['directionId'],
        additionalProperties: false,
      };

      // First registration - should not warn
      await registerSchema(schemaValidator, schema, schemaId, logger);
      expect(warnSpy).not.toHaveBeenCalled();

      // Second registration with same schema - should warn
      await registerSchema(schemaValidator, schema, schemaId, logger);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Schema '${schemaId}' already loaded. Overwriting.`
        )
      );
    });

    it('should use debug logging for payload schema re-registration', async () => {
      // Create a debug spy since payload schemas use debug logging, not warnings
      const debugSpy = jest.spyOn(logger, 'debug');

      const eventDefinition = {
        id: 'core:direction_deleted',
        payloadSchema: {
          type: 'object',
          properties: {
            directionId: {
              description:
                'The unique identifier of the deleted thematic direction',
              type: 'string',
              minLength: 1,
            },
          },
          required: ['directionId'],
          additionalProperties: false,
        },
      };

      const schemaId = `${eventDefinition.id}#payload`;

      // First registration through inline schema (simulating mod loading)
      await registerInlineSchema(
        schemaValidator,
        eventDefinition.payloadSchema,
        schemaId,
        logger,
        {
          warnMessage: `EventLoader [core]: Payload schema ID '${schemaId}' for event '${eventDefinition.id}' was already loaded. Overwriting.`,
          successDebugMessage: `EventLoader: Registered schema for ${eventDefinition.id}`,
          errorLogMessage: `EventLoader: Failed to register schema for ${eventDefinition.id}`,
          throwErrorMessage: `Failed to register schema for ${eventDefinition.id}`,
        }
      );

      // Clear debug spy calls from first registration
      debugSpy.mockClear();

      // Second registration (simulating duplicate from test setup)
      // Payload schemas use debug logging, not warnings
      await registerInlineSchema(
        schemaValidator,
        eventDefinition.payloadSchema,
        schemaId,
        logger,
        {
          warnMessage: `EventLoader [core]: Payload schema ID '${schemaId}' for event '${eventDefinition.id}' was already loaded. Overwriting.`,
          successDebugMessage: `EventLoader: Registered schema for ${eventDefinition.id}`,
          errorLogMessage: `EventLoader: Failed to register schema for ${eventDefinition.id}`,
          throwErrorMessage: `Failed to register schema for ${eventDefinition.id}`,
        }
      );

      // Payload schemas should use debug logging, not warnings
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Schema '${schemaId}' already loaded from previous session`
        )
      );
      // Should NOT have produced a warning
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple duplicate event registrations', async () => {
      // Use non-payload schema IDs to trigger warning behavior
      const events = [
        'core:direction_deleted',
        'core:direction_updated',
        'core:orphans_cleaned',
      ];

      for (const eventId of events) {
        const schema = {
          type: 'object',
          properties: {
            testField: { type: 'string' },
          },
        };

        // First registration
        await registerSchema(schemaValidator, schema, eventId, logger);
      }

      // Clear warn spy
      warnSpy.mockClear();

      // Second registration of all events (simulating duplicate registration)
      for (const eventId of events) {
        const schema = {
          type: 'object',
          properties: {
            testField: { type: 'string' },
          },
        };

        await registerSchema(schemaValidator, schema, eventId, logger);
      }

      // Should have warned for all three
      expect(warnSpy).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('core:direction_deleted')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('core:direction_updated')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('core:orphans_cleaned')
      );
    });
  });

  describe('Schema Comparison for Smart Registration', () => {
    it('should warn when registering identical non-payload schemas', async () => {
      // Use non-payload schema ID
      const schemaId = 'test:event';
      const schema = {
        type: 'object',
        properties: {
          field1: { type: 'string' },
          field2: { type: 'number' },
        },
        required: ['field1'],
      };

      // First registration
      await registerSchema(schemaValidator, schema, schemaId, logger);

      // Clear warn spy
      warnSpy.mockClear();

      // Second registration with IDENTICAL schema
      // Current implementation warns even for identical schemas
      // This could be improved in the future by comparing schemas before overwriting
      await registerSchema(schemaValidator, schema, schemaId, logger);

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should warn when registering different schemas with same ID', async () => {
      // Use non-payload schema ID
      const schemaId = 'test:event';
      const schema1 = {
        type: 'object',
        properties: {
          field1: { type: 'string' },
        },
      };
      const schema2 = {
        type: 'object',
        properties: {
          field1: { type: 'number' }, // Different type
        },
      };

      // First registration
      await registerSchema(schemaValidator, schema1, schemaId, logger);

      // Clear warn spy
      warnSpy.mockClear();

      // Second registration with DIFFERENT schema
      // This should ALWAYS warn since we're changing the schema
      await registerSchema(schemaValidator, schema2, schemaId, logger);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Schema '${schemaId}' already loaded. Overwriting.`
        )
      );
    });
  });
});
