import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';

/**
 * @file Unit tests for CharacterStorageService date validation scenarios
 * Tests the critical date serialization and validation flow that was causing failures
 */

describe('CharacterStorageService - Date Validation', () => {
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

    storageService = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Date Serialization Before Validation', () => {
    it('should serialize Date objects to ISO strings before schema validation', async () => {
      // Arrange
      await storageService.initialize();
      
      const concept = createCharacterConcept('A brave warrior from the northern lands');
      expect(concept.createdAt).toBeInstanceOf(Date);
      expect(concept.updatedAt).toBeInstanceOf(Date);

      // Mock successful validation and storage
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(concept);

      // Act
      await storageService.storeCharacterConcept(concept);

      // Assert - Verification that serialized data was passed to validator
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledTimes(1);
      
      const [validatedData, schemaId] = mockSchemaValidator.validateAgainstSchema.mock.calls[0];
      expect(schemaId).toBe('character-concept');
      expect(typeof validatedData.createdAt).toBe('string');
      expect(typeof validatedData.updatedAt).toBe('string');
      expect(validatedData.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(validatedData.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle concepts with already serialized date strings', async () => {
      // Arrange
      await storageService.initialize();
      
      const isoString = new Date().toISOString();
      const concept = {
        id: '12345678-1234-1234-1234-123456789012',
        concept: 'A brave warrior from the northern lands',
        status: 'draft',
        createdAt: isoString, // Already a string
        updatedAt: isoString,
        thematicDirections: [],
        metadata: {},
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(concept);

      // Act
      await storageService.storeCharacterConcept(concept);

      // Assert
      const [validatedData] = mockSchemaValidator.validateAgainstSchema.mock.calls[0];
      expect(validatedData.createdAt).toBe(isoString);
      expect(validatedData.updatedAt).toBe(isoString);
    });

    it('should preserve original concept data when storing to database', async () => {
      // Arrange
      await storageService.initialize();
      
      const concept = createCharacterConcept('A brave warrior from the northern lands');
      const originalCreatedAt = concept.createdAt;
      const originalUpdatedAt = concept.updatedAt;

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(concept);

      // Act
      await storageService.storeCharacterConcept(concept);

      // Assert - Original concept should still have Date objects
      expect(concept.createdAt).toBeInstanceOf(Date);
      expect(concept.updatedAt).toBeInstanceOf(Date);
      expect(concept.createdAt).toBe(originalCreatedAt);
      expect(concept.updatedAt).toBe(originalUpdatedAt);
      
      // But database should receive original concept (not serialized)
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(concept);
    });
  });

  describe('Date Validation Error Scenarios', () => {
    it('should provide detailed error information when date validation fails', async () => {
      // Arrange
      await storageService.initialize();
      
      const concept = createCharacterConcept('A brave warrior from the northern lands');
      const mockAjvErrors = 'createdAt: must be string, updatedAt: must be string';
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(mockAjvErrors);

      // Act & Assert
      await expect(storageService.storeCharacterConcept(concept))
        .rejects
        .toThrow(`Character concept validation failed: ${mockAjvErrors}`);

      // Verify detailed error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        `CharacterStorageService: Schema validation failed for concept ${concept.id}`,
        expect.objectContaining({
          conceptId: concept.id,
          validationErrors: mockAjvErrors,
          originalData: concept,
          serializedData: expect.objectContaining({
            createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
            updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          }),
          schemaId: 'character-concept'
        })
      );
    });

    it('should handle cases where formatAjvErrors returns empty or null', async () => {
      // Arrange
      await storageService.initialize();
      
      const concept = createCharacterConcept('A brave warrior from the northern lands');
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(''); // Empty error message

      // Act & Assert
      await expect(storageService.storeCharacterConcept(concept))
        .rejects
        .toThrow('Character concept validation failed: Schema validation failed without specific details');
    });

    it('should not retry validation failures', async () => {
      // Arrange
      await storageService.initialize();
      
      const concept = createCharacterConcept('A brave warrior from the northern lands');
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue('validation failed error');

      // Act & Assert
      await expect(storageService.storeCharacterConcept(concept))
        .rejects
        .toThrow('Character concept validation failed: validation failed error');

      // Verify only one attempt was made (no retries on validation errors)
      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledTimes(1);
      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled(); // Never reach database
    });
  });

  describe('Date Format Edge Cases', () => {
    it('should handle concepts with null date values', async () => {
      // Arrange
      await storageService.initialize();
      
      const concept = {
        id: '12345678-1234-1234-1234-123456789012',
        concept: 'A brave warrior from the northern lands',
        status: 'draft',
        createdAt: null,
        updatedAt: null,
        thematicDirections: [],
        metadata: {},
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(concept);

      // Act
      await storageService.storeCharacterConcept(concept);

      // Assert - serializeCharacterConcept should handle null dates gracefully
      const [validatedData] = mockSchemaValidator.validateAgainstSchema.mock.calls[0];
      expect(validatedData.createdAt).toBeNull();
      expect(validatedData.updatedAt).toBeNull();
    });

    it('should handle concepts with invalid Date objects', async () => {
      // Arrange
      await storageService.initialize();
      
      const invalidDate = new Date('invalid-date');
      const concept = {
        id: '12345678-1234-1234-1234-123456789012',
        concept: 'A brave warrior from the northern lands',
        status: 'draft',
        createdAt: invalidDate,
        updatedAt: invalidDate,
        thematicDirections: [],
        metadata: {},
      };

      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockResolvedValue(concept);

      // Act
      await storageService.storeCharacterConcept(concept);

      // Assert - Invalid dates should remain as the original invalid Date objects (not converted)
      const [validatedData] = mockSchemaValidator.validateAgainstSchema.mock.calls[0];
      expect(validatedData.createdAt).toBe(invalidDate); // Kept as original invalid Date
      expect(validatedData.updatedAt).toBe(invalidDate); // Kept as original invalid Date
    });
  });
});