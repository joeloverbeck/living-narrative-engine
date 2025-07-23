import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CharacterStorageService,
  CharacterStorageError,
} from '../../../src/characterBuilder/services/characterStorageService.js';
import {
  CharacterBuilderService,
  CharacterBuilderError,
} from '../../../src/characterBuilder/services/characterBuilderService.js';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';

/**
 * @file Comprehensive error scenario tests for character builder
 * Tests all error paths that were causing issues in the original problem
 */

describe('Character Builder - Error Scenarios', () => {
  let storageService;
  let builderService;
  let mockLogger;
  let mockDatabase;
  let mockSchemaValidator;
  let mockEventBus;
  let mockDirectionGenerator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(),
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      close: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
      formatAjvErrors: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    storageService = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
    });

    builderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Date Object Validation Errors (Root Cause)', () => {
    it('should handle the specific Date object vs string schema error from logs', async () => {
      // Arrange - Initialize and recreate the exact scenario from logs
      await storageService.initialize();

      const concept = createCharacterConcept(
        'a strong woman in her twenties, who is good with a sword'
      );

      // Mock the specific validation failure from logs
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Details:\n[\n  {\n    "instancePath": "/createdAt",\n    "keyword": "type",\n    "params": {"type": "string"},\n    "message": "must be string",\n    "data": "2025-07-22T19:45:15.844Z"\n  },\n  {\n    "instancePath": "/updatedAt",\n    "keyword": "type", \n    "params": {"type": "string"},\n    "message": "must be string",\n    "data": "2025-07-22T19:45:16.860Z"\n  }\n]'
      );

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(concept)
      ).rejects.toThrow(CharacterStorageError);

      // Verify the error includes the detailed validation info
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Schema validation failed'),
        expect.objectContaining({
          conceptId: concept.id,
          validationErrors: expect.stringContaining('must be string'),
          originalData: concept,
          serializedData: expect.objectContaining({
            createdAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
            ),
            updatedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
            ),
          }),
        })
      );
    });

    it('should prevent retries on schema validation failures (as shown in logs)', async () => {
      // Arrange
      await storageService.initialize();

      const concept = createCharacterConcept(
        'a strong woman in her twenties, who is good with a sword'
      );

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Schema validation failed'
      );

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(concept)
      ).rejects.toThrow(
        'Character concept validation failed: Schema validation failed'
      );

      // Should only attempt once, no retries
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledTimes(
        1
      );
      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled(); // Never reach database

      // One warning is logged for the failed attempt, but no retries occur
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1 failed for concept storage'),
        expect.any(Object)
      );
    });

    it('should handle "No specific error details provided" scenario', async () => {
      // Arrange
      await storageService.initialize();

      const concept = createCharacterConcept(
        'a strong woman in her twenties, who is good with a sword'
      );

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(''); // Empty error details

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(concept)
      ).rejects.toThrow(
        'Character concept validation failed: Schema validation failed without specific details'
      );

      // Verify the fallback error message is used
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Schema validation failed'),
        expect.objectContaining({
          validationErrors: '', // Empty error message from mock
        })
      );
    });
  });

  describe('Multi-Attempt Failure Scenarios (From Logs)', () => {
    it('should recreate the 3-attempt failure cycle from logs', async () => {
      // Arrange
      await builderService.initialize();

      const conceptText =
        'a strong woman in her twenties, who is good with a sword';

      // Mock storage to fail all 3 attempts (as seen in logs)
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Character concept validation failed: No specific error details provided'
      );

      // Act & Assert
      await expect(
        builderService.createCharacterConcept(conceptText, { autoSave: true })
      ).rejects.toThrow(CharacterBuilderError);

      // Verify the builder service made 3 attempts, each causing a storage warning
      // Plus 3 warnings from the builder service retries = 6 total warnings
      expect(mockLogger.warn).toHaveBeenCalledTimes(6); // Storage + Builder warnings

      // Verify final error event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.stringContaining(
            'Failed to create character concept after 3 attempts'
          ),
          operation: 'createCharacterConcept',
          concept: expect.stringContaining('a strong woman'),
          attempts: 3,
        })
      );

      // Verify final error logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to create character concept after 3 attempts'
        ),
        expect.any(Error)
      );
    });

    it('should handle storage service internal retry failures', async () => {
      // Arrange
      await storageService.initialize();

      const concept = createCharacterConcept(
        'a strong woman in her twenties, who is good with a sword'
      );

      // Mock database to fail all 3 storage attempts (not validation)
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(concept)
      ).rejects.toThrow('Failed to store character concept');

      // Verify 3 attempts were made at storage level
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);

      // Verify retry warnings
      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Attempt 1 failed for concept storage'),
        expect.any(Object)
      );
    });
  });

  describe('Event System Error Handling', () => {
    it('should handle missing event definition gracefully', async () => {
      // Arrange
      await builderService.initialize();

      const conceptText =
        'a strong woman in her twenties, who is good with a sword';

      // Mock event dispatch to throw error (simulating missing event definition)
      mockEventBus.dispatch.mockImplementation((eventType) => {
        if (eventType === 'CHARACTER_BUILDER_ERROR_OCCURRED') {
          // Should not throw - this is warning behavior from logs
          mockLogger.warn(
            `VED: EventDefinition not found for '${eventType}'. Cannot validate payload. Proceeding with dispatch.`
          );
        }
      });

      // Mock storage to fail
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Validation failed');

      // Act & Assert
      await expect(
        builderService.createCharacterConcept(conceptText, { autoSave: true })
      ).rejects.toThrow(CharacterBuilderError);

      // Should still dispatch the event despite missing definition
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.any(Object)
      );
    });

    it('should include all required fields in error event payload', async () => {
      // Arrange
      await builderService.initialize();

      const conceptText =
        'a strong woman in her twenties, who is good with a sword';
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Schema validation failed'
      );

      // Act
      await expect(
        builderService.createCharacterConcept(conceptText, { autoSave: true })
      ).rejects.toThrow();

      // Assert - Verify error event payload matches schema
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.any(String), // Required
          operation: 'createCharacterConcept', // Required
          concept: expect.stringMatching(/a strong woman.*/), // Optional but present
          attempts: 3, // Optional but present
          finalError: expect.any(String), // Optional but present
        })
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle concept creation with null/undefined inputs', async () => {
      // Arrange
      await builderService.initialize();

      // Act & Assert
      await expect(builderService.createCharacterConcept(null)).rejects.toThrow(
        CharacterBuilderError
      );

      await expect(
        builderService.createCharacterConcept(undefined)
      ).rejects.toThrow(CharacterBuilderError);

      await expect(builderService.createCharacterConcept('')).rejects.toThrow(
        CharacterBuilderError
      );

      await expect(
        builderService.createCharacterConcept('   ')
      ).rejects.toThrow(CharacterBuilderError);
    });

    it('should handle storage service initialization failures', async () => {
      // Arrange
      const uninitializedStorageService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      const concept = createCharacterConcept('a strong woman in her twenties');

      // Act & Assert - Should fail because not initialized
      await expect(
        uninitializedStorageService.storeCharacterConcept(concept)
      ).rejects.toThrow('CharacterStorageService not initialized');
    });

    it('should handle malformed character concept objects', async () => {
      // Arrange
      await storageService.initialize();

      const malformedConcept = {
        // Missing required fields
        concept: 'A warrior',
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Missing required fields'
      );

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(malformedConcept)
      ).rejects.toThrow(CharacterStorageError);
    });
  });

  describe('Error Recovery and Logging', () => {
    it('should provide comprehensive error context for debugging', async () => {
      // Arrange
      await storageService.initialize();

      const concept = createCharacterConcept(
        'a strong woman in her twenties, who is good with a sword'
      );

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Detailed validation errors'
      );

      // Act
      await expect(
        storageService.storeCharacterConcept(concept)
      ).rejects.toThrow();

      // Assert - Verify comprehensive error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Schema validation failed for concept'),
        expect.objectContaining({
          conceptId: concept.id,
          validationErrors: 'Detailed validation errors',
          originalData: concept,
          serializedData: expect.any(Object),
          schemaId: 'character-concept',
        })
      );
    });

    it('should maintain error cause chains for debugging', async () => {
      // Arrange
      await builderService.initialize();

      const conceptText =
        'a strong woman in her twenties, who is good with a sword';
      const rootError = new Error('Database connection lost');

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockRejectedValue(rootError);

      // Act
      let caughtError;
      try {
        await builderService.createCharacterConcept(conceptText, {
          autoSave: true,
        });
      } catch (error) {
        caughtError = error;
      }

      // Assert - Error should maintain cause chain
      expect(caughtError).toBeInstanceOf(CharacterBuilderError);
      expect(caughtError.cause).toBeInstanceOf(CharacterStorageError);
      expect(caughtError.cause.cause).toBe(rootError);
    });
  });
});
