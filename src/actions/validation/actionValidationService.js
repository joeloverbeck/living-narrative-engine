/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../validation/domainContextCompatibilityChecker.js').DomainContextCompatibilityChecker} DomainContextCompatibilityChecker */
/** @typedef {import('../actionTypes.js').ActionAttemptPseudoEvent} ActionAttemptPseudoEvent */
/** @typedef {import('./prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */

/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
import { PrerequisiteEvaluationService } from './prerequisiteEvaluationService.js';
import { BaseService } from '../../utils/serviceBase.js';
import { validateActionInputs } from './inputValidators.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../constants/targetDomains.js';
import { ENTITY as TARGET_TYPE_ENTITY } from '../../constants/actionTargetTypes.js';
// --- Refactor-AVS-3.4: Remove dependency ---
// REMOVED: import { ActionValidationContextBuilder } from './actionValidationContextBuilder.js';
// --- End Refactor-AVS-3.4 ---

/**
 * @class ActionValidationService
 * @augments BaseService
 * @description Validates whether actions can be executed by entities given the
 * current game context and prerequisite rules.
 */
export class ActionValidationService extends BaseService {
  /** @type {EntityManager} */ #entityManager;
  /** @type {ILogger} */ #logger;
  /** @type {DomainContextCompatibilityChecker} */ #domainContextCompatibilityChecker;
  /** @type {PrerequisiteEvaluationService} */ #prerequisiteEvaluationService;
  // --- Refactor-AVS-3.4: Remove dependency ---
  // REMOVED: /** @type {ActionValidationContextBuilder} */ #actionValidationContextBuilder; // AC2: Field removed
  // --- End Refactor-AVS-3.4 ---

  /**
   * Creates an instance of ActionValidationService.
   * Responsible for validating if an action can be performed by an actor
   * on a given target, checking domain compatibility and prerequisites.
   * Relies on PrerequisiteEvaluationService to handle prerequisite rule evaluation
   * (including the necessary context building).
   *
   * @param {{
   * entityManager: EntityManager,
   * logger: ILogger,
   * domainContextCompatibilityChecker: DomainContextCompatibilityChecker,
   * prerequisiteEvaluationService: PrerequisiteEvaluationService
   * }} deps - The required service dependencies.
   * // ActionValidationContextBuilder dependency removed in previous refactor
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({
    entityManager,
    logger,
    domainContextCompatibilityChecker,
    prerequisiteEvaluationService,
    // --- Refactor-AVS-3.4: Remove dependency ---
    // REMOVED: actionValidationContextBuilder, // AC1: Dependency removed from constructor destructuring
    // --- End Refactor-AVS-3.4 ---
  }) {
    super();
    this.#logger = this._init('ActionValidationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
      domainContextCompatibilityChecker: {
        value: domainContextCompatibilityChecker,
        requiredMethods: ['check'],
      },
      prerequisiteEvaluationService: {
        value: prerequisiteEvaluationService,
        requiredMethods: ['evaluate'],
      },
    });

    if (
      prerequisiteEvaluationService &&
      typeof prerequisiteEvaluationService.evaluate === 'function' &&
      prerequisiteEvaluationService.evaluate.length !== 4
    ) {
      const errorMsg =
        "ActionValidationService Constructor: PrerequisiteEvaluationService 'evaluate' method must have 4 arguments.";
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.#entityManager = entityManager;
    // this.#logger is already set
    this.#domainContextCompatibilityChecker = domainContextCompatibilityChecker;
    this.#prerequisiteEvaluationService = prerequisiteEvaluationService;
    // --- Refactor-AVS-3.4: Remove dependency ---
    // REMOVED: this.#actionValidationContextBuilder = actionValidationContextBuilder; // AC2: Field assignment removed
    // --- End Refactor-AVS-3.4 ---

    // Log message updated to reflect removed dependency implicitly
    this.#logger.debug(
      'ActionValidationService initialised (dependencies: EM, Logger, DCCC, PES).'
    );
  }

  // Method _buildEvaluationContextIfNeeded is confirmed to be absent (AC2)

  /**
   * Performs initial structural sanity checks on the inputs for isValid.
   * Throws an error if inputs are fundamentally invalid (e.g., missing required IDs, wrong context type).
   * Corresponds to "Step 0" in the validation process.
   *
   * @private
   * @param {ActionDefinition} actionDefinition - The definition of the action.
   * @param {Entity} actorEntity - The entity attempting the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @throws {Error} If any input is structurally invalid according to basic requirements.
   */
  _checkStructuralSanity(actionDefinition, actorEntity, targetContext) {
    try {
      validateActionInputs(
        actionDefinition,
        actorEntity,
        targetContext,
        this.#logger
      );
    } catch (err) {
      let idInfo = '';
      if (err.message === 'Invalid actionDefinition') {
        idInfo = `(id: ${actionDefinition?.id})`;
      } else if (err.message === 'Invalid actor entity') {
        idInfo = `(id: ${actorEntity?.id})`;
      } else if (err.message === 'Invalid ActionTargetContext') {
        idInfo = `(type: ${targetContext?.type})`;
      }
      const msg = err.message
        ? err.message.charAt(0).toLowerCase() + err.message.slice(1)
        : 'invalid input';
      throw new Error(`ActionValidationService.isValid: ${msg} ${idInfo}`);
    }
  }

