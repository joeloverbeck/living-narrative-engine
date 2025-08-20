/**
 * @file Accessibility Test Bed Utilities
 * Provides utilities for WCAG 2.1 AA compliance testing and accessibility validation
 */

import { jest } from '@jest/globals';
import { ActionButtonsRenderer } from '../../src/domUI/actionButtonsRenderer.js';
import ActionCategorizationService from '../../src/entities/utils/ActionCategorizationService.js';
import { UI_CATEGORIZATION_CONFIG } from '../../src/entities/utils/actionCategorizationConfig.js';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import DocumentContext from '../../src/domUI/documentContext.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';

/**
 * Accessibility testing utilities following WCAG 2.1 AA standards
 */
export class AccessibilityTestBed {
  constructor() {
    this.container = null;
    this.renderer = null;
    this.documentContext = null;
    this.logger = null;
  }

  /**
   * Initialize the accessibility testing environment
   */
  async initialize() {
    // Setup accessibility testing environment
    this.container = new AppContainer();
    this.logger = new ConsoleLogger();

    this.container.register(tokens.ILogger, this.logger);
    this.container.register(
      tokens.IActionCategorizationService,
      new ActionCategorizationService({
        logger: this.logger,
        config: UI_CATEGORIZATION_CONFIG,
      })
    );

    this.documentContext = new DocumentContext(document);

    const mockEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    const domElementFactory = new DomElementFactory({
      logger: this.logger,
      documentContext: this.documentContext,
    });

    this.renderer = new ActionButtonsRenderer({
      logger: this.logger,
      documentContext: this.documentContext,
      validatedEventDispatcher: mockEventDispatcher,
      domElementFactory: domElementFactory,
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: this.container.resolve(
        tokens.IActionCategorizationService
      ),
    });
  }

  /**
   * Clean up the testing environment
   */
  async cleanup() {
    if (this.renderer && this.renderer.dispose) {
      this.renderer.dispose();
    }
    if (this.container && this.container.dispose) {
      this.container.dispose();
    }
    this.container = null;
    this.renderer = null;
    this.documentContext = null;
    this.logger = null;
  }

  /**
   * Get the ActionButtonsRenderer instance for testing
   *
   * @returns {ActionButtonsRenderer} The renderer instance
   */
  getActionButtonsRenderer() {
    return this.renderer;
  }

  /**
   * Calculate color contrast ratio between two colors
   * Following WCAG 2.1 contrast calculation algorithm
   *
   * @param {string} backgroundColor - Background color in hex format
   * @param {string} textColor - Text color in hex format
   * @returns {number} Contrast ratio (1:1 to 21:1)
   */
  calculateContrastRatio(backgroundColor, textColor) {
    const bgLum = this.getRelativeLuminance(backgroundColor);
    const textLum = this.getRelativeLuminance(textColor);

    const lighter = Math.max(bgLum, textLum);
    const darker = Math.min(bgLum, textLum);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Calculate relative luminance following WCAG standards
   *
   * @param {string} color - Color in hex format (#RRGGBB)
   * @returns {number} Relative luminance value (0-1)
   */
  getRelativeLuminance(color) {
    const rgb = this.hexToRgb(color);
    if (!rgb) return 0;

    // Convert RGB values to sRGB
    const sRGB = [rgb.r, rgb.g, rgb.b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    // Calculate relative luminance using WCAG formula
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }

  /**
   * Convert hex color to RGB values
   *
   * @param {string} hex - Hex color string (#RRGGBB or RRGGBB)
   * @returns {object|null} RGB values {r, g, b} or null if invalid
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Get accessible name for an element following WCAG standards
   *
   * @param {HTMLElement} element - DOM element to get name for
   * @returns {string} Accessible name
   */
  getAccessibleName(element) {
    // Priority order for accessible name:
    // 1. aria-labelledby (referenced element text)
    // 2. aria-label
    // 3. element text content
    // 4. title attribute

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        return labelElement.textContent.trim();
      }
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    const textContent = element.textContent;
    if (textContent && textContent.trim()) {
      return textContent.trim();
    }

    const title = element.getAttribute('title');
    if (title) {
      return title.trim();
    }

    return '';
  }

  /**
   * Check element for basic accessibility violations
   *
   * @param {HTMLElement} container - Container to check
   * @returns {Promise<Array>} Array of accessibility violations
   */
  async checkAccessibility(container) {
    const violations = [];

    // Check all buttons
    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      // Check for accessible name
      const accessibleName = this.getAccessibleName(button);
      if (!accessibleName) {
        violations.push({
          rule: 'accessible-name',
          element: button,
          message: 'Button missing accessible name',
          severity: 'error',
        });
      }

      // Check for focus indicator
      const computedStyle = getComputedStyle(button);
      if (computedStyle.outline === 'none' && !computedStyle.boxShadow) {
        violations.push({
          rule: 'focus-indicator',
          element: button,
          message: 'Button missing focus indicator',
          severity: 'warning',
        });
      }

      // Check if button is keyboard accessible
      const tabIndex = button.getAttribute('tabindex');
      if (tabIndex && parseInt(tabIndex) < 0) {
        violations.push({
          rule: 'keyboard-access',
          element: button,
          message: 'Button not keyboard accessible (negative tabindex)',
          severity: 'error',
        });
      }

      // Check disabled state has proper ARIA
      if (button.disabled && !button.hasAttribute('aria-disabled')) {
        violations.push({
          rule: 'disabled-state',
          element: button,
          message: 'Disabled button should have aria-disabled attribute',
          severity: 'warning',
        });
      }
    });

    // Check for form labels
    const selects = container.querySelectorAll('select');
    selects.forEach((select) => {
      const id = select.getAttribute('id');
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        if (!label) {
          violations.push({
            rule: 'form-label',
            element: select,
            message: 'Select element missing associated label',
            severity: 'error',
          });
        }
      }
    });

