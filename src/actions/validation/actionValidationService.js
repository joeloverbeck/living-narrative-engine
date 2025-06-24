/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../validation/domainContextCompatibilityChecker.js').DomainContextCompatibilityChecker} DomainContextCompatibilityChecker */
/** @typedef {import('../actionTypes.js').ActionAttemptPseudoEvent} ActionAttemptPseudoEvent */
/** @typedef {import('./prerequisiteEvaluationService.js').PrerequisiteEvaluationService} PrerequisiteEvaluationService */

/** @typedef {import('../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
import { BaseService } from '../../utils/serviceBase.js';
import { validateActionInputs } from './inputValidators.js';
import { formatValidationError } from './validationErrorUtils.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../constants/targetDomains.js';
import { ENTITY as TARGET_TYPE_ENTITY } from '../../constants/actionTargetTypes.js';
import { DomainContextIncompatibilityError } from '../../errors/domainContextIncompatibilityError.js';

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

  /**
   * Creates an instance of ActionValidationService.
   *
   * @param {{
   * entityManager: EntityManager,
   * logger: ILogger,
   * domainContextCompatibilityChecker: DomainContextCompatibilityChecker,
   * prerequisiteEvaluationService: PrerequisiteEvaluationService
   * }} deps - The required service dependencies.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({
    entityManager,
    logger,
    domainContextCompatibilityChecker,
    prerequisiteEvaluationService,
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
    this.#domainContextCompatibilityChecker = domainContextCompatibilityChecker;
    this.#prerequisiteEvaluationService = prerequisiteEvaluationService;

    this.#logger.debug(
      'ActionValidationService initialised (dependencies: EM, Logger, DCCC, PES).'
    );
  }

  /**
   * Performs initial structural sanity checks on the inputs for isValid.
   *
   * @private
   * @param {ActionDefinition} actionDefinition
   * @param {Entity} actorEntity
   * @param {ActionTargetContext} targetContext
   * @throws {Error}
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
      throw formatValidationError(err, 'ActionValidationService.isValid', {
        actionId: actionDefinition?.id,
        actorId: actorEntity?.id,
        contextType: targetContext?.type,
      });
    }
  }

  /**
   * Checks if the action's scope requirement is compatible with the target context.
   * Throws DomainContextIncompatibilityError on failure. Returns void on success.
   * Corresponds to "Step 1" in the validation process.
   *
   * @private
   * @param {ActionDefinition} actionDefinition - The definition of the action.
   * @param {Entity} actorEntity - The entity attempting the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @throws {DomainContextIncompatibilityError} If the context is not compatible with the action's scope.
   */
  _validateDomainAndContext(actionDefinition, actorEntity, targetContext) {
    const actionId = actionDefinition.id;
    const actorId = actorEntity.id;
    // `scope` is now the sole determinant of targetability.
    const expectedScope = actionDefinition.scope || TARGET_DOMAIN_NONE;

    const isCompatible = this.#domainContextCompatibilityChecker.check(
      actionDefinition,
      targetContext
    );

    if (!isCompatible) {
      this.#logger.debug(
        `Validation[${actionId}]: ← STEP 1 FAILED (scope/context compatibility checker returned false).`
      );

      const expectsTarget = expectedScope !== TARGET_DOMAIN_NONE;
      const contextHasTarget = targetContext.type === 'entity';
      let message;

      if (expectsTarget && !contextHasTarget) {
        message = `Action '${actionId}' (scope '${expectedScope}') requires an entity target, but context type is '${targetContext.type}'.`;
      } else if (!expectsTarget && contextHasTarget) {
        message = `Action '${actionId}' (scope '${expectedScope}') expects no target, but context type is '${targetContext.type}'.`;
      } else {
        message = `Action '${actionId}' failed a scope/context compatibility check for an unknown reason.`;
      }

      throw new DomainContextIncompatibilityError(message, {
        actionId: actionId,
        actionName: actionDefinition.name,
        actorId: actorId,
        targetId: targetContext.entityId,
        expectedScope: expectedScope,
        contextType: targetContext.type,
      });
    }

    if (
      expectedScope === TARGET_DOMAIN_SELF &&
      targetContext.type === TARGET_TYPE_ENTITY &&
      targetContext.entityId !== actorId
    ) {
      this.#logger.debug(
        `Validation[${actionId}]: ← STEP 1 FAILED ('${TARGET_DOMAIN_SELF}' target mismatch). Target entity '${targetContext.entityId}' !== Actor '${actorId}'.`
      );
      throw new DomainContextIncompatibilityError(
        `Action '${actionId}' requires a 'self' target, but target was '${targetContext.entityId}'.`,
        {
          actionId: actionId,
          actionName: actionDefinition.name,
          actorId: actorId,
          targetId: targetContext.entityId,
          expectedScope: expectedScope,
          contextType: targetContext.type,
        }
      );
    }

    this.#logger.debug(
      `Validation[${actionId}]: → STEP 1 PASSED (Scope/Context Compatible).`
    );
  }

  /**
   * Checks if a target entity specified in the context exists.
   *
   * @private
   * @param {ActionTargetContext} targetContext
   * @param {string} actionId
   * @returns {void}
   */
  #warnIfTargetMissing(targetContext, actionId) {
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
   *
   * @private
   * @param {ActionDefinition} actionDefinition
   * @returns {object[]}
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
   *
   * @private
   * @param {ActionDefinition} actionDefinition
   * @param {Entity} actorEntity
   * @param {ActionTargetContext} targetContext
   * @returns {boolean}
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
   *
   * @param {ActionDefinition} actionDefinition
   * @param {Entity} actorEntity
   * @param {ActionTargetContext} targetContext
   * @returns {boolean}
   * @throws {Error}
   * @throws {DomainContextIncompatibilityError}
   */
  isValid(actionDefinition, actorEntity, targetContext) {
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
      this._validateDomainAndContext(
        actionDefinition,
        actorEntity,
        targetContext
      );

      this.#warnIfTargetMissing(targetContext, actionId);

      const prerequisitesPassed = this._validatePrerequisites(
        actionDefinition,
        actorEntity,
        targetContext
      );
      if (!prerequisitesPassed) {
        return false;
      }

      this.#logger.debug(`END Validation: PASSED for action '${actionId}'.`);
      return true;
    } catch (err) {
      if (err instanceof DomainContextIncompatibilityError) {
        throw err;
      }

      this.#logger.error(
        `Validation[${actionId}]: UNEXPECTED ERROR during validation process for actor '${actorId}': ${err.message}`,
        { error: err, stack: err.stack }
      );
      this.#logger.debug(
        `END Validation: FAILED (Unexpected Error) for action '${actionId}'.`
      );
      return false;
    }
  }
}
