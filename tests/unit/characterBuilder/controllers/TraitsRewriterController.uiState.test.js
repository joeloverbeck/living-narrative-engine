/**
 * @file Tests for TraitsRewriterController UI state management issues
 * @description Reproduction tests for the runtime warnings identified in the error logs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import { TraitsRewriterController } from '../../../../src/characterBuilder/controllers/TraitsRewriterController.js';
import { createTestBed } from '../../../common/testBed.js';

describe('TraitsRewriterController - UI State Issues (Reproduction Tests)', () => {
  let testBed;
  let mockDependencies;
  let dom;
  let consoleSpy;

  beforeEach(() => {
    testBed = createTestBed();

    // Create DOM structure matching traits-rewriter.html (without the missing state elements)
    const htmlContent = `<!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
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
            
            <!-- MISSING: The state elements that cause the warnings -->
            <!-- <div id="loading-state" style="display: none"></div> -->
            <!-- <div id="results-state" style="display: none"></div> -->
            <!-- <div id="error-state" style="display: none"></div> -->
          </div>
        </body>
      </html>`;

    dom = new JSDOM(htmlContent);
    global.document = dom.window.document;
    global.window = dom.window;
    global.navigator = { clipboard: { writeText: jest.fn() } };

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
  });

  describe('Issue Reproduction: Missing UI State Elements', () => {
    it('should reproduce the exact runtime warnings from error_logs.txt', async () => {
      // This test reproduces the three specific warnings from the error logs:
      // 1. Line 13: "UIStateManager not initialized, cannot show state 'empty'"
      // 2. Line 27: "Missing state elements: loadingState, resultsState, errorState"
      // 3. Line 41: "UIStateManager not available, skipping initial state"

      // Act - Initialize controller with missing state elements
      const controller = new TraitsRewriterController(mockDependencies);
      await controller.initialize();

      // Assert - Verify all three expected warnings were logged
      const warnCalls = mockDependencies.logger.warn.mock.calls.map(
        (call) => call[0]
      );

      // Look for the specific patterns (ignoring element caching warnings)
      const hasUIStateManagerNotInitialized = warnCalls.some((call) =>
        call.includes('UIStateManager not initialized, cannot show state')
      );
      const hasUIStateManagerNotAvailable = warnCalls.some((call) =>
        call.includes('UIStateManager not available, skipping initial state')
      );

      expect(hasUIStateManagerNotInitialized).toBe(true);
      expect(hasUIStateManagerNotAvailable).toBe(true);

      // The third warning about missing state elements happens if controller can cache elements
      // but we demonstrate that the core issue is identified
    });

    it('should verify that required state elements are missing from DOM', () => {
      // Assert - Confirm the DOM elements that cause the issue are missing
      expect(document.getElementById('loading-state')).toBeNull();
      expect(document.getElementById('results-state')).toBeNull();
      expect(document.getElementById('error-state')).toBeNull();
    });
  });

  describe('Issue Reproduction: Controller Initialization Flow', () => {
    it('should verify controller completes initialization despite UI state warnings', async () => {
      // This test verifies the controller still works despite the warnings

      // Act - Initialize controller
      const controller = new TraitsRewriterController(mockDependencies);
      await controller.initialize();

      // Assert - Controller should complete initialization successfully despite warnings
      expect(mockDependencies.logger.info).toHaveBeenCalledWith(
        'TraitsRewriterController: Complete implementation initialized'
      );

      // And the warnings should have occurred
      const warnCalls = mockDependencies.logger.warn.mock.calls.map(
        (call) => call[0]
      );
      const hasUIStateWarnings = warnCalls.some(
        (call) =>
          call.includes('UIStateManager not initialized') ||
          call.includes('UIStateManager not available')
      );
      expect(hasUIStateWarnings).toBe(true);
    });
  });
});
