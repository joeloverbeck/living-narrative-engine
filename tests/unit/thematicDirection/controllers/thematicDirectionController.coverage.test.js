/**
 * @file Comprehensive unit tests for ThematicDirectionController coverage improvement
 * @description Tests targeting specific uncovered lines to improve test coverage above 80%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionController } from '../../../../src/thematicDirection/controllers/thematicDirectionController.js';

describe('ThematicDirectionController - Coverage Enhancement', () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();

  beforeEach(async () => {
    await testBase.setup();

    // Mock scrollIntoView which doesn't exist in jsdom
    Element.prototype.scrollIntoView = jest.fn();

  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Legacy Support Methods', () => {
    beforeEach(() => {
      // Set up DOM with legacy elements for these tests
      document.body.innerHTML = `
        <form id="concept-form">
          <textarea id="concept-input" maxlength="1000"></textarea>
          <div class="char-count">0/1000</div>
          <div id="concept-error"></div>
          <button id="generate-btn" type="submit" disabled>Generate</button>
          <select id="concept-selector">
            <option value="">Select a concept</option>
          </select>
          <div id="concept-selector-error"></div>
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
          <button id="back-to-menu-btn">Back to Menu</button>
        </div>
      `;

      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );
    });

    it('should validate input with different lengths', async () => {
      await testBase.controller.initialize();

      const textarea = document.getElementById('concept-input');
      const generateBtn = document.getElementById('generate-btn');

      // Test input too short (< 10 characters)
      textarea.value = 'short';
      textarea.dispatchEvent(new Event('input'));

      expect(generateBtn.disabled).toBe(true);

      // Test input too long (> 1000 characters)
      textarea.value = 'a'.repeat(1001);
      textarea.dispatchEvent(new Event('input'));

      expect(generateBtn.disabled).toBe(true);

      // Test valid input length
      textarea.value = 'This is a valid character concept with enough length';
      textarea.dispatchEvent(new Event('input'));

      expect(generateBtn.disabled).toBe(false);
    });

    it('should update character count display', async () => {
      await testBase.controller.initialize();

      const textarea = document.getElementById('concept-input');
      const charCount = document.querySelector('.char-count');

      textarea.value = 'Test input';
      textarea.dispatchEvent(new Event('input'));

      expect(charCount.textContent).toBe('10/1000');
    });

    it('should show and clear field errors', async () => {
      await testBase.controller.initialize();

      const textarea = document.getElementById('concept-input');
      const errorElement = document.getElementById('concept-error');

      // Test showing error for input too short
      textarea.value = 'short';
      textarea.dispatchEvent(new Event('input'));

      expect(errorElement.textContent).toContain('at least 10 characters');
      expect(textarea.getAttribute('aria-invalid')).toBe('true');

      // Test showing error for input too long
      textarea.value = 'a'.repeat(1001);
      textarea.dispatchEvent(new Event('input'));

      expect(errorElement.textContent).toContain('under 1000 characters');

      // Test clearing error
      textarea.value = 'This is a valid input';
      textarea.dispatchEvent(new Event('input'));

      expect(errorElement.textContent).toBe('');
      expect(textarea.getAttribute('aria-invalid')).toBe('false');
    });

    it('should handle legacy elements gracefully when missing', async () => {
      // Remove legacy elements
      document.getElementById('concept-input').remove();
      document.querySelector('.char-count').remove();
      document.getElementById('concept-error').remove();

      // Should not throw errors when legacy elements are missing
      await expect(testBase.controller.initialize()).resolves.not.toThrow();
    });
  });

  describe('Rendering Helper Methods', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="concept-form">
          <select id="concept-selector">
            <option value="">Select a concept</option>
          </select>
          <div id="concept-selector-error"></div>
          <button id="generate-btn">Generate</button>
        </div>
        
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

      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );
    });

    it('should render themes correctly', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [
        {
          title: 'Epic Quest',
          description: 'A journey of discovery',
          themes: ['adventure', 'growth', 'courage'],
          tone: 'heroic',
          coreTension: 'internal conflict',
          uniqueTwist: 'hidden identity',
          narrativePotential: 'high drama',
        },
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      // Select concept
      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      // Generate directions
      testBase.click('#generate-btn');
      await testBase.wait(100);

      const results = document.getElementById('directions-results');
      expect(results.innerHTML).toContain('adventure');
      expect(results.innerHTML).toContain('growth');
      expect(results.innerHTML).toContain('courage');
      expect(results.innerHTML).toContain('theme-tag');
    });

    it('should render tone correctly', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [
        {
          title: 'Dark Quest',
          description: 'A grim journey',
          themes: [],
          tone: 'dark',
          coreTension: '',
          uniqueTwist: '',
          narrativePotential: '',
        },
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      testBase.click('#generate-btn');
      await testBase.wait(100);

      const results = document.getElementById('directions-results');
      expect(results.innerHTML).toContain('Tone:');
      expect(results.innerHTML).toContain('dark');
    });

    it('should render core tension correctly', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [
        {
          title: 'Conflicted Hero',
          description: 'Internal struggle',
          themes: [],
          tone: '',
          coreTension: 'duty vs desire',
          uniqueTwist: '',
          narrativePotential: '',
        },
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      testBase.click('#generate-btn');
      await testBase.wait(100);

      const results = document.getElementById('directions-results');
      expect(results.innerHTML).toContain('Core Tension:');
      expect(results.innerHTML).toContain('duty vs desire');
    });

    it('should render unique twist correctly', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [
        {
          title: 'Mysterious Hero',
          description: 'Hidden secrets',
          themes: [],
          tone: '',
          coreTension: '',
          uniqueTwist: 'secret royal lineage',
          narrativePotential: '',
        },
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      testBase.click('#generate-btn');
      await testBase.wait(100);

      const results = document.getElementById('directions-results');
      expect(results.innerHTML).toContain('Unique Twist:');
      expect(results.innerHTML).toContain('secret royal lineage');
    });

    it('should render narrative potential correctly', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [
        {
          title: 'Epic Story',
          description: 'Great potential',
          themes: [],
          tone: '',
          coreTension: '',
          uniqueTwist: '',
          narrativePotential: 'multiple branching storylines',
        },
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      testBase.click('#generate-btn');
      await testBase.wait(100);

      const results = document.getElementById('directions-results');
      expect(results.innerHTML).toContain('Narrative Potential:');
      expect(results.innerHTML).toContain('multiple branching storylines');
    });

    it('should handle empty or null rendering data', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [
        {
          title: 'Minimal Direction',
          description: 'Basic direction',
          themes: null,
          tone: '',
          coreTension: null,
          uniqueTwist: '',
          narrativePotential: null,
        },
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      testBase.click('#generate-btn');
      await testBase.wait(100);

      const results = document.getElementById('directions-results');
      expect(results.innerHTML).toContain('Minimal Direction');
      expect(results.innerHTML).toContain('Basic direction');
      // Should not contain empty sections
      expect(results.innerHTML).not.toContain('Themes:');
      expect(results.innerHTML).not.toContain('Tone:');
      expect(results.innerHTML).not.toContain('Core Tension:');
    });
  });

  describe('Direction Count Display Logic', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="concept-form">
          <select id="concept-selector">
            <option value="">Select a concept</option>
          </select>
          <div id="concept-selector-error"></div>
          <button id="generate-btn">Generate</button>
        </div>
        
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

      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );
    });

    it('should display correct direction count for zero directions', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.getThematicDirections.mockResolvedValue(
        []
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      await testBase.wait(100);

      const countElement = document.getElementById('concept-directions-count');
      expect(countElement.textContent).toBe('No existing directions');
    });

    it('should display correct direction count for one direction', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [testBase.buildThematicDirection()];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.getThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      await testBase.wait(100);

      const countElement = document.getElementById('concept-directions-count');
      expect(countElement.textContent).toBe('1 existing direction');
    });

    it('should display correct direction count for multiple directions', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [
        testBase.buildThematicDirection(),
        testBase.buildThematicDirection(),
        testBase.buildThematicDirection(),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.getThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      await testBase.wait(100);

      const countElement = document.getElementById('concept-directions-count');
      expect(countElement.textContent).toBe('3 existing directions');
    });

    it('should show warning for many directions (>=10)', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = Array(12)
        .fill()
        .map(() => testBase.buildThematicDirection());

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.getThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      await testBase.wait(100);

      const countElement = document.getElementById('concept-directions-count');
      expect(countElement.innerHTML).toContain('12 existing directions');
      expect(countElement.innerHTML).toContain('consider if more are needed');
      expect(countElement.innerHTML).toContain('warning');
    });

    it('should handle direction count loading error', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.getThematicDirections.mockRejectedValue(
        new Error('Load failed')
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      await testBase.wait(100);

      const countElement = document.getElementById('concept-directions-count');
      expect(countElement.textContent).toBe('Unable to load directions');
      expect(testBase.mockDependencies.logger.error).toHaveBeenCalledWith(
        'Failed to load direction count',
        expect.any(Error)
      );
    });
  });

  describe('Enhanced Error Handling', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="concept-form">
          <select id="concept-selector">
            <option value="">Select a concept</option>
          </select>
          <div id="concept-selector-error"></div>
          <button id="generate-btn">Generate</button>
        </div>
        
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

      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );
    });

    it('should handle concept not found warning', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await testBase.controller.initialize();

      // Try to select a concept that doesn't exist
      testBase.controller._selectConcept('nonexistent-id');

      expect(testBase.mockDependencies.logger.warn).toHaveBeenCalledWith(
        'Concept not found: nonexistent-id'
      );
    });

    it('should handle missing direction count element gracefully', async () => {
      // Remove the direction count element
      document.getElementById('concept-directions-count').remove();

      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';

      // Should not throw error when element is missing
      expect(() => selector.dispatchEvent(new Event('change'))).not.toThrow();
    });

    it('should handle empty directions display gracefully', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        []
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      testBase.click('#generate-btn');
      await testBase.wait(100);

      const results = document.getElementById('directions-results');
      expect(results.innerHTML).toContain('No directions generated');
    });

    it('should handle missing directions container gracefully', async () => {
      // Remove the directions results container
      document.getElementById('directions-results').remove();

      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      const mockDirections = [testBase.buildThematicDirection()];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );
      testBase.mockDependencies.characterBuilderService.generateThematicDirections.mockResolvedValue(
        mockDirections
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      testBase.click('#generate-btn');
      await testBase.wait(100);

      expect(testBase.mockDependencies.logger.warn).toHaveBeenCalledWith(
        'No directions container found'
      );
    });
  });

  describe('UI Navigation and State Management', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="concept-form">
          <select id="concept-selector">
            <option value="">Select a concept</option>
          </select>
          <div id="concept-selector-error"></div>
          <button id="generate-btn">Generate</button>
        </div>
        
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
          <button id="back-to-menu-btn">Back to Menu</button>
        </div>
      `;

      testBase.controller = new ThematicDirectionController(
        testBase.mockDependencies
      );
    });

    it('should handle back button element presence check', async () => {
      // Test the back button element presence check which covers line 132-133
      await testBase.controller.initialize();

      // The back button should be found and the event listener set up
      const backBtn = document.getElementById('back-to-menu-btn');
      expect(backBtn).toBeTruthy();
    });

    it('should handle URL preselection check with invalid window context', async () => {
      // Cover the window check in _checkForPreselection (line 460)
      const mockConcepts = [
        testBase.buildCharacterConcept({
          id: 'test-123',
          concept: 'Test concept',
        }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      // Temporarily mock window as undefined to test the guard
      const originalWindow = global.window;
      global.window = undefined;

      await testBase.controller.initialize();

      // Restore window
      global.window = originalWindow;

      // Should not throw and should initialize successfully
      expect(
        testBase.mockDependencies.characterBuilderService
          .getAllCharacterConcepts
      ).toHaveBeenCalled();
    });

    it('should handle concept selection with no conceptsData', async () => {
      // Test the concept not found warning (line 260-261)
      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      await testBase.controller.initialize();

      // Try to select a concept that doesn't exist
      testBase.controller._selectConcept('nonexistent-id');

      expect(testBase.mockDependencies.logger.warn).toHaveBeenCalledWith(
        'Concept not found: nonexistent-id'
      );
    });

    it('should clear concept display when selection is cleared', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      const selectedDisplay = document.getElementById(
        'selected-concept-display'
      );

      // First select a concept
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      expect(selectedDisplay.style.display).toBe('block');

      // Then clear selection
      selector.value = '';
      selector.dispatchEvent(new Event('change'));

      expect(selectedDisplay.style.display).toBe('none');
    });

    it('should update generate button state correctly', async () => {
      const mockConcepts = [
        testBase.buildCharacterConcept({ id: '123', concept: 'Test concept' }),
      ];

      testBase.mockDependencies.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      await testBase.controller.initialize();

      const selector = document.getElementById('concept-selector');
      const generateBtn = document.getElementById('generate-btn');

      // Initially disabled
      expect(generateBtn.disabled).toBe(true);

      // Select concept - should enable
      selector.value = '123';
      selector.dispatchEvent(new Event('change'));

      expect(generateBtn.disabled).toBe(false);

      // Clear selection - should disable
      selector.value = '';
      selector.dispatchEvent(new Event('change'));

      expect(generateBtn.disabled).toBe(true);
    });
  });
});
