// src/utils/timeoutUtils.js

/**
 * @file Utility helpers for timeout-related error handling.
 */

/**
 * Builds a standardized timeout error message and Error object.
 *
 * @description
 * When an expected external event does not occur within the allotted time,
 * this helper can be used to create a descriptive error.
 * @param {string} actorId - ID of the actor awaiting the event.
 * @param {string} actionId - The action definition id.
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @returns {{message: string, error: Error}} Object containing the error message
 * and Error instance with `code` set to `TURN_END_TIMEOUT`.
 */
export function createTimeoutError(actorId, actionId, timeoutMs) {
  const message = `No rule ended the turn for actor ${actorId} after action '${actionId}'. The engine timed out after ${timeoutMs} ms.`;
  const error = /** @type {Error & { code: string }} */ (new Error(message));
  error.code = 'TURN_END_TIMEOUT';
  return { message, error };
}
