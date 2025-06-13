// src/types/commandResult.js

/**
 * @typedef {object} CommandResult
 * @description The structure returned by the processCommand method.
 * @property {boolean} success - True if ATTEMPT_ACTION_ID was dispatched successfully. False for pipeline errors.
 * @property {boolean} turnEnded - For successes, this will be false (rules dictate turn end).
 * For failures within CommandProcessor, this will now be true.
 * @property {string} [originalInput] - The original trimmed command string.
 * @property {object} [actionResult] - Additional results, primarily the specific actionId.
 * @property {string} [actionResult.actionId] - The canonical actionId that was processed.
 * @property {string} [error] - User-facing error message for failures.
 * @property {string} [internalError] - Internal error message for logging.
 * @property {Array<{text: string, type?: string}>} [actionResult.messages] - Messages from the action.
 * @property {string} [message] - General message from CommandProcessor.
 */
