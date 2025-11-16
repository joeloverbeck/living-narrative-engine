import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ComponentExistenceValidationRule } from '../rules/componentExistenceValidationRule.js';
import { LoadTimeValidationContext } from '../loadTimeValidationContext.js';

/**
 * @description Pipeline validator that reuses the component existence rule to
 * ensure every referenced component is registered before deeper checks run.
 */
export class ComponentExistenceValidator extends BaseValidator {
  #rule;
  #logger;

  /**
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger instance.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Data registry.
   */
  constructor({ logger, dataRegistry }) {
    super({
      name: 'component-existence',
      priority: 0,
      failFast: true,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });

    this.#logger = logger;
    this.#rule = new ComponentExistenceValidationRule({
      logger,
      dataRegistry,
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
          `All ${this.#countComponentReferences(recipe)} component references exist`,
          { check: 'component_existence' }
        );
        return;
      }

      builder.addIssues(issues);
    } catch (error) {
      this.#logger.error('Component existence validation failed', error);
      builder.addError(
        'VALIDATION_ERROR',
        'Failed to validate component existence',
        {
          check: 'component_existence',
          error: error.message,
        }
      );
    }
  }

  #countComponentReferences(recipe) {
    let count = 0;

    for (const slot of Object.values(recipe.slots || {})) {
      count += (slot.tags || []).length;
      count += Object.keys(slot.properties || {}).length;
    }

    for (const pattern of recipe.patterns || []) {
      count += (pattern.tags || []).length;
      count += Object.keys(pattern.properties || {}).length;
    }

    return count;
  }
}

export default ComponentExistenceValidator;
