// src/core/turns/strategies/humanPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy_Interface */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */

// JSDoc type definitions for structures expected from PlayerPromptService.prompt()
// These are based on the refined ticket's prerequisites.
/**
 * @typedef {object} PlayerPromptResolution
 * @description The structure of the object resolved by PlayerPromptService.prompt().
 * @property {AvailableAction} action - The selected available action.
 * @property {string | null} speech - The speech input from the player, or null.
 */

/**
 * @typedef {object} AvailableAction
 * @description Represents an action available to the player.
 * @property {string} id - The unique identifier for the action definition (e.g., "core:wait", "ability:fireball").
 * @property {string} command - A representative command string or label for the action (e.g., "Wait", "Cast Fireball").
 * // Other properties might exist (e.g., description, parameters) but id and command are essential for this strategy.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
// If PromptError is a specific class that might be caught and identified by type:
// import { PromptError } from '../../errors/promptError.js'; // Path to PromptError definition

import {IActorTurnStrategy} from '../interfaces/IActorTurnStrategy.js';

/**
 * @class HumanPlayerStrategy
 * @implements {IActorTurnStrategy_Interface}
 * @description Implements the IActorTurnStrategy for human-controlled players.
 * It uses the PlayerPromptService to asynchronously obtain a chosen action and
 * any associated speech from the player, then constructs an ITurnAction.
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
     * It calls the asynchronous `PlayerPromptService.prompt()` method to obtain
     * the player's chosen action and optional speech. Based on this structured
     * response, it constructs and resolves with an ITurnAction object.
     *
     * This method relies on `PlayerPromptService` to handle the full interaction
     * with the player, including presenting choices and awaiting a confirmed selection.
     *
     * @async
     * @param {ITurnContext} context - The turn context for the current turn, providing
     * access to the actor, logger, player prompt service, etc.
     * @returns {Promise<ITurnAction>} A Promise that resolves to an ITurnAction object
     * representing the player's chosen action and parameters.
     * @throws {Error} If essential services (like PlayerPromptService, Logger, or Actor)
     * cannot be retrieved from the context.
     * @throws {Error} If `playerPromptService.prompt()` rejects (e.g., due to
     * timeout, invalid action from UI), the error is re-thrown. The specific type of
     * error (e.g., `PromptError`) from the service will be preserved.
     * @throws {Error} If the data received from `playerPromptService.prompt()` is malformed
     * or missing essential parts (e.g., `playerData.action` is null, or `action.id` / `action.command` are not strings).
     */
    async decideAction(context) {
        const logger = this._getLoggerFromContext(context);
        let actor; // Declare actor here for broader scope in the final catch block if needed.

        try {
            // Retrieve essential services and the actor
            actor = this._getActorFromContext(context, logger);
            const playerPromptService = this._getPlayerPromptServiceFromContext(context, logger);

            logger.info(`HumanPlayerStrategy: Initiating decideAction for actor ${actor.id}.`);

            let playerData; // Expected: { action: AvailableAction, speech: string | null }
            try {
                logger.debug(`HumanPlayerStrategy: Calling playerPromptService.prompt() for actor ${actor.id}.`);
                playerData = await playerPromptService.prompt(actor);
                logger.debug(`HumanPlayerStrategy: Received playerData for actor ${actor.id}. Details:`, playerData);
            } catch (promptError) {
                // AC6: Catch and re-throw, logging first.
                const errorMessage = `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${actor.id}.`;
                logger.error(errorMessage, promptError); // Log with the original error object
                throw promptError; // Re-throw the original error to preserve its type and details.
            }

            // AC7: Safeguard for playerData integrity.
            if (
                !playerData ||
                !playerData.action ||
                typeof playerData.action.id !== 'string' || playerData.action.id.trim() === '' ||
                typeof playerData.action.command !== 'string'
                // playerData.speech can be null, so no check for typeof string needed unless explicitly non-null required.
            ) {
                const errorMsg = `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${actor.id}. Action ID and command string are mandatory.`;
                logger.error(errorMsg, {receivedData: playerData});
                throw new Error(errorMsg + ` Received: ${JSON.stringify(playerData)}`);
            }
            logger.debug(`HumanPlayerStrategy: playerData for actor ${actor.id} validated successfully. Action ID: "${playerData.action.id}".`);

            // AC8: Construct ITurnAction.
            /** @type {ITurnAction} */
            const turnAction = {
                actionDefinitionId: playerData.action.id,
                commandString: playerData.action.command, // For logging, echo, or simple display.
                resolvedParameters: {
                    speech: playerData.speech, // playerData.speech can be string or null.
                    // (Future Consideration from ticket) If playerData.action contains other
                    // pre-resolved parameters relevant to the action execution, they should be
                    // mapped into resolvedParameters here. For now, focus on speech.
                },
            };

            logger.info(`HumanPlayerStrategy: Constructed ITurnAction for actor ${actor.id} with actionDefinitionId "${turnAction.actionDefinitionId}".`);
            logger.debug(`HumanPlayerStrategy: ITurnAction details for actor ${actor.id}:`, {turnActionDetails: turnAction});

            return turnAction; // AC9: Return the constructed ITurnAction.

        } catch (error) {
            // This outer catch block handles errors from:
            // - Helper methods (_getLoggerFromContext, _getActorFromContext, _getPlayerPromptServiceFromContext)
            // - The re-thrown error from the playerPromptService.prompt() call
            // - The error thrown by the playerData integrity check
            // - Any other unexpected errors within this main try...catch block.

            // Robustly determine actorIdForLog for the final error message
            let actorIdForLog = 'unknown_actor';
            if (actor && typeof actor.id === 'string' && actor.id.trim() !== '') {
                actorIdForLog = actor.id;
            } else if (context && typeof context.getActor === 'function') {
                try {
                    const currentActorInCatch = context.getActor();
                    if (currentActorInCatch && typeof currentActorInCatch.id === 'string' && currentActorInCatch.id.trim() !== '') {
                        actorIdForLog = currentActorInCatch.id;
                    }
                } catch (e) {
                    // If getActor() itself throws here when trying to get ID for logging,
                    // actorIdForLog remains 'unknown_actor'.
                    // This inner catch prevents a new error from derailing the primary error logging.
                    if (logger && typeof logger.warn === 'function') { // Check if logger is available
                        logger.warn(`HumanPlayerStrategy: Could not retrieve actor ID in final catch block: ${e.message}`);
                    } else {
                        console.warn(`HumanPlayerStrategy: Could not retrieve actor ID in final catch block: ${e.message}`);
                    }
                }
            }


            // Most specific errors should have been logged closer to their source with full details.
            // This log provides a general marker that decideAction failed.
            // The original error object (with its stack) is included.
            logger.error(`HumanPlayerStrategy.decideAction: Operation failed for actor ${actorIdForLog}. Error: ${error.message}`, error);

            throw error; // Re-throw the error to be handled by the calling turn state.
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
            console.error(errorMsg); // Use console.error as logger might not be available.
            throw new Error(errorMsg);
        }
        if (typeof context.getLogger !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: context.getLogger is not a function.';
            console.error(errorMsg); // Use console.error.
            throw new Error(errorMsg);
        }

        let loggerInstance;
        try {
            loggerInstance = context.getLogger();
        } catch (e) {
            const errorMsg = `HumanPlayerStrategy Critical: context.getLogger() call failed. Details: ${e.message}`;
            console.error(errorMsg, e); // Use console.error.
            throw new Error(errorMsg);
        }

        if (!loggerInstance ||
            typeof loggerInstance.info !== 'function' ||
            typeof loggerInstance.error !== 'function' ||
            typeof loggerInstance.debug !== 'function' ||
            typeof loggerInstance.warn !== 'function') { // Added warn check for completeness
            const errorMsg = 'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
            console.error(errorMsg); // Use console.error as the logger instance is faulty.
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
        // Context null check implicitly handled by _getLoggerFromContext if called first,
        // but good for robustness if this method were called independently.
        if (!context) {
            const errorMsg = 'HumanPlayerStrategy Critical: ITurnContext is null (in _getActorFromContext).';
            // logger might not be valid if context is null, but attempt logging if it was passed.
            if (logger && typeof logger.error === 'function') logger.error(errorMsg);
            else console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (typeof context.getActor !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: context.getActor is not a function.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        let actorInstance = null;
        try {
            actorInstance = context.getActor();
        } catch (e) {
            const errorMsg = `HumanPlayerStrategy Critical: context.getActor() call failed. Details: ${e.message}`;
            logger.error(errorMsg, e);
            throw new Error(errorMsg);
        }

        if (!actorInstance || typeof actorInstance.id !== 'string' || actorInstance.id.trim() === '') {
            const errorMsg = 'HumanPlayerStrategy Critical: Actor not available from ITurnContext or actor has an invalid ID.';
            logger.error(errorMsg, {actorInstance});
            throw new Error(errorMsg);
        }
        return actorInstance;
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
        if (!context) {
            const errorMsg = 'HumanPlayerStrategy Critical: ITurnContext is null (in _getPlayerPromptServiceFromContext).';
            if (logger && typeof logger.error === 'function') logger.error(errorMsg);
            else console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (typeof context.getPlayerPromptService !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        let serviceInstance = null;
        try {
            serviceInstance = context.getPlayerPromptService();
        } catch (e) {
            const errorMsg = `HumanPlayerStrategy Critical: context.getPlayerPromptService() call failed. Details: ${e.message}`;
            logger.error(errorMsg, e);
            throw new Error(errorMsg);
        }

        if (!serviceInstance || typeof serviceInstance.prompt !== 'function') {
            const errorMsg = 'HumanPlayerStrategy Critical: PlayerPromptService not available from ITurnContext or is invalid (e.g., missing prompt method).';
            logger.error(errorMsg, {serviceInstance});
            throw new Error(errorMsg);
        }
        return serviceInstance;
    }
}

// --- FILE END ---