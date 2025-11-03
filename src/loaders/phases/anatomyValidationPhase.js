/**
 * @file Phase that validates anatomy blueprints and recipes after loading.
 * @see ../modsLoader.js - Phase-based loading system
 * @see ../../anatomy/validation/validationRuleChain.js - Validation infrastructure
 */

import LoaderPhase from './LoaderPhase.js';
import { ValidationRuleChain } from '../../anatomy/validation/validationRuleChain.js';
import { LoadTimeValidationContext } from '../../anatomy/validation/loadTimeValidationContext.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { logPhaseStart } from '../../utils/logPhaseStart.js';

/** @typedef {import('../LoadContext.js').LoadContext} LoadContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../anatomy/validation/rules/blueprintRecipeValidationRule.js').BlueprintRecipeValidationRule} BlueprintRecipeValidationRule */

/**
 * Phase that validates anatomy blueprints and recipes after content loading
 */
export default class AnatomyValidationPhase extends LoaderPhase {
  #logger;
  #validationRule;

  /**
   * @param {object} params
   * @param {ILogger} params.logger
   * @param {BlueprintRecipeValidationRule} params.blueprintRecipeValidationRule
   */
  constructor({ logger, blueprintRecipeValidationRule }) {
    super('anatomy-validation');

    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#validationRule = blueprintRecipeValidationRule;
  }

  /**
   * Executes validation phase after anatomy content is loaded.
   *
   * @param {LoadContext} ctx - Mod loading context with loaded blueprints and recipes
   * @returns {Promise<LoadContext>} Updated context with validation results
   */
  async execute(ctx) {
    logPhaseStart(this.#logger, 'AnatomyValidationPhase');

    // Extract anatomy data from loaded content
    const blueprints = this.#extractBlueprints(ctx);
    const recipes = this.#extractRecipes(ctx);

    if (
      Object.keys(blueprints).length === 0 ||
      Object.keys(recipes).length === 0
    ) {
      this.#logger.debug(
        'Skipping anatomy validation: no blueprints or recipes loaded'
      );
      return ctx;
    }

    // Create validation context
    const validationContext = new LoadTimeValidationContext({
      blueprints,
      recipes,
    });

    // Execute validation using Chain of Responsibility pattern
    const validationChain = new ValidationRuleChain({ logger: this.#logger });
    validationChain.addRule(this.#validationRule);

    await validationChain.execute(validationContext);

    // Get validation results from context
    const issues = validationContext.getIssues();
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');

    if (errors.length > 0) {
      this.#logger.warn(
        `Anatomy validation found ${errors.length} error(s) and ${warnings.length} warning(s)`
      );
      // Note: Validation errors are logged but do not halt loading.
      // This allows development to continue while issues are addressed.
    } else if (warnings.length > 0) {
      this.#logger.info(
        `Anatomy validation completed with ${warnings.length} warning(s)`
      );
    } else {
      this.#logger.info('Anatomy validation completed successfully');
    }

    // Attach validation results to context
    return {
      ...ctx,
      anatomyValidation: {
        issues,
        errors: errors.length,
        warnings: warnings.length,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Extracts blueprint data from mod loading context.
   *
   * @private
   * @param {LoadContext} ctx - Load context
   * @returns {Object.<string, object>} Blueprints indexed by ID
   */
  #extractBlueprints(ctx) {
    const blueprintArray = ctx.registry.getAll('anatomyBlueprints');

    // Convert array to object with IDs as keys
    const blueprints = {};
    for (const blueprint of blueprintArray) {
      if (blueprint && blueprint.id) {
        blueprints[blueprint.id] = blueprint;
      }
    }

    return blueprints;
  }

  /**
   * Extracts recipe data from mod loading context.
   *
   * @private
   * @param {LoadContext} ctx - Load context
   * @returns {Object.<string, object>} Recipes indexed by ID
   */
  #extractRecipes(ctx) {
    const recipeArray = ctx.registry.getAll('anatomyRecipes');

    // Convert array to object with IDs as keys
    const recipes = {};
    for (const recipe of recipeArray) {
      if (recipe && recipe.id) {
        recipes[recipe.id] = recipe;
      }
    }

    return recipes;
  }
}
