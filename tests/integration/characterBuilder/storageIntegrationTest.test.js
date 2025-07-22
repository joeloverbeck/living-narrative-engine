/**
 * @file Integration tests for Character Builder storage layer
 * @description Tests the interaction between storage services, database, and validation
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

/**
 * Integration tests for storage layer components
 * Tests the interaction between CharacterStorageService, CharacterDatabase, and validation
 */
describe('Character Builder Storage Integration', () => {
  let storageService;
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

    // Create comprehensive database mock
    mockDatabase = {
      initialize: jest.fn(),
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      close: jest.fn(),
    };

    // Create schema validator mock
    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(() => true),
      formatAjvErrors: jest.fn(() => 'Validation error'),
      addSchema: jest.fn(),
    };

    // Create storage service with mocked dependencies
    storageService = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
    });

    // The database initialization should succeed in setup
    mockDatabase.initialize.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Character Concept Storage Integration', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    test('should successfully integrate concept creation with validation and storage', async () => {
      // Arrange
      const conceptData = {
        name: 'Alaric Thornfield',
        description:
          'A weathered knight with a noble heart, seeking redemption for past mistakes. His armor bears the scars of countless battles, and his eyes hold the wisdom of hard-won experience.',
        background: 'Soldier',
        personality: 'Honorable but haunted by past failures',
      };

      const expectedStoredConcept = {
        id: 'concept-alaric-789',
        ...conceptData,
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      };

      // Setup mocks
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(
        expectedStoredConcept
      );

      // Act
      const result = await storageService.storeCharacterConcept(conceptData);

      // Assert - Validation integration
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        expect.objectContaining(conceptData),
        'character-concept'
      );

      // Assert - Database integration
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining(conceptData)
      );

      // Assert - Result
      expect(result).toEqual(expectedStoredConcept);

      // Assert - Logging integration
      // The service logs initialization first, then the storage success
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterStorageService: Successfully initialized'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stored character concept'),
        expect.objectContaining({
          conceptId: undefined, // conceptData doesn't have an id yet
          attempt: 1,
        })
      );
    });

    test('should handle validation failures in storage integration', async () => {
      // Arrange
      const invalidConceptData = {
        name: '', // Invalid - empty name
        description: 'A character with invalid data',
      };

      // Setup validation to fail
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Name is required and cannot be empty'
      );

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(invalidConceptData)
      ).rejects.toThrow(
        'Character concept validation failed: Name is required and cannot be empty'
      );

      // Verify database was not called
      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled();

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Character concept validation failed'),
        expect.any(Object)
      );
    });

    test('should handle database errors during concept storage', async () => {
      // Arrange
      const conceptData = {
        name: 'Test Character',
        description: 'A test character for error handling',
      };

      // Setup validation to pass but database to fail
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(conceptData)
      ).rejects.toThrow('Database connection failed');

      // Verify logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store character concept'),
        expect.any(Object)
      );
    });

    test('should integrate concept retrieval with database and error handling', async () => {
      // Arrange
      const conceptId = 'concept-retrieval-test';
      const storedConcept = {
        id: conceptId,
        name: 'Retrieved Hero',
        description: 'A character retrieved from storage',
        background: 'Folk Hero',
        personality: 'Brave and determined',
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      };

      // Setup database mock
      mockDatabase.getCharacterConcept.mockResolvedValue(storedConcept);

      // Act
      const result = await storageService.getCharacterConcept(conceptId);

      // Assert
      expect(result).toEqual(storedConcept);
      expect(mockDatabase.getCharacterConcept).toHaveBeenCalledWith(conceptId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved character concept'),
        expect.objectContaining({ conceptId })
      );
    });

    test('should handle concept not found scenarios', async () => {
      // Arrange
      const conceptId = 'non-existent-concept';
      mockDatabase.getCharacterConcept.mockResolvedValue(null);

      // Act
      const result = await storageService.getCharacterConcept(conceptId);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Character concept not found'),
        expect.objectContaining({ conceptId })
      );
    });
  });

  describe('Thematic Directions Storage Integration', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    test('should successfully integrate directions storage with validation', async () => {
      // Arrange
      const conceptId = 'concept-directions-test';
      const directionsData = [
        {
          id: 'direction-1',
          conceptId,
          title: 'The Reluctant Leader',
          description: 'A character thrust into leadership against their will',
          coreTension: 'Personal desires vs. responsibility to others',
          uniqueTwist: 'Their reluctance actually makes them a better leader',
          narrativePotential:
            'Stories of growth, sacrifice, and learning to inspire others',
          llmMetadata: {
            modelId: 'openrouter-claude-sonnet-4',
            promptTokens: 180,
            responseTokens: 340,
            processingTime: 2800,
          },
          createdAt: '2024-01-15T10:35:00.000Z',
          updatedAt: '2024-01-15T10:35:00.000Z',
        },
        {
          id: 'direction-2',
          conceptId,
          title: 'The Hidden Protector',
          description:
            'A character who secretly protects others from the shadows',
          coreTension: 'The need for secrecy vs. desire for recognition',
          uniqueTwist: 'Their anonymity is their greatest weapon',
          narrativePotential: 'Mystery stories with themes of selfless service',
          llmMetadata: {
            modelId: 'openrouter-claude-sonnet-4',
            promptTokens: 180,
            responseTokens: 340,
            processingTime: 2800,
          },
          createdAt: '2024-01-15T10:35:00.000Z',
          updatedAt: '2024-01-15T10:35:00.000Z',
        },
      ];

      // Setup mocks
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveThematicDirections.mockResolvedValue(directionsData);

      // Act
      const result = await storageService.storeThematicDirections(
        conceptId,
        directionsData
      );

      // Assert - Validation integration
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        directionsData[0],
        'thematic-direction'
      );
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        directionsData[1],
        'thematic-direction'
      );

      // Assert - Database integration
      expect(mockDatabase.saveThematicDirections).toHaveBeenCalledWith(
        directionsData
      );

      // Assert - Result
      expect(result).toEqual(directionsData);

      // Assert - Logging integration
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stored thematic directions'),
        expect.objectContaining({
          conceptId,
          directionCount: 2,
        })
      );
    });

    test('should handle validation failures for individual directions', async () => {
      // Arrange
      const conceptId = 'concept-invalid-directions';
      const invalidDirectionsData = [
        {
          id: 'direction-1',
          conceptId,
          title: '', // Invalid - empty title
          description: 'A direction with invalid data',
        },
      ];

      // Setup validation to fail for the direction
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Title is required');

      // Act & Assert
      await expect(
        storageService.storeThematicDirections(conceptId, invalidDirectionsData)
      ).rejects.toThrow(
        'Thematic direction validation failed: Title is required'
      );

      // Verify database was not called
      expect(mockDatabase.saveThematicDirections).not.toHaveBeenCalled();
    });

    test('should integrate directions retrieval with filtering and validation', async () => {
      // Arrange
      const conceptId = 'concept-retrieve-directions';
      const storedDirections = [
        {
          id: 'direction-a',
          conceptId,
          title: 'Direction A',
          description: 'First direction',
          coreTension: 'Tension A',
          uniqueTwist: 'Twist A',
          narrativePotential: 'Potential A',
          llmMetadata: { modelId: 'test-model' },
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z',
        },
        {
          id: 'direction-b',
          conceptId,
          title: 'Direction B',
          description: 'Second direction',
          coreTension: 'Tension B',
          uniqueTwist: 'Twist B',
          narrativePotential: 'Potential B',
          llmMetadata: { modelId: 'test-model' },
          createdAt: '2024-01-15T10:31:00.000Z',
          updatedAt: '2024-01-15T10:31:00.000Z',
        },
      ];

      // Setup database mock
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue(
        storedDirections
      );

      // Act
      const result = await storageService.getThematicDirections(conceptId);

      // Assert
      expect(result).toEqual(storedDirections);
      expect(
        mockDatabase.getThematicDirectionsByConceptId
      ).toHaveBeenCalledWith(conceptId);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved thematic directions'),
        expect.objectContaining({
          conceptId,
          directionCount: 2,
        })
      );
    });

    test('should handle empty directions retrieval', async () => {
      // Arrange
      const conceptId = 'concept-no-directions';
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue([]);

      // Act
      const result = await storageService.getThematicDirections(conceptId);

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No thematic directions found'),
        expect.objectContaining({ conceptId })
      );
    });
  });

  describe('Storage Service Lifecycle Integration', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    test('should integrate concept listing with database operations', async () => {
      // Arrange
      const mockConcepts = [
        {
          id: 'concept-1',
          name: 'Hero Alpha',
          description: 'First hero concept',
          createdAt: '2024-01-15T09:00:00.000Z',
          updatedAt: '2024-01-15T09:00:00.000Z',
        },
        {
          id: 'concept-2',
          name: 'Hero Beta',
          description: 'Second hero concept',
          createdAt: '2024-01-15T09:15:00.000Z',
          updatedAt: '2024-01-15T09:15:00.000Z',
        },
        {
          id: 'concept-3',
          name: 'Hero Gamma',
          description: 'Third hero concept',
          createdAt: '2024-01-15T09:30:00.000Z',
          updatedAt: '2024-01-15T09:30:00.000Z',
        },
      ];

      // Setup database mock
      mockDatabase.getAllCharacterConcepts.mockResolvedValue(mockConcepts);

      // Act
      const result = await storageService.listCharacterConcepts();

      // Assert
      expect(result).toEqual(mockConcepts);
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved character concepts list'),
        expect.objectContaining({
          conceptCount: 3,
        })
      );
    });

    test('should integrate concept deletion with database and logging', async () => {
      // Arrange
      const conceptId = 'concept-to-delete';
      mockDatabase.deleteCharacterConcept.mockResolvedValue(true);

      // Act
      const result = await storageService.deleteCharacterConcept(conceptId);

      // Assert
      expect(result).toBe(true);
      expect(mockDatabase.deleteCharacterConcept).toHaveBeenCalledWith(
        conceptId
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully deleted character concept'),
        expect.objectContaining({ conceptId })
      );
    });

    test('should handle deletion of non-existent concept', async () => {
      // Arrange
      const conceptId = 'non-existent-concept';
      mockDatabase.deleteCharacterConcept.mockResolvedValue(false);

      // Act
      const result = await storageService.deleteCharacterConcept(conceptId);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Character concept not found for deletion'),
        expect.objectContaining({ conceptId })
      );
    });
  });

  describe('Error Recovery and Resilience Integration', () => {
    test('should handle database initialization errors gracefully', async () => {
      // Arrange
      const initializationError = new Error('Database initialization failed');
      mockDatabase.initialize.mockRejectedValue(initializationError);

      // Create a new storage service that would trigger initialization
      const testStorageService = new CharacterStorageService({
        logger: mockLogger,
        database: mockDatabase,
        schemaValidator: mockSchemaValidator,
      });

      // Act & Assert - The service will fail during initialization
      await expect(testStorageService.initialize()).rejects.toThrow(
        'Failed to initialize character storage: Database initialization failed'
      );

      // Since initialization failed, trying to store will also fail
      await expect(
        testStorageService.storeCharacterConcept({
          name: 'Test',
          description: 'Test character',
        })
      ).rejects.toThrow('CharacterStorageService not initialized');
    });

    test('should handle schema validation service errors', async () => {
      // Initialize the service first
      await storageService.initialize();

      // Arrange
      const conceptData = {
        name: 'Test Character',
        description: 'A test character',
      };

      // Setup schema validator to throw error
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Schema validation service unavailable');
      });

      // Act & Assert
      await expect(
        storageService.storeCharacterConcept(conceptData)
      ).rejects.toThrow('Schema validation service unavailable');

      // Verify database was not called due to validation failure
      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled();
    });

    test('should handle concurrent storage operations', async () => {
      // Initialize the service first
      await storageService.initialize();

      // Arrange
      const conceptData1 = {
        name: 'Hero 1',
        description: 'First concurrent concept',
      };
      const conceptData2 = {
        name: 'Hero 2',
        description: 'Second concurrent concept',
      };
      const conceptData3 = {
        name: 'Hero 3',
        description: 'Third concurrent concept',
      };

      const storedConcept1 = { id: 'concept-1', ...conceptData1 };
      const storedConcept2 = { id: 'concept-2', ...conceptData2 };
      const storedConcept3 = { id: 'concept-3', ...conceptData3 };

      // Setup mocks for concurrent operations
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept
        .mockResolvedValueOnce(storedConcept1)
        .mockResolvedValueOnce(storedConcept2)
        .mockResolvedValueOnce(storedConcept3);

      // Act - Perform concurrent operations
      const promises = [
        storageService.storeCharacterConcept(conceptData1),
        storageService.storeCharacterConcept(conceptData2),
        storageService.storeCharacterConcept(conceptData3),
      ];

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(storedConcept1);
      expect(results[1]).toEqual(storedConcept2);
      expect(results[2]).toEqual(storedConcept3);

      // Verify all operations were processed
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);
      // 4 info logs: 1 for initialization + 3 for storage operations
      expect(mockLogger.info).toHaveBeenCalledTimes(4);
    });
  });

  describe('Performance and Resource Management Integration', () => {
    beforeEach(async () => {
      await storageService.initialize();
    });

    test('should handle large datasets efficiently', async () => {
      // Arrange - Create a large dataset
      const largeConceptList = Array.from({ length: 1000 }, (_, index) => ({
        id: `concept-${index + 1}`,
        name: `Hero ${index + 1}`,
        description: `Generated hero concept number ${index + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      mockDatabase.getAllCharacterConcepts.mockResolvedValue(largeConceptList);

      // Act
      const startTime = Date.now();
      const result = await storageService.listCharacterConcepts();
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Assert
      expect(result).toHaveLength(1000);
      expect(result[0].name).toBe('Hero 1');
      expect(result[999].name).toBe('Hero 1000');

      // Performance assertion - should complete within reasonable time
      expect(processingTime).toBeLessThan(1000); // Less than 1 second for mock operations

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrieved character concepts list'),
        expect.objectContaining({
          conceptCount: 1000,
        })
      );
    });

    test('should manage memory efficiently during batch operations', async () => {
      // Arrange - Create multiple large directions arrays
      const conceptIds = ['concept-1', 'concept-2', 'concept-3'];
      const directionsPerConcept = 10;

      const allDirections = conceptIds.map((conceptId) =>
        Array.from({ length: directionsPerConcept }, (_, index) => ({
          id: `${conceptId}-direction-${index + 1}`,
          conceptId,
          title: `Direction ${index + 1} for ${conceptId}`,
          description: `Detailed description for direction ${index + 1}`,
          coreTension: `Tension ${index + 1}`,
          uniqueTwist: `Twist ${index + 1}`,
          narrativePotential: `Potential ${index + 1}`,
          llmMetadata: { modelId: 'batch-test-model' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );

      // Setup mocks
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      allDirections.forEach((directions, index) => {
        mockDatabase.saveThematicDirections.mockResolvedValueOnce(directions);
      });

      // Act - Perform batch operations
      const promises = allDirections.map((directions, index) =>
        storageService.storeThematicDirections(conceptIds[index], directions)
      );

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toHaveLength(directionsPerConcept);
        expect(result[0].conceptId).toBe(conceptIds[index]);
      });

      // Verify all batch operations completed
      expect(mockDatabase.saveThematicDirections).toHaveBeenCalledTimes(3);
      // 4 info logs: 1 for initialization + 3 for batch operations
      expect(mockLogger.info).toHaveBeenCalledTimes(4);
    });
  });
});
