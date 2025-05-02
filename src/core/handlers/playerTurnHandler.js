// src/core/handlers/playerTurnHandler.js
// --- FILE START (Entire file content as requested) ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/./IWorldContext.js').IWorldContext} IGameStateManager */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */ // Adjusted path
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {{ command: string }} CommandSubmitEventData */ // Received event
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */ // Result from CommandProcessor
/** @typedef {{type: string, payload: CommandSubmitEventData}} CommandSubmitEvent */ // EventBus structure
/** @typedef {(event: CommandSubmitEvent | CommandSubmitEventData) => Promise<void>} CommandSubmitListener */
/** @typedef {import('../../actions/actionTypes.js').ActionDefinitionMinimal} ActionDefinitionMinimal */ // For available actions list

/**
 * @class PlayerTurnHandler
 * @extends ITurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic for player-controlled entities. Waits for 'command:submit' events,
 * processes commands via CommandProcessor, and dispatches semantic events like 'core:player_turn_prompt'
 * and 'core:turn_ended'. Does NOT dispatch UI-specific events.
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

    /** @type {Entity | null} */
    #currentActor = null;
    /** @type {Promise<void> | null} */
    #turnPromise = null;
    /** @type {((value: void | PromiseLike<void>) => void) | null} */
    #turnPromiseResolve = null;
    /** @type {((reason?: any) => void) | null} */
    #turnPromiseReject = null;

    /**
     * Stores the reference to the bound event listener function for 'command:submit'.
     * @private
     * @type {CommandSubmitListener | null}
     */
    #commandSubmitListener = null;

    /**
     * Creates an instance of PlayerTurnHandler.
     * @param {object} dependencies - The dependencies required by the handler.
     * @param {ILogger} dependencies.logger
     * @param {IActionDiscoverySystem} dependencies.actionDiscoverySystem
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {ICommandProcessor} dependencies.commandProcessor
     * @param {IGameStateManager} dependencies.gameStateManager
     * @param {EntityManager} dependencies.entityManager
     * @param {GameDataRepository} dependencies.gameDataRepository
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
                }) {
        super();

        // Inject and assign logger first
        if (!logger || typeof logger.error !== 'function') {
            console.error('PlayerTurnHandler Constructor: Invalid or missing logger dependency.');
            throw new Error('PlayerTurnHandler: Invalid or missing logger dependency.');
        }
        this.#logger = logger;

        // Validate and assign other dependencies
        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            this.#logger.error('PlayerTurnHandler Constructor: Invalid or missing actionDiscoverySystem.');
            throw new Error('PlayerTurnHandler: Invalid or missing actionDiscoverySystem.');
        }
        this.#actionDiscoverySystem = actionDiscoverySystem;

        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function' || typeof validatedEventDispatcher.subscribe !== 'function' || typeof validatedEventDispatcher.unsubscribe !== 'function') {
            this.#logger.error('PlayerTurnHandler Constructor: Invalid or missing validatedEventDispatcher (requires dispatchValidated, subscribe, unsubscribe).');
            throw new Error('PlayerTurnHandler: Invalid or missing validatedEventDispatcher.');
        }
        this.#validatedEventDispatcher = validatedEventDispatcher;

        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            this.#logger.error('PlayerTurnHandler Constructor: Invalid or missing commandProcessor.');
            throw new Error('PlayerTurnHandler: Invalid or missing commandProcessor.');
        }
        this.#commandProcessor = commandProcessor;

        if (!gameStateManager || typeof gameStateManager.getLocationOfEntity !== 'function' || typeof gameStateManager.getCurrentLocation !== 'function') {
            this.#logger.error('PlayerTurnHandler Constructor: Invalid or missing gameStateManager (requires relevant methods like getLocationOfEntity).');
            throw new Error('PlayerTurnHandler: Invalid or missing gameStateManager.');
        }
        this.#gameStateManager = gameStateManager;

        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            this.#logger.error('PlayerTurnHandler Constructor: Invalid or missing entityManager (requires getEntityInstance method).');
            throw new Error('PlayerTurnHandler: Invalid or missing entityManager.');
        }
        this.#entityManager = entityManager;

        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') {
            this.#logger.error('PlayerTurnHandler Constructor: Invalid or missing gameDataRepository.');
            throw new Error('PlayerTurnHandler: Invalid or missing gameDataRepository.');
        }
        this.#gameDataRepository = gameDataRepository;

        // Subscribe to command submission events using VED
        this.#commandSubmitListener = (eventData) => this.#handleSubmittedCommand(eventData);

        try {
            this.#validatedEventDispatcher.subscribe('command:submit', this.#commandSubmitListener);
            this.#logger.debug('PlayerTurnHandler initialized successfully and subscribed to command:submit via VED.');
        } catch (subError) {
            this.#logger.error(`PlayerTurnHandler: Failed to subscribe to command:submit via VED: ${subError.message}`, subError);
            throw new Error(`PlayerTurnHandler: Failed to subscribe to VED event 'command:submit'.`);
        }
    }

    /**
     * Initiates the turn handling sequence for a player actor.
     * Sets up a promise that resolves only when a turn-ending command is successfully processed.
     * Dispatches 'core:player_turn_prompt'.
     * @param {Entity} actor - The player entity taking its turn.
     * @returns {Promise<void>} A promise that resolves when the player's turn is fully completed, or rejects on critical error.
     * @throws {Error} If the actor is invalid or if a turn is already in progress for another actor.
     */
    async handleTurn(actor) {
        const actorId = actor?.id || 'UNKNOWN';
        this.#logger.info(`PlayerTurnHandler: Starting turn handling for actor ${actorId}.`);

        if (!actor || !actor.id) { // Check actor.id as well
            this.#logger.error('PlayerTurnHandler: Attempted to handle turn for an invalid actor.');
            throw new Error('PlayerTurnHandler: Actor must be a valid entity.');
        }

        if (this.#currentActor) {
            const errorMsg = `PlayerTurnHandler: Attempted to start a new turn for ${actor.id} while turn for ${this.#currentActor.id} is already in progress.`;
            this.#logger.error(errorMsg);
            throw new Error(errorMsg); // Prevent concurrent turns
        }

        this.#currentActor = actor;

        // Create the promise that TurnManager will await
        this.#turnPromise = new Promise((resolve, reject) => {
            this.#turnPromiseResolve = resolve;
            this.#turnPromiseReject = reject;
        });

        try {
            // Discover actions and prompt the player for input.
            // This does NOT resolve the promise; resolution happens in _processValidatedCommand.
            await this.#_promptPlayerForAction(actor);
            this.#logger.debug(`PlayerTurnHandler: Initial prompt dispatched for ${actor.id}. Waiting for command input.`);
            // Return the promise for TurnManager to await
            return this.#turnPromise;
        } catch (initError) {
            this.#logger.error(`PlayerTurnHandler: Error during turn initiation/prompt for ${actor.id}: ${initError.message}`, initError);
            // If initiation fails, reject the promise immediately and clean up.
            if (this.#turnPromiseReject) {
                this.#turnPromiseReject(initError);
            } else {
                this.#logger.error(`PlayerTurnHandler: Turn promise rejector not available during initiation error for ${actor.id}!`);
            }
            await this.#_handleTurnEnd(actor.id, initError); // Dispatch turn_ended and cleanup on error
            // Do not re-throw; rejection handles the error flow to TurnManager
        }
    }

    /**
     * Handles the 'command:submit' event received via VED.
     * Validates the command and delegates to processing if a turn is active.
     * @private
     * @param {CommandSubmitEvent | CommandSubmitEventData} eventData - The event data.
     * @returns {Promise<void>}
     */
    async #handleSubmittedCommand(eventData) {
        const payload = /** @type {CommandSubmitEventData} */ (eventData?.payload ?? eventData);
        const commandString = payload?.command?.trim(); // Trim received command

        this.#logger.debug(`PlayerTurnHandler: Received command:submit event. Payload: ${JSON.stringify(payload)}`);

        if (!this.#currentActor) {
            this.#logger.warn(`PlayerTurnHandler: Received command:submit but no player turn is active. Ignoring.`);
            return; // No active turn, do nothing.
        }

        if (!commandString) {
            this.#logger.warn(`PlayerTurnHandler: Received command:submit with empty command string. Re-prompting actor ${this.#currentActor.id}.`);
            // Re-prompt the player if they send an empty command.
            try {
                await this.#_promptPlayerForAction(this.#currentActor);
            } catch (promptError) {
                this.#logger.error(`PlayerTurnHandler: Failed to re-prompt player ${this.#currentActor.id} after empty command: ${promptError.message}`, promptError);
                // If re-prompting fails critically, end the turn with an error
                await this.#_handleTurnEnd(this.#currentActor.id, promptError, true); // Signal turn end on critical prompt error
            }
            return; // Don't process empty commands
        }

        // Process the validated command string.
        this.#logger.info(`PlayerTurnHandler: Handling command "${commandString}" for current actor ${this.#currentActor.id}.`);
        await this.#_processValidatedCommand(this.#currentActor, commandString);
    }

    /**
     * Processes a non-empty command string submitted by the player actor.
     * Calls CommandProcessor and handles the result to determine if the turn ends
     * or if the player should be prompted again. Dispatches 'core:turn_ended' or
     * 'core:system_error_occurred' on critical failures.
     * @private
     * @param {Entity} actor - The actor performing the command.
     * @param {string} commandString - The validated, non-empty command string.
     * @returns {Promise<void>}
     */
    async #_processValidatedCommand(actor, commandString) {
        const actorId = actor.id;

        if (!this.#turnPromiseResolve || !this.#turnPromiseReject) {
            this.#logger.error(`PlayerTurnHandler: #_processValidatedCommand called for ${actorId} but turn promise functions are not set! Cleaning up.`);
            await this.#_handleTurnEnd(actorId, new Error("Internal state error: turn promise lost.")); // Dispatch turn_ended & cleanup
            return; // Avoid further processing
        }

        this.#logger.debug(`PlayerTurnHandler: Processing validated command "${commandString}" for ${actorId}.`);
        // REMOVED: Dispatch 'textUI:disable_input'

        try {
            this.#logger.info(`PlayerTurnHandler: Delegating command "${commandString}" for ${actorId} to ICommandProcessor...`);
            /** @type {CommandResult} */
            const result = await this.#commandProcessor.processCommand(actor, commandString);

            this.#logger.info(
                `PlayerTurnHandler: CommandProcessor result for ${actorId} command "${commandString}": ` +
                `Success=${result.success}, TurnEnded=${result.turnEnded}, ActionResult=${!!result.actionResult}.`
            );

            // --- Handle CommandResult ---
            if (result.turnEnded) {
                // SUCCESS/FAILURE + TURN ENDS: Signal turn end and clean up state.
                // CommandProcessor already dispatched action_executed/action_failed/command_parse_failed.
                this.#logger.info(`PlayerTurnHandler: Command resulted in turn end for ${actorId}.`);
                await this.#_handleTurnEnd(actorId); // Dispatch turn_ended, resolve promise, cleanup

            } else {
                // SUCCESS/FAILURE + TURN CONTINUES: Re-prompt the player.
                // CommandProcessor already dispatched relevant failure events if applicable (e.g., parse failed).
                this.#logger.info(`PlayerTurnHandler: Command did NOT end turn for ${actorId}. Re-prompting.`);
                await this.#_promptPlayerForAction(actor); // Ask for next command
            }

        } catch (criticalError) {
            // --- Handle Critical Processing Errors ---
            this.#logger.error(
                `PlayerTurnHandler: CRITICAL error during command processing delegation for ${actorId} command "${commandString}": ${criticalError.message}`,
                criticalError
            );

            // Dispatch system error event (best effort)
            try {
                await this.#validatedEventDispatcher.dispatchValidated('core:system_error_occurred', {
                    message: `An internal error occurred while processing command for ${actorId}.`,
                    type: 'error',
                    details: criticalError.message
                });
            } catch (dispatchErr) {
                this.#logger.error(`PlayerTurnHandler: Failed to dispatch critical error message via VED for ${actorId}: ${dispatchErr.message}`, dispatchErr);
            }

            // Signal failed turn end, reject the promise, and clean up.
            this.#logger.info(`PlayerTurnHandler: Signalling FAILED turn end for ${actorId} due to critical error.`);
            await this.#_handleTurnEnd(actorId, criticalError, true); // Dispatch turn_ended, reject promise, cleanup
        }
    }

    /**
     * Discovers available actions and dispatches the 'core:player_turn_prompt' event.
     * @private
     * @param {Entity} actor - The player actor.
     * @returns {Promise<void>}
     * @throws {Error} If action discovery or dispatching the prompt event fails critically.
     */
    async #_promptPlayerForAction(actor) {
        const actorId = actor.id;
        this.#logger.debug(`PlayerTurnHandler: Preparing prompt for ${actorId}. Discovering actions...`);
        let availableActions = [];

        try {
            // Discover Actions
            const currentLocation = await this.#gameStateManager.getLocationOfEntity(actor);
            if (!currentLocation) {
                throw new Error(`Could not determine current location for actor ${actorId}`);
            }

            /** @type {ActionContext} */
            const context = {
                actingEntity: actor,
                currentLocation: currentLocation,
                entityManager: this.#entityManager,
                gameDataRepository: this.#gameDataRepository,
                logger: this.#logger, // Pass logger for potential use in discovery logic
                gameStateManager: this.#gameStateManager,
                // dispatch: Not typically needed for discovery, handled by CommandProcessor/ActionExecutor
            };

            // Assuming getValidActions returns ActionDefinitionMinimal[] or similar
            availableActions = await this.#actionDiscoverySystem.getValidActions(actor, context);
            this.#logger.debug(`PlayerTurnHandler: Discovered ${availableActions.length} actions for ${actorId}.`);

            // --- SEMANTIC EVENT DISPATCH: core:player_turn_prompt ---
            await this.#validatedEventDispatcher.dispatchValidated('core:player_turn_prompt', {
                entityId: actorId,
                availableActions: availableActions.map(a => a.id) // Send only action IDs based on schema
                // Consider sending more action details if schema allows and UI needs it
            });
            this.#logger.debug(`PlayerTurnHandler: Dispatched core:player_turn_prompt for ${actorId}.`);
            // --- END SEMANTIC EVENT DISPATCH ---

        } catch (error) {
            this.#logger.error(`PlayerTurnHandler: Error during action discovery or prompting for ${actorId}: ${error.message}`, error);
            // Attempt to dispatch prompt with empty actions on error (best effort)
            try {
                await this.#validatedEventDispatcher.dispatchValidated('core:player_turn_prompt', {
                    entityId: actorId,
                    availableActions: []
                });
                this.#logger.warn(`Dispatched core:player_turn_prompt with empty actions due to error for ${actorId}.`);
            } catch (dispatchError) {
                this.#logger.error(`PlayerTurnHandler: Failed to dispatch empty prompt after error for ${actorId}: ${dispatchError.message}`, dispatchError);
            }
            // Re-throw the original error to be handled by the caller (handleTurn or _processValidatedCommand)
            throw error;
        }
    }

    /**
     * Centralized method to handle the end of a player's turn.
     * Dispatches 'core:turn_ended', resolves or rejects the turn promise, and cleans up state.
     * @private
     * @param {string} actorId - The ID of the actor whose turn is ending.
     * @param {any} [rejectionReason] - If provided, the turn promise is rejected with this reason. Otherwise, it's resolved.
     * @param {boolean} [isError=false] - Flag indicating if the turn ended due to an error.
     * @returns {Promise<void>}
     */
    async #_handleTurnEnd(actorId, rejectionReason = null, isError = false) {
        this.#logger.info(`PlayerTurnHandler: Ending turn for actor ${actorId}${isError ? ' due to error' : ''}.`);

        // --- SEMANTIC EVENT DISPATCH: core:turn_ended ---
        try {
            await this.#validatedEventDispatcher.dispatchValidated('core:turn_ended', { entityId: actorId });
            this.#logger.debug(`Dispatched core:turn_ended for ${actorId}.`);
        } catch (dispatchError) {
            this.#logger.error(`PlayerTurnHandler: Failed to dispatch core:turn_ended for ${actorId}: ${dispatchError.message}`, dispatchError);
            // Log error but continue cleanup
        }
        // --- END SEMANTIC EVENT DISPATCH ---

        // Resolve or Reject the promise
        if (rejectionReason && this.#turnPromiseReject) {
            this.#logger.warn(`PlayerTurnHandler: Rejecting turn promise for ${actorId}. Reason: ${rejectionReason?.message || rejectionReason}`);
            this.#turnPromiseReject(rejectionReason);
        } else if (this.#turnPromiseResolve) {
            this.#logger.debug(`PlayerTurnHandler: Resolving turn promise for ${actorId}.`);
            this.#turnPromiseResolve();
        } else {
            this.#logger.error(`PlayerTurnHandler: Cannot resolve/reject turn promise for ${actorId} - handlers missing!`);
        }

        // Cleanup internal state
        this.#_cleanupTurnState(actorId);
    }


    /**
     * Resets the internal state associated with the current turn.
     * Called by #_handleTurnEnd.
     * @private
     * @param {string} actorId - ID for logging purposes.
     */
    #_cleanupTurnState(actorId) {
        this.#logger.debug(`PlayerTurnHandler: Cleaning up turn state for actor ${actorId}.`);
        this.#currentActor = null;
        this.#turnPromise = null;
        this.#turnPromiseResolve = null;
        this.#turnPromiseReject = null;
        this.#logger.debug(`PlayerTurnHandler: Turn state reset for actor ${actorId}.`);
    }

    /**
     * Gracefully shuts down the handler, unsubscribing from VED listeners.
     * @public
     */
    destroy() {
        const handlerId = this.constructor.name;
        this.#logger.info(`${handlerId}: Destroying handler and unsubscribing...`);

        // Unsubscribe via VED
        if (this.#commandSubmitListener) {
            try {
                this.#validatedEventDispatcher.unsubscribe('command:submit', this.#commandSubmitListener);
                this.#logger.debug(`${handlerId}: Unsubscribed from command:submit via VED.`);
            } catch (unsubscribeError) {
                this.#logger.error(`${handlerId}: Error unsubscribing from command:submit via VED: ${unsubscribeError.message}`, unsubscribeError);
            }
            this.#commandSubmitListener = null;
        }

        // Handle case where destroy is called mid-turn
        if (this.#currentActor) {
            const actorId = this.#currentActor.id;
            this.#logger.warn(`${handlerId}: Destroying handler while turn for ${actorId} was active. Forcing cleanup and rejection.`);
            // Use the centralized end turn handler to ensure event dispatch and proper cleanup
            this.#_handleTurnEnd(actorId, new Error(`${handlerId} destroyed during turn.`), true).catch(err => {
                this.#logger.error(`${handlerId}: Error during forced turn end on destroy: ${err.message}`, err);
            });
        } else {
            this.#logger.info(`${handlerId}: Destruction complete.`);
        }
    }
}

export default PlayerTurnHandler;
// --- FILE END ---