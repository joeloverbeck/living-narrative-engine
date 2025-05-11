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
 * and returning the raw command string as part of an ITurnAction.
 */
export class HumanPlayerStrategy extends IActorTurnStrategy {
    /**
     * Creates an instance of HumanPlayerStrategy.
     */
    constructor() {
        super();
        // No specific dependencies for now, relies on services from ITurnContext.
    }

    /**
     * Determines the action a human player will take for the current turn.
     * It prompts the player for a command string, re-prompts if the input is empty,
     * and then resolves with an ITurnAction containing the raw command string.
     *
     * @async
     * @param {ITurnContext} context - The turn context for the current turn.
     * @returns {Promise<ITurnAction>} A Promise that resolves to an ITurnAction object.
     * @throws {Error} If essential services (like PlayerPromptService or Logger) are missing from the context,
     * or if the actor cannot be retrieved, or if player input fails.
     */
    async decideAction(context) {
        // Phase 1: Get essential services. Logger is first.
        // Errors from _getLoggerFromContext will propagate directly, as it's a bootstrap phase.
        const logger = this._getLoggerFromContext(context);

        try {
            // Phase 2: Get other services and actor, using the obtained logger for error reporting within these helpers.
            const actor = this._getActorFromContext(context, logger);
            const playerPromptService = this._getPlayerPromptServiceFromContext(context, logger);

            // Phase 3: Main logic
            let commandString = null;
            let promptMessage = `${actor.name || 'Player'}, your command?`;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    // Await player input using the prompt service
                    commandString = await playerPromptService.prompt(actor, promptMessage);
                } catch (error) {
                    // This error is from playerPromptService.prompt() itself.
                    logger.error(`HumanPlayerStrategy: Error receiving input via playerPromptService for actor ${actor.id}: ${error.message}`, error);
                    // Re-throw a more specific error to be caught by the outer try-catch or propagated
                    throw new Error(`Failed to get player input for actor ${actor.id}. Details: ${error.message}`);
                }

                if (commandString && commandString.trim() !== "") {
                    logger.info(`HumanPlayerStrategy: Received command "${commandString}" from actor ${actor.id}.`);
                    break; // Exit loop if command is not empty
                } else {
                    logger.debug(`HumanPlayerStrategy: Empty command received from actor ${actor.id}. Re-prompting.`);
                    // Update prompt message for re-prompt
                    promptMessage = `${actor.name || 'Player'}, please enter a command. (Previous was empty)`;
                }
            }

            // Formulate the ITurnAction
            /** @type {ITurnAction} */
            const turnAction = {
                commandString: commandString.trim(),
                actionDefinitionId: "unknown:playerInput",
                resolvedParameters: {}
            };

            logger.debug(`HumanPlayerStrategy: Resolving with ITurnAction for actor ${actor.id}:`, turnAction);
            return turnAction;

        } catch (error) {
            // This catch block handles errors from:
            // 1. _getActorFromContext
            // 2. _getPlayerPromptServiceFromContext
            // 3. The re-thrown error from playerPromptService.prompt()
            // 4. Any other unexpected errors in Phase 3.
            // It uses the 'logger' obtained successfully in Phase 1.

            // Log the error, but avoid double-logging if it's the specific "Failed to get player input"
            // error which is already logged more specifically by its source.
            // Other errors from helpers like _getActorFromContext will also have been logged by those helpers.
            // This outer log is a general catch-all.
            const actorIdForLog = context && typeof context.getActor === 'function' ? (context.getActor()?.id || 'unknown_in_catch') : 'unknown_context_in_catch';
            logger.error(`HumanPlayerStrategy.decideAction: Error during turn for actor ${actorIdForLog}. Message: ${error.message}`, error);
            throw error; // Re-throw the original error to be handled by the caller (e.g., turn state machine)
        }
    }

    /**
     * Helper to safely get the logger from the context.
     * @param {ITurnContext} context
     * @returns {ILogger}
     * @throws {Error} If context is invalid or logger cannot be retrieved or is invalid.
     * @private
     */
    _getLoggerFromContext(context) {
        if (!context) {
            console.error('HumanPlayerStrategy Critical: ITurnContext itself is null or undefined.');
            throw new Error('HumanPlayerStrategy Critical: ITurnContext is null or undefined.');
        }
        if (typeof context.getLogger !== 'function') {
            console.error('HumanPlayerStrategy Critical: context.getLogger is not a function.');
            throw new Error('HumanPlayerStrategy Critical: context.getLogger is not a function.');
        }

        let loggerInstance;
        try {
            loggerInstance = context.getLogger();
        } catch (e) {
            // This console.error is if context.getLogger() itself throws.
            console.error(`HumanPlayerStrategy Critical: context.getLogger() threw an error during retrieval: ${e.message}`);
            throw new Error(`HumanPlayerStrategy Critical: context.getLogger() failed. Details: ${e.message}`);
        }

        if (!loggerInstance || typeof loggerInstance.info !== 'function' || typeof loggerInstance.error !== 'function') {
            // If context.getLogger() returned something, but it's not a valid logger (e.g., missing essential methods).
            console.error('HumanPlayerStrategy Critical: Logger retrieved from context is invalid or incomplete (missing info/error methods).');
            throw new Error('HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete.');
        }
        return loggerInstance;
    }

    /**
     * Helper to safely get the actor from the context.
     * @param {ITurnContext} context
     * @param {ILogger} logger - A valid logger instance.
     * @returns {Entity}
     * @throws {Error} If actor cannot be retrieved or is invalid.
     * @private
     */
    _getActorFromContext(context, logger) {
        let actor = null;
        try {
            actor = context.getActor();
        } catch (e) {
            logger.error(`HumanPlayerStrategy: Error calling context.getActor(): ${e.message}`, e);
            throw new Error(`HumanPlayerStrategy Critical: Failed to call context.getActor(). Details: ${e.message}`);
        }

        if (!actor) { // Check if actor is null, undefined, etc.
            logger.error('HumanPlayerStrategy: Actor not found in ITurnContext (null or undefined).');
            throw new Error('HumanPlayerStrategy Critical: Actor not available from ITurnContext.');
        }
        return actor;
    }

    /**
     * Helper to safely get the player prompt service from the context.
     * @param {ITurnContext} context
     * @param {ILogger} logger - A valid logger instance.
     * @returns {IPlayerPromptService}
     * @throws {Error} If service cannot be retrieved or is invalid.
     * @private
     */
    _getPlayerPromptServiceFromContext(context, logger) {
        let service = null;
        try {
            service = context.getPlayerPromptService();
        } catch (e) {
            logger.error(`HumanPlayerStrategy: Error calling context.getPlayerPromptService(): ${e.message}`, e);
            throw new Error(`HumanPlayerStrategy Critical: Failed to call context.getPlayerPromptService(). Details: ${e.message}`);
        }

        if (!service || typeof service.prompt !== 'function') {
            logger.error('HumanPlayerStrategy: PlayerPromptService not available or invalid (e.g., missing prompt method) in ITurnContext.');
            throw new Error('HumanPlayerStrategy Critical: PlayerPromptService not available or invalid from ITurnContext.');
        }
        return service;
    }
}

// --- FILE END ---