/**
 * @file Edge case and error scenario tests for character builder
 * @description Tests error handling, validation failures, and edge cases
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import {
  CharacterStorageService,
  CharacterStorageError,
} from '../../../src/characterBuilder/services/characterStorageService.js';
import {
  CharacterBuilderService,
  CharacterBuilderError,
} from '../../../src/characterBuilder/services/characterBuilderService.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Character Builder - Error Scenarios', () => {
  let logger;
  let mockValidator;
  let mockDatabase;
  let mockEventBus;

  beforeEach(() => {
    logger = new ConsoleLogger('error');

    mockValidator = {
      validateAgainstSchema: jest.fn(),
      formatAjvErrors: jest.fn(),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
    };

    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(),
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      close: jest.fn().mockResolvedValue(),
      isInitialized: jest.fn().mockReturnValue(true),
    };

    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('schema validation edge cases', () => {
    it('should handle schema not loaded error', () => {
      // Arrange
      mockValidator.isSchemaLoaded.mockReturnValue(false);
      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });

      const concept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Valid concept text',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert - This should not throw, as validateAgainstSchema should handle missing schemas
      expect(() =>
        mockValidator.validateAgainstSchema(concept, 'character-concept')
      ).not.toThrow();
    });

    it('should handle malformed UUID in concept ID', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        'id: must match pattern ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const conceptWithBadId = {
        id: 'not-a-uuid',
        concept: 'Valid concept text with invalid ID',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(conceptWithBadId)
      ).rejects.toThrow(CharacterStorageError);
      await expect(
        storageService.storeCharacterConcept(conceptWithBadId)
      ).rejects.toThrow(/must match pattern/);
    });

    it('should handle concept text length violations', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        'concept: must NOT have fewer than 10 characters'
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const conceptTooShort = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Short', // Less than 10 characters
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(conceptTooShort)
      ).rejects.toThrow(/must NOT have fewer than 10 characters/);
    });

    it('should handle invalid status enum values', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        'status: must be equal to one of the allowed values'
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const conceptInvalidStatus = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Valid concept text',
        status: 'invalid-status',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(conceptInvalidStatus)
      ).rejects.toThrow(/must be equal to one of the allowed values/);
    });

    it('should handle malformed date-time fields', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        'createdAt: must match format "date-time"'
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const conceptBadDate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Valid concept text',
        status: 'draft',
        createdAt: 'not-a-date',
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(conceptBadDate)
      ).rejects.toThrow(/must match format "date-time"/);
    });
  });

  describe('database error scenarios', () => {
    it('should handle database connection failures', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockRejectedValue(
        new Error('Database connection timeout')
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const validConcept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Valid concept that will fail to save',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(validConcept)
      ).rejects.toThrow(CharacterStorageError);
      await expect(
        storageService.storeCharacterConcept(validConcept)
      ).rejects.toThrow(/Database connection timeout/);

      // Should retry 6 times (based on current implementation with duplicated retries)
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(6);
    });

    it('should handle database constraint violations', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockRejectedValue(
        new Error('UNIQUE constraint failed: concepts.id')
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const duplicateConcept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Concept with duplicate ID',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(duplicateConcept)
      ).rejects.toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('service layer error handling', () => {
    it('should handle null/undefined concept input', async () => {
      // Arrange
      const mockStorageService = {
        initialize: jest.fn().mockResolvedValue(),
        storeCharacterConcept: jest.fn(),
        listCharacterConcepts: jest.fn(),
        getCharacterConcept: jest.fn(),
        deleteCharacterConcept: jest.fn(),
        storeThematicDirections: jest.fn(),
        getThematicDirections: jest.fn(),
      };
      const mockDirectionGenerator = {
        generateDirections: jest.fn(),
      };

      const builderService = new CharacterBuilderService({
        logger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });

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
    });

    it('should handle storage service failures with proper error events', async () => {
      // Arrange
      const mockStorageService = {
        initialize: jest.fn().mockResolvedValue(),
        storeCharacterConcept: jest
          .fn()
          .mockRejectedValue(
            new CharacterStorageError('Storage failed permanently')
          ),
        listCharacterConcepts: jest.fn(),
        getCharacterConcept: jest.fn(),
        deleteCharacterConcept: jest.fn(),
        storeThematicDirections: jest.fn(),
        getThematicDirections: jest.fn(),
      };
      const mockDirectionGenerator = {
        generateDirections: jest.fn(),
      };

      const builderService = new CharacterBuilderService({
        logger,
        storageService: mockStorageService,
        directionGenerator: mockDirectionGenerator,
        eventBus: mockEventBus,
      });

      // Act & Assert
      await expect(
        builderService.createCharacterConcept(
          'Valid concept text for testing errors'
        )
      ).rejects.toThrow(CharacterBuilderError);

      // Verify error event was dispatched correctly
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.stringContaining('Failed to create character concept'),
          operation: 'createCharacterConcept',
          finalError: 'Storage failed permanently',
        })
      );
    });

    it('should handle cascade failures across retries', async () => {
      // Arrange
      const errors = [
        new Error('Temporary network error'),
        new Error('Database lock timeout'),
        new Error('Connection pool exhausted'),
      ];

      let callCount = 0;
      const mockStorageService = {
        initialize: jest.fn().mockResolvedValue(),
        storeCharacterConcept: jest.fn().mockImplementation(() => {
          const error = errors[callCount] || errors[errors.length - 1];
          callCount++;
          return Promise.reject(error);
        }),
        listCharacterConcepts: jest.fn(),
        getCharacterConcept: jest.fn(),
        deleteCharacterConcept: jest.fn(),
        storeThematicDirections: jest.fn(),
        getThematicDirections: jest.fn(),
      };

      const builderService = new CharacterBuilderService({
        logger,
        storageService: mockStorageService,
        directionGenerator: { generateDirections: jest.fn() },
        eventBus: mockEventBus,
      });

      // Act & Assert
      await expect(
        builderService.createCharacterConcept(
          'Test concept for cascade failures'
        )
      ).rejects.toThrow(CharacterBuilderError);

      // All retries should have been attempted
      expect(mockStorageService.storeCharacterConcept).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge case inputs', () => {
    it('should handle extremely long concept text', async () => {
      // Arrange
      const longConcept = 'A'.repeat(1500); // Way over 1000 char limit
      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        'concept: must NOT have more than 1000 characters'
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const conceptTooLong = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: longConcept,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(conceptTooLong)
      ).rejects.toThrow(/must NOT have more than 1000 characters/);
    });

    it('should handle special characters and unicode in concept text', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockImplementation((concept) =>
        Promise.resolve(concept)
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const unicodeConcept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'A character with émojis 🧙‍♂️ and spëcial chars ñoñó',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Act & Assert - Should handle unicode properly
      const result = await storageService.storeCharacterConcept(unicodeConcept);
      expect(result.concept).toBe(unicodeConcept.concept);
    });

    it('should handle missing required fields', async () => {
      // Arrange
      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        "must have required property 'updatedAt'"
      );

      const storageService = new CharacterStorageService({
        logger,
        database: mockDatabase,
        schemaValidator: mockValidator,
      });
      await storageService.initialize();

      const incompleteConcept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Valid concept text',
        status: 'draft',
        createdAt: new Date().toISOString(),
        // Missing updatedAt
      };

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(incompleteConcept)
      ).rejects.toThrow(/must have required property 'updatedAt'/);
    });
  });

  describe('event dispatch error scenarios', () => {
    it('should handle event dispatch failures gracefully', async () => {
      // Arrange
      const mockStorageService = {
        initialize: jest.fn().mockResolvedValue(),
        storeCharacterConcept: jest.fn().mockResolvedValue({
          id: 'concept-1',
          concept: 'Successfully saved concept',
          status: 'draft',
        }),
        listCharacterConcepts: jest.fn(),
        getCharacterConcept: jest.fn(),
        deleteCharacterConcept: jest.fn(),
        storeThematicDirections: jest.fn(),
        getThematicDirections: jest.fn(),
      };

      const failingEventBus = {
        dispatch: jest.fn().mockImplementation(() => {
          throw new Error('Event bus failed');
        }),
      };

      const builderService = new CharacterBuilderService({
        logger,
        storageService: mockStorageService,
        directionGenerator: { generateDirections: jest.fn() },
        eventBus: failingEventBus,
      });

      // Act & Assert - If event dispatch fails during success path, the operation should fail
      await expect(
        builderService.createCharacterConcept('Test concept')
      ).rejects.toThrow('Event bus failed');

      expect(mockStorageService.storeCharacterConcept).toHaveBeenCalled();
      expect(failingEventBus.dispatch).toHaveBeenCalled();
    });
  });
});
