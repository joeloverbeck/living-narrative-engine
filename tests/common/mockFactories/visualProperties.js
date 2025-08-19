/**
 * @file Visual properties test utilities
 * @description Provides test helpers and constants for visual properties testing
 */

import { jest } from '@jest/globals';

/**
 * Valid color values for testing
 */
export const VALID_COLORS = {
  hex3: '#f00',
  hex6: '#ff0000',
  hexUpper: '#FF0000',
  hex8: '#ff0000ff',
  rgb: 'rgb(255, 0, 0)',
  rgbSpaces: 'rgb( 255 , 0 , 0 )',
  rgba: 'rgba(255, 0, 0, 0.5)',
  rgbaFull: 'rgba(255, 0, 0, 1)',
  named: 'red',
  namedExtended: 'darkslateblue',
  transparent: 'transparent',
  currentColor: 'currentColor',
};

/**
 * Invalid color values for testing
 */
export const INVALID_COLORS = {
  hexInvalid: '#gg0000',
  hexWrongLength: '#12345',
  hexTooShort: '#ff',
  hexTooLong: '#ff0000ff00',
  rgbOutOfRange: 'rgb(256, 0, 0)',
  rgbNegative: 'rgb(-1, 0, 0)',
  rgbaMalformed: 'rgba(255, 0, 0)',
  rgbMissing: 'rgb(255, 0)',
  notAColor: 'notacolor',
  incomplete: '#',
  empty: '',
  number: 123,
  object: { color: 'red' },
  array: ['red'],
  nullValue: null,
  undefinedValue: undefined,
};

/**
 * Creates a mock ActionComposite object for testing
 *
 * @param {object} overrides - Properties to override in the composite
 * @returns {object} Mock ActionComposite
 */
export const createMockActionComposite = (overrides = {}) => ({
  index: 1,
  actionId: 'test:action',
  commandString: 'Test Action',
  params: {},
  description: 'Test action description',
  visual: null,
  ...overrides,
});

/**
 * Creates a mock ActionComposite with visual properties
 *
 * @param {object} visualProps - Visual properties to include
 * @param {object} overrides - Other properties to override
 * @returns {object} Mock ActionComposite with visual properties
 */
export const createMockActionCompositeWithVisual = (
  visualProps = {},
  overrides = {}
) => {
  const defaultVisual = {
    backgroundColor: '#ff0000',
    textColor: '#ffffff',
    ...visualProps,
  };

  return createMockActionComposite({
    visual: defaultVisual,
    ...overrides,
  });
};

/**
 * Asserts that a button element has the expected visual styles applied
 *
 * @param {HTMLElement} button - The button element to check
 * @param {object} expectedVisual - Expected visual properties
 */
export const assertButtonHasVisualStyles = (button, expectedVisual) => {
  if (!button) {
    throw new Error('Button element is required for visual style assertion');
  }

  if (expectedVisual.backgroundColor) {
    const bgColor =
      button.style.backgroundColor ||
      button.style.getPropertyValue('background-color');
    expect(bgColor).toBeTruthy();
    // Handle both hex and rgb formats
    if (expectedVisual.backgroundColor.startsWith('#')) {
      expect(bgColor.toLowerCase()).toContain(
        expectedVisual.backgroundColor.replace('#', '').toLowerCase()
      );
    } else {
      expect(bgColor).toContain(expectedVisual.backgroundColor);
    }
  }

  if (expectedVisual.textColor) {
    const color = button.style.color || button.style.getPropertyValue('color');
    expect(color).toBeTruthy();
    // Handle both hex and rgb formats
    if (expectedVisual.textColor.startsWith('#')) {
      expect(color.toLowerCase()).toContain(
        expectedVisual.textColor.replace('#', '').toLowerCase()
      );
    } else {
      expect(color).toContain(expectedVisual.textColor);
    }
  }

  if (expectedVisual.hoverBackgroundColor || expectedVisual.hoverTextColor) {
    expect(button.dataset.hasCustomHover).toBe('true');
  }
};

/**
 * Creates a collection of test action composites with various visual properties
 *
 * @param {number} count - Number of composites to create
 * @returns {Array} Array of mock ActionComposite objects
 */
export const createMockActionCompositesWithVariedVisuals = (count = 5) => {
  const visualVariations = [
    null,
    { backgroundColor: '#ff0000' },
    { textColor: '#00ff00' },
    { backgroundColor: '#0000ff', textColor: '#ffffff' },
    {
      backgroundColor: '#ffff00',
      textColor: '#000000',
      hoverBackgroundColor: '#ff00ff',
      hoverTextColor: '#ffffff',
    },
  ];

  return Array.from({ length: count }, (_, i) =>
    createMockActionComposite({
      index: i + 1,
      actionId: `test:action${i}`,
      commandString: `Action ${i}`,
      description: `Description ${i}`,
      visual: visualVariations[i % visualVariations.length],
    })
  );
};

/**
 * Validates that visual properties are properly frozen (immutable)
 *
 * @param {object} visual - Visual properties object to check
 */
export const assertVisualPropertiesFrozen = (visual) => {
  if (!visual) return;

  expect(Object.isFrozen(visual)).toBe(true);

  // Check nested objects are also frozen
  Object.values(visual).forEach((value) => {
    if (typeof value === 'object' && value !== null) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });
};

/**
 * Creates a mock button element with visual styles applied
 *
 * @param {object} visual - Visual properties to apply
 * @returns {HTMLElement} Mock button element
 */
export const createMockButtonWithVisualStyles = (visual = {}) => {
  const button = {
    nodeType: 1,
    tagName: 'BUTTON',
    style: {
      backgroundColor: visual.backgroundColor || '',
      color: visual.textColor || '',
      getPropertyValue: jest.fn((prop) => {
        if (prop === 'background-color') return button.style.backgroundColor;
        if (prop === 'color') return button.style.color;
        return '';
      }),
      setProperty: jest.fn((prop, value) => {
        if (prop === 'background-color') button.style.backgroundColor = value;
        if (prop === 'color') button.style.color = value;
      }),
    },
    dataset: {
      hasCustomHover:
        visual.hoverBackgroundColor || visual.hoverTextColor ? 'true' : 'false',
    },
    setAttribute: jest.fn(),
    getAttribute: jest.fn((attr) => {
      if (attr === 'aria-label') return button.ariaLabel;
      return null;
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    ariaLabel: '',
  };

  return button;
};

/**
 * Performance test helper for visual properties validation
 *
 * @param {Function} validationFn - Function to test
 * @param {number} iterations - Number of iterations
 * @param {number} maxTime - Maximum allowed time in ms
 * @returns {object} Performance test results
 */
export const runVisualPropertiesPerformanceTest = (
  validationFn,
  iterations = 1000,
  maxTime = 100
) => {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    validationFn();
  }

  const endTime = performance.now();
  const duration = endTime - startTime;

  return {
    duration,
    iterations,
    passed: duration < maxTime,
    averageTime: duration / iterations,
  };
};
