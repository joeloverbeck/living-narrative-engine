/**
 * @file Action Definition Validator - Validates action definitions for compliance
 * @description Provides comprehensive validation for action definitions to ensure
 * they meet all schema requirements and format standards
 */

/**
 * Validates action definitions for schema compliance and format requirements
 *
 * Performs comprehensive validation including:
 * - Required field presence
 * - ID format validation (namespace:identifier)
 * - Scope format validation
 * - Template validation for targeted actions
 * - Component and prerequisite ID validation
 *
 * @example
 * const validator = new ActionDefinitionValidator();
 * const result = validator.validate(actionDefinition);
 * if (!result.isValid) {
 *   console.error('Validation errors:', result.errors);
 * }
 */
export class ActionDefinitionValidator {
  /**
   * Validates an action definition
   *
   * @param {object} definition - The action definition to validate
   * @returns {{isValid: boolean, errors: string[]}} Validation result
   * @example
   * const result = validator.validate({
   *   id: 'core:attack',
   *   name: 'Attack',
   *   description: 'Attack a target',
   *   scope: 'core:nearby_actors',
   *   template: 'attack {target}',
   *   prerequisites: ['core:actor-can-move'],
   *   required_components: { actor: ['core:position'] }
   * });
   */
  validate(definition) {
    const errors = [];

    // Handle null/undefined definition
    if (!definition || typeof definition !== 'object') {
      errors.push('Definition must be a valid object');
      return {
        isValid: false,
        errors,
      };
    }

    // Required field validation
    if (!definition.id) {
      errors.push('Action ID is required');
    }
    if (!definition.name) {
      errors.push('Action name is required');
    }
    if (!definition.description) {
      errors.push('Action description is required');
    }
    if (!definition.scope) {
      errors.push('Action scope is required');
    }
    if (!definition.template) {
      errors.push('Action template is required');
    }

    // Format validation for ID
    if (definition.id && !this.#isValidId(definition.id)) {
      errors.push(
        'Action ID must follow namespace:identifier format (e.g., "core:attack")'
      );
    }

    // Format validation for scope
    if (definition.scope) {
      if (definition.scope !== 'none' && !this.#isValidId(definition.scope)) {
        errors.push(
          'Scope must be "none" or follow namespace:identifier format (e.g., "core:nearby_actors")'
        );
      }
    }

    // Template validation for targeted actions
    if (
      definition.template &&
      definition.scope &&
      definition.scope !== 'none'
    ) {
      if (!definition.template.includes('{target}')) {
        errors.push(
          'Template for targeted actions should include {target} placeholder'
        );
      }
    }

    // Component validation
    if (definition.required_components?.actor) {
      if (!Array.isArray(definition.required_components.actor)) {
        errors.push('required_components.actor must be an array');
      } else {
        definition.required_components.actor.forEach((componentId, index) => {
          if (typeof componentId !== 'string') {
            errors.push(`Component at index ${index} must be a string`);
          } else if (!this.#isValidId(componentId)) {
            errors.push(
              `Invalid component ID at index ${index}: "${componentId}" (must follow namespace:identifier format)`
            );
          }
        });
      }
    }

    // Prerequisite validation
    if (definition.prerequisites) {
      if (!Array.isArray(definition.prerequisites)) {
        errors.push('Prerequisites must be an array');
      } else {
        definition.prerequisites.forEach((prereq, index) => {
          if (typeof prereq === 'string') {
            if (!this.#isValidId(prereq)) {
              errors.push(
                `Invalid prerequisite ID at index ${index}: "${prereq}" (must follow namespace:identifier format)`
              );
            }
          } else if (prereq && typeof prereq === 'object') {
            if (prereq.logic?.condition_ref) {
              if (typeof prereq.logic.condition_ref !== 'string') {
                errors.push(
                  `Prerequisite condition_ref at index ${index} must be a string`
                );
              } else if (!this.#isValidId(prereq.logic.condition_ref)) {
                errors.push(
                  `Invalid prerequisite condition_ref at index ${index}: "${prereq.logic.condition_ref}" (must follow namespace:identifier format)`
                );
              }
            } else {
              errors.push(
                `Invalid prerequisite format at index ${index}: expected string or object with logic.condition_ref`
              );
            }

            // Validate failure_message if present
            if (
              prereq.failure_message !== undefined &&
              typeof prereq.failure_message !== 'string'
            ) {
              errors.push(
                `Prerequisite failure_message at index ${index} must be a string`
              );
            }
          } else {
            errors.push(
              `Invalid prerequisite format at index ${index}: expected string or object`
            );
          }
        });
      }
    }

    // Validate required_components structure
    if (definition.required_components !== undefined) {
      if (
        !definition.required_components ||
        typeof definition.required_components !== 'object'
      ) {
        errors.push('required_components must be an object');
      } else if (!definition.required_components.actor) {
        errors.push('required_components must have an "actor" property');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates that an ID follows the namespace:identifier format
   *
   * @private
   * @param {string} id - The ID to validate
   * @returns {boolean} True if the ID is valid
   * @example
   * this.#isValidId('core:attack') // returns true
   * this.#isValidId('invalid-id') // returns false
   */
  #isValidId(id) {
    // Validate namespace:identifier format
    // Namespace: alphanumeric + underscore (must start with letter or underscore)
    // Identifier: alphanumeric + underscore + hyphen (must start with letter, underscore, or number)
    return /^[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(id);
  }
}

export default ActionDefinitionValidator;
