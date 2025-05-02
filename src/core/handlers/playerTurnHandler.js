// src/core/handlers/playerTurnHandler.js
// --- FILE START (Entire file content as requested) ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/./IWorldContext.js').IWorldContext} IWorldContext */
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
    /** @type {IWorldContext} */
    #worldContext;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameDataRepository} */
    #gameDataRepository;

    /** @type {Entity | null} */
    #currentActor = null;
    /** @type {Promise<void> | null} */
    #turnPromise = null; // Internal reference, managed by the handler
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
     * @param {IWorldContext} dependencies.worldContext
     * @param {EntityManager} dependencies.entityManager
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({
                    logger,
                    actionDiscoverySystem,
                    validatedEventDispatcher,
                    commandProcessor,
                    worldContext,
                    entityManager,
                    gameDataRepository,
                }) {
        super();

        // Inject and assign logger first
        if (!logger || typeof logger.error !== 'function') {
            // Avoid console.error in constructor for testability if logger is the dep being tested
            // Rely on the thrown Error.
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

        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function' || typeof worldContext.getCurrentLocation !== 'function') {
            this.#logger.error('PlayerTurnHandler Constructor: Invalid or missing worldContext (requires relevant methods like getLocationOfEntity).');
            throw new Error('PlayerTurnHandler: Invalid or missing worldContext.');
        }
        this.#worldContext = worldContext;

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

        // --- Initial validation checks ---
        if (!actor || !actor.id) {
            this.#logger.error('PlayerTurnHandler: Attempted to handle turn for an invalid actor.');
            throw new Error('PlayerTurnHandler: Actor must be a valid entity.');
        }
        if (this.#currentActor) {
            const errorMsg = `PlayerTurnHandler: Attempted to start a new turn for ${actor.id} while turn for ${this.#currentActor.id} is already in progress.`;
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        // --- End initial validation ---

        this.#currentActor = actor; // Set current actor

        // --- Create the promise for the caller ---
        const promiseForCaller = new Promise((resolve, reject) => {
            this.#turnPromiseResolve = resolve;
            this.#turnPromiseReject = reject;
        });
        this.#turnPromise = promiseForCaller; // Assign internal reference
        // --- End promise creation ---

        try {
            // Attempt to discover actions and dispatch the initial prompt
            await this.#_promptPlayerForAction(actor);
            this.#logger.debug(`PlayerTurnHandler: Initial prompt dispatched for ${actor.id}. Waiting for command input.`);
        } catch (initError) {
            // If #_promptPlayerForAction threw an error
            this.#logger.error(`PlayerTurnHandler: Error during turn initiation/prompt for ${actor.id}: ${initError.message}`, initError);
            // Ensure the turn ends and the promise is rejected.
            await this.#_handleTurnEnd(actor.id, initError, true);
            // Do not re-throw initError here. The rejection of promiseForCaller is sufficient.
        }

        // --- Return the promise ---
        return promiseForCaller;
        // --- End return ---
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

        // --- Check if a turn is active FOR THIS HANDLER INSTANCE ---
        const currentActorAtStart = this.#currentActor; // Capture current actor state
        if (!currentActorAtStart) {
            this.#logger.warn(`PlayerTurnHandler: Received command:submit but no player turn is active. Ignoring.`);
            return;
        }
        const actorId = currentActorAtStart.id;

        // Ensure turn promise functions are still set
        if (!this.#turnPromiseResolve || !this.#turnPromiseReject) {
            this.#logger.error(`PlayerTurnHandler: Command submitted for ${actorId}, but turn promise functions are missing. Turn might be ending or destroyed.`);
            return;
        }
        // --- End checks ---

        if (!commandString) {
            this.#logger.warn(`PlayerTurnHandler: Received command:submit with empty command string. Re-prompting actor ${actorId}.`);
            try {
                // Ensure the actor hasn't changed mid-check
                if (this.#currentActor && this.#currentActor.id === actorId) {
                    await this.#_promptPlayerForAction(this.#currentActor);
                } else {
                    this.#logger.warn(`PlayerTurnHandler: Actor changed before re-prompting for empty command for ${actorId}. Aborting.`);
                }
            } catch (promptError) {
                this.#logger.error(`PlayerTurnHandler: Failed to re-prompt player ${actorId} after empty command: ${promptError.message}`, promptError);
                // Check state before ending turn
                if (this.#currentActor && this.#currentActor.id === actorId) {
                    await this.#_handleTurnEnd(actorId, promptError, true);
                }
            }
            return; // Don't process empty commands
        }

        // Process the validated command string, passing the actor object we know was current at the start
        this.#logger.info(`PlayerTurnHandler: Handling command "${commandString}" for current actor ${actorId}.`);
        await this.#_processValidatedCommand(currentActorAtStart, commandString);
    }

    /**
     * Processes a non-empty command string submitted by the player actor.
     * Calls CommandProcessor and handles the result to determine if the turn ends
     * or if the player should be prompted again. Dispatches 'core:turn_ended' or
     * 'core:system_error_occurred' on critical failures.
     * @private
     * @param {Entity} actor - The actor performing the command (captured at start of submit handling).
     * @param {string} commandString - The validated, non-empty command string.
     * @returns {Promise<void>}
     */
    async #_processValidatedCommand(actor, commandString) {
        const actorId = actor.id;

        // Check if the turn for this actor is still the active one for this handler.
        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            this.#logger.warn(`PlayerTurnHandler: #_processValidatedCommand called for ${actorId}, but current actor is ${this.#currentActor?.id || 'null'}. Aborting processing.`);
            return;
        }
        // Double check promise functions haven't been cleared yet.
        if (!this.#turnPromiseResolve || !this.#turnPromiseReject) {
            this.#logger.error(`PlayerTurnHandler: #_processValidatedCommand called for ${actorId} but turn promise functions are not set! Turn might have already ended.`);
            return;
        }

        this.#logger.debug(`PlayerTurnHandler: Processing validated command "${commandString}" for ${actorId}.`);

        try {
            this.#logger.info(`PlayerTurnHandler: Delegating command "${commandString}" for ${actorId} to ICommandProcessor...`);
            const result = await this.#commandProcessor.processCommand(actor, commandString);

            // --- Re-check state AFTER await ---
            if (!this.#currentActor || this.#currentActor.id !== actorId) {
                this.#logger.warn(`PlayerTurnHandler: Turn state changed during command processing for ${actorId}. Aborting further action.`);
                return;
            }
            // --- End Re-check ---

            this.#logger.info(
                `PlayerTurnHandler: CommandProcessor result for ${actorId} command "${commandString}": ` +
                `Success=${result.success}, TurnEnded=${result.turnEnded}, ActionResult=${!!result.actionResult}.`
            );


            if (result.turnEnded) {
                this.#logger.info(`PlayerTurnHandler: Command resulted in turn end for ${actorId}.`);
                await this.#_handleTurnEnd(actorId, null); // Pass null for rejectionReason on success

            } else {
                this.#logger.info(`PlayerTurnHandler: Command did NOT end turn for ${actorId}. Re-prompting.`);
                // Re-check state before re-prompting
                if (!this.#currentActor || this.#currentActor.id !== actorId) {
                    this.#logger.warn(`PlayerTurnHandler: Turn state changed before re-prompt for ${actorId}. Aborting prompt.`);
                    return;
                }
                await this.#_promptPlayerForAction(actor); // Ask for next command
            }

        } catch (error) {
            this.#logger.error(
                `PlayerTurnHandler: Error during command processing or re-prompt for ${actorId} command "${commandString}": ${error.message}`,
                error
            );

            // Check if we are still handling the turn for this actor before attempting cleanup/rejection
            if (this.#currentActor && this.#currentActor.id === actorId) {
                try {
                    await this.#validatedEventDispatcher.dispatchValidated('core:system_error_occurred', {
                        message: `An internal error occurred while processing command or re-prompting for ${actorId}.`,
                        type: 'error',
                        details: error.message
                    });
                } catch (dispatchErr) {
                    this.#logger.error(`PlayerTurnHandler: Failed to dispatch critical error message via VED for ${actorId}: ${dispatchErr.message}`, dispatchErr);
                }

                this.#logger.info(`PlayerTurnHandler: Signalling FAILED turn end for ${actorId} due to error.`);
                // Ensure the promise is rejected
                await this.#_handleTurnEnd(actorId, error, true);
            } else {
                this.#logger.warn(`PlayerTurnHandler: Error caught for ${actorId}, but turn state seems invalid. Cannot reliably signal turn end.`);
            }
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
        // Check if the turn for this actor is still active
        if (!this.#currentActor || actor.id !== this.#currentActor.id) {
            this.#logger.warn(`PlayerTurnHandler: #_promptPlayerForAction called for actor ${actor?.id}, but current actor is ${this.#currentActor?.id}. Aborting prompt.`);
            return; // Don't throw, just exit if state is inconsistent
        }
        // Check if promise functions are still available
        if (!this.#turnPromiseResolve || !this.#turnPromiseReject) {
            this.#logger.error(`PlayerTurnHandler: #_promptPlayerForAction called for ${actor.id} but turn promise functions are not set! Turn might have ended.`);
            return;
        }

        const actorId = actor.id;
        this.#logger.debug(`PlayerTurnHandler: Preparing prompt for ${actorId}. Discovering actions...`);
        let availableActions = [];

        try {
            const currentLocation = await this.#worldContext.getLocationOfEntity(actorId);

            // --- Re-check state AFTER await ---
            if (!this.#currentActor || this.#currentActor.id !== actorId) {
                this.#logger.warn(`PlayerTurnHandler: Turn state changed during location check for ${actorId}. Aborting prompt.`);
                return;
            }
            // --- End Re-check ---

            const context = {
                actingEntity: actor,
                currentLocation: currentLocation,
                entityManager: this.#entityManager,
                gameDataRepository: this.#gameDataRepository,
                logger: this.#logger,
                worldContext: this.#worldContext,
            };

            availableActions = await this.#actionDiscoverySystem.getValidActions(actor, context);
            this.#logger.debug(`PlayerTurnHandler: Discovered ${availableActions.length} actions for ${actorId}.`);

            // --- Re-check state BEFORE dispatch ---
            if (!this.#currentActor || actor.id !== this.#currentActor.id || !this.#turnPromiseResolve) {
                this.#logger.warn(`PlayerTurnHandler: Turn state changed just before dispatching prompt for ${actorId}. Aborting dispatch.`);
                return;
            }
            // --- End Re-check ---

            await this.#validatedEventDispatcher.dispatchValidated('core:player_turn_prompt', {
                entityId: actorId,
                availableActions: availableActions.map(a => a.id)
            });
            this.#logger.debug(`PlayerTurnHandler: Dispatched core:player_turn_prompt for ${actorId}.`);

        } catch (error) {
            this.#logger.error(`PlayerTurnHandler: Error during action discovery or prompting for ${actorId}: ${error.message}`, error);

            // Check if the turn is still active for this actor before dispatching error prompt
            if (this.#currentActor && this.#currentActor.id === actorId) {
                try {
                    // Re-check state again right before dispatching error prompt
                    if (!this.#currentActor || actor.id !== this.#currentActor.id || !this.#turnPromiseResolve) {
                        this.#logger.warn(`PlayerTurnHandler: Turn state changed just before dispatching ERROR prompt for ${actorId}. Aborting dispatch.`);
                    } else {
                        await this.#validatedEventDispatcher.dispatchValidated('core:player_turn_prompt', {
                            entityId: actorId,
                            availableActions: [], // Send empty actions on error
                            error: error.message // Optionally include error info
                        });
                        this.#logger.warn(`Dispatched core:player_turn_prompt with empty actions due to error for ${actorId}.`);
                    }
                } catch (dispatchError) {
                    this.#logger.error(`PlayerTurnHandler: Failed to dispatch empty/error prompt after error for ${actorId}: ${dispatchError.message}`, dispatchError);
                }
            }
            // Re-throw the original error so it propagates to handleTurn's catch block
            throw error;
        }
    }

    /**
     * Centralized method to handle the end of a player's turn.
     * Order: Check State -> Dispatch Event -> Settle Promise -> Cleanup State.
     * Ensures cleanup happens only once per turn instance.
     * @private
     * @param {string} actorId - The ID of the actor whose turn is ending.
     * @param {any} [rejectionReason=null] - If provided, the turn promise is rejected with this reason. Otherwise, it's resolved.
     * @param {boolean} [isError=false] - Deprecated flag, use rejectionReason check.
     * @returns {Promise<void>}
     */
    async #_handleTurnEnd(actorId, rejectionReason = null) { // Removed unused isError param
        // --- Check State ---
        // Check if the turn is *currently* active for the given actorId for *this* handler instance.
        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            this.#logger.warn(`PlayerTurnHandler: #_handleTurnEnd called for ${actorId}, but current actor is ${this.#currentActor?.id || 'null'}. Turn may have already ended or belongs to another handler.`);
            return; // Exit if not the active turn for this handler
        }
        // --- End Check State ---

        const endingType = rejectionReason ? 'error' : 'normal';
        this.#logger.info(`PlayerTurnHandler: Ending turn for actor ${actorId} (${endingType}).`);

        // Keep copies of the promise handlers *before* cleanup nullifies them
        const resolve = this.#turnPromiseResolve;
        const reject = this.#turnPromiseReject;

        // --- Dispatch Event --- (Do this before settling or cleanup)
        try {
            await this.#validatedEventDispatcher.dispatchValidated('core:turn_ended', {entityId: actorId});
            this.#logger.debug(`Dispatched core:turn_ended for ${actorId}.`);
        } catch (dispatchError) {
            this.#logger.error(`PlayerTurnHandler: Failed to dispatch core:turn_ended for ${actorId}: ${dispatchError.message}`, dispatchError);
            // Continue regardless of dispatch error
        }
        // --- End Dispatch Event ---

        // --- Settle Promise --- (Use saved handlers)
        if (rejectionReason) {
            if (reject) {
                this.#logger.warn(`PlayerTurnHandler: Rejecting turn promise for ${actorId}. Reason: ${rejectionReason?.message || rejectionReason}`);
                reject(rejectionReason); // Use the saved reject function
            } else {
                // This should ideally not happen if the entry check passed, indicates potential race condition or logic error elsewhere
                this.#logger.error(`PlayerTurnHandler: Cannot reject turn promise for ${actorId} - reject handler missing despite active turn check passing!`);
            }
        } else {
            if (resolve) {
                this.#logger.debug(`PlayerTurnHandler: Resolving turn promise for ${actorId}.`);
                resolve(); // Use the saved resolve function
            } else {
                // This should ideally not happen if the entry check passed
                this.#logger.error(`PlayerTurnHandler: Cannot resolve turn promise for ${actorId} - resolve handler missing despite active turn check passing!`);
            }
        }
        // --- End Settle Promise ---

        // --- Cleanup State --- (Do this LAST for this specific turn instance)
        this.#_cleanupTurnState(actorId);
        // --- End Cleanup State ---
    }


    /**
     * Resets the internal state associated *only* with the specified active turn.
     * Should only clear state if the actorId matches the #currentActor.
     * @private
     * @param {string} actorId - ID of the actor whose state should be cleared.
     */
    #_cleanupTurnState(actorId) {
        // Only cleanup if the actorId matches the currently active actor for this handler instance
        if (this.#currentActor && this.#currentActor.id === actorId) {
            this.#logger.debug(`PlayerTurnHandler: Cleaning up turn state for actor ${actorId}.`);
            this.#currentActor = null;
            this.#turnPromise = null; // Nullify the internal reference
            this.#turnPromiseResolve = null;
            this.#turnPromiseReject = null;
            this.#logger.debug(`PlayerTurnHandler: Turn state reset for actor ${actorId}.`);
        } else {
            // If called for a different actor or when no actor is current, log it but do nothing.
            this.#logger.warn(`PlayerTurnHandler: #_cleanupTurnState called for ${actorId}, but current actor is ${this.#currentActor?.id || 'null'}. No cleanup performed by this call.`);
        }
    }

    /**
     * Gracefully shuts down the handler, unsubscribing from VED listeners.
     * If a turn is active, it rejects the turn promise and cleans up state.
     * @public
     */
    destroy() {
        const handlerId = this.constructor.name;
        this.#logger.info(`${handlerId}: Destroying handler and unsubscribing...`);
        let turnRejected = false;
        let actorIdForEvent = null; // Store actor ID if turn was active

        // --- Handle Active Turn ---
        if (this.#currentActor) {
            actorIdForEvent = this.#currentActor.id;
            this.#logger.warn(`${handlerId}: Destroying handler while turn for ${actorIdForEvent} was active. Forcing cleanup and rejection.`);
            const destructionError = new Error(`${handlerId} destroyed during turn.`);

            // Keep copy of reject handler
            const reject = this.#turnPromiseReject;

            // Perform state cleanup *immediately* in destroy, BEFORE rejecting
            this.#_cleanupTurnState(actorIdForEvent);

            // Reject the promise *after* cleanup using the saved handler
            if (reject) {
                reject(destructionError);
                turnRejected = true;
            } else {
                this.#logger.error(`${handlerId}: Cannot reject turn promise during destroy for ${actorIdForEvent} - handler missing or cleared!`);
            }

            // Dispatch turn_ended *after* rejection and cleanup, if we had an active turn ID
            if (actorIdForEvent) {
                this.#validatedEventDispatcher.dispatchValidated('core:turn_ended', {entityId: actorIdForEvent})
                    .catch(dispatchError => {
                        this.#logger.error(`${handlerId}: Failed to dispatch core:turn_ended during forced destroy cleanup for ${actorIdForEvent}: ${dispatchError.message}`, dispatchError);
                    });
            }
        }
        // --- End Handle Active Turn ---

        // --- Unsubscribe ---
        if (this.#commandSubmitListener) {
            try {
                this.#validatedEventDispatcher.unsubscribe('command:submit', this.#commandSubmitListener);
                this.#logger.debug(`${handlerId}: Unsubscribed from command:submit via VED.`);
            } catch (unsubscribeError) {
                this.#logger.error(`${handlerId}: Error unsubscribing from command:submit via VED: ${unsubscribeError.message}`, unsubscribeError);
            }
            this.#commandSubmitListener = null;
        }
        // --- End Unsubscribe ---

        // --- Final Cleanup ---
        // Ensure all internal state is nullified, even if no turn was active
        this.#currentActor = null;
        this.#turnPromise = null;
        this.#turnPromiseResolve = null;
        this.#turnPromiseReject = null;
        // --- End Final Cleanup ---

        this.#logger.info(`${handlerId}: Destruction ${turnRejected ? `completed (active turn for ${actorIdForEvent} rejected)` : 'completed'}.`);
    }
}

export default PlayerTurnHandler;
// --- FILE END ---
