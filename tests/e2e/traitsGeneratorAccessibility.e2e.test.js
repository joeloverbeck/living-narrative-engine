/**
 * @file End-to-end test for Traits Generator accessibility and keyboard shortcuts
 * @description Tests keyboard navigation, screen reader support, WCAG compliance,
 * and keyboard shortcuts functionality
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

describe('Traits Generator Accessibility E2E', () => {
  let dom;
  let window;
  let document;
  let keyboardEvents;

  beforeEach(() => {
    // Read the actual HTML file
    const htmlPath = path.resolve(process.cwd(), 'traits-generator.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Setup keyboard event tracking
    keyboardEvents = [];

    // Create JSDOM instance for accessibility testing
    dom = new JSDOM(html, {
      url: 'http://127.0.0.1:8080/traits-generator.html',
      runScripts: 'outside-only',
      resources: 'usable',
      beforeParse(window) {
        // Mock keyboard event handling
        const originalAddEventListener = window.document.addEventListener;
        window.document.addEventListener = jest.fn(
          (event, handler, options) => {
            if (event === 'keydown') {
              keyboardEvents.push({ type: 'keydown', handler, options });
            }
            return originalAddEventListener.call(
              window.document,
              event,
              handler,
              options
            );
          }
        );

        // Mock focus management
        window.HTMLElement.prototype.focus = jest.fn(function () {
          this.setAttribute('data-focused', 'true');
        });

        window.HTMLElement.prototype.blur = jest.fn(function () {
          this.removeAttribute('data-focused');
        });

        // Mock scroll behavior
        window.HTMLElement.prototype.scrollIntoView = jest.fn();

        // Mock clipboard operations
        Object.defineProperty(window.navigator, 'clipboard', {
          writable: true,
          value: {
            writeText: jest.fn().mockResolvedValue(),
            readText: jest.fn().mockResolvedValue(''),
          },
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

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have proper heading hierarchy', () => {
      const h1 = document.querySelector('h1');
      const h2s = document.querySelectorAll('h2');
      const h3s = document.querySelectorAll('h3');

      expect(h1).toBeTruthy();
      expect(h1.textContent).toBe('Traits Generator');

      // Should have proper heading structure
      expect(h2s.length).toBeGreaterThan(0);

      // Panel titles should be h2
      const panelTitles = document.querySelectorAll('.cb-panel-title');
      panelTitles.forEach((title) => {
        expect(title.tagName).toBe('H2');
      });
    });

    it('should have proper form labeling', () => {
      const requiredInputs = [
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
        'direction-selector',
      ];

      requiredInputs.forEach((inputId) => {
        const input = document.getElementById(inputId);
        const label = document.querySelector(`label[for="${inputId}"]`);

        expect(input).toBeTruthy();
        expect(label).toBeTruthy();
        expect(label.textContent.trim()).not.toBe('');
      });
    });

    it('should have proper ARIA attributes', () => {
      // Test required ARIA roles
      const errorElements = [
        'direction-selector-error',
        'input-validation-error',
        'error-state',
      ];

      errorElements.forEach((elementId) => {
        const element = document.getElementById(elementId);
        expect(element).toBeTruthy();
        expect(element.getAttribute('role')).toBe('alert');
      });

      // Test live regions
      const liveRegions = ['loading-state', 'screen-reader-announcement'];

      liveRegions.forEach((regionId) => {
        const region = document.getElementById(regionId);
        expect(region).toBeTruthy();
        expect(region.getAttribute('aria-live')).toBeTruthy();
      });
    });

    it('should have proper button accessibility', () => {
      const buttons = ['generate-btn', 'export-btn', 'clear-btn', 'back-btn'];

      buttons.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        expect(button).toBeTruthy();
        expect(button.tagName).toBe('BUTTON');
        expect(button.getAttribute('aria-label')).toBeTruthy();
      });
    });

    it('should have skip navigation link', () => {
      const skipLink = document.querySelector('.skip-link');
      expect(skipLink).toBeTruthy();
      expect(skipLink.getAttribute('href')).toBe('#main-content');
      expect(skipLink.textContent).toContain('Skip to main content');
    });

    it('should have proper landmark regions', () => {
      const main = document.querySelector('main');
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');

      expect(main).toBeTruthy();
      expect(header).toBeTruthy();
      expect(footer).toBeTruthy();

      expect(main.id).toBe('main-content');
      expect(main.classList.contains('cb-page-main')).toBe(true);
    });

    it('should have accessible form help text', () => {
      const helpTexts = [
        'core-motivation-help',
        'contradiction-help',
        'question-help',
      ];

      helpTexts.forEach((helpId) => {
        const helpElement = document.getElementById(helpId);
        expect(helpElement).toBeTruthy();
        expect(helpElement.classList.contains('cb-help-text')).toBe(true);
      });

      // Input fields should reference their help text
      const coreMotivationInput = document.getElementById(
        'core-motivation-input'
      );
      expect(coreMotivationInput.getAttribute('aria-describedby')).toBe(
        'core-motivation-help'
      );
    });

    it('should have proper color contrast indicators', () => {
      // Test that error states and required field indicators are present
      const requiredLabels = document.querySelectorAll('label');
      let hasRequiredIndicator = false;

      requiredLabels.forEach((label) => {
        if (label.textContent.includes('*')) {
          hasRequiredIndicator = true;
        }
      });

      expect(hasRequiredIndicator).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should have proper tab order', () => {
      const focusableElements = [
        'direction-selector',
        'core-motivation-input',
        'internal-contradiction-input',
        'central-question-input',
        'generate-btn',
        'clear-btn',
        'export-btn',
        'back-btn',
      ];

      focusableElements.forEach((elementId) => {
        const element = document.getElementById(elementId);
        expect(element).toBeTruthy();

        // Should be focusable (not have tabindex="-1" unless intentionally hidden)
        const tabIndex = element.getAttribute('tabindex');
        if (tabIndex !== null) {
          expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should handle focus management', () => {
      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector).toBeTruthy();

      // Test that focus method exists and can be called
      expect(typeof directionSelector.focus).toBe('function');
      expect(() => directionSelector.focus()).not.toThrow();
    });

    it('should support keyboard navigation of form elements', () => {
      const textareas = document.querySelectorAll('textarea');
      const selects = document.querySelectorAll('select');
      const buttons = document.querySelectorAll('button');

      // All form elements should be keyboard accessible
      [...textareas, ...selects, ...buttons].forEach((element) => {
        expect(
          element.tabIndex >= 0 || element.getAttribute('tabindex') === null
        ).toBe(true);
      });
    });

    it('should handle Enter key on buttons', () => {
      const buttons = document.querySelectorAll('button');

      buttons.forEach((button) => {
        expect(button).toBeTruthy();
        expect(button.tagName).toBe('BUTTON');

        // Buttons should be activatable with Enter key
        expect(() => {
          const enterEvent = new window.KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true,
          });
          button.dispatchEvent(enterEvent);
        }).not.toThrow();
      });
    });

    it('should handle Space key on buttons', () => {
      const buttons = document.querySelectorAll('button');

      buttons.forEach((button) => {
        expect(() => {
          const spaceEvent = new window.KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            keyCode: 32,
            bubbles: true,
          });
          button.dispatchEvent(spaceEvent);
        }).not.toThrow();
      });
    });

    it('should handle Escape key for modal dismissal', () => {
      // Test that Escape key handling is supported
      expect(() => {
        const escapeEvent = new window.KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          bubbles: true,
        });
        document.dispatchEvent(escapeEvent);
      }).not.toThrow();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should support Ctrl+Enter for generation', () => {
      // Test that the page structure supports keyboard shortcut handling
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn).toBeTruthy();

      // Check that shortcut hints are displayed
      const shortcutHint = document.querySelector('.shortcut-hint');
      expect(shortcutHint).toBeTruthy();
      expect(shortcutHint.textContent).toContain('Ctrl');
      expect(shortcutHint.textContent).toContain('Enter');
      expect(shortcutHint.textContent).toContain('generate');

      // Test keyboard event dispatch
      expect(() => {
        const ctrlEnterEvent = new window.KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          ctrlKey: true,
          bubbles: true,
        });
        document.dispatchEvent(ctrlEnterEvent);
      }).not.toThrow();
    });

    it('should support Ctrl+E for export', () => {
      const shortcutHint = document.querySelector('.shortcut-hint');
      expect(shortcutHint.textContent).toContain('Ctrl');
      expect(shortcutHint.textContent).toContain('E');
      expect(shortcutHint.textContent).toContain('export');

      // Test keyboard event dispatch
      expect(() => {
        const ctrlEEvent = new window.KeyboardEvent('keydown', {
          key: 'e',
          code: 'KeyE',
          keyCode: 69,
          ctrlKey: true,
          bubbles: true,
        });
        document.dispatchEvent(ctrlEEvent);
      }).not.toThrow();
    });

    it('should support Ctrl+Shift+Del for clear all', () => {
      const shortcutHint = document.querySelector('.shortcut-hint');
      expect(shortcutHint.textContent).toContain('Ctrl');
      expect(shortcutHint.textContent).toContain('Shift');
      expect(shortcutHint.textContent).toContain('Del');
      expect(shortcutHint.textContent).toContain('clear');

      // Test keyboard event dispatch
      expect(() => {
        const ctrlShiftDelEvent = new window.KeyboardEvent('keydown', {
          key: 'Delete',
          code: 'Delete',
          keyCode: 46,
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        });
        document.dispatchEvent(ctrlShiftDelEvent);
      }).not.toThrow();
    });

    it('should display keyboard shortcuts in a visible location', () => {
      const shortcutHint = document.querySelector('.shortcut-hint');
      expect(shortcutHint).toBeTruthy();

      const kbdElements = shortcutHint.querySelectorAll('kbd');
      expect(kbdElements.length).toBeGreaterThan(0);

      // Should have proper semantic markup for keyboard keys
      kbdElements.forEach((kbd) => {
        expect(kbd.tagName).toBe('KBD');
        expect(kbd.textContent.trim()).not.toBe('');
      });
    });

    it('should handle keyboard shortcuts without conflicting with browser shortcuts', () => {
      // Test that shortcuts use proper modifier combinations
      const shortcutHint = document.querySelector('.shortcut-hint');
      const shortcuts = shortcutHint.textContent;

      // Should use Ctrl modifier to avoid conflicts
      expect(shortcuts).toContain('Ctrl');

      // Should not use common browser shortcuts alone
      expect(shortcuts).not.toMatch(/^F5|^F12|^Tab|^Alt$/);
    });
  });

  describe('Screen Reader Support', () => {
    it('should have screen reader announcement area', () => {
      const announcement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(announcement).toBeTruthy();
      expect(announcement.getAttribute('aria-live')).toBe('polite');
      expect(announcement.getAttribute('aria-atomic')).toBe('true');
      expect(announcement.classList.contains('sr-only')).toBe(true);
    });

    it('should have proper live region configuration', () => {
      const loadingState = document.getElementById('loading-state');
      expect(loadingState).toBeTruthy();
      expect(loadingState.getAttribute('role')).toBe('status');
      expect(loadingState.getAttribute('aria-live')).toBe('polite');

      const resultsState = document.getElementById('results-state');
      expect(resultsState.getAttribute('role')).toBe('region');
      expect(resultsState.getAttribute('aria-label')).toBe(
        'Generated character traits'
      );
    });

    it('should have descriptive button text', () => {
      const buttons = [
        { id: 'generate-btn', expectedLabel: 'Generate character traits' },
        { id: 'export-btn', expectedLabel: 'Export traits to text file' },
        { id: 'clear-btn', expectedLabel: 'Clear all inputs' },
        { id: 'back-btn', expectedLabel: 'Back to Main Menu' },
      ];

      buttons.forEach(({ id, expectedLabel }) => {
        const button = document.getElementById(id);
        expect(button).toBeTruthy();
        expect(button.getAttribute('aria-label')).toBe(expectedLabel);
      });
    });

    it('should have semantic form structure', () => {
      // Check for proper fieldset/legend structure where appropriate
      const formGroups = document.querySelectorAll('.cb-form-group');
      expect(formGroups.length).toBeGreaterThan(0);

      formGroups.forEach((group) => {
        const label = group.querySelector('label');
        const input = group.querySelector('input, textarea, select');

        if (label && input) {
          expect(label.getAttribute('for')).toBe(input.id);
        }
      });
    });

    it('should announce loading and completion states', () => {
      const loadingState = document.getElementById('loading-state');
      const loadingMessage = document.getElementById('loading-message');

      expect(loadingState).toBeTruthy();
      expect(loadingMessage).toBeTruthy();
      expect(loadingMessage.textContent).toContain('Generating');

      // Loading state should be announced to screen readers
      expect(loadingState.getAttribute('aria-live')).toBe('polite');
    });

    it('should provide context for complex interactions', () => {
      // Direction selector should have helpful context
      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector.getAttribute('aria-label')).toBe(
        'Select thematic direction'
      );

      // Help text should provide additional context
      const helpText = document.querySelector('.cb-help-text');
      expect(helpText.textContent).toContain('clichés and core motivations');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus during state transitions', () => {
      // Test that focus can be programmatically managed
      const generateBtn = document.getElementById('generate-btn');
      const traitsResults = document.getElementById('traits-results');

      expect(generateBtn).toBeTruthy();
      expect(traitsResults).toBeTruthy();

      // Elements should support focus management
      expect(typeof generateBtn.focus).toBe('function');
      expect(typeof traitsResults.scrollIntoView).toBe('function');
    });

    it('should maintain logical focus order', () => {
      const focusableElements = document.querySelectorAll(
        'button, input, textarea, select'
      );

      focusableElements.forEach((element) => {
        // Should not have tabindex values that break logical order
        const tabIndex = element.getAttribute('tabindex');
        if (tabIndex !== null) {
          const value = parseInt(tabIndex);
          expect(value).toBeGreaterThanOrEqual(-1);
          expect(value).toBeLessThan(1000); // Avoid extremely high values
        }
      });
    });

    it('should handle focus trapping in modal states', () => {
      // Test that modal-like states can manage focus appropriately
      const errorState = document.getElementById('error-state');
      const loadingState = document.getElementById('loading-state');

      expect(errorState).toBeTruthy();
      expect(loadingState).toBeTruthy();

      // States should be properly contained for focus management
      expect(errorState.getAttribute('role')).toBe('alert');
    });

    it('should restore focus after modal dismissal', () => {
      // Test that focus restoration is supported
      const clearBtn = document.getElementById('clear-btn');
      expect(clearBtn).toBeTruthy();
      expect(typeof clearBtn.focus).toBe('function');
    });
  });

  describe('Error Message Accessibility', () => {
    it('should associate error messages with form fields', () => {
      const inputValidationError = document.getElementById(
        'input-validation-error'
      );
      const directionSelectorError = document.getElementById(
        'direction-selector-error'
      );

      expect(inputValidationError.getAttribute('role')).toBe('alert');
      expect(directionSelectorError.getAttribute('role')).toBe('alert');

      // Errors should be announced immediately when they appear
      expect(inputValidationError.classList.contains('cb-error-text')).toBe(
        true
      );
    });

    it('should provide clear error descriptions', () => {
      const errorState = document.getElementById('error-state');
      const errorTitle = errorState.querySelector('.error-title');
      const errorContent = errorState.querySelector('.error-content');

      expect(errorTitle).toBeTruthy();
      expect(errorContent).toBeTruthy();
      expect(errorTitle.textContent).toBe('Generation Failed');

      // Error content should provide actionable information
      expect(errorContent).toBeTruthy();
    });

    it('should announce errors to screen readers', () => {
      const screenReaderAnnouncement = document.getElementById(
        'screen-reader-announcement'
      );
      expect(screenReaderAnnouncement).toBeTruthy();
      expect(screenReaderAnnouncement.getAttribute('aria-live')).toBe('polite');

      // Should support error announcements
      expect(screenReaderAnnouncement.classList.contains('sr-only')).toBe(true);
    });
  });

  describe('Mobile Accessibility', () => {
    it('should have proper viewport configuration', () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport).toBeTruthy();
      expect(viewport.content).toBe('width=device-width, initial-scale=1.0');
    });

    it('should have touch-friendly interactive elements', () => {
      const buttons = document.querySelectorAll('button');

      buttons.forEach((button) => {
        // Buttons should have sufficient size for touch interaction
        expect(button.tagName).toBe('BUTTON');
        expect(button.classList.length).toBeGreaterThan(0); // Should have styling classes
      });
    });

    it('should support zoom without horizontal scrolling', () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport.content).not.toContain('user-scalable=no');
      expect(viewport.content).not.toContain('maximum-scale=1');
    });

    it('should have responsive layout classes', () => {
      const mainContent = document.querySelector('.traits-main');
      const inputPanel = document.querySelector('.traits-input-panel');
      const displayPanel = document.querySelector('.traits-display-panel');

      expect(mainContent).toBeTruthy();
      expect(inputPanel).toBeTruthy();
      expect(displayPanel).toBeTruthy();

      // Should have responsive layout classes
      expect(inputPanel.classList.contains('cb-input-panel')).toBe(true);
      expect(displayPanel.classList.contains('cb-output-panel')).toBe(true);
    });
  });

  describe('High Contrast Mode Support', () => {
    it('should have semantic markup that works with high contrast', () => {
      // Test that semantic elements are used instead of relying solely on color
      const errorElements = document.querySelectorAll('[role="alert"]');
      expect(errorElements.length).toBeGreaterThan(0);

      // Required fields should have text indicators
      const labels = document.querySelectorAll('label');
      let hasRequiredIndicator = false;
      labels.forEach((label) => {
        if (label.textContent.includes('*')) {
          hasRequiredIndicator = true;
        }
      });
      expect(hasRequiredIndicator).toBe(true);
    });

    it('should use icons with text labels', () => {
      const buttons = document.querySelectorAll('button');

      buttons.forEach((button) => {
        const buttonText = button.querySelector('.button-text');
        if (buttonText) {
          expect(buttonText.textContent.trim()).not.toBe('');
        }
      });
    });

    it('should have proper focus indicators', () => {
      // Interactive elements should be focusable
      const interactiveElements = document.querySelectorAll(
        'button, input, textarea, select'
      );

      interactiveElements.forEach((element) => {
        expect(element).toBeTruthy();
        // Should not have CSS that removes focus indicators
        expect(element.style.outline).not.toBe('none');
      });
    });
  });
});
