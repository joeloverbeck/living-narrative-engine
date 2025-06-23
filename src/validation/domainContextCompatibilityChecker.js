/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 * @typedef {import('../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition
 */

/**
 * Service responsible for checking if an action's target domain is compatible
 * with the provided target context type. It enforces that actions expecting a
 * target receive an 'entity' context, and actions expecting no target receive
 * a 'none' context.
 * Extracted from ActionValidationService for SRP.
 */
export class DomainContextCompatibilityChecker {
  #logger;

  /**
   * Creates an instance of DomainContextCompatibilityChecker.
   *
   * @param {object} dependencies - The required dependencies.
   * @param {ILogger} dependencies.logger - Logger service instance.
   * @throws {Error} If the logger dependency is missing or invalid.
   */
  constructor({ logger }) {
    if (
      !logger ||
      typeof logger.debug !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      throw new Error(
        'DomainContextCompatibilityChecker requires a valid ILogger instance.'
      );
    }
    this.#logger = logger;
    this.#logger.debug('DomainContextCompatibilityChecker initialized.');
  }

  /**
   * Checks if the target domain specified in an action definition is compatible
   * with the type of the provided target context.
   *
   * @param {ActionDefinition} actionDefinition - The action being validated.
   * @param {ActionTargetContext} targetContext - The context describing the action's target.
   * @returns {boolean} True if the domain and context type are compatible, false otherwise.
   */
  check(actionDefinition, targetContext) {
    if (!actionDefinition || !targetContext) {
      this.#logger.error(
        'DomainContextCompatibilityChecker.check: Called with invalid actionDefinition or targetContext.'
      );
      return false;
    }

    const actionId = actionDefinition.id || 'UNKNOWN_ACTION';
    // An action expects a target if its domain is anything other than 'none'.
    const expectsTarget = (actionDefinition.target_domain || 'none') !== 'none';
    const contextHasTarget = targetContext.type === 'entity';

    let isCompatible = true;

    if (expectsTarget && !contextHasTarget) {
      // Action requires a target, but the context doesn't provide an entity.
      this.#logger.debug(
        `Validation failed (Domain/Context): Action '${actionId}' (domain '${actionDefinition.target_domain}') requires an entity target, but context type is '${targetContext.type}'.`
      );
      isCompatible = false;
    } else if (!expectsTarget && contextHasTarget) {
      // Action requires NO target, but the context provides an entity.
      this.#logger.debug(
        `Validation failed (Domain/Context): Action '${actionId}' (domain 'none') expects no target, but context type is 'entity'.`
      );
      isCompatible = false;
    }

    if (isCompatible) {
      this.#logger.debug(
        `Domain/Context Check Passed: Action '${actionId}' (domain '${
          actionDefinition.target_domain || 'none'
        }') is compatible with context type '${targetContext.type}'.`
      );
    }

    return isCompatible;
  }
}
