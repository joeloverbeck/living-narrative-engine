/**
 * @file Error for invalid property values
 * @description Enhanced error for property values that don't match schema constraints
 */

import AnatomyError from './AnatomyError.js';

/**
 * Error thrown when a property value is invalid according to the component schema
 *
 * @class
 * @augments {AnatomyError}
 */
class InvalidPropertyError extends AnatomyError {
  /**
   * Creates a new InvalidPropertyError instance
   *
   * @param {object} params - Error parameters
   * @param {string} params.recipeId - The recipe ID where the error occurred
   * @param {object} params.location - Location within the recipe
   * @param {string} params.location.type - Type of location (e.g., 'slot', 'pattern')
   * @param {string} params.location.name - Name of the location (e.g., slot name)
   * @param {string} params.componentId - The component ID containing the property
   * @param {string} params.property - The property name with invalid value
   * @param {*} params.currentValue - The current (invalid) value
   * @param {Array<*>} [params.validValues] - Array of valid values
   * @param {string} [params.suggestion] - Suggested fix value
   * @param {string} [params.schemaPath] - Path to the component schema
   */
  constructor({
    recipeId,
    location,
    componentId,
    property,
    currentValue,
    validValues,
    suggestion,
    schemaPath,
  }) {
    const fixes = [`Change property value to valid enum option`];

    // Add valid values to fix section first
    if (validValues && validValues.length > 0) {
      fixes.unshift(
        `Valid Values: [${validValues.map((v) => `"${v}"`).join(', ')}]`
      );
    }

    if (suggestion) {
      fixes.push('');
      fixes.push('Suggested Fix:');
      fixes.push(
        `  "${property}": "${suggestion}"  // Changed from "${currentValue}"`
      );
    }

    const references = [];
    if (schemaPath) {
      references.push(`Component Schema: ${schemaPath}`);
    }

    super({
      context: `Recipe '${recipeId}', ${location.type} '${location.name}', Component '${componentId}'`,
      problem: `Property '${property}' has invalid value '${currentValue}'`,
      impact: `Runtime validation will fail when entity is instantiated`,
      fix: fixes,
      references,
    });

    this.recipeId = recipeId;
    this.componentId = componentId;
    this.property = property;
    this.currentValue = currentValue;
    this.validValues = validValues;
    this.suggestion = suggestion;
  }
}

export default InvalidPropertyError;
