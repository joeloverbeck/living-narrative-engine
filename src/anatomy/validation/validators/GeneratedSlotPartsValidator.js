import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';
import {
  findMatchingSlots,
  getPatternDescription,
} from './PatternMatchingValidator.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

const VALIDATION_CHECK = 'generated_slot_part_availability';

/**
 * Validates that entity definitions exist for slots matched via recipe patterns.
 *
 * @description Ensures generated slot parts declared through patterns have available entity definitions.
 * Priority: 30 - Executes after explicit part availability checks.
 * Fail Fast: false - Aggregates all missing generated slot parts.
 */
export class GeneratedSlotPartsValidator extends BaseValidator {
  #slotGenerator;
  #dataRegistry;
  #entityMatcherService;
  #anatomyBlueprintRepository;
  #logger;
  #logValidatorError;

  /**
   * Configures the validator with required services.
   *
   * @description Creates a generated slot parts validator instance.
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger implementation.
   * @param {import('../../slotGenerator.js').default} params.slotGenerator - Slot generator service.
   * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Registry for templates/entities.
   * @param {import('../../../interfaces/coreServices.js').IEntityMatcherService} params.entityMatcherService - Entity matcher service.
   * @param {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} params.anatomyBlueprintRepository - Blueprint repository.
   */
  constructor({
    logger,
    slotGenerator,
    dataRegistry,
    entityMatcherService,
    anatomyBlueprintRepository,
  }) {
    super({
      name: 'generated-slot-parts',
      priority: 30,
      failFast: false,
      logger,
    });

    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'generateBlueprintSlots',
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
      ],
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });

    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: [
        'findMatchingEntitiesForSlot',
        'mergePropertyRequirements',
      ],
    });

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint'],
      }
    );

    this.#slotGenerator = slotGenerator;
    this.#dataRegistry = dataRegistry;
    this.#entityMatcherService = entityMatcherService;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#logger = logger;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * Runs generated slot availability validation logic.
   *
   * @description Executes generated slot part availability validation.
   * @param {object} recipe - Recipe definition being validated.
   * @param {object} _options - Validation options (unused placeholder).
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Result builder instance.
   * @returns {Promise<void>} Resolves when validation completes.
   */
  async performValidation(recipe, _options, builder) {
    try {
      const patterns = recipe?.patterns || [];

      if (patterns.length === 0) {
        builder.addPassed('No patterns to validate for generated slots', {
          check: VALIDATION_CHECK,
        });
        return;
      }

      const blueprintId = recipe?.blueprintId;
      const rawBlueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(blueprintId);

      if (!rawBlueprint) {
        this.#logger.warn(
          `GeneratedSlotPartsValidator: Blueprint '${blueprintId}' not found, skipping generated slot checks`
        );
        return;
      }

      const blueprint = await ensureBlueprintProcessed({
        blueprint: rawBlueprint,
        dataRegistry: this.#dataRegistry,
        slotGenerator: this.#slotGenerator,
        logger: this.#logger,
      });

      if (!blueprint) {
        this.#logger.warn(
          `GeneratedSlotPartsValidator: Processed blueprint is null for '${blueprintId}', skipping generated slot checks`
        );
        return;
      }

      const { errors, totalSlotsChecked } = await this.#validateGeneratedSlots(
        patterns,
        blueprint
      );

      if (errors.length === 0) {
        builder.addPassed(
          `All ${totalSlotsChecked} generated slot(s) from patterns have matching entity definitions`,
          { check: VALIDATION_CHECK }
        );
        return;
      }

      builder.addIssues(errors);
    } catch (error) {
      this.#logValidatorError(error);
      builder.addError(
        'VALIDATION_ERROR',
        'Failed to validate generated slot part availability',
        {
          check: VALIDATION_CHECK,
          error: error.message,
        }
      );
    }
  }

  async #validateGeneratedSlots(patterns, blueprint) {
    const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions') || [];
    const generatedSockets = await this.#loadGeneratedSockets(blueprint);
    const errors = [];
    let totalSlotsChecked = 0;

    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      const pattern = patterns[patternIndex];
      const matchResult = findMatchingSlots(
        pattern,
        blueprint,
        this.#dataRegistry,
        this.#slotGenerator,
        this.#logger
      );
      const matchedSlots = matchResult?.matches || [];

      for (const slotKey of matchedSlots) {
        totalSlotsChecked += 1;
        const blueprintSlot =
          blueprint?.slots?.[slotKey] || generatedSockets[slotKey];

        if (!blueprintSlot) {
          this.#logger.warn(
            `GeneratedSlotPartsValidator: Slot '${slotKey}' matched by pattern but not found in blueprint or structure template`
          );
          continue;
        }

        const combinedRequirements = this.#buildCombinedRequirements(
          pattern,
          blueprintSlot
        );

        const matchingEntities =
          this.#entityMatcherService.findMatchingEntitiesForSlot(
            combinedRequirements,
            allEntityDefs
          ) || [];

        if (matchingEntities.length === 0) {
          errors.push(
            this.#createMissingPartError({
              slotKey,
              pattern,
              patternIndex,
              blueprintSlot,
              combinedRequirements,
              totalEntitiesChecked: allEntityDefs.length,
            })
          );
        }
      }
    }

    return { errors, totalSlotsChecked };
  }

  async #loadGeneratedSockets(blueprint) {
    if (!blueprint?.structureTemplate) {
      return {};
    }

    this.#logger.info(
      `GeneratedSlotPartsValidator: Loading structure template '${blueprint.structureTemplate}'`
    );

    const structureTemplate = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    if (!structureTemplate) {
      this.#logger.warn(
        `GeneratedSlotPartsValidator: Structure template '${blueprint.structureTemplate}' not found in data registry`
      );
      return {};
    }

    this.#logger.info(
      'GeneratedSlotPartsValidator: Structure template found, generating sockets'
    );

    const { default: SocketGenerator } = await import(
      '../../socketGenerator.js'
    );
    const socketGenerator = new SocketGenerator({ logger: this.#logger });
    const sockets = socketGenerator.generateSockets(structureTemplate) || [];

    this.#logger.info(
      `GeneratedSlotPartsValidator: Generated ${sockets.length} sockets from structure template`
    );

    const socketMap = {};
    for (const socket of sockets) {
      socketMap[socket.id] = socket;
    }
    return socketMap;
  }

  #buildCombinedRequirements(pattern, blueprintSlot) {
    const blueprintComponents = blueprintSlot?.requirements?.components || [];
    const blueprintProperties = blueprintSlot?.requirements?.properties || {};
    const blueprintPartType = blueprintSlot?.requirements?.partType;

    const mergedProperties =
      this.#entityMatcherService.mergePropertyRequirements(
        pattern?.properties || {},
        blueprintProperties
      ) || {};

    return {
      partType: pattern?.partType || blueprintPartType,
      allowedTypes: blueprintSlot?.allowedTypes || ['*'],
      tags: [...(pattern?.tags || []), ...blueprintComponents],
      properties: mergedProperties,
    };
  }

  #createMissingPartError({
    slotKey,
    pattern,
    patternIndex,
    blueprintSlot,
    combinedRequirements,
    totalEntitiesChecked,
  }) {
    const requiredProperties = Object.keys(
      combinedRequirements.properties || {}
    );
    const blueprintRequiredProperties = Object.keys(
      blueprintSlot?.requirements?.properties || {}
    );

    return {
      type: 'GENERATED_SLOT_PART_UNAVAILABLE',
      severity: 'error',
      location: {
        type: 'generated_slot',
        slotKey,
        patternIndex,
        pattern: getPatternDescription(pattern),
      },
      message: `No entity definitions found for generated slot '${slotKey}' (matched by pattern ${patternIndex})`,
      details: {
        slotKey,
        patternIndex,
        partType: pattern?.partType,
        allowedTypes: blueprintSlot?.allowedTypes,
        requiredTags: combinedRequirements.tags,
        requiredProperties,
        totalEntitiesChecked,
        blueprintRequiredComponents:
          blueprintSlot?.requirements?.components || [],
        blueprintRequiredProperties,
      },
      fix:
        'Create an entity definition in data/mods/anatomy/entities/definitions/ with:\n' +
        `  - anatomy:part component with subType: "${pattern?.partType}"\n` +
        `  - Required tags (pattern + blueprint): ${JSON.stringify(
          combinedRequirements.tags
        )}\n` +
        `  - Required property components: ${JSON.stringify(requiredProperties)}`,
    };
  }
}

export default GeneratedSlotPartsValidator;
