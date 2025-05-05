// src/core/handlers/playerTurnHandler.js
// --- FILE START (Entire file content as requested) ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem} IActionDiscoverySystem */
/** @typedef {import('../interfaces/IActionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/./IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {{ command: string }} CommandSubmitEventData */
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */
/** @typedef {import('../../actions/actionTypes.js').ActionDefinitionMinimal} ActionDefinitionMinimal */
/** @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../services/playerPromptService.js').default} PlayerPromptService */
/** @typedef {import('../interpreters/commandOutcomeInterpreter.js').default} CommandOutcomeInterpreter */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */


// Define PlayerTurnPrompt Payload Type
/**
 * @typedef {object} PlayerTurnPromptPayload
 * @property {string} entityId - The unique ID of the player entity being prompted.
 * @property {DiscoveredActionInfo[]} availableActions - Array of objects containing valid action IDs and commands.
 * @property {string} [error] - Optional error message if prompting occurred due to an error.
 */


/**
 * @class PlayerTurnHandler
 * @extends ITurnHandler
 * @implements {ITurnHandler}
 * @description Handles the turn logic for player-controlled entities. (V2 - Event-driven turn completion).
 * Processes commands via CommandProcessor, interprets outcomes with CommandOutcomeInterpreter,
 * delegates prompting via services, and signals turn completion via ITurnEndPort.
 */
class PlayerTurnHandler extends ITurnHandler {
    // --- Private Fields ---
    /** @type {ILogger} */
    #logger;
    /** @type {IActionDiscoverySystem} */
    #actionDiscoverySystem;
    /** @type {ICommandProcessor} */
    #commandProcessor;
    /** @type {IWorldContext} */
    #worldContext;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameDataRepository} */
    #gameDataRepository;
    /** @type {IPromptOutputPort} */
    #promptOutputPort; // Kept, but PlayerPromptService is the primary interaction point now
    /** @type {ITurnEndPort} */
    #turnEndPort; // <<< Port used to signal turn completion
    /** @type {PlayerPromptService} */
    #playerPromptService;
    /** @type {CommandOutcomeInterpreter} */
    #commandOutcomeInterpreter;
    /** @type {ISafeEventDispatcher} */
    #safeEventDispatcher; // Keep for dispatching system errors if needed

    /** @type {Entity | null} */
    #currentActor = null;

    // --- REMOVED Promise Plumbing (Ticket #7) ---
    // /** @type {Promise<void> | null} */
    // #turnPromise = null;
    // /** @type {((value: void | PromiseLike<void>) => void) | null} */
    // #turnPromiseResolve = null;
    // /** @type {((reason?: any) => void) | null} */
    // #turnPromiseReject = null;
    // --- END REMOVED Promise Plumbing ---

    /**
     * Creates an instance of PlayerTurnHandler.
     * @param {object} dependencies - The dependencies required by the handler.
     * @param {ILogger} dependencies.logger
     * @param {IActionDiscoverySystem} dependencies.actionDiscoverySystem
     * @param {ICommandProcessor} dependencies.commandProcessor
     * @param {IWorldContext} dependencies.worldContext
     * @param {EntityManager} dependencies.entityManager
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {IPromptOutputPort} dependencies.promptOutputPort
     * @param {ITurnEndPort} dependencies.turnEndPort
     * @param {PlayerPromptService} dependencies.playerPromptService
     * @param {CommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter
     * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
     * @throws {Error} If required dependencies are missing or invalid.
     */
    constructor({
                    logger,
                    actionDiscoverySystem,
                    commandProcessor,
                    worldContext,
                    entityManager,
                    gameDataRepository,
                    promptOutputPort, // Keep dependency, might be needed by PlayerPromptService or directly
                    turnEndPort, // <<< Essential for new flow
                    playerPromptService,
                    commandOutcomeInterpreter,
                    safeEventDispatcher,
                }) {
        super();
        const className = this.constructor.name;

        // --- Dependency Validations (unchanged, except added turnEndPort) ---
        if (!logger || typeof logger.error !== 'function') {
            console.error(`${className} Constructor: Invalid or missing logger dependency.`);
            throw new Error(`${className}: Invalid or missing logger dependency.`);
        }
        this.#logger = logger;

        if (!actionDiscoverySystem || typeof actionDiscoverySystem.getValidActions !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing actionDiscoverySystem (requires getValidActions).`);
            throw new Error(`${className}: Invalid or missing actionDiscoverySystem.`);
        }
        this.#actionDiscoverySystem = actionDiscoverySystem;

        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandProcessor (requires processCommand).`);
            throw new Error(`${className}: Invalid or missing commandProcessor.`);
        }
        this.#commandProcessor = commandProcessor;

