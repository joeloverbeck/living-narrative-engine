// src/core/handlers/playerTurnHandler.js

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @class PlayerTurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic specifically for player-controlled entities.
 * It orchestrates discovering actions, prompting for input, and managing the turn's lifecycle.
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

    /** @type {Entity | null} */
    #currentActor = null;
    /** @type {Promise<void> | null} */
    #turnPromise = null;
    /** @type {(value: void | PromiseLike<void>) => void | null} */
    #turnPromiseResolve = null;
    /** @type {(reason?: any) => void | null} */
    #turnPromiseReject = null;


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
     * Handles the turn for a player-controlled actor. It initiates the action discovery
     * and input sequence, then waits for the turn to complete via command processing.
     * @param {Entity} actor - The player entity whose turn it is.
     * @returns {Promise<void>} A promise that resolves when the player's turn is complete
     * (after a valid command is processed) or rejects on error.
     * @throws {Error} If actor is invalid or if called while a turn is already in progress.
     */
    async handleTurn(actor) {
        this.#logger.info(`PlayerTurnHandler: Starting turn handling for actor ${actor?.id || 'UNKNOWN'}.`);

        if (!actor || !actor.id) {
            this.#logger.error('PlayerTurnHandler: Attempted to handle turn for an invalid actor.');
            throw new Error('PlayerTurnHandler: Actor must be a valid entity.');
        }

        if (this.#currentActor) {
            this.#logger.error(`PlayerTurnHandler: Attempted to start a new turn for ${actor.id} while turn for ${this.#currentActor.id} is already in progress.`);
            throw new Error('PlayerTurnHandler: Cannot handle a new turn while another is active.');
        }

        this.#currentActor = actor;

        // Create a promise that will be resolved/rejected when the turn concludes
        this.#turnPromise = new Promise((resolve, reject) => {
            this.#turnPromiseResolve = resolve;
            this.#turnPromiseReject = reject;
        });

        // Start the sequence of discovering actions and enabling input
        // We don't await this directly here; the resolution comes from command processing.
        this.#_initiatePlayerActionSequence(actor).catch(error => {
            // If the initiation sequence itself fails, reject the main turn promise
            this.#logger.error(`PlayerTurnHandler: Error during action sequence initiation for ${actor.id}: ${error.message}`, error);
            if (this.#turnPromiseReject) {
                this.#turnPromiseReject(error);
            }
            this.#resetTurnState(); // Ensure state is cleaned up on initiation error
        });

        // Return the promise that waits for the turn completion signal
        return this.#turnPromise;
    }

    /**
     * Initiates the sequence to discover actions and enable player input.
     * Contains placeholder calls for now.
     * @private
     * @param {Entity} actor - The player entity.
     * @returns {Promise<void>}
     */
    async #_initiatePlayerActionSequence(actor) {
        this.#logger.debug(`PlayerTurnHandler: Initiating action sequence for ${actor.id}.`);
        try {
            await this.#_discoverAndDisplayActions(actor);
            await this.#_enablePlayerInput(actor);
            this.#logger.debug(`PlayerTurnHandler: Action sequence initiated for ${actor.id}. Waiting for command.`);
        } catch (error) {
            this.#logger.error(`PlayerTurnHandler: Failed to initiate action sequence for ${actor.id}: ${error.message}`, error);
            // Rethrow to be caught by the caller (handleTurn)
            throw error;
        }
    }

    /**
     * (Placeholder) Discovers available actions for the actor and triggers display.
     * @private
     * @param {Entity} actor - The player entity.
     * @returns {Promise<void>}
     */
    async #_discoverAndDisplayActions(actor) {
        // TODO: Implement in Ticket 3.1.3
        this.#logger.debug(`PlayerTurnHandler: (Placeholder) Discovering and displaying actions for ${actor.id}.`);
        // Placeholder logic:
        // const actions = await this.#actionDiscoverySystem.getValidActions(actor);
        // await this.#validatedEventDispatcher.dispatchValidated('update_available_actions', { actorId: actor.id, actions });
    }

    /**
     * (Placeholder) Enables the input interface for the player.
     * @private
     * @param {Entity} actor - The player entity.
     * @returns {Promise<void>}
     */
    async #_enablePlayerInput(actor) {
        // TODO: Implement in Ticket 3.1.3
        this.#logger.debug(`PlayerTurnHandler: (Placeholder) Enabling player input for ${actor.id}.`);
        // Placeholder logic:
        // await this.#validatedEventDispatcher.dispatchValidated('enable_player_input', { actorId: actor.id });
    }

    /**
     * Resets the internal state related to the current turn.
     * Called when a turn completes or encounters a critical error.
     * @private
     */
    #resetTurnState() {
        this.#logger.debug(`PlayerTurnHandler: Resetting turn state for actor ${this.#currentActor?.id}.`);
        this.#currentActor = null;
        this.#turnPromise = null;
        this.#turnPromiseResolve = null;
        this.#turnPromiseReject = null;
    }

    // TODO: Add methods to be called by the command processor (or via events)
    // to resolve or reject the #turnPromise in Tickets 3.1.4 / 3.1.5.
    // e.g., _onCommandProcessedSuccessfully(), _onCommandProcessingFailed()
    // These methods should call #turnPromiseResolve() or #turnPromiseReject()
    // and then call #resetTurnState().

}

export default PlayerTurnHandler;