/**
 * @file Validates operation handler completeness for rules and registry consistency.
 * @see tickets/ROBOPEHANVAL-004-handler-completeness-validator.md
 */

import { ConfigurationError } from '../errors/configurationError.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * @typedef {object} ValidationReport
 * @property {string[]} missingHandlers - Operation types in whitelist but not in registry
 * @property {string[]} orphanedHandlers - Handlers in registry but not in whitelist
 * @property {boolean} isComplete - True if no mismatches
 */

/**
 * Service for validating operation handler completeness.
 *
 * Two validation modes:
 * 1. Rule validation: Ensures all operations in a rule have registered handlers
 * 2. Registry validation: Compares whitelist against registry for mismatches
 */
export class HandlerCompletenessValidator {
  /**
   * Creates a HandlerCompletenessValidator instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.logger - Logger instance
   */
  constructor({ logger }) {
    // Validate logger but don't store if not needed (currently a pure validator)
    ensureValidLogger(logger);
  }

  /**
   * Validates that all operations in a rule have registered handlers.
   *
   * @param {object} rule - The rule object with actions array
   * @param {object} registry - The OperationRegistry instance
   * @throws {ConfigurationError} If any operation lacks a handler
   */
  validateRuleHandlerCompleteness(rule, registry) {
    const ruleId = rule?.id ?? '<unknown>';
    const actions = rule?.actions ?? [];

    const missingHandlers = [];
    this.#collectMissingHandlers(actions, registry, missingHandlers);

    if (missingHandlers.length > 0) {
      const sortedMissing = [...missingHandlers].sort();
      const details = sortedMissing
        .map((t) => `- ${t} (no handler registered)`)
        .join('\n');
      throw new ConfigurationError(
        `Rule '${ruleId}' uses operations with no registered handlers:\n${details}`,
        { ruleId, missingHandlers: sortedMissing }
      );
    }
  }

  /**
   * Compares whitelist against registry and reports mismatches.
   *
   * @param {string[]} knownTypes - The KNOWN_OPERATION_TYPES array
   * @param {object} registry - The OperationRegistry instance
   * @returns {ValidationReport} Report of mismatches
   */
  validateHandlerRegistryCompleteness(knownTypes, registry) {
    const registeredTypes = registry.getRegisteredTypes();
    const knownSet = new Set(knownTypes);
    const registeredSet = new Set(registeredTypes);

    const missingHandlers = knownTypes
      .filter((t) => !registeredSet.has(t))
      .sort();

    const orphanedHandlers = registeredTypes
      .filter((t) => !knownSet.has(t))
      .sort();

    return {
      missingHandlers,
      orphanedHandlers,
      isComplete: missingHandlers.length === 0 && orphanedHandlers.length === 0,
    };
  }

  /**
   * Recursively collects operation types that lack registered handlers.
   *
   * @param {Array} actions - Array of operation objects
   * @param {object} registry - The OperationRegistry instance
   * @param {string[]} missingHandlers - Accumulator for missing handler types
   * @private
   */
  #collectMissingHandlers(actions, registry, missingHandlers) {
    for (const action of actions) {
      // Skip macro references - they expand to operations later
      if (action.macro) {
        continue;
      }

      // Check this operation's type
      if (action.type && !registry.hasHandler(action.type)) {
        if (!missingHandlers.includes(action.type)) {
          missingHandlers.push(action.type);
        }
      }

      // Recurse into nested operations (IF then_actions/else_actions)
      if (action.parameters?.then_actions) {
        this.#collectMissingHandlers(
          action.parameters.then_actions,
          registry,
          missingHandlers
        );
      }
      if (action.parameters?.else_actions) {
        this.#collectMissingHandlers(
          action.parameters.else_actions,
          registry,
          missingHandlers
        );
      }
    }
  }
}

export default HandlerCompletenessValidator;
