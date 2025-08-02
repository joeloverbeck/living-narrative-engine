/**
 * @file Unit tests for ThematicDirectionController element caching
 * @description Test coverage for element caching issues and HTML structure compatibility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';

describe('ThematicDirectionController - Element Caching', () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();

  beforeEach(async () => {
    await testBase.setup();

    // Mock scrollIntoView which doesn't exist in jsdom
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Element Caching Errors', () => {
    it('should not log errors for missing optional elements', async () => {
      // Set up HTML that matches the actual thematic-direction-generator.html structure
      // but missing the elements that the controller expects
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
        <div id="loading-state" style="display: none;">Loading...</div>
        <div id="results-state" style="display: none;">
          <div id="directions-results"></div>
        </div>
        <div id="error-state" style="display: none;">
          <div id="error-message-text"></div>
          <button id="retry-btn">Try Again</button>
        </div>
      `;

      // Note: The HTML above is missing these elements that the controller expects:
      // - #generated-directions (controller expects this instead of #directions-container)
      // - #directions-list
      // - #generated-concept
      // - #concept-text
      // - #character-count
      // - #timestamp

      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );

      // Mock the service to return empty concepts
      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // Initialize - the controller should work without errors now that elements are optional
      await testBase.controller.initialize();

      // Check that no errors were logged since the missing elements are now optional
      expect(testBase.mockDependencies.logger.error).not.toHaveBeenCalled();

      // Verify that the controller initialized successfully
      expect(
        testBase.mockDependencies.characterBuilderService
          .getAllCharacterConcepts
      ).toHaveBeenCalled();
    });

    it('should successfully initialize when all required elements are present', async () => {
      // Set up HTML with all the elements the controller expects
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
        <div id="loading-state" style="display: none;">Loading...</div>
        <div id="results-state" style="display: none;">
          <div id="generated-directions">
            <div id="directions-list"></div>
          </div>
          <div id="directions-results"></div>
          <div id="generated-concept"></div>
          <div id="concept-text"></div>
          <div id="character-count"></div>
          <div id="timestamp"></div>
        </div>
        <div id="error-state" style="display: none;">
          <div id="error-message-text"></div>
          <button id="retry-btn">Try Again</button>
        </div>
      `;

      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );

      // Mock the service to return empty concepts
      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // This should now succeed
      await testBase.controller.initialize();

      // Verify no errors were logged
      expect(testBase.mockDependencies.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Display Results with Missing Elements', () => {
    it('should handle missing display elements gracefully', async () => {
      // Set up minimal HTML without the display elements
      document.body.innerHTML = `
        <form id="concept-form">
          <select id="concept-selector">
            <option value="">Select a concept</option>
          </select>
          <div id="concept-selector-error"></div>
          <button id="generate-btn" type="button">Generate Directions</button>
        </form>
        
        <div id="selected-concept-display">
          <div id="concept-content"></div>
          <div id="concept-directions-count">0</div>
          <div id="concept-created-date"></div>
        </div>
        
        <div id="empty-state" style="display: block;">Empty</div>
        <div id="loading-state" style="display: none;">Loading...</div>
        <div id="results-state" style="display: none;">
          <div id="directions-results"></div>
        </div>
        <div id="error-state" style="display: none;">
          <div id="error-message-text"></div>
          <button id="retry-btn">Try Again</button>
        </div>
      `;

      // Create controller with optional elements configuration
      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );

      // Mock successful concept loading
      const mockConcept = testBase.buildCharacterConcept({
        id: 'test-1',
        concept: 'Test concept',
      });

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        [mockConcept]
      );

      // Initialize should work even without the display elements if they're optional
      await testBase.controller.initialize();

      // Select the concept
      const selector = document.getElementById('concept-selector');
      selector.value = 'test-1';
      selector.dispatchEvent(new Event('change'));

      // Mock successful direction generation
      const mockDirections = [
        {
          title: 'Direction 1',
          description: 'Test direction',
          themes: ['theme1'],
          tone: 'dramatic',
          coreTension: 'conflict',
          uniqueTwist: 'twist',
          narrativePotential: 'high',
        },
      ];

      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      // Click generate button
      const generateBtn = document.getElementById('generate-btn');
      generateBtn.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that results are displayed in the available container
      const resultsContainer = document.getElementById('directions-results');
      expect(resultsContainer.innerHTML).toContain('Direction 1');
      expect(resultsContainer.innerHTML).toContain('Test direction');
    });
  });
});
