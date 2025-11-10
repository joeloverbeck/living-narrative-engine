/**
 * @file Generates validators from component schemas
 * Supports automatic generation of validation functions with custom error messages
 */

import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * Generates validators from component schemas with validationRules
 */
class ValidatorGenerator {
  #logger;
  #similarityCalculator;

  /**
   * Creates a new ValidatorGenerator instance
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   * @param {object} params.similarityCalculator - String similarity calculator
   */
  constructor({ logger, similarityCalculator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(similarityCalculator, 'ISimilarityCalculator', logger, {
      requiredMethods: ['calculateDistance', 'findClosest'],
    });

    this.#logger = logger;
    this.#similarityCalculator = similarityCalculator;
  }

  /**
   * Generates a validator function from a component schema
   *
   * @param {object} componentSchema - Component schema with dataSchema and validationRules
   * @returns {function(object): object|null} Validator function that takes data and returns validation result
   */
  generate(componentSchema) {
    assertPresent(componentSchema, 'Component schema is required');
    assertPresent(componentSchema.dataSchema, 'Component schema must have dataSchema');

    // Check if validator generation is enabled
    if (!componentSchema.validationRules?.generateValidator) {
      this.#logger.debug(`Validator generation disabled for ${componentSchema.id}`);
      return null;
    }

    this.#logger.debug(`Generating validator for ${componentSchema.id}`);

    const validators = [];
    const dataSchema = componentSchema.dataSchema;
    const validationRules = componentSchema.validationRules;

    // Generate validators for each property
    for (const [propName, propSchema] of Object.entries(dataSchema.properties || {})) {
      // Enum validation
      if (propSchema.enum) {
        validators.push(
          this.#generateEnumValidator(propName, propSchema, validationRules)
        );
      }

      // Type validation
      if (propSchema.type) {
        validators.push(
          this.#generateTypeValidator(propName, propSchema, validationRules)
        );
      }
    }

    // Required field validation
    if (dataSchema.required && dataSchema.required.length > 0) {
      validators.push(
        this.#generateRequiredValidator(dataSchema.required, validationRules)
      );
    }

    // Combine all validators
    return this.#combineValidators(validators, componentSchema.id);
  }

  /**
   * Generates an enum validator for a property
   *
   * @private
   * @param {string} propertyName - Name of the property to validate
   * @param {object} schema - Property schema with enum values
   * @param {object} validationRules - Validation rules configuration
   * @returns {function(object): object} Validator function
   */
  #generateEnumValidator(propertyName, schema, validationRules) {
    const validValues = schema.enum;
    const errorTemplate =
      validationRules?.errorMessages?.invalidEnum ||
      "Invalid {{property}}: {{value}}. Valid options: {{validValues}}";
    const enableSuggestions = validationRules?.suggestions?.enableSimilarity !== false;
    const maxDistance = validationRules?.suggestions?.maxDistance || 3;

    return (data) => {
      const value = data[propertyName];

      // Skip only if value is undefined (handled by required validator)
      // null is a valid value to validate
      if (value === undefined) {
        return { valid: true };
      }

      if (!validValues.includes(value)) {
        let suggestion = null;

        if (enableSuggestions && typeof value === 'string') {
          suggestion = this.#similarityCalculator.findClosest(
            value,
            validValues,
            maxDistance
          );
        }

        const message = this.#formatErrorMessage(errorTemplate, {
          property: propertyName,
          value: value,
          validValues: validValues.join(', '),
        });