        if (!worldContext || typeof worldContext.getLocationOfEntity !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing worldContext (requires getLocationOfEntity).`);
            throw new Error(`${className}: Invalid or missing worldContext.`);
        }
        this.#worldContext = worldContext;

        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing entityManager (requires getEntityInstance).`);
            throw new Error(`${className}: Invalid or missing entityManager.`);
        }
        this.#entityManager = entityManager;

        if (!gameDataRepository || typeof gameDataRepository.getActionDefinition !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing gameDataRepository (requires getActionDefinition).`);
            throw new Error(`${className}: Invalid or missing gameDataRepository.`);
        }
        this.#gameDataRepository = gameDataRepository;

        if (!promptOutputPort || typeof promptOutputPort.prompt !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing promptOutputPort (requires prompt method).`);
            throw new Error(`${className}: Invalid or missing promptOutputPort.`);
        }
        this.#promptOutputPort = promptOutputPort;

        // <<< ADDED Validation for TurnEndPort >>>
        if (!turnEndPort || typeof turnEndPort.notifyTurnEnded !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).`);
            throw new Error(`${className}: Invalid or missing turnEndPort.`);
        }
        this.#turnEndPort = turnEndPort;
        // <<< END ADDED Validation >>>

        if (!playerPromptService || typeof playerPromptService.prompt !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing playerPromptService (requires prompt method).`);
            throw new Error(`${className}: Invalid or missing playerPromptService.`);
        }
        this.#playerPromptService = playerPromptService;

        if (!commandOutcomeInterpreter || typeof commandOutcomeInterpreter.interpret !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method).`);
            throw new Error(`${className}: Invalid or missing commandOutcomeInterpreter.`);
        }
        this.#commandOutcomeInterpreter = commandOutcomeInterpreter;

        if (!safeEventDispatcher || typeof safeEventDispatcher.dispatchSafely !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely method).`);
            throw new Error(`${className}: Invalid or missing safeEventDispatcher.`);
        }
        this.#safeEventDispatcher = safeEventDispatcher;
        // --- End Dependency Validations ---

        this.#logger.debug(`${className} initialized successfully with all dependencies.`);
    }

    /**
     * Initiates the turn handling sequence for a player actor.
     * Sets the current actor and calls the internal prompt method to initiate interaction.
     * Does NOT return a promise representing turn completion; completion is signaled via ITurnEndPort.
     * @param {Entity} actor - The player entity taking its turn.
     * @returns {Promise<void>} A promise that resolves when the *initiation* is complete (e.g., first prompt sent), or rejects on critical setup error.
     * @throws {Error} If the actor is invalid or if a turn is already in progress for another actor.
     * @override // Overrides ITurnHandler.startTurn
     */
    async startTurn(actor) { // <<< Renamed from handleTurn
        const actorId = actor?.id || 'UNKNOWN';
        const className = this.constructor.name;
        this.#logger.info(`${className}: Starting turn initiation for actor ${actorId}.`);

        // --- Initial validation checks ---
        if (!actor || !actor.id) {
            this.#logger.error(`${className}: Attempted to start turn for an invalid actor.`);
            throw new Error(`${className}: Actor must be a valid entity.`);
        }
        if (this.#currentActor) {
            const errorMsg = `${className}: Attempted to start a new turn for ${actor.id} while turn for ${this.#currentActor.id} is already in progress.`;
            this.#logger.error(errorMsg);
            // Throw error to prevent overlapping turns initiated by TurnManager
            throw new Error(errorMsg);
        }
        // --- End initial validation ---

        this.#currentActor = actor; // Set current actor

        // --- REMOVED Promise Creation Block (Ticket #7) ---
        // const promiseForCaller = new Promise((resolve, reject) => {
        //     this.#turnPromiseResolve = resolve;
        //     this.#turnPromiseReject = reject;
        // });
        // this.#turnPromise = promiseForCaller;
        // --- END REMOVED Block ---

        try {
            // Initiate the turn by prompting the player.
            // If prompt fails internally, its catch block calls _handleTurnEnd and does NOT re-throw.
            await this.#_promptPlayerForAction(actor);
            // If prompt succeeds, the handler now waits for player input via _handleSubmittedCommand.
            this.#logger.debug(`${className}: Initial prompt sequence initiated for ${actorId}. Waiting for command submission.`);

        } catch (initError) {
            // This catch block should now only catch errors thrown *before* the try/catch
            // within #_promptPlayerForAction (e.g., assertion failures).
            // Errors from the prompt service itself are handled within #_promptPlayerForAction.
            this.#logger.error(`${className}: Critical error during turn initiation (pre-prompt phase) for ${actor.id}: ${initError.message}`, initError);
            // If we reach here, #_promptPlayerForAction's catch didn't run, so end the turn.
            await this._handleTurnEnd(actorId, initError); // Pass error for logging/status
            // Re-throw the initial setup error so the caller (TurnManager) knows initiation failed.
            throw initError;
        }

        // --- REMOVED Return Promise (Ticket #7) ---
        // return promiseForCaller;
        // --- END REMOVED Return ---
        // Method now implicitly returns Promise<void> from the async operation.
    }


    /**
     * Handles the 'core:submit_command' event (or direct call) when a command is entered.
     * Validates the command and delegates to processing if a turn is active for the correct actor.
     * Note: This method now drives the turn forward after initiation.
     * @protected - Intended for internal use, testing, or triggered by input system.
     * @param {CommandSubmitEventData} eventData - The event data containing the command.
     * @returns {Promise<void>}
     */
    async _handleSubmittedCommand(eventData) {
        const commandString = eventData?.command?.trim();
        const className = this.constructor.name;

        this.#logger.debug(`${className}: Received submitted command. Payload: ${JSON.stringify(eventData)}`);

        const currentActorAtStart = this.#currentActor;
        if (!currentActorAtStart) {
            this.#logger.warn(`${className}: Received submitted command but no player turn is active. Ignoring.`);
            return; // No turn active, nothing to do.
        }
        const actorId = currentActorAtStart.id;

        // --- REMOVED Check for promise functions (Ticket #7) ---
        // if (!this.#turnPromiseResolve || !this.#turnPromiseReject) { ... }
        // --- END REMOVED Check ---

        // --- Handle Empty Command ---
        if (!commandString) {
            this.#logger.warn(`${className}: Received submitted command with empty command string. Re-prompting actor ${actorId}.`);
            try {
                // Re-assert turn is still active for this actor before prompting again.
                this.#_assertTurnActiveFor(actorId); // Can throw
                // Prompt player. If this fails, #_promptPlayerForAction handles the turn end internally.
                await this.#_promptPlayerForAction(currentActorAtStart); // Re-prompt
            } catch (assertionError) {
                // This catch ONLY handles assertion errors now. Prompt errors are handled inside #_promptPlayerForAction.
                // Log here for context that it happened during re-prompt attempt due to assertion failure.
                this.#logger.error(`${className}: Error during empty command re-prompt assertion for ${actorId}: ${assertionError.message}`, assertionError);
                // If the assertion failed, the state is inconsistent or turn ended. Do not proceed.
            }
            return; // Handled empty command case.
        }

        // --- Process Valid Command ---
        this.#logger.info(`${className}: Handling command "${commandString}" for current actor ${actorId}.`);
        try {
            // Assert turn is active before processing
            this.#_assertTurnActiveFor(actorId);
            // Process command. If it fails internally (e.g., prompt error after RE_PROMPT),
            // the error should be handled within #_processValidatedCommand or its callees (#_promptPlayerForAction).
            await this.#_processValidatedCommand(currentActorAtStart, commandString);
            // If #_processValidatedCommand completes successfully, it will have called
            // _handleTurnEnd (for turn-ending actions) or #_promptPlayerForAction (for re-prompt).
        } catch(error) {
            // This catch block primarily handles:
            // 1. Assertion errors from #_assertTurnActiveFor at the start of processing.
            // 2. Unexpected errors escaping #_processValidatedCommand (though its internal catch should handle most).
            // Prompt errors are now handled internally and shouldn't reach here.
            this.#logger.error(`${className}: Unhandled error during command processing flow for ${actorId} command "${commandString}": ${error.message}`, error);

            // If the error was *not* an assertion failure and the turn appears active, attempt a fallback end.
            if (!error.message.includes('Turn is not active') && this.#currentActor && this.#currentActor.id === actorId) {
                this.#logger.warn(`${className}: Attempting fallback turn end due to unhandled error during command processing flow for ${actorId}.`);
                await this._handleTurnEnd(actorId, error); // Signal failure
            }
            // If assertion failed, state is inconsistent or turn ended elsewhere, nothing more to do here.
        }
    }

    /**
     * Processes a non-empty command string submitted by the player actor.
     * Calls CommandProcessor, interprets the result using CommandOutcomeInterpreter,
     * and executes the resulting directive (end turn via _handleTurnEnd or re-prompt).
     * Handles errors from processing/interpretation stages and ensures the turn ends correctly on failure.
     * Note: Errors from the re-prompt directive execution (#_promptPlayerForAction) are handled within that method.
     * @private
     * @param {Entity} actor - The actor performing the command.
     * @param {string} commandString - The validated, non-empty command string.
     * @returns {Promise<void>}
     * @throws {Error} If the turn assertion fails at the beginning.
     */
    async #_processValidatedCommand(actor, commandString) {
        const actorId = actor.id;
        const className = this.constructor.name;
        /** @type {CommandResult | null} */
        let result = null;

        // --- Guard State Check ---
        this.#_assertTurnActiveFor(actorId); // Throws on failure

        this.#logger.debug(`${className}: Processing validated command "${commandString}" for ${actorId}.`);

        try {
            // 1. Process Command
            this.#logger.info(`${className}: Delegating command "${commandString}" for ${actorId} to ICommandProcessor...`);
            result = await this.#commandProcessor.processCommand(actor, commandString);

            // --- Re-assert state AFTER await ---
            this.#_assertTurnActiveFor(actorId); // Throws on failure if turn ended unexpectedly mid-process

            this.#logger.info(`${className}: CommandProcessor raw result for ${actorId}: ${JSON.stringify(result)}`);

            // 2. Interpret Outcome
            this.#logger.info(`${className}: Interpreting command outcome for ${actorId}...`);
            const directive = await this.#commandOutcomeInterpreter.interpret(result, actor.id);
            this.#logger.info(`${className}: Received directive '${directive}' for actor ${actorId}.`);

            // --- Re-assert state AFTER await ---
            this.#_assertTurnActiveFor(actorId); // Throws on failure

            // 3. Execute Directive
            this.#logger.debug(`${className}: Executing directive '${directive}' for actor ${actorId}.`);
            switch (directive) {
                case TurnDirective.END_TURN_SUCCESS:
                    await this._handleTurnEnd(actorId, null); // null error = success
                    break;

                case TurnDirective.END_TURN_FAILURE:
                    const failureError = result?.error || new Error(`Command failed for ${actorId} with no specific error provided.`);
                    await this._handleTurnEnd(actorId, failureError); // Pass error = failure
                    break;

                case TurnDirective.RE_PROMPT:
                    // Re-assert before prompting again
                    this.#_assertTurnActiveFor(actorId);
                    // Delegate prompting. If it fails, #_promptPlayerForAction handles logging & turn end.
                    // No need for try/catch here as the callee handles its errors.
                    await this.#_promptPlayerForAction(actor);
                    break;

                default:
                    // Unknown directive is a failure case.
                    this.#logger.error(`${className}: Received unknown or invalid directive '${directive}' from CommandOutcomeInterpreter for actor ${actorId}. Forcing turn failure.`);
                    const unknownDirectiveError = new Error(`Received unexpected directive: ${directive}`);
                    await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                        message: `Handler received unknown directive '${directive}' for actor ${actorId}.`,
                        type: 'error',
                        details: unknownDirectiveError.message
                    });
                    await this._handleTurnEnd(actorId, unknownDirectiveError); // Signal failure
                    break;
            }
            this.#logger.debug(`${className}: Directive '${directive}' execution finished for ${actorId}.`);

        } catch (error) {
            // This catch block now primarily handles errors from:
            // - Assertions (#_assertTurnActiveFor)
            // - Command Processor (.processCommand)
            // - Interpreter (.interpret)
            // - Unknown directive default case
            // Errors from #_promptPlayerForAction (in RE_PROMPT case) are handled internally by it.
            if (error.message.includes('Turn is not active')) {
                this.#logger.warn(`${className}: Turn state changed (likely ended) during command processing/interpretation for ${actorId}. Aborting subsequent actions. Error: ${error.message}`);
            } else {
                // Log other unexpected errors
                this.#logger.error(
                    `${className}: Error during command processing or interpretation for ${actorId} command "${commandString}": ${error.message}`,
                    error
                );
                // Dispatch system error event
                await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                    message: `An internal error occurred while handling command or directive for ${actorId}.`,
                    type: 'error',
                    details: error.message
                });

                // Attempt to end the turn with failure. _handleTurnEnd will assert state again.
                this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to caught processing/interpretation error.`);
                await this._handleTurnEnd(actorId, error); // Signal failure
            }
            // Do not re-throw here; errors should be handled, leading to turn end notification or state inconsistency logging.
        }
    }


    /**
     * Delegates the prompting logic to the injected PlayerPromptService.
     * Handles errors thrown by the service by logging them and signaling turn failure via TurnEndPort.
     * Does NOT re-throw the error after handling it.
     * @private
     * @param {Entity} actor - The player actor.
     * @returns {Promise<void>} Resolves on successful prompt dispatch, or after handling a prompt error.
     * @throws {Error} If the turn assertion fails at the beginning.
     */
    async #_promptPlayerForAction(actor) {
        const className = this.constructor.name;
        const actorId = actor?.id || 'INVALID_ACTOR';

        // --- Guard State Check ---
        this.#_assertTurnActiveFor(actorId); // Throws on failure

        this.#logger.debug(`${className}: Delegating prompt logic for actor ${actorId} to PlayerPromptService.`);

        try {
            // The PlayerPromptService is responsible for using the PromptOutputPort
            await this.#playerPromptService.prompt(actor);
            this.#logger.debug(`${className}: PlayerPromptService.prompt completed successfully for actor ${actorId}. Handler now waits for input.`);

        } catch (error) {
            // Log the error from the prompt service
            this.#logger.error(
                `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}: ${error.message}`,
                error
            );

            // Attempt to end the turn cleanly, signaling failure.
            this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to prompt error.`);
            // IMPORTANT: Wait for _handleTurnEnd to complete its notification/cleanup.
            await this._handleTurnEnd(actorId, error); // Signal failure

            // <<< CORRECTION: Removed re-throw >>>
            // throw error;
            // Error is handled here by ending the turn. Do not propagate it further up this call stack.
        }
    }


    /**
     * Centralized method to handle the end of a player's turn.
     * Order: Check State -> Notify Port -> Cleanup State.
     * Notifies TurnEndPort about the success/failure. Does NOT handle promises anymore.
     * @protected - Intended for internal use or testing.
     * @param {string} actorId - The ID of the actor whose turn is ending.
     * @param {any} [error=null] - If provided and not null/undefined, indicates the turn ended in failure. Otherwise, success.
     * @returns {Promise<void>} Resolves when notification and cleanup are attempted.
     * @throws {Error} Propagates errors ONLY if TurnEndPort.notifyTurnEnded itself throws critically. Assertion failures handled internally.
     */
    async _handleTurnEnd(actorId, error = null) {
        const className = this.constructor.name;
        const isSuccess = (error === null || error === undefined);
        const endingStatus = isSuccess ? 'success' : 'failure';

        // --- Guard State Check ---
        // Wrap the assertion in a try-catch here because this is the *final* cleanup point.
        // If this assertion fails, we log but don't proceed, as the turn is already ended/invalid.
        try {
            this.#_assertTurnActiveFor(actorId); // Throws on failure if turn isn't active for this actor
        } catch (assertionError) {
            this.#logger.warn(`${className}: _handleTurnEnd called for ${actorId} (status: ${endingStatus}), but assertion failed. Turn may have already ended or belongs to another handler/actor. Aborting end sequence. Error: ${assertionError.message}`);
            // If the assertion fails, the state might have already been cleaned up. Do not proceed.
            return; // << EXIT early if assertion fails
        }
        // --- End Guard State Check ---

        // --- Proceed only if assertion passed ---
        this.#logger.info(`${className}: Ending turn for actor ${actorId} (status: ${endingStatus}).`);
        if (!isSuccess) {
            const reasonMsg = error instanceof Error ? error.message : String(error);
            this.#logger.warn(`${className}: Turn for ${actorId} ended with failure. Reason: ${reasonMsg}`);
        }

        // --- REMOVED Promise Handling Logic (Ticket #7) ---
        // ...
        // --- END REMOVED Promise Handling ---

        // --- Notify Port ---
        try {
            this.#logger.debug(`Notifying TurnEndPort for actor ${actorId}, success=${isSuccess}.`);
            // This is the crucial step: signal completion (success/failure) externally.
            await this.#turnEndPort.notifyTurnEnded(actorId, isSuccess); // <<< SIGNAL COMPLETION
            this.#logger.debug(`TurnEndPort notified successfully for ${actorId}.`);
        } catch (notifyError) {
            // This is critical. If notification fails, the TurnManager might never know the turn ended.
            this.#logger.error(`${className}: CRITICAL - Error notifying TurnEndPort for ${actorId} (status: ${endingStatus}): ${notifyError.message}. Proceeding with state cleanup, but game state might be inconsistent.`, notifyError);
            // Consider re-throwing if notification failure is unrecoverable? For now, log and continue cleanup.
            // throw notifyError;
        }
        // --- End Notify Port ---

        // --- REMOVED Promise Settlement Logic (Ticket #7) ---
        // ...
        // --- END REMOVED Promise Settlement ---

        // --- Cleanup Actor State ---
        // This should happen AFTER notification attempt.
        this.#_cleanupTurnState(actorId); // Safe, only clears if actorId matches #currentActor
        // --- End Cleanup Actor State ---

        this.#logger.debug(`${className}: _handleTurnEnd sequence completed for ${actorId}.`);
    }

    /**
     * Asserts that the turn is currently active for the specified actor ID.
     * Throws a detailed error if the turn is not active or belongs to a different actor.
     * @private
     * @param {string} actorId - The ID of the actor expected to have the active turn.
     * @throws {Error} If the turn is not active for the specified actor.
     */
    #_assertTurnActiveFor(actorId) {
        const className = this.constructor.name;
        if (!this.#currentActor) {
            const errorMsg = `${className}: Assertion Failed - Turn is not active. Expected actor '${actorId}' but no turn is in progress.`;
            throw new Error(errorMsg);
        }
        if (this.#currentActor.id !== actorId) {
            const errorMsg = `${className}: Assertion Failed - Turn is not active for the correct actor. Expected '${actorId}' but current actor is '${this.#currentActor.id}'.`;
            throw new Error(errorMsg);
        }
        // --- REMOVED Check for promise functions (Ticket #7) ---
        // ...
        // --- END REMOVED Check ---
    }


    /**
     * Resets the internal state associated *only* with the specified active turn
     * by clearing `#currentActor` if the provided `actorId` matches.
     * @private
     * @param {string} actorId - ID of the actor whose state should be cleared.
     */
    #_cleanupTurnState(actorId) {
        const className = this.constructor.name;
        // Only clear the actor reference if it matches the ID passed in.
        if (this.#currentActor && this.#currentActor.id === actorId) {
            this.#logger.debug(`${className}: Cleaning up active turn state for actor ${actorId}.`);
            this.#currentActor = null;
            // --- REMOVED Cleanup of promise members (Ticket #7) ---
            // ...
            // --- END REMOVED Cleanup ---
            this.#logger.debug(`${className}: Active turn state reset for ${actorId}.`);
        } else {
            this.#logger.warn(`${className}: #_cleanupTurnState called for ${actorId}, but current actor is ${this.#currentActor?.id || 'null'}. No cleanup performed by this specific call.`);
        }
    }

    /**
     * Gracefully shuts down the handler.
     * If a turn is active, it forces the turn end sequence (signaling failure via TurnEndPort and cleaning up state) via _handleTurnEnd.
     * @public
     */
    destroy() {
        const handlerId = this.constructor.name;
        this.#logger.info(`${handlerId}: Destroying handler...`);
        const currentActor = this.#currentActor; // Capture actor before potential async cleanup changes it

        if (currentActor) {
            const actorIdForLog = currentActor.id;
            this.#logger.warn(`${handlerId}: Destroying handler while turn for ${actorIdForLog} was active. Forcing turn end (failure).`);
            const destructionError = new Error(`${handlerId} destroyed during turn.`);

            // Call _handleTurnEnd to signal failure via TurnEndPort and manage cleanup.
            // Use fire-and-forget for the async call, but log potential errors from it.
            this._handleTurnEnd(actorIdForLog, destructionError) // Pass error to signal failure
                .catch(err => {
                    // Log error during forced end, but don't stop the destroy process
                    this.#logger.error(`${handlerId}: Error during forced _handleTurnEnd for ${actorIdForLog} in destroy: ${err.message}`, err);
                    // Failsafe: If _handleTurnEnd itself throws an error *before* cleaning state,
                    // ensure the #currentActor state is cleared here anyway.
                    if (this.#currentActor && this.#currentActor.id === actorIdForLog) {
                        this.#logger.warn(`${handlerId}: Performing failsafe state cleanup in destroy() after _handleTurnEnd error for ${actorIdForLog}.`);
                        this.#currentActor = null;
                    }
                });
        } else {
            // --- Final Cleanup (If no turn was active) ---
            this.#currentActor = null;
            this.#logger.debug(`${handlerId}: No active turn found during destruction. State cleared.`);
        }

        this.#logger.info(`${handlerId}: Destruction sequence initiated ${currentActor ? `(attempting forced end for ${currentActor.id})` : '(no active turn)'}.`);
    }
}

export default PlayerTurnHandler;
// --- FILE END ---