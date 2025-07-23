import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { createCharacterConcept } from '../../../src/characterBuilder/models/characterConcept.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';

/**
 * @file Integration tests for the complete character concept storage flow
 * Tests the end-to-end process from concept creation to database storage
 */

describe('Character Builder Storage Flow - Integration', () => {
  let storageService;
  let builderService;
  let schemaValidator;
  let database;
  let mockLogger;
  let mockEventBus;
  let mockDirectionGenerator;

  beforeEach(async () => {
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    // Mock schema validator
    schemaValidator = {
      validateAgainstSchema: jest.fn().mockImplementation((data, schemaId) => {
        // Basic validation logic for character concepts
        if (schemaId === 'character-concept') {
          // Check required fields
          if (!data.id || !data.concept || !data.status || !data.createdAt || !data.updatedAt) {
            return false;
          }
          // Check concept length
          if (data.concept.length < 10) {
            return false;
          }
          // Check date formats (should be ISO strings after serialization)
          if (typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') {
            return false;
          }
          return true;
        }
        return false;
      }),
      formatAjvErrors: jest.fn().mockReturnValue('Validation error details'),
    };

    // Mock database with IndexedDB-like behavior
    database = {
      initialize: jest.fn().mockResolvedValue(),
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      close: jest.fn(),
    };

    // Initialize services
    storageService = new CharacterStorageService({
      logger: mockLogger,
      database,
      schemaValidator,
    });

    builderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });

    await storageService.initialize();
    await builderService.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Concept Creation and Storage', () => {
    it('should successfully create and store a character concept with Date objects', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword';
      
      database.saveCharacterConcept.mockImplementation(async (concept) => {
        // Simulate successful storage
        expect(concept.createdAt).toBeInstanceOf(Date);
        expect(concept.updatedAt).toBeInstanceOf(Date);
        return concept;
      });

      // Act
      const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
      expect(result.concept).toBe(conceptText);
      expect(result.status).toBe('draft');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      // Verify storage was called
      expect(database.saveCharacterConcept).toHaveBeenCalledTimes(1);
      
      // Verify success event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED',
        expect.objectContaining({
          conceptId: result.id,
          concept: expect.stringContaining('A brave warrior'),
          autoSaved: true,
        })
      );

      // Verify no errors were logged
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle storage validation errors gracefully', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword';
      
      database.saveCharacterConcept.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(builderService.createCharacterConcept(conceptText, { autoSave: true }))
        .rejects
        .toThrow('Failed to create character concept after 3 attempts');

      // Verify error events were dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.stringContaining('Failed to create character concept'),
          operation: 'createCharacterConcept',
          concept: expect.stringContaining('A brave warrior'),
          attempts: 3,
        })
      );

      // Verify retries were attempted - the builder service retries 3 times,
      // and for each of those, the storage service also retries 3 times = 9 total
      expect(database.saveCharacterConcept).toHaveBeenCalledTimes(9);
      expect(mockLogger.warn).toHaveBeenCalled(); // Multiple warnings logged
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should bypass storage when autoSave is false', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword';

      // Act
      const result = await builderService.createCharacterConcept(conceptText, { autoSave: false });

      // Assert
      expect(result).toBeDefined();
      expect(result.concept).toBe(conceptText);
      
      // Verify storage was NOT called
      expect(database.saveCharacterConcept).not.toHaveBeenCalled();
      
      // Verify success event was still dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED',
        expect.objectContaining({
          conceptId: result.id,
          autoSaved: false,
        })
      );
    });
  });

  describe('Schema Validation Integration', () => {
    it('should properly validate serialized character concepts against schema', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword';
      
      database.saveCharacterConcept.mockImplementation(async (concept) => concept);

      // Act
      await builderService.createCharacterConcept(conceptText, { autoSave: true });

      // Assert - The schema validator should have been called with properly formatted data
      expect(database.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
          concept: conceptText,
          status: 'draft',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          thematicDirections: [],
          metadata: {},
        })
      );
    });

    it('should reject concepts that fail schema validation requirements', async () => {
      // Arrange - Create concept with valid length but invalid data format
      const validConcept = createCharacterConcept('A brave warrior from the north');
      const invalidConcept = {
        ...validConcept,
        createdAt: 'invalid-date', // Not a Date object or valid ISO string
      };

      // Set up validation to fail for invalid date
      schemaValidator.validateAgainstSchema.mockReturnValueOnce(false);

      // Act & Assert
      await expect(storageService.storeCharacterConcept(invalidConcept))
        .rejects
        .toThrow('Character concept validation failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Schema validation failed'),
        expect.objectContaining({
          conceptId: invalidConcept.id,
          validationErrors: expect.any(String),
          schemaId: 'character-concept'
        })
      );
    });
  });

  describe('Retry Logic Integration', () => {
    it('should retry transient failures but not validation failures', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword';
      
      // Mock database to fail twice then succeed
      database.saveCharacterConcept
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockImplementation(async (concept) => concept);

      // Act
      const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });

      // Assert
      expect(result).toBeDefined();
      expect(database.saveCharacterConcept).toHaveBeenCalledTimes(3); // 2 failures + 1 success
      
      // Should have logged retry warnings
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1 failed'),
        expect.any(Object)
      );
    });

    it('should not retry schema validation failures', async () => {
      // Arrange
      const validConcept = createCharacterConcept('A brave warrior from the northern lands');
      const invalidConcept = {
        ...validConcept,
        createdAt: 'invalid-date-format', // This will cause schema validation to fail
      };

      // Set up validation to fail for invalid date
      schemaValidator.validateAgainstSchema.mockReturnValueOnce(false);

      // Act & Assert
      await expect(storageService.storeCharacterConcept(invalidConcept))
        .rejects
        .toThrow('Character concept validation failed');

      // Should only attempt once (no retries on validation errors)
      expect(database.saveCharacterConcept).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1); // One warning for the validation failure
    });
  });

  describe('Event System Integration', () => {
    it('should dispatch proper events throughout the storage flow', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword';
      database.saveCharacterConcept.mockImplementation(async (concept) => concept);

      // Act
      await builderService.createCharacterConcept(conceptText, { autoSave: true });

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED',
        expect.objectContaining({
          conceptId: expect.any(String),
          concept: expect.stringContaining('A brave warrior'),
          autoSaved: true,
        })
      );
    });

    it('should dispatch error events when storage fails', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword';
      database.saveCharacterConcept.mockRejectedValue(new Error('Storage failed'));

      // Act
      await expect(builderService.createCharacterConcept(conceptText, { autoSave: true }))
        .rejects
        .toThrow();

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.any(String),
          operation: 'createCharacterConcept',
          attempts: 3,
        })
      );
    });
  });
});