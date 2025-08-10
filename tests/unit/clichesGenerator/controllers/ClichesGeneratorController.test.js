/**
 * @file Unit tests for ClichesGeneratorController
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../../common/clichesGeneratorControllerTestBed.js';

describe('ClichesGeneratorController', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ClichesGeneratorControllerTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(testBed.controller).toBeDefined();
      expect(testBed.controller.constructor.name).toBe(
        'ClichesGeneratorController'
      );
    });

    it('should load directions on initialization', async () => {
      // Arrange
      const { directions } = testBed.setupSuccessfulDirectionLoad();

      // Act
      await testBed.controller.initialize();

      // Assert
      expect(
        testBed.mockCharacterBuilderService.getAllThematicDirections
      ).toHaveBeenCalled();
      const selector = testBed.getDirectionSelector();
      expect(selector.children.length).toBeGreaterThan(1);
    });

    it('should handle empty directions list gracefully', async () => {
      // Arrange
      testBed.mockCharacterBuilderService.getAllThematicDirections.mockResolvedValue(
        []
      );

      // Act
      await testBed.controller.initialize();

      // Assert
      expect(
        testBed.mockCharacterBuilderService.getAllThematicDirections
      ).toHaveBeenCalled();
      const selector = testBed.getDirectionSelector();
      expect(selector.children.length).toBe(1); // Only default option
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const error = new Error('Service unavailable');
      testBed.mockCharacterBuilderService.getAllThematicDirections.mockRejectedValue(
        error
      );

      // Act
      await testBed.controller.initialize();

      // Assert
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load initial data'),
        error
      );
    });
  });

  describe('Direction Selection', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
    });

    it('should handle direction selection without existing clichés', async () => {
      // Arrange
      const directionId = 'dir-1';
      const concept = testBed.createMockConcept();

      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      // Act
      await testBed.selectDirection(directionId);

      // Assert
      expect(
        testBed.mockCharacterBuilderService.hasClichesForDirection
      ).toHaveBeenCalledWith(directionId);

      const generateBtn = testBed.getGenerateButton();
      expect(generateBtn.disabled).toBe(false);
      expect(generateBtn.textContent).toBe('Generate Clichés');

      const directionDisplay = testBed.getDirectionDisplay();
      expect(directionDisplay.style.display).toBe('block');
    });

    it('should handle direction selection with existing clichés', async () => {
      // Arrange
      const directionId = 'dir-1';
      const concept = testBed.createMockConcept();
      const cliches = testBed.setupExistingCliches();

      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );

      // Act
      await testBed.selectDirection(directionId);

      // Assert
      expect(
        testBed.mockCharacterBuilderService.getClichesByDirectionId
      ).toHaveBeenCalledWith(directionId);

      const generateBtn = testBed.getGenerateButton();
      expect(generateBtn.disabled).toBe(true);
      expect(generateBtn.textContent).toBe('Clichés Already Generated');

      const clichesContainer = testBed.getClichesContainer();
      expect(clichesContainer.classList.contains('has-content')).toBe(true);
    });

    it('should clear selection when empty value selected', async () => {
      // Arrange
      const concept = testBed.createMockConcept();
      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      // First select a direction
      await testBed.selectDirection('dir-1');

      // Act - select empty value
      await testBed.selectDirection('');

      // Assert
      const directionDisplay = testBed.getDirectionDisplay();
      expect(directionDisplay.style.display).toBe('none');

      const conceptDisplay = testBed.getConceptDisplay();
      expect(conceptDisplay.style.display).toBe('none');

      const generateBtn = testBed.getGenerateButton();
      expect(generateBtn.disabled).toBe(true);
    });

    it('should handle direction selection errors', async () => {
      // Arrange
      // First setup directions so findDirectionById works
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
      
      // Then mock an error after the direction is found  
      const error = new Error('Failed to load concept');
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockRejectedValue(
        error
      );

      // Act
      await testBed.selectDirection('dir-1');

      // Assert
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to handle direction selection'),
        error
      );
    });
  });

  describe('Cliché Generation', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();

      const concept = testBed.createMockConcept();
      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      await testBed.selectDirection('dir-1');
    });

    it('should generate clichés successfully', async () => {
      // Arrange
      const cliches = testBed.setupSuccessfulClicheGeneration();

      // Act
      await testBed.triggerGeneration();

      // Assert
      expect(
        testBed.mockCharacterBuilderService.generateClichesForDirection
      ).toHaveBeenCalled();

      const clichesContainer = testBed.getClichesContainer();
      expect(clichesContainer.classList.contains('has-content')).toBe(true);

      const generateBtn = testBed.getGenerateButton();
      expect(generateBtn.disabled).toBe(true);
      expect(generateBtn.textContent).toBe('Clichés Generated');
    });

    it('should handle generation errors gracefully', async () => {
      // Arrange
      const error = new Error('LLM service unavailable');
      testBed.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
        error
      );

      // Act
      await testBed.triggerGeneration();

      // Assert
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate clichés'),
        error
      );

      const generateBtn = testBed.getGenerateButton();
      expect(generateBtn.textContent).toBe('Retry Generation');
      expect(generateBtn.disabled).toBe(false);
    });

    it('should not generate if already generating', async () => {
      // Arrange
      const cliches = testBed.setupSuccessfulClicheGeneration();

      // Make generation take time
      testBed.mockCharacterBuilderService.generateClichesForDirection.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(cliches), 100))
      );

      // Act - trigger generation twice quickly
      const promise1 = testBed.triggerGeneration();
      const promise2 = testBed.triggerGeneration();

      await Promise.all([promise1, promise2]);

      // Assert - should only call once
      expect(
        testBed.mockCharacterBuilderService.generateClichesForDirection
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cliché Display', () => {
    it('should display clichés with categories correctly', async () => {
      // Arrange
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();

      const concept = testBed.createMockConcept();
      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );

      const cliches = testBed.setupExistingCliches();

      // Act
      await testBed.selectDirection('dir-1');

      // Assert
      const clichesContainer = testBed.getClichesContainer();
      const categories = clichesContainer.querySelectorAll('.cliche-category');
      expect(categories.length).toBeGreaterThan(0);

      const tropesSection = clichesContainer.querySelector('.tropes-section');
      expect(tropesSection).toBeTruthy();

      const metadata = clichesContainer.querySelector('.cliche-metadata');
      expect(metadata).toBeTruthy();
    });

    it('should show empty state when no direction selected', () => {
      // Arrange & Act - Initial state
      const clichesContainer = testBed.getClichesContainer();

      // Assert
      expect(clichesContainer.classList.contains('empty-state')).toBe(true);
      expect(clichesContainer.textContent).toContain(
        'Select a thematic direction'
      );
    });

    it('should format category display data correctly', async () => {
      // Arrange
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();

      const concept = testBed.createMockConcept();
      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );

      const cliches = testBed.createMockClichesData();
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );
      testBed.mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
        cliches
      );

      // Act
      await testBed.selectDirection('dir-1');

      // Assert
      const clichesContainer = testBed.getClichesContainer();

      // Check for specific category
      const namesCategory = Array.from(
        clichesContainer.querySelectorAll('.cliche-category')
      ).find((el) => el.textContent.includes('Common Names'));
      expect(namesCategory).toBeTruthy();

      // Check for cliché items
      const clicheItems = clichesContainer.querySelectorAll('.cliche-item');
      expect(clicheItems.length).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should subscribe to cliché generation events', async () => {
      // Arrange & Act
      await testBed.controller.initialize();

      // Assert
      expect(testBed.mockEventBus.subscribe).toHaveBeenCalledWith(
        'CLICHES_GENERATION_STARTED',
        expect.any(Function)
      );
      expect(testBed.mockEventBus.subscribe).toHaveBeenCalledWith(
        'CLICHES_GENERATION_COMPLETED',
        expect.any(Function)
      );
      expect(testBed.mockEventBus.subscribe).toHaveBeenCalledWith(
        'CLICHES_GENERATION_FAILED',
        expect.any(Function)
      );
    });

  });

  describe('Cleanup', () => {
    it('should clean up resources properly', async () => {
      // Arrange
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();

      // Select a direction to populate state
      const concept = testBed.createMockConcept();
      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        concept
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );
      await testBed.selectDirection('dir-1');

      // Act
      await testBed.controller.cleanup();

      // Assert - verify state is cleared
      const directionSelector = testBed.getDirectionSelector();
      expect(directionSelector.value).toBe('');

      const generateBtn = testBed.getGenerateButton();
      expect(generateBtn.disabled).toBe(true);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      await testBed.controller.initialize();

      // Force an error in parent cleanup
      const originalCleanup = Object.getPrototypeOf(
        Object.getPrototypeOf(testBed.controller)
      ).cleanup;
      Object.getPrototypeOf(Object.getPrototypeOf(testBed.controller)).cleanup =
        jest.fn().mockRejectedValue(new Error('Cleanup failed'));

      // Act & Assert - should not throw
      await expect(testBed.controller.cleanup()).resolves.not.toThrow();

      // Restore
      Object.getPrototypeOf(Object.getPrototypeOf(testBed.controller)).cleanup =
        originalCleanup;
    });
  });

  describe('Helper Methods', () => {
    it('should extract concept title correctly', async () => {
      // Arrange
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();

      const longConcept = testBed.createMockConcept();
      longConcept.text =
        'This is a very long concept text that should be truncated because it exceeds the maximum length allowed for display purposes.';

      testBed.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
        longConcept
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );

      // Act
      await testBed.selectDirection('dir-1');

      // Assert
      const selector = testBed.getDirectionSelector();
      const optgroups = selector.querySelectorAll('optgroup');
      expect(optgroups.length).toBeGreaterThan(0);

      // Check that long titles are truncated
      const longTitle = Array.from(optgroups).find((og) =>
        og.label.includes('...')
      );
      if (longTitle) {
        expect(longTitle.label.length).toBeLessThanOrEqual(50);
      }
    });

    it('should validate required elements on cache', async () => {
      // Arrange
      // Remove a required element
      const generateBtn = document.getElementById('generate-btn');
      generateBtn.remove();

      // Act
      await testBed.controller.initialize();

      // Assert
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Required element missing: Generate button')
      );
    });
  });
});