        return {
          valid: false,
          error: {
            type: 'invalidEnum',
            property: propertyName,
            value,
            validValues,
            message,
            suggestion,
          },
        };
      }

      return { valid: true };
    };
  }

  /**
   * Generates a type validator for a property
   *
   * @private
   * @param {string} propertyName - Name of the property to validate
   * @param {object} schema - Property schema with type definition
   * @param {object} validationRules - Validation rules configuration
   * @returns {function(object): object} Validator function
   */
  #generateTypeValidator(propertyName, schema, validationRules) {
    const expectedType = schema.type;
    const errorTemplate =
      validationRules?.errorMessages?.invalidType ||
      "Invalid type for {{field}}: expected {{expected}}, got {{actual}}";

    return (data) => {
      const value = data[propertyName];

      // Skip only if value is undefined (handled by required validator)
      // null is a valid value to validate
      if (value === undefined) {
        return { valid: true };
      }

      const actualType = this.#getJavaScriptType(value);

      if (!this.#isTypeValid(value, expectedType)) {
        const message = this.#formatErrorMessage(errorTemplate, {
          field: propertyName,
          expected: expectedType,
          actual: actualType,
        });

        return {
          valid: false,
          error: {
            type: 'invalidType',
            property: propertyName,
            expectedType,
            actualType,
            message,
          },
        };
      }

      return { valid: true };
    };
  }

  /**
   * Generates a required field validator
   *
   * @private
   * @param {string[]} requiredFields - List of required field names
   * @param {object} validationRules - Validation rules configuration
   * @returns {function(object): object} Validator function
   */
  #generateRequiredValidator(requiredFields, validationRules) {
    const errorTemplate =
      validationRules?.errorMessages?.missingRequired ||
      "Missing required field: {{field}}";

    return (data) => {
      const errors = [];

      for (const field of requiredFields) {
        const value = data[field];

        if (value === undefined || value === null || value === '') {
          const message = this.#formatErrorMessage(errorTemplate, {
            field,
          });

          errors.push({
            type: 'missingRequired',
            property: field,
            message,
          });
        }
      }

      if (errors.length > 0) {
        return {
          valid: false,
          errors,
        };
      }

      return { valid: true };
    };
  }

  /**
   * Combines multiple validators into a single validator function
   *
   * @private
   * @param {Array<Function>} validators - Array of validator functions
   * @param {string} schemaId - Schema identifier for validation result
   * @returns {function(object): object} Combined validator function
   */
  #combineValidators(validators, schemaId) {
    return (data) => {
      assertPresent(data, 'Data is required for validation');

      const allErrors = [];

      for (const validator of validators) {
        const result = validator(data);

        if (!result.valid) {
          if (result.error) {
            allErrors.push(result.error);
          }
          if (result.errors) {
            allErrors.push(...result.errors);
          }
        }
      }

      return {
        valid: allErrors.length === 0,
        errors: allErrors,
        schemaId,
      };
    };
  }

  /**
   * Formats an error message template with variables
   *
   * @private
   * @param {string} template - Error message template with placeholders
   * @param {object} variables - Variables to substitute in the template
   * @returns {string} Formatted error message
   */
  #formatErrorMessage(template, variables) {
    let message = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value);
    }

    return message;
  }

  /**
   * Gets the JavaScript type of a value
   *
   * @private
   * @param {*} value - Value to determine type of
   * @returns {string} JavaScript type as string
   */
  #getJavaScriptType(value) {
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value === null) {
      return 'null';
    }
    return typeof value;
  }

  /**
   * Checks if a value matches the expected JSON Schema type
   *
   * @private
   * @param {*} value - Value to validate
   * @param {string} expectedType - Expected JSON Schema type
   * @returns {boolean} True if value matches expected type
   */
  #isTypeValid(value, expectedType) {
    const actualType = this.#getJavaScriptType(value);

    switch (expectedType) {
      case 'string':
        return actualType === 'string';
      case 'number':
      case 'integer':
        return actualType === 'number' && !Number.isNaN(value);
      case 'boolean':
        return actualType === 'boolean';
      case 'array':
        return actualType === 'array';
      case 'object':
        return actualType === 'object' && value !== null;
      case 'null':
        return value === null;
      default:
        this.#logger.warn(`Unknown type: ${expectedType}`);
        return true; // Unknown types pass validation
    }
  }
}

export default ValidatorGenerator;
