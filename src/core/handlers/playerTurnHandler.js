// src/core/handlers/playerTurnHandler.js
// --- FILE START (Showing relevant class context and changes) ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/IGameStateManager.js').IGameStateManager} IGameStateManager */ // Added dependency
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */ // Added dependency
/** @typedef {import('../services/gameDataRepository.js').default} GameDataRepository */ // Added dependency
/** @typedef {import('../../logic/defs.js').ActionContext} ActionContext */ // Added for type hinting
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../eventBus.js').default} EventBus */ // Added dependency
/** @typedef {{ entityId: string, command: string }} CommandSubmitEvent */ // Assuming event structure
/** @typedef {*} CommandProcessingResult */ // Placeholder for the result type from ICommandProcessor
/** @typedef {(eventData: CommandSubmitEvent) => Promise<void>} CommandSubmitListener */ // Type for the listener function

/**
 * @class PlayerTurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic specifically for player-controlled entities.
 * It orchestrates discovering actions, prompting for input, receiving commands via events,
 * and managing the turn's lifecycle.
 */
class PlayerTurnHandler extends ITurnHandler {
    /** @type {ILogger} */
    #logger;
    /** @type {IActionDiscoverySystem} */
    #actionDiscoverySystem;
    /** @type {IValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @type {ICommandProcessor} */
    #commandProcessor;
    /** @type {IGameStateManager} */
    #gameStateManager;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameDataRepository} */
    #gameDataRepository;
    /** @type {EventBus} */ // Added dependency
    #eventBus;

    /** @type {Entity | null} */
    #currentActor = null;
    /** @type {Promise<void> | null} */
    #turnPromise = null;
    /** @type {(value: void | PromiseLike<void>) => void | null} */
    #turnPromiseResolve = null;
    /** @type {(reason?: any) => void | null} */
    #turnPromiseReject = null;

    // --- MODIFICATION START ---
    /**
     * Stores the reference to the bound event listener function for 'command:submit'.
     * Used for unsubscribing. Null if not subscribed.
     * @private
     * @type {CommandSubmitListener | null}
     */
    #commandSubmitListener = null;

    // --- MODIFICATION END ---


