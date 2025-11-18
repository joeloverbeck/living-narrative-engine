/**
 * @file Validates that recipe property values match component dataSchemas
 * @see ../validationRule.js - Base class
 * @see ../loadTimeValidationContext.js - Validation context
 * @see componentExistenceValidationRule.js - Companion rule that validates component existence
 */

import Ajv from 'ajv';
import { ValidationRule } from '../validationRule.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { levenshteinDistance } from '../../../utils/stringUtils.js';
import { isPlainObject } from '../../../utils/objectUtils.js';
import { createError } from '../../errors/index.js';

/** @typedef {import('../loadTimeValidationContext.js').LoadTimeValidationContext} LoadTimeValidationContext */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

/**
 * Validates that recipe property values match component dataSchemas
 *
 * This rule runs at recipe load time and catches property validation errors
 * before they cause runtime failures during entity instantiation.
 *
 * @augments ValidationRule
 */
export class PropertySchemaValidationRule extends ValidationRule {
  #logger;
  #dataRegistry;
  #schemaValidator;
  #ajv;

  /**
   * Creates a new property schema validation rule
   *
   * @param {object} params - Constructor parameters
   * @param {ILogger} params.logger - Logger instance
   * @param {IDataRegistry} params.dataRegistry - Data registry instance
   * @param {ISchemaValidator} params.schemaValidator - Schema validator instance
   */
  constructor({ logger, dataRegistry, schemaValidator }) {
    super();

    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;
    this.#schemaValidator = schemaValidator;

    // Create a separate Ajv instance for inline schema validation (fallback)
    this.#ajv = new Ajv({
      allErrors: true,
      strictTypes: false,
      strict: false,
    });
  }

  /**
   * Gets the unique identifier for this rule
   *
   * @returns {string} Unique identifier for this rule
   */
  get ruleId() {
    return 'property-schema-validation';
  }

  /**
   * Gets the human-readable name for this rule
   *
   * @returns {string} Human-readable name for this rule
   */
  get ruleName() {
    return 'Property Schema Validation';
  }

  /**
   * Determines if this rule should apply to the given validation context
   *
   * @param {LoadTimeValidationContext} context - Context with blueprints and recipes
   * @returns {boolean} True if context has recipes
   */
  shouldApply(context) {
    return context.hasRecipes();
  }

  /**
   * Validates that all property values in recipes match component dataSchemas
   *
   * @param {LoadTimeValidationContext} context - Validation context with blueprints and recipes
   * @returns {Promise<Array>} Array of validation issues
   */
  async validate(context) {
    const issues = [];
    const recipes = context.getRecipes();

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const recipeIssues = this.#validateRecipeProperties(
        recipe,
        recipeId,
        recipe.recipePath
      );

      // Add recipe context to each issue
      for (const issue of recipeIssues) {
        issues.push({
          ...issue,
          context: {
            ...issue.context,
            recipeId,
          },
        });
      }
    }

    // Log summary
    if (issues.length > 0) {
      const errors = issues.filter((i) => i.severity === 'error');
      this.#logger.warn(
        `Property schema validation found ${errors.length} invalid property value(s)`
      );
    } else {
      this.#logger.debug('Property schema validation passed');
    }

    return issues;
  }

  /**
   * Validates properties in a single recipe
   *
   * @private
   * @param {object} recipe - Recipe definition
   * @param recipeId
   * @param recipePath
   * @returns {Array} Array of issues found
   */
  #validateRecipeProperties(recipe, recipeId, recipePath) {
    const issues = [];

    // Validate slot properties
    for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
      if (
        !this.#ensurePlainPropertyMap({
          properties: slot.properties,
          locationType: 'slot',
          locationName: slotName,
          recipeId,
          recipePath,
          issues,
        })
      ) {
        continue;
      }

      for (const [componentId, properties] of Object.entries(
        slot.properties || {}
      )) {
        const component = this.#dataRegistry.get('components', componentId);

        if (!component) {
          // Component existence is validated by ComponentExistenceValidationRule
          // Skip validation if component doesn't exist
          continue;
        }

        const schemaErrors = this.#validateComponentProperties(
          componentId,
          properties,
          component.dataSchema
        );

        if (schemaErrors.length > 0) {
          issues.push({
            type: 'INVALID_PROPERTY_VALUE',
            severity: 'error',
            message: `Invalid property values for component '${componentId}' in slot '${slotName}'`,
            ruleId: this.ruleId,
            context: {
              location: { type: 'slot', name: slotName },
              componentId: componentId,
              properties: properties,
              schemaErrors: schemaErrors,
              componentSource: this.#deriveComponentSource(componentId),
            },
          });
        }
      }
    }

    // Validate pattern properties
    for (const [index, pattern] of (recipe.patterns || []).entries()) {
      const patternId =
        pattern.matchesPattern ||
        pattern.matchesGroup ||
        (pattern.matches ? pattern.matches.join(',') : null) ||
        (pattern.matchesAll ? 'matchesAll' : `pattern-${index}`);

      if (
        !this.#ensurePlainPropertyMap({
          properties: pattern.properties,
          locationType: 'pattern',
          locationName: patternId,
          recipeId,
          recipePath,
          issues,
          index,
        })
      ) {
        continue;
      }

      for (const [componentId, properties] of Object.entries(
        pattern.properties || {}
      )) {
        const component = this.#dataRegistry.get('components', componentId);

        if (!component) {
          continue; // Caught by component existence validator
        }

        const schemaErrors = this.#validateComponentProperties(
          componentId,
          properties,
          component.dataSchema
        );

        if (schemaErrors.length > 0) {
          issues.push({
            type: 'INVALID_PROPERTY_VALUE',
            severity: 'error',
            message: `Invalid property values for component '${componentId}' in pattern '${patternId}'`,
            ruleId: this.ruleId,
            context: {
              location: { type: 'pattern', name: patternId, index },
              componentId: componentId,
              properties: properties,
              schemaErrors: schemaErrors,
              componentSource: this.#deriveComponentSource(componentId),
            },
          });
        }
      }
    }

    return issues;
  }

  #ensurePlainPropertyMap({
    properties,
    locationType,
    locationName,
    recipeId,
    recipePath,
    issues,
    index,
  }) {
    if (!properties) {
      return true;
    }

    if (isPlainObject(properties)) {
      return true;
    }

    const receivedType = Array.isArray(properties)
      ? 'array'
      : typeof properties;
    this.#logger.warn(
      `PropertySchemaValidationRule: ${locationType} '${locationName}' properties must be a plain object; received ${receivedType}`
    );

    issues.push({
      severity: 'error',
      type: 'INVALID_PROPERTY_OBJECT',
      message: `${locationType} '${locationName}' properties must be a plain object keyed by component IDs`,
      ruleId: this.ruleId,
      context: {
        location: {
          type: locationType,
          name: locationName,
          field: 'properties',
          ...(index !== undefined && { index }),
        },
        receivedType,
      },
      enhancedError: recipeId
        ? createError('INVALID_PROPERTY_OBJECT', {
            recipeId,
            location: { type: locationType, name: locationName },
            recipePath,
            receivedType,
          })
        : null,
    });

    return false;
  }

  /**
   * Derives the component source file path from the component ID
   * Format: data/mods/{modId}/components/{componentName}.component.json
   *
   * @private
   * @param {string} componentId - Component identifier (e.g., "descriptors:length_category")
   * @returns {string} Derived file path
   */
  #deriveComponentSource(componentId) {
    const [modId, componentName] = componentId.split(':');
    return `data/mods/${modId}/components/${componentName}.component.json`;
  }

  /**
   * Validates a property object against a component's dataSchema
   *
   * @private
   * @param {string} componentId - Component identifier
   * @param {object} properties - Property values to validate
   * @param {object} dataSchema - Component dataSchema
   * @returns {Array<object>} Array of formatted validation errors
   */
  #validateComponentProperties(componentId, properties, dataSchema) {
    const errors = [];

    try {
      // First, try to use the registered schema
      const result = this.#schemaValidator.validate(componentId, properties);

      if (!result.isValid && result.errors) {
        for (const error of result.errors) {
          errors.push(this.#formatPropertyError(componentId, properties, error));
        }
        return errors;
      }
    } catch {
      // Schema not registered, fall back to inline validation
      this.#logger.debug(
        `Component '${componentId}' dataSchema not registered, using inline validation`
      );
    }

    // Fallback: validate using inline schema
    try {
      const validate = this.#ajv.compile(dataSchema);
      const isValid = validate(properties);

      if (!isValid && validate.errors) {
        for (const error of validate.errors) {
          errors.push(this.#formatPropertyError(componentId, properties, error));
        }
      }
    } catch (inlineError) {
      this.#logger.error(
        `Failed to validate properties for component '${componentId}': ${inlineError.message}`,
        { componentId, properties, error: inlineError }
      );
      errors.push({
        property: 'unknown',
        message: `Schema validation failed: ${inlineError.message}`,
        currentValue: properties,
      });
    }

    return errors;
  }

  /**
   * Formats AJV error with context and suggestions
   *
   * @private
   * @param {string} componentId - Component identifier
   * @param {object} properties - Property values
   * @param {object} ajvError - AJV error object
   * @returns {object} Formatted error object
   */
  #formatPropertyError(componentId, properties, ajvError) {
    const propertyPath = ajvError.instancePath
      ? ajvError.instancePath.replace(/^\//, '')
      : '';
    const propertyName = propertyPath || ajvError.params?.missingProperty || '';

    const error = {
      property: propertyName,
      message: ajvError.message,
      currentValue: this.#getPropertyValue(properties, propertyPath),
    };

    // Add enum suggestions for enum validation failures
    if (ajvError.keyword === 'enum' && ajvError.params?.allowedValues) {
      error.validValues = ajvError.params.allowedValues;
      error.suggestion = this.#suggestClosestValue(
        error.currentValue,
        ajvError.params.allowedValues
      );
    }

    // Add type information for type validation failures
    if (ajvError.keyword === 'type') {
      error.expectedType = ajvError.params?.type;
      error.actualType = typeof error.currentValue;
    }

    // Add required field information
    if (ajvError.keyword === 'required') {
      error.missingField = ajvError.params?.missingProperty;
    }

    return error;
  }

  /**
   * Gets a nested property value from an object using a path
   *
   * @private
   * @param {object} obj - Object to search
   * @param {string} path - Property path (e.g., "color/primary")
   * @returns {*} Property value
   */
  #getPropertyValue(obj, path) {
    if (!path) return obj;
    return path.split('/').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Suggests the closest matching value from a list of valid values
   *
   * @private
   * @param {*} value - Invalid value
   * @param {Array} validValues - List of valid values
   * @returns {*} Closest matching valid value
   */
  #suggestClosestValue(value, validValues) {
    if (typeof value !== 'string') return validValues[0];

    // Simple string similarity: find shortest edit distance
    let closest = validValues[0];
    let minDistance = Infinity;

    for (const valid of validValues) {
      const distance = levenshteinDistance(
        value.toLowerCase(),
        String(valid).toLowerCase()
      );
      if (distance < minDistance) {
        minDistance = distance;
        closest = valid;
      }
    }

    return closest;
  }
}
