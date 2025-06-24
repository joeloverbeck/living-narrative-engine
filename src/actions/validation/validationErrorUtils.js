/**
 * @module validationErrorUtils
 * @description Helper utilities for formatting action validation errors.
 */

/**
 * Formats an Error thrown by validateActionInputs for a consistent message.
 *
 * @param {Error} err - The original error.
 * @param {string} source - Label for the calling function.
 * @param {{actionId?: string, actorId?: string, contextType?: string}} ids
 *  Identifier info used in the message.
 * @returns {Error} A new Error instance with the formatted message.
 */
export function formatValidationError(err, source, ids) {
  let idInfo = '';
  if (err.message === 'Invalid actionDefinition') {
    idInfo = `(id: ${ids.actionId})`;
  } else if (err.message === 'Invalid actor entity') {
    idInfo = `(id: ${ids.actorId})`;
  } else if (err.message === 'Invalid ActionTargetContext') {
    idInfo = `(type: ${ids.contextType})`;
  }
  const msg = err.message
    ? err.message.charAt(0).toLowerCase() + err.message.slice(1)
    : 'invalid input';
  return new Error(`${source}: ${msg} ${idInfo}`.trim());
}

export default formatValidationError;
