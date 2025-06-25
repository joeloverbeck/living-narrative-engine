// src/actions/validation/inputValidators.js

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
// ActionTargetContext import removed as it's no longer validated here.

// ActionTargetContext model import removed.

/**
 * Validate the core inputs for prerequisite evaluation.
 * Ensures an action definition and an actor entity are structurally sound.
 * Any failures will be logged and an Error will be thrown.
 *
 * @param {ActionDefinition} actionDefinition - Definition describing the attempted action.
 * @param {Entity} actorEntity - The entity attempting the action.
 * @param {ILogger} logger - Logger used for reporting validation issues.
 * @throws {Error} If any input is missing required properties or has the wrong type.
 * @returns {void}
 */
export function validateActionInputs(
  actionDefinition,
  actorEntity,
  logger
) {
  if (!actionDefinition?.id?.trim()) {
    logger.error('Invalid actionDefinition provided (missing id).', {
      actionDefinition,
    });
    throw new Error('Invalid actionDefinition');
  }

  if (!actorEntity?.id?.trim()) {
    logger.error('Invalid actor entity provided (missing id).', {
      actor: actorEntity,
    });
    throw new Error('Invalid actor entity');
  }

  // Validation for targetCtx has been removed, as prerequisites are now actor-only.
}