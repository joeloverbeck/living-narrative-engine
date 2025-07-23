import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';

/**
 * @file Integration tests for the character builder service integration
 * Tests the integration between CharacterBuilderService, CharacterStorageService, and related components
 */

describe('Character Builder Service Integration', () => {
  let builderService;
  let storageService;
  let mockLogger;
  let mockDatabase;
  let mockSchemaValidator;
  let mockEventBus;
  let mockDirectionGenerator;

  beforeEach(async () => {

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
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      close: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
      formatAjvErrors: jest.fn().mockReturnValue(''),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    // Initialize services
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

    await storageService.initialize();
    await builderService.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Concept Saving Workflow', () => {
    it('should handle complete service workflow from concept creation to storage', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword and protects the innocent';
      
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => concept);
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);

      // Act - Create and save concept through service
      const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });

      // Assert - Check that the concept was created
      expect(result).toBeDefined();
      expect(result.concept).toBe(conceptText);
      expect(result.status).toBe('draft');
      expect(result.id).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
      
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(1);
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: conceptText,
          status: 'draft',
        })
      );
      
      // Verify event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED',
        expect.objectContaining({
          concept: expect.stringContaining('A brave warrior'),
          autoSaved: true,
        })
      );
    });

    it('should handle asynchronous save operations correctly', async () => {
      // Arrange
      const conceptText = 'A mystical mage who controls the elements';
      
      // Mock delayed save to test async behavior
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
        return concept;
      });
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);

      // Act - Create concept
      const startTime = Date.now();
      const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });
      const endTime = Date.now();
      
      // Assert
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeGreaterThanOrEqual(40); // Account for mock delay
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(1);
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: conceptText,
        })
      );
    });
  });

  describe('Error Handling in Service Integration', () => {
    it('should handle validation errors correctly', async () => {
      // Arrange - Recreate the exact scenario from error logs
      const conceptText = 'a strong woman in her twenties, who is good with a sword';
      
      // Mock the validation failure that was occurring
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Details: createdAt must be string, updatedAt must be string'
      );

      // Act & Assert
      await expect(builderService.createCharacterConcept(conceptText, { autoSave: true }))
        .rejects
        .toThrow('Failed to create character concept');
      
      // Verify error event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.stringContaining('Failed to create character concept'),
          operation: 'createCharacterConcept',
          concept: conceptText.substring(0, 100),
          attempts: 3,
        })
      );
    });

    it('should handle network/database failures gracefully with retries', async () => {
      // Arrange
      const conceptText = 'A skilled archer from the forest realm';
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockRejectedValue(new Error('Network connection failed'));

      // Act & Assert
      await expect(builderService.createCharacterConcept(conceptText, { autoSave: true }))
        .rejects
        .toThrow('Failed to create character concept after 3 attempts');

      // Assert - Builder service retries 3 times, storage service retries 3 times per builder attempt = 9 total
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(9);
      expect(mockLogger.warn).toHaveBeenCalled(); // Multiple warnings logged
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle input validation errors', async () => {
      // Arrange - Invalid concept (too short)
      const conceptText = 'Short';
      
      // Act & Assert
      await expect(builderService.createCharacterConcept(conceptText, { autoSave: true }))
        .rejects
        .toThrow('CharacterConcept: concept must be at least 10 characters long');

      // Should not attempt to save (validation fails early)
      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create character concept'),
        expect.any(Object)
      );
    });
  });

  describe('Concurrent Operations Handling', () => {
    it('should handle multiple concurrent save operations', async () => {
      // Arrange
      const conceptText = 'A brave paladin who fights for justice and honor in the realm';
      
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate slow save
        return concept;
      });
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);

      // Act - Simulate concurrent saves
      const save1Promise = builderService.createCharacterConcept(conceptText + ' 1', { autoSave: true });
      const save2Promise = builderService.createCharacterConcept(conceptText + ' 2', { autoSave: true });
      const save3Promise = builderService.createCharacterConcept(conceptText + ' 3', { autoSave: true });

      const [result1, result2, result3] = await Promise.all([save1Promise, save2Promise, save3Promise]);

      // Assert - All saves should complete successfully
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
      
      expect(result1.concept).toContain('1');
      expect(result2.concept).toContain('2');
      expect(result3.concept).toContain('3');
      
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);
    });

    it('should recover from transient failures', async () => {
      // Arrange
      const conceptText = 'A cunning rogue who steals from the rich and gives to the poor';
      
      // Mock transient failures that eventually succeed
      mockDatabase.saveCharacterConcept
        .mockRejectedValueOnce(new Error('Database temporarily unavailable'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockImplementation(async (concept) => concept);
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);

      // Act - Should retry and eventually succeed
      const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });

      // Assert
      expect(result).toBeDefined();
      expect(result.concept).toBe(conceptText);
      
      // Should have attempted 3 times (2 failures + 1 success)
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // 2 retries
    });
  });

  describe('Service Event Dispatching', () => {
    it('should dispatch appropriate events for different scenarios', async () => {
      // Arrange
      const validConcept = 'A noble warrior who protects the innocent and fights for justice';
      const invalidConcept = 'A warrior'; // Too short
      
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => concept);
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);

      // Act - Test valid concept
      await builderService.createCharacterConcept(validConcept, { autoSave: true });

      // Assert - Success event dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED',
        expect.objectContaining({
          concept: expect.stringContaining('noble warrior'),
          autoSaved: true,
        })
      );

      // Reset for next test
      mockEventBus.dispatch.mockClear();

      // Act - Test invalid concept
      await expect(builderService.createCharacterConcept(invalidConcept, { autoSave: true }))
        .rejects
        .toThrow();

      // Assert - Error event dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.any(Object)
      );
    });

    it('should integrate with storage service for persistence', async () => {
      // Arrange
      const conceptText = 'A noble knight who serves the realm with honor and courage';
      
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => concept);
      mockDatabase.getCharacterConcept.mockImplementation(async (id) => ({
        id,
        concept: conceptText,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);

      // Act - Save the concept
      const savedConcept = await builderService.createCharacterConcept(conceptText, { autoSave: true });
      
      // Verify it can be retrieved
      const retrievedConcept = await storageService.getCharacterConcept(savedConcept.id);

      // Assert
      expect(savedConcept.id).toBe(retrievedConcept.id);
      expect(savedConcept.concept).toBe(retrievedConcept.concept);
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(1);
      expect(mockDatabase.getCharacterConcept).toHaveBeenCalledWith(savedConcept.id);
    });
  });
});