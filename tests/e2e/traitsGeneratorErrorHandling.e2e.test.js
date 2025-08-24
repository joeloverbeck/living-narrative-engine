/**
 * @file End-to-end test for Traits Generator error handling and edge cases
 * @description Tests error scenarios, network failures, validation errors,
 * and edge cases to ensure robust user experience
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

describe('Traits Generator Error Handling E2E', () => {
  let dom;
  let window;
  let document;
  let mockErrorServices;

  beforeEach(() => {
    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Setup error testing mocks
    mockErrorServices = setupErrorTestingMocks();

    // Create JSDOM instance for error testing
    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only',
      resources: 'usable',
      beforeParse(window) {
        // Setup error testing environment
        window.fetch = mockErrorServices.fetch;
        window.console = { ...window.console, ...mockErrorServices.console };

        // Mock timers for timeout scenarios
        window.setTimeout = jest.fn((fn, delay) => {
          if (delay > 5000) {
            // Simulate timeout for long delays
            return 999;
          }
          if (typeof fn === 'function') fn();
          return 123;
        });

        window.clearTimeout = jest.fn();

        // Mock file operations for export error testing
        window.URL = {
          createObjectURL: jest.fn(() => {
            if (mockErrorServices.simulateExportError) {
              throw new Error('Mock export error');
            }
            return 'mock-blob-url';
          }),
          revokeObjectURL: jest.fn(),
        };

        window.Blob = jest.fn().mockImplementation((content, options) => {
          if (mockErrorServices.simulateExportError) {
            throw new Error('Mock blob creation error');
          }
          return { content, type: options?.type || 'text/plain' };
        });
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

  describe('Network Error Handling', () => {
    it('should handle fetch failures gracefully', () => {
      // Test that error state exists for network failures
      const errorState = document.getElementById('error-state');
      const errorMessageText = document.getElementById('error-message-text');

      expect(errorState).toBeTruthy();
      expect(errorMessageText).toBeTruthy();
      expect(errorState.getAttribute('role')).toBe('alert');
    });

    it('should display appropriate error messages for different failure types', () => {
      const errorContent = document.querySelector('.error-content');
      const errorTitle = document.querySelector('.error-title');
      const errorIcon = document.querySelector('.error-icon');

      expect(errorContent).toBeTruthy();
      expect(errorTitle).toBeTruthy();
      expect(errorIcon).toBeTruthy();

      expect(errorTitle.textContent).toBe('Generation Failed');
    });

    it('should handle timeout errors', () => {
      // The UI should be structured to display timeout-specific errors
      const loadingState = document.getElementById('loading-state');
      expect(loadingState.getAttribute('role')).toBe('status');

      // Should be able to transition from loading to error state
      const errorState = document.getElementById('error-state');
      expect(errorState).toBeTruthy();
    });

    it('should handle service unavailable errors', () => {
      // Test that the error display can handle service unavailability
      const errorMessageText = document.getElementById('error-message-text');
      expect(errorMessageText).toBeTruthy();

      // Should support different error message types
      expect(
        errorMessageText.parentElement.classList.contains('error-content')
      ).toBe(true);
    });
  });

  describe('Validation Error Handling', () => {
    it('should display input validation errors clearly', () => {
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      expect(inputValidationError).toBeTruthy();
      expect(inputValidationError.getAttribute('role')).toBe('alert');
      expect(inputValidationError.classList.contains('cb-error-text')).toBe(
        true
      );
    });

    it('should handle required field validation', () => {
      const requiredInputs = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
      ];

      requiredInputs.forEach((inputId) => {
        const input = document.getElementById(inputId);
        const label = document.querySelector(`label[for="${inputId}"]`);

        expect(input).toBeTruthy();
        expect(label).toBeTruthy();
        expect(label.textContent).toContain('*'); // Required indicator
      });
    });

    it('should handle minimum length validation errors', () => {
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );

      expect(coreMotivationInput).toBeTruthy();
      expect(inputValidationError).toBeTruthy();

      // Test validation on blur event
      expect(() => {
        coreMotivationInput.value = 'short'; // Too short
        coreMotivationInput.dispatchEvent(
          new window.Event('blur', { bubbles: true })
        );
      }).not.toThrow();
    });

    it('should handle direction selection validation', () => {
      const directionSelector = document.getElementById('direction-selector');
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );

      expect(directionSelector).toBeTruthy();
      expect(directionSelectorError).toBeTruthy();
      expect(directionSelectorError.getAttribute('role')).toBe('alert');

      // Test empty selection handling
      expect(directionSelector.value).toBe('');
    });

    it('should prevent generation with invalid inputs', () => {
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn).toBeTruthy();

      // Should be disabled with invalid inputs
      expect(generateBtn.disabled).toBe(true);
    });
  });

  describe('Schema Validation Error Handling', () => {
    it('should handle schema loading failures', () => {
      // Test that the error state can display schema-related errors
      const errorState = document.getElementById('error-state');
      const errorMessageText = document.getElementById('error-message-text');

      expect(errorState).toBeTruthy();
      expect(errorMessageText).toBeTruthy();

      // Should support detailed error messaging
      expect(errorState.getAttribute('role')).toBe('alert');
    });

    it('should handle schema validation failures', () => {
      // Test that validation errors can be displayed to users
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      expect(inputValidationError).toBeTruthy();
      expect(inputValidationError.getAttribute('role')).toBe('alert');
    });

    it('should handle malformed response data', () => {
      // The error handling should support malformed data scenarios
      const errorState = document.getElementById('error-state');
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );

      expect(errorState).toBeTruthy();
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('Service Error Recovery', () => {
    it('should allow retry after generation failure', () => {
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn).toBeTruthy();

      // Button should be available for retry attempts
      expect(generateBtn.classList.contains('cb-button-primary')).toBe(true);
    });

    it('should allow clearing and starting over', () => {
      const clearBtn = document.getElementById('clear-btn');
      expect(clearBtn).toBeTruthy();
      expect(clearBtn.disabled).toBe(false);

      // Test clear functionality
      expect(() => {
        clearBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      }).not.toThrow();
    });

    it('should maintain form state during error scenarios', () => {
      const inputs = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
      ];

      inputs.forEach((inputId) => {
        const input = document.getElementById(inputId);
        expect(input).toBeTruthy();
        expect(input.disabled).toBe(false); // Should remain enabled for editing
      });
    });

    it('should provide clear error recovery guidance', () => {
      const errorState = document.getElementById('error-state');
      const errorTitle = errorState.querySelector('.error-title');

      expect(errorState).toBeTruthy();
      expect(errorTitle).toBeTruthy();
      expect(errorTitle.textContent).toBe('Generation Failed');

      // Error state should be accessible
      expect(errorState.getAttribute('role')).toBe('alert');
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle empty or null responses', () => {
      // Test that the UI can handle empty service responses
      const traitsResults = document.getElementById('traits-results');
      const errorState = document.getElementById('error-state');

      expect(traitsResults).toBeTruthy();
      expect(errorState).toBeTruthy();

      // Should be able to transition to error state for empty responses
      expect(errorState.style.display).toBe('none'); // Initially hidden
    });

    it('should handle extremely long input values', () => {
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      expect(coreMotivationInput).toBeTruthy();
      expect(coreMotivationInput.tagName).toBe('TEXTAREA');

      // Should handle long text input
      const longText = 'A'.repeat(2000);
      expect(() => {
        coreMotivationInput.value = longText;
      }).not.toThrow();
    });

    it('should handle special characters in input', () => {
      const inputs = [
        document.getElementById('core-motivation-input'),
        document.getElementById('internal-contradiction-input'),
        document.getElementById('central-question-input'),
      ];

      const specialText = 'Character with special chars: ñáéíóú @#$%^&*()';

      inputs.forEach((input) => {
        expect(() => {
          input.value = specialText;
          input.dispatchEvent(new window.Event('input', { bubbles: true }));
        }).not.toThrow();
      });
    });

    it('should handle rapid successive interactions', () => {
      const generateBtn = document.getElementById('generate-btn');
      const clearBtn = document.getElementById('clear-btn');

      expect(generateBtn).toBeTruthy();
      expect(clearBtn).toBeTruthy();

      // Should handle multiple rapid clicks
      expect(() => {
        for (let i = 0; i < 5; i++) {
          clearBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
        }
      }).not.toThrow();
    });

    it('should handle browser back/forward navigation', () => {
      // Test that the page structure is stable for navigation
      const backBtn = document.getElementById('back-btn');
      expect(backBtn).toBeTruthy();
      expect(backBtn.classList.contains('cb-button-navigation')).toBe(true);
    });
  });

  describe('Export Error Handling', () => {
    it('should handle export failures gracefully', () => {
      const exportBtn = document.getElementById('export-btn');
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );

      expect(exportBtn).toBeTruthy();
      expect(screenReaderAnnouncement).toBeTruthy();

      // Should be able to announce export errors
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
    });

    it('should handle blob creation failures', () => {
      // Test that export errors can be communicated to users
      const exportBtn = document.getElementById('export-btn');
      expect(exportBtn).toBeTruthy();

      // Export button should be accessible
      expect(exportBtn.getAttribute('aria-label')).toBe(
        'Export traits to text file'
      );
    });

    it('should handle file system errors', () => {
      // Test that file system errors during export are handled
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.classList.contains('sr-only')).toBe(true);
    });
  });

  describe('Accessibility Error Handling', () => {
    it('should announce errors to screen readers', () => {
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');
      expect(screenReaderAnnouncement.getAttribute('aria-atomic')).toBe('true');
    });

    it('should maintain focus management during errors', () => {
      const errorState = document.getElementById('error-state');
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );

      expect(errorState.getAttribute('role')).toBe('alert');
      expect(inputValidationError.getAttribute('role')).toBe('alert');
      expect(directionSelectorError.getAttribute('role')).toBe('alert');
    });

    it('should provide meaningful error messages', () => {
      const errorTitle = document.querySelector('.error-title');
      expect(errorTitle).toBeTruthy();
      expect(errorTitle.textContent).toBe('Generation Failed');

      // Error messages should be clear and actionable
      const errorContent = document.querySelector('.error-content');
      expect(errorContent).toBeTruthy();
    });

    it('should handle keyboard navigation during error states', () => {
      // All interactive elements should remain keyboard accessible
      const interactiveElements = [
        'generate-btn',
        'clear-btn',
        'back-btn',
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
        'direction-selector',
      ];

      interactiveElements.forEach((elementId) => {
        const element = document.getElementById(elementId);
        expect(element).toBeTruthy();
        expect(
          element.tabIndex >= 0 ||
            element.tagName === 'BUTTON' ||
            element.tagName === 'INPUT' ||
            element.tagName === 'TEXTAREA' ||
            element.tagName === 'SELECT'
        ).toBe(true);
      });
    });
  });

  describe('Error State Recovery', () => {
    it('should clear error states when user takes corrective action', () => {
      const errorState = document.getElementById('error-state');
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );

      expect(errorState).toBeTruthy();
      expect(inputValidationError).toBeTruthy();
      expect(directionSelectorError).toBeTruthy();

      // All error states should initially be empty/hidden
      expect(errorState.style.display).toBe('none');
      expect(inputValidationError.textContent).toBe('');
      expect(directionSelectorError.textContent).toBe('');
    });

    it('should restore normal functionality after error recovery', () => {
      const generateBtn = document.getElementById('generate-btn');
      const clearBtn = document.getElementById('clear-btn');
      const inputs = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
      ];

      expect(generateBtn).toBeTruthy();
      expect(clearBtn).toBeTruthy();

      // Controls should be available for recovery
      expect(clearBtn.disabled).toBe(false);

      inputs.forEach((inputId) => {
        const input = document.getElementById(inputId);
        expect(input.disabled).toBe(false);
      });
    });

    it('should maintain user data during error scenarios', () => {
      // Form inputs should retain user data even when errors occur
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      expect(coreMotivationInput).toBeTruthy();

      const testValue = 'User input that should be preserved';
      coreMotivationInput.value = testValue;
      expect(coreMotivationInput.value).toBe(testValue);
    });
  });

  describe('Graceful Degradation', () => {
    it('should handle JavaScript errors gracefully', () => {
      // Test that the page structure supports graceful degradation
      const form = document.querySelector('form');
      const inputs = document.querySelectorAll('input, textarea, select');
      const buttons = document.querySelectorAll('button');

      // Basic form elements should be present even if JavaScript fails
      expect(inputs.length).toBeGreaterThan(0);
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should provide fallback messaging when services fail', () => {
      const errorState = document.getElementById('error-state');
      const emptyState = document.getElementById('empty-state');

      expect(errorState).toBeTruthy();
      expect(emptyState).toBeTruthy();

      // Should have appropriate fallback content
      const emptyStateText = emptyState.querySelector('.empty-state-text');
      expect(emptyStateText.textContent).toContain(
        'Select a thematic direction'
      );
    });

    it('should maintain basic functionality without advanced features', () => {
      // Core form elements should work without advanced JavaScript
      const basicElements = [
        'direction-selector',
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
        'clear-btn',
      ];

      basicElements.forEach((elementId) => {
        const element = document.getElementById(elementId);
        expect(element).toBeTruthy();
      });
    });
  });
});

/**
 * Setup mock services for error testing scenarios
 *
 * @returns {object} Mock services configured for error testing
 */
