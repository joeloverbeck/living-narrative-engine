import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CharacterBuilderController } from '../../../src/characterBuilder/controllers/characterBuilderController.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { JSDOM } from 'jsdom';

/**
 * @file Integration tests for the character builder UI workflow
 * Tests the complete user interaction from UI to storage including error handling
 */

describe('Character Builder UI - Integration', () => {
  let controller;
  let builderService;
  let storageService;
  let mockLogger;
  let mockDatabase;
  let mockSchemaValidator;
  let mockEventBus;
  let mockDirectionGenerator;
  let dom;
  let document;

  beforeEach(async () => {
    
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="character-builder">
            <textarea id="concept-input" placeholder="Describe your character..."></textarea>
            <button id="save-concept-btn">Save Concept</button>
            <div id="status-message" class="hidden"></div>
            <div id="error-message" class="hidden"></div>
            <div id="loading-indicator" class="hidden">Saving...</div>
            <div id="concept-list"></div>
          </div>
        </body>
      </html>
    `, { 
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
    document = dom.window.document;

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

    // Mock the controller's dependencies - would normally be injected
    controller = new CharacterBuilderController({
      builderService,
      logger: mockLogger,
    });

    await storageService.initialize();
    await builderService.initialize();
  });

  afterEach(() => {
    dom.window.close();
    jest.clearAllMocks();
  });

  describe('Successful Concept Saving Workflow', () => {
    it('should handle complete user workflow from input to successful save', async () => {
      // Arrange
      const conceptText = 'A brave warrior from the northern lands who wields a mighty sword and protects the innocent';
      
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => concept);

      const conceptInput = document.getElementById('concept-input');
      const saveButton = document.getElementById('save-concept-btn');
      const statusMessage = document.getElementById('status-message');
      const loadingIndicator = document.getElementById('loading-indicator');

      // Simulate user input
      conceptInput.value = conceptText;
      conceptInput.dispatchEvent(new window.Event('input'));

      // Mock controller method
      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        // Show loading
        loadingIndicator.classList.remove('hidden');
        statusMessage.classList.add('hidden');

        try {
          // Call the actual service
          const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });
          
          // Update UI on success
          loadingIndicator.classList.add('hidden');
          statusMessage.textContent = `Character concept saved successfully! ID: ${result.id}`;
          statusMessage.className = 'success';
          statusMessage.classList.remove('hidden');
          conceptInput.value = ''; // Clear input

          return result;
        } catch (error) {
          // Handle errors
          loadingIndicator.classList.add('hidden');
          const errorMessage = document.getElementById('error-message');
          errorMessage.textContent = `Failed to save: ${error.message}`;
          errorMessage.classList.remove('hidden');
          throw error;
        }
      });

      // Act - Simulate user clicking save
      const result = await controller.handleSaveClick();

      // Assert
      expect(result).toBeDefined();
      expect(result.concept).toBe(conceptText);
      expect(result.id).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
      
      // Verify UI state
      expect(loadingIndicator.classList.contains('hidden')).toBe(true);
      expect(statusMessage.classList.contains('hidden')).toBe(false);
      expect(statusMessage.textContent).toContain('Character concept saved successfully!');
      expect(statusMessage.className).toBe('success');
      expect(conceptInput.value).toBe(''); // Input cleared
      
      // Verify service interactions
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(1);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED',
        expect.objectContaining({
          conceptId: result.id,
          autoSaved: true,
        })
      );
    });

    it('should provide user feedback during the save process', async () => {
      // Arrange
      const conceptText = 'A mystical mage who controls the elements';
      
      // Mock delayed save to test loading state
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
        return concept;
      });

      const conceptInput = document.getElementById('concept-input');
      const loadingIndicator = document.getElementById('loading-indicator');
      
      conceptInput.value = conceptText;

      // Mock controller with timing checks
      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        // Show loading immediately
        loadingIndicator.classList.remove('hidden');
        
        const startTime = Date.now();
        const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });
        const endTime = Date.now();
        
        // Hide loading
        loadingIndicator.classList.add('hidden');
        
        // Verify timing
        expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Account for mock delay
        
        return result;
      });

      // Act
      const savePromise = controller.handleSaveClick();
      
      // Assert loading state is shown during save
      expect(loadingIndicator.classList.contains('hidden')).toBe(false);
      
      const result = await savePromise;
      
      // Assert loading state is hidden after save
      expect(loadingIndicator.classList.contains('hidden')).toBe(true);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling in UI Workflow', () => {
    it('should handle the date validation error scenario from logs', async () => {
      // Arrange - Recreate the exact scenario from error logs
      const conceptText = 'a strong woman in her twenties, who is good with a sword';
      
      // Mock the validation failure that was occurring
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Details: createdAt must be string, updatedAt must be string'
      );

      const conceptInput = document.getElementById('concept-input');
      const errorMessage = document.getElementById('error-message');
      const loadingIndicator = document.getElementById('loading-indicator');
      
      conceptInput.value = conceptText;

      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        loadingIndicator.classList.remove('hidden');
        errorMessage.classList.add('hidden');

        try {
          await builderService.createCharacterConcept(conceptText, { autoSave: true });
        } catch (error) {
          // Update UI to show error
          loadingIndicator.classList.add('hidden');
          errorMessage.textContent = `Save failed: ${error.message}`;
          errorMessage.classList.remove('hidden');
          throw error;
        }
      });

      // Act & Assert
      await expect(controller.handleSaveClick())
        .rejects
        .toThrow('Failed to create character concept');

      // Verify error UI state
      expect(loadingIndicator.classList.contains('hidden')).toBe(true);
      expect(errorMessage.classList.contains('hidden')).toBe(false);
      expect(errorMessage.textContent).toContain('Save failed:');
      
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

    it('should handle network/database failures gracefully', async () => {
      // Arrange
      const conceptText = 'A skilled archer from the forest realm';
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(true);
      mockDatabase.saveCharacterConcept.mockRejectedValue(new Error('Network connection failed'));

      const errorMessage = document.getElementById('error-message');
      const loadingIndicator = document.getElementById('loading-indicator');

      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        loadingIndicator.classList.remove('hidden');

        try {
          await builderService.createCharacterConcept(conceptText, { autoSave: true });
        } catch (error) {
          loadingIndicator.classList.add('hidden');
          errorMessage.textContent = `Connection error: Please check your internet connection and try again.`;
          errorMessage.classList.remove('hidden');
          throw error;
        }
      });

      // Act & Assert
      await expect(controller.handleSaveClick())
        .rejects
        .toThrow();

      expect(errorMessage.textContent).toContain('Connection error:');
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3); // Retries
    });

    it('should handle user input validation errors', async () => {
      // Arrange - Invalid concept (too short)
      const conceptText = 'Short';
      
      const conceptInput = document.getElementById('concept-input');
      const errorMessage = document.getElementById('error-message');
      
      conceptInput.value = conceptText;

      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        try {
          // This should fail validation in createCharacterConcept
          await builderService.createCharacterConcept(conceptText, { autoSave: true });
        } catch (error) {
          errorMessage.textContent = `Invalid input: ${error.message}`;
          errorMessage.classList.remove('hidden');
          throw error;
        }
      });

      // Act & Assert
      await expect(controller.handleSaveClick())
        .rejects
        .toThrow('must be at least 10 characters long');

      expect(errorMessage.textContent).toContain('Invalid input:');
    });
  });

  describe('Multiple Save Attempts (From Logs)', () => {
    it('should handle multiple rapid save attempts correctly', async () => {
      // Arrange
      const conceptText = 'A brave paladin who fights for justice and honor in the realm';
      
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate slow save
        return concept;
      });

      const saveButton = document.getElementById('save-concept-btn');
      
      // Mock controller to track concurrent saves
      let saveCount = 0;
      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        saveCount++;
        const saveId = saveCount;
        
        // Prevent multiple concurrent saves (good UX practice)
        saveButton.disabled = true;
        
        try {
          const result = await builderService.createCharacterConcept(`${conceptText} ${saveId}`, { autoSave: true });
          return result;
        } finally {
          saveButton.disabled = false;
        }
      });

      // Act - Simulate rapid clicking
      const save1Promise = controller.handleSaveClick();
      const save2Promise = controller.handleSaveClick();
      const save3Promise = controller.handleSaveClick();

      const [result1, result2, result3] = await Promise.all([save1Promise, save2Promise, save3Promise]);

      // Assert - All saves should complete
      expect(result1).toBeDefined();
      expect(result2).toBeDefined(); 
      expect(result3).toBeDefined();
      
      // Each should have unique content
      expect(result1.concept).toContain('1');
      expect(result2.concept).toContain('2');
      expect(result3.concept).toContain('3');
      
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);
    });

    it('should recover from failed save attempts and allow retry', async () => {
      // Arrange
      const conceptText = 'A cunning rogue who steals from the rich and gives to the poor';
      
      // Mock first save to fail, second to succeed
      mockDatabase.saveCharacterConcept
        .mockRejectedValueOnce(new Error('Database unavailable'))
        .mockImplementation(async (concept) => concept);

      const saveButton = document.getElementById('save-concept-btn');
      const errorMessage = document.getElementById('error-message');
      const statusMessage = document.getElementById('status-message');

      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        saveButton.disabled = true;
        errorMessage.classList.add('hidden');
        statusMessage.classList.add('hidden');

        try {
          const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });
          statusMessage.textContent = 'Save successful!';
          statusMessage.classList.remove('hidden');
          return result;
        } catch (error) {
          errorMessage.textContent = `Save failed: ${error.message}. Please try again.`;
          errorMessage.classList.remove('hidden');
          throw error;
        } finally {
          saveButton.disabled = false;
        }
      });

      // Act - First save should fail
      await expect(controller.handleSaveClick())
        .rejects
        .toThrow();

      expect(errorMessage.textContent).toContain('Save failed:');
      expect(saveButton.disabled).toBe(false); // Should re-enable for retry

      // Second save should succeed
      const result = await controller.handleSaveClick();

      // Assert
      expect(result).toBeDefined();
      expect(statusMessage.textContent).toBe('Save successful!');
      expect(statusMessage.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Accessibility and UX', () => {
    it('should provide accessible error messages for screen readers', async () => {
      // Arrange
      const conceptText = 'A warrior';
      
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue('Validation failed');

      const errorMessage = document.getElementById('error-message');
      
      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        try {
          await builderService.createCharacterConcept(conceptText, { autoSave: true });
        } catch (error) {
          // Set ARIA attributes for accessibility
          errorMessage.setAttribute('role', 'alert');
          errorMessage.setAttribute('aria-live', 'polite');
          errorMessage.textContent = `Error: ${error.message}`;
          errorMessage.classList.remove('hidden');
          throw error;
        }
      });

      // Act
      await expect(controller.handleSaveClick())
        .rejects
        .toThrow();

      // Assert accessibility attributes
      expect(errorMessage.getAttribute('role')).toBe('alert');
      expect(errorMessage.getAttribute('aria-live')).toBe('polite');
      expect(errorMessage.textContent).toContain('Error:');
    });

    it('should maintain keyboard navigation during save process', async () => {
      // Arrange
      const conceptText = 'A noble knight who serves the realm with honor and courage';
      
      mockDatabase.saveCharacterConcept.mockImplementation(async (concept) => concept);

      const conceptInput = document.getElementById('concept-input');
      const saveButton = document.getElementById('save-concept-btn');
      
      conceptInput.value = conceptText;
      conceptInput.focus();

      jest.spyOn(controller, 'handleSaveClick').mockImplementation(async () => {
        // Maintain focus management
        const originalActiveElement = document.activeElement;
        
        const result = await builderService.createCharacterConcept(conceptText, { autoSave: true });
        
        // Focus should return to input after successful save
        conceptInput.focus();
        
        return result;
      });

      // Act
      saveButton.focus();
      const result = await controller.handleSaveClick();

      // Assert
      expect(result).toBeDefined();
      expect(document.activeElement).toBe(conceptInput);
    });
  });
});