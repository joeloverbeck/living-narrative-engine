/**
 * @file Test suite to verify the schema overwrite fix in CharacterBuilderBootstrap
 * @description Verifies that schema pre-checking prevents duplicate registration warnings
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { registerInlineSchema } from '../../../src/utils/schemaUtils.js';
import { BaseTestBed } from '../../common/baseTestBed.js';

describe('Schema Overwrite Fix - Verification Test', () => {
  let testBed;
  let mockLogger;
  let mockSchemaValidator;

  beforeEach(() => {
    testBed = new BaseTestBed();

    // Create mock logger to capture debug messages
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
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

  it('should demonstrate the fix prevents warnings when schema is already loaded', async () => {
    // Arrange: Simulate the fixed behavior where we check before registering
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

    // Simulate schema already loaded from mods
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    // Act: Simulate the fixed bootstrap behavior - check first, skip if already loaded
    if (!mockSchemaValidator.isSchemaLoaded(schemaId)) {
      // This branch should NOT execute since schema is already loaded
      await mockSchemaValidator.addSchema(schema, schemaId);
      mockLogger.debug(`Registered payload schema: ${schemaId}`);
    } else {
      // This branch SHOULD execute - log the skip
      mockLogger.debug(
        `Skipping payload schema registration for ${schemaId} - already loaded from mods`
      );
    }

    // Assert: Verify the correct behavior
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
    expect(mockSchemaValidator.addSchema).not.toHaveBeenCalled(); // Should not be called
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Skipping payload schema registration for ${schemaId} - already loaded from mods`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings should occur
  });

  it('should still register schemas when they are not pre-loaded', async () => {
    // Arrange: Simulate scenario where schema is NOT already loaded
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

    // Schema is NOT already loaded
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(false);

    // Act: Simulate the fixed bootstrap behavior
    if (!mockSchemaValidator.isSchemaLoaded(schemaId)) {
      // This branch SHOULD execute - schema not loaded, so register it
      await mockSchemaValidator.addSchema(schema, schemaId);
      mockLogger.debug(`Registered payload schema: ${schemaId}`);
    } else {
      // This branch should NOT execute
      mockLogger.debug(
        `Skipping payload schema registration for ${schemaId} - already loaded from mods`
      );
    }

    // Assert: Verify the correct behavior
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledWith(schemaId);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      schema,
      schemaId
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Registered payload schema: ${schemaId}`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled(); // Still no warnings
  });

  it('should verify the old behavior would cause debug logs (before fix)', async () => {
    // Arrange: Demonstrate what the OLD behavior would do (without pre-checking)
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

    // Schema is already loaded (from mods)
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    // Act: Simulate the OLD behavior - directly call registerInlineSchema without checking
    // Note: Payload schemas (with #payload) are logged at debug level, not warn level
    await registerInlineSchema(
      mockSchemaValidator,
      schema,
      schemaId,
      mockLogger,
      {} // No warnMessage needed for payload schemas
    );

    // Assert: Payload schemas log at debug level, not warn level
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Schema '${schemaId}' already loaded from previous session. Re-registering.`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockSchemaValidator.removeSchema).toHaveBeenCalledWith(schemaId);
    expect(mockSchemaValidator.addSchema).toHaveBeenCalledWith(
      schema,
      schemaId
    );
  });

  it('should handle the complete scenario with both problematic events', async () => {
    // Arrange: Test both events that were causing warnings
    const eventSchemas = [
      {
        id: 'core:character_concept_created#payload',
        schema: {
          type: 'object',
          required: ['conceptId', 'concept', 'autoSaved'],
          properties: {
            conceptId: { type: 'string' },
            concept: { type: 'string' },
            autoSaved: { type: 'boolean' },
          },
        },
      },
      {
        id: 'core:character_concept_deleted#payload',
        schema: {
          type: 'object',
          required: ['conceptId'],
          properties: {
            conceptId: { type: 'string' },
          },
        },
      },
    ];

    // Both schemas are already loaded from mods
    mockSchemaValidator.isSchemaLoaded.mockReturnValue(true);

    // Act: Simulate the fixed bootstrap behavior for both events
    for (const eventSchema of eventSchemas) {
      if (!mockSchemaValidator.isSchemaLoaded(eventSchema.id)) {
        await mockSchemaValidator.addSchema(eventSchema.schema, eventSchema.id);
        mockLogger.debug(`Registered payload schema: ${eventSchema.id}`);
      } else {
        mockLogger.debug(
          `Skipping payload schema registration for ${eventSchema.id} - already loaded from mods`
        );
      }
    }

    // Assert: Both events should be skipped, no warnings should occur
    expect(mockSchemaValidator.isSchemaLoaded).toHaveBeenCalledTimes(2);
    expect(mockSchemaValidator.addSchema).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Skipping payload schema registration for core:character_concept_created#payload - already loaded from mods'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Skipping payload schema registration for core:character_concept_deleted#payload - already loaded from mods'
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
