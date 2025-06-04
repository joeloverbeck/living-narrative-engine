// src/services/actionValidationContextBuilder.js
// --- FILE START ---

/* type-only imports */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

// --- BEGIN FIX ---
// Import constants for component IDs
import {
  EXITS_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../constants/componentIds.js'; // Adjust path if necessary
// --- END FIX ---

/**
 * @class ActionValidationContextBuilder
 * @description Service dedicated to constructing the data context object used
 * for evaluating JsonLogic rules within the action validation process.
 * It fetches relevant data about the actor, target (entity or direction),
 * and action, assembling it into a structured object for the rules engine.
 * Separates context creation logic from the main validation service.
 */
export class ActionValidationContextBuilder {
     * @private
  #entityManager;
     * @private
  #logger;

  /**
   * Creates an instance of ActionValidationContextBuilder.
   * @param {{entityManager: EntityManager, logger: ILogger}} deps - The required services.
   * @throws {Error} If dependencies are missing or invalid (e.g., missing required methods).
   */
  constructor({ entityManager, logger }) {
    if (
      !entityManager?.getEntityInstance ||
      typeof entityManager.getComponentData !== 'function'
    ) {
      // Added check for getComponentData
      throw new Error(
        'ActionValidationContextBuilder requires a valid EntityManager with getEntityInstance and getComponentData methods.'
      );
    }
    if (!logger?.debug || !logger?.error || !logger.warn) {
      throw new Error(
        'ActionValidationContextBuilder requires a valid ILogger instance.'
      );
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Builds the evaluation context object for a given action attempt.
   * This context provides data accessible to JsonLogic rules during validation.
   * It fetches component data for the actor and, if the target is an entity,
   * attempts to fetch the target entity's component data using the EntityManager.
   * For direction targets, it resolves exit details including the blocker.
   * Logs a warning if a target entity is specified but not found, or if exit details cannot be resolved.
   * @param {ActionDefinition} actionDefinition - The definition of the action being attempted. Must have a valid `id` property.
   * @param {Entity} actor - The entity performing the action. Must have a valid `id` property.
   * @param {ActionTargetContext} targetContext - The context of the action's target (entity, direction, or none). Must have a valid `type` property.
   * @returns {JsonLogicEvaluationContext} The constructed context object.
   * @throws {Error} If `actionDefinition`, `actor`, or `targetContext` are invalid.
   */
  buildContext(actionDefinition, actor, targetContext) {
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

    let targetEntityData = null;
    if (targetContext.type === 'entity' && targetContext.entityId) {
      const targetEntityInstance = this.#entityManager.getEntityInstance(
        targetContext.entityId
      );
      if (targetEntityInstance) {
        targetEntityData =
          typeof targetEntityInstance.getAllComponentsData === 'function'
            ? targetEntityInstance.getAllComponentsData()
            : { id: targetEntityInstance.id };
      } else {
        this.#logger.warn(
          `ActionValidationContextBuilder: Target entity '${targetContext.entityId}' not found for action '${actionDefinition.id}'. Context will have null target entity data.`
        );
      }
    }

    // --- BEGIN FIX for direction target context ---
    let targetBlockerValue = undefined; // Undefined if not applicable or not found
    let targetExitDetailsValue = null; // Null if not applicable or not found

    if (targetContext.type === 'direction' && targetContext.direction) {
      // Attempt to get actor's current location from its POSITION_COMPONENT_ID
      // Using entityManager.getComponentData for robustness, as actor.getAllComponentsData() might not be consistently implemented or available.
      const actorPositionData = this.#entityManager.getComponentData(
        actor.id,
        POSITION_COMPONENT_ID
      );
      const actorLocationId = actorPositionData?.locationId;

      if (actorLocationId && typeof actorLocationId === 'string') {
        this.#logger.debug(
          `ActionValidationContextBuilder: Actor '${actor.id}' is at location '${actorLocationId}'. Fetching exits for direction '${targetContext.direction}'.`
        );
        const exitsData = this.#entityManager.getComponentData(
          actorLocationId,
          EXITS_COMPONENT_ID
        );

        if (Array.isArray(exitsData)) {
          const matchedExit = exitsData.find(
            (exit) => exit && exit.direction === targetContext.direction
          );
          if (matchedExit) {
            this.#logger.debug(
              `ActionValidationContextBuilder: Found matching exit for direction '${targetContext.direction}':`,
              matchedExit
            );
            targetExitDetailsValue = matchedExit; // Store the entire exit object
            targetBlockerValue = matchedExit.blocker; // Will be the blocker's ID (string), null, or undefined if property absent
          } else {
            this.#logger.warn(
              `ActionValidationContextBuilder: Direction '${targetContext.direction}' not found in ${EXITS_COMPONENT_ID} data for location '${actorLocationId}'.`
            );
          }
        } else {
          this.#logger.warn(
            `ActionValidationContextBuilder: No valid ${EXITS_COMPONENT_ID} data (or not an array) found for location '${actorLocationId}'.`
          );
        }
      } else {
        this.#logger.warn(
          `ActionValidationContextBuilder: Could not determine actor's current location (actor ID: '${actor.id}') to fetch exits for direction '${targetContext.direction}'. Missing or invalid ${POSITION_COMPONENT_ID} component data.`
        );
      }
    }
    // --- END FIX for direction target context ---

    const context /*: JsonLogicEvaluationContext */ = {
      actor: {
        id: actor.id,
        components:
          typeof actor.getAllComponentsData === 'function'
            ? actor.getAllComponentsData()
            : {},
      },
      target: {
        type: targetContext.type,
        id: targetContext.entityId,
        direction: targetContext.direction,
        entity: targetEntityData,
        // --- BEGIN FIX: Add resolved direction properties ---
        blocker: targetBlockerValue, // Populated for direction targets
        exitDetails: targetExitDetailsValue, // The full exit object for direction targets
        // --- END FIX ---
      },
      action: {
        id: actionDefinition.id,
      },
    };

    return context;
  }
}

// --- FILE END ---
