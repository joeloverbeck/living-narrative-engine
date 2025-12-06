import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

/**
 * @file RecipeUsageValidator - ensures recipes are referenced by entity definitions.
 */

/**
 * Validates that at least one entity definition references the provided recipe ID.
 *
 * @augments BaseValidator
 */
export class RecipeUsageValidator extends BaseValidator {
  #dataRegistry;
  #logValidatorError;

  /**
   * Creates a recipe usage validator instance.
   *
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger instance.
   * @param {import('../../../interfaces/IDataRegistry.js').IDataRegistry} params.dataRegistry - Data registry service.
   */
  constructor({ logger, dataRegistry }) {
    super({
      name: 'recipe-usage',
      priority: 60,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAll'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * Performs recipe usage validation.
   *
   * @param {object} recipe - Recipe being validated.
   * @param {object} _options - Unused validation options placeholder.
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Validation result builder.
   * @returns {Promise<void>}
   */
  async performValidation(recipe, _options, builder) {
    try {
      const rawEntityDefinitions =
        this.#dataRegistry.getAll('entityDefinitions');
      const entityDefinitions = Array.isArray(rawEntityDefinitions)
        ? rawEntityDefinitions
        : [];
      const referencingEntities = [];

      for (const entityDef of entityDefinitions) {
        if (!entityDef || typeof entityDef !== 'object') {
          continue;
        }

        const bodyComponent = entityDef.components?.['anatomy:body'];
        if (bodyComponent?.recipeId === recipe.recipeId) {
          referencingEntities.push(entityDef.id);
        }
      }

      const metadataPayload = {
        check: 'recipe_usage',
        details: {
          referencingEntities: referencingEntities.slice(0, 5),
          totalCount: referencingEntities.length,
        },
      };

      if (referencingEntities.length === 0) {
        builder.addWarning(
          'RECIPE_UNUSED',
          `Recipe '${recipe.recipeId}' is not referenced by any entity definitions`,
          {
            check: 'recipe_usage',
            suggestion:
              'Verify that the recipeId matches what entity definitions expect',
            details: {
              recipeId: recipe.recipeId,
              hint: `Entity definitions should have: "anatomy:body": { "recipeId": "${recipe.recipeId}" }`,
            },
          }
        );
      } else {
        builder.addPassed(
          `Recipe is referenced by ${referencingEntities.length} entity definition(s)`,
          {
            check: 'recipe_usage',
            details: {
              referencingEntities: referencingEntities.slice(0, 5),
              totalCount: referencingEntities.length,
            },
          }
        );
      }

      builder.setMetadata('recipeUsage', metadataPayload);
    } catch (error) {
      this.#logValidatorError(error);
    }
  }
}
