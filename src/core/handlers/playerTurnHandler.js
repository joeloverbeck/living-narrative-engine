// src/core/handlers/playerTurnHandler.js

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */ // Adjusted path based on fetched files
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @class PlayerTurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic specifically for player-controlled entities.
 * It waits for player input, processes it, and coordinates the resulting action.
 */
class PlayerTurnHandler extends ITurnHandler {
    /** @type {IActionDiscoverySystem} */
    #actionDiscoverySystem;
    /** @type {IValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @type {ILogger} */
    #logger;
    /** @type {ICommandProcessor} */
    #commandProcessor;

    /**
     * Creates an instance of PlayerTurnHandler.
     * @param {object} dependencies - The dependencies required by the handler.
     * @param {ILogger} dependencies.logger - The logging service.
     * @param {IActionDiscoverySystem} dependencies.actionDiscoverySystem - System for discovering valid actions.
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - System for dispatching validated events.
     * @param {ICommandProcessor} dependencies.commandProcessor - System for processing player commands.
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({logger, actionDiscoverySystem, validatedEventDispatcher, commandProcessor}) {
        super();

        // Inject and assign logger first for logging potential issues
        if (!logger || typeof logger.error !== 'function') {
            // Cannot log if logger itself is invalid, throw immediately
            throw new Error('PlayerTurnHandler: Invalid or missing logger dependency.');
        }
        this.#logger = logger;

        // Validate and assign other dependencies
        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            this.#logger.error('PlayerTurnHandler: Invalid or missing actionDiscoverySystem dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing actionDiscoverySystem dependency.');
        }
        this.#actionDiscoverySystem = actionDiscoverySystem;

        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            this.#logger.error('PlayerTurnHandler: Invalid or missing validatedEventDispatcher dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing validatedEventDispatcher dependency.');
        }
        this.#validatedEventDispatcher = validatedEventDispatcher;

        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            this.#logger.error('PlayerTurnHandler: Invalid or missing commandProcessor dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing commandProcessor dependency.');
        }
        this.#commandProcessor = commandProcessor;

        this.#logger.debug('PlayerTurnHandler initialized successfully.');
    }

    /**
     * Handles the turn for a player-controlled actor.
     * Placeholder implementation.
     * @param {Entity} actor - The player entity whose turn it is.
     * @returns {Promise<void>} A promise that resolves when the player's turn is complete.
     * @throws {Error} Not implemented yet.
     */
    async handleTurn(actor) {
        this.#logger.info(`PlayerTurnHandler: Starting turn for actor ${actor?.id || 'UNKNOWN'}.`);
        // TODO: Implement actual player turn logic:
        // 1. Discover available actions (using #actionDiscoverySystem).
        // 2. Dispatch event to UI to enable input and display actions.
        // 3. Wait for input command from the player (likely via an event).
        // 4. Process the command (using #commandProcessor).
        // 5. Handle the result (success/failure feedback).
        // 6. Resolve the promise when the turn's action is processed.
        console.log(`PlayerTurnHandler: Handling turn for actor ${actor?.id || 'UNKNOWN'}. Implementation pending.`); // Temporary console log

        // Placeholder: Throw error until implemented
        throw new Error('PlayerTurnHandler.handleTurn method not implemented yet.');

        // this.#logger.info(`PlayerTurnHandler: Ending turn for actor ${actor?.id || 'UNKNOWN'}.`);
    }
}

export default PlayerTurnHandler;