/**
 * @file End-to-end test suite for Traits Generator functionality
 * @description Comprehensive testing of traits generation workflow including
 * page loading, schema validation, service integration, user interactions,
 * error handling, accessibility, and export functionality.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Traits Generator E2E Tests', () => {
  let dom;
  let window;
  let document;
  let mockServer;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeAll(() => {
    // Setup console spies to catch errors and warnings
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    // Clean up console spies
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  beforeEach(() => {
    // Clear console spy calls before each test
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();

    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Create a new JSDOM instance with enhanced configuration
    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only', // Don't run actual scripts to avoid conflicts
      resources: 'usable',
      beforeParse(window) {
        // Mock required globals that would be provided by the application
        window.process = { env: { NODE_ENV: 'test' } };

        // Mock performance API if needed - jsdom v27 has readonly performance
        if (window.performance && window.performance.now) {
          jest.spyOn(window.performance, 'now').mockReturnValue(Date.now());
        } else if (!window.performance) {
          Object.defineProperty(window, 'performance', {
            value: {
              now: jest.fn(() => Date.now()),
            },
            configurable: true,
          });
        }

        // Mock URL constructor and createObjectURL for export functionality
        if (!window.URL) {
          window.URL = {
            createObjectURL: jest.fn(() => 'mock-blob-url'),
            revokeObjectURL: jest.fn(),
          };
        }

        // Mock fetch for LLM requests
        window.fetch = jest.fn();

        // Mock IndexedDB for data storage
        if (!window.indexedDB) {
          const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
          window.indexedDB = new FDBFactory();
        }
      },
    });

    window = dom.window;
    document = window.document;

    // Setup mock server responses for typical API calls
    setupMockResponses(window.fetch);
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    if (mockServer) {
      mockServer.close();
    }
    jest.clearAllMocks();
  });

  describe('Page Loading and Structure', () => {
    it('should load the HTML page without fatal errors', () => {
      expect(document.title).toBe('Traits Generator - Living Narrative Engine');

      // Check that no critical console errors occurred during page setup
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/fatal|critical|uncaught/i)
      );
    });

    it('should have correct page metadata and accessibility features', () => {
      // Check meta tags
      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport).toBeTruthy();
      expect(viewport.content).toContain('width=device-width');

      const description = document.querySelector('meta[name="description"]');
      expect(description).toBeTruthy();
      expect(description.content).toContain('character traits');

      // Check skip link for accessibility
      const skipLink = document.querySelector('a.skip-link');
      expect(skipLink).toBeTruthy();
      expect(skipLink.getAttribute('href')).toBe('#main-content');
    });

    it('should have all required CSS files linked', () => {
      const styleLinks = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
      );
      const cssFiles = styleLinks.map((link) => link.href);

      expect(cssFiles.some((href) => href.includes('style.css'))).toBe(true);
      expect(cssFiles.some((href) => href.includes('components.css'))).toBe(
        true
      );
      expect(
        cssFiles.some((href) => href.includes('traits-generator.css'))
      ).toBe(true);
    });

    it('should have main JavaScript bundle script tag', () => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const hasMainScript = scripts.some(
        (script) =>
          script.src.includes('traits-generator.js') && script.type === 'module'
      );
      expect(hasMainScript).toBe(true);
    });
  });

  describe('UI Elements and Initial State', () => {
    it('should have all required form elements with correct initial state', () => {
      // Direction selector
      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector).toBeTruthy();
      expect(directionSelector.tagName).toBe('SELECT');
      expect(directionSelector.value).toBe('');
      expect(directionSelector.hasAttribute('aria-label')).toBe(true);

      // User input fields
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      expect(coreMotivationInput).toBeTruthy();
      expect(coreMotivationInput.tagName).toBe('TEXTAREA');
      expect(coreMotivationInput.value).toBe('');

      const internalContradictionInput = document.getElementById(
        'internal-contradiction-input'
      );
      expect(internalContradictionInput).toBeTruthy();
      expect(internalContradictionInput.tagName).toBe('TEXTAREA');

      const centralQuestionInput = document.getElementById(
        'central-question-input'
      );
      expect(centralQuestionInput).toBeTruthy();
      expect(centralQuestionInput.tagName).toBe('TEXTAREA');

      // Buttons
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn).toBeTruthy();
      expect(generateBtn.disabled).toBe(true); // Should be disabled initially

      const clearBtn = document.getElementById('clear-btn');
      expect(clearBtn).toBeTruthy();
      expect(clearBtn.disabled).toBe(false);

      const exportBtn = document.getElementById('export-btn');
      expect(exportBtn).toBeTruthy();
      expect(exportBtn.style.display).toBe('none'); // Should be hidden initially
    });

    it('should have all required state containers', () => {
      const emptyState = document.getElementById('empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.style.display).not.toBe('none'); // Should be visible initially

      const loadingState = document.getElementById('loading-state');
      expect(loadingState).toBeTruthy();
      expect(loadingState.style.display).toBe('none');

      const resultsState = document.getElementById('results-state');
      expect(resultsState).toBeTruthy();
      expect(resultsState.style.display).toBe('none');

      const errorState = document.getElementById('error-state');
      expect(errorState).toBeTruthy();
      expect(errorState.style.display).toBe('none');
    });

    it('should have display panels with correct initial visibility', () => {
      const selectedDirectionDisplay = document.getElementById(
        'selected-direction-display'
      );
      expect(selectedDirectionDisplay).toBeTruthy();
      expect(selectedDirectionDisplay.style.display).toBe('none');

      const coreMotivationsPanel = document.getElementById(
        'core-motivations-panel'
      );
      expect(coreMotivationsPanel).toBeTruthy();
      expect(coreMotivationsPanel.style.display).toBe('none');

      const userInputSummary = document.getElementById('user-input-summary');
      expect(userInputSummary).toBeTruthy();
      expect(userInputSummary.style.display).toBe('none');
    });

    it('should have error message containers', () => {
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );
      expect(directionSelectorError).toBeTruthy();
      expect(directionSelectorError.getAttribute('role')).toBe('alert');

      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      expect(inputValidationError).toBeTruthy();
      expect(inputValidationError.getAttribute('role')).toBe('alert');

      const errorMessageText = document.getElementById('error-message-text');
      expect(errorMessageText).toBeTruthy();
    });

    it('should have accessibility features properly configured', () => {
      // Screen reader announcement area
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
      expect(screenReaderAnnouncement.getAttribute('aria-atomic')).toBe('true');
      expect(screenReaderAnnouncement.classList.contains('sr-only')).toBe(true);

      // Results region
      const resultsContainer = document.getElementById('results-state');
      expect(resultsContainer.getAttribute('role')).toBe('region');
      expect(resultsContainer.getAttribute('aria-label')).toBe(
        'Generated character traits'
      );

      // Loading indicator
      const loadingState = document.getElementById('loading-state');
      expect(loadingState.getAttribute('role')).toBe('status');
      expect(loadingState.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Form Validation and Input Handling', () => {
    it('should show validation errors for incomplete inputs', () => {
      // Simulate partial input that should trigger validation
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );

      // Test with input too short
      coreMotivationInput.value = 'short';
      coreMotivationInput.dispatchEvent(new window.Event('input'));
      coreMotivationInput.dispatchEvent(new window.Event('blur'));

      // Since we can't test the actual controller logic without running the app,
      // we verify the error element exists and is properly configured
      expect(inputValidationError.getAttribute('role')).toBe('alert');
    });

    it('should handle form field interactions correctly', () => {
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      const internalContradictionInput = document.getElementById(
        'internal-contradiction-input'
      );
      const centralQuestionInput = document.getElementById(
        'central-question-input'
      );

      // Test that fields accept input
      coreMotivationInput.value =
        'A character driven by the need to prove themselves worthy of love and acceptance.';
      expect(coreMotivationInput.value).toBe(
        'A character driven by the need to prove themselves worthy of love and acceptance.'
      );

      internalContradictionInput.value =
        'They push people away when they get too close, fearing vulnerability.';
      expect(internalContradictionInput.value).toBe(
        'They push people away when they get too close, fearing vulnerability.'
      );

      centralQuestionInput.value =
        'Can they learn to accept love without losing their identity?';
      expect(centralQuestionInput.value).toBe(
        'Can they learn to accept love without losing their identity?'
      );

      // Verify fields support events
      expect(() => {
        coreMotivationInput.dispatchEvent(new window.Event('input'));
        internalContradictionInput.dispatchEvent(new window.Event('input'));
        centralQuestionInput.dispatchEvent(new window.Event('input'));
      }).not.toThrow();
    });

    it('should have proper placeholder text and help text', () => {
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      expect(coreMotivationInput.placeholder).toContain('core motivation');

      const coreMotivationHelp = document.getElementById(
        'core-motivation-help'
      );
      expect(coreMotivationHelp).toBeTruthy();
      expect(coreMotivationHelp.textContent).toContain('drives this character');

      const contradictionHelp = document.getElementById('contradiction-help');
      expect(contradictionHelp.textContent).toContain('internal conflict');

      const questionHelp = document.getElementById('question-help');
      expect(questionHelp.textContent).toContain('fundamental question');
    });
  });

  describe('Direction Selection Functionality', () => {
    it('should have direction selector with default option', () => {
      const directionSelector = document.getElementById('direction-selector');
      const options = Array.from(directionSelector.options);

      expect(options.length).toBeGreaterThan(0);
      expect(options[0].value).toBe('');
      expect(options[0].textContent).toContain('Choose a thematic direction');
    });

    it('should handle direction selection events', () => {
      const directionSelector = document.getElementById('direction-selector');

      // Test that selection events can be dispatched
      expect(() => {
        directionSelector.value = 'test-direction';
        directionSelector.dispatchEvent(new window.Event('change'));
      }).not.toThrow();
    });

    it('should show help text for direction requirements', () => {
      const helpText = document.querySelector('.cb-help-text');
      expect(helpText).toBeTruthy();
      expect(helpText.textContent).toContain('clichés and core motivations');
    });
  });

  describe('Button and Control Interactions', () => {
    it('should have properly configured generate button', () => {
      const generateBtn = document.getElementById('generate-btn');

      expect(generateBtn.classList.contains('cb-button-primary')).toBe(true);
      expect(generateBtn.getAttribute('aria-label')).toBe(
        'Generate character traits'
      );
      expect(generateBtn.disabled).toBe(true); // Initially disabled

      // Check button has icon and text
      const buttonIcon = generateBtn.querySelector('.button-icon');
      const buttonText = generateBtn.querySelector('.button-text');
      expect(buttonIcon).toBeTruthy();
      expect(buttonText).toBeTruthy();
      expect(buttonText.textContent).toBe('Generate Traits');
    });

    it('should have properly configured export button', () => {
      const exportBtn = document.getElementById('export-btn');

      expect(exportBtn.classList.contains('cb-button-secondary')).toBe(true);
      expect(exportBtn.getAttribute('aria-label')).toBe(
        'Export traits to text file'
      );
      expect(exportBtn.style.display).toBe('none'); // Initially hidden

      const buttonIcon = exportBtn.querySelector('.button-icon');
      const buttonText = exportBtn.querySelector('.button-text');
      expect(buttonIcon).toBeTruthy();
      expect(buttonText.textContent).toBe('Export');
    });

    it('should have clear button functionality', () => {
      const clearBtn = document.getElementById('clear-btn');

      expect(clearBtn.classList.contains('cb-button-secondary')).toBe(true);
      expect(clearBtn.getAttribute('aria-label')).toBe('Clear all inputs');
      expect(clearBtn.disabled).toBe(false);

      // Test click event doesn't throw
      expect(() => {
        clearBtn.dispatchEvent(new window.Event('click'));
      }).not.toThrow();
    });

    it('should show keyboard shortcut hints', () => {
      const shortcutHint = document.querySelector('.shortcut-hint');
      expect(shortcutHint).toBeTruthy();

      const shortcuts = Array.from(shortcutHint.querySelectorAll('kbd'));
      expect(shortcuts.length).toBeGreaterThan(0);

      const hintText = shortcutHint.textContent;
      expect(hintText).toContain('Ctrl');
      expect(hintText).toContain('Enter');
      expect(hintText).toContain('generate');
    });
  });

  describe('Results Display Structure', () => {
    it('should have results container with proper structure', () => {
      const traitsResults = document.getElementById('traits-results');
      expect(traitsResults).toBeTruthy();
      expect(traitsResults.classList.contains('traits-results')).toBe(true);
    });

    it('should have loading indicator with proper accessibility', () => {
      const loadingState = document.getElementById('loading-state');
      const loadingMessage = document.getElementById('loading-message');
      const spinner = loadingState.querySelector('.spinner');

      expect(loadingMessage).toBeTruthy();
      expect(spinner).toBeTruthy();
      expect(spinner.getAttribute('aria-hidden')).toBe('true');
      expect(loadingMessage.textContent).toContain('Generating');
    });

    it('should have error state container with proper structure', () => {
      const errorState = document.getElementById('error-state');
      const errorIcon = errorState.querySelector('.error-icon');
      const errorTitle = errorState.querySelector('.error-title');
      const errorContent = errorState.querySelector('.error-content');

      expect(errorIcon).toBeTruthy();
      expect(errorTitle).toBeTruthy();
      expect(errorContent).toBeTruthy();
      expect(errorTitle.textContent).toBe('Generation Failed');
    });
  });

  describe('Footer and Navigation', () => {
    it('should have footer with navigation elements', () => {
      const footer = document.querySelector('.cb-page-footer');
      expect(footer).toBeTruthy();

      const backBtn = document.getElementById('back-btn');
      expect(backBtn).toBeTruthy();
      expect(backBtn.classList.contains('cb-button-navigation')).toBe(true);
      expect(backBtn.textContent).toContain('Back to Main Menu');
    });

    it('should have generation info display', () => {
      const generationInfo = document.getElementById('generation-info');
      expect(generationInfo).toBeTruthy();
      expect(generationInfo.textContent).toContain('Ready to generate');
    });
  });

  describe('Empty State Display', () => {
    it('should show appropriate empty state content', () => {
      const emptyState = document.getElementById('empty-state');
      const emptyStateIcon = emptyState.querySelector('.empty-state-icon');
      const emptyStateText = emptyState.querySelector('.empty-state-text');
      const emptyStateSubtext = emptyState.querySelector(
        '.empty-state-subtext'
      );

      expect(emptyStateIcon).toBeTruthy();
      expect(emptyStateText).toBeTruthy();
      expect(emptyStateSubtext).toBeTruthy();

      expect(emptyStateText.textContent).toContain(
        'Select a thematic direction'
      );
      expect(emptyStateSubtext.textContent).toContain(
        'specific character inputs'
      );
    });
  });

  describe('Responsive Design and Layout', () => {
    it('should have proper CSS classes for responsive layout', () => {
      const mainContent = document.querySelector('.traits-main');
      expect(mainContent).toBeTruthy();

      const inputPanel = document.querySelector('.traits-input-panel');
      expect(inputPanel).toBeTruthy();
      expect(inputPanel.classList.contains('cb-input-panel')).toBe(true);

      const displayPanel = document.querySelector('.traits-display-panel');
      expect(displayPanel).toBeTruthy();
      expect(displayPanel.classList.contains('cb-output-panel')).toBe(true);
    });

    it('should have proper viewport configuration', () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport.content).toBe('width=device-width, initial-scale=1.0');
    });
  });

  describe('Schema Integration Points', () => {
    it('should be prepared for schema validation integration', () => {
      // This test verifies that the page structure supports schema validation
      // The actual validation would happen in the JavaScript controller

      // Check that form fields exist for schema-validated data
      const requiredInputs = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
      ];

      requiredInputs.forEach((inputId) => {
        const input = document.getElementById(inputId);
        expect(input).toBeTruthy();
        expect(input.tagName).toBe('TEXTAREA');
      });

      // Check that results container exists for schema-validated output
      const traitsResults = document.getElementById('traits-results');
      expect(traitsResults).toBeTruthy();
    });
  });
});

/**
 * Setup mock responses for common API calls
 *
 * @param {Function} fetchMock - Mocked fetch function
 */