    /**
     * Creates an instance of PlayerTurnHandler.
     * @param {object} dependencies - The dependencies required by the handler.
     * @param {ILogger} dependencies.logger - The logging service.
     * @param {IActionDiscoverySystem} dependencies.actionDiscoverySystem - System for discovering valid actions.
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - System for dispatching validated events.
     * @param {ICommandProcessor} dependencies.commandProcessor - System for processing player commands.
     * @param {IGameStateManager} dependencies.gameStateManager - Manages the current state of the game.
     * @param {EntityManager} dependencies.entityManager - Manages entities.
     * @param {GameDataRepository} dependencies.gameDataRepository - Provides access to game data definitions.
     * @param {EventBus} dependencies.eventBus - The core event bus for subscribing to non-validated events like commands.
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({
                    logger,
                    actionDiscoverySystem,
                    validatedEventDispatcher,
                    commandProcessor,
                    gameStateManager,
                    entityManager,
                    gameDataRepository,
                    eventBus // Added
                }) {
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

        if (!gameStateManager || typeof gameStateManager.getLocationOfEntity !== 'function') {
            this.#logger.error('PlayerTurnHandler: Invalid or missing gameStateManager dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing gameStateManager dependency.');
        }
        this.#gameStateManager = gameStateManager;

        if (!entityManager || typeof entityManager.getEntity !== 'function') {
            this.#logger.error('PlayerTurnHandler: Invalid or missing entityManager dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing entityManager dependency.');
        }
        this.#entityManager = entityManager;

        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') { // Check for a representative method
            this.#logger.error('PlayerTurnHandler: Invalid or missing gameDataRepository dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing gameDataRepository dependency.');
        }
        this.#gameDataRepository = gameDataRepository;

        // Validate and assign EventBus
        if (!eventBus || typeof eventBus.subscribe !== 'function' || typeof eventBus.unsubscribe !== 'function') {
            this.#logger.error('PlayerTurnHandler: Invalid or missing eventBus dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing eventBus dependency.');
        }
        this.#eventBus = eventBus;

        // --- MODIFICATION START ---
        // Subscribe to command submission events (Task 1)

        // 1. Create the listener function (bound to 'this' context) and store it
        this.#commandSubmitListener = (eventData) => this.#handleSubmittedCommand(eventData);

        // 2. Subscribe using the stored listener reference
        this.#eventBus.subscribe(
            'command:submit',
            this.#commandSubmitListener
        );

        // 3. Log success (Removed the check for the return value, as it's void)
        this.#logger.debug('PlayerTurnHandler initialized successfully and subscribed to command:submit.');
        // --- MODIFICATION END ---

    }

    /**
     * Handles the turn for a player-controlled actor. It initiates the action discovery
     * and input sequence, then waits for the turn to complete via command processing.
     * @param {Entity} actor - The player entity whose turn it is.
     * @returns {Promise<void>} A promise that resolves when the player's turn is complete
     * (after a valid command is processed) or rejects on error during initiation or processing.
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
        let turnCompletionResolve, turnCompletionReject;
        this.#turnPromise = new Promise((resolve, reject) => {
            turnCompletionResolve = resolve;
            turnCompletionReject = reject;
        });
        this.#turnPromiseResolve = turnCompletionResolve;
        this.#turnPromiseReject = turnCompletionReject;

        try {
            // Start the sequence of discovering actions and enabling input
            // We await this because if it fails, the turn fails immediately.
            await this.#_initiatePlayerActionSequence(actor);

            // If initiation succeeds, return the promise that waits for command processing
            return this.#turnPromise;

        } catch (error) {
            // If the initiation sequence itself fails, reject the main turn promise AND re-throw
            this.#logger.error(`PlayerTurnHandler: Error during action sequence initiation for ${actor.id}: ${error.message}`, error);
            if (this.#turnPromiseReject) {
                // Ensure the internal promise is rejected if it hasn't been implicitly
                // rejected by the error propagating from an async function.
                // This might be redundant if the error came from an async function within
                // the sequence, but it's safer to ensure rejection state.
                this.#turnPromiseReject(error);
            }
            this.#_cleanupTurn(); // Ensure state is cleaned up on initiation error
            throw error; // Re-throw the error so the promise returned by handleTurn rejects.
        }
    }


    /**
     * Handles submitted commands received via the EventBus.
     * Validates the command source and triggers processing if valid.
     * @private
     * @param {CommandSubmitEvent} eventData - The event data containing entityId and command.
     * @returns {Promise<void>}
     */
    async #handleSubmittedCommand(eventData) {
        this.#logger.debug(`PlayerTurnHandler: Received command:submit event: ${JSON.stringify(eventData)}`);

        // Task 3.1: Check if currently processing a turn
        if (!this.#currentActor) {
            this.#logger.warn(`PlayerTurnHandler: Received command:submit but no turn is active. Ignoring.`);
            return;
        }

        // Task 3.2: Extract entityId and command
        const {entityId, command: commandString} = eventData || {};

        // Task 3.3: Validate entityId
        if (!entityId || entityId !== this.#currentActor.id) {
            // Task 3.4: Log warning and potentially dispatch "Not your turn"
            this.#logger.warn(`PlayerTurnHandler: Received command for wrong actor. Expected: ${this.#currentActor.id}, Received: ${entityId || 'MISSING'}. Ignoring command: "${commandString}"`);
            return; // Ignore the command
        }

        // Task 3.5: Validation passes
        this.#logger.info(`PlayerTurnHandler: Received valid command "${commandString}" for current actor ${this.#currentActor.id}. Processing...`);

