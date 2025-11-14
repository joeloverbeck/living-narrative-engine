/**
 * @file Recipe validator interface for the refactored validation pipeline
 * @see ../anatomy/validation/validationRule.js - Existing ValidationRule base class
 * @see ../anatomy/validation/ValidationReport.js - Existing ValidationReport class
 */

/** @typedef {import('../anatomy/validation/ValidationReport.js').default} ValidationReport */

/**
 * Recipe validator interface
 *
 * @interface IRecipeValidator
 * @description Defines the contract for recipe validators in the refactored validation pipeline.
 * This interface defines orchestrator-level validators that coordinate validation rules and
 * produce comprehensive validation reports. Aligns with RecipePreflightValidator pattern.
 */
export class IRecipeValidator {
  /**
   * Validator name (unique identifier)
   *
   * @type {string}
   */
  get name() {
    throw new Error('IRecipeValidator.name not implemented');
  }

  /**
   * Validator priority (lower = runs first)
   *
   * @type {number}
   */
  get priority() {
    throw new Error('IRecipeValidator.priority not implemented');
  }

  /**
   * Whether this validator should stop pipeline on failure
   *
   * @type {boolean}
   */
  get failFast() {
    return false;
  }

  /**
   * Validate recipe and produce comprehensive validation report
   *
   * @param {object} recipe - Recipe to validate
   * @param {object} [_options] - Validation options (e.g., recipePath, strict mode)
   * @returns {Promise<ValidationReport>} Comprehensive validation report with errors, warnings, and suggestions
   */
  async validate(recipe, _options = {}) {
    throw new Error('IRecipeValidator.validate not implemented');
  }
}
