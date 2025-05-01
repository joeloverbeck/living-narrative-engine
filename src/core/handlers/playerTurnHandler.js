// src/core/handlers/playerTurnHandler.js

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
/** @typedef {import('../models/location.js').default} Location */ // Added for type hinting
/** @typedef {import('../eventBus.js').default} EventBus */ // Added dependency
/** @typedef {import('../interfaces/IEventBus.js').SubscriptionHandle} SubscriptionHandle */
/** @typedef {{ entityId: string, command: string }} CommandSubmitEvent */ // Assuming event structure
/** @typedef {*} CommandProcessingResult */ // Placeholder for the result type from ICommandProcessor

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
    /** @type {SubscriptionHandle | null} */ // Added for cleanup
    #commandSubmitSubscriptionHandle = null;


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

        // Subscribe to command submission events (Task 1)
        this.#commandSubmitSubscriptionHandle = this.#eventBus.subscribe(
            'command:submit',
            // Bind the handler to ensure `this` context is correct
            (eventData) => this.#handleSubmittedCommand(eventData)
        );
        if (!this.#commandSubmitSubscriptionHandle) {
            this.#logger.error('PlayerTurnHandler: Failed to subscribe to command:submit event.');
            // Depending on EventBus implementation, might need more robust error handling
            throw new Error('PlayerTurnHandler: Failed to subscribe to command:submit event.');
        }

        this.#logger.debug('PlayerTurnHandler initialized successfully and subscribed to command:submit.');
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
        // The promise is now primarily resolved/rejected by the command processing logic
        // triggered by #handleSubmittedCommand -> #_processValidatedCommand
        // Renaming internal variables for clarity (Ticket 3.1.2 refinement)
        let turnCompletionResolve, turnCompletionReject;
        this.#turnPromise = new Promise((resolve, reject) => {
            turnCompletionResolve = resolve;
            turnCompletionReject = reject;
        });
        this.#turnPromiseResolve = turnCompletionResolve; // Store for #_processValidatedCommand
        this.#turnPromiseReject = turnCompletionReject; // Store for #_processValidatedCommand

        try {
            // Start the sequence of discovering actions and enabling input
            // We don't await this directly here; the resolution comes from command processing.
            await this.#_initiatePlayerActionSequence(actor);
        } catch (error) {
            // If the initiation sequence itself fails, reject the main turn promise
            this.#logger.error(`PlayerTurnHandler: Error during action sequence initiation for ${actor.id}: ${error.message}`, error);
            if (this.#turnPromiseReject) {
                this.#turnPromiseReject(error);
            }
            this.#_cleanupTurn(); // Ensure state is cleaned up on initiation error
            // Rethrow or handle as appropriate for the GameLoop
            throw error; // Make sure the GameLoop knows this turn failed immediately
        }

        // Return the promise that waits for the turn completion signal from command processing
        return this.#turnPromise;
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

            // Optional: Dispatch a "Not your turn" message ONLY if the command was for a *different* player
            // This requires knowing if the received entityId corresponds to *any* player entity.
            // For now, we just log and ignore. If needed, enhance with EntityManager lookup.
            // Example (conceptual):
            // if (entityId && this.#entityManager.isPlayer(entityId)) { // Assuming an isPlayer method
            //     await this.#validatedEventDispatcher.dispatchValidated('display:message', {
            //         message: "It's not your turn!",
            //         recipientEntityId: entityId // Send only to the player who sent the command
            //     });
            // }

            return; // Ignore the command
        }

        // Task 3.5: Validation passes
        this.#logger.info(`PlayerTurnHandler: Received valid command "${commandString}" for current actor ${this.#currentActor.id}. Processing...`);

        // Task 3.5.1 (Ticket 3.1.5): Call the command processing logic.
        // Error handling and promise resolution/rejection now happens within #_processValidatedCommand.
        // No need for try/catch here as #_processValidatedCommand handles its own errors and signals turn completion.
        await this.#_processValidatedCommand(this.#currentActor, commandString);
    }

    /**
     * Processes a validated command string by disabling input, calling the command processor,
     * handling the result (success/failure), signaling turn completion, and cleaning up.
     * @private
     * @param {Entity} actor - The actor whose command is being processed.
     * @param {string} commandString - The raw command string to process.
     * @returns {Promise<void>} A promise that resolves when this processing step is complete (doesn't necessarily mean the turn succeeded).
     */
    async #_processValidatedCommand(actor, commandString) {
        this.#logger.debug(`PlayerTurnHandler: #_processValidatedCommand started for ${actor.id} with command "${commandString}".`);

        // 1. Disable Input
        try {
            this.#logger.debug(`PlayerTurnHandler: Dispatching textUI:disable_input for ${actor.id}.`);
            await this.#validatedEventDispatcher.dispatchValidated('textUI:disable_input', {
                message: "Processing...", // You might customize this message
                entityId: actor.id
            });
        } catch (dispatchError) {
            // Log the dispatch error, but proceed with command processing if possible.
            // Consider if this should reject the turn. For now, just logging.
            this.#logger.error(`PlayerTurnHandler: Failed to dispatch textUI:disable_input for ${actor.id}: ${dispatchError.message}`, dispatchError);
        }

        // 2. Process Command (with try/catch/finally for promise resolution and cleanup)
        try {
            // 2a. Log Intent
            this.#logger.info(`PlayerTurnHandler: Attempting to process command "${commandString}" for actor ${actor.id} via ICommandProcessor.`);

            // 2b. (Placeholder) Call Command Processor
            const processPromise = this.#commandProcessor.processCommand(actor, commandString);
            this.#logger.debug(`PlayerTurnHandler: Waiting for command processor result...`);

            // 2c. (Placeholder) Await Result
            /** @type {CommandProcessingResult} */ // Placeholder type
            const result = await processPromise;

            // 2d. (Placeholder) Basic Logging based on Result
            // Replace this with actual result checking when CommandProcessingResult structure is known
            this.#logger.info(`PlayerTurnHandler: Command processed for actor ${actor.id}. Placeholder result: ${JSON.stringify(result)}`);
            // Example of potential future logic:
            // if (result && result.success) {
            //     this.#logger.info(`PlayerTurnHandler: Command processed successfully for actor ${actor.id}.`);
            // } else {
            //     this.#logger.warn(`PlayerTurnHandler: Command processing failed or returned non-success for actor ${actor.id}. Result: ${JSON.stringify(result)}`);
            //     // Optionally throw an error here if a non-success result should reject the turn
            //     // throw new Error(result?.message || 'Command processing indicated failure.');
            // }

            // 2e. Signal Successful Turn Completion
            this.#logger.info(`PlayerTurnHandler: Signaling successful turn completion for actor ${actor.id}.`);
            if (this.#turnPromiseResolve) {
                this.#turnPromiseResolve();
            } else {
                this.#logger.error(`PlayerTurnHandler: #turnPromiseResolve was null when trying to resolve turn for ${actor.id}. This should not happen.`);
            }

        } catch (error) {
            // 3a. Log Error
            this.#logger.error(`PlayerTurnHandler: Error during command processing for actor ${actor.id}, command "${commandString}": ${error.message}`, error);

            // 3b. (Optional) Dispatch Error Message to UI
            try {
                await this.#validatedEventDispatcher.dispatchValidated('display:message', {
                    message: `Error processing command: ${error.message}`,
                    recipientEntityId: actor.id // Send only to the relevant player
                    // TODO: Add message type/level if the schema supports it (e.g., 'error')
                });
            } catch (dispatchError) {
                this.#logger.error(`PlayerTurnHandler: Failed to dispatch error message to UI for actor ${actor.id}: ${dispatchError.message}`, dispatchError);
            }

            // 3c. Signal Failed Turn Completion
            this.#logger.info(`PlayerTurnHandler: Signaling failed turn completion for actor ${actor.id}.`);
            if (this.#turnPromiseReject) {
                this.#turnPromiseReject(error);
            } else {
                this.#logger.error(`PlayerTurnHandler: #turnPromiseReject was null when trying to reject turn for ${actor.id}. This should not happen.`);
            }

        } finally {
            // 4. Call Cleanup Method
            this.#logger.debug(`PlayerTurnHandler: Executing cleanup for turn of actor ${actor.id}.`);
            this.#_cleanupTurn();
        }
    }


    /**
     * Initiates the sequence to discover actions and enable player input.
     * @private
     * @param {Entity} actor - The player entity.
     * @returns {Promise<void>}
     */
    async #_initiatePlayerActionSequence(actor) {
        this.#logger.debug(`PlayerTurnHandler: Initiating action sequence for ${actor.id}.`);
        // try/catch moved to the caller (handleTurn) to handle cleanup centrally
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
     * @throws {Error} If context construction or action discovery fails.
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
                await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', {
                    actions: [], // Send empty actions on error
                    entityId: actor.id
                });
            } catch (dispatchError) {
                this.#logger.error(`PlayerTurnHandler: Failed to dispatch empty actions after error for ${actor.id}: ${dispatchError.message}`, dispatchError);
            }
            throw error; // Rethrow to ensure the sequence initiation fails
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
            throw error; // Rethrow to ensure the sequence initiation fails
        }
    }


    /**
     * Cleans up resources and resets state associated with the current turn.
     * This includes unsubscribing from temporary event listeners.
     * Should be called before resolving or rejecting the turn promise.
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

        // Note: The 'command:submit' subscription is persistent (from constructor)
        // and is filtered internally by #handleSubmittedCommand based on #currentActor.
        // It should only be unsubscribed in a general teardown/destroy method.
        this.#logger.debug(`PlayerTurnHandler: Turn state reset for actor ${actorId}.`);
    }

    /**
     * Gracefully shuts down the handler, unsubscribing from persistent listeners.
     * Should be called when the game engine is shutting down or the handler is being replaced.
     * @public // Or adjust visibility as needed
     */
    destroy() {
        this.#logger.info(`PlayerTurnHandler: Destroying handler and unsubscribing from events.`);
        if (this.#commandSubmitSubscriptionHandle) {
            try {
                this.#eventBus.unsubscribe(this.#commandSubmitSubscriptionHandle);
                this.#logger.debug(`PlayerTurnHandler: Unsubscribed from command:submit.`);
            } catch (unsubscribeError) {
                this.#logger.error(`PlayerTurnHandler: Error unsubscribing from command:submit: ${unsubscribeError.message}`, unsubscribeError);
            }
            this.#commandSubmitSubscriptionHandle = null;
        }
        // Add cleanup for any other persistent resources or subscriptions here.

        // Ensure any lingering turn state is cleared, though it shouldn't exist if cleanup was called.
        if (this.#currentActor) {
            this.#logger.warn(`PlayerTurnHandler: Destroying handler while a turn for ${this.#currentActor.id} was potentially active. Forcing cleanup.`);
            this.#_cleanupTurn();
        }
    }

}

export default PlayerTurnHandler;
