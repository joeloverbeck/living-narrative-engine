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

  it('should reproduce schema overwrite debug logs when the same payload schema is registered twice', async () => {
    // Arrange: Set up the scenario where a schema is already loaded
    const schemaId = 'core:character_concept_created#payload';
    const schema = {
      type: 'object',
      properties: {
        conceptId: { type: 'string' },
        concept: { type: 'string' },
        autoSaved: { type: 'boolean' },
      },
      required: ['conceptId', 'concept'],
    };

    // First, simulate that the schema is already loaded (returns true)
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    // Act: Try to register the same schema again
    // Note: Payload schemas (with #payload) are logged at debug level, not warn level
    await registerInlineSchema(
      mockSchemaValidator,
      schema,
      schemaId,
      mockLogger,
      {} // No warnMessage needed for payload schemas
    );

    // Assert: Verify that debug was logged (payload schemas use debug level)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Schema '${schemaId}' already loaded from previous session. Re-registering.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // Verify that the schema was removed and re-added (overwrite behavior)
    expect(mockSchemaValidator.removeSchema).toHaveBeenCalledWith(schemaId);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      schema,
      schemaId
    );
  });

  it('should demonstrate the specific debug logs from payload schemas', async () => {
    // Arrange: Set up both schemas that are being re-registered
    const schemas = [
      {
        id: 'core:character_concept_created#payload',
        debugMessage:
          "Schema 'core:character_concept_created#payload' already loaded from previous session. Re-registering.",
      },
      {
        id: 'core:character_concept_deleted#payload',
        debugMessage:
          "Schema 'core:character_concept_deleted#payload' already loaded from previous session. Re-registering.",
      },
    ];

    // Simulate that both schemas are already loaded
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    // Act: Register both schemas (simulating the dual registration scenario)
    // Note: Payload schemas are logged at debug level, not warn level
    for (const schemaInfo of schemas) {
      await registerInlineSchema(
        mockSchemaValidator,
        { type: 'object', properties: { conceptId: { type: 'string' } } },
        schemaInfo.id,
        mockLogger,
        {} // No warnMessage needed for payload schemas
      );
    }

    // Assert: Verify both debug messages were logged (payload schemas use debug level)
    expect(mockLogger.debug).toHaveBeenCalledWith(schemas[0].debugMessage);
    expect(mockLogger.debug).toHaveBeenCalledWith(schemas[1].debugMessage);
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // Verify both schemas were removed and re-added
    expect(mockSchemaValidator.removeSchema).toHaveBeenCalledWith(
      schemas[0].id
    );
    expect(mockSchemaValidator.removeSchema).toHaveBeenCalledWith(
      schemas[1].id
    );
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledTimes(2);
  });

  it('should not show warnings when schemas are not already loaded', async () => {
    // Arrange: Configure schema validator to indicate schema is NOT already loaded
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    const schemaId = 'core:character_concept_created#payload';
    const schema = {
      type: 'object',
      properties: { conceptId: { type: 'string' } },
    };

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
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      schema,
      schemaId
    );
  });
});
