/**
 * @file Comprehensive pre-flight validator for anatomy recipes
 * @see ./rules/componentExistenceValidationRule.js
 * @see ./rules/propertySchemaValidationRule.js
 * @see ./loadTimeValidationContext.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ComponentExistenceValidationRule } from './rules/componentExistenceValidationRule.js';
import { PropertySchemaValidationRule } from './rules/propertySchemaValidationRule.js';
import { LoadTimeValidationContext } from './loadTimeValidationContext.js';
import { ValidationReport } from './ValidationReport.js';
import { BlueprintExistenceValidator } from './validators/BlueprintExistenceValidator.js';
import { RecipeBodyDescriptorValidator } from './validators/RecipeBodyDescriptorValidator.js';
import { SocketSlotCompatibilityValidator } from './validators/SocketSlotCompatibilityValidator.js';
import { PartAvailabilityValidator } from './validators/PartAvailabilityValidator.js';
import { GeneratedSlotPartsValidator } from './validators/GeneratedSlotPartsValidator.js';
import { PatternMatchingValidator } from './validators/PatternMatchingValidator.js';
import { DescriptorCoverageValidator } from './validators/DescriptorCoverageValidator.js';
import { LoadFailureValidator } from './validators/LoadFailureValidator.js';
import { RecipeUsageValidator } from './validators/RecipeUsageValidator.js';

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../slotGenerator.js').default} SlotGenerator */
/** @typedef {import('../services/entityMatcherService.js').default} EntityMatcherService */

/**
 * Comprehensive pre-flight validator for anatomy recipes
 * Orchestrates multiple validation checks and produces unified report
 */
class RecipePreflightValidator {
  #dataRegistry;
  #anatomyBlueprintRepository;
  #schemaValidator;
  #slotGenerator;
  #logger;
  #loadFailures;
  #entityMatcherService;
  #validatorStack;

  constructor({
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    entityMatcherService,
    logger,
    loadFailures = {},
    validators = {},
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

    this.#dataRegistry = dataRegistry;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#schemaValidator = schemaValidator;
    this.#slotGenerator = slotGenerator;
    this.#entityMatcherService = entityMatcherService;
    this.#logger = logger;
    this.#loadFailures = loadFailures;
    this.#validatorStack = this.#createValidatorStack(validators);
  }

  /**
   * Validates a recipe with all pre-flight checks
   *
   * @param {object} recipe - Recipe to validate
   * @param {object} options - Validation options
   * @returns {Promise<ValidationReport>} Comprehensive validation report
   */
  async validate(recipe, options = {}) {
    const results = {
      recipeId: recipe.recipeId,
      recipePath: options.recipePath,
      timestamp: new Date().toISOString(),
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
    };

    await this.#runValidationChecks(recipe, results, options);

    return new ValidationReport(results);
  }

  async #runValidationChecks(recipe, results, options) {
    await this.#checkComponentExistence(recipe, results);

    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkPropertySchemas(recipe, results);
    }

