// src/logic/createActionValidationContext.js

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
// +++ TICKET 6: Import ActionDefinition and ActionAttemptPseudoEvent types +++
/** @typedef {import('../../data/schemas/action-definition.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../actions/actionTypes.js').ActionAttemptPseudoEvent} ActionAttemptPseudoEvent */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

import {createComponentAccessor} from './contextAssembler.js';

/**
 * Builds the JsonLogic-friendly context object used by the action-validation engine.
 * Includes actor, target, and a representation of the action attempt itself under the 'event' key.
 *
 * @param {ActionDefinition} actionDefinition - The definition of the action being attempted. // <<< TICKET 6: Added parameter
 * @param {Entity} actorEntity - The entity attempting the action.
 * @param {ActionTargetContext} targetContext - The context of the action's target.
 * @param {EntityManager} entityManager - The manager for entity instances.
 * @param {ILogger} logger - The logging service.
 * @returns {JsonLogicEvaluationContext} The context object for JsonLogic evaluation.
 * @throws {Error} If required parameters are invalid.
 */
export function createActionValidationContext(
  actionDefinition, // <<< TICKET 6: Added parameter
  actorEntity,
  targetContext,
  entityManager,
  logger
) {
  /*──────────────────────
     * 1. Parameter guards
     *──────────────────────*/
  // +++ TICKET 6: Add guard for actionDefinition +++
  if (!actionDefinition?.id?.trim()) {
    throw new Error('createActionValidationContext: invalid actionDefinition');
  }
  // +++ END TICKET 6 +++
  if (!actorEntity?.id?.trim() || typeof actorEntity.hasComponent !== 'function') {
    throw new Error('createActionValidationContext: invalid actorEntity');
  }
  if (!targetContext?.type) {
    throw new Error('createActionValidationContext: invalid targetContext');
  }
  if (typeof entityManager?.getEntityInstance !== 'function') {
    throw new Error('createActionValidationContext: invalid entityManager');
  }
  const {debug, warn, error} = logger ?? {};
  if (typeof debug !== 'function' ||
        typeof warn !== 'function' ||
        typeof error !== 'function') {
    throw new Error('createActionValidationContext: invalid logger');
  }

  debug(`Creating ActionValidationContext (action='${actionDefinition.id}' actor='${actorEntity.id}', ctxType='${targetContext.type}').`);

  /*──────────────────────
     * 2. Actor accessor
     *──────────────────────*/
  let actorAccessor;
  try {
    actorAccessor = createComponentAccessor(actorEntity.id, entityManager, logger);
  } catch (err) {
    error(`Error creating component accessor for actor ID [${actorEntity.id}]`, err);
    throw err;
  }

  // +++ TICKET 6: Create the Action Attempt Pseudo Event +++
  /** @type {ActionAttemptPseudoEvent} */
  const actionAttemptEvent = {
    eventType: 'core:attempt_action',
    actionId: actionDefinition.id,
    actorId: actorEntity.id,
    targetContext: targetContext, // Include the target context directly
    actionDefinition: actionDefinition // Include the full definition
  };
    // +++ END TICKET 6 +++

  /** @type {JsonLogicEvaluationContext} */
  const ctx = {
    actor: {id: actorEntity.id, components: actorAccessor},
    target: null, // Will be populated below if applicable
    // +++ TICKET 6: Assign the pseudo-event to the context +++
    event: actionAttemptEvent,
    // +++ END TICKET 6 +++
    context: {}, // Keep for potential future use (e.g., world state)
    globals: {}, // Keep for potential future use (e.g., game settings)
    entities: {}, // Keep for potential future use (e.g., entity lookups)
  };

  /*──────────────────────
     * 3. Target processing
     *──────────────────────*/
  if (targetContext.type === 'entity' &&
        typeof targetContext.entityId === 'string' &&
        targetContext.entityId.trim()) {

    const targetId = targetContext.entityId;
    let targetEntity;
    try {
      targetEntity = entityManager.getEntityInstance(targetId);
    } catch (err) {
      error(`Error looking up target entity ID [${targetId}]`, err);
      // Don't throw here, allow prerequisites to check for non-existent target
      targetEntity = null;
    }

    if (targetEntity) {
      try {
        const targetAccessor = createComponentAccessor(targetEntity.id, entityManager, logger);
        // Assign to the main context's target property
        ctx.target = {id: targetEntity.id, components: targetAccessor};
      } catch (err) {
        error(`Error creating component accessor for target ID [${targetId}]`, err);
        ctx.target = {id: targetId, components: null}; // Indicate target exists but accessor failed
      }
    } else {
      // Target entity not found, ensure target is explicitly null or represents this state
      ctx.target = {id: targetId, components: null}; // Represent a non-found entity target
      debug(`Target entity [${targetId}] not found or failed to load. ctx.target set accordingly.`);
    }
  } else if (targetContext.type === 'direction') {
    // Represent direction target if needed by JsonLogic rules
    ctx.target = {id: null, direction: targetContext.direction, components: null};
    debug(`Target is a direction: '${targetContext.direction}'. ctx.target set accordingly.`);
  } else {
    // type is 'none' or unhandled entity case
    ctx.target = null; // Explicitly null for 'none' target type
    debug(`Target type is '${targetContext.type}'. ctx.target set to null.`);
  }

  /*──────────────────────
     * 4. Done
     *──────────────────────*/
  debug('ActionValidationContext assembled.', ctx); // Log the assembled context for debugging
  return ctx;
}