import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Blueprint existence validator ensures blueprint references resolve before dependent checks.
 *
 * @class BlueprintExistenceValidator
 * @augments BaseValidator
 * @description Validates that a recipe references an existing anatomy blueprint.
 */
export class BlueprintExistenceValidator extends BaseValidator {
  #anatomyBlueprintRepository;
  #logger;

  /**
   * Creates a new blueprint existence validator with repository and logging dependencies.
   *
   * @description Initializes validator metadata and validates dependencies.
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger instance.
   * @param {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} params.anatomyBlueprintRepository - Repository used to load blueprints.
   */
  constructor({ logger, anatomyBlueprintRepository }) {
    super({
      name: 'blueprint-existence',
      priority: 10,
      failFast: true,
      logger,
    });

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint'],
      }
    );

    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#logger = logger;
  }

  /**
   * Executes the blueprint lookup and records validation results.
   *
   * @description Ensures the referenced blueprint exists and surfaces repository errors.
   * @param {object} recipe - Recipe undergoing validation.
   * @param {object} _options - Validation options (unused placeholder).
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Validation result builder.
   * @returns {Promise<void>} Resolves when validation completes.
   */
  async performValidation(recipe, _options, builder) {
    try {
      const blueprintId = recipe?.blueprintId;
      const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(
        blueprintId
      );

      if (!blueprint) {
        const blueprintNamespace =
          typeof blueprintId === 'string' && blueprintId.includes(':')
            ? blueprintId.split(':')[1]
            : undefined;

        builder.addError(
          'BLUEPRINT_NOT_FOUND',
          `Blueprint '${blueprintId}' does not exist`,
          {
            blueprintId,
            fix: `Create blueprint at data/mods/*/blueprints/${blueprintNamespace}.blueprint.json`,
          }
        );
        return;
      }

      builder.addPassed(`Blueprint '${blueprintId}' found`, {
        check: 'blueprint_exists',
        blueprint: {
          id: blueprint.id,
          root: blueprint.root,
          structureTemplate: blueprint.structureTemplate,
        },
      });
    } catch (error) {
      this.#logger.error('Blueprint existence check failed', error);
      builder.addError(
        'VALIDATION_ERROR',
        'Failed to check blueprint existence',
        {
          check: 'blueprint_exists',
          error: error.message,
        }
      );
    }
  }
}
