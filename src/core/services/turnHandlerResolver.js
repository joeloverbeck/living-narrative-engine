// src/core/services/turnHandlerResolver.js

// --- Interface Imports ---
import {ITurnHandlerResolver} from '../interfaces/ITurnHandlerResolver.js';
import {ITurnHandler} from '../interfaces/ITurnHandler.js'; // Ensure ITurnHandler itself is imported if needed for type checks/casting

// --- Core Imports ---
import {PLAYER_COMPONENT_ID, ACTOR_COMPONENT_ID} from '../../types/components.js'; // Added ACTOR_COMPONENT_ID
import {tokens} from '../config/tokens.js'; // Added tokens for potential future use, not strictly needed here

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../turns/handlers/playerTurnHandler.js').default} PlayerTurnHandler */ // Assuming PlayerTurnHandler is default export
/** @typedef {import('../turns/handlers/aiTurnHandler.js').default} AITurnHandler */ // Assuming AITurnHandler is default export

/**
 * @class TurnHandlerResolver
 * @implements {ITurnHandlerResolver}
 * @description Service responsible for resolving the correct ITurnHandler implementation
 * based on an actor entity. Supports PlayerTurnHandler and AITurnHandler.
 */
class TurnHandlerResolver extends ITurnHandlerResolver {
    /** @type {ILogger} */
    #logger;
    /** @type {PlayerTurnHandler} */
    #playerTurnHandler;
    /** @type {AITurnHandler} */ // Added AI handler field
    #aiTurnHandler;

    /**
     * Creates an instance of TurnHandlerResolver.
     * @param {object} dependencies - The dependencies required by the resolver.
     * @param {ILogger} dependencies.logger - The logging service.
     * @param {PlayerTurnHandler} dependencies.playerTurnHandler - The handler instance for player turns.
     * @param {AITurnHandler} dependencies.aiTurnHandler - The handler instance for AI turns. // Added AI handler dependency
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({logger, playerTurnHandler, aiTurnHandler}) { // Added aiTurnHandler
        super();

        if (!logger || typeof logger.debug !== 'function') {
            // Use console.error as logger might be unavailable
            console.error('TurnHandlerResolver: Invalid or missing logger dependency.');
            throw new Error('TurnHandlerResolver: Invalid or missing logger dependency.');
        }
        this.#logger = logger;

        // *** CORRECTED: Check for startTurn instead of handleTurn ***
        if (!playerTurnHandler || typeof playerTurnHandler.startTurn !== 'function') { // Check if it looks like an ITurnHandler (using startTurn)
            this.#logger.error('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency (requires startTurn).');
            throw new Error('TurnHandlerResolver: Invalid or missing playerTurnHandler dependency.');
        }
        this.#playerTurnHandler = playerTurnHandler;

        // *** CORRECTED: Check for startTurn instead of handleTurn ***
        if (!aiTurnHandler || typeof aiTurnHandler.startTurn !== 'function') { // Check if it looks like an ITurnHandler (using startTurn)
            this.#logger.error('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency (requires startTurn).');
            throw new Error('TurnHandlerResolver: Invalid or missing aiTurnHandler dependency.');
        }
        this.#aiTurnHandler = aiTurnHandler;

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
        // Check if the actor is an AI (has actor component but not player component)
        else if (actor.hasComponent(ACTOR_COMPONENT_ID) && !actor.hasComponent(PLAYER_COMPONENT_ID)) { // Added AI check
            this.#logger.info(`TurnHandlerResolver: Resolved AITurnHandler for actor ${actor.id}.`);
            return this.#aiTurnHandler;
        }
        // If no specific handler is found (might be an actor without AI or Player, or not an actor at all)
        else {
            this.#logger.info(`TurnHandlerResolver: No specific turn handler found for actor ${actor.id}. Returning null.`);
            return null; // Or return a DefaultPassTurnHandler instance if created later
        }
    }
}

export default TurnHandlerResolver;