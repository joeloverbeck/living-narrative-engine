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
        // ... (existing validations for actionDiscoverySystem, validatedEventDispatcher, commandProcessor) ...
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
            this.#handleSubmittedCommand.bind(this)
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
        this.#turnPromise = new Promise((resolve, reject) => {
            this.#turnPromiseResolve = resolve;
            this.#turnPromiseReject = reject;
        });

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
        this.#logger.info(`PlayerTurnHandler: Received valid command "${commandString}" for current actor ${this.#currentActor.id}.`);

        // Task 3.5.1: Call the next processing step (to be implemented in Ticket 3.1.5)
        try {
            // This method will eventually contain the logic from Ticket 3.1.5
            // and will be responsible for calling this.#turnPromiseResolve() or this.#turnPromiseReject()
            // after processing is complete (potentially asynchronously).
            // Crucially, it should call #_cleanupTurn() *before* resolving/rejecting.
            await this.#_processValidatedCommand(this.#currentActor, commandString);

            // For now, assume immediate success for placeholder purposes.
            // IN REAL IMPLEMENTATION (Ticket 3.1.5):
            // The CommandProcessor interaction will likely be async.
            // The resolution/rejection should happen based on CommandProcessor's result.
            // this.#_cleanupTurn() MUST be called before resolve/reject.

            // --- Placeholder Resolution ---
            // this.#logger.debug(`PlayerTurnHandler: Placeholder - Command processed successfully.`);
            // this.#_cleanupTurn(); // Call cleanup BEFORE resolving
            // if (this.#turnPromiseResolve) this.#turnPromiseResolve();
            // --- End Placeholder ---

        } catch (error) {
            this.#logger.error(`PlayerTurnHandler: Error processing command "${commandString}" for actor ${this.#currentActor.id}: ${error.message}`, error);
            // Ensure cleanup happens even if processing fails
            this.#_cleanupTurn(); // Call cleanup BEFORE rejecting
            if (this.#turnPromiseReject) {
                this.#turnPromiseReject(error);
            }
            // Optionally, rethrow or handle error further
        }
    }

    /**
     * Processes a command that has been validated to belong to the current actor.
     * (Implementation details deferred to Ticket 3.1.5)
     * This method is expected to interact with the CommandProcessor and eventually
     * resolve or reject the main #turnPromise, calling #_cleanupTurn beforehand.
     * @private
     * @param {Entity} actor - The actor whose command is being processed.
     * @param {string} commandString - The raw command string to process.
     * @returns {Promise<void>} A promise that resolves/rejects when command processing is complete.
     */
    async #_processValidatedCommand(actor, commandString) {
        this.#logger.debug(`PlayerTurnHandler: #_processValidatedCommand called for ${actor.id} with command "${commandString}". (Implementation pending Ticket 3.1.5)`);
        // --- TODO (Ticket 3.1.5) ---
        // 1. Parse the commandString using CommandParser.
        // 2. Resolve targets using TargetResolutionService.
        // 3. Validate the action using ActionValidationService.
        // 4. Execute the action using ActionExecutor.
        // 5. Based on success/failure:
        //    - Call #_cleanupTurn()
        //    - Call this.#turnPromiseResolve() or this.#turnPromiseReject()
        // --- Placeholder ---
        return new Promise(resolve => {
            this.#logger.warn("PlayerTurnHandler: #_processValidatedCommand is a placeholder. Simulating successful command processing.");
            // Simulate async work
            setTimeout(() => {
                try {
                    // --- Simulate Success Path ---
                    this.#logger.debug(`PlayerTurnHandler: Placeholder - Simulating command processed successfully.`);
                    this.#_cleanupTurn(); // Call cleanup BEFORE resolving
                    if (this.#turnPromiseResolve) this.#turnPromiseResolve();
                    resolve(); // Resolve the inner promise
                } catch (e) {
                    // This catch might not be strictly necessary if cleanup/reject handle errors
                    this.#logger.error(`Error during placeholder resolution: ${e.message}`);
                    // Ensure rejection if something goes wrong here
                    if (this.#turnPromiseReject) this.#turnPromiseReject(e);
                }
            }, 10); // Simulate a tiny delay
        });
        // --- End Placeholder ---
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
            await this.#validatedEventDispatcher.dispatchValidated('event:update_available_actions', {
                actions: [], // Send empty actions on error
                entityId: actor.id
            });
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
        const actorId = this.#currentActor?.id || 'UNKNOWN';
        this.#logger.debug(`PlayerTurnHandler: Cleaning up turn state for actor ${actorId}.`);

        // Unsubscribe from command:submit (Task 6)
        // Note: We only unsubscribe *this specific handler's* subscription.
        // The main subscription in the constructor remains for subsequent turns.
        // EDIT: Rereading the ticket - "unsubscribe... when the handler is destroyed OR the turn ends".
        // This implies the subscription might be intended to be *per turn*.
        // Let's adjust: Subscribe in handleTurn, unsubscribe in cleanup.
        // No, the current approach (subscribe in constructor, validate actor in handler) is more robust.
        // The cleanup task likely meant unsubscribing from *temporary* listeners if any were added *during* the turn.
        // Since command:submit is the core mechanism, let's keep the constructor subscription.
        // If specific *per-turn* subscriptions were needed, they'd be handled here.
        // Let's assume the ticket meant ensuring the *handler* cleans up its own general listeners on destruction,
        // and manages its *state* correctly between turns.
        // Re-interpreting Task 6: Ensure turn-specific state is reset. If the handler itself were destroyed,
        // it would need a general `destroy()` method to unsubscribe from constructor-level listeners.
        // Let's stick to resetting turn state here as the primary goal for end-of-turn cleanup.

        this.#logger.debug(`PlayerTurnHandler: Resetting turn state for actor ${this.#currentActor?.id}.`);
        this.#currentActor = null;
        this.#turnPromise = null; // Let GC handle the promise itself
        this.#turnPromiseResolve = null;
        this.#turnPromiseReject = null;
        // Do NOT unsubscribe here if subscription is done in the constructor for the handler's lifetime.
        // If a separate destroy() method is added later, unsubscribe there.
    }

    /**
     * Gracefully shuts down the handler, unsubscribing from persistent listeners.
     * Should be called when the game engine is shutting down or the handler is being replaced.
     * @public // Or adjust visibility as needed
     */
    destroy() {
        this.#logger.info(`PlayerTurnHandler: Destroying handler and unsubscribing from events.`);
        if (this.#commandSubmitSubscriptionHandle) {
            this.#eventBus.unsubscribe(this.#commandSubmitSubscriptionHandle);
            this.#commandSubmitSubscriptionHandle = null;
            this.#logger.debug(`PlayerTurnHandler: Unsubscribed from command:submit.`);
        }
        // Add cleanup for any other persistent resources or subscriptions here.
        this.#resetTurnState(); // Ensure state is clean
    }

    // TODO: Add methods to be called by the command processor (or via events) - Now handled by #_processValidatedCommand
    // to resolve or reject the #turnPromise in Tickets 3.1.4 / 3.1.5.
    // e.g., _onCommandProcessedSuccessfully(), _onCommandProcessingFailed()
    // These methods should call #turnPromiseResolve() or #turnPromiseReject()
    // and then call #_cleanupTurn(). -> This logic is now intended inside #_processValidatedCommand
}

export default PlayerTurnHandler;