// src/actions/validation/inputValidators.js

/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */

/**
 * Validates that the action definition and actor are properly formed.
 *
 * @param {ActionDefinition} actionDefinition - The action definition to validate.
 * @param {Entity} actor - The actor entity to validate.
 * @param {ILogger} logger - Logger for debug output.
 * @throws {Error} If validation fails.
 */
export function validateActionInputs(actionDefinition, actor, logger) {
  if (!actionDefinition || typeof actionDefinition !== 'object') {
    throw new Error('Action definition must be a valid object');
  }

  if (!actionDefinition.id || typeof actionDefinition.id !== 'string') {
    throw new Error('Action definition must have a valid id property');
  }

  if (!actor || typeof actor !== 'object') {
    throw new Error('Actor must be a valid object');
  }

  if (!actor.id || typeof actor.id !== 'string') {
    throw new Error('Actor must have a valid id property');
  }

  logger.debug(
    `Validated inputs - Action: ${actionDefinition.id}, Actor: ${actor.id}`
  );
}

