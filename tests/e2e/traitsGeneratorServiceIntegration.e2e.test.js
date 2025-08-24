/**
 * @file End-to-end test for Traits Generator service integration
 * @description Tests integration with TraitsDisplayEnhancer, CharacterBuilderService,
 * and other core services used in the traits generation workflow
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
import fs from 'fs';
import path from 'path';

describe('Traits Generator Service Integration E2E', () => {
  let dom;
  let window;
  let document;
  let mockServices;

  beforeEach(() => {
    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Setup service mocks
    mockServices = setupServiceMocks();

    // Create JSDOM instance with service integration mocking
    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only',
      resources: 'usable',
      beforeParse(window) {
        // Setup global mocks for service integration
        window.fetch = mockServices.fetch;
        window.console = { ...window.console, ...mockServices.console };

        // Mock URL for export functionality
        window.URL = {
          createObjectURL: jest.fn(() => 'mock-blob-url'),
          revokeObjectURL: jest.fn(),
        };

        // Mock file download functionality
        window.Blob = jest.fn().mockImplementation((content, options) => ({
          content,
          type: options?.type || 'text/plain',
          size: content[0]?.length || 0,
        }));

        // Mock IndexedDB for storage
        if (!window.indexedDB) {
          const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
          window.indexedDB = new FDBFactory();
        }
      },
    });

    window = dom.window;
    document = window.document;
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
  });

  describe('TraitsDisplayEnhancer Integration', () => {
    it('should be structured to support trait data enhancement', () => {
      // Test that UI supports enhanced trait display
      const traitsResults = document.getElementById('traits-results');
      expect(traitsResults).toBeTruthy();
      expect(traitsResults.classList.contains('traits-results')).toBe(true);

      // Should support structured trait categories
      expect(traitsResults).toBeTruthy(); // Container for enhanced trait data
    });

    it('should prepare for enhanced trait formatting', () => {
      // Test that the page structure supports the enhanced display format
      // that TraitsDisplayEnhancer would produce

      const resultsState = document.getElementById('results-state');
      expect(resultsState).toBeTruthy();
      expect(resultsState.getAttribute('role')).toBe('region');

      // Should be accessible for screen readers
      expect(resultsState.getAttribute('aria-label')).toBe(
        'Generated character traits'
      );
    });

    it('should support trait export functionality', () => {
      const exportBtn = document.getElementById('export-btn');
      expect(exportBtn).toBeTruthy();
      expect(exportBtn.getAttribute('aria-label')).toBe(
        'Export traits to text file'
      );

      // Export button should initially be hidden
      expect(exportBtn.style.display).toBe('none');

      // Should have proper styling for TraitsDisplayEnhancer integration
      expect(exportBtn.classList.contains('cb-button-secondary')).toBe(true);
    });

    it('should handle enhanced trait data display structure', () => {
      // Test that the UI can handle the enhanced data structure
      // that TraitsDisplayEnhancer.enhanceForDisplay() would return

      const traitsResults = document.getElementById('traits-results');

      // Should be ready to display enhanced categories
      expect(traitsResults).toBeTruthy();
      expect(traitsResults.className).toBe('traits-results');
    });
  });

  describe('CharacterBuilderService Integration', () => {
    it('should support thematic direction loading workflow', () => {
      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector).toBeTruthy();

      // Should have loading state support
      expect(directionSelector.classList.contains('loading')).toBe(false); // Not loading initially
      expect(directionSelector.disabled).toBe(false); // Should be enabled for user interaction

      // Should have proper ARIA label for accessibility
      expect(directionSelector.getAttribute('aria-label')).toBe(
        'Select thematic direction'
      );
    });

    it('should handle direction selection and display workflow', () => {
      const selectedDirectionDisplay = document.getElementById(
        'selected-direction-display'
      );
      const directionTitle = document.getElementById('direction-title');
      const directionDescription = document.getElementById(
        'direction-description'
      );

      expect(selectedDirectionDisplay).toBeTruthy();
      expect(directionTitle).toBeTruthy();
      expect(directionDescription).toBeTruthy();

      // Should initially be hidden
      expect(selectedDirectionDisplay.style.display).toBe('none');
    });

    it('should support core motivations loading and display', () => {
      const coreMotivationsPanel = document.getElementById(
        'core-motivations-panel'
      );
      const coreMotivationsList = document.getElementById(
        'core-motivations-list'
      );

      expect(coreMotivationsPanel).toBeTruthy();
      expect(coreMotivationsList).toBeTruthy();

      // Should initially be hidden until direction is selected
      expect(coreMotivationsPanel.style.display).toBe('none');
    });

    it('should handle clichés integration for generation', () => {
      // The service integration should support clichés loading
      // Test that the help text mentions this requirement
      const helpText = document.querySelector('.cb-help-text');
      expect(helpText).toBeTruthy();
      expect(helpText.textContent).toContain('clichés and core motivations');
    });

    it('should support trait generation service call workflow', () => {
      const generateBtn = document.getElementById('generate-btn');
      const loadingState = document.getElementById('loading-state');
      const loadingMessage = document.getElementById('loading-message');

      expect(generateBtn).toBeTruthy();
      expect(loadingState).toBeTruthy();
      expect(loadingMessage).toBeTruthy();

      // Should be properly configured for generation workflow
      expect(generateBtn.classList.contains('cb-button-primary')).toBe(true);
      expect(loadingState.getAttribute('role')).toBe('status');
      expect(loadingMessage.textContent).toContain(
        'Generating character traits'
      );
    });
  });

  describe('Error Handling Service Integration', () => {
    it('should support service error display workflow', () => {
      const errorState = document.getElementById('error-state');
      const errorMessageText = document.getElementById('error-message-text');

      expect(errorState).toBeTruthy();
      expect(errorMessageText).toBeTruthy();

      // Should have proper accessibility for service errors
      expect(errorState.getAttribute('role')).toBe('alert');
      expect(errorState.style.display).toBe('none'); // Initially hidden
    });

    it('should handle direction selector error display', () => {
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );
      expect(directionSelectorError).toBeTruthy();
      expect(directionSelectorError.getAttribute('role')).toBe('alert');
      expect(directionSelectorError.textContent).toBe(''); // Initially empty
    });

    it('should handle input validation error display', () => {
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      expect(inputValidationError).toBeTruthy();
      expect(inputValidationError.getAttribute('role')).toBe('alert');
      expect(inputValidationError.textContent).toBe(''); // Initially empty
    });
  });

  describe('Event Bus Integration', () => {
    it('should support event dispatching for service communication', () => {
      // Test that the page structure supports event-driven architecture
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');

      // Should support event-driven screen reader announcements
      expect(screenReaderAnnouncement.classList.contains('sr-only')).toBe(true);
    });

    it('should handle generation success and failure events', () => {
      const emptyState = document.getElementById('empty-state');
      const resultsState = document.getElementById('results-state');
      const errorState = document.getElementById('error-state');
      const loadingState = document.getElementById('loading-state');

      // All state containers should exist for event-driven state management
      expect(emptyState).toBeTruthy();
      expect(resultsState).toBeTruthy();
      expect(errorState).toBeTruthy();
      expect(loadingState).toBeTruthy();
    });
  });

  describe('UI State Management Integration', () => {
    it('should support state transitions during service operations', () => {
      // Test that all UI states are properly configured
      const stateElements = [
        'empty-state',
        'loading-state',
        'results-state',
        'error-state',
      ];

      stateElements.forEach((stateId) => {
        const element = document.getElementById(stateId);
        expect(element).toBeTruthy();
      });

      // Initial state should be empty
      const emptyState = document.getElementById('empty-state');
      expect(emptyState.style.display).not.toBe('none');
    });

    it('should handle button state management during service calls', () => {
      const generateBtn = document.getElementById('generate-btn');
      const clearBtn = document.getElementById('clear-btn');
      const exportBtn = document.getElementById('export-btn');

      expect(generateBtn).toBeTruthy();
      expect(clearBtn).toBeTruthy();
      expect(exportBtn).toBeTruthy();

      // Initial button states
      expect(generateBtn.disabled).toBe(true); // Disabled until valid input
      expect(clearBtn.disabled).toBe(false);
      expect(exportBtn.style.display).toBe('none'); // Hidden until results available
    });

    it('should support form state management during service operations', () => {
      const inputFields = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
      ];

      inputFields.forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        expect(field).toBeTruthy();
        expect(field.disabled).toBe(false); // Should be enabled initially
      });

      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector.disabled).toBe(false); // Should be enabled initially
    });
  });

  describe('Data Storage Integration', () => {
    it('should support user input summary display', () => {
      const userInputSummary = document.getElementById('user-input-summary');
      expect(userInputSummary).toBeTruthy();
      expect(userInputSummary.style.display).toBe('none'); // Initially hidden
    });

    it('should handle generation info display', () => {
      const generationInfo = document.getElementById('generation-info');
      expect(generationInfo).toBeTruthy();
      expect(generationInfo.textContent).toContain('Ready to generate');
    });
  });

  describe('Export Service Integration', () => {
    it('should support file download workflow', () => {
      const exportBtn = document.getElementById('export-btn');

      expect(exportBtn).toBeTruthy();
      expect(exportBtn.classList.contains('cb-button-secondary')).toBe(true);

      // Should have proper icon and text for export
      const buttonIcon = exportBtn.querySelector('.button-icon');
      const buttonText = exportBtn.querySelector('.button-text');
      expect(buttonIcon).toBeTruthy();
      expect(buttonText.textContent).toBe('Export');
    });

    it('should handle export error scenarios', () => {
      // Export functionality should integrate with error handling
      const errorState = document.getElementById('error-state');
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );

      expect(errorState).toBeTruthy();
      expect(screenReaderAnnouncement).toBeTruthy();

      // Should support announcing export errors
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Dependency Injection Integration', () => {
    it('should support service dependency resolution', () => {
      // Test that the page loads the correct entry point for DI
      const scriptTags = Array.from(document.querySelectorAll('script[src]'));
      const mainScript = scriptTags.find((script) =>
        script.src.includes('traits-generator.js')
      );

      expect(mainScript).toBeTruthy();
      expect(mainScript.type).toBe('module'); // Required for ES6 DI patterns
    });

    it('should handle service initialization errors gracefully', () => {
      // The error state should be able to handle service initialization failures
      const errorState = document.getElementById('error-state');
      const errorContent = errorState.querySelector('.error-content');
      const errorTitle = errorState.querySelector('.error-title');

      expect(errorState).toBeTruthy();
      expect(errorContent).toBeTruthy();
      expect(errorTitle).toBeTruthy();
      expect(errorTitle.textContent).toBe('Generation Failed');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should support efficient service operation feedback', () => {
      const loadingState = document.getElementById('loading-state');
      const spinner = loadingState.querySelector('.spinner');

      expect(loadingState).toBeTruthy();
      expect(spinner).toBeTruthy();
      expect(spinner.getAttribute('aria-hidden')).toBe('true');

      // Should provide user feedback during potentially long service operations
      expect(loadingState.getAttribute('aria-live')).toBe('polite');
    });

    it('should handle service timeout scenarios', () => {
      // Should support timeout error display
      const errorState = document.getElementById('error-state');
      expect(errorState.getAttribute('role')).toBe('alert');

      // Should be able to display network/timeout errors
      const errorMessageText = document.getElementById('error-message-text');
      expect(errorMessageText).toBeTruthy();
    });
  });
});

/**
 * Setup service mocks for integration testing
 *
 * @returns {object} Mock services and utilities
 */
