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
