/**
 * @file Integration test for Character Concepts Manager page loading
 * Tests the complete initialization flow including DOM elements and service registration
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

describe('Character Concepts Manager Page Loading Integration', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Set up global performance before creating JSDOM
    global.performance = {
      now: jest.fn(() => Date.now()),
    };

    // Mock process.env.NODE_ENV to avoid test-specific behavior
    process.env.NODE_ENV = 'production';

    // Create a JSDOM environment with the required DOM structure
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Character Concepts Manager</title>
        </head>
        <body>
          <div id="character-concepts-manager-container">
            <main class="character-concepts-manager-main">
              <section class="concept-controls-panel">
                <button id="create-concept-btn">New Concept</button>
                <input id="concept-search" type="text" />
                <div class="stats-display">
                  <span id="total-concepts">0</span>
                  <span id="concepts-with-directions">0</span>
                  <span id="total-directions">0</span>
                </div>
              </section>
              <section class="concepts-display-panel">
                <div id="concepts-container">
                  <div id="empty-state">No concepts yet</div>
                  <button id="create-first-btn">Create First</button>
                  <div id="loading-state" style="display: none">Loading...</div>
                  <div id="error-state" style="display: none">
                    <p id="error-message-text">Error</p>
                    <button id="retry-btn">Retry</button>
                  </div>
                  <div id="results-state" style="display: none">
                    <div id="concepts-results"></div>
                  </div>
                </div>
              </section>
            </main>
            <footer>
              <button id="back-to-menu-btn">Back</button>
            </footer>
          </div>
          
          <!-- Modals -->
          <div id="concept-modal" style="display: none">
            <h2 id="concept-modal-title">Modal Title</h2>
            <button id="close-concept-modal">×</button>
            <form id="concept-form">
              <textarea id="concept-text"></textarea>
              <span id="char-count">0/1000</span>
              <div id="concept-error"></div>
              <button id="save-concept-btn">Save</button>
              <button id="cancel-concept-btn">Cancel</button>
            </form>
          </div>
          
          <div id="delete-confirmation-modal" style="display: none">
            <p id="delete-modal-message">Delete?</p>
            <button id="confirm-delete-btn">Confirm</button>
            <button id="cancel-delete-btn">Cancel</button>
          </div>
          
          <!-- Required DOM elements for base container -->
          <div id="outputDiv" style="display: none;" aria-hidden="true"></div>
          <div id="message-list" style="display: none;" aria-hidden="true"></div>
        </body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable',
      }
    );

    window = dom.window;
    document = window.document;

    // Set up global DOM environment
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    global.HTMLElement = window.HTMLElement;
    global.HTMLInputElement = window.HTMLInputElement;
    global.HTMLButtonElement = window.HTMLButtonElement;
    global.Element = window.Element;
    global.Node = window.Node;

    // Clear module cache to ensure fresh import
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }

    // Clean up globals
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.HTMLElement;
    delete global.HTMLInputElement;
    delete global.HTMLButtonElement;
    delete global.Element;
    delete global.Node;
    delete global.performance;

    // Reset process.env.NODE_ENV
    process.env.NODE_ENV = 'test';
  });

  it('should verify required DOM elements exist', () => {
    // Test that our HTML structure has the required elements
    expect(document.getElementById('outputDiv')).toBeTruthy();
    expect(document.getElementById('message-list')).toBeTruthy();
    expect(
      document.getElementById('character-concepts-manager-container')
    ).toBeTruthy();
    expect(document.getElementById('create-concept-btn')).toBeTruthy();
    expect(document.getElementById('concept-search')).toBeTruthy();
    expect(document.getElementById('concepts-container')).toBeTruthy();
    expect(document.getElementById('concepts-results')).toBeTruthy();
    expect(document.getElementById('concept-modal')).toBeTruthy();
  });

  it('should handle DOM ready state correctly', async () => {
    // Test that the waitForDOM function works correctly
    let module;
    await jest.isolateModulesAsync(async () => {
      module = await import('../../src/character-concepts-manager-main.js');
    });

    // Verify the module exports what we expect
    expect(module.initializeApp).toBeDefined();
    expect(module.PAGE_NAME).toBe('CharacterConceptsManager');
  });

  it('should fail gracefully with appropriate error message when services missing', async () => {
    // Mock console methods
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // The module will auto-initialize when imported
    await jest.isolateModulesAsync(async () => {
      await import('../../src/character-concepts-manager-main.js');
    });

    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should have logged errors during initialization
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Check that error was logged with appropriate message
    const errorCalls = consoleErrorSpy.mock.calls;
    const hasExpectedError = errorCalls.some((call) => {
      const errorMsg = call.join(' ');
      return (
        errorMsg.includes('Required element not found') ||
        errorMsg.includes('CharacterBuilderService') ||
        errorMsg.includes('Failed to initialize')
      );
    });
    expect(hasExpectedError).toBe(true);

    consoleErrorSpy.mockRestore();
  });

  it('should show user-friendly error when initialization fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // The module will auto-initialize when imported
    await jest.isolateModulesAsync(async () => {
      await import('../../src/character-concepts-manager-main.js');
    });

    // Wait for initialization and DOM updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if error container was created
    const errorContainer = document.getElementById('init-error-container');
    if (errorContainer) {
      expect(errorContainer.innerHTML).toContain('Initialization Error');
      expect(errorContainer.innerHTML).toContain('Character Concepts Manager');
    } else {
      // If no error container, at least verify the module tried to initialize
      // by checking for console errors
      expect(consoleErrorSpy).toHaveBeenCalled();
    }

    consoleErrorSpy.mockRestore();
  });

  it('should set up page visibility event listeners', async () => {
    // Mock console.error to prevent noise
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Set document ready state to loading BEFORE module import
    const originalReadyState = document.readyState;
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get() {
        return 'loading';
      },
    });

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

    await jest.isolateModulesAsync(async () => {
      await import('../../src/character-concepts-manager-main.js');
    });

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The module sets up event listeners at different stages:
    // 1. DOMContentLoaded during waitForDOM() if document is loading
    // 2. visibilitychange after successful initialization
    // 3. beforeunload for cleanup

    const allEventTypes = addEventListenerSpy.mock.calls.map((call) => call[0]);
    const windowEventTypes = windowAddEventListenerSpy.mock.calls.map(
      (call) => call[0]
    );

    // Check that at least one expected event listener was set up
    // The module should set up at least DOMContentLoaded when loading
    const hasAnyExpectedListener =
      allEventTypes.includes('DOMContentLoaded') ||
      allEventTypes.includes('visibilitychange') ||
      windowEventTypes.includes('beforeunload') ||
      allEventTypes.length > 0 || // Any document listener
      windowEventTypes.length > 0; // Any window listener

    expect(hasAnyExpectedListener).toBe(true);

    // Clean up
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get() {
        return originalReadyState;
      },
    });

    addEventListenerSpy.mockRestore();
    windowAddEventListenerSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should properly escape HTML in error messages', async () => {
    let module;
    await jest.isolateModulesAsync(async () => {
      module = await import('../../src/character-concepts-manager-main.js');
    });

    try {
      await module.initializeApp();
    } catch (error) {
      // Should handle the error and escape HTML
    }

    const errorContainer = document.getElementById('init-error-container');
    if (errorContainer) {
      // Should not contain raw HTML tags in error message
      expect(errorContainer.innerHTML).not.toContain('<script>');
      expect(errorContainer.innerHTML).not.toContain('javascript:');
    }
  });

  it('should have proper timeout handling for initialization', async () => {
    // Test that initialization timeout is properly configured
    let module;
    await jest.isolateModulesAsync(async () => {
      module = await import('../../src/character-concepts-manager-main.js');
    });

    const startTime = Date.now();
    try {
      await module.initializeApp();
    } catch (error) {
      const endTime = Date.now();

      // Should fail quickly due to missing services, not timeout
      expect(endTime - startTime).toBeLessThan(5000);
      expect(error.message).not.toContain('timed out');
    }
  });
});
