/* type-only imports */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition */
/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */

import { ActionTargetContext } from '../../models/actionTargetContext.js';

/**
 * @description Validate the core inputs required when processing an action.
 * Ensures an action definition, actor entity, and target context are structurally sound.
 * Any failures will be logged and an Error will be thrown.
 * @param {ActionDefinition} actionDef - Definition describing the attempted action.
 * @param {Entity} actor - The entity attempting the action.
 * @param {ActionTargetContext} targetCtx - Context of the action's target.
 * @param {ILogger} logger - Logger used for reporting validation issues.
 * @throws {Error} If any input is missing required properties or has the wrong type.
 * @returns {void}
 */
export function validateActionInputs(
  actionDefinition,
  actorEntity,
  targetCtx,
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

  if (!(targetCtx instanceof ActionTargetContext)) {
    logger.error(
      'Invalid targetContext provided (expected ActionTargetContext).',
      {
        targetContext: targetCtx,
      }
    );
    throw new Error('Invalid ActionTargetContext');
  }
}
