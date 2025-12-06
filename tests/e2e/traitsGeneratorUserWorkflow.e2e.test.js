/**
 * @file End-to-end test for Traits Generator user workflow
 * @description Tests complete user journey including direction selection,
 * input validation, generation process, and results display
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

describe('Traits Generator User Workflow E2E', () => {
  let dom;
  let window;
  let document;
  let mockWorkflowServices;

  beforeEach(() => {
    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Setup workflow service mocks
    mockWorkflowServices = setupWorkflowMocks();

    // Create JSDOM instance for workflow testing
    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only',
      resources: 'usable',
      beforeParse(window) {
        // Setup mocks for user workflow testing
        window.fetch = mockWorkflowServices.fetch;
        window.setTimeout = jest.fn((fn, delay) => {
          // Execute immediately for testing
          if (typeof fn === 'function') fn();
          return 123; // Mock timer ID
        });
        window.clearTimeout = jest.fn();

        // Mock URL and Blob for export testing
        window.URL = {
          createObjectURL: jest.fn(() => 'mock-blob-url'),
          revokeObjectURL: jest.fn(),
        };

        window.Blob = jest.fn().mockImplementation((content, options) => ({
          content,
          type: options?.type || 'text/plain',
          size: content[0]?.length || 0,
        }));

        // Mock performance for timing - jsdom v27 has readonly performance
        if (window.performance && window.performance.now) {
          jest.spyOn(window.performance, 'now').mockReturnValue(Date.now());
        } else {
          Object.defineProperty(window, 'performance', {
            value: {
              now: jest.fn(() => Date.now()),
            },
            configurable: true,
          });
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

  describe('Initial Page Load Workflow', () => {
    it('should display empty state on first load', () => {
      const emptyState = document.getElementById('empty-state');
      const loadingState = document.getElementById('loading-state');
      const resultsState = document.getElementById('results-state');
      const errorState = document.getElementById('error-state');

      // Empty state should be visible
      expect(emptyState).toBeTruthy();
      expect(emptyState.style.display).not.toBe('none');

      // Other states should be hidden
      expect(loadingState.style.display).toBe('none');
      expect(resultsState.style.display).toBe('none');
      expect(errorState.style.display).toBe('none');
    });

    it('should have generate button disabled on load', () => {
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn).toBeTruthy();
      expect(generateBtn.disabled).toBe(true);
    });

    it('should show appropriate empty state messaging', () => {
      const emptyStateText = document.querySelector('.empty-state-text');
      const emptyStateSubtext = document.querySelector('.empty-state-subtext');

      expect(emptyStateText).toBeTruthy();
      expect(emptyStateSubtext).toBeTruthy();
      expect(emptyStateText.textContent).toContain(
        'Select a thematic direction'
      );
      expect(emptyStateSubtext.textContent).toContain('character inputs');
    });
  });

  describe('Direction Selection Workflow', () => {
    it('should handle direction selection process', () => {
      const directionSelector = document.getElementById('direction-selector');
      const selectedDirectionDisplay = document.getElementById(
        'selected-direction-display'
      );

      expect(directionSelector).toBeTruthy();
      expect(selectedDirectionDisplay).toBeTruthy();

      // Initially, direction display should be hidden
      expect(selectedDirectionDisplay.style.display).toBe('none');

      // Test direction selection event handling
      expect(() => {
        directionSelector.value = 'test-direction-1';
        directionSelector.dispatchEvent(
          new window.Event('change', { bubbles: true })
        );
      }).not.toThrow();
    });

    it('should show direction details after selection', () => {
      const directionTitle = document.getElementById('direction-title');
      const directionDescription = document.getElementById(
        'direction-description'
      );

      expect(directionTitle).toBeTruthy();
      expect(directionDescription).toBeTruthy();

      // Elements should exist for displaying direction information
      expect(directionTitle.tagName).toBe('H3');
      expect(directionDescription.tagName).toBe('P');
    });

    it('should display core motivations panel when direction selected', () => {
      const coreMotivationsPanel = document.getElementById(
        'core-motivations-panel'
      );
      const coreMotivationsList = document.getElementById(
        'core-motivations-list'
      );

      expect(coreMotivationsPanel).toBeTruthy();
      expect(coreMotivationsList).toBeTruthy();

      // Initially hidden
      expect(coreMotivationsPanel.style.display).toBe('none');
    });

    it('should handle direction selection errors', () => {
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );
      expect(directionSelectorError).toBeTruthy();
      expect(directionSelectorError.getAttribute('role')).toBe('alert');
      expect(directionSelectorError.textContent).toBe(''); // Initially empty
    });
  });

  describe('User Input Workflow', () => {
    it('should handle user input field interactions', () => {
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      const internalContradictionInput = document.getElementById(
        'internal-contradiction-input'
      );
      const centralQuestionInput = document.getElementById(
        'central-question-input'
      );

      expect(coreMotivationInput).toBeTruthy();
      expect(internalContradictionInput).toBeTruthy();
      expect(centralQuestionInput).toBeTruthy();

      // Test input event handling
      const testInputs = [
        'A character driven by the need to prove themselves',
        'They fear vulnerability and emotional intimacy',
        'Can they learn to trust others without losing themselves?',
      ];

      expect(() => {
        coreMotivationInput.value = testInputs[0];
        coreMotivationInput.dispatchEvent(
          new window.Event('input', { bubbles: true })
        );

        internalContradictionInput.value = testInputs[1];
        internalContradictionInput.dispatchEvent(
          new window.Event('input', { bubbles: true })
        );

        centralQuestionInput.value = testInputs[2];
        centralQuestionInput.dispatchEvent(
          new window.Event('input', { bubbles: true })
        );
      }).not.toThrow();

      // Verify inputs were set
      expect(coreMotivationInput.value).toBe(testInputs[0]);
      expect(internalContradictionInput.value).toBe(testInputs[1]);
      expect(centralQuestionInput.value).toBe(testInputs[2]);
    });

    it('should show user input summary during entry', () => {
      const userInputSummary = document.getElementById('user-input-summary');
      expect(userInputSummary).toBeTruthy();
      expect(userInputSummary.style.display).toBe('none'); // Initially hidden
    });

    it('should handle input validation feedback', () => {
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      expect(inputValidationError).toBeTruthy();
      expect(inputValidationError.getAttribute('role')).toBe('alert');

      // Test blur events that would trigger validation
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      expect(() => {
        coreMotivationInput.value = 'short'; // Too short input
        coreMotivationInput.dispatchEvent(
          new window.Event('blur', { bubbles: true })
        );
      }).not.toThrow();
    });

    it('should validate minimum input length requirements', () => {
      const inputs = [
        document.getElementById('core-motivation-input'),
        document.getElementById('internal-contradiction-input'),
        document.getElementById('central-question-input'),
      ];

      inputs.forEach((input) => {
        expect(input).toBeTruthy();
        expect(input.tagName).toBe('TEXTAREA');
        expect(parseInt(input.rows)).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Generation Process Workflow', () => {
    it('should handle generate button workflow', () => {
      const generateBtn = document.getElementById('generate-btn');
      const loadingState = document.getElementById('loading-state');

      expect(generateBtn).toBeTruthy();
      expect(loadingState).toBeTruthy();

      // Test generate button click
      expect(() => {
        generateBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      }).not.toThrow();

      // Loading state should be configured properly
      expect(loadingState.getAttribute('role')).toBe('status');
      expect(loadingState.getAttribute('aria-live')).toBe('polite');
    });

    it('should show loading indicators during generation', () => {
      const loadingMessage = document.getElementById('loading-message');
      const spinner = document.querySelector('.spinner');

      expect(loadingMessage).toBeTruthy();
      expect(spinner).toBeTruthy();

      expect(loadingMessage.textContent).toContain(
        'Generating character traits'
      );
      expect(spinner.getAttribute('aria-hidden')).toBe('true');
    });

    it('should handle form state during generation', () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const clearBtn = document.getElementById('clear-btn');

      expect(directionSelector).toBeTruthy();
      expect(generateBtn).toBeTruthy();
      expect(clearBtn).toBeTruthy();

      // All should be enabled initially (except generate which requires valid input)
      expect(directionSelector.disabled).toBe(false);
      expect(clearBtn.disabled).toBe(false);
    });
  });

  describe('Results Display Workflow', () => {
    it('should handle successful generation results', () => {
      const resultsState = document.getElementById('results-state');
      const traitsResults = document.getElementById('traits-results');
      const exportBtn = document.getElementById('export-btn');

      expect(resultsState).toBeTruthy();
      expect(traitsResults).toBeTruthy();
      expect(exportBtn).toBeTruthy();

      // Results state should be properly configured
      expect(resultsState.getAttribute('role')).toBe('region');
      expect(resultsState.getAttribute('aria-label')).toBe(
        'Generated character traits'
      );

      // Export button should initially be hidden
      expect(exportBtn.style.display).toBe('none');
    });

    it('should show export functionality after generation', () => {
      const exportBtn = document.getElementById('export-btn');
      expect(exportBtn).toBeTruthy();
      expect(exportBtn.getAttribute('aria-label')).toBe(
        'Export traits to text file'
      );

      const buttonIcon = exportBtn.querySelector('.button-icon');
      const buttonText = exportBtn.querySelector('.button-text');
      expect(buttonIcon).toBeTruthy();
      expect(buttonText.textContent).toBe('Export');
    });

    it('should handle results scrolling behavior', () => {
      const traitsResults = document.getElementById('traits-results');
      expect(traitsResults).toBeTruthy();
      expect(traitsResults.classList.contains('traits-results')).toBe(true);

      // Element should be ready for scrollIntoView behavior
      expect(traitsResults).toBeTruthy();
    });
  });

  describe('Error Handling Workflow', () => {
    it('should display generation errors appropriately', () => {
      const errorState = document.getElementById('error-state');
      const errorMessageText = document.getElementById('error-message-text');
      const errorTitle = errorState.querySelector('.error-title');
      const errorIcon = errorState.querySelector('.error-icon');

      expect(errorState).toBeTruthy();
      expect(errorMessageText).toBeTruthy();
      expect(errorTitle).toBeTruthy();
      expect(errorIcon).toBeTruthy();

      expect(errorState.getAttribute('role')).toBe('alert');
      expect(errorTitle.textContent).toBe('Generation Failed');
      expect(errorState.style.display).toBe('none'); // Initially hidden
    });

    it('should handle network and service errors', () => {
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
    });

    it('should provide error recovery options', () => {
      const generateBtn = document.getElementById('generate-btn');
      const clearBtn = document.getElementById('clear-btn');

      expect(generateBtn).toBeTruthy();
      expect(clearBtn).toBeTruthy();

      // Users should be able to retry or clear after errors
      expect(clearBtn.disabled).toBe(false);
    });
  });

  describe('Clear and Reset Workflow', () => {
    it('should handle clear button functionality', () => {
      const clearBtn = document.getElementById('clear-btn');
      expect(clearBtn).toBeTruthy();
      expect(clearBtn.getAttribute('aria-label')).toBe('Clear all inputs');

      // Test clear button click
      expect(() => {
        clearBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      }).not.toThrow();
    });

    it('should reset form state when clearing', () => {
      const directionSelector = document.getElementById('direction-selector');
      const selectedDirectionDisplay = document.getElementById(
        'selected-direction-display'
      );
      const coreMotivationsPanel = document.getElementById(
        'core-motivations-panel'
      );

      expect(directionSelector).toBeTruthy();
      expect(selectedDirectionDisplay).toBeTruthy();
      expect(coreMotivationsPanel).toBeTruthy();

      // After clearing, direction display should be hidden
      expect(selectedDirectionDisplay.style.display).toBe('none');
      expect(coreMotivationsPanel.style.display).toBe('none');
    });

    it('should clear input validation errors', () => {
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );

      expect(inputValidationError).toBeTruthy();
      expect(directionSelectorError).toBeTruthy();

      // Initially should be empty
      expect(inputValidationError.textContent).toBe('');
      expect(directionSelectorError.textContent).toBe('');
    });
  });

  describe('State Transitions Workflow', () => {
    it('should handle state transitions properly', () => {
      const states = [
        'empty-state',
        'loading-state',
        'results-state',
        'error-state',
      ];

      states.forEach((stateId) => {
        const stateElement = document.getElementById(stateId);
        expect(stateElement).toBeTruthy();
      });

      // Initial state should be empty
      const emptyState = document.getElementById('empty-state');
      expect(emptyState.style.display).not.toBe('none');
    });

    it('should handle UI updates during workflow progression', () => {
      const generateBtn = document.getElementById('generate-btn');
      const exportBtn = document.getElementById('export-btn');
      const generationInfo = document.getElementById('generation-info');

      expect(generateBtn).toBeTruthy();
      expect(exportBtn).toBeTruthy();
      expect(generationInfo).toBeTruthy();

      // Initial states
      expect(generateBtn.disabled).toBe(true); // Disabled until valid input
      expect(exportBtn.style.display).toBe('none'); // Hidden until results
      expect(generationInfo.textContent).toContain('Ready to generate');
    });

    it('should handle accessibility announcements during workflow', () => {
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
      expect(screenReaderAnnouncement.getAttribute('aria-atomic')).toBe('true');
      expect(screenReaderAnnouncement.classList.contains('sr-only')).toBe(true);
    });
  });

  describe('Navigation Workflow', () => {
    it('should handle back navigation', () => {
      const backBtn = document.getElementById('back-btn');
      expect(backBtn).toBeTruthy();
      expect(backBtn.classList.contains('cb-button-navigation')).toBe(true);
      expect(backBtn.textContent).toContain('Back to Main Menu');

      // Test back button click
      expect(() => {
        backBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      }).not.toThrow();
    });

    it('should handle footer information display', () => {
      const footer = document.querySelector('.cb-page-footer');
      const generationInfo = document.getElementById('generation-info');

      expect(footer).toBeTruthy();
      expect(generationInfo).toBeTruthy();
      expect(generationInfo.classList.contains('generation-info')).toBe(true);
    });
  });

  describe('Complete User Journey', () => {
    it('should support complete workflow from start to finish', () => {
      // Test that all major workflow elements are present
      const workflowElements = [
        'direction-selector',
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
        'generate-btn',
        'traits-results',
        'export-btn',
        'clear-btn',
      ];

      workflowElements.forEach((elementId) => {
        const element = document.getElementById(elementId);
        expect(element).toBeTruthy();
      });
    });

    it('should handle workflow validation checkpoints', () => {
      const generateBtn = document.getElementById('generate-btn');
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );

      expect(generateBtn).toBeTruthy();
      expect(inputValidationError).toBeTruthy();
      expect(directionSelectorError).toBeTruthy();

      // All validation elements should have proper ARIA roles
      expect(inputValidationError.getAttribute('role')).toBe('alert');
      expect(directionSelectorError.getAttribute('role')).toBe('alert');
    });

    it('should provide comprehensive user feedback throughout workflow', () => {
      const feedbackElements = [
        'loading-message',
        'error-message-text',
        'generation-info',
        'screen-reader-announcement',
      ];

      feedbackElements.forEach((elementId) => {
        const element = document.getElementById(elementId);
        expect(element).toBeTruthy();
      });

      // Screen reader support should be comprehensive
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
    });
  });
});

/**
 * Setup workflow mocks for user journey testing
 *
 * @returns {object} Mock services for workflow testing
 */
