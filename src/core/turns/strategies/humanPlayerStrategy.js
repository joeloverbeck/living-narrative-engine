// src/core/turns/strategies/humanPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy_Interface */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import {IActorTurnStrategy} from '../interfaces/IActorTurnStrategy.js'; // Corrected path

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
        // No specific dependencies to inject via constructor;
        // relies on services obtained from ITurnContext.
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
        // Phase 1: Get essential services. Logger is first.
        // Errors from _getLoggerFromContext will propagate directly.
        const logger = this._getLoggerFromContext(context);

        try {
            // Phase 2: Get other services and actor, using the obtained logger.
            const actor = this._getActorFromContext(context, logger);
            const playerPromptService = this._getPlayerPromptServiceFromContext(context, logger);

            logger.debug(`HumanPlayerStrategy: Initiating decideAction for actor ${actor.id}.`);

            // Phase 3: Main input loop and ITurnAction construction
            let commandString = null;
            let promptMessage = `${actor.name || 'Player'}, your command?`;

            // Loop until a non-empty command string is received
            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    logger.debug(`HumanPlayerStrategy: Prompting actor ${actor.id} with message: "${promptMessage}"`);
                    commandString = await playerPromptService.prompt(actor, promptMessage);

                } catch (error) {
                    // Corrected log message to match test expectation
                    logger.error(`HumanPlayerStrategy: Error receiving input via playerPromptService for actor ${actor.id}: ${error.message}`, error);
                    // Error message of re-thrown error was already adjusted to match test
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

            // Phase 4: Formulate the ITurnAction
            /** @type {ITurnAction} */
            const turnAction = {
                commandString: commandString,
                actionDefinitionId: "unknown:playerInput",
                resolvedParameters: {}
            };

            logger.debug(`HumanPlayerStrategy: Resolving with ITurnAction for actor ${actor.id}:`, {turnActionDetails: turnAction});
            return turnAction;

        } catch (error) {
            const actorIdForLog = context?.getActor?.()?.id || 'unknown_actor_in_decideAction_catch';
            // Outer catch logs only the message string.
            logger.error(`HumanPlayerStrategy.decideAction: Error during turn decision for actor ${actorIdForLog}. Message: ${error.message}`);
            throw error;
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
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (typeof context.getLogger !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: context.getLogger is not a function.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        let loggerInstance;
        try {
            loggerInstance = context.getLogger();
        } catch (e) {
            const errorMsg = `HumanPlayerStrategy Critical: context.getLogger() failed. Details: ${e.message}`;
            console.error(`HumanPlayerStrategy Critical: context.getLogger() threw an error during retrieval: ${e.message}`);
            throw new Error(errorMsg);
        }

        if (!loggerInstance || typeof loggerInstance.info !== 'function' || typeof loggerInstance.error !== 'function' || typeof loggerInstance.debug !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.';
            console.error('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing info/error methods).');
            throw new Error(errorMsg);
        }
        return loggerInstance;
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
        if (!context || typeof context.getActor !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: ITurnContext is invalid or context.getActor is not a function (called from _getActorFromContext).';
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

        if (!actor || typeof actor.id === 'undefined') {
            logger.error('HumanPlayerStrategy: Actor not found in ITurnContext (null or undefined).');
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
        if (!context || typeof context.getPlayerPromptService !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: ITurnContext is invalid or context.getPlayerPromptService is not a function (called from _getPlayerPromptServiceFromContext).';
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
            logger.error('HumanPlayerStrategy: PlayerPromptService not available or invalid (e.g., missing prompt method) in ITurnContext.');
            throw new Error('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');
        }
        return service;
    }
}

// --- FILE END ---