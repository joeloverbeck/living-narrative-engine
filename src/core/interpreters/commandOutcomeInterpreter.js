// src/core/interpreters/commandOutcomeInterpreter.js
// --- FILE START ---

/**
 * @fileoverview Implements the CommandOutcomeInterpreter class responsible for
 * translating CommandProcessor results into TurnDirectives and dispatching
 * relevant core events.
 */

// --- Interface/Type Imports for JSDoc ---
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/**
 * Represents an individual message within an action result.
 * @typedef {object} ActionResultMessage
 * @property {string} text - The message content.
 * @property {string} [type] - The type or category of the message (e.g., 'info', 'error').
 */
/**
 * Represents the result of processing a command.
 * Assumed properties based on PlayerTurnHandler usage and ticket context:
 * @typedef {object} CommandResult
 * @property {boolean} success - Whether the command action executed successfully.
 * @property {boolean} turnEnded - Whether the action taken signifies the end of the actor's turn.
 * @property {object} [actionResult] - Optional object containing results from the action itself.
 * @property {string} [actionResult.actionId] - The ID of the action that was executed.
 * @property {ActionResultMessage[]} [actionResult.messages] - Optional array of messages from the action.
 * @property {Error|string|null} [error] - Error object or message if success is false. Might be null or undefined.
 * @property {string} [message] - An optional user-facing message related to the outcome (often a summary).
 */
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';

/**
 * @class CommandOutcomeInterpreter
 * @description Interprets the result of a command, dispatches corresponding
 * core events (action executed/failed), and determines the next turn directive
 * (end turn successfully, end turn on failure, or re-prompt).
 */
class CommandOutcomeInterpreter {
    /** @private @readonly @type {ISafeEventDispatcher} */
    #dispatcher;
    /** @private @readonly @type {ILogger} */
    #logger;

