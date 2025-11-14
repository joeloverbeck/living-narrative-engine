import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates that entity definitions exist for all recipe slots.
 *
 * Priority: 25 - After blueprint and descriptor validation
 * Fail Fast: false - Report all missing parts
 *
 * @description Ensures that slots and patterns have at least one matching entity definition.
 */
export class PartAvailabilityValidator extends BaseValidator {
  #dataRegistry;
  #entityMatcherService;
  #logger;

  /**
   * Creates a part availability validator instance.
   *
   * @description Configures dependencies for registry access and entity matching.
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger implementation.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Data registry service.
   * @param {import('../../../interfaces/coreServices.js').IEntityMatcherService} params.entityMatcherService - Entity matcher service.
   * @returns {void}
   */
  constructor({ logger, dataRegistry, entityMatcherService }) {
    super({
      name: 'part-availability',
      priority: 25,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAll'],
    });

    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: ['findMatchingEntities'],
    });

    this.#dataRegistry = dataRegistry;
    this.#entityMatcherService = entityMatcherService;
    this.#logger = logger;
  }

  /**
   * Performs explicit part availability validation for slots and patterns.
   *
   * @description Collects PART_UNAVAILABLE errors for every slot or pattern without matches.
   * @param {object} recipe - Recipe undergoing validation.
   * @param {object} _options - Validation options (unused placeholder).
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Result builder instance.
   * @returns {Promise<void>} Resolves when validation is complete.
   */
  async performValidation(recipe, _options, builder) {
    try {
      const issues = [];
      const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');
      const slots = recipe?.slots || {};

      for (const [slotName, slotCriteria] of Object.entries(slots)) {
        const matchingEntities = this.#entityMatcherService.findMatchingEntities(
          slotCriteria,
          allEntityDefs
        );

        if (matchingEntities.length === 0) {
          issues.push({
            type: 'PART_UNAVAILABLE',
            severity: 'error',
            location: { type: 'slot', name: slotName },
            message: `No entity definitions found for slot '${slotName}'`,
            details: {
              partType: slotCriteria.partType,
              requiredTags: slotCriteria.tags || [],
              requiredProperties: Object.keys(slotCriteria.properties || {}),
              totalEntitiesChecked: allEntityDefs.length,
            },
          });
        }
      }

      const patterns = recipe?.patterns || [];
      for (let index = 0; index < patterns.length; index++) {
        const patternCriteria = patterns[index];
        const matchingEntities = this.#entityMatcherService.findMatchingEntities(
          patternCriteria,
          allEntityDefs
        );

        if (matchingEntities.length === 0) {
          issues.push({
            type: 'PART_UNAVAILABLE',
            severity: 'error',
            location: { type: 'pattern', index },
            message: `No entity definitions found for pattern ${index}`,
            details: {
              partType: patternCriteria.partType,
              requiredTags: patternCriteria.tags || [],
              requiredProperties: Object.keys(patternCriteria.properties || {}),
              totalEntitiesChecked: allEntityDefs.length,
            },
          });
        }
      }

      if (issues.length === 0) {
        builder.addPassed(
          'All slots and patterns have matching entity definitions',
          { check: 'part_availability' }
        );
      } else {
        builder.addIssues(issues);
      }
    } catch (error) {
      this.#logger.error('Part availability check failed', error);
      builder.addError(
        'VALIDATION_ERROR',
        'Failed to validate part availability',
        { check: 'part_availability', error: error.message }
      );
    }
  }
}
