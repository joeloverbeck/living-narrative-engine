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
 * Represents the result of processing a command.
 * Assumed properties based on PlayerTurnHandler usage and ticket context:
 * @typedef {object} CommandResult
 * @property {boolean} success - Whether the command action executed successfully.
 * @property {boolean} turnEnded - Whether the action taken signifies the end of the actor's turn.
 * @property {object} [actionResult] - Optional object containing results from the action itself (e.g., action ID, specific outcomes). Might be null or undefined.
 * @property {Error|string|null} [error] - Error object or message if success is false. Might be null or undefined.
 * @property {string} [message] - An optional user-facing message related to the outcome.
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
    constructor({ dispatcher, logger }) {
        if (!logger || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function') {
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
        // --- *** CORRECTION 1: Make error message more predictable *** ---
        if (!result || typeof result.success !== 'boolean' || typeof result.turnEnded !== 'boolean') {
            const baseErrorMsg = `CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`;
            const fullErrorMsg = `${baseErrorMsg} Result: ${JSON.stringify(result)}`;
            this.#logger.error(fullErrorMsg);
            // Dispatch system error *if possible* before throwing
            await this.#dispatcher.dispatchSafely('core:system_error_occurred', {
                message: baseErrorMsg, // Use the base message for the event
                type: 'error',
                details: `Actor ${actorId}, Result: ${JSON.stringify(result)}`
            });
            // Throw the error with the *base* message for easier testing
            throw new Error(baseErrorMsg);
        }
        // --- *** END CORRECTION 1 *** ---

        this.#logger.debug(`CommandOutcomeInterpreter: Interpreting result for actor ${actorId}. Success=${result.success}, TurnEnded=${result.turnEnded}`);

        // --- Determine Event and Payload ---
        let eventName = '';
        let eventPayload = {};
        let directive = TurnDirective.RE_PROMPT; // Default assumption

        if (result.success) {
            // --- Success Path ---
            eventName = 'core:action_executed';
            eventPayload = {
                actorId: actorId,
                actionId: result.actionResult?.actionId || null,
                outcome: result.message || 'Action completed successfully.',
                details: result.actionResult || {},
            };

            if (result.turnEnded) {
                directive = TurnDirective.END_TURN_SUCCESS;
                this.#logger.debug(`Actor ${actorId}: Success, turn ended.`);
            } else {
                directive = TurnDirective.RE_PROMPT;
                this.#logger.debug(`Actor ${actorId}: Success, turn continues (re-prompt).`);
            }

        } else {
            // --- Failure Path ---
            eventName = 'core:action_failed';

            // --- *** CORRECTION 2: Prioritize error sources for errorMessage *** ---
            let derivedErrorMessage = 'Unknown action failure.'; // Default
            if (result.error instanceof Error) {
                derivedErrorMessage = result.error.message;
            } else if (result.message) { // Prioritize message if error is not an Error object
                derivedErrorMessage = result.message;
            } else if (result.error) { // Use error string as fallback if message is missing
                derivedErrorMessage = String(result.error);
            }
            // --- *** END CORRECTION 2 *** ---

            eventPayload = {
                actorId: actorId,
                errorMessage: derivedErrorMessage,
                details: result.error, // Still include raw error for details
            };

            if (result.turnEnded) {
                directive = TurnDirective.END_TURN_FAILURE;
                this.#logger.debug(`Actor ${actorId}: Failure, turn ended.`);
            } else {
                directive = TurnDirective.RE_PROMPT;
                this.#logger.debug(`Actor ${actorId}: Failure, turn continues (re-prompt).`);
            }
        }

        // --- Dispatch Event Safely ---
        this.#logger.debug(`CommandOutcomeInterpreter: Dispatching event '${eventName}' for actor ${actorId}.`);
        const dispatchSuccess = await this.#dispatcher.dispatchSafely(eventName, eventPayload);

        if (!dispatchSuccess) {
            this.#logger.warn(`CommandOutcomeInterpreter: SafeEventDispatcher reported failure dispatching '${eventName}' for actor ${actorId}. Downstream handlers may not have received the event, but proceeding with directive '${directive}'.`);
        }

        // --- Return Directive ---
        this.#logger.debug(`CommandOutcomeInterpreter: Returning directive '${directive}' for actor ${actorId}.`);
        return directive;
    }
}

export default CommandOutcomeInterpreter;
// --- FILE END ---