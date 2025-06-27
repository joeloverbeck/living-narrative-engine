// src/actions/validation/actionValidationContextBuilder.js

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
// ActionTargetContext import removed.
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

import { BaseService } from '../../utils/serviceBase.js';
import { buildActorContext } from './contextBuilders.js';
import { validateActionInputs } from './inputValidators.js';
import { formatValidationError } from './validationErrorUtils.js';

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
   * @returns {JsonLogicEvaluationContext} The constructed context object.
   * @throws {Error} If `actionDefinition` or `actor` are invalid.
   */
  buildContext(actionDefinition, actor) {
    // --- 1. Initial Argument Validation ---
    this.#assertValidInputs(actionDefinition, actor);

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
   * @throws {Error} If any parameter is missing required data.
   * @private
   */
  #assertValidInputs(actionDefinition, actor) {
    try {
      validateActionInputs(actionDefinition, actor, this.#logger);
    } catch (err) {
      throw formatValidationError(
        err,
        'ActionValidationContextBuilder.buildContext',
        {
          actionId: actionDefinition?.id,
          actorId: actor?.id,
        }
      );
    }
  }

  // #buildEntityTargetContextForEval method has been removed as target context is no
  // longer needed in prerequisites; target filtering is handled by the Scope DSL.
}
