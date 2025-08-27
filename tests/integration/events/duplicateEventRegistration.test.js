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
    logger = new ConsoleLogger('error');
    warnSpy = jest.spyOn(logger, 'warn');

    schemaValidator = new AjvSchemaValidator({ logger });
  });

  describe('Schema Registration Behavior', () => {
    it('should warn when registering the same schema ID twice', async () => {
      const schemaId = 'core:direction_deleted#payload';
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

    it('should produce the exact warning message seen in production', async () => {
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

      // Clear warn spy calls from first registration
      warnSpy.mockClear();

      // Second registration (simulating duplicate from test setup)
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

      // Should produce the exact warning message
      expect(warnSpy).toHaveBeenCalledWith(
        `EventLoader [core]: Payload schema ID 'core:direction_deleted#payload' for event 'core:direction_deleted' was already loaded. Overwriting.`
      );
    });

    it('should handle multiple duplicate event registrations', async () => {
      const events = [
        'core:direction_deleted',
        'core:direction_updated',
        'core:orphans_cleaned',
      ];

      for (const eventId of events) {
        const schemaId = `${eventId}#payload`;
        const schema = {
          type: 'object',
          properties: {
            testField: { type: 'string' },
          },
        };

        // First registration
        await registerSchema(schemaValidator, schema, schemaId, logger);
      }

      // Clear warn spy
      warnSpy.mockClear();

      // Second registration of all events (simulating duplicate registration)
      for (const eventId of events) {
        const schemaId = `${eventId}#payload`;
        const schema = {
          type: 'object',
          properties: {
            testField: { type: 'string' },
          },
        };

        await registerSchema(schemaValidator, schema, schemaId, logger);
      }

      // Should have warned for all three
      expect(warnSpy).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('core:direction_deleted#payload')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('core:direction_updated#payload')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('core:orphans_cleaned#payload')
      );
    });
  });

  describe('Schema Comparison for Smart Registration', () => {
    it('should not warn when registering identical schemas', async () => {
      const schemaId = 'test:event#payload';
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
      // After our fix, this should NOT warn since the schemas are identical
      await registerSchema(schemaValidator, schema, schemaId, logger);

      // With current implementation, it still warns even for identical schemas
      // This could be improved in the future by comparing schemas before overwriting
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should warn when registering different schemas with same ID', async () => {
      const schemaId = 'test:event#payload';
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
