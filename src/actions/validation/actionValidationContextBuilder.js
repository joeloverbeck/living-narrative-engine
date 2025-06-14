// src/actions/validation/actionValidationContextBuilder.js
// --- FILE START ---

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

// --- FIX: Import necessary functions and constants ---

import { validateDependency } from '../../utils/validationUtils.js';
import { createPrefixedLogger } from '../../utils/loggerUtils.js';
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
    // (Constructor remains the same)
    try {
      validateDependency(
        logger,
        'ActionValidationContextBuilder: logger',
        console,
        {
          requiredMethods: ['debug', 'error', 'warn'],
        }
      );
      this.#logger = createPrefixedLogger(
        logger,
        'ActionValidationContextBuilder: '
      );
    } catch (e) {
      const errorMsg = `ActionValidationContextBuilder Constructor: CRITICAL - Invalid or missing ILogger instance. Error: ${e.message}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      validateDependency(
        entityManager,
        'ActionValidationContextBuilder: entityManager',
        this.#logger,
        { requiredMethods: ['getEntityInstance', 'getComponentData'] }
      );
      this.#entityManager = entityManager;
    } catch (e) {
      this.#logger.error(
        `ActionValidationContextBuilder Constructor: Dependency validation failed for entityManager. Error: ${e.message}`
      );
      throw e;
    }
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

    if (targetContext.type === 'entity' && targetContext.entityId) {
      const targetEntityInstance = this.#entityManager.getEntityInstance(
        targetContext.entityId
      );
      if (targetEntityInstance) {
        targetContextForEval = buildEntityTargetContext(
          targetContext.entityId,
          this.#entityManager,
          this.#logger
        );
      } else {
        this.#logger.warn(
          `ActionValidationContextBuilder: Target entity '${targetContext.entityId}' not found for action '${actionDefinition.id}'. Context will have null target entity data.`
        );
      }
    } else if (targetContext.type === 'direction') {
      targetContextForEval = buildDirectionContext(
        actor.id,
        targetContext.direction,
        this.#entityManager,
        this.#logger
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
}

// --- FILE END ---
