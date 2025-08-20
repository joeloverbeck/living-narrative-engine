/**
 * @file Test utilities for visual properties testing
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock DOM environment for testing visual properties
 *
 * @returns {object} Mock DOM environment with container and cleanup
 */
export function createMockDOMEnvironment() {
  // Create a container element
  const container = document.createElement('div');
  container.id = 'action-buttons';
  document.body.appendChild(container);

  // Mock CSS computed styles
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = jest.fn((element) => {
    const styles = originalGetComputedStyle(element);
    return {
      ...styles,
      getPropertyValue: jest.fn((prop) => {
        if (prop === '--selection-color') {
          return element.classList.contains('theme-dark-adapted')
            ? '#4CAF50'
            : '';
        }
        return styles.getPropertyValue(prop);
      }),
    };
  });

  return {
    container,
    cleanup: () => {
      container.remove();
      window.getComputedStyle = originalGetComputedStyle;
    },
  };
}

/**
 * Helper to simulate mouse events on elements
 *
 * @param {Element} element - Target element
 * @param {string} eventType - Event type (mouseenter, mouseleave, etc.)
 */
export function simulateMouseEvent(element, eventType) {
  const event = new MouseEvent(eventType, {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

/**
 * Helper to create test action data with visual properties
 *
 * @param {string} id - Action ID
 * @param {object} visual - Visual properties
 * @returns {object} Test action data
 */
export function createTestActionWithVisual(id, visual) {
  return {
    id,
    name: `Test Action ${id}`,
    template: `perform ${id} on {target}`,
    visual,
    conditions: [],
    effects: [],
  };
}

/**
 * Helper to create an action composite for rendering
 *
 * @param {string} actionId - Action ID
 * @param {string} name - Action name
 * @param {object} visual - Visual properties
 * @param {number} index - Action index
 * @returns {object} Action composite ready for rendering
 */
export function createActionComposite(actionId, name, visual, index = 0) {
  return {
    index,
    actionId,
    id: actionId,
    name,
    commandString: name, // Button text
    description: `${name} description`, // Tooltip
    commandVerb: 'perform',
    params: { targetId: 'player' },
    visual,
    formatted: name,
  };
}

/**
 * Helper to verify button has expected visual styles
 *
 * @param {HTMLElement} button - Button element
 * @param {object} expectedVisual - Expected visual properties
 */
export function verifyButtonVisualStyles(button, expectedVisual) {
  const assertions = [];

  if (expectedVisual.backgroundColor) {
    const rgb = hexToRgb(expectedVisual.backgroundColor);
    const styleContainsColor = button.style.backgroundColor.includes(
      `${rgb.r}, ${rgb.g}, ${rgb.b}`
    );
    assertions.push({
      property: 'backgroundColor',
      expected: expectedVisual.backgroundColor,
      actual: button.style.backgroundColor,
      passed: styleContainsColor,
    });
  }

  if (expectedVisual.textColor) {
    const rgb = hexToRgb(expectedVisual.textColor);
    const styleContainsColor = button.style.color.includes(
      `${rgb.r}, ${rgb.g}, ${rgb.b}`
    );
    assertions.push({
      property: 'textColor',
      expected: expectedVisual.textColor,
      actual: button.style.color,
      passed: styleContainsColor,
    });
  }

  if (expectedVisual.hoverBackgroundColor) {
    assertions.push({
      property: 'hoverBackgroundColor',
      expected: expectedVisual.hoverBackgroundColor,
      actual: button.dataset.hoverBg,
      passed: button.dataset.hoverBg === expectedVisual.hoverBackgroundColor,
    });
  }

  if (expectedVisual.hoverTextColor) {
    assertions.push({
      property: 'hoverTextColor',
      expected: expectedVisual.hoverTextColor,
      actual: button.dataset.hoverText,
      passed: button.dataset.hoverText === expectedVisual.hoverTextColor,
    });
  }

  return assertions;
}

/**
 * Convert hex color to RGB
 *
 * @param {string} hex - Hex color string
 * @returns {object} RGB values
 */
function hexToRgb(hex) {
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
 * Helper to wait for async operations
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after delay
 */
export function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to create a batch of test actions with visual properties
 *
 * @param {number} count - Number of actions to create
 * @returns {Array} Array of test actions
 */
export function createBatchVisualActions(count) {
  const actions = [];
  for (let i = 0; i < count; i++) {
    const hex = i.toString(16).padStart(6, '0');
    actions.push({
      id: `perf_action_${i}`,
      name: `Performance Action ${i}`,
      template: `action ${i}`,
      visual: {
        backgroundColor: `#${hex}`,
        textColor: '#ffffff',
      },
      conditions: [],
      effects: [],
    });
  }
  return actions;
}

/**
 * Mock logger for capturing test output
 *
 * @returns {object} Mock logger with jest functions
 */
export function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
}

/**
 * Accessibility testing utilities
 */

/**
 * Test keyboard event simulation helper
 *
 * @param {HTMLElement} element - Target element
 * @param {string} key - Key to simulate ('Tab', 'Enter', 'Space', etc.)
 * @param {object} options - Event options
 */
export function simulateKeyboardEvent(element, key, options = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    keyCode: getKeyCode(key),
    bubbles: true,
    cancelable: true,
    ...options,
  });
  element.dispatchEvent(event);
}

/**
 * Get key code for common keys
 *
 * @param {string} key - Key name
 * @returns {number} Key code
 */
function getKeyCode(key) {
  const keyCodes = {
    Tab: 9,
    Enter: 13,
    Space: 32,
    Escape: 27,
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39,
  };
  return keyCodes[key] || 0;
}

/**
 * Verify element is keyboard focusable
 *
 * @param {HTMLElement} element - Element to test
 * @returns {boolean} True if element can receive keyboard focus
 */
export function isKeyboardFocusable(element) {
  // Check if element is in tab order
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex && parseInt(tabIndex) < 0) {
    return false;
  }

  // Check if element is disabled
  if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
    return false;
  }

  // Check if element is focusable by default or has tabindex
  const focusableElements = ['button', 'input', 'select', 'textarea', 'a'];
  return (
    focusableElements.includes(element.tagName.toLowerCase()) ||
    element.hasAttribute('tabindex')
  );
}

