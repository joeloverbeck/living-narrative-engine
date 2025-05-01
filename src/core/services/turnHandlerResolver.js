// src/core/services/turnHandlerResolver.js

// --- Interface Imports ---
import {ITurnHandlerResolver} from '../interfaces/ITurnHandlerResolver.js';
import {ITurnHandler} from '../interfaces/ITurnHandler.js'; // Ensure ITurnHandler itself is imported if needed for type checks/casting

// --- Core Imports ---
import {PLAYER_COMPONENT_ID} from '../../types/components.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../handlers/playerTurnHandler.js').default} PlayerTurnHandler */ // Assuming PlayerTurnHandler is default export

/**
 * @class TurnHandlerResolver
 * @implements {ITurnHandlerResolver}
 * @description Service responsible for resolving the correct ITurnHandler implementation
 * based on an actor entity. Initially supports PlayerTurnHandler for player entities.
 */
class TurnHandlerResolver extends ITurnHandlerResolver {
    /** @type {ILogger} */
    #logger;
    /** @type {PlayerTurnHandler} */
    #playerTurnHandler;

    // Future: Add other handlers like #aiTurnHandler

    /**
     * Creates an instance of TurnHandlerResolver.
     * @param {object} dependencies - The dependencies required by the resolver.
     * @param {ILogger} dependencies.logger - The logging service.
     * @param {PlayerTurnHandler} dependencies.playerTurnHandler - The handler instance for player turns.
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({logger, playerTurnHandler /*, future handlers */}) {
        super();

        if (!logger || typeof logger.debug !== 'function') {
            // Use console.error as logger might be unavailable
            console.error('TurnHandlerResolver: Invalid or missing logger dependency.');
            throw new Error('TurnHandlerResolver: Invalid or missing logger dependency.');
        }
        this.#logger = logger;

        if (!playerTurnHandler || typeof playerTurnHandler.handleTurn !== 'function') { // Check if it looks like an ITurnHandler
            this.#logger.error('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
            throw new Error('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        }
        this.#playerTurnHandler = playerTurnHandler;

        // Future: Validate other injected handlers

        this.#logger.debug('TurnHandlerResolver initialized.');
    }

    /**
     * Resolves the correct turn handler implementation for the given actor entity.
     * @param {Entity} actor - The entity whose turn handler needs to be resolved.
     * @returns {Promise<ITurnHandler | null>} A promise that resolves with the appropriate
     * ITurnHandler instance for the actor, or null if no specific handler is found or the actor is invalid.
     */
    async resolveHandler(actor) {
        if (!actor || !actor.id) {
            this.#logger.warn(`TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.`);
            return null; // Return null for invalid actor input
        }

        this.#logger.debug(`TurnHandlerResolver: Attempting to resolve turn handler for actor ${actor.id}...`);

        // Check if the actor is a player
        if (actor.hasComponent(PLAYER_COMPONENT_ID)) { // Use hasComponent method from Entity
            this.#logger.info(`TurnHandlerResolver: Resolved PlayerTurnHandler for actor ${actor.id}.`);
            return this.#playerTurnHandler;
        }

        // Future: Add checks for AI components or other types
        // else if (actor.hasComponent(AI_COMPONENT_ID)) {
        //     this.#logger.info(`TurnHandlerResolver: Resolved AITurnHandler for actor ${actor.id}.`);
        //     return this.#aiTurnHandler; // Assuming an AI handler is injected
        // }

        // If no specific handler is found
        this.#logger.info(`TurnHandlerResolver: No specific turn handler found for actor ${actor.id}. Returning null.`);
        return null; // Or return a DefaultPassTurnHandler instance if created later
    }
}

export default TurnHandlerResolver;