    if (results.errors.length === 0 || !options.failFast) {
      await this.#runValidatorPipeline(recipe, results, options);
    }
  }

  async #checkComponentExistence(recipe, results) {
    try {
      const componentRule = new ComponentExistenceValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
      });

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { [recipe.recipeId]: recipe },
      });

      const issues = await componentRule.validate(context);
      const errors = issues.filter((i) => i.severity === 'error');

      if (errors.length === 0) {
        results.passed.push({
          check: 'component_existence',
          message: `All ${this.#countComponentReferences(recipe)} component references exist`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Component existence check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'component_existence',
        message: 'Failed to validate component existence',
        error: error.message,
      });
    }
  }

  async #checkPropertySchemas(recipe, results) {
    try {
      const propertyRule = new PropertySchemaValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
        schemaValidator: this.#schemaValidator,
      });

      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { [recipe.recipeId]: recipe },
      });

      const issues = await propertyRule.validate(context);
      const errors = issues.filter((i) => i.severity === 'error');

      if (errors.length === 0) {
        results.passed.push({
          check: 'property_schemas',
          message: `All ${this.#countPropertyObjects(recipe)} property objects valid`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Property schema check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'property_schemas',
        message: 'Failed to validate property schemas',
        error: error.message,
      });
    }
  }

  async #runValidatorPipeline(recipe, results, options) {
    const validatorOptions = {
      ...options,
      loadFailures: options.loadFailures ?? this.#loadFailures,
    };

    for (const validator of this.#validatorStack) {
      if (this.#shouldSkipValidator(validator.name, options)) {
        continue;
      }

      try {
        const validatorResult = await validator.validate(
          recipe,
          validatorOptions
        );

        this.#mergeValidatorResult(results, validatorResult);

        const hasErrors =
          Array.isArray(validatorResult?.errors) &&
          validatorResult.errors.length > 0;

        if (hasErrors && validator.failFast) {
          this.#logger.warn(
            `RecipePreflightValidator: Validator '${validator.name}' halted execution due to failFast errors`
          );
          break;
        }

        if (hasErrors && options.failFast) {
          this.#logger.warn(
            `RecipePreflightValidator: Halting pipeline after '${validator.name}' due to failFast option`
          );
          break;
        }
      } catch (error) {
        this.#logger.error(
          `RecipePreflightValidator: Validator '${validator.name}' threw an exception`,
          error
        );
        results.errors.push({
          type: 'VALIDATION_ERROR',
          check: validator.name,
          message: error.message,
        });
        if (validator.failFast || options.failFast) {
          break;
        }
      }
    }
  }

  #mergeValidatorResult(targetResults, validatorResult) {
    if (!validatorResult) {
      return;
    }

    if (Array.isArray(validatorResult.errors)) {
      targetResults.errors.push(...validatorResult.errors);
    }

    if (Array.isArray(validatorResult.warnings)) {
      targetResults.warnings.push(...validatorResult.warnings);
    }

    if (Array.isArray(validatorResult.suggestions)) {
      targetResults.suggestions.push(...validatorResult.suggestions);
    }

    if (Array.isArray(validatorResult.passed)) {
      targetResults.passed.push(...validatorResult.passed);
    }
  }

  #createValidatorStack(overrides = {}) {
    const stack = [
      overrides.blueprintExistence ??
        new BlueprintExistenceValidator({
          logger: this.#logger,
          anatomyBlueprintRepository: this.#anatomyBlueprintRepository,
        }),
      overrides.recipeBodyDescriptor ??
        new RecipeBodyDescriptorValidator({
          logger: this.#logger,
          dataRegistry: this.#dataRegistry,
        }),
      overrides.socketSlotCompatibility ??
        new SocketSlotCompatibilityValidator({
          logger: this.#logger,
          dataRegistry: this.#dataRegistry,
          anatomyBlueprintRepository: this.#anatomyBlueprintRepository,
        }),
      overrides.partAvailability ??
        new PartAvailabilityValidator({
          logger: this.#logger,
          dataRegistry: this.#dataRegistry,
          entityMatcherService: this.#entityMatcherService,
        }),
      overrides.generatedSlotParts ??
        new GeneratedSlotPartsValidator({
          logger: this.#logger,
          slotGenerator: this.#slotGenerator,
          dataRegistry: this.#dataRegistry,
          entityMatcherService: this.#entityMatcherService,
          anatomyBlueprintRepository: this.#anatomyBlueprintRepository,
        }),
      overrides.patternMatching ??
        new PatternMatchingValidator({
          logger: this.#logger,
          dataRegistry: this.#dataRegistry,
          slotGenerator: this.#slotGenerator,
          anatomyBlueprintRepository: this.#anatomyBlueprintRepository,
        }),
      overrides.descriptorCoverage ??
        new DescriptorCoverageValidator({
          logger: this.#logger,
          dataRegistry: this.#dataRegistry,
        }),
      overrides.loadFailure ?? new LoadFailureValidator({ logger: this.#logger }),
      overrides.recipeUsage ??
        new RecipeUsageValidator({
          logger: this.#logger,
          dataRegistry: this.#dataRegistry,
        }),
    ];

    return stack
      .filter(Boolean)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  }

  #shouldSkipValidator(name, options = {}) {
    const skipMap = {
      'pattern-matching': options.skipPatternValidation,
      'descriptor-coverage': options.skipDescriptorChecks,
      'part-availability': options.skipPartAvailabilityChecks,
      'generated-slot-parts': options.skipGeneratedSlotChecks,
      'load-failure': options.skipLoadFailureChecks,
      'recipe-usage': options.skipRecipeUsageCheck,
    };

    return Boolean(skipMap[name]);
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

export default RecipePreflightValidator;
