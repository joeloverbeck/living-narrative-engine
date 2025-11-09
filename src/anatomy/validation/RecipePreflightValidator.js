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
import { validateSocketSlotCompatibility } from './socketSlotCompatibilityValidator.js';
import { validatePatternMatching } from './patternMatchingValidator.js';

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../slotGenerator.js').default} SlotGenerator */

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

  constructor({
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    logger,
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

    this.#dataRegistry = dataRegistry;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#schemaValidator = schemaValidator;
    this.#slotGenerator = slotGenerator;
    this.#logger = logger;
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

    // Run all validation checks
    await this.#runValidationChecks(recipe, results, options);

    return new ValidationReport(results);
  }

  async #runValidationChecks(recipe, results, options) {
    // 1. Component Existence (Critical - P0)
    await this.#checkComponentExistence(recipe, results);

    // 2. Property Schemas (Critical - P0)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkPropertySchemas(recipe, results);
    }

    // 3. Blueprint Validation (Critical - P0)
    await this.#checkBlueprintExists(recipe, results);

    // 4. Socket/Slot Compatibility (Critical - P0)
    if (this.#blueprintExists(results)) {
      await this.#checkSocketSlotCompatibility(recipe, results);
    }

    // 5. Pattern Matching Dry-Run (Warning - P1)
    if (!options.skipPatternValidation) {
      this.#checkPatternMatching(recipe, results);
    }

    // 6. Descriptor Coverage (Suggestion - P1)
    if (!options.skipDescriptorChecks) {
      this.#checkDescriptorCoverage(recipe, results);
    }
  }

  async #checkComponentExistence(recipe, results) {
    try {
      // Use ComponentExistenceValidationRule from ANASYSIMP-001
      const componentRule = new ComponentExistenceValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
      });

      // Create context with just this recipe
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
      // Use PropertySchemaValidationRule from ANASYSIMP-002
      const propertyRule = new PropertySchemaValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
        schemaValidator: this.#schemaValidator,
      });

      // Create context with just this recipe
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

  async #checkBlueprintExists(recipe, results) {
    try {
      const blueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

      if (!blueprint) {
        results.errors.push({
          type: 'BLUEPRINT_NOT_FOUND',
          blueprintId: recipe.blueprintId,
          message: `Blueprint '${recipe.blueprintId}' does not exist`,
          fix: `Create blueprint at data/mods/*/blueprints/${recipe.blueprintId.split(':')[1]}.blueprint.json`,
          severity: 'error',
        });
      } else {
        results.passed.push({
          check: 'blueprint_exists',
          message: `Blueprint '${recipe.blueprintId}' found`,
          blueprint: {
            id: blueprint.id,
            root: blueprint.root,
            structureTemplate: blueprint.structureTemplate,
          },
        });
      }
    } catch (error) {
      this.#logger.error('Blueprint existence check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'blueprint_exists',
        message: 'Failed to check blueprint existence',
        error: error.message,
      });
    }
  }

  async #checkSocketSlotCompatibility(recipe, results) {
    try {
      const blueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);
      if (!blueprint) return; // Already caught by blueprint check

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        this.#dataRegistry
      );

      if (errors.length === 0) {
        const socketCount = this.#countAdditionalSlots(blueprint);
        results.passed.push({
          check: 'socket_slot_compatibility',
          message: `All ${socketCount} additionalSlot socket references valid`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Socket/slot compatibility check failed', error);
      results.warnings.push({
        type: 'VALIDATION_WARNING',
        check: 'socket_slot_compatibility',
        message: 'Failed to validate socket/slot compatibility',
        error: error.message,
      });
    }
  }

  async #checkPatternMatching(recipe, results) {
    try {
      const patterns = recipe.patterns || [];
      if (patterns.length === 0) {
        results.passed.push({
          check: 'pattern_matching',
          message: 'No patterns to validate',
        });
        return;
      }

      // Get blueprint for the recipe
      const blueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

      if (!blueprint) {
        this.#logger.warn(
          `Cannot validate patterns: blueprint '${recipe.blueprintId}' not found`
        );
        return;
      }

      // Run pattern matching dry-run validation
      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        this.#dataRegistry,
        this.#slotGenerator,
        this.#logger
      );

      if (warnings.length === 0) {
        const patternCount = patterns.length;
        results.passed.push({
          check: 'pattern_matching',
          message: `All ${patternCount} pattern(s) have matching slots`,
        });
      } else {
        results.warnings.push(...warnings);
      }
    } catch (error) {
      this.#logger.error('Pattern matching check failed', error);
      results.warnings.push({
        type: 'VALIDATION_WARNING',
        check: 'pattern_matching',
        message: 'Pattern matching check failed',
        error: error.message,
      });
    }
  }

  #checkDescriptorCoverage(recipe, results) {
    try {
      // Check if entities referenced by slots/patterns have descriptor components
      // This is a suggestion-level check (not critical)

      const suggestions = [];

      for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
        const hasDescriptors = this.#hasDescriptorComponents(slot.tags || []);

        if (!hasDescriptors) {
          suggestions.push({
            type: 'MISSING_DESCRIPTORS',
            location: { type: 'slot', name: slotName },
            message: `Slot '${slotName}' may not appear in descriptions`,
            reason: 'No descriptor components in tags',
            suggestion:
              'Add descriptor components (descriptors:size_category, descriptors:texture, etc.)',
            impact: 'Part will be excluded from anatomy description',
          });
        }
      }

      if (suggestions.length > 0) {
        results.suggestions.push(...suggestions);
      } else {
        results.passed.push({
          check: 'descriptor_coverage',
          message: 'All slots have descriptor components',
        });
      }
    } catch (error) {
      this.#logger.error('Descriptor coverage check failed', error);
      // Don't add error/warning - this is optional
    }
  }

  #hasDescriptorComponents(tags) {
    return tags.some((tag) => tag.startsWith('descriptors:'));
  }

  #blueprintExists(results) {
    return results.passed.some((p) => p.check === 'blueprint_exists');
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

  #countAdditionalSlots(blueprint) {
    return Object.keys(blueprint.additionalSlots || {}).length;
  }
}

export default RecipePreflightValidator;
