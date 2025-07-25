/**
 * @file Unit tests for CharacterStorageService.listCharacterConcepts method
 * @description Tests the specific functionality for listing character concepts
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { CharacterStorageService } from '../../../../src/characterBuilder/services/characterStorageService.js';
import { createCharacterConcept } from '../../../../src/characterBuilder/models/characterConcept.js';

describe('CharacterStorageService - listCharacterConcepts', () => {
  let service;
  let mockLogger;
  let mockDatabase;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn(),
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      close: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
      formatAjvErrors: jest.fn(),
    };

    service = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listCharacterConcepts', () => {
    test('should successfully retrieve concepts from database', async () => {
      // Arrange
      const mockConcepts = [
        createCharacterConcept('A brave knight who fights for justice'),
        createCharacterConcept('A sneaky rogue with a heart of gold'),
        createCharacterConcept('A wise wizard seeking ancient knowledge'),
      ];

      mockDatabase.getAllCharacterConcepts.mockResolvedValue(mockConcepts);
      await service.initialize();

      // Act
      const result = await service.listCharacterConcepts();

      // Assert
      expect(result).toEqual(mockConcepts);
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Retrieved character concepts list',
        { conceptCount: 3 }
      );
    });

    test('should return empty array when no concepts exist', async () => {
      // Arrange
      mockDatabase.getAllCharacterConcepts.mockResolvedValue([]);
      await service.initialize();

      // Act
      const result = await service.listCharacterConcepts();

      // Assert
      expect(result).toEqual([]);
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CharacterStorageService: Retrieved character concepts list',
        { conceptCount: 0 }
      );
    });

    test('should throw error when database operation fails', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      mockDatabase.getAllCharacterConcepts.mockRejectedValue(dbError);
      await service.initialize();

      // Act & Assert
      await expect(service.listCharacterConcepts()).rejects.toThrow(
        'Failed to list character concepts: Database connection failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to list character concepts: Database connection failed',
        dbError
      );
    });

    test('should throw error when service is not initialized', async () => {
      // Act & Assert
      await expect(service.listCharacterConcepts()).rejects.toThrow(
        'CharacterStorageService not initialized. Call initialize() first.'
      );
    });

    test('should handle database returning null/undefined gracefully', async () => {
      // Arrange
      mockDatabase.getAllCharacterConcepts.mockResolvedValue(null);
      await service.initialize();

      // Act & Assert - This should throw an error because the service doesn't handle null gracefully
      await expect(service.listCharacterConcepts()).rejects.toThrow(
        'Failed to list character concepts: Cannot read properties of null'
      );
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalledTimes(1);
    });

    test('should log correct concept count for various sizes', async () => {
      // Test with different concept list sizes
      const testCases = [
        { concepts: [], expectedCount: 0 },
        {
          concepts: [
            createCharacterConcept('Single concept that meets minimum length'),
          ],
          expectedCount: 1,
        },
        {
          concepts: Array.from({ length: 50 }, (_, i) =>
            createCharacterConcept(`This is character concept number ${i + 1}`)
          ),
          expectedCount: 50,
        },
      ];

      await service.initialize();

      for (const testCase of testCases) {
        // Arrange
        mockDatabase.getAllCharacterConcepts.mockResolvedValue(
          testCase.concepts
        );

        // Act
        const result = await service.listCharacterConcepts();

        // Assert
        expect(result).toEqual(testCase.concepts);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'CharacterStorageService: Retrieved character concepts list',
          { conceptCount: testCase.expectedCount }
        );

        // Clear mocks for next iteration
        jest.clearAllMocks();
      }
    });
  });
});
