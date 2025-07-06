// src/anatomy/graphIntegrityValidator.js

/**
 * @file Validates anatomy graphs against recipe constraints and socket limits
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ValidationContext } from './validation/validationContext.js';
import { ValidationRuleChain } from './validation/validationRuleChain.js';
import { SocketLimitRule } from './validation/rules/socketLimitRule.js';
import { RecipeConstraintRule } from './validation/rules/recipeConstraintRule.js';
import { CycleDetectionRule } from './validation/rules/cycleDetectionRule.js';
import { JointConsistencyRule } from './validation/rules/jointConsistencyRule.js';
import { OrphanDetectionRule } from './validation/rules/orphanDetectionRule.js';
import { PartTypeCompatibilityRule } from './validation/rules/partTypeCompatibilityRule.js';
import { RecipeConstraintEvaluator } from './recipeConstraintEvaluator.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * Service that validates assembled anatomy graphs
 */
export class GraphIntegrityValidator {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ValidationRuleChain} */
  #ruleChain;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!logger) throw new InvalidArgumentError('logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;

    // Initialize the validation rule chain
    this.#ruleChain = new ValidationRuleChain({ logger });
    this.#initializeRules();
  }

  /**
   * Initialize validation rules in the chain
   *
   * @private
   */
  #initializeRules() {
    // Create recipe constraint evaluator for the recipe rule
    const recipeConstraintEvaluator = new RecipeConstraintEvaluator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    // Add rules in order of execution
    this.#ruleChain
      .addRule(new SocketLimitRule())
      .addRule(new RecipeConstraintRule({ recipeConstraintEvaluator }))
      .addRule(new CycleDetectionRule())
      .addRule(new JointConsistencyRule())
      .addRule(new OrphanDetectionRule())
      .addRule(new PartTypeCompatibilityRule());

    this.#logger.debug(
      `GraphIntegrityValidator: Initialized with ${this.#ruleChain.getRuleCount()} validation rules`
    );
  }

  /**
   * Validates an assembled anatomy graph
   *
   * @param {string[]} entityIds - All entity IDs in the graph
   * @param {object} recipe - The recipe used to assemble the graph
   * @param {Set<string>} socketOccupancy - Occupied sockets tracking
   * @returns {Promise<ValidationResult>}
   */
  async validateGraph(entityIds, recipe, socketOccupancy) {
    this.#logger.debug(
      `GraphIntegrityValidator: Validating graph with ${entityIds.length} entities`
    );

    // Create validation context
    const context = new ValidationContext({
      entityIds,
      recipe,
      socketOccupancy,
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    try {
      // Execute all validation rules
      await this.#ruleChain.execute(context);
    } catch (error) {
      this.#logger.error(
        'GraphIntegrityValidator: Unexpected error during validation',
        { error }
      );
      context.addIssues([
        {
          severity: 'error',
          message: `Validation error: ${error.message}`,
          ruleId: 'system',
          context: { error: error.message },
        },
      ]);
    }

    const result = context.getResult();

    if (!result.valid) {
      this.#logger.error(
        `GraphIntegrityValidator: Validation failed with ${result.errors.length} errors`
      );
    } else if (result.warnings.length > 0) {
      this.#logger.warn(
        `GraphIntegrityValidator: Validation passed with ${result.warnings.length} warnings`
      );
    } else {
      this.#logger.debug(
        'GraphIntegrityValidator: Validation passed without issues'
      );
    }

    return result;
  }
}

export default GraphIntegrityValidator;
