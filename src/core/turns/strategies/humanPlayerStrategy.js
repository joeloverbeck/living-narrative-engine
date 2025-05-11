// src/core/turns/strategies/humanPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy_Interface */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import {IActorTurnStrategy} from '../interfaces/IActorTurnStrategy.js';

/**
 * @class HumanPlayerStrategy
 * @implements {IActorTurnStrategy_Interface}
 * @description Implements the IActorTurnStrategy for human-controlled players.
 * It handles prompting the player for input, re-prompting on empty input,
 * and returning the raw command string packaged within an ITurnAction object.
 */
export class HumanPlayerStrategy extends IActorTurnStrategy {
    /**
     * Creates an instance of HumanPlayerStrategy.
     */
    constructor() {
        super();
    }

    /**
     * Determines the action a human player will take for the current turn.
     * It prompts the player for a command string via the PlayerPromptService
     * obtained from the ITurnContext. If the input is empty or consists only
     * of whitespace, it re-prompts the player until a valid command is received.
     * The method then constructs and resolves with an ITurnAction object containing
     * the raw command string, a generic actionDefinitionId, and the raw command
     * in resolvedParameters.
     *
     * @async
     * @param {ITurnContext} context - The turn context for the current turn, providing
     * access to the actor, logger, player prompt service, etc.
     * @returns {Promise<ITurnAction>} A Promise that resolves to an ITurnAction object
     * representing the player's chosen command.
     * @throws {Error} If essential services (like PlayerPromptService, Logger, or Actor)
     * cannot be retrieved from the context, or if the `playerPromptService.prompt()`
     * method itself throws an unrecoverable error. Such errors are logged and then
     * re-thrown to be handled by the calling turn state (e.g., AwaitingPlayerInputState).
     */
    async decideAction(context) {
        const logger = this._getLoggerFromContext(context);

        try {
            const actor = this._getActorFromContext(context, logger);
            const playerPromptService = this._getPlayerPromptServiceFromContext(context, logger);

            logger.debug(`HumanPlayerStrategy: Initiating decideAction for actor ${actor.id}.`);

            let commandString = null;
            let promptMessage = `${actor.name || 'Player'}, your command?`;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    logger.debug(`HumanPlayerStrategy: Prompting actor ${actor.id} with message: "${promptMessage}"`);
                    commandString = await playerPromptService.prompt(actor, promptMessage);

                } catch (error) {
                    // Log message updated for clarity and to match test expectations more closely if needed.
                    const specificErrorMessage = `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${actor.id}: ${error.message}`;
                    logger.error(specificErrorMessage, error);
                    throw new Error(`Failed to get player input for actor ${actor.id}. Details: ${error.message}`);
                }

                const trimmedCommand = commandString ? commandString.trim() : "";

                if (trimmedCommand !== "") {
                    logger.info(`HumanPlayerStrategy: Received command "${trimmedCommand}" from actor ${actor.id}.`);
                    commandString = trimmedCommand;
                    break;
                } else {
                    logger.debug(`HumanPlayerStrategy: Empty command received from actor ${actor.id}. Re-prompting.`);
                    promptMessage = `${actor.name || 'Player'}, please enter a command. (Previous was empty)`;
                }
            }

            /** @type {ITurnAction} */
            const turnAction = {
                commandString: commandString,
                // Corrected actionDefinitionId and resolvedParameters as per ticket PTH-REFACTOR-003.5.3
                actionDefinitionId: "player:commandInput",
                resolvedParameters: {rawCommand: commandString}
            };

