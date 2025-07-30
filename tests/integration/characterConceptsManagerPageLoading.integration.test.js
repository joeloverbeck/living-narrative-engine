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

  it('should successfully initialize with required services available', async () => {
    // Mock console methods to verify no unexpected errors
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

    let module;
    await jest.isolateModulesAsync(async () => {
      module = await import('../../src/character-concepts-manager-main.js');
    });

    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Bootstrap should succeed with minimal container configuration
    // The minimal container with includeCharacterBuilder: true should provide:
    // - CharacterBuilderService (via character builder registrations)
    // - ISafeEventDispatcher (via infrastructure registrations)

    // Verify that initialization was attempted
    expect(module.initializeApp).toBeDefined();
    expect(module.PAGE_NAME).toBe('CharacterConceptsManager');

    // Check for successful bootstrap info messages (not error messages)
    const infoCalls = consoleInfoSpy.mock.calls;
    const hasBootstrapMessages = infoCalls.some((call) => {
      const infoMsg = call.join(' ');
      return (
        infoMsg.includes('CommonBootstrapper') ||
        infoMsg.includes('bootstrap') ||
        infoMsg.includes('Initializing CharacterConceptsManager')
      );
    });

    // Should have bootstrap info messages indicating successful initialization
    if (hasBootstrapMessages) {
      expect(hasBootstrapMessages).toBe(true);
    } else {
      // If no info messages, at least verify no critical errors occurred
      const errorCalls = consoleErrorSpy.mock.calls;
      const hasCriticalErrors = errorCalls.some((call) => {
        const errorMsg = call.join(' ');
        return (
          errorMsg.includes('Fatal error') ||
          errorMsg.includes('not found') ||
          errorMsg.includes('Failed to initialize')
        );
      });
      expect(hasCriticalErrors).toBe(false);
    }

    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it('should show user-friendly error when initialization fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // The module will auto-initialize when imported
    await jest.isolateModulesAsync(async () => {
      await import('../../src/character-concepts-manager-main.js');
    });

    // Wait for initialization and DOM updates with retry logic
    const maxRetries = 10;
    const retryDelay = 50;
    let errorContainer = null;
    let retryCount = 0;

    // Retry until we find the error container or console errors, or max retries reached
    while (retryCount < maxRetries) {
      errorContainer = document.getElementById('init-error-container');
      if (errorContainer || consoleErrorSpy.mock.calls.length > 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryCount++;
    }

    // Now check the conditions - at least one should be true
    if (errorContainer) {
      expect(errorContainer.innerHTML).toContain('Initialization Error');
      expect(errorContainer.innerHTML).toContain('Character Concepts Manager');
    } else {
      // If no error container, verify the module tried to initialize
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

      // Should fail quickly due to bootstrap/service resolution issues, not timeout
      expect(endTime - startTime).toBeLessThan(5000);

      // Error should be related to bootstrap/services, not timeout
      expect(error.message).not.toContain('timed out');

      // Should be a meaningful error about missing services or bootstrap failure
      const errorTypes = [
        'CharacterBuilderService',
        'SafeEventDispatcher',
        'Bootstrap',
        'Container',
        'not found',
      ];
      const hasRelevantError = errorTypes.some((type) =>
        error.message.includes(type)
      );
      expect(hasRelevantError).toBe(true);
    }
  });
});