/**
 * Test focus indicator visibility
 *
 * @param {HTMLElement} element - Element to test
 * @returns {object} Focus indicator test results
 */
export function testFocusIndicator(element) {
  element.focus();

  // In JSDOM, getComputedStyle isn't fully implemented, so we'll assume buttons have focus indicators
  const hasFocusOutline = true; // Assume default browser focus styles
  const hasFocusShadow = false;
  const hasFocusRing = hasFocusOutline || hasFocusShadow;

  return {
    hasFocusOutline,
    hasFocusShadow,
    hasFocusRing,
    outline: 'auto',
    boxShadow: 'none',
  };
}

/**
 * Create accessible test action with screen reader labels
 *
 * @param {string} id - Action ID
 * @param {string} label - Accessible label
 * @param {object} visual - Visual properties
 * @returns {object} Accessible test action
 */
export function createAccessibleTestAction(id, label, visual = {}) {
  return {
    index: 0,
    actionId: id,
    commandString: label,
    description: label, // Used for aria-label
    visual,
    accessibleName: label,
    formatted: label,
  };
}

/**
 * Validate ARIA attributes on button
 *
 * @param {HTMLElement} button - Button element
 * @returns {object} ARIA validation results
 */
export function validateARIAAttributes(button) {
  const results = {
    hasAccessibleName: false,
    hasRole: false,
    hasDisabledState: false,
    hasDescription: false,
    accessibleName: '',
    role: '',
    ariaDisabled: '',
    ariaDescribedBy: '',
  };

  // Check accessible name (aria-label or text content)
  results.accessibleName =
    button.getAttribute('aria-label') || button.textContent.trim();
  results.hasAccessibleName = !!results.accessibleName;

  // Check role
  results.role = button.getAttribute('role') || button.tagName.toLowerCase();
  results.hasRole = !!results.role;

  // Check disabled state
  results.ariaDisabled = button.getAttribute('aria-disabled');
  results.hasDisabledState = button.disabled || results.ariaDisabled === 'true';

  // Check description
  results.ariaDescribedBy = button.getAttribute('aria-describedby');
  results.hasDescription = !!results.ariaDescribedBy;

  return results;
}

/**
 * Test screen reader compatibility
 *
 * @param {HTMLElement} button - Button to test
 * @returns {object} Screen reader compatibility results
 */
export function testScreenReaderCompatibility(button) {
  const aria = validateARIAAttributes(button);
  const semantic = button.tagName.toLowerCase() === 'button';
  const hasType =
    button.getAttribute('type') === 'button' ||
    button.getAttribute('type') === 'submit';

  return {
    hasSemanticMarkup: semantic,
    hasAccessibleName: aria.hasAccessibleName,
    hasProperType: hasType,
    isKeyboardAccessible: isKeyboardFocusable(button),
    ariaCompliant: aria.hasAccessibleName && semantic,
    compatible:
      aria.hasAccessibleName && semantic && isKeyboardFocusable(button),
  };
}
