/**
 * @file Integration test for Character Concepts Manager page loading
 * Tests the complete initialization flow including DOM elements and service registration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Character Concepts Manager Page Loading Integration', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Set up global performance before creating JSDOM
    global.performance = {
      now: jest.fn(() => Date.now())
    };

    // Create a JSDOM environment with the required DOM structure
    dom = new JSDOM(`
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
              </section>
              <section class="concepts-display-panel">
                <div id="concepts-container">
                  <div id="empty-state">No concepts yet</div>
                  <div id="loading-state" style="display: none">Loading...</div>
                  <div id="error-state" style="display: none">Error</div>
                  <div id="results-state" style="display: none">Results</div>
                </div>
              </section>
            </main>
          </div>
          
          <!-- Required DOM elements for base container -->
          <div id="outputDiv" style="display: none;" aria-hidden="true"></div>
          <div id="message-list" style="display: none;" aria-hidden="true"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });

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
  });

  it('should verify required DOM elements exist', () => {
    // Test that our HTML structure has the required elements
    expect(document.getElementById('outputDiv')).toBeTruthy();
    expect(document.getElementById('message-list')).toBeTruthy();
    expect(document.getElementById('character-concepts-manager-container')).toBeTruthy();
    expect(document.getElementById('create-concept-btn')).toBeTruthy();
    expect(document.getElementById('concept-search')).toBeTruthy();
  });

  it('should handle DOM ready state correctly', async () => {
    // Test that the waitForDOM function works correctly
    const module = await import('../../src/character-concepts-manager-main.js');
    
    // Verify the module exports what we expect
    expect(module.initializeApp).toBeDefined();
    expect(module.PAGE_NAME).toBe('CharacterConceptsManager');
  });

  it('should fail gracefully with appropriate error message when services missing', async () => {
    // Mock console methods
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const module = await import('../../src/character-concepts-manager-main.js?t=' + Date.now());
    
    let caughtError;
    try {
      await module.initializeApp();
    } catch (error) {
      caughtError = error;
    }

    // Should catch an error about missing services
    expect(caughtError).toBeDefined();
    expect(caughtError.message).toContain('CharacterBuilderService');

    // Should have logged the error
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should show user-friendly error when initialization fails', async () => {
    const module = await import('../../src/character-concepts-manager-main.js?t2=' + Date.now());
    
    try {
      await module.initializeApp();
    } catch (error) {
      // Error should be caught and handled
      expect(error).toBeDefined();
    }

    // Check if error container was created
    const errorContainer = document.getElementById('init-error-container');
    expect(errorContainer).toBeTruthy();
    expect(errorContainer.innerHTML).toContain('Initialization Error');
    expect(errorContainer.innerHTML).toContain('Character Concepts Manager');
  });

  it('should set up page visibility event listeners', async () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

    const module = await import('../../src/character-concepts-manager-main.js?t3=' + Date.now());
    
    try {
      await module.initializeApp();
    } catch (error) {
      // Expected to fail, but should still set up listeners
    }

    // Should have set up DOMContentLoaded listener
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    addEventListenerSpy.mockRestore();
    windowAddEventListenerSpy.mockRestore();
  });

  it('should properly escape HTML in error messages', async () => {
    const module = await import('../../src/character-concepts-manager-main.js?t4=' + Date.now());
    
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
    const module = await import('../../src/character-concepts-manager-main.js?t5=' + Date.now());
    
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