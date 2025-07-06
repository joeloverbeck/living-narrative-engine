/**
 * @file Validation rule for recipe constraints
 */

import { ValidationRule } from '../validationRule.js';
import { RecipeConstraintEvaluator } from '../../recipeConstraintEvaluator.js';

/**
 * Validates recipe constraints by delegating to RecipeConstraintEvaluator
 */
export class RecipeConstraintRule extends ValidationRule {
  /** @type {RecipeConstraintEvaluator} */
  #constraintEvaluator;

  /**
   * @param {object} deps
   * @param {RecipeConstraintEvaluator} deps.recipeConstraintEvaluator
   */
  constructor({ recipeConstraintEvaluator }) {
    super();
    this.#constraintEvaluator = recipeConstraintEvaluator;
  }

  get ruleId() {
    return 'recipe-constraints';
  }

  get ruleName() {
    return 'Recipe Constraint Validation';
  }

  /**
   * Skip this rule if no constraints exist
   *
   * @param {import('../validationContext.js').ValidationContext} context
   * @returns {boolean}
   */
  shouldApply(context) {
    const { recipe } = context;
    return !!(
      recipe.constraints?.requires ||
      recipe.constraints?.excludes ||
      recipe.slots
    );
  }

  /**
   * Validate recipe constraints
   *
   * @param {import('../validationContext.js').ValidationContext} context
   * @returns {Promise<import('../validationRule.js').ValidationIssue[]>}
   */
  async validate(context) {
    const issues = [];
    const { entityIds, recipe, logger } = context;

    logger.debug(
      `RecipeConstraintRule: Validating recipe constraints for ${entityIds.length} entities`
    );

    // If no constraint evaluator is provided, create one using context
    const evaluator =
      this.#constraintEvaluator ||
      new RecipeConstraintEvaluator({
        entityManager: context.entityManager,
        logger: context.logger,
      });

    // Delegate to the constraint evaluator
    const result = evaluator.evaluateConstraints(entityIds, recipe);

    // Convert errors to validation issues
    for (const error of result.errors) {
      issues.push(this.createError(error));
    }

    // Convert warnings to validation issues
    for (const warning of result.warnings) {
      issues.push(this.createWarning(warning));
    }

    logger.debug(
      `RecipeConstraintRule: Found ${result.errors.length} errors and ${result.warnings.length} warnings`
    );

    return issues;
  }
}

export default RecipeConstraintRule;
