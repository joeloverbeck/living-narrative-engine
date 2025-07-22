/**
 * @file Unit tests for CharacterStorageService schema validation with correct IDs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { CharacterStorageError } from '../../../src/characterBuilder/services/characterStorageService.js';

describe('CharacterStorageService - Schema Validation', () => {
  let service;
  let mockDatabase;
  let mockValidator;
  let logger;

  beforeEach(async () => {
    // Create real logger for testing
    logger = new ConsoleLogger('error');

    // Mock database
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

    // Mock schema validator
    mockValidator = {
      validateAgainstSchema: jest.fn(),
      formatAjvErrors: jest.fn(),
      isSchemaLoaded: jest.fn(),
    };

    service = new CharacterStorageService({
      logger,
      database: mockDatabase,
      schemaValidator: mockValidator,
    });

    // Initialize the service
    await service.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeCharacterConcept', () => {
    it('should validate concept against correct schema ID', async () => {
      // Arrange
      const concept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'A brave warrior with a mysterious past',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(concept);

      // Act
      await service.storeCharacterConcept(concept);

      // Assert
      expect(mockValidator.validateAgainstSchema).toHaveBeenCalledWith(
        concept,
        'character-concept' // Should use simplified ID, not full URI
      );
    });

    it('should throw error when schema validation fails', async () => {
      // Arrange
      const concept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Too short', // Less than 10 characters
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        'concept: must be at least 10 characters'
      );

      // Act & Assert
      await expect(service.storeCharacterConcept(concept)).rejects.toThrow(
        CharacterStorageError
      );
      await expect(service.storeCharacterConcept(concept)).rejects.toThrow(
        'Character concept validation failed: concept: must be at least 10 characters'
      );
    });

    it('should not retry on validation errors', async () => {
      // Arrange
      const concept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'Invalid concept',
        status: 'invalid-status', // Not in enum
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockValidator.validateAgainstSchema.mockReturnValue(false);
      mockValidator.formatAjvErrors.mockReturnValue(
        'status: must be equal to one of the allowed values'
      );

      // Act & Assert
      await expect(service.storeCharacterConcept(concept)).rejects.toThrow(
        CharacterStorageError
      );

      // Should only try once for validation errors
      expect(mockValidator.validateAgainstSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('storeThematicDirections', () => {
    it('should validate each direction against correct schema ID', async () => {
      // Arrange
      const conceptId = '123e4567-e89b-12d3-a456-426614174000';
      const directions = [
        {
          id: 'dir-1',
          conceptId,
          theme: 'Adventure',
          description: 'A journey into the unknown',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dir-2',
          conceptId,
          theme: 'Mystery',
          description: 'Uncovering hidden truths',
          createdAt: new Date().toISOString(),
        },
      ];

      mockValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveThematicDirections.mockResolvedValue(directions);

      // Act
      await service.storeThematicDirections(conceptId, directions);

      // Assert
      expect(mockValidator.validateAgainstSchema).toHaveBeenCalledTimes(2);
      expect(mockValidator.validateAgainstSchema).toHaveBeenNthCalledWith(
        1,
        directions[0],
        'thematic-direction' // Should use simplified ID
      );
      expect(mockValidator.validateAgainstSchema).toHaveBeenNthCalledWith(
        2,
        directions[1],
        'thematic-direction' // Should use simplified ID
      );
    });

    it('should throw error when any direction validation fails', async () => {
      // Arrange
      const conceptId = '123e4567-e89b-12d3-a456-426614174000';
      const directions = [
        {
          id: 'dir-1',
          conceptId,
          theme: 'Adventure',
          description: 'Valid description',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'dir-2',
          conceptId,
          theme: '', // Empty theme
          description: 'Description without theme',
          createdAt: new Date().toISOString(),
        },
      ];

      // First validation passes, second fails
      mockValidator.validateAgainstSchema
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      mockValidator.formatAjvErrors.mockReturnValue('theme: must not be empty');

      // Act & Assert
      await expect(
        service.storeThematicDirections(conceptId, directions)
      ).rejects.toThrow(CharacterStorageError);
      await expect(
        service.storeThematicDirections(conceptId, directions)
      ).rejects.toThrow(
        'Thematic direction validation failed: theme: must not be empty'
      );
    });

    it('should handle empty directions array', async () => {
      // Arrange
      const conceptId = '123e4567-e89b-12d3-a456-426614174000';
      const directions = [];

      // Act
      const result = await service.storeThematicDirections(
        conceptId,
        directions
      );

      // Assert
      expect(result).toEqual([]);
      expect(mockValidator.validateAgainstSchema).not.toHaveBeenCalled();
      expect(mockDatabase.saveThematicDirections).not.toHaveBeenCalled();
    });
  });

  describe('schema ID consistency', () => {
    it('should consistently use simplified schema IDs', async () => {
      // Arrange
      const concept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept: 'A character concept for testing schema IDs',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thematicDirections: [
          {
            id: 'dir-1',
            theme: 'Test Theme',
            description: 'Test description',
          },
        ],
      };

      mockValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(concept);

      // Act
      await service.storeCharacterConcept(concept);

      // Assert - should NOT use full URI like 'schema://living-narrative-engine/character-concept.schema.json'
      expect(mockValidator.validateAgainstSchema).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('schema://')
      );
      expect(mockValidator.validateAgainstSchema).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('.schema.json')
      );

      // Should use simplified IDs
      expect(mockValidator.validateAgainstSchema).toHaveBeenCalledWith(
        concept,
        'character-concept'
      );
    });
  });
});