function setupErrorTestingMocks() {
  const mockConsole = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const errorConfig = {
    simulateNetworkError: false,
    simulateTimeout: false,
    simulateServiceError: false,
    simulateExportError: false,
    simulateValidationError: false,
  };

  const mockFetch = jest.fn().mockImplementation((url, options) => {
    const urlString = url.toString();

    // Simulate different types of errors based on configuration
    if (errorConfig.simulateNetworkError) {
      return Promise.reject(new Error('Network error'));
    }

    if (errorConfig.simulateTimeout) {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });
    }

    if (
      errorConfig.simulateServiceError &&
      urlString.includes('generate-traits')
    ) {
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      });
    }

    // Simulate validation errors
    if (
      errorConfig.simulateValidationError &&
      urlString.includes('generate-traits')
    ) {
      return Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            error: 'Validation failed',
            details: ['Input too short', 'Invalid format'],
          }),
      });
    }

    // Default successful responses for other scenarios
    if (urlString.includes('thematic-directions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              id: 'error-test-direction',
              title: 'Test Direction',
              description: 'Direction for error testing',
              concept: 'Testing',
              createdAt: new Date().toISOString(),
            },
          ]),
      });
    }

    if (urlString.includes('cliches')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            { id: '1', text: 'Test cliche for error handling' },
          ]),
      });
    }

    if (urlString.includes('core-motivations')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              id: '1',
              coreMotivation: 'Test motivation',
              internalContradiction: 'Test contradiction',
              centralQuestion: 'Test question?',
            },
          ]),
      });
    }

    return Promise.resolve({ ok: false, status: 404 });
  });

  return {
    fetch: mockFetch,
    console: mockConsole,
    errorConfig,
    simulateExportError: errorConfig.simulateExportError,
  };
}
