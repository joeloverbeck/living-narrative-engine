/**
 * @file Tests to verify the UI state management fixes for TraitsRewriterController
 * @description Tests that the warnings are resolved after adding required DOM elements
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsRewriterController } from '../../../../src/characterBuilder/controllers/TraitsRewriterController.js';
import { createTestBed } from '../../../common/testBed.js';

describe('TraitsRewriterController - UI State Fixes', () => {
  let testBed;
  let mockDependencies;
  let originalBodyHTML;
  let consoleSpy;

  beforeEach(() => {
    testBed = createTestBed();

    // Save original body content
    originalBodyHTML = document.body.innerHTML;

    // Set up DOM structure directly in Jest's existing jsdom environment
    document.body.innerHTML = `
      <div id="app">
        <!-- Character input elements -->
        <textarea id="character-definition"></textarea>
        <div id="character-input-error" style="display: none"></div>
        
        <!-- Control buttons -->
        <button id="rewrite-traits-button"></button>
        <button id="export-json-button"></button>
        <button id="export-text-button"></button>
        <button id="copy-traits-button"></button>
        <button id="clear-input-button"></button>
        <button id="retry-button"></button>

        <!-- State containers (existing ones) -->
        <div id="generation-progress" style="display: none">
          <p class="progress-text">Generating...</p>
        </div>
        <div id="rewritten-traits-container" style="display: none">
          <h3 id="character-name-display">Character</h3>
          <div id="traits-sections"></div>
        </div>
        <div id="generation-error" style="display: none">
          <p class="error-message"></p>
        </div>
        <div id="empty-state">Empty state</div>
        
        <!-- FIXED: The state elements that UIStateManager requires -->
        <div id="loading-state" style="display: none"></div>
        <div id="results-state" style="display: none"></div>
        <div id="error-state" style="display: none"></div>
      </div>
    `;

    // Mock navigator.clipboard if not already present
    if (!global.navigator) {
      global.navigator = {};
    }
    if (!global.navigator.clipboard) {
      global.navigator.clipboard = { writeText: jest.fn() };
    }

    // Mock dependencies
    mockDependencies = {
      logger: testBed.createMockLogger(),
      characterBuilderService: testBed.createMock('CharacterBuilderService', [
        'initialize',
        'getAllCharacterConcepts',
        'createCharacterConcept',
        'updateCharacterConcept',
        'deleteCharacterConcept',
        'getCharacterConcept',
        'generateThematicDirections',
        'getThematicDirections',
      ]),
      eventBus: testBed.createMock('ISafeEventDispatcher', [
        'dispatch',
        'subscribe',
        'unsubscribe',
      ]),
      schemaValidator: testBed.createMock('ISchemaValidator', ['validate']),
      traitsRewriterGenerator: testBed.createMock('TraitsRewriterGenerator', [
        'generateRewrittenTraits',
      ]),
      traitsRewriterDisplayEnhancer: testBed.createMock(
        'TraitsRewriterDisplayEnhancer',
        ['enhanceForDisplay', 'formatForExport', 'generateExportFilename']
      ),
    };

    // Spy on console methods to capture warnings
    consoleSpy = {
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    testBed.cleanup();
    if (consoleSpy) {
      consoleSpy.warn.mockRestore();
      consoleSpy.error.mockRestore();
      consoleSpy.info.mockRestore();
    }
    // Restore original body HTML
    document.body.innerHTML = originalBodyHTML;
  });

  describe('UI State Management Fix Verification', () => {
    it('should NOT log UIStateManager warnings when required elements are present', async () => {
      // Act - Initialize controller with required state elements present
      const controller = new TraitsRewriterController(mockDependencies);
      await controller.initialize();

      // Assert - The specific warnings from error_logs.txt should NOT be logged
      const warnCalls = mockDependencies.logger.warn.mock.calls.map(
        (call) => call[0]
      );

      const hasUIStateManagerNotInitialized = warnCalls.some((call) =>
        call.includes('UIStateManager not initialized, cannot show state')
      );
      const hasUIStateManagerNotAvailable = warnCalls.some((call) =>
        call.includes('UIStateManager not available, skipping initial state')
      );
      const hasMissingStateElements = warnCalls.some((call) =>
        call.includes(
          'Missing state elements: loadingState, resultsState, errorState'
        )
      );

      expect(hasUIStateManagerNotInitialized).toBe(false);
      expect(hasUIStateManagerNotAvailable).toBe(false);
      expect(hasMissingStateElements).toBe(false);
    });

    it('should verify that all required state elements are present in DOM', () => {
      // Assert - All required elements should exist
      expect(document.getElementById('loading-state')).not.toBeNull();
      expect(document.getElementById('results-state')).not.toBeNull();
      expect(document.getElementById('error-state')).not.toBeNull();

      // And existing elements should still be there
      expect(document.getElementById('generation-progress')).not.toBeNull();
      expect(
        document.getElementById('rewritten-traits-container')
      ).not.toBeNull();
      expect(document.getElementById('generation-error')).not.toBeNull();
      expect(document.getElementById('empty-state')).not.toBeNull();
    });

    it('should successfully initialize UIStateManager with all required elements', async () => {
      // Act - Initialize controller
      const controller = new TraitsRewriterController(mockDependencies);
      await controller.initialize();

      // Assert - Controller should initialize successfully
      expect(mockDependencies.logger.info).toHaveBeenCalledWith(
        'TraitsRewriterController: Complete implementation initialized'
      );

      // And should NOT have any UI state manager warnings
      const allLogCalls = [
        ...mockDependencies.logger.warn.mock.calls.map((call) => call[0]),
        ...mockDependencies.logger.error.mock.calls.map((call) => call[0]),
      ];

      const hasUIStateManagerIssues = allLogCalls.some(
        (call) =>
          call.includes('UIStateManager') &&
          (call.includes('not initialized') ||
            call.includes('not available') ||
            call.includes('Missing state elements'))
      );

      expect(hasUIStateManagerIssues).toBe(false);
    });
  });
});
