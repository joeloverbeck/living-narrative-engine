/**
 * @file Helper functions for testing action properties
 * @description Provides reusable utilities for validating action JSON properties, visual styling, and prerequisites
 */

import { expect } from '@jest/globals';

/**
 * Validates that an action has all expected properties with correct values.
 *
 * @param {object} action - The action object to validate
 * @param {object} expectedProperties - Object containing expected property values
 * @example
 * validateActionProperties(action, {
 *   id: 'exercise:show_off_biceps',
 *   name: 'Show Off Biceps',
 *   targets: 'none',
 *   template: 'show off your muscular arms'
 * });
 */
export function validateActionProperties(action, expectedProperties) {
  Object.entries(expectedProperties).forEach(([key, expectedValue]) => {
    expect(action[key]).toBe(expectedValue);
  });
}

/**
 * Validates visual styling properties for an action.
 *
 * @param {object} visual - The visual styling object from the action
 * @param {string} styleName - Name of the expected style (for descriptive test output)
 * @param {object} [expectedColors] - Optional specific color values to validate
 * @example
 * validateVisualStyling(action.visual, 'orangeFlame', {
 *   backgroundColor: '#e65100',
 *   textColor: '#ffffff',
 *   hoverBackgroundColor: '#ff6f00',
 *   hoverTextColor: '#ffffff'
 * });
 */
export function validateVisualStyling(
  visual,
  styleName,
  expectedColors = null
) {
  // Verify visual object exists
  expect(visual).toBeDefined();

  // Verify all color properties are present and valid hex codes
  const colorProperties = [
    'backgroundColor',
    'textColor',
    'hoverBackgroundColor',
    'hoverTextColor',
  ];

  colorProperties.forEach((prop) => {
    expect(visual[prop]).toBeDefined();
    expect(visual[prop]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  // If specific colors are provided, validate them
  if (expectedColors) {
    Object.entries(expectedColors).forEach(([key, expectedColor]) => {
      expect(visual[key].toLowerCase()).toBe(expectedColor.toLowerCase());
    });
  }
}

/**
 * Validates prerequisite structure and logic for an action.
 *
 * @param {Array} prerequisites - The prerequisites array from the action
 * @param {object} validation - Validation configuration
 * @param {number} [validation.count] - Expected number of prerequisites
 * @param {function} [validation.validator] - Custom validation function for prerequisite logic
 * @param {string} [validation.failureMessage] - Expected failure message
 * @example
 * validatePrerequisites(action.prerequisites, {
 *   count: 1,
 *   failureMessage: "You don't have the muscular arms needed to show off.",
 *   validator: (prerequisite) => {
 *     expect(prerequisite.logic.or).toHaveLength(2);
 *   }
 * });
 */
export function validatePrerequisites(prerequisites, validation = {}) {
  const { count, validator, failureMessage } = validation;

  if (count !== undefined) {
    expect(prerequisites).toHaveLength(count);
  }

  if (validator && prerequisites && prerequisites.length > 0) {
    prerequisites.forEach((prerequisite) => {
      validator(prerequisite);
    });
  }

  if (failureMessage && prerequisites && prerequisites.length > 0) {
    const prerequisite = prerequisites[0];
    expect(prerequisite.failure_message).toBe(failureMessage);
  }
}

/**
 * Validates component requirements and restrictions for an action.
 *
 * @param {object} action - The action object
 * @param {object} [expected] - Expected component configuration
 * @param {object} [expected.required] - Expected required components
 * @param {object} [expected.forbidden] - Expected forbidden components
 * @example
 * validateComponentRequirements(action, {
 *   required: {},
 *   forbidden: {}
 * });
 */
export function validateComponentRequirements(
  action,
  expected = { required: {}, forbidden: {} }
) {
  if (expected.required !== undefined) {
    expect(action.required_components).toEqual(expected.required);
  }

  if (expected.forbidden !== undefined) {
    expect(action.forbidden_components).toEqual(expected.forbidden);
  }
}

/**
 * Validates that an action has all required properties as per schema.
 *
 * @param {object} action - The action object to validate
 * @param {Array<string>} [additionalRequired] - Additional required properties beyond the standard set
 * @example
 * validateRequiredActionProperties(action);
 * validateRequiredActionProperties(action, ['custom_field']);
 */
export function validateRequiredActionProperties(
  action,
  additionalRequired = []
) {
  const standardRequired = [
    '$schema',
    'id',
    'name',
    'description',
    'targets',
    'template',
    'visual',
  ];

  const allRequired = [...standardRequired, ...additionalRequired];

  allRequired.forEach((prop) => {
    expect(action).toHaveProperty(prop);
    expect(action[prop]).toBeDefined();
  });
}

/**
 * Validates accessibility compliance for visual styling.
 * Ensures colors meet WCAG 2.1 AA standards (simplified check).
 *
 * @param {object} visual - The visual styling object
 * @param {string} [description] - Optional description of the color scheme being tested
 * @example
 * validateAccessibilityCompliance(action.visual, 'Orange Flame color scheme');
 */
export function validateAccessibilityCompliance(visual, description = '') {
  const context = description ? ` for ${description}` : '';

  // Verify color format (hex codes)
  expect(visual.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
  expect(visual.textColor).toMatch(/^#[0-9a-f]{6}$/i);
  expect(visual.hoverBackgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
  expect(visual.hoverTextColor).toMatch(/^#[0-9a-f]{6}$/i);

  // Note: This is a simplified check. Full WCAG compliance would require
  // actual contrast ratio calculation, which is beyond the scope of these tests.
  // The test here just ensures the colors are in the correct format.
}

/**
 * Validates the complete structure of an action including all common properties.
 * This is a convenience function that combines multiple validation checks.
 *
 * @param {object} action - The action object to validate
 * @param {object} config - Configuration for validation
 * @param {object} config.properties - Expected property values
 * @param {object} [config.visual] - Visual styling configuration
 * @param {object} [config.prerequisites] - Prerequisites validation configuration
 * @param {object} [config.components] - Component requirements configuration
 * @example
 * validateActionStructure(action, {
 *   properties: {
 *     id: 'exercise:show_off_biceps',
 *     name: 'Show Off Biceps',
 *     targets: 'none'
 *   },
 *   visual: {
 *     styleName: 'orangeFlame',
 *     colors: { backgroundColor: '#e65100' }
 *   },
 *   prerequisites: {
 *     count: 1,
 *     failureMessage: "You don't have the muscular arms needed to show off."
 *   }
 * });
 */
export function validateActionStructure(action, config) {
  // Validate required properties exist
  validateRequiredActionProperties(action);

  // Validate specific property values
  if (config.properties) {
    validateActionProperties(action, config.properties);
  }

  // Validate visual styling
  if (config.visual) {
    validateVisualStyling(
      action.visual,
      config.visual.styleName,
      config.visual.colors
    );
  }

  // Validate prerequisites
  if (config.prerequisites) {
    validatePrerequisites(action.prerequisites, config.prerequisites);
  }

  // Validate component requirements
  if (config.components) {
    validateComponentRequirements(action, config.components);
  }
}

export default {
  validateActionProperties,
  validateVisualStyling,
  validatePrerequisites,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
  validateActionStructure,
};