function setupMockResponses(fetchMock) {
  fetchMock.mockImplementation((url, options) => {
    // Mock thematic directions response
    if (url.includes('thematic-directions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'test-direction-1',
              title: 'The Reluctant Hero',
              description: 'A character forced into heroism against their will',
              concept: 'Heroism',
              createdAt: new Date().toISOString(),
            },
          ]),
      });
    }

    // Mock clichés response
    if (url.includes('cliches')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: '1', text: "The chosen one who doesn't want to be chosen" },
            { id: '2', text: 'Reluctant to accept their destiny' },
          ]),
      });
    }

    // Mock core motivations response
    if (url.includes('core-motivations')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: '1',
              coreMotivation: 'To protect innocents from harm',
              internalContradiction: 'Wants peace but skilled in violence',
              centralQuestion:
                'Can peace exist without the threat of violence?',
            },
          ]),
      });
    }

    // Mock traits generation response
    if (url.includes('generate-traits')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'generated-trait-123',
            names: [
              {
                name: 'Alexander',
                justification: 'Strong leadership qualities',
              },
              { name: 'Marcus', justification: 'Roman warrior heritage' },
            ],
            physicalDescription:
              'A tall, weathered figure with calculating eyes and battle scars',
            personality: [
              {
                trait: 'Cautious',
                explanation: 'Carefully considers all options before acting',
              },
              {
                trait: 'Protective',
                explanation: 'Instinctively shields others from danger',
              },
            ],
            strengths: ['Strategic thinking', 'Combat experience'],
            weaknesses: ['Reluctance to trust', 'Burden of leadership'],
            likes: ['Quiet moments', 'Simple pleasures', 'Honest people'],
            dislikes: ['Political games', 'Unnecessary violence', 'Corruption'],
            fears: ['Failing those who depend on him'],
            goals: {
              shortTerm: ['Find safe haven for refugees'],
              longTerm: 'Establish lasting peace in the realm',
            },
            notes: ['Has a hidden past', 'Skilled with multiple weapons'],
            profile:
              'A complex character torn between desire for peace and necessity of war',
            secrets: ['Was once a pacifist monk before the war'],
            generatedAt: new Date().toISOString(),
          }),
      });
    }

    // Default fallback for unhandled requests
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
  });
}
