/**
 * @file Validates consistency between blueprints and recipes at load time.
 * @see ../validationRule.js - Base class
 * @see ../../recipePatternResolver.js - Pattern resolution logic (reused)
 */

import { ValidationRule } from '../validationRule.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/** @typedef {import('../loadTimeValidationContext.js').LoadTimeValidationContext} LoadTimeValidationContext */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../recipePatternResolver.js').default} RecipePatternResolver */
/** @typedef {import('../../../events/eventDispatchService.js').default} EventDispatchService */

/**
 * Validates blueprint-recipe coverage and pattern matching at load time
 */
export class BlueprintRecipeValidationRule extends ValidationRule {
  #logger;
  #recipePatternResolver;
  #safeEventDispatcher;

  /**
   * @param {object} params
   * @param {ILogger} params.logger
   * @param {RecipePatternResolver} params.recipePatternResolver
   * @param {EventDispatchService} params.eventDispatchService
   */
  /**
   * @param {object} params
   * @param {ILogger} params.logger
   * @param {RecipePatternResolver} params.recipePatternResolver
   * @param {ISafeEventDispatcher} params.safeEventDispatcher
   */
  constructor({ logger, recipePatternResolver, safeEventDispatcher }) {
    super();

    // Validate dependencies using project pattern
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(
      recipePatternResolver,
      'IRecipePatternResolver',
      logger,
      {
        requiredMethods: ['resolveRecipePatterns'],
      }
    );
    validateDependency(
      safeEventDispatcher,
      'ISafeEventDispatcher',
      logger,
      {
        requiredMethods: ['dispatch'],
      }
    );

    this.#logger = logger;
    this.#recipePatternResolver = recipePatternResolver;
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * @returns {string} Unique identifier for this rule
   */
  get ruleId() {
    return 'blueprint-recipe-coverage';
  }

  /**
   * @returns {string} Human-readable name for this rule
   */
  get ruleName() {
    return 'Blueprint Recipe Coverage Validation';
  }

  /**
   * Determines if this rule should apply to the given validation context.
   *
   * @param {LoadTimeValidationContext} context - Context with blueprints and recipes
   * @returns {boolean} True if context has both blueprints and recipes
   */
  shouldApply(context) {
    return context.hasBlueprints() && context.hasRecipes();
  }

  /**
   * Validates blueprint-recipe consistency.
   *
   * @param {LoadTimeValidationContext} context - Validation context with blueprints and recipes
   * @returns {Promise<Array>} Array of validation issues
   */
  async validate(context) {
    const issues = [];
    const blueprints = context.getBlueprints();
    const recipes = context.getRecipes();

    for (const [blueprintId, blueprint] of Object.entries(blueprints)) {
      for (const [recipeId, recipe] of Object.entries(recipes)) {
        const recipeBlueprintId =
          recipe.blueprintId ?? recipe.targetBlueprint ?? null;

        // Only validate if recipe explicitly targets this blueprint
        if (!recipeBlueprintId || recipeBlueprintId === blueprintId) {
          try {
            const validationResult = await this.#validateRecipe(
              blueprint,
              recipe
            );
            issues.push(...validationResult);
          } catch (err) {
            // Dispatch error event following project pattern
            this.#safeEventDispatcher.dispatch({
              type: 'SYSTEM_ERROR_OCCURRED',
              payload: {
                error: err.message,
                context: {
                  blueprintId,
                  recipeId,
                  validationRule: this.ruleId,
                },
              },
            });

            this.#logger.error(
              `Blueprint-Recipe validation failed for ${recipeId} → ${blueprintId}`,
              err
            );

            issues.push({
              severity: 'error',
              type: 'validation_error',
              message: `Validation failed: ${err.message}`,
              ruleId: this.ruleId,
              context: { blueprintId, recipeId },
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Validates a single recipe against its blueprint.
   *
   * @private
   * @param {object} blueprint - Blueprint definition
   * @param {object} recipe - Recipe definition
   * @returns {Promise<Array>} Array of issues found
   */
  async #validateRecipe(blueprint, recipe) {
    const issues = [];

    // Check for no patterns
    if (!recipe.patterns || recipe.patterns.length === 0) {
      issues.push({
        severity: 'error',
        type: 'no_patterns',
        message: `Recipe ${recipe.id} has no patterns defined`,
        suggestion: 'Add at least one pattern to the recipe',
        ruleId: this.ruleId,
        context: { blueprintId: blueprint.id, recipeId: recipe.id },
      });
      return issues;
    }

    // Reuse RecipePatternResolver for actual pattern resolution
    // This avoids duplicating 200+ lines of pattern matching logic
    const resolved = await this.#recipePatternResolver.resolveRecipePatterns(
      recipe,
      blueprint
    );

    // Calculate coverage metrics
    const totalSlots = Object.keys(blueprint.slots || {}).length;
    const coveredSlots = new Set(Object.keys(resolved || {}));
    const coverage = totalSlots > 0 ? (coveredSlots.size / totalSlots) * 100 : 0;

    // Check for critically low coverage
    if (coverage < 50) {
      issues.push({
        severity: 'error',
        type: 'critically_incomplete',
        coverage,
        message: `Recipe ${recipe.id} has critically low coverage (${coverage.toFixed(1)}%) of blueprint ${blueprint.id}`,
        suggestion: 'Recipe should cover at least 50% of blueprint slots',
        ruleId: this.ruleId,
        context: { blueprintId: blueprint.id, recipeId: recipe.id, coverage },
      });
    }

    // Check for incomplete coverage
    if (coverage < 100) {
      const uncoveredSlots = Object.keys(blueprint.slots || {}).filter(
        (key) => !coveredSlots.has(key)
      );

      issues.push({
        severity: coverage < 50 ? 'error' : 'warning',
        type: 'incomplete_coverage',
        coverage,
        message: `Recipe ${recipe.id} covers only ${coverage.toFixed(1)}% of blueprint ${blueprint.id}`,
        uncoveredSlots,
        suggestion:
          'Add patterns to cover missing slots or verify this is intentional',
        ruleId: this.ruleId,
        context: { blueprintId: blueprint.id, recipeId: recipe.id, coverage },
      });
    }

    // Check for zero-match patterns
    const patternMatches = this.#calculatePatternMatches(recipe, resolved);
    for (const [index, matchCount] of patternMatches.entries()) {
      if (matchCount === 0) {
        issues.push({
          severity: 'warning',
          type: 'zero_matches',
          pattern: recipe.patterns[index],
          message: `Pattern at index ${index} matches zero slots in blueprint ${blueprint.id}`,
          suggestion: `Check pattern against available slots: ${Object.keys(blueprint.slots || {}).join(', ')}`,
          ruleId: this.ruleId,
          context: { blueprintId: blueprint.id, recipeId: recipe.id },
        });
      }
    }

    // Log results
    this.#logValidationResults(blueprint.id, recipe.id, coverage, issues);

    return issues;
  }

  /**
   * Calculates how many slots each pattern matched.
   *
   * @private
   * @param {object} recipe - Recipe with patterns
   * @param {object} resolved - Resolved recipe slots
   * @returns {number[]} Match counts per pattern
   */
  #calculatePatternMatches(recipe, resolved) {
    const matchCounts = new Array(recipe.patterns.length).fill(0);

    for (const slotKey in resolved) {
      const patternIndex = resolved[slotKey].patternIndex;
      if (patternIndex !== undefined && patternIndex < matchCounts.length) {
        matchCounts[patternIndex]++;
      }
    }

    return matchCounts;
  }

  /**
   * Logs validation results with appropriate severity.
   *
   * @private
   * @param {string} blueprintId - Blueprint ID
   * @param {string} recipeId - Recipe ID
   * @param {number} coverage - Coverage percentage
   * @param {Array} issues - Validation issues
   */
  #logValidationResults(blueprintId, recipeId, coverage, issues) {
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');

    if (errors.length > 0) {
      this.#logger.error(
        `Blueprint-Recipe validation ERRORS for ${recipeId} → ${blueprintId}:`,
        errors
      );
    }

    if (warnings.length > 0) {
      this.#logger.warn(
        `Blueprint-Recipe validation warnings for ${recipeId} → ${blueprintId}:\n` +
          `  Coverage: ${coverage.toFixed(1)}%\n` +
          `  Issues: ${warnings.length} warning(s)`
      );
    } else if (coverage === 100) {
      this.#logger.debug(
        `Blueprint-Recipe validation passed for ${recipeId} → ${blueprintId} (100% coverage)`
      );
    }
  }
}
