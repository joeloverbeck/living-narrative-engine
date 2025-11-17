import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { PropertySchemaValidationRule } from '../rules/propertySchemaValidationRule.js';
import { LoadTimeValidationContext } from '../loadTimeValidationContext.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

/**
 * @description Pipeline validator that reuses the property schema rule to ensure
 * recipe property payloads conform to their component schemas.
 */
export class PropertySchemaValidator extends BaseValidator {
  #rule;
  #logger;
  #logValidatorError;

  /**
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger instance.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Data registry.
   * @param {import('../../../interfaces/coreServices.js').ISchemaValidator} params.schemaValidator - Schema validator.
   */
  constructor({ logger, dataRegistry, schemaValidator }) {
    super({
      name: 'property-schemas',
      priority: 5,
      failFast: true,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });

    this.#logger = logger;
    this.#rule = new PropertySchemaValidationRule({
      logger,
      dataRegistry,
      schemaValidator,
    });
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * @param {object} recipe - Recipe to validate.
   * @param {object} options - Validation options.
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Result builder.
   */
  async performValidation(recipe, options, builder) {
    try {
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: {
          [recipe.recipeId]: {
            ...recipe,
            recipePath: options?.recipePath,
          },
        },
      });

      const issues = await this.#rule.validate(context);

      if (!issues || issues.length === 0) {
        builder.addPassed(
          `All ${this.#countPropertyObjects(recipe)} property objects valid`,
          { check: 'property_schemas' }
        );
        return;
      }

      builder.addIssues(issues);
    } catch (error) {
      this.#logValidatorError(error);
      builder.addError(
        'VALIDATION_ERROR',
        'Failed to validate property schemas',
        {
          check: 'property_schemas',
          error: error.message,
        }
      );
    }
  }

  #countPropertyObjects(recipe) {
    let count = 0;

    for (const slot of Object.values(recipe.slots || {})) {
      count += Object.keys(slot.properties || {}).length;
    }

    for (const pattern of recipe.patterns || []) {
      count += Object.keys(pattern.properties || {}).length;
    }

    return count;
  }
}

export default PropertySchemaValidator;
