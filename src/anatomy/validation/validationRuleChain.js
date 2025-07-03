/**
 * @file Chain of Responsibility implementation for validation rules
 */

import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('./validationRule.js').ValidationRule} ValidationRule */
/** @typedef {import('./validationContext.js').ValidationContext} ValidationContext */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Manages the execution of validation rules in a chain
 */
export class ValidationRuleChain {
  /** @type {ValidationRule[]} */
  #rules;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   */
  constructor({ logger }) {
    if (!logger) throw new InvalidArgumentError('logger is required');

    this.#rules = [];
    this.#logger = logger;
  }

  /**
   * Add a rule to the validation chain
   *
   * @param {ValidationRule} rule - The rule to add
   * @returns {ValidationRuleChain} This instance for chaining
   */
  addRule(rule) {
    if (!rule) throw new InvalidArgumentError('rule is required');
    if (typeof rule.validate !== 'function') {
      throw new InvalidArgumentError('rule must implement validate method');
    }

    this.#rules.push(rule);
    this.#logger.debug(
      `ValidationRuleChain: Added rule '${rule.ruleName}' to chain`
    );

    return this;
  }

  /**
   * Execute all rules in the chain
   *
   * @param {ValidationContext} context - The validation context
   * @returns {Promise<void>}
   */
  async execute(context) {
    if (!context) throw new InvalidArgumentError('context is required');

    this.#logger.debug(
      `ValidationRuleChain: Executing ${this.#rules.length} validation rules`
    );

    for (const rule of this.#rules) {
      try {
        // Check if rule should be applied
        if (!rule.shouldApply(context)) {
          this.#logger.debug(
            `ValidationRuleChain: Skipping rule '${rule.ruleName}' - shouldApply returned false`
          );
          continue;
        }

        this.#logger.debug(
          `ValidationRuleChain: Executing rule '${rule.ruleName}'`
        );

        // Execute the rule
        const issues = await rule.validate(context);

        // Add issues to context
        if (issues && issues.length > 0) {
          context.addIssues(issues);
          this.#logger.debug(
            `ValidationRuleChain: Rule '${rule.ruleName}' found ${issues.length} issues`
          );
        }
      } catch (error) {
        // Log error but continue with other rules
        this.#logger.error(
          `ValidationRuleChain: Error executing rule '${rule.ruleName}'`,
          { error: error.message, stack: error.stack }
        );

        // Add error as a validation issue
        context.addIssues([
          {
            severity: 'error',
            message: `Validation rule '${rule.ruleName}' failed: ${error.message}`,
            ruleId: rule.ruleId,
            context: { error: error.message },
          },
        ]);
      }
    }

    const result = context.getResult();
    this.#logger.debug(
      `ValidationRuleChain: Completed validation with ${result.errors.length} errors and ${result.warnings.length} warnings`
    );
  }

  /**
   * Get the number of rules in the chain
   *
   * @returns {number}
   */
  getRuleCount() {
    return this.#rules.length;
  }

  /**
   * Get rule names in the chain
   *
   * @returns {string[]}
   */
  getRuleNames() {
    return this.#rules.map(rule => rule.ruleName);
  }
}