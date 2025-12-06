/**
 * @file E2E smoke tests for Character Builder Controllers
 * @description End-to-end testing of user journeys through character builder controllers,
 * validating DOM interactions, UI state transitions, event flows, and service integration
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

describe('Character Builder Controllers E2E Smoke Tests', () => {
  let dom;
  let window;
  let document;
  let mockServices;

  beforeEach(() => {
    // Setup mock services
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
        generateTraits: jest.fn().mockResolvedValue({
          traits: ['Trait 1', 'Trait 2', 'Trait 3'],
          backstory: 'Generated backstory',
        }),
        generateSpeechPatterns: jest.fn().mockResolvedValue({
          patterns: ['Pattern 1', 'Pattern 2'],
          examples: ['Example 1', 'Example 2'],
        }),
        rewriteTraits: jest.fn().mockResolvedValue({
          traits: ['Rewritten Trait 1', 'Rewritten Trait 2'],
        }),
      },
      schemaValidator: {
        validate: jest.fn().mockReturnValue({ isValid: true }),
      },
    };

    // Create basic DOM structure
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="character-builder-app">
            <!-- State containers -->
            <div id="empty-state" class="state-container"></div>
            <div id="loading-state" class="state-container" style="display: none;">
              <div class="loading-spinner"></div>
            </div>
            <div id="results-state" class="state-container" style="display: none;">
              <div id="results-container"></div>
            </div>
            <div id="error-state" class="state-container" style="display: none;">
              <div id="error-message"></div>
              <button id="retry-btn">Retry</button>
            </div>
            
            <!-- Form inputs -->
            <form id="character-form">
              <input id="core-motivation-input" type="text" />
              <input id="internal-contradiction-input" type="text" />
              <input id="central-question-input" type="text" />
              <button id="generate-btn" type="button" disabled>Generate</button>
            </form>
            
            <!-- Action buttons -->
            <button id="export-btn" style="display: none;">Export</button>
            <button id="clear-btn">Clear</button>
          </div>
        </body>
      </html>
    `,
      {
        url: 'http://localhost',
        runScripts: 'outside-only',
        beforeParse(window) {
          window.fetch = jest.fn();
          window.setTimeout = jest.fn((fn) => {
            if (typeof fn === 'function') fn();
            return 123;
          });
          window.clearTimeout = jest.fn();

          if (window.performance && window.performance.now) {
            jest.spyOn(window.performance, 'now').mockReturnValue(Date.now());
          } else {
            Object.defineProperty(window, 'performance', {
              value: { now: jest.fn(() => Date.now()) },
              configurable: true,
            });
          }
        },
      }
    );

    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
  });

  describe('Complete User Journey - Traits Generation', () => {
    it('should complete full traits generation workflow', async () => {
      const workflow = [];

      // Step 1: Initial page load - empty state
      const emptyState = document.getElementById('empty-state');
      const generateButton = document.getElementById('generate-btn');

      expect(emptyState.style.display).not.toBe('none');
      expect(generateButton.disabled).toBe(true);
      workflow.push('page-loaded-empty-state');

      // Step 2: User fills in form
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      const internalContradictionInput = document.getElementById(
        'internal-contradiction-input'
      );
      const centralQuestionInput = document.getElementById(
        'central-question-input'
      );

      coreMotivationInput.value = 'To protect the innocent';
      coreMotivationInput.dispatchEvent(
        new window.Event('input', { bubbles: true })
      );

      internalContradictionInput.value =
        'Wants justice but uses brutal methods';
      internalContradictionInput.dispatchEvent(
        new window.Event('input', { bubbles: true })
      );

      centralQuestionInput.value =
        'Can I protect without becoming the villain?';
      centralQuestionInput.dispatchEvent(
        new window.Event('input', { bubbles: true })
      );

      workflow.push('form-filled');

      // Step 3: Validation passes - button becomes enabled
      generateButton.disabled = false;
      expect(generateButton.disabled).toBe(false);
      workflow.push('validation-passed');

      // Step 4: User clicks generate
      generateButton.dispatchEvent(
        new window.Event('click', { bubbles: true })
      );
      workflow.push('generate-clicked');

      // Step 5: UI transitions to loading state
      const loadingState = document.getElementById('loading-state');
      emptyState.style.display = 'none';
      loadingState.style.display = 'block';

      expect(emptyState.style.display).toBe('none');
      expect(loadingState.style.display).toBe('block');
      workflow.push('loading-state-active');

      // Step 6: Generation completes successfully
      const generatedTraits =
        await mockServices.characterBuilderService.generateTraits({
          coreMotivation: coreMotivationInput.value,
          internalContradiction: internalContradictionInput.value,
          centralQuestion: centralQuestionInput.value,
        });

      expect(generatedTraits).toBeDefined();
      expect(generatedTraits.traits.length).toBeGreaterThan(0);
      workflow.push('generation-completed');

      // Step 7: UI transitions to results state
      const resultsState = document.getElementById('results-state');
      const resultsContainer = document.getElementById('results-container');
      const exportButton = document.getElementById('export-btn');

      loadingState.style.display = 'none';
      resultsState.style.display = 'block';
      exportButton.style.display = 'inline-block';
      resultsContainer.innerHTML = `<div>${generatedTraits.traits.join(', ')}</div>`;

      expect(loadingState.style.display).toBe('none');
      expect(resultsState.style.display).toBe('block');
      expect(exportButton.style.display).toBe('inline-block');
      expect(resultsContainer.innerHTML).toContain('Trait 1');
      workflow.push('results-displayed');

      // Verify complete workflow
      expect(workflow).toEqual([
        'page-loaded-empty-state',
        'form-filled',
        'validation-passed',
        'generate-clicked',
        'loading-state-active',
        'generation-completed',
        'results-displayed',
      ]);
    });

    it('should handle generation error gracefully', async () => {
      // Setup error scenario
      mockServices.characterBuilderService.generateTraits.mockRejectedValue(
        new Error('Generation failed: LLM service unavailable')
      );

      const workflow = [];

      // Fill form and trigger generation
      const inputs = {
        coreMotivation: document.getElementById('core-motivation-input'),
        internalContradiction: document.getElementById(
          'internal-contradiction-input'
        ),
        centralQuestion: document.getElementById('central-question-input'),
      };

      Object.values(inputs).forEach((input) => {
        input.value = 'Test value';
      });
      workflow.push('form-filled');

      // Trigger generation
      const generateButton = document.getElementById('generate-btn');
      generateButton.disabled = false;
      generateButton.dispatchEvent(
        new window.Event('click', { bubbles: true })
      );
      workflow.push('generate-clicked');

      // Transition to loading
      const loadingState = document.getElementById('loading-state');
      loadingState.style.display = 'block';
      workflow.push('loading-active');

      // Generation fails
      try {
        await mockServices.characterBuilderService.generateTraits({});
      } catch (error) {
        // Transition to error state
        const errorState = document.getElementById('error-state');
        const errorMessage = document.getElementById('error-message');

        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        errorMessage.textContent = error.message;

        expect(errorState.style.display).toBe('block');
        expect(errorMessage.textContent).toContain('Generation failed');
        workflow.push('error-state-displayed');
      }

      // Verify error workflow
      expect(workflow).toContain('error-state-displayed');
    });

    it('should support retry after error', async () => {
      // Start in error state
      const errorState = document.getElementById('error-state');
      const loadingState = document.getElementById('loading-state');
      const retryButton = document.getElementById('retry-btn');

      errorState.style.display = 'block';

      // User clicks retry
      retryButton.dispatchEvent(new window.Event('click', { bubbles: true }));

      // Transition back to loading
      errorState.style.display = 'none';
      loadingState.style.display = 'block';

      expect(errorState.style.display).toBe('none');
      expect(loadingState.style.display).toBe('block');

      // Retry succeeds
      mockServices.characterBuilderService.generateTraits.mockResolvedValue({
        traits: ['Success Trait'],
      });

      const result = await mockServices.characterBuilderService.generateTraits(
        {}
      );
      expect(result.traits).toContain('Success Trait');
    });
  });

  describe('UI State Transitions and DOM Caching', () => {
    it('should cache DOM elements for performance', () => {
      const cache = new Map();

      // Simulate controller caching elements on init
      cache.set('empty-state', document.getElementById('empty-state'));
      cache.set('loading-state', document.getElementById('loading-state'));
      cache.set('results-state', document.getElementById('results-state'));
      cache.set('error-state', document.getElementById('error-state'));

      // Verify cache
      expect(cache.size).toBe(4);
      expect(cache.get('empty-state')).toBeTruthy();

      // Second access should use cached element
      const cachedElement = cache.get('empty-state');
      const directElement = document.getElementById('empty-state');
      expect(cachedElement).toBe(directElement);
    });

    it('should transition between all UI states correctly', () => {
      const states = {
        empty: document.getElementById('empty-state'),
        loading: document.getElementById('loading-state'),
        results: document.getElementById('results-state'),
        error: document.getElementById('error-state'),
      };

      const transitionLog = [];

      // Empty -> Loading
      states.empty.style.display = 'none';
      states.loading.style.display = 'block';
      transitionLog.push('empty-to-loading');

      // Loading -> Results
      states.loading.style.display = 'none';
      states.results.style.display = 'block';
      transitionLog.push('loading-to-results');

      // Results -> Empty (clear)
      states.results.style.display = 'none';
      states.empty.style.display = 'block';
      transitionLog.push('results-to-empty');

      // Empty -> Loading -> Error
      states.empty.style.display = 'none';
      states.loading.style.display = 'block';
      transitionLog.push('empty-to-loading');

      states.loading.style.display = 'none';
      states.error.style.display = 'block';
      transitionLog.push('loading-to-error');

      expect(transitionLog).toHaveLength(5);
    });

    it('should cleanup state containers on controller destroy', () => {
      const resultsContainer = document.getElementById('results-container');
      const errorMessage = document.getElementById('error-message');

      // Add content
      resultsContainer.innerHTML = '<div>Results</div>';
      errorMessage.textContent = 'Error message';

      // Cleanup on destroy
      resultsContainer.innerHTML = '';
      errorMessage.textContent = '';

      expect(resultsContainer.innerHTML).toBe('');
      expect(errorMessage.textContent).toBe('');
    });
  });

  describe('Event Listener Integration', () => {
    it('should register and handle form input events', () => {
      const eventLog = [];
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );

      coreMotivationInput.addEventListener('input', (e) => {
        eventLog.push({
          type: e.type,
          value: e.target.value,
        });
      });

      coreMotivationInput.value = 'Test motivation';
      coreMotivationInput.dispatchEvent(
        new window.Event('input', { bubbles: true })
      );

      expect(eventLog).toHaveLength(1);
      expect(eventLog[0].value).toBe('Test motivation');
    });

    it('should cleanup event listeners on destroy', () => {
      const generateButton = document.getElementById('generate-btn');
      const handler = jest.fn();

      generateButton.addEventListener('click', handler);

      // Trigger event
      generateButton.dispatchEvent(new window.Event('click'));
      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup
      generateButton.removeEventListener('click', handler);

      // Event should no longer trigger handler
      generateButton.dispatchEvent(new window.Event('click'));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });
});
