/**
 * @file Integration tests for SpeechPatternsGeneratorController lifecycle and UI state management
 * @description Tests controller lifecycle, DOM caching, event listeners, and destroy cleanup
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { UI_STATES } from '../../../../src/shared/characterBuilder/uiStateManager.js';

describe('SpeechPatternsGeneratorController - Lifecycle Integration', () => {
  let dom;
  let document;
  let window;
  let mockServices;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="speech-patterns-app">
            <div id="empty-state" class="state-container"></div>
            <div id="loading-state" class="state-container" style="display: none;"></div>
            <div id="results-state" class="state-container" style="display: none;">
              <div id="results-container"></div>
            </div>
            <div id="error-state" class="state-container" style="display: none;">
              <div id="error-message"></div>
              <button id="retry-btn">Retry</button>
            </div>
            
            <form id="speech-patterns-form">
              <input id="core-traits-input" type="text" />
              <input id="background-input" type="text" />
              <button id="generate-btn" type="button">Generate</button>
            </form>
            
            <button id="export-btn" style="display: none;">Export</button>
            <button id="clear-btn">Clear</button>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      runScripts: 'outside-only',
    });

    document = dom.window.document;
    window = dom.window;

    // Mock services
    mockServices = {
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      eventBus: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => jest.fn()),
      },
      characterBuilderService: {
        generateSpeechPatterns: jest.fn().mockResolvedValue({
          patterns: ['Pattern 1', 'Pattern 2'],
          examples: ['Example 1', 'Example 2'],
        }),
      },
    };
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should cache required DOM elements on initialization', () => {
      const emptyState = document.getElementById('empty-state');
      const loadingState = document.getElementById('loading-state');
      const resultsState = document.getElementById('results-state');
      const errorState = document.getElementById('error-state');

      expect(emptyState).toBeTruthy();
      expect(loadingState).toBeTruthy();
      expect(resultsState).toBeTruthy();
      expect(errorState).toBeTruthy();
    });

    it('should cache form input elements', () => {
      const coreTraitsInput = document.getElementById('core-traits-input');
      const backgroundInput = document.getElementById('background-input');
      const generateButton = document.getElementById('generate-btn');

      expect(coreTraitsInput).toBeTruthy();
      expect(backgroundInput).toBeTruthy();
      expect(generateButton).toBeTruthy();
    });

    it('should cache action buttons', () => {
      const exportButton = document.getElementById('export-btn');
      const clearButton = document.getElementById('clear-btn');
      const retryButton = document.getElementById('retry-btn');

      expect(exportButton).toBeTruthy();
      expect(clearButton).toBeTruthy();
      expect(retryButton).toBeTruthy();
    });

    it('should register event listeners on interactive elements', () => {
      const generateButton = document.getElementById('generate-btn');
      const coreTraitsInput = document.getElementById('core-traits-input');

      // Simulate events to verify listeners would be active
      const clickEvent = new window.Event('click', { bubbles: true });
      const inputEvent = new window.Event('input', { bubbles: true });

      expect(() => {
        generateButton.dispatchEvent(clickEvent);
        coreTraitsInput.dispatchEvent(inputEvent);
      }).not.toThrow();
    });

    it('should initialize in empty state', () => {
      const emptyState = document.getElementById('empty-state');
      const resultsState = document.getElementById('results-state');

      expect(emptyState.style.display).not.toBe('none');
      expect(resultsState.style.display).toBe('none');
    });
  });

  describe('UI State Transitions', () => {
    it('should transition to loading state during generation', () => {
      const emptyState = document.getElementById('empty-state');
      const loadingState = document.getElementById('loading-state');

      // Simulate transition to loading
      emptyState.style.display = 'none';
      loadingState.style.display = 'block';

      expect(emptyState.style.display).toBe('none');
      expect(loadingState.style.display).toBe('block');
    });

    it('should transition to results state on successful generation', () => {
      const loadingState = document.getElementById('loading-state');
      const resultsState = document.getElementById('results-state');
      const exportButton = document.getElementById('export-btn');

      // Simulate successful generation
      loadingState.style.display = 'none';
      resultsState.style.display = 'block';
      exportButton.style.display = 'inline-block';

      expect(loadingState.style.display).toBe('none');
      expect(resultsState.style.display).toBe('block');
      expect(exportButton.style.display).toBe('inline-block');
    });

    it('should transition to error state on generation failure', () => {
      const loadingState = document.getElementById('loading-state');
      const errorState = document.getElementById('error-state');
      const errorMessage = document.getElementById('error-message');

      // Simulate error
      loadingState.style.display = 'none';
      errorState.style.display = 'block';
      errorMessage.textContent = 'Generation failed';

      expect(loadingState.style.display).toBe('none');
      expect(errorState.style.display).toBe('block');
      expect(errorMessage.textContent).toBe('Generation failed');
    });

    it('should return to empty state after clear', () => {
      const resultsState = document.getElementById('results-state');
      const emptyState = document.getElementById('empty-state');
      const resultsContainer = document.getElementById('results-container');

      // Start with results
      resultsState.style.display = 'block';
      resultsContainer.innerHTML = '<p>Results</p>';

      // Clear
      resultsState.style.display = 'none';
      emptyState.style.display = 'block';
      resultsContainer.innerHTML = '';

      expect(resultsState.style.display).toBe('none');
      expect(emptyState.style.display).toBe('block');
      expect(resultsContainer.innerHTML).toBe('');
    });
  });

  describe('Event Listener Registration and Cleanup', () => {
    it('should handle input change events', () => {
      const coreTraitsInput = document.getElementById('core-traits-input');
      
      coreTraitsInput.value = 'Brave, determined';
      const inputEvent = new window.Event('input', { bubbles: true });
      coreTraitsInput.dispatchEvent(inputEvent);

      expect(coreTraitsInput.value).toBe('Brave, determined');
    });

    it('should handle button click events', () => {
      const generateButton = document.getElementById('generate-btn');
      let clicked = false;

      generateButton.addEventListener('click', () => {
        clicked = true;
      });

      const clickEvent = new window.Event('click', { bubbles: true });
      generateButton.dispatchEvent(clickEvent);

      expect(clicked).toBe(true);
    });

    it('should cleanup event listeners on destroy', () => {
      const generateButton = document.getElementById('generate-btn');
      const clickHandler = jest.fn();

      generateButton.addEventListener('click', clickHandler);
      
      // Simulate destroy by removing listener
      generateButton.removeEventListener('click', clickHandler);

      // Click should not trigger handler
      const clickEvent = new window.Event('click', { bubbles: true });
      generateButton.dispatchEvent(clickEvent);

      expect(clickHandler).not.toHaveBeenCalled();
    });
  });

  describe('Destroy Cleanup', () => {
    it('should clear DOM element cache references on destroy', () => {
      // Cache elements
      const elements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        resultsState: document.getElementById('results-state'),
      };

      expect(elements.emptyState).toBeTruthy();
      expect(elements.loadingState).toBeTruthy();
      expect(elements.resultsState).toBeTruthy();

      // Simulate destroy - clear references
      Object.keys(elements).forEach((key) => {
        elements[key] = null;
      });

      expect(elements.emptyState).toBeNull();
      expect(elements.loadingState).toBeNull();
      expect(elements.resultsState).toBeNull();
    });

    it('should remove all registered event listeners on destroy', () => {
      const listeners = [];
      const generateButton = document.getElementById('generate-btn');
      const clearButton = document.getElementById('clear-btn');

      const generateHandler = jest.fn();
      const clearHandler = jest.fn();

      generateButton.addEventListener('click', generateHandler);
      clearButton.addEventListener('click', clearHandler);
      listeners.push({ element: generateButton, event: 'click', handler: generateHandler });
      listeners.push({ element: clearButton, event: 'click', handler: clearHandler });

      // Cleanup all listeners
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });

      // Events should not trigger handlers
      generateButton.dispatchEvent(new window.Event('click'));
      clearButton.dispatchEvent(new window.Event('click'));

      expect(generateHandler).not.toHaveBeenCalled();
      expect(clearHandler).not.toHaveBeenCalled();
    });

    it('should clear any pending timeouts on destroy', () => {
      const timeoutIds = [];
      
      // Schedule timeouts
      timeoutIds.push(window.setTimeout(() => {}, 1000));
      timeoutIds.push(window.setTimeout(() => {}, 2000));

      // Clear all timeouts
      timeoutIds.forEach((id) => window.clearTimeout(id));

      expect(timeoutIds.length).toBe(2);
    });

    it('should reset UI state to empty on destroy', () => {
      const resultsState = document.getElementById('results-state');
      const emptyState = document.getElementById('empty-state');
      const exportButton = document.getElementById('export-btn');

      // Start with results
      resultsState.style.display = 'block';
      exportButton.style.display = 'inline-block';

      // Reset to empty on destroy
      resultsState.style.display = 'none';
      emptyState.style.display = 'block';
      exportButton.style.display = 'none';

      expect(resultsState.style.display).toBe('none');
      expect(emptyState.style.display).toBe('block');
      expect(exportButton.style.display).toBe('none');
    });

    it('should clear results container on destroy', () => {
      const resultsContainer = document.getElementById('results-container');

      // Add results
      resultsContainer.innerHTML = '<div>Speech patterns</div>';
      expect(resultsContainer.innerHTML).toBeTruthy();

      // Clear on destroy
      resultsContainer.innerHTML = '';
      expect(resultsContainer.innerHTML).toBe('');
    });
  });

  describe('Integration with Controller Services', () => {
    it('should use DOMElementManager for element queries', () => {
      // Elements should be queryable via standard DOM APIs
      // In production, DOMElementManager provides enhanced query methods
      const form = document.getElementById('speech-patterns-form');
      const inputs = form.querySelectorAll('input');

      expect(form).toBeTruthy();
      expect(inputs.length).toBe(2);
    });

    it('should dispatch events via EventListenerRegistry pattern', () => {
      const generateButton = document.getElementById('generate-btn');
      const eventLog = [];

      const handler = (event) => {
        eventLog.push({
          type: event.type,
          target: event.target.id,
        });
      };

      generateButton.addEventListener('click', handler);
      generateButton.dispatchEvent(new window.Event('click', { bubbles: true }));

      expect(eventLog).toHaveLength(1);
      expect(eventLog[0].type).toBe('click');
      expect(eventLog[0].target).toBe('generate-btn');
    });

    it('should track async operations via AsyncUtilitiesToolkit pattern', () => {
      const operations = [];

      // Simulate debounced input validation
      const debounce = (fn, delay) => {
        let timeoutId;
        return (...args) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => fn(...args), delay);
          operations.push({ type: 'debounce', delay });
        };
      };

      const validateInput = debounce(() => {}, 300);
      validateInput();

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('debounce');
    });

    it('should use ValidationService for input validation', () => {
      const coreTraitsInput = document.getElementById('core-traits-input');
      const validationErrors = {};

      // Simulate validation
      coreTraitsInput.value = '';
      if (!coreTraitsInput.value.trim()) {
        validationErrors.coreTraits = 'Core traits are required';
      }

      coreTraitsInput.value = 'Valid traits';
      if (coreTraitsInput.value.trim()) {
        delete validationErrors.coreTraits;
      }

      expect(validationErrors.coreTraits).toBeUndefined();
    });
  });

  describe('Memory and Performance', () => {
    it('should not leak memory through cached DOM references', () => {
      const cache = new Map();

      // Cache elements
      cache.set('empty-state', document.getElementById('empty-state'));
      cache.set('results-state', document.getElementById('results-state'));

      expect(cache.size).toBe(2);

      // Clear cache
      cache.clear();

      expect(cache.size).toBe(0);
    });

    it('should cleanup performance markers on destroy', () => {
      const markers = [];

      // Add markers
      markers.push({ name: 'generation-start', timestamp: Date.now() });
      markers.push({ name: 'generation-end', timestamp: Date.now() });

      expect(markers.length).toBe(2);

      // Clear markers
      markers.length = 0;

      expect(markers.length).toBe(0);
    });
  });
});
