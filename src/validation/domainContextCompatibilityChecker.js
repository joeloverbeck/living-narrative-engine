// src/validation/domainContextCompatibilityChecker.js

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition
 * @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 * @typedef {import('../types/actionDefinition.js').TargetDomain} TargetDomain
 */

/**
 * Service responsible for checking if an action's target domain is compatible
 * with the provided target context type.
 * Extracted from ActionValidationService for SRP.
 */
export class DomainContextCompatibilityChecker {
  /** @private @type {ILogger} */
  #logger;

  // Define domain categories for clarity
  /** @private @type {TargetDomain[]} */
  #entityTargetDomains = ['self', 'inventory', 'equipment', 'environment', 'location', 'location_items', 'location_non_items', 'nearby', 'nearby_including_blockers'];
  /** @private @type {TargetDomain[]} */
  #directionTargetDomains = ['direction'];
  /** @private @type {TargetDomain[]} */
  #noTargetDomains = ['none']; // Explicitly 'none'

  /**
     * Creates an instance of DomainContextCompatibilityChecker.
     * @param {object} dependencies - The required dependencies.
     * @param {ILogger} dependencies.logger - Logger service instance.
     * @throws {Error} If the logger dependency is missing or invalid.
     */
  constructor({logger}) {
    // Dependency Injection & Validation (AC2)
    if (!logger || typeof logger.debug !== 'function' || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.info !== 'function') {
      // Throw error if logger is missing or doesn't conform to the expected ILogger interface
      throw new Error('DomainContextCompatibilityChecker requires a valid ILogger instance.');
    }
    this.#logger = logger;
    this.#logger.info('DomainContextCompatibilityChecker initialized.');
  }

  /**
     * Checks if the target domain specified in an action definition is compatible
     * with the type of the provided target context.
     *
     * @param {ActionDefinition} actionDefinition - The action being validated.
     * @param {ActionTargetContext} targetContext - The context describing the action's target.
     * @returns {boolean} True if the domain and context type are compatible, false otherwise. Logs failures. (AC3)
     */
  check(actionDefinition, targetContext) {
    if (!actionDefinition || !targetContext) {
      this.#logger.error('DomainContextCompatibilityChecker.check: Called with invalid actionDefinition or targetContext.');
      return false; // Cannot proceed with invalid inputs
    }

    const actionId = actionDefinition.id || 'UNKNOWN_ACTION'; // Fallback for logging if ID missing
    // Default to 'none' if target_domain is missing or falsy (like null/undefined)
    const expectedDomain = actionDefinition.target_domain || 'none';
    const contextType = targetContext.type;

    // --- Logic moved from ActionValidationService Step 2 ---
    if (contextType !== 'none') {
      // Case 1: Action expects NO target, but context provides one.
      if (this.#noTargetDomains.includes(expectedDomain)) {
        this.#logger.debug(`Validation failed (Domain/Context): Action '${actionId}' (domain '${expectedDomain}') expects no target, but context type is '${contextType}'.`);
        return false;
      }
      // Case 2: Action expects a DIRECTION, but context is not 'direction'.
      if (this.#directionTargetDomains.includes(expectedDomain) && contextType !== 'direction') {
        this.#logger.debug(`Validation failed (Domain/Context): Action '${actionId}' (domain '${expectedDomain}') requires 'direction' context, but got '${contextType}'.`);
        return false;
      }
      // Case 3: Action expects an ENTITY, but context is not 'entity'.
      if (this.#entityTargetDomains.includes(expectedDomain) && contextType !== 'entity') {
        this.#logger.debug(`Validation failed (Domain/Context): Action '${actionId}' (domain '${expectedDomain}') requires 'entity' context, but got '${contextType}'.`);
        return false;
      }
      // Case 4: Special case for 'self' domain - target must be the actor.
      // Note: This check relies on the actor's ID being compared *outside* this checker,
      // as this checker doesn't know the actor. It only ensures the *type* is 'entity'.
      // The original Step 2 included an actor ID check which CANNOT be moved here without adding actorId as a parameter.
      // The original code had `targetContext.entityId !== actorId` check, which is context-dependent on the caller.
      // Let's refine this: The original check was "if expectedDomain is 'self' AND contextType is 'entity' AND targetContext.entityId !== actorId" -> fail.
      // This checker should ONLY check if domain 'self' is paired with context 'entity'. The ID comparison belongs in the calling service.
      // So, no special check needed here beyond the entityDomains check already performed.

      // Case 5: The 'self' domain check from the original code needs slight re-evaluation.
      // The original check: `if (expectedDomain === 'self' && contextType === 'entity' && targetContext.entityId !== actorId)`
      // This checker CANNOT know `actorId`. The responsibility of *this* checker is purely the compatibility
      // between the *domain type* ('self', 'inventory', 'direction', 'none') and the *context type* ('entity', 'direction', 'none').
      // The check that `targetContext.entityId` actually matches the `actorId` when `target_domain` is 'self'
      // *must* remain in the `ActionValidationService` or be moved to yet another checker, as it requires the `actorEntity`.
      // Therefore, the specific check `targetContext.entityId !== actorId` is *NOT* moved here.

    } else { // contextType is 'none'
      // Case 6: Context provides NO target, but action *requires* one (i.e., domain is not 'none').
      if (!this.#noTargetDomains.includes(expectedDomain)) {
        this.#logger.debug(`Validation failed (Domain/Context): Action '${actionId}' (domain '${expectedDomain}') requires a target, but context type is 'none'.`);
        return false;
      }
    }

    // If none of the incompatibility checks failed:
    this.#logger.debug(`Domain/Context Check Passed: Action '${actionId}' (domain '${expectedDomain}') is compatible with context type '${contextType}'.`);
    return true; // Compatible
  }
}