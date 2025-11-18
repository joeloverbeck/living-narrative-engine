import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

/**
 * @file RecipeBodyDescriptorValidator - Validates recipe bodyDescriptors against anatomy:body schema
 */

/**
 * @description Validates recipe bodyDescriptors against the anatomy:body component schema.
 *
 * DISTINCT from src/anatomy/validators/bodyDescriptorValidator.js
 * - This validator: Recipe-level schema validation
 * - System validator: Registry consistency validation
 *
 * Priority: 15 - Early validation of recipe structure
 * Fail Fast: false - Report all descriptor issues
 */
export class RecipeBodyDescriptorValidator extends BaseValidator {
  #dataRegistry;
  #logger;
  #logValidatorError;

  /**
   * @description Creates a new recipe body descriptor validator.
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger service.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Registry service for anatomy data.
   * @returns {void}
   */
  constructor({ logger, dataRegistry }) {
    super({
      name: 'body-descriptors',
      priority: 15,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * @description Validates the bodyDescriptors object for a recipe.
   * @param {object} recipe - Recipe being validated.
   * @param {object} _options - Validation options (unused placeholder).
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Validation result builder.
   * @returns {Promise<void>} Resolves when validation is complete.
   */
  async performValidation(recipe, _options, builder) {
    try {
      const descriptorsSchema = this.#getDescriptorsSchema();

      if (!descriptorsSchema) {
        return;
      }

      const bodyDescriptors = recipe?.bodyDescriptors;

      if (!bodyDescriptors || typeof bodyDescriptors !== 'object') {
        builder.addPassed('No bodyDescriptors to validate', {
          check: 'body_descriptors',
        });
        return;
      }

      const descriptorProperties = descriptorsSchema.properties || {};
      const errors = [];

      for (const [descriptorKey, descriptorValue] of Object.entries(
        bodyDescriptors
      )) {
        const descriptorIssues = this.#validateDescriptor(
          descriptorKey,
          descriptorValue,
          descriptorProperties
        );
        if (descriptorIssues.length > 0) {
          errors.push(...descriptorIssues);
        }
      }

      if (errors.length === 0) {
        builder.addPassed(
          `All ${Object.keys(bodyDescriptors).length} body descriptor(s) valid`,
          { check: 'body_descriptors' }
        );
        return;
      }

      for (const error of errors) {
        builder.addError(error.type, error.message, {
          check: 'body_descriptors',
          ...error.metadata,
        });
      }
    } catch (error) {
      this.#logValidatorError(error);
      builder.addError('VALIDATION_ERROR', 'Failed to validate body descriptors', {
        check: 'body_descriptors',
        error: error.message,
      });
    }
  }

  /**
   * @description Loads descriptors schema from anatomy:body component definition.
   * @returns {object|null} Descriptors schema or null if unavailable.
   * @private
   */
  #getDescriptorsSchema() {
    const bodyComponent = this.#dataRegistry.get('components', 'anatomy:body');

    if (!bodyComponent) {
      this.#logger.warn(
        'anatomy:body component not found, skipping bodyDescriptors validation'
      );
      return null;
    }

    const descriptorsSchema =
      bodyComponent.dataSchema?.properties?.body?.properties?.descriptors;

    if (!descriptorsSchema) {
      this.#logger.warn(
        'anatomy:body component missing descriptors schema, skipping bodyDescriptors validation'
      );
      return null;
    }

    return descriptorsSchema;
  }

  /**
   * @description Validates a single descriptor against the schema.
   * @param {string} descriptorName - Descriptor field name.
   * @param {*} descriptorValue - Descriptor value from recipe.
   * @param {Record<string, object>} descriptorProperties - Schema property map for descriptors.
   * @returns {Array<{type: string, message: string, metadata: object}>} Validation issues for descriptor.
   * @private
   */
  #validateDescriptor(descriptorName, descriptorValue, descriptorProperties) {
    const propertySchema = descriptorProperties[descriptorName];

    if (!propertySchema) {
      return [
        {
          type: 'UNKNOWN_BODY_DESCRIPTOR',
          message: `Unknown body descriptor '${descriptorName}'`,
          metadata: {
            field: descriptorName,
            value: descriptorValue,
            fix: `Remove '${descriptorName}' from bodyDescriptors or add it to the anatomy:body component schema`,
            allowedDescriptors: Object.keys(descriptorProperties),
          },
        },
      ];
    }

    const issues = [];
    const allowedValues = Array.isArray(propertySchema.enum)
      ? propertySchema.enum
      : undefined;

    if (allowedValues && !allowedValues.includes(descriptorValue)) {
      issues.push({
        type: 'INVALID_BODY_DESCRIPTOR_VALUE',
        message: `Invalid value '${descriptorValue}' for body descriptor '${descriptorName}'`,
        metadata: {
          field: descriptorName,
          value: descriptorValue,
          fix: `Use one of the allowed values: ${allowedValues.join(', ')}`,
          allowedValues,
        },
      });
    }

    if (propertySchema.type) {
      const allowedTypes = Array.isArray(propertySchema.type)
        ? propertySchema.type
        : [propertySchema.type];

      // Handle JavaScript quirk: typeof null === 'object'
      const actualType =
        descriptorValue === null ? 'null' : typeof descriptorValue;

      if (!allowedTypes.includes(actualType)) {
        issues.push({
          type: 'INVALID_BODY_DESCRIPTOR_TYPE',
          message: `Invalid type for body descriptor '${descriptorName}': expected one of [${allowedTypes.join(', ')}], got ${actualType}`,
          metadata: {
            field: descriptorName,
            value: descriptorValue,
            fix: `Change value to one of these types: ${allowedTypes.join(', ')}`,
            expectedTypes: allowedTypes,
            actualType,
          },
        });
      }
    }

    return issues;
  }
}
