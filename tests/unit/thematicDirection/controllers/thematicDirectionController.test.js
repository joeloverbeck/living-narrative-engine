/**
 * @file Unit tests for ThematicDirectionController
 * @description Test coverage for the migrated thematic direction generator controller
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';

describe('ThematicDirectionController', () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();

  beforeEach(async () => {
    await testBase.setup();

    // Mock scrollIntoView which doesn't exist in jsdom
    Element.prototype.scrollIntoView = jest.fn();

    // Custom DOM setup for thematic direction controller
    document.body.innerHTML = `
      <form id="concept-form">
        <select id="concept-selector">
          <option value="">Select a concept</option>
        </select>
        <div id="concept-selector-error"></div>
        <button id="generate-btn" type="button" disabled>Generate Directions</button>
      </form>
      
      <div id="selected-concept-display" style="display: none;">
        <div id="concept-content"></div>
        <div id="concept-directions-count">0</div>
        <div id="concept-created-date"></div>
      </div>
      
      <div id="empty-state">Select concept to begin</div>
      <div id="loading-state" style="display: none;">
        <div class="spinner"></div>
        Loading...
      </div>
      <div id="results-state" style="display: none;">
        <div id="generated-directions">
          <div id="directions-list"></div>
        </div>
        <div id="directions-results"></div>
      </div>
      <div id="error-state" style="display: none;">
        <div id="error-message-text" class="error-message-text"></div>
        <button id="retry-btn">Try Again</button>
      </div>
    `;

    testBase.controller = new ThematicDirectionController(
      testBase.mockDependencies
    );
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Initialization', () => {
    it('should load character concepts on init', async () => {
      // Create concepts with explicit creation dates to ensure order
      const now = new Date();
      const mockConcepts = [
        testBase.buildCharacterConcept({
          id: '1',
          concept: 'Concept 1',
          createdAt: new Date(now.getTime() - 1000).toISOString(), // Older
        }),
        testBase.buildCharacterConcept({
          id: '2',
          concept: 'Concept 2',
          createdAt: now.toISOString(), // Newer
        }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      expect(selector.options.length).toBe(3); // Empty option + 2 concepts
      // Concepts are sorted by creation date (newest first)
      expect(selector.options[1].value).toBe('2'); // Newer concept first
      expect(selector.options[1].text).toContain('Concept 2');
      expect(selector.options[2].value).toBe('1'); // Older concept second
      expect(selector.options[2].text).toContain('Concept 1');
    });

    it('should handle concept loading failure', async () => {
      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        new Error('Load failed')
      );

      // Initialize should throw after handling the error
      await expect(testBase.controller.initialize()).rejects.toThrow(
        'Load failed'
      );

      // Verify the service was called
      expect(
        testBase.mockDependencies.characterBuilderService
          .getAllCharacterConcepts
      ).toHaveBeenCalled();
    });
  });

  describe('Concept Selection', () => {
    beforeEach(async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({
          id: '123',
          concept: 'A brave knight',
          thematicDirections: [],
        }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await testBase.controller.initialize();
    });

    it('should enable generate button when concept selected', () => {
      const selector = document.getElementById('concept-selector');
      const generateBtn = document.getElementById('generate-btn');

      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      expect(generateBtn.disabled).toBe(false);
    });

    it('should display selected concept details', () => {
      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      const conceptContent = document.getElementById('concept-content');
      expect(conceptContent.textContent).toContain('A brave knight');
    });
  });

  describe('Direction Generation', () => {
    beforeEach(async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await testBase.controller.initialize();

      // Select concept
      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      // Wait for DOM updates
      await testBase.wait(10);
    });

    it('should generate directions successfully', async () => {
      const mockDirections = [
        testBase.buildThematicDirection({
          title: 'Epic Quest',
          description: 'A journey of discovery',
          themes: ['adventure', 'growth'],
        }),
      ];

      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      // Click generate
      testBase.click('#generate-btn');

      // Wait for async operation
      await testBase.wait(100);

      // Check if the method was called at all
      expect(
        testBase.mockDependencies.characterBuilderService
          .generateThematicDirections
      ).toHaveBeenCalled();

      // If it was called, check the results were displayed
      if (
        testBase.mockDependencies.characterBuilderService
          .generateThematicDirections.mock.calls.length > 0
      ) {
        testBase.assertUIState('results');
      } else {
        // The method wasn't called, so the click handler didn't run properly
        throw new Error('generateThematicDirections was not called');
      }

      // The controller now uses directionsResults as the container
      const directionsResults = document.getElementById('directions-results');

      expect(directionsResults).toBeTruthy();
      expect(directionsResults.innerHTML).toContain('Epic Quest');
      expect(directionsResults.innerHTML).toContain('A journey of discovery');
      expect(directionsResults.innerHTML).toContain('adventure');
    });

    it('should handle generation failure with retry', async () => {
      let attempts = 0;
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockImplementation(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Network error');
          }
          return [testBase.buildThematicDirection()];
        }
      );

      // Click generate
      testBase.click('#generate-btn');

      // Wait for retries - need to account for retry delays
      await testBase.wait(4000);

      expect(attempts).toBe(3);
      testBase.assertUIState('results');
    });
  });

  describe('Error Handling', () => {
    it('should show error when no concept selected', async () => {
      await testBase.controller.initialize();

      // Try to generate without selection
      testBase.click('#generate-btn');

      const errorElement = document.getElementById('concept-selector-error');
      expect(errorElement.textContent).toContain(
        'Please select a character concept first'
      );
    });

    it('should handle retry button', async () => {
      await testBase.controller.initialize();

      // Show error state
      testBase.controller._showError('Test error');

      // Click retry
      testBase.click('#retry-btn');

      testBase.assertUIState('empty');
    });
  });
});
