import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

const VALIDATION_CHECK = 'initial_damage_slot_resolution';

/**
 * Validates that initialDamage targets map to generated slots or the root part.
 *
 * @description Ensures every initialDamage entry points to a slot that will have a generated part,
 * catching runtime failures from missing slot-to-part mappings.
 * Priority: 32 - After slot/pattern availability checks.
 * Fail Fast: false - Aggregate all missing slots.
 */
export class InitialDamageSlotValidator extends BaseValidator {
  #anatomyBlueprintRepository;
  #dataRegistry;
  #slotGenerator;
  #logger;
  #logValidatorError;

  /**
   * @param {object} params
   * @param {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} params.anatomyBlueprintRepository
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry
   * @param {import('../../slotGenerator.js').default} params.slotGenerator
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger
   */
  constructor({
    anatomyBlueprintRepository,
    dataRegistry,
    slotGenerator,
    logger,
  }) {
    super({
      name: 'initial-damage-slots',
      priority: 32,
      failFast: false,
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
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'generateBlueprintSlots',
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
      ],
    });

    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#dataRegistry = dataRegistry;
    this.#slotGenerator = slotGenerator;
    this.#logger = logger;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * @param {object} recipe
   * @param {object} _options
   * @param {import('../core/ValidationResultBuilder.js').default} builder
   */
  async performValidation(recipe, _options, builder) {
    try {
      const initialDamage = recipe?.initialDamage;
      if (!initialDamage || Object.keys(initialDamage).length === 0) {
        builder.addPassed('No initialDamage entries to validate', {
          check: VALIDATION_CHECK,
        });
        return;
      }

      const blueprintId = recipe?.blueprintId;
      const rawBlueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(blueprintId);

      if (!rawBlueprint) {
        builder.addError(
          'INITIAL_DAMAGE_BLUEPRINT_NOT_FOUND',
          `Blueprint '${blueprintId}' not found while validating initialDamage slots`,
          { check: VALIDATION_CHECK, blueprintId }
        );
        return;
      }

      const blueprint = await ensureBlueprintProcessed({
        blueprint: rawBlueprint,
        dataRegistry: this.#dataRegistry,
        slotGenerator: this.#slotGenerator,
        logger: this.#logger,
      });

      const availableSlots = new Set(Object.keys(blueprint?.slots || {}));
      const rootAlias = this.#determineRootAlias(blueprint);

      const unresolvedSlots = [];
      for (const slotKey of Object.keys(initialDamage)) {
        if (availableSlots.has(slotKey)) {
          continue;
        }

        if (rootAlias && slotKey === rootAlias) {
          continue;
        }

        unresolvedSlots.push(slotKey);
      }

      if (unresolvedSlots.length === 0) {
        builder.addPassed(
          `All ${Object.keys(initialDamage).length} initialDamage target(s) map to known slots`,
          { check: VALIDATION_CHECK }
        );
        return;
      }

      builder.addError(
        'INITIAL_DAMAGE_SLOT_UNRESOLVED',
        `Initial damage references slot(s) with no generated parts: ${unresolvedSlots.join(
          ', '
        )}`,
        {
          check: VALIDATION_CHECK,
          missingSlots: unresolvedSlots,
          availableSlots: Array.from(availableSlots),
          rootAlias,
          blueprintId,
        }
      );
    } catch (error) {
      this.#logValidatorError(error);
      builder.addError(
        'VALIDATION_ERROR',
        'Failed to validate initialDamage slot mapping',
        {
          check: VALIDATION_CHECK,
          error: error.message,
        }
      );
    }
  }

  #determineRootAlias(blueprint) {
    const rootId = blueprint?.root;
    if (!rootId) {
      return null;
    }

    const rootDefinition = this.#dataRegistry.get(
      'entityDefinitions',
      rootId
    );
    const partData = rootDefinition?.components?.['anatomy:part'];
    const rootSubType =
      partData?.subType || partData?.partType || partData?.type;

    if (rootSubType === 'torso') {
      return 'torso';
    }

    return null;
  }
}

export default InitialDamageSlotValidator;