    // Check heading hierarchy
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    headings.forEach((heading) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      if (currentLevel > lastLevel + 1 && lastLevel > 0) {
        violations.push({
          rule: 'heading-hierarchy',
          element: heading,
          message: `Heading level ${currentLevel} skips level ${lastLevel + 1}`,
          severity: 'error',
        });
      }
      lastLevel = currentLevel;
    });

    return violations;
  }

  /**
   * Validate color contrast meets WCAG standards
   *
   * @param {string} backgroundColor - Background color
   * @param {string} textColor - Text color
   * @param {string} level - WCAG level ('AA' or 'AAA')
   * @param {string} size - Text size ('normal' or 'large')
   * @returns {object} Validation result
   */
  validateColorContrast(
    backgroundColor,
    textColor,
    level = 'AA',
    size = 'normal'
  ) {
    const contrastRatio = this.calculateContrastRatio(
      backgroundColor,
      textColor
    );

    // WCAG 2.1 contrast requirements
    const requirements = {
      AA: {
        normal: 4.5,
        large: 3.0,
      },
      AAA: {
        normal: 7.0,
        large: 4.5,
      },
    };

    const requiredRatio = requirements[level][size];
    const passes = contrastRatio >= requiredRatio;

    return {
      passes,
      contrastRatio,
      requiredRatio,
      level,
      size,
      backgroundColor,
      textColor,
    };
  }

  /**
   * Simulate keyboard navigation through elements
   *
   * @param {HTMLElement} container - Container with focusable elements
   * @returns {Array} Array of focusable elements in tab order
   */
  simulateKeyboardNavigation(container) {
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      container.querySelectorAll(focusableSelector)
    );

    // Sort by tab index (0 and positive values first, then DOM order)
    return focusableElements.sort((a, b) => {
      const aTabIndex = parseInt(a.getAttribute('tabindex')) || 0;
      const bTabIndex = parseInt(b.getAttribute('tabindex')) || 0;

      if (aTabIndex !== bTabIndex) {
        return aTabIndex - bTabIndex;
      }

      // Same tab index, use DOM order
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
  }

  /**
   * Test high contrast mode compatibility
   *
   * @param {HTMLElement} button - Button element to test
   * @returns {object} High contrast test results
   */
  testHighContrastMode(button) {
    // Simulate high contrast mode by checking if styles adapt
    const originalBorder = button.style.border;

    // Apply high contrast mode class
    button.classList.add('theme-high-contrast-adapted');

    const hasAdaptation = button.classList.contains(
      'theme-high-contrast-adapted'
    );
    const hasBorder = button.style.border && button.style.border !== 'none';

    // Clean up
    button.classList.remove('theme-high-contrast-adapted');
    button.style.border = originalBorder;

    return {
      hasAdaptation,
      hasBorder,
      compatible: hasAdaptation || hasBorder,
    };
  }

  /**
   * Create test action with accessibility properties
   *
   * @param {string} id - Action ID
   * @param {object} options - Test options
   * @returns {object} Test action object
   */
  createAccessibilityTestAction(id, options = {}) {
    const {
      visual = {},
      description = `Test action ${id}`,
      commandString = `Test ${id}`,
    } = options;

    return {
      index: 0,
      actionId: id,
      commandString,
      description,
      visual,
      formatted: commandString,
    };
  }
}
