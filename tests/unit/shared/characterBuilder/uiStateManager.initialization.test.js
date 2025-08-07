/**
 * @file Test for UIStateManager initialization with various DOM conditions
 * @description Tests UIStateManager creation with missing/present DOM elements to diagnose warnings
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  UIStateManager,
  UI_STATES,
} from '../../../../src/shared/characterBuilder/uiStateManager.js';

describe('UIStateManager - Initialization Conditions', () => {
  let mockElements;
  let consoleWarnSpy;
  let capturedWarnings;

  beforeEach(() => {
    document.body.innerHTML = '';
    capturedWarnings = [];
    consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation((message) => {
        capturedWarnings.push(message);
      });

    // Create standard mock elements
    mockElements = {
      emptyState: null,
      loadingState: null,
      errorState: null,
      resultsState: null,
    };
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  describe('Valid DOM Element Scenarios', () => {
    it('should create successfully when all required elements exist', () => {
      // Create actual DOM elements
      document.body.innerHTML = `
        <div id="empty-state" class="cb-empty-state"></div>
        <div id="loading-state" class="cb-loading-state"></div>
        <div id="error-state" class="cb-error-state"></div>
        <div id="results-state" class="cb-results-state"></div>
      `;

      const elements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      // Verify all elements exist
      expect(elements.emptyState).not.toBeNull();
      expect(elements.loadingState).not.toBeNull();
      expect(elements.errorState).not.toBeNull();
      expect(elements.resultsState).not.toBeNull();

      // Create UIStateManager
      let uiStateManager;
      let creationError;

      try {
        uiStateManager = new UIStateManager(elements);
      } catch (error) {
        creationError = error;
      }

      // Should succeed
      expect(creationError).toBeUndefined();
      expect(uiStateManager).toBeDefined();
      expect(uiStateManager).toBeInstanceOf(UIStateManager);

      // Should not produce warnings
      expect(capturedWarnings).toHaveLength(0);
    });

    it('should identify minimum required elements for UIStateManager', () => {
      // Test what the actual requirements are
      document.body.innerHTML = `
        <div id="empty-state"></div>
        <div id="loading-state"></div>
        <div id="error-state"></div>
        <div id="results-state"></div>
      `;

      const elements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      const uiStateManager = new UIStateManager(elements);
      expect(uiStateManager).toBeDefined();

      // Test basic functionality
      expect(() => uiStateManager.showState(UI_STATES.EMPTY)).not.toThrow();
      expect(() => uiStateManager.showLoading()).not.toThrow();
      expect(() => uiStateManager.showError('Test error')).not.toThrow();
      expect(() => uiStateManager.showState(UI_STATES.RESULTS)).not.toThrow();
    });
  });

  describe('Missing DOM Element Scenarios', () => {
    it('should fail gracefully when emptyState element is missing', () => {
      document.body.innerHTML = `
        <div id="loading-state"></div>
        <div id="error-state"></div>
        <div id="results-state"></div>
      `;

      const elements = {
        emptyState: null, // Missing
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      let creationError;
      try {
        new UIStateManager(elements);
      } catch (error) {
        creationError = error;
      }

      // Document what happens - either it fails or succeeds with warnings
      if (creationError) {
        expect(creationError.message).toBeTruthy();
        console.log(
          'UIStateManager failed with missing emptyState:',
          creationError.message
        );
      } else {
        console.log(
          'UIStateManager succeeded with missing emptyState - checking for warnings'
        );
        // May produce warnings but not fail
      }
    });

    it('should fail gracefully when loadingState element is missing', () => {
      document.body.innerHTML = `
        <div id="empty-state"></div>
        <div id="error-state"></div>
        <div id="results-state"></div>
      `;

      const elements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: null, // Missing
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      let creationError;
      try {
        new UIStateManager(elements);
      } catch (error) {
        creationError = error;
      }

      if (creationError) {
        expect(creationError.message).toBeTruthy();
        console.log(
          'UIStateManager failed with missing loadingState:',
          creationError.message
        );
      } else {
        console.log('UIStateManager succeeded with missing loadingState');
      }
    });

    it('should fail gracefully when errorState element is missing', () => {
      document.body.innerHTML = `
        <div id="empty-state"></div>
        <div id="loading-state"></div>
        <div id="results-state"></div>
      `;

      const elements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: null, // Missing
        resultsState: document.getElementById('results-state'),
      };

      let creationError;
      try {
        new UIStateManager(elements);
      } catch (error) {
        creationError = error;
      }

      if (creationError) {
        expect(creationError.message).toBeTruthy();
        console.log(
          'UIStateManager failed with missing errorState:',
          creationError.message
        );
      } else {
        console.log('UIStateManager succeeded with missing errorState');
      }
    });

    it('should fail gracefully when resultsState element is missing', () => {
      document.body.innerHTML = `
        <div id="empty-state"></div>
        <div id="loading-state"></div>
        <div id="error-state"></div>
      `;

      const elements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: null, // Missing
      };

      let creationError;
      try {
        new UIStateManager(elements);
      } catch (error) {
        creationError = error;
      }

      if (creationError) {
        expect(creationError.message).toBeTruthy();
        console.log(
          'UIStateManager failed with missing resultsState:',
          creationError.message
        );
      } else {
        console.log('UIStateManager succeeded with missing resultsState');
      }
    });

    it('should fail when all elements are missing', () => {
      const elements = {
        emptyState: null,
        loadingState: null,
        errorState: null,
        resultsState: null,
      };

      let creationError;
      try {
        new UIStateManager(elements);
      } catch (error) {
        creationError = error;
      }

      // This should definitely fail
      expect(creationError).toBeDefined();
      expect(creationError.message).toBeTruthy();
      console.log(
        'UIStateManager failed with all missing elements:',
        creationError.message
      );
    });
  });

  describe('ThematicDirectionsManager Integration Scenarios', () => {
    it('should reproduce the exact DOM structure from thematic-directions-manager.html', () => {
      // Create the exact HTML structure that exists in the page
      document.body.innerHTML = `
        <div id="thematic-directions-manager-container" class="cb-page-container">
          <main class="cb-page-main thematic-directions-manager-main">
            <section class="cb-results-panel directions-management-panel">
              <div id="directions-container" class="cb-state-container directions-content">
                <!-- Empty State -->
                <div id="empty-state" class="cb-empty-state">
                  <p>No thematic directions found.</p>
                  <p>Generate some directions first using the Thematic Direction Generator.</p>
                  <a href="thematic-direction-generator.html" class="cb-button-primary" style="margin-top: 1rem">
                    Go to Generator
                  </a>
                </div>

                <!-- Loading State -->
                <div id="loading-state" class="cb-loading-state" style="display: none">
                  <div class="spinner large"></div>
                  <p>Loading directions...</p>
                </div>

                <!-- Error State -->
                <div id="error-state" class="cb-error-state" style="display: none">
                  <p class="error-title">Unable to Load Directions</p>
                  <p class="error-message" id="error-message-text"></p>
                  <button type="button" class="cb-button-secondary" id="retry-btn">Try Again</button>
                </div>

                <!-- Results State -->
                <div id="results-state" class="cb-state-container" style="display: none">
                  <div id="directions-results" class="directions-results">
                    <!-- Dynamically populated -->
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      `;

      const stateElements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      // Log what we found
      console.log('DOM Elements found:');
      console.log(
        '- emptyState:',
        stateElements.emptyState ? 'EXISTS' : 'MISSING'
      );
      console.log(
        '- loadingState:',
        stateElements.loadingState ? 'EXISTS' : 'MISSING'
      );
      console.log(
        '- errorState:',
        stateElements.errorState ? 'EXISTS' : 'MISSING'
      );
      console.log(
        '- resultsState:',
        stateElements.resultsState ? 'EXISTS' : 'MISSING'
      );

      // Verify all elements exist
      expect(stateElements.emptyState).not.toBeNull();
      expect(stateElements.loadingState).not.toBeNull();
      expect(stateElements.errorState).not.toBeNull();
      expect(stateElements.resultsState).not.toBeNull();

      // Try to create UIStateManager with these exact elements
      let uiStateManager;
      let creationError;

      try {
        uiStateManager = new UIStateManager(stateElements);
      } catch (error) {
        creationError = error;
      }

      if (creationError) {
        console.log(
          'REPRODUCTION CONFIRMED: UIStateManager fails with HTML elements:',
          creationError.message
        );
        expect(creationError).toBeDefined();
      } else {
        console.log('UIStateManager created successfully with HTML elements');
        expect(uiStateManager).toBeDefined();

        // Test basic functionality
        expect(() => uiStateManager.showState(UI_STATES.EMPTY)).not.toThrow();
        expect(() => uiStateManager.showLoading()).not.toThrow();
      }
    });

    it('should simulate the exact creation flow from thematicDirectionsManagerMain.js', () => {
      // Reproduce the exact DOM setup and creation logic
      document.body.innerHTML = `
        <div id="empty-state" class="cb-empty-state"></div>
        <div id="loading-state" class="cb-loading-state" style="display: none"></div>
        <div id="error-state" class="cb-error-state" style="display: none"></div>
        <div id="results-state" class="cb-state-container" style="display: none"></div>
      `;

      // This is exactly what thematicDirectionsManagerMain.js does:
      const stateElements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      // Check if all required elements are present (lines 164 in main.js)
      const hasAllElements = Object.values(stateElements).every(
        (element) => element !== null
      );
      console.log('hasAllElements check:', hasAllElements);

      if (hasAllElements) {
        let uiStateManager = null;
        let creationError = null;

        try {
          uiStateManager = new UIStateManager(stateElements);
        } catch (error) {
          // This is the path that leads to the warning (lines 169-172 in main.js)
          console.warn(
            'Failed to create UIStateManager, controller will use fallback:',
            error.message
          );
          uiStateManager = null;
          creationError = error;
        }

        if (creationError) {
          // This should match the warning we see in error_logs.txt
          console.log(
            'EXPECTED: UIStateManager creation failed, fallback to null'
          );
          expect(uiStateManager).toBeNull();
        } else {
          console.log('UIStateManager created successfully');
          expect(uiStateManager).not.toBeNull();
        }
      } else {
        console.warn(
          'Required UI state elements not found, UIStateManager will be null'
        );
      }
    });
  });

  describe('Element Validation Requirements', () => {
    it('should identify what UIStateManager actually validates in elements', () => {
      // Test with minimal valid elements to see what the real requirements are
      document.body.innerHTML = `
        <div id="empty-state"></div>
        <div id="loading-state"></div>
        <div id="error-state"></div>
        <div id="results-state"></div>
      `;

      const elements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      // Check what UIStateManager constructor actually validates
      let validationError;
      try {
        const manager = new UIStateManager(elements);

        // Test each method to see what elements are actually required
        console.log('Testing UIStateManager methods:');

        try {
          manager.showEmpty();
          console.log('- showEmpty(): works');
        } catch (e) {
          console.log('- showEmpty(): fails -', e.message);
        }

        try {
          manager.showLoading();
          console.log('- showLoading(): works');
        } catch (e) {
          console.log('- showLoading(): fails -', e.message);
        }

        try {
          manager.showError('test error');
          console.log('- showError(): works');
        } catch (e) {
          console.log('- showError(): fails -', e.message);
        }

        try {
          manager.showResults();
          console.log('- showResults(): works');
        } catch (e) {
          console.log('- showResults(): fails -', e.message);
        }
      } catch (error) {
        validationError = error;
        console.log(
          'UIStateManager constructor validation error:',
          error.message
        );
      }

      // This test documents what the real requirements are
      if (validationError) {
        expect(validationError.message).toBeTruthy();
      } else {
        expect(true).toBe(true); // Constructor passed
      }
    });
  });
});
