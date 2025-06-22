// src/actions/validation/actionValidationContextBuilder.js
// --- FILE START ---

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

// --- FIX: Import necessary functions and constants ---

import { setupService } from '../../utils/serviceInitializerUtils.js';
import {
  buildActorContext,
  buildDirectionContext,
  buildEntityTargetContext,
} from './contextBuilders.js';
/**
 * @class ActionValidationContextBuilder
 * @description Service dedicated to constructing the data context object used
 * for evaluating JsonLogic rules within the action validation process.
 */
export class ActionValidationContextBuilder {
  #entityManager;
  #logger;

  /**
   * Creates an instance of ActionValidationContextBuilder.
   *
   * @param {{entityManager: EntityManager, logger: ILogger}} deps - The required services.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({ entityManager, logger }) {
    this.#logger = setupService('ActionValidationContextBuilder', logger, {
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
   * This implementation now uses a dynamic component accessor for actor and target
   * entities, aligning with the pattern in `createJsonLogicContext`.
   *
   * @param {ActionDefinition} actionDefinition - The definition of the action being attempted.
   * @param {Entity} actor - The entity performing the action.
   * @param {ActionTargetContext} targetContext - The context of the action's target.
   * @returns {JsonLogicEvaluationContext} The constructed context object.
   * @throws {Error} If `actionDefinition`, `actor`, or `targetContext` are invalid.
   */
  buildContext(actionDefinition, actor, targetContext) {
    // --- 1. Initial Argument Validation (with added logging to match tests) ---
    if (!actionDefinition?.id) {
      this.#logger.error(
        'ActionValidationContextBuilder: Invalid actionDefinition provided (missing id).',
        { actionDefinition }
      );
      throw new Error(
        'ActionValidationContextBuilder requires a valid ActionDefinition.'
      );
    }
    if (!actor?.id) {
      this.#logger.error(
        'ActionValidationContextBuilder: Invalid actor entity provided (missing id).',
        { actor }
      );
      throw new Error(
        'ActionValidationContextBuilder requires a valid actor Entity.'
      );
    }
    if (!targetContext?.type) {
      this.#logger.error(
        'ActionValidationContextBuilder: Invalid targetContext provided (missing type).',
        { targetContext }
      );
      throw new Error(
        'ActionValidationContextBuilder requires a valid ActionTargetContext.'
      );
    }

    this.#logger.debug(
      `ActionValidationContextBuilder: Building context for action '${actionDefinition.id}', actor '${actor.id}', target type '${targetContext.type}'.`
    );

    // --- 2. Build Actor Context ---
    const actorContext = buildActorContext(
      actor.id,
      this.#entityManager,
      this.#logger
    );

    // --- 3. Build Target Context (handles different target types) ---
    let targetContextForEval = null;

    if (targetContext.type === 'entity') {
      targetContextForEval = this.#buildEntityTargetContextForEval(
        actionDefinition,
        targetContext
      );
    } else if (targetContext.type === 'direction') {
      targetContextForEval = this.#buildDirectionTargetContextForEval(
        actor.id,
        targetContext
      );
    }

    // --- 4. Assemble Final Context ---
    const finalContext = {
      actor: actorContext,
      target: targetContextForEval,
      action: {
        id: actionDefinition.id,
      },
      // Add other top-level keys for consistency
      event: null, // No event is being processed here
      context: {},
      globals: {},
      entities: {},
    };

    return finalContext;
  }

  /**
   * Creates the evaluation target context when the target type is 'entity'.
   *
   * @param {ActionDefinition} actionDefinition - Definition of the attempted action.
   * @param {ActionTargetContext} targetContext - Target context information.
   * @returns {object|null} The constructed target context or null if entity not found.
   * @private
   */
  #buildEntityTargetContextForEval(actionDefinition, targetContext) {
    if (!targetContext.entityId) return null;

    const targetEntityInstance = this.#entityManager.getEntityInstance(
      targetContext.entityId
    );
    if (targetEntityInstance) {
      return buildEntityTargetContext(
        targetContext.entityId,
        this.#entityManager,
        this.#logger
      );
    }

    this.#logger.warn(
      `ActionValidationContextBuilder: Target entity '${targetContext.entityId}' not found for action '${actionDefinition.id}'. Context will have null target entity data.`
    );
    return null;
  }

  /**
   * Creates the evaluation target context when the target type is 'direction'.
   *
   * @param {string} actorId - ID of the acting entity.
   * @param {ActionTargetContext} targetContext - Target context information.
   * @returns {object} The constructed target context for the direction.
   * @private
   */
  #buildDirectionTargetContextForEval(actorId, targetContext) {
    return buildDirectionContext(
      actorId,
      targetContext.direction,
      this.#entityManager,
      this.#logger
    );
  }
}

// --- FILE END ---