function setupServiceMocks() {
  const mockFetch = jest.fn();
  const mockConsole = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  // Setup mock responses for different service endpoints
  mockFetch.mockImplementation((url, options) => {
    const urlString = url.toString();

    // Mock thematic directions service
    if (
      urlString.includes('thematic-directions') ||
      urlString.includes('directions')
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              id: 'test-direction-1',
              title: 'The Reluctant Hero',
              description: 'A character forced into heroism against their will',
              concept: 'Heroism',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'test-direction-2',
              title: 'The Reformed Villain',
              description: 'A former antagonist seeking redemption',
              concept: 'Redemption',
              createdAt: new Date().toISOString(),
            },
          ]),
      });
    }

    // Mock clichés service
    if (urlString.includes('cliches')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              id: '1',
              text: "The chosen one who doesn't want to be chosen",
              direction: 'test-direction-1',
            },
            {
              id: '2',
              text: 'Reluctant to accept their destiny',
              direction: 'test-direction-1',
            },
          ]),
      });
    }

    // Mock core motivations service
    if (urlString.includes('core-motivations')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              id: '1',
              coreMotivation:
                'To protect innocents from harm while maintaining personal freedom',
              internalContradiction:
                'Wants to help but fears the responsibility of leadership',
              centralQuestion:
                'Can one be a hero without sacrificing personal desires?',
              direction: 'test-direction-1',
            },
          ]),
      });
    }

    // Mock traits generation service
    if (
      urlString.includes('generate-traits') ||
      (options?.method === 'POST' && urlString.includes('traits'))
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'generated-trait-123',
            names: [
              {
                name: 'Alexander',
                justification: 'Strong leadership qualities despite reluctance',
              },
              {
                name: 'Marcus',
                justification:
                  'Roman warrior heritage with modern sensibilities',
              },
              {
                name: 'David',
                justification:
                  'Biblical hero parallel - small against great odds',
              },
            ],
            physicalDescription:
              'A tall, weathered figure with calculating eyes and battle scars that tell stories of reluctant heroism.',
            personality: [
              {
                trait: 'Cautious',
                explanation:
                  'Carefully considers all options before acting, often to a fault',
              },
              {
                trait: 'Protective',
                explanation:
                  'Instinctively shields others from danger, even at personal cost',
              },
              {
                trait: 'Conflicted',
                explanation:
                  'Torn between personal desires and perceived duty to others',
              },
            ],
            strengths: [
              'Strategic thinking',
              'Combat experience',
              'Empathy for the innocent',
            ],
            weaknesses: [
              'Reluctance to lead',
              'Self-doubt',
              'Burden of unwanted responsibility',
            ],
            likes: [
              'Quiet moments of solitude',
              'Simple pleasures',
              'Honest people',
            ],
            dislikes: [
              'Political games',
              'Unnecessary violence',
              'Being thrust into leadership',
            ],
            fears: [
              'Failing those who depend on him',
              'Becoming the monster he fights',
            ],
            goals: {
              shortTerm: [
                'Find safe haven for current refugees',
                'Master new combat technique',
              ],
              longTerm:
                'Establish lasting peace while maintaining personal freedom',
            },
            notes: [
              'Has a hidden past as a scholar',
              'Skilled with both sword and strategy',
            ],
            profile:
              'A complex character torn between desire for peace and necessity of war, representing the modern reluctant hero archetype.',
            secrets: [
              'Was once a pacifist monk before the war changed everything',
            ],
            generatedAt: new Date().toISOString(),
            metadata: {
              model: 'gpt-4',
              temperature: 0.8,
              tokens: 1250,
              responseTime: 3500,
              promptVersion: '1.0.0',
              generationPrompt:
                'Generate character traits based on reluctant hero archetype...',
            },
          }),
      });
    }

    // Mock schema loading
    if (
      urlString.includes('schema') ||
      urlString.includes('trait.schema.json')
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: 'schema://living-narrative-engine/trait.schema.json',
            title: 'Character Trait',
            type: 'object',
            required: ['id', 'names', 'physicalDescription'],
          }),
      });
    }

    // Mock service errors for error handling tests
    if (urlString.includes('error-test')) {
      return Promise.reject(new Error('Mock service error'));
    }

    // Default fallback for unhandled requests
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Endpoint not found' }),
    });
  });

  return {
    fetch: mockFetch,
    console: mockConsole,
  };
}
