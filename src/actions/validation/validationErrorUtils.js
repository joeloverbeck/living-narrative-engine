/**
 * @module validationErrorUtils
 * @description Helper utilities for formatting action validation errors.
 */

/**
 * Formats an Error thrown by validateActionInputs for a consistent message.
 *
 * @param {Error} err - The original error.
 * @param {string} source - Label for the calling function.
 * @param {{actionId?: string, actorId?: string}} ids
 * Identifier info used in the message. The `contextType` property is no longer used.
 * @returns {Error} A new Error instance with the formatted message.
 */
import { InvalidActionDefinitionError } from '../../errors/invalidActionDefinitionError.js';
import { InvalidActorEntityError } from '../../errors/invalidActorEntityError.js';

export function formatValidationError(err, source, ids) {
  let idInfo = '';
  if (err instanceof InvalidActionDefinitionError) {
    idInfo = `(id: ${ids.actionId})`;
  } else if (err instanceof InvalidActorEntityError) {
    idInfo = `(id: ${ids.actorId})`;
  }
  // Branch for 'Invalid ActionTargetContext' removed as it's no longer thrown.

  const msg = err.message
    ? err.message.charAt(0).toLowerCase() + err.message.slice(1)
    : 'invalid input';
  return new Error(`${source}: ${msg} ${idInfo}`.trim());
}

export default formatValidationError;
