import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

/**
 * @file DescriptorCoverageValidator - suggests descriptors for recipe slots.
 */

/**
 * Suggests body descriptors that could enhance recipe coverage.
 *
 * Priority: 40 - Suggestions only
 * Fail Fast: false - Advisory only, doesn't block other validations
 */
export class DescriptorCoverageValidator extends BaseValidator {
  #dataRegistry;
  #logger;
  #logValidatorError;

  /**
   * Creates a descriptor coverage validator instance.
   *
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger instance.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Data registry service.
   */
  constructor({ logger, dataRegistry }) {
    super({
      name: 'descriptor-coverage',
      priority: 40,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAll'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * Performs descriptor coverage validation for recipe slots.
   *
   * @param {object} recipe - Recipe being validated.
   * @param {object} _options - Unused validation options placeholder.
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Validation result builder.
   * @returns {Promise<void>}
   */
  async performValidation(recipe, _options, builder) {
    try {
      const suggestions = [];
      const slots = recipe?.slots || {};

      for (const [slotName, slot] of Object.entries(slots)) {
        const propertyKeys = Object.keys(slot?.properties || {});
        const hasDescriptorsInProperties =
          this.#hasDescriptorComponents(propertyKeys);

        let hasDescriptorsInPreferredEntity = false;
        if (!hasDescriptorsInProperties && slot?.preferId) {
          hasDescriptorsInPreferredEntity = this.#preferredEntityHasDescriptors(
            slot.preferId
          );
        }

        if (!hasDescriptorsInProperties && !hasDescriptorsInPreferredEntity) {
          const reason = slot?.preferId
            ? `No descriptor components in slot properties, and preferred entity '${slot.preferId}' has no descriptors`
            : 'No descriptor components in properties';

          suggestions.push({
            type: 'MISSING_DESCRIPTORS',
            location: { type: 'slot', name: slotName },
            message: `Slot '${slotName}' may not appear in descriptions`,
            reason,
            suggestion:
              'Add descriptor components (descriptors:size_category, descriptors:texture, etc.)',
            impact: 'Part will be excluded from anatomy description',
          });
        }
      }

      if (suggestions.length > 0) {
        for (const suggestion of suggestions) {
          builder.addSuggestion(suggestion.type, suggestion.message, {
            location: suggestion.location,
            reason: suggestion.reason,
            suggestion: suggestion.suggestion,
            impact: suggestion.impact,
          });
        }
      } else {
        builder.addPassed('All slots have descriptor components');
      }
    } catch (error) {
      this.#logValidatorError(error);
    }
  }

  /**
   * Checks if provided tag collection contains descriptor components.
   *
   * @param {string[]} tags - Component/property tags to inspect.
   * @returns {boolean} True when any tag uses the descriptors namespace.
   * @private
   */
  #hasDescriptorComponents(tags) {
    if (!Array.isArray(tags)) {
      return false;
    }

    return tags.some(
      (tag) => typeof tag === 'string' && tag.startsWith('descriptors:')
    );
  }

  /**
   * Checks if preferred entity (referenced by preferId) has descriptors.
   *
   * @param {string} entityId - Preferred entity identifier.
   * @returns {boolean} True if the entity exposes descriptor components.
   * @private
   */
  #preferredEntityHasDescriptors(entityId) {
    try {
      const rawEntityDefinitions =
        this.#dataRegistry.getAll('entityDefinitions');
      const entityDefinitions = Array.isArray(rawEntityDefinitions)
        ? rawEntityDefinitions
        : [];
      const entityDefinition = entityDefinitions.find(
        (definition) => definition?.id === entityId
      );

      if (!entityDefinition) {
        this.#logger.debug(
          `DescriptorCoverageValidator: Entity '${entityId}' not found when checking for descriptors`
        );
        return false;
      }

      const componentIds = Object.keys(entityDefinition.components || {});
      return this.#hasDescriptorComponents(componentIds);
    } catch (error) {
      this.#logger.error(
        `DescriptorCoverageValidator: Failed to check descriptors for preferred entity '${entityId}'`,
        error
      );
      return false;
    }
  }
}
