/**
 * @file Context object for load-time blueprint-recipe validation
 * @see validationContext.js - Runtime validation context
 */

import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('./validationRule.js').ValidationIssue} ValidationIssue */

/**
 * Context object for load-time validation (blueprints × recipes)
 * Differs from runtime ValidationContext which validates assembled graphs
 */
export class LoadTimeValidationContext {
  /** @type {Object.<string, object>} */
  #blueprints;
  /** @type {Object.<string, object>} */
  #recipes;
  /** @type {ValidationIssue[]} */
  #issues;
  /** @type {Map<string, any>} */
  #metadata;

  /**
   * @param {object} params
   * @param {Object.<string, object>} params.blueprints - All loaded blueprints (blueprintId → blueprint)
   * @param {Object.<string, object>} params.recipes - All loaded recipes (recipeId → recipe)
   */
  constructor({ blueprints, recipes }) {
    if (!blueprints) throw new InvalidArgumentError('blueprints is required');
    if (!recipes) throw new InvalidArgumentError('recipes is required');

    this.#blueprints = blueprints;
    this.#recipes = recipes;
    this.#issues = [];
    this.#metadata = new Map();
  }

  /**
   * Check if context has blueprints
   *
   * @returns {boolean}
   */
  hasBlueprints() {
    return Object.keys(this.#blueprints).length > 0;
  }

  /**
   * Check if context has recipes
   *
   * @returns {boolean}
   */
  hasRecipes() {
    return Object.keys(this.#recipes).length > 0;
  }

  /**
   * Get all blueprints
   *
   * @returns {Object.<string, object>}
   */
  getBlueprints() {
    return this.#blueprints;
  }

  /**
   * Get all recipes
   *
   * @returns {Object.<string, object>}
   */
  getRecipes() {
    return this.#recipes;
  }

  /**
   * Add validation issues to the context
   *
   * @param {ValidationIssue[]} issues - Issues to add
   */
  addIssues(issues) {
    this.#issues.push(...issues);
  }

  /**
   * Get all validation issues
   *
   * @returns {ValidationIssue[]}
   */
  getIssues() {
    return [...this.#issues];
  }

  /**
   * Get validation issues by severity
   *
   * @param {'error' | 'warning' | 'info'} severity
   * @returns {ValidationIssue[]}
   */
  getIssuesBySeverity(severity) {
    return this.#issues.filter((issue) => issue.severity === severity);
  }

  /**
   * Get all errors
   *
   * @returns {string[]} Error messages
   */
  getErrors() {
    return this.getIssuesBySeverity('error').map((issue) => issue.message);
  }

  /**
   * Get all warnings
   *
   * @returns {string[]} Warning messages
   */
  getWarnings() {
    return this.getIssuesBySeverity('warning').map((issue) => issue.message);
  }

  /**
   * Check if validation has errors
   *
   * @returns {boolean}
   */
  hasErrors() {
    return this.getIssuesBySeverity('error').length > 0;
  }

  /**
   * Store metadata that can be shared between rules
   *
   * @param {string} key - Metadata key
   * @param {any} value - Metadata value
   */
  setMetadata(key, value) {
    this.#metadata.set(key, value);
  }

  /**
   * Retrieve metadata stored by previous rules
   *
   * @param {string} key - Metadata key
   * @returns {any} Metadata value or undefined
   */
  getMetadata(key) {
    return this.#metadata.get(key);
  }

  /**
   * Get validation result summary
   *
   * @returns {object} Validation result
   */
  getResult() {
    const errors = this.getErrors();
    const warnings = this.getWarnings();

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