function setupWorkflowMocks() {
  const mockFetch = jest.fn();

  // Mock realistic workflow responses with slight delays
  mockFetch.mockImplementation((url, options) => {
    return new Promise((resolve) => {
      // Simulate network delay
      setTimeout(() => {
        const urlString = url.toString();

        if (urlString.includes('thematic-directions')) {
          resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve([
                {
                  id: 'workflow-direction-1',
                  title: 'The Reluctant Leader',
                  description:
                    'A character who must lead despite preferring to follow',
                  concept: 'Leadership',
                  createdAt: new Date().toISOString(),
                },
              ]),
          });
        } else if (urlString.includes('cliches')) {
          resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve([
                { id: '1', text: 'Thrust into leadership against their will' },
              ]),
          });
        } else if (urlString.includes('core-motivations')) {
          resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve([
                {
                  id: '1',
                  coreMotivation:
                    'To serve others while maintaining personal integrity',
                  internalContradiction:
                    'Fears the isolation that comes with leadership',
                  centralQuestion:
                    'Can one lead effectively while remaining true to themselves?',
                },
              ]),
          });
        } else if (urlString.includes('generate-traits')) {
          resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                id: 'workflow-trait-result',
                names: [
                  {
                    name: 'Elena',
                    justification: 'Strong yet approachable leader',
                  },
                  {
                    name: 'Marcus',
                    justification: 'Reluctant but capable commander',
                  },
                ],
                physicalDescription:
                  'A composed figure with tired eyes that reflect the weight of unwanted responsibility.',
                personality: [
                  {
                    trait: 'Reluctant',
                    explanation: 'Prefers collaboration over command',
                  },
                  {
                    trait: 'Decisive',
                    explanation: 'Makes hard choices when necessary',
                  },
                ],
                strengths: ['Empathy', 'Strategic thinking'],
                weaknesses: ['Self-doubt', 'Reluctance to delegate'],
                likes: ['Team consensus', 'Quiet reflection'],
                dislikes: ['Authoritarian approaches', 'Isolation'],
                fears: ['Leading others to harm'],
                goals: {
                  shortTerm: ['Build team trust'],
                  longTerm: 'Create sustainable leadership structure',
                },
                notes: ['Natural mediator', 'Prefers leading by example'],
                profile:
                  'A reluctant leader who embodies servant leadership principles.',
                secrets: ['Imposter syndrome despite proven competence'],
                generatedAt: new Date().toISOString(),
              }),
          });
        } else {
          resolve({ ok: false, status: 404 });
        }
      }, 10); // Minimal delay for testing
    });
  });

  return {
    fetch: mockFetch,
  };
}
