/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

import { BaseService } from '../../utils/serviceBase.js';
import {
  buildActorContext,
  // buildEntityTargetContext - removed as target context no longer needed
} from './contextBuilders.js';
import { validateActionInputs } from './inputValidators.js';
import { formatValidationError } from './validationErrorUtils.js';
// import { ENTITY as TARGET_TYPE_ENTITY } from '../../constants/actionTargetTypes.js';
// Removed - no longer needed as target context is not built for prerequisites

/**
 * @class ActionValidationContextBuilder
 * @augments BaseService
 * @description Service dedicated to constructing the data context object used
 * for evaluating JsonLogic rules within the action validation process.
 */
export class ActionValidationContextBuilder extends BaseService {
  #entityManager;
  #logger;

  /**
   * Creates an instance of ActionValidationContextBuilder.
   *
   * @param {{entityManager: EntityManager, logger: ILogger}} deps - The required services.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({ entityManager, logger }) {
    super();
    this.#logger = this._init('ActionValidationContextBuilder', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance', 'getComponentData'],
      },
    });

    this.#entityManager = entityManager;
  }

  /**
   * Builds the evaluation context object for a given action attempt.
   * This context provides data accessible to JsonLogic rules during validation.
   *
   * Note: Target context has been removed as target filtering is now handled
   * by the Scope DSL system. Prerequisites should only check actor conditions.
   *
   * @param {ActionDefinition} actionDefinition - The definition of the action being attempted.
   * @param {Entity} actor - The entity performing the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target (unused in context building).
   * @returns {JsonLogicEvaluationContext} The constructed context object.
   * @throws {Error} If `actionDefinition`, `actor`, or `targetContext` are invalid.
   */
  buildContext(actionDefinition, actor, targetContext) {
    // --- 1. Initial Argument Validation (with added logging to match tests) ---
    this.#assertValidInputs(actionDefinition, actor, targetContext);

    this.#logger.debug(
      `ActionValidationContextBuilder: Building context for action '${actionDefinition.id}', actor '${actor.id}'. Only actor context is included as target filtering is handled by Scope DSL.`
    );

    // --- 2. Build Actor Context ---
    const actorContext = buildActorContext(
      actor.id,
      this.#entityManager,
      this.#logger
    );

    // --- 3. Assemble Final Context (Simplified - only actor needed for prerequisites) ---
    const finalContext = {
      actor: actorContext,
    };

    return finalContext;
  }

  /**
   * Validates the required inputs for {@link buildContext}.
   *
   * @param {ActionDefinition} actionDefinition - The attempted action's definition.
   * @param {Entity} actor - The entity performing the action.
   * @param {ActionTargetContext} targetContext - Information about the action's target.
   * @throws {Error} If any parameter is missing required data.
   * @private
   */
  #assertValidInputs(actionDefinition, actor, targetContext) {
    try {
      validateActionInputs(
        actionDefinition,
        actor,
        targetContext,
        this.#logger
      );
    } catch (err) {
      throw formatValidationError(
        err,
        'ActionValidationContextBuilder.buildContext',
        {
          actionId: actionDefinition?.id,
          actorId: actor?.id,
          contextType: targetContext?.type,
        }
      );
    }
  }

  // #buildEntityTargetContextForEval method removed - target context no longer
  // needed in prerequisites as target filtering is handled by Scope DSL
}
