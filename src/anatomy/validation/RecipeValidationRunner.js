/**
 * @file Pipeline-based validator that replaces the legacy RecipePreflightValidator.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ValidationReport } from './ValidationReport.js';
import ValidationPipeline from './core/ValidationPipeline.js';
import ValidatorRegistry from './core/ValidatorRegistry.js';
import { ComponentExistenceValidator } from './validators/ComponentExistenceValidator.js';
import { PropertySchemaValidator } from './validators/PropertySchemaValidator.js';
import { BlueprintExistenceValidator } from './validators/BlueprintExistenceValidator.js';
import { RecipeBodyDescriptorValidator } from './validators/RecipeBodyDescriptorValidator.js';
import { SocketSlotCompatibilityValidator } from './validators/SocketSlotCompatibilityValidator.js';
import { PartAvailabilityValidator } from './validators/PartAvailabilityValidator.js';
import { GeneratedSlotPartsValidator } from './validators/GeneratedSlotPartsValidator.js';
import { PatternMatchingValidator } from './validators/PatternMatchingValidator.js';
import { DescriptorCoverageValidator } from './validators/DescriptorCoverageValidator.js';
import { LoadFailureValidator } from './validators/LoadFailureValidator.js';
import { RecipeUsageValidator } from './validators/RecipeUsageValidator.js';

/**
 * @description Primary entry point for recipe validation. Builds the validator
 * registry, executes the pipeline, and returns a ValidationReport instance.
 */
export class RecipeValidationRunner {
  #logger;
  #loadFailures;
  #validationPipeline;

  /**
   * @param {object} params - Constructor parameters.
   * @param {import('../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Data registry.
   * @param {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} params.anatomyBlueprintRepository - Blueprint repo.
   * @param {import('../../interfaces/coreServices.js').ISchemaValidator} params.schemaValidator - Schema validator.
   * @param {import('../slotGenerator.js').default} params.slotGenerator - Slot generator.
   * @param {import('../services/entityMatcherService.js').default} params.entityMatcherService - Entity matcher.
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger - Logger.
   * @param {object} [params.loadFailures] - Loader failure metadata.
   * @param {object} [params.validators] - Optional validator overrides for testing.
   * @param {ValidatorRegistry|null} [params.validatorRegistry] - Optional pre-built registry.
   * @param {object} [params.validationPipelineConfig] - Pipeline configuration payload.
   */
  constructor({
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    entityMatcherService,
    logger,
    loadFailures = {},
    validators = {},
    validatorRegistry = null,
    validationPipelineConfig = {},
  }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });
    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint', 'getRecipe'],
      }
    );
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });
    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'generateBlueprintSlots',
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
      ],
    });
    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: [
        'findMatchingEntities',
        'findMatchingEntitiesForSlot',
        'mergePropertyRequirements',
      ],
    });

    this.#logger = logger;
    this.#loadFailures = loadFailures;

    const registry =
      validatorRegistry ??
      this.#createValidatorRegistry({
        validators,
        dataRegistry,
        anatomyBlueprintRepository,
        schemaValidator,
        slotGenerator,
        entityMatcherService,
      });

    this.#validationPipeline = new ValidationPipeline({
      registry,
      logger,
      configuration: validationPipelineConfig,
    });
  }

  /**
   * @param {object} recipe - Recipe to validate.
   * @param {object} [options] - Validation options.
   * @returns {Promise<ValidationReport>} Validation report.
   */
  async validate(recipe, options = {}) {
    const pipelineResult = await this.#validationPipeline.execute(recipe, {
      ...options,
      loadFailures: options.loadFailures ?? this.#loadFailures,
    });

    return new ValidationReport(pipelineResult);
  }

  #createValidatorRegistry({
    validators,
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    entityMatcherService,
  }) {
    const registry = new ValidatorRegistry({ logger: this.#logger });
    const validatorInstances = [
      validators.componentExistence ??
        new ComponentExistenceValidator({
          logger: this.#logger,
          dataRegistry,
        }),
      validators.propertySchemas ??
        new PropertySchemaValidator({
          logger: this.#logger,
          dataRegistry,
          schemaValidator,
        }),
      validators.recipeBodyDescriptor ??
        new RecipeBodyDescriptorValidator({
          logger: this.#logger,
          dataRegistry,
        }),
      validators.blueprintExistence ??
        new BlueprintExistenceValidator({
          logger: this.#logger,
          anatomyBlueprintRepository,
        }),
      validators.socketSlotCompatibility ??
        new SocketSlotCompatibilityValidator({
          logger: this.#logger,
          dataRegistry,
          anatomyBlueprintRepository,
        }),
      validators.partAvailability ??
        new PartAvailabilityValidator({
          logger: this.#logger,
          dataRegistry,
          entityMatcherService,
        }),
      validators.generatedSlotParts ??
        new GeneratedSlotPartsValidator({
          logger: this.#logger,
          slotGenerator,
          dataRegistry,
          entityMatcherService,
          anatomyBlueprintRepository,
        }),
      validators.patternMatching ??
        new PatternMatchingValidator({
          logger: this.#logger,
          dataRegistry,
          slotGenerator,
          anatomyBlueprintRepository,
        }),
      validators.descriptorCoverage ??
        new DescriptorCoverageValidator({
          logger: this.#logger,
          dataRegistry,
        }),
      validators.loadFailure ??
        new LoadFailureValidator({
          logger: this.#logger,
        }),
      validators.recipeUsage ??
        new RecipeUsageValidator({
          logger: this.#logger,
          dataRegistry,
        }),
    ].filter(Boolean);

    for (const validator of validatorInstances) {
      registry.register(validator);
    }

    return registry;
  }
}

export default RecipeValidationRunner;
