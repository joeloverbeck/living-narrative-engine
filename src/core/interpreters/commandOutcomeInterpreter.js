// src/core/interpreters/commandOutcomeInterpreter.js
// ****** MODIFIED FILE ******

/**
 * @fileoverview Implements the CommandOutcomeInterpreter class responsible for
 * translating CommandProcessor results into TurnDirectives and dispatching
 * relevant core events.
 */

// --- Interface/Type Imports for JSDoc ---
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreterType */
/** @typedef {import('../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */ // <<< ADDED IMPORT
/** @typedef {import('../../entities/entity.js').default} Entity */


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
import TurnDirective from '../turns/constants/turnDirectives.js';
// --- Interface Imports ---
import {ICommandOutcomeInterpreter} from '../interfaces/ICommandOutcomeInterpreter.js';

/**
 * @class CommandOutcomeInterpreter
 * @extends {ICommandOutcomeInterpreter}
 * @implements {ICommandOutcomeInterpreterType}
 * @description Interprets the result of a command, dispatches corresponding
 * core events (action executed/failed), and determines the next turn directive
 * (end turn successfully, end turn on failure, or re-prompt).
 */
class CommandOutcomeInterpreter extends ICommandOutcomeInterpreter {
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
        super(); // Call the constructor of ICommandOutcomeInterpreter

        if (!logger || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function' || typeof logger.info !== 'function') {
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
     * @param {ITurnContext} turnContext - The context of the current turn.
     * @returns {Promise<string>} A promise resolving to a TurnDirective enum value (string).
     * @throws {Error} If turnContext is invalid, actor cannot be retrieved, or result object is fundamentally malformed.
     */
    async interpret(result, turnContext) {
        // --- Input Validation ---
        if (!turnContext || typeof turnContext.getActor !== 'function') {
            const errorMsg = `CommandOutcomeInterpreter: Invalid turnContext provided.`;
            this.#logger.error(errorMsg);
            // Attempt to dispatch a system error even with faulty context if possible
            await this.#dispatcher.dispatchSafely('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
                message: 'Invalid turn context received by CommandOutcomeInterpreter.',
                type: 'error',
                details: 'turnContext was null or not a valid ITurnContext object.'
            });
            throw new Error(errorMsg);
        }

        const actor = /** @type {Entity | null} */ (turnContext.getActor());
        if (!actor || !actor.id) {
            const errorMsg = `CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.`;
            this.#logger.error(errorMsg, {actor});
            await this.#dispatcher.dispatchSafely('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
                message: 'Invalid actor in turn context for CommandOutcomeInterpreter.',
                type: 'error',
                details: `Actor object was ${JSON.stringify(actor)}.`
            });
            throw new Error(errorMsg);
        }
        const actorId = actor.id;

        if (!result || typeof result.success !== 'boolean' || typeof result.turnEnded !== 'boolean') {
            const baseErrorMsg = `CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`;
            const fullErrorMsg = `${baseErrorMsg} Result: ${JSON.stringify(result)}`;
            this.#logger.error(fullErrorMsg);
            await this.#dispatcher.dispatchSafely('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
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

            const resultField = {
                success: true,
                messages: []
            };

            if (result.actionResult && Array.isArray(result.actionResult.messages)) {
                result.actionResult.messages.forEach(msg => {
                    if (msg && typeof msg.text === 'string') {
                        resultField.messages.push({
                            text: msg.text,
                            type: typeof msg.type === 'string' ? msg.type : 'info'
                        });
                    } else {
                        this.#logger.warn(`CommandOutcomeInterpreter: actor ${actorId}: Invalid message structure in actionResult.messages. Message: ${JSON.stringify(msg)}`);
                    }
                });
            }
            if (resultField.messages.length === 0 && result.message) {
                resultField.messages.push({text: String(result.message), type: 'info'});
            }

            eventPayload = {
                actorId: actorId,
                actionId: finalActionId,
                result: resultField
            };

            if (result.turnEnded) {
                directive = TurnDirective.END_TURN_SUCCESS;
                this.#logger.info(`Actor ${actorId}: Success, turn ended.`);
            } else {
                directive = TurnDirective.RE_PROMPT;
                this.#logger.info(`Actor ${actorId}: Success, turn continues (re-prompt).`);
            }

        } else {
            eventName = 'core:action_failed';
            let derivedErrorMessage = 'Unknown action failure.';
            if (result.error instanceof Error) {
                derivedErrorMessage = result.error.message;
            } else if (result.message) {
                derivedErrorMessage = result.message;
            } else if (result.error) {
                derivedErrorMessage = String(result.error);
            }

            eventPayload = {
                actorId: actorId,
                actionId: result.actionResult?.actionId || "core:unknown_failed_action",
                errorMessage: derivedErrorMessage,
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