  /**
   * Checks if the action's domain requirements are compatible with the target context.
   * Includes calling the domainContextCompatibilityChecker and checking for 'self' target mismatches.
   * Corresponds to "Step 1" in the validation process.
   *
   * @private
   * @param {ActionDefinition} actionDefinition - The definition of the action.
   * @param {Entity} actorEntity - The entity attempting the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @returns {boolean} True if compatible, false otherwise.
   */
  _validateDomainAndContext(actionDefinition, actorEntity, targetContext) {
    const actionId = actionDefinition.id;
    const actorId = actorEntity.id;
    const expectedDomain = actionDefinition.target_domain || TARGET_DOMAIN_NONE;

    const isCompatible = this.#domainContextCompatibilityChecker.check(
      actionDefinition,
      targetContext
    );

    // If the checker says it's not compatible, it fails, period.
    // The obsolete "deferred" logic has been removed.
    if (!isCompatible) {
      this.#logger.debug(
        `Validation[${actionId}]: ← STEP 1 FAILED (domain/context compatibility checker returned false).`
      );
      return false;
    }

    // Specific check for 'self' domain which requires the target ID to match the actor ID.
    if (
      expectedDomain === TARGET_DOMAIN_SELF &&
      targetContext.type === TARGET_TYPE_ENTITY &&
      targetContext.entityId !== actorId
    ) {
      this.#logger.debug(
        `Validation[${actionId}]: ← STEP 1 FAILED ('${TARGET_DOMAIN_SELF}' target mismatch). Target entity '${targetContext.entityId}' !== Actor '${actorId}'.`
      );
      return false;
    }

    this.#logger.debug(
      `Validation[${actionId}]: → STEP 1 PASSED (Domain/Context Compatible).`
    );
    return true;
  }

  /**
   * Checks if a target entity specified in the context exists in the EntityManager and logs a warning if not.
   * This check is primarily informational for prerequisite evaluation and doesn't directly fail validation.
   * Part of Step 2 in the validation process.
   *
   * @private
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @param {string} actionId - The ID of the action being validated (for logging).
   * @returns {void}
   */
  warnIfTargetMissing(targetContext, actionId) {
    // Refactor-AVS-4.1 Decision: Keep EntityManager dependency for warnIfTargetMissing.
    // Reason: This check provides an early warning if a target entity ID resolved for validation
    // does not correspond to an active entity instance in the EntityManager.
    // While the PrerequisiteEvaluation flow (via ActionValidationContextBuilder) already handles
    // non-existent target entities gracefully by providing a null `target.entity` in the evaluation context,
    // this check remains as a low-cost, non-blocking informational step during validation.
    // Removing it would eliminate the EM dependency from AVS but shift the warning log later in the process.
    // Moving it (e.g., to TargetResolutionService or ActionExecutor) would require adding the EM
    // dependency there or increasing orchestration complexity.
    // Keeping it here is deemed the most pragmatic approach for now, accepting the minimal
    // dependency overhead for the benefit of the early warning log message.
    if (targetContext.type === TARGET_TYPE_ENTITY) {
      const targetEntity = this.#entityManager.getEntityInstance(
        targetContext.entityId
      );
      if (!targetEntity) {
        this.#logger.warn(
          `Validation Check [${actionId}]: Target entity '${targetContext.entityId}' not found during validation. Prerequisite evaluation might depend on this entity existing.`
        );
      }
    }
    this.#logger.debug(
      `Validation[${actionId}]: → STEP 2 PASSED (Entity Existence Checked).`
    );
  }

  /**
   * Collects and validates the format of the prerequisites array from an action definition.
   * Logs a warning if the 'prerequisites' property exists but is not a valid array.
   * Corresponds to Step 3 in the validation process.
   *
   * @private
   * @param {ActionDefinition} actionDefinition - The definition of the action.
   * @returns {object[]} The prerequisites array (empty if none defined or if format is invalid).
   */
  _collectAndValidatePrerequisites(actionDefinition) {
    const actionId = actionDefinition.id;
    let prerequisites = [];

    if (Array.isArray(actionDefinition.prerequisites)) {
      prerequisites = actionDefinition.prerequisites;
    } else if (
      'prerequisites' in actionDefinition &&
      actionDefinition.prerequisites !== undefined &&
      actionDefinition.prerequisites !== null
    ) {
      this.#logger.warn(
        `Action '${actionId}' has a 'prerequisites' property, but it's not an array (type: ${typeof actionDefinition.prerequisites}). Skipping prerequisite check. Treating as empty.`
      );
    }
    return prerequisites;
  }

  /**
   * Extracts prerequisite processing into a single step.
   * Collects prerequisites and delegates evaluation to PrerequisiteEvaluationService.
   * Logs progress for Steps 3 and 4.
   *
   * @private
   * @param {ActionDefinition} actionDefinition - The definition of the action.
   * @param {Entity} actorEntity - The entity attempting the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @returns {boolean} True if prerequisites pass or there are none.
   */
  _validatePrerequisites(actionDefinition, actorEntity, targetContext) {
    const actionId = actionDefinition.id;
    const prerequisites =
      this._collectAndValidatePrerequisites(actionDefinition);
    this.#logger.debug(
      `Validation[${actionId}]: → STEP 3 PASSED (Prerequisites Collected: ${prerequisites.length}).`
    );

    if (prerequisites.length > 0) {
      this.#logger.debug(
        `Validation[${actionId}]: Delegating prerequisite evaluation (including context building) to PrerequisiteEvaluationService...`
      );
      const passed = this.#prerequisiteEvaluationService.evaluate(
        prerequisites,
        actionDefinition,
        actorEntity,
        targetContext
      );
      if (!passed) {
        this.#logger.debug(
          `END Validation: FAILED (Prerequisite Not Met or Error during evaluation) for action '${actionId}'.`
        );
        return false;
      }
      this.#logger.debug(
        `Validation[${actionId}]: → STEP 4 PASSED (Prerequisite evaluation successful or skipped).`
      );
      return true;
    }

    this.#logger.debug(
      `Validation[${actionId}]: → STEP 4 SKIPPED (No prerequisites to evaluate).`
    );
    this.#logger.debug(
      `Validation[${actionId}]: → STEP 4 PASSED (Prerequisite evaluation successful or skipped).`
    );
    return true;
  }

  /**
   * Validates if an action can be performed by an actor on a target context.
   * Acts as an orchestrator, calling helper methods for each validation step.
   *
   * Validation Steps:
   * 0. Structural Sanity Check: Basic validation of inputs.
   * 1. Domain & Context Compatibility: Check if action target type matches context.
   * 2. Verify Target Entity Existence: Log warning if target entity ID provided but not found.
   * 3. Collect Prerequisites: Get prerequisites array from action definition.
   * 4. Evaluate Prerequisites: If prerequisites exist, delegate to PrerequisiteEvaluationService.
   * (Note: Context building for evaluation now happens *inside* PES).
   *
   * @param {ActionDefinition} actionDefinition - The definition of the action.
   * @param {Entity} actorEntity - The entity attempting the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @returns {boolean} True if the action is valid, false otherwise.
   * @throws {Error} If input parameters fail structural sanity checks (_checkStructuralSanity).
   */
  isValid(actionDefinition, actorEntity, targetContext) {
    // Step 0: Structural Sanity Check
    try {
      this._checkStructuralSanity(actionDefinition, actorEntity, targetContext);
    } catch (err) {
      this.#logger.error(`Validation: STRUCTURAL ERROR: ${err.message}`, {
        actionId: actionDefinition?.id ?? 'unknown',
        actorId: actorEntity?.id ?? 'unknown',
        targetContextType: targetContext?.type ?? 'unknown',
      });
      this.#logger.debug(
        'END Validation: FAILED (Structural Sanity - Throwing)'
      );
      throw err;
    }

    const actionId = actionDefinition.id;
    const actorId = actorEntity.id;

    this.#logger.debug(
      `START Validation: action='${actionId}', actor='${actorId}', ctxType='${targetContext.type}', target='${targetContext.entityId ?? TARGET_DOMAIN_NONE}'`
    );

    try {
      // Step 1: Domain & Context Compatibility Check
      if (
        !this._validateDomainAndContext(
          actionDefinition,
          actorEntity,
          targetContext
        )
      ) {
        this.#logger.debug(
          `END Validation: FAILED (Domain/Context) for action '${actionId}'.`
        );
        return false;
      }

      // Step 2: Verify Target Entity Existence
      this.warnIfTargetMissing(targetContext, actionId);

      // Steps 3 & 4: Process prerequisites
      const prerequisitesPassed = this._validatePrerequisites(
        actionDefinition,
        actorEntity,
        targetContext
      );
      if (!prerequisitesPassed) {
        return false;
      }

      // All Steps Passed
      this.#logger.debug(`END Validation: PASSED for action '${actionId}'.`);
      return true;
    } catch (err) {
      // Catch unexpected errors during the validation flow (excluding structural sanity handled above)
      this.#logger.error(
        `Validation[${actionId}]: UNEXPECTED ERROR during validation process for actor '${actorId}': ${err.message}`,
        { error: err, stack: err.stack }
      );
      this.#logger.debug(
        `END Validation: FAILED (Unexpected Error) for action '${actionId}'.`
      );
      return false; // Treat unexpected errors as validation failure
    }
  }
}