    /**
     * Creates an instance of CommandOutcomeInterpreter.
     *
     * @param {object} dependencies - The required dependencies.
     * @param {ISafeEventDispatcher} dependencies.dispatcher - Safe dispatcher for emitting core events.
     * @param {ILogger} dependencies.logger - Logger instance for internal logging.
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({dispatcher, logger}) {
        if (!logger || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function' || typeof logger.info !== 'function') {
            // Cannot use logger here if it's invalid
            console.error('CommandOutcomeInterpreter Constructor: Invalid or missing logger dependency.');
            throw new Error('CommandOutcomeInterpreter: Invalid or missing ILogger dependency.');
        }
        this.#logger = logger;

        if (!dispatcher || typeof dispatcher.dispatchSafely !== 'function') {
            this.#logger.error('CommandOutcomeInterpreter Constructor: Invalid or missing ISafeEventDispatcher dependency (requires dispatchSafely).');
            throw new Error('CommandOutcomeInterpreter: Invalid or missing ISafeEventDispatcher dependency.');
        }
        this.#dispatcher = dispatcher;

        this.#logger.debug('CommandOutcomeInterpreter: Instance created successfully.');
    }

    /**
     * Interprets a CommandResult, dispatches a core event, and returns the appropriate TurnDirective.
     *
     * @async
     * @param {CommandResult} result - The result object from ICommandProcessor.processCommand.
     * @param {string} actorId - The unique ID of the entity whose command result is being interpreted.
     * @returns {Promise<string>} A promise resolving to a TurnDirective enum value (string).
     * @throws {Error} If actorId is invalid or result object is fundamentally malformed (missing success/turnEnded).
     */
    async interpret(result, actorId) {
        // --- Input Validation ---
        if (!actorId || typeof actorId !== 'string') {
            const errorMsg = `CommandOutcomeInterpreter: Invalid actorId provided (${actorId}).`;
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!result || typeof result.success !== 'boolean' || typeof result.turnEnded !== 'boolean') {
            const baseErrorMsg = `CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`;
            const fullErrorMsg = `${baseErrorMsg} Result: ${JSON.stringify(result)}`;
            this.#logger.error(fullErrorMsg);
            await this.#dispatcher.dispatchSafely('core:system_error_occurred', {
                message: baseErrorMsg,
                type: 'error',
                details: `Actor ${actorId}, Result: ${JSON.stringify(result)}`
            });
            throw new Error(baseErrorMsg);
        }

        this.#logger.debug(`CommandOutcomeInterpreter: Interpreting result for actor ${actorId}. Success=${result.success}, TurnEnded=${result.turnEnded}`);

        let eventName = '';
        let eventPayload = {};
        let directive = TurnDirective.RE_PROMPT;

        if (result.success) {
            eventName = 'core:action_executed';

            let finalActionId = "core:unknown_executed_action";
            if (result.actionResult && typeof result.actionResult.actionId === 'string' && result.actionResult.actionId.trim() !== '') {
                finalActionId = result.actionResult.actionId;
            } else if (result.actionResult && result.actionResult.actionId !== undefined && result.actionResult.actionId !== null) {
                this.#logger.warn(`CommandOutcomeInterpreter: actor ${actorId}: actionResult.actionId was present but not a valid non-empty string (${JSON.stringify(result.actionResult.actionId)}). Using default actionId '${finalActionId}'.`);
            } else {
                this.#logger.debug(`CommandOutcomeInterpreter: actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId '${finalActionId}'.`);
            }

            // --- FIX for core:action_executed payload.result validation ---
            const resultField = {
                success: true, // Per action-result.schema.json, this is required
                messages: []   // Per action-result.schema.json, this is optional (default: [])
            };

            // Populate messages according to action-result.schema.json
            // Prioritize messages from actionResult if they exist and are valid
            if (result.actionResult && Array.isArray(result.actionResult.messages)) {
                result.actionResult.messages.forEach(msg => {
                    if (msg && typeof msg.text === 'string') {
                        resultField.messages.push({
                            text: msg.text,
                            type: typeof msg.type === 'string' ? msg.type : 'info' // Ensure type, default if missing/invalid
                        });
                    } else {
                        this.#logger.warn(`CommandOutcomeInterpreter: actor ${actorId}: Invalid message structure in actionResult.messages. Message: ${JSON.stringify(msg)}`);
                    }
                });
            }
            // If no messages from actionResult, use the top-level result.message if available
            if (resultField.messages.length === 0 && result.message) {
                resultField.messages.push({text: String(result.message), type: 'info'});
            }
            // If still no messages and a default is desired (optional, as schema allows empty messages array):
            // if (resultField.messages.length === 0) {
            //     resultField.messages.push({ text: 'Action completed successfully.', type: 'info' });
            // }

            eventPayload = {
                actorId: actorId,
                actionId: finalActionId,
                result: resultField // This 'result' object must conform to action-result.schema.json
            };
            // --- END FIX ---

            if (result.turnEnded) {
                directive = TurnDirective.END_TURN_SUCCESS;
                this.#logger.info(`Actor ${actorId}: Success, turn ended.`);
            } else {
                directive = TurnDirective.RE_PROMPT;
                this.#logger.info(`Actor ${actorId}: Success, turn continues (re-prompt).`);
            }

        } else {
            // --- Failure Path (core:action_failed) ---
            eventName = 'core:action_failed';

            let derivedErrorMessage = 'Unknown action failure.';
            if (result.error instanceof Error) {
                derivedErrorMessage = result.error.message;
            } else if (result.message) {
                derivedErrorMessage = result.message;
            } else if (result.error) {
                derivedErrorMessage = String(result.error);
            }

            // The schema for core:action_failed#payload is not provided,
            // but we'll keep this structure consistent with previous versions.
            // It typically includes actorId, actionId (optional), errorMessage, and details.
            eventPayload = {
                actorId: actorId,
                actionId: result.actionResult?.actionId || "core:unknown_failed_action",
                errorMessage: derivedErrorMessage,
                // 'details' here for core:action_failed can hold the raw actionResult or error info.
                // This is distinct from the 'result' field of 'core:action_executed'.
                details: result.actionResult || {errorInfo: result.error},
            };

            if (result.turnEnded) {
                directive = TurnDirective.END_TURN_FAILURE;
                this.#logger.info(`Actor ${actorId}: Failure, turn ended.`);
            } else {
                directive = TurnDirective.RE_PROMPT;
                this.#logger.info(`Actor ${actorId}: Failure, turn continues (re-prompt).`);
            }
        }

        this.#logger.debug(`CommandOutcomeInterpreter: Dispatching event '${eventName}' for actor ${actorId}. Payload: ${JSON.stringify(eventPayload)}`);
        const dispatchSuccess = await this.#dispatcher.dispatchSafely(eventName, eventPayload);

        if (!dispatchSuccess) {
            this.#logger.warn(`CommandOutcomeInterpreter: SafeEventDispatcher reported failure dispatching '${eventName}' for actor ${actorId}. Downstream handlers may not have received the event, but proceeding with directive '${directive}'.`);
        }

        this.#logger.debug(`CommandOutcomeInterpreter: Returning directive '${directive}' for actor ${actorId}.`);
        return directive;
    }
}

export default CommandOutcomeInterpreter;
// --- FILE END ---