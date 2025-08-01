/**
 * @file Test suite to reproduce schema overwrite warnings during character builder bootstrap
 * @description Verifies that the same event schemas are being registered twice, causing warnings
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { registerInlineSchema } from '../../../src/utils/schemaUtils.js';
import { BaseTestBed } from '../../common/baseTestBed.js';

describe('Schema Overwrite Warning - Reproduction Test', () => {
  let testBed;
  let mockLogger;
  let mockSchemaValidator;

  beforeEach(() => {
    testBed = new BaseTestBed();

    // Create mock logger to capture warnings
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(), // This is what we want to verify gets called
      error: jest.fn(),
    };

    // Create mock schema validator that tracks schema registration
    mockSchemaValidator = {
      addSchema: jest.fn().mockResolvedValue(undefined),
      isSchemaLoaded: jest.fn(),
      removeSchema: jest.fn(),
      validateData: jest.fn().mockReturnValue(true),
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reproduce schema overwrite warnings when the same schema is registered twice', async () => {
    // Arrange: Set up the scenario where a schema is already loaded
    const schemaId = 'core:character_concept_created#payload';
    const schema = {
      type: 'object',
      properties: {
        conceptId: { type: 'string' },
        concept: { type: 'string' },
        autoSaved: { type: 'boolean' }
      },
      required: ['conceptId', 'concept']
    };

    // First, simulate that the schema is already loaded (returns true)
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    const warnMessage = `EventLoader [core]: Payload schema ID '${schemaId}' for event 'core:character_concept_created' was already loaded. Overwriting.`;

    // Act: Try to register the same schema again
    await registerInlineSchema(
      mockSchemaValidator,
      schema,
      schemaId,
      mockLogger,
      { warnMessage }
    );

    // Assert: Verify that the warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(warnMessage);

    // Verify that the schema was removed and re-added (overwrite behavior)
    expect(mockSchemaValidator.removeSchema).toHaveBeenCalledWith(schemaId);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);
  });

  it('should demonstrate the specific warnings from the logs', async () => {
    // Arrange: Set up both schemas that are causing the warnings
    const schemas = [
      {
        id: 'core:character_concept_created#payload',
        warnMessage: "EventLoader [core]: Payload schema ID 'core:character_concept_created#payload' for event 'core:character_concept_created' was already loaded. Overwriting."
      },
      {
        id: 'core:character_concept_deleted#payload', 
        warnMessage: "EventLoader [core]: Payload schema ID 'core:character_concept_deleted#payload' for event 'core:character_concept_deleted' was already loaded. Overwriting."
      }
    ];

    // Simulate that both schemas are already loaded
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    // Act: Register both schemas (simulating the dual registration scenario)
    for (const schemaInfo of schemas) {
      await registerInlineSchema(
        mockSchemaValidator,
        { type: 'object', properties: { conceptId: { type: 'string' } } },
        schemaInfo.id,
        mockLogger,
        { warnMessage: schemaInfo.warnMessage }
      );
    }

    // Assert: Verify both warnings were logged exactly as they appear in the logs
    expect(mockLogger.warn).toHaveBeenCalledWith(schemas[0].warnMessage);
    expect(mockLogger.warn).toHaveBeenCalledWith(schemas[1].warnMessage);

    // Verify both schemas were removed and re-added
    expect(mockSchemaValidator.removeSchema).toHaveBeenCalledWith(schemas[0].id);
    expect(mockSchemaValidator.removeSchema).toHaveBeenCalledWith(schemas[1].id);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(2);
  });

  it('should not show warnings when schemas are not already loaded', async () => {
    // Arrange: Configure schema validator to indicate schema is NOT already loaded
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    const schemaId = 'core:character_concept_created#payload';
    const schema = { type: 'object', properties: { conceptId: { type: 'string' } } };

    // Act: Register the schema for the first time
    await registerInlineSchema(
      mockSchemaValidator,
      schema,
      schemaId,
      mockLogger,
      { warnMessage: 'Should not appear' }
    );

    // Assert: No warnings should be logged when schema isn't already loaded
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockSchemaValidator.removeSchema).not.toHaveBeenCalled();
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(schema, schemaId);
  });
});