        // Task 3.5.1 (Ticket 3.1.5): Call the command processing logic.
        await this.#_processValidatedCommand(this.#currentActor, commandString);
    }


    /**
     * Processes a validated command string by disabling input, calling the command
     * processor, then resolving / rejecting the turn-promise **before** state is
     * wiped in cleanup.
     * @private
     * @param {Entity} actor         – the actor whose command is being processed
     * @param {string} commandString – the raw command string
     * @returns {Promise<void>}
     */
    async #_processValidatedCommand(actor, commandString) {
        this.#logger.debug(
            `PlayerTurnHandler: #_processValidatedCommand started for ${actor.id} ` +
            `with command "${commandString}".`
        );

        /* ─────────── 1. Disable input (best-effort) ─────────── */
        try {
            await this.#validatedEventDispatcher.dispatchValidated(
                'textUI:disable_input',
                {message: 'Processing…', entityId: actor.id}
            );
        } catch (dispatchErr) {
            this.#logger.error(
                `PlayerTurnHandler: Failed to dispatch textUI:disable_input for ` +
                `${actor.id}: ${dispatchErr.message}`, dispatchErr
            );
            // continue anyway – inability to update UI shouldn’t block gameplay
        }

        /* ─────────── 2. Run the command ─────────── */
        let caughtError = null;
        try {
            this.#logger.info(
                `PlayerTurnHandler: Processing command "${commandString}" for ` +
                `${actor.id} via ICommandProcessor…`
            );

            const result = await this.#commandProcessor.processCommand(
                actor,
                commandString
            );

            this.#logger.info(
                `PlayerTurnHandler: Command processed for ${actor.id}. ` +
                `Result stub → ${JSON.stringify(result)}`
            );
        } catch (err) {
            caughtError = err;
            this.#logger.error(
                `PlayerTurnHandler: Error while processing command "${commandString}" ` +
                `for ${actor.id}: ${err.message}`, err
            );

            /* ─ optional UX feedback (best-effort) ─ */
            try {
                await this.#validatedEventDispatcher.dispatchValidated(
                    'display:message',
                    {
                        message: `Error processing command: ${err.message}`,
                        recipientEntityId: actor.id
                    }
                );
            } catch (dispatchErr) {
                this.#logger.error(
                    `PlayerTurnHandler: Failed to dispatch error message to UI ` +
                    `for ${actor.id}: ${dispatchErr.message}`, dispatchErr
                );
            }
        } finally {
            /* ─────────── 3. Resolve / reject turn-promise BEFORE cleanup ─────────── */
            if (caughtError) {
                this.#logger.info(
                    `PlayerTurnHandler: Signalling FAILED turn for ${actor.id}.`
                );
                this.#turnPromiseReject?.(caughtError);
            } else {
                this.#logger.info(
                    `PlayerTurnHandler: Signalling SUCCESSFUL turn for ${actor.id}.`
                );
                this.#turnPromiseResolve?.();           // resolves with undefined
            }

            /* ─────────── 4. Always clean internal state ─────────── */
            this.#_cleanupTurn();
        }
    }


    /**
     * Initiates the sequence to discover actions and enable player input.
     * @private
     * @param {Entity} actor - The player entity.
     * @returns {Promise<void>}
     * @throws {Error} Rethrows errors from internal steps if they occur.
     */
    async #_initiatePlayerActionSequence(actor) {
        this.#logger.debug(`PlayerTurnHandler: Initiating action sequence for ${actor.id}.`);
        // try/catch removed from here; let errors propagate up to handleTurn
        // Discover and display actions first
        await this.#_discoverAndDisplayActions(actor);
        // Then enable input
        await this.#_enablePlayerInput(actor);
        this.#logger.debug(`PlayerTurnHandler: Action sequence initiated for ${actor.id}. Waiting for command.`);
    }

    /**
     * Discovers available actions for the actor and dispatches an event to display them.
     * Constructs the necessary ActionContext for discovery.
     * @private
     * @param {Entity} actor - The player entity.
     * @returns {Promise<void>}
     * @throws {Error} If context construction, action discovery, or dispatch fails.
     */
    async #_discoverAndDisplayActions(actor) {
        this.#logger.debug(`PlayerTurnHandler: Discovering actions for ${actor.id}.`);
        let validActions = [];
        try {
            // 1. Get Current Location
            const currentLocation = await this.#gameStateManager.getLocationOfEntity(actor);
            if (!currentLocation) {
                throw new Error(`Could not determine current location for actor ${actor.id}`);
            }

            // 2. Construct ActionContext
            /** @type {ActionContext} */
            const context = {
                actingEntity: actor,
                currentLocation: currentLocation,
                entityManager: this.#entityManager,
                gameDataRepository: this.#gameDataRepository,
                logger: this.#logger,
                gameStateManager: this.#gameStateManager
            };

            // 3. Call Action Discovery System
            validActions = await this.#actionDiscoverySystem.getValidActions(actor, context);
            this.#logger.debug(`PlayerTurnHandler: Discovered ${validActions.length} actions for ${actor.id}.`);

            // 4. Dispatch Event
            await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', {
                actions: validActions,
                entityId: actor.id
            });
            this.#logger.debug(`PlayerTurnHandler: Dispatched event:update_available_actions for ${actor.id}.`);

        } catch (error) {
            this.#logger.error(`PlayerTurnHandler: Error during action discovery or display for ${actor.id}: ${error.message}`, error);
            // Optionally dispatch an error event or handle differently
            try {
                // Attempt to clear actions on UI even if discovery failed
                await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', {
                    actions: [], // Send empty actions on error
                    entityId: actor.id
                });
            } catch (dispatchError) {
                this.#logger.error(`PlayerTurnHandler: Failed to dispatch empty actions after error for ${actor.id}: ${dispatchError.message}`, dispatchError);
            }
            throw error; // Rethrow to ensure the sequence initiation fails and propagates up
        }
    }

    /**
     * Dispatches an event to enable the input interface for the player.
     * @private
     * @param {Entity} actor - The player entity.
     * @returns {Promise<void>}
     * @throws {Error} If dispatching the event fails.
     */
    async #_enablePlayerInput(actor) {
        this.#logger.debug(`PlayerTurnHandler: Enabling player input for ${actor.id}.`);
        try {
            const message = "Your turn. Enter command..."; // Define the prompt message
            await this.#validatedEventDispatcher.dispatchValidated('textUI:enable_input', {
                placeholder: message,
                entityId: actor.id
            });
            this.#logger.debug(`PlayerTurnHandler: Dispatched textUI:enable_input for ${actor.id}.`);
        } catch (error) {
            this.#logger.error(`PlayerTurnHandler: Failed to dispatch textUI:enable_input for ${actor.id}: ${error.message}`, error);
            throw error; // Rethrow to ensure the sequence initiation fails and propagates up
        }
    }


    /**
     * Cleans up resources and resets state associated with the current turn.
     * @private
     */
    #_cleanupTurn() {
        const actorId = this.#currentActor?.id || 'NO ACTOR'; // Provide default if null
        this.#logger.debug(`PlayerTurnHandler: Cleaning up turn state for actor ${actorId}.`);

        // Reset turn-specific state
        this.#currentActor = null;
        this.#turnPromise = null; // Let GC handle the promise object
        this.#turnPromiseResolve = null;
        this.#turnPromiseReject = null;

        // Note: The 'command:submit' subscription is persistent
        this.#logger.debug(`PlayerTurnHandler: Turn state reset for actor ${actorId}.`);
    }

    /**
     * Gracefully shuts down the handler, unsubscribing from persistent listeners.
     * @public
     */
    destroy() {
        this.#logger.info(`PlayerTurnHandler: Destroying handler and unsubscribing from events.`);

        // --- MODIFICATION START ---
        // Unsubscribe using the stored listener reference
        if (this.#commandSubmitListener) {
            try {
                this.#eventBus.unsubscribe('command:submit', this.#commandSubmitListener);
                this.#logger.debug(`PlayerTurnHandler: Unsubscribed from command:submit.`);
            } catch (unsubscribeError) {
                this.#logger.error(`PlayerTurnHandler: Error unsubscribing from command:submit: ${unsubscribeError.message}`, unsubscribeError);
            }
            // Clear the stored reference
            this.#commandSubmitListener = null;
        }
        // --- MODIFICATION END ---

        if (this.#currentActor) {
            this.#logger.warn(`PlayerTurnHandler: Destroying handler while a turn for ${this.#currentActor.id} was potentially active. Forcing cleanup.`);
            // Ensure promise rejection if the turn was abruptly ended by destruction
            if (this.#turnPromiseReject) {
                this.#turnPromiseReject(new Error(`PlayerTurnHandler destroyed during turn for actor ${this.#currentActor.id}`));
            }
            this.#_cleanupTurn(); // Cleans up actor, promise refs etc.
        }
    }

}

export default PlayerTurnHandler;
// --- FILE END ---