            logger.debug(`HumanPlayerStrategy: Resolving with ITurnAction for actor ${actor.id}:`, {turnActionDetails: turnAction});
            return turnAction;

        } catch (error) {
            // This outer catch is for unexpected errors during the process AFTER logger is obtained.
            // It will catch errors re-thrown by helpers or new errors within this try block.
            let actorIdForLog = 'unknown_actor';
            try {
                // Attempt to get actor ID safely for logging, but don't let this fail the error reporting
                if (context && typeof context.getActor === 'function') {
                    const actor = context.getActor();
                    if (actor && actor.id) {
                        actorIdForLog = actor.id;
                    }
                }
            } catch (e) {
                // Ignore errors from trying to get actor ID for logging
            }

            // Check if the error was already logged with its stack by a helper.
            // The logger.error in helper methods already includes the error object (stack).
            // So, here, we might only need to log a more general message if the error
            // originated directly within this try block and wasn't from a helper.
            // However, to be safe and catch all, we log the error message.
            // The nature of the error (e.g. critical, already logged in detail) will determine verbosity.
            logger.error(`HumanPlayerStrategy.decideAction: Unhandled error during turn decision for actor ${actorIdForLog}. Message: ${error.message}`, error);
            throw error; // Re-throw the original error
        }
    }

    /**
     * Helper to safely get the logger from the context.
     * @param {ITurnContext} context - The ITurnContext instance.
     * @returns {ILogger} A valid logger instance.
     * @throws {Error} If context is invalid, or logger cannot be retrieved, or the retrieved logger is invalid.
     * @private
     */
    _getLoggerFromContext(context) {
        if (!context) {
            const errorMsg = 'HumanPlayerStrategy Critical: ITurnContext is null or undefined.';
            console.error(errorMsg); // Logs to console if logger cannot be obtained
            throw new Error(errorMsg);
        }
        if (typeof context.getLogger !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: context.getLogger is not a function.';
            console.error(errorMsg); // Logs to console
            throw new Error(errorMsg);
        }

        let loggerInstance;
        try {
            loggerInstance = context.getLogger();
        } catch (e) {
            const errorMsg = `HumanPlayerStrategy Critical: context.getLogger() failed. Details: ${e.message}`;
            // Log the specific error that occurred during getLogger()
            console.error(`HumanPlayerStrategy Critical: context.getLogger() threw an error during retrieval: ${e.message}`);
            throw new Error(errorMsg);
        }

        // Updated check and console log message for incomplete logger
        if (!loggerInstance ||
            typeof loggerInstance.info !== 'function' ||
            typeof loggerInstance.error !== 'function' ||
            typeof loggerInstance.debug !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.';
            // Log to console because the logger itself is faulty.
            console.error('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing required methods like info, error, debug).');
            throw new Error(errorMsg);
        }
        return loggerInstance.createChildLogger('HumanPlayerStrategy'); // Create a child logger
    }

    /**
     * Helper to safely get the actor from the context, using a provided logger.
     * @param {ITurnContext} context - The ITurnContext instance.
     * @param {ILogger} logger - A valid logger instance for reporting issues.
     * @returns {Entity} A valid actor entity.
     * @throws {Error} If actor cannot be retrieved from context or is invalid.
     * @private
     */
    _getActorFromContext(context, logger) {
        // Ensure context itself is not null, though _getLoggerFromContext usually catches this.
        if (!context) { // Should have been caught by _getLoggerFromContext, but as a safeguard:
            const errorMsg = 'HumanPlayerStrategy Critical: ITurnContext is null (unexpectedly, in _getActorFromContext).';
            logger.error(errorMsg); // Assumes logger is valid if we reached here.
            throw new Error(errorMsg);
        }
        if (typeof context.getActor !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: context.getActor is not a function.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        let actor = null;
        try {
            actor = context.getActor();
        } catch (e) {
            const errorMsg = `HumanPlayerStrategy Critical: Failed to call context.getActor(). Details: ${e.message}`;
            logger.error(`HumanPlayerStrategy: Error calling context.getActor(): ${e.message}`, e);
            throw new Error(errorMsg);
        }

        if (!actor || typeof actor.id === 'undefined') { // Check for actor and actor.id
            // Corrected log message to be more specific as per failing test's potential expectation
            logger.error('HumanPlayerStrategy: Actor not found in ITurnContext (context.getActor() returned null/undefined or invalid actor).');
            throw new Error('HumanPlayerStrategy Critical: Actor not available from ITurnContext.');
        }
        return actor;
    }

    /**
     * Helper to safely get the player prompt service from the context, using a provided logger.
     * @param {ITurnContext} context - The ITurnContext instance.
     * @param {ILogger} logger - A valid logger instance for reporting issues.
     * @returns {IPlayerPromptService} A valid player prompt service instance.
     * @throws {Error} If the service cannot be retrieved from context or is invalid.
     * @private
     */
    _getPlayerPromptServiceFromContext(context, logger) {
        if (!context) { // Safeguard
            const errorMsg = 'HumanPlayerStrategy Critical: ITurnContext is null (unexpectedly, in _getPlayerPromptServiceFromContext).';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (typeof context.getPlayerPromptService !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        let service = null;
        try {
            service = context.getPlayerPromptService();
        } catch (e) {
            const errorMsg = `HumanPlayerStrategy Critical: Failed to call context.getPlayerPromptService(). Details: ${e.message}`;
            logger.error(`HumanPlayerStrategy: Error calling context.getPlayerPromptService(): ${e.message}`, e);
            throw new Error(errorMsg);
        }

        if (!service || typeof service.prompt !== 'function') {
            // Corrected log message
            logger.error('HumanPlayerStrategy: PlayerPromptService not found in ITurnContext or is invalid (e.g., missing prompt method).');
            throw new Error('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');
        }
        return service;
    }
}

// --- FILE END ---