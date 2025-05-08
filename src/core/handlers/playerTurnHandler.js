// src/core/handlers/playerTurnHandler.js
// --- FILE START ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';
import {TURN_ENDED_ID} from '../constants/eventIds.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
// IWorldContext, IEntityManager, IGameDataRepository, IPromptOutputPort, ICommandInputPort removed as they are no longer direct dependencies
/** @typedef {import('../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {{ command: string }} CommandSubmitEventData */
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */
/** @typedef {import('../../actions/actionTypes.js').ActionDefinitionMinimal} ActionDefinitionMinimal */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../ports/commonTypes.js').UnsubscribeFn} UnsubscribeFn */
/** @typedef {import('../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */
/** @typedef {import('../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads */


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
 * @description
 * Orchestrates the turn lifecycle for player-controlled entities. This class manages
 * interactions with the player, command processing, and turn state transitions.
 * It delegates tasks to various services like command processing, player prompting,
 * and command outcome interpretation. It also utilizes a SubscriptionLifecycleManager
 * for handling event subscriptions related to player input and turn completion.
 * The handler guides the turn through various states: prompting the player,
 * receiving and processing commands, interpreting their outcomes, and finally
 * signaling turn completion. It employs internal strategy methods to manage
 * different scenarios arising from command processing and outcome interpretation,
 * such as re-prompting the player or ending the turn.
 */
class PlayerTurnHandler extends ITurnHandler {
    // --- Private Fields ---
    /**
     * @type {ILogger}
     * @private
     * @description Logger instance for logging messages.
     */
    #logger;

    /**
     * @type {ICommandProcessor}
     * @private
     * @description Service responsible for processing player commands.
     */
    #commandProcessor;

    /**
     * @type {ITurnEndPort}
     * @private
     * @description Port used to signal the end of a player's turn.
     */
    #turnEndPort;

    /**
     * @type {IPlayerPromptService}
     * @private
     * @description Service responsible for prompting the player for actions.
     */
    #playerPromptService;

    /**
     * @type {ICommandOutcomeInterpreter}
     * @private
     * @description Service that interprets the results of command processing to determine next steps.
     */
    #commandOutcomeInterpreter;

    /**
     * @type {ISafeEventDispatcher}
     * @private
     * @description Dispatcher for safely sending system-level events.
     */
    #safeEventDispatcher;

    /**
     * @type {SubscriptionLifecycleManager}
     * @private
     * @description Manages subscriptions to command input and turn end events.
     */
    #subscriptionManager;

    /**
     * @type {Entity | null}
     * @private
     * @description The player entity currently taking their turn. Null if no turn is active.
     */
    #currentActor = null;

    /**
     * @type {boolean}
     * @private
     * @description Flag indicating if the handler is currently waiting for an external {@link TURN_ENDED_ID} event
     * to signal the end of the turn.
     */
    #isAwaitingTurnEndEvent = false;

    /**
     * @type {string | null}
     * @private
     * @description The ID of the actor for whom the handler is awaiting the {@link TURN_ENDED_ID} event.
     * Null if not awaiting for any specific actor.
     */
    #awaitingTurnEndForActorId = null;

    /**
     * @type {boolean}
     * @private
     * @description Flag indicating if the handler has been destroyed. Used for idempotency in {@link destroy}.
     */
    #isDestroyed = false;

    /**
     * @type {boolean}
     * @private
     * @description Flag indicating if the turn is being terminated through a normal, expected flow
     * (e.g., successful command leading to turn end, or explicit game rule). This helps differentiate
     * normal termination from abrupt termination (e.g., due to handler destruction mid-turn).
     */
    #isTerminatingNormally = false;


    /**
     * Creates an instance of PlayerTurnHandler.
     * @param {object} dependencies - Dependencies.
     * @param {ILogger} dependencies.logger
     * @param {ICommandProcessor} dependencies.commandProcessor
     * @param {ITurnEndPort} dependencies.turnEndPort
     * @param {IPlayerPromptService} dependencies.playerPromptService
     * @param {ICommandOutcomeInterpreter} dependencies.commandOutcomeInterpreter
     * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
     * @param {SubscriptionLifecycleManager} dependencies.subscriptionLifecycleManager
     */
    constructor({
                    logger,
                    commandProcessor,
                    turnEndPort,
                    playerPromptService,
                    commandOutcomeInterpreter,
                    safeEventDispatcher,
                    subscriptionLifecycleManager,
                }) {
        super();
        const className = this.constructor.name;

        if (!logger || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            console.error(`${className} Constructor: Invalid or missing logger dependency (must include error and debug methods).`);
            throw new Error(`${className}: Invalid or missing logger dependency.`);
        }
        this.#logger = logger;

        if (!commandProcessor || typeof commandProcessor.processCommand !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandProcessor (requires processCommand).`);
            throw new Error(`${className}: Invalid or missing commandProcessor.`);
        }
        this.#commandProcessor = commandProcessor;

        // Validations for worldContext, entityManager, gameDataRepository, promptOutputPort, commandInputPort REMOVED

        if (!turnEndPort || typeof turnEndPort.notifyTurnEnded !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing turnEndPort (requires notifyTurnEnded method).`);
            throw new Error(`${className}: Invalid or missing turnEndPort.`);
        }
        this.#turnEndPort = turnEndPort;

        if (!playerPromptService || typeof playerPromptService.prompt !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing playerPromptService (requires prompt method from IPlayerPromptService).`);
            throw new Error(`${className}: Invalid or missing playerPromptService.`);
        }
        this.#playerPromptService = playerPromptService;

        if (!commandOutcomeInterpreter || typeof commandOutcomeInterpreter.interpret !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing commandOutcomeInterpreter (requires interpret method from ICommandOutcomeInterpreter).`);
            throw new Error(`${className}: Invalid or missing commandOutcomeInterpreter.`);
        }
        this.#commandOutcomeInterpreter = commandOutcomeInterpreter;

        // Note: The validation for safeEventDispatcher.subscribe is kept as it's part of ISafeEventDispatcher's general contract,
        // even if PlayerTurnHandler itself might only directly use dispatchSafely.
        // SubscriptionLifecycleManager, which PlayerTurnHandler uses, does rely on subscribe.
        if (!safeEventDispatcher || typeof safeEventDispatcher.dispatchSafely !== 'function' || typeof safeEventDispatcher.subscribe !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing safeEventDispatcher (requires dispatchSafely and subscribe methods).`);
            throw new Error(`${className}: Invalid or missing safeEventDispatcher.`);
        }
        this.#safeEventDispatcher = safeEventDispatcher;

        if (!subscriptionLifecycleManager || typeof subscriptionLifecycleManager.subscribeToCommandInput !== 'function' || typeof subscriptionLifecycleManager.unsubscribeAll !== 'function') {
            this.#logger.error(`${className} Constructor: Invalid or missing subscriptionLifecycleManager dependency.`);
            throw new Error(`${className}: Invalid or missing subscriptionLifecycleManager dependency.`);
        }
        this.#subscriptionManager = subscriptionLifecycleManager;

        this.#logger.debug(`${className} initialized successfully with core dependencies.`);
    }

    /**
     * Resets all turn-related state and cleans up resources, primarily subscriptions.
     * This method is intended to be called at the end of a turn or when the handler is destroyed.
     * @private
     * @param {string} actorIdContextForLog - The actor ID for logging context, defaults to 'N/A'.
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        const className = this.constructor.name;
        this.#logger.debug(`${className}._resetTurnStateAndResources: Starting full state reset for actor context '${actorIdContextForLog}'.`);

        // 1. Subscription Cleanup
        this.#logger.debug(`${className}._resetTurnStateAndResources: Calling unsubscribeAll via SubscriptionLifecycleManager for actor context '${actorIdContextForLog}'.`);
        this.#subscriptionManager.unsubscribeAll();

        // 2. State Flag Resets
        this.#logger.debug(`${className}._resetTurnStateAndResources: Resetting internal state flags for actor context '${actorIdContextForLog}': #currentActor (was ${this.#currentActor?.id || 'null'}), #isAwaitingTurnEndEvent (was ${this.#isAwaitingTurnEndEvent}), #awaitingTurnEndForActorId (was ${this.#awaitingTurnEndForActorId || 'null'}), #isTerminatingNormally (was ${this.#isTerminatingNormally}).`);
        this.#currentActor = null;
        this.#isAwaitingTurnEndEvent = false;
        this.#awaitingTurnEndForActorId = null;
        this.#isTerminatingNormally = false; // Reset for destroy and after turn completion

        this.#logger.debug(`${className}._resetTurnStateAndResources: Full state reset completed for actor context '${actorIdContextForLog}'.`);
    }


    /**
     * Initiates and manages the turn for a given player actor.
     * It sets the current actor, subscribes to command input, and prompts the player for action.
     * Handles errors during initiation by attempting to end the turn gracefully.
     * This method fulfills the {@link ITurnHandler#startTurn} interface.
     *
     * @async
     * @param {Entity} actor - The player entity whose turn is to be started. Must have a valid `id` property.
     * @returns {Promise<void>} A promise that resolves when the turn initiation is complete (e.g., first prompt sent),
     * or rejects if a critical error occurs during this initiation phase.
     * This promise does not represent the completion of the entire turn.
     * @throws {Error} If `actor` is invalid, if a turn is already in progress, or if critical
     * subscriptions or prompts fail during setup.
     */
    async startTurn(actor) {
        const actorIdForLog = actor?.id ?? 'UNKNOWN'; // Use actor.id directly if available, otherwise 'UNKNOWN'
        const className = this.constructor.name;
        this.#logger.info(`${className}: Starting turn initiation for actor ${actorIdForLog}.`);
        this.#isDestroyed = false;
        this.#isTerminatingNormally = false;

        // Corrected validation for actor and actor.id
        if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
            this.#logger.error(`${className}: Attempted to start turn for an invalid or null actor.`);
            throw new Error(`${className}: Actor must be a valid entity.`);
        }
        // actor.id is now guaranteed to be a non-empty string if we pass the above check
        const actorId = actor.id;


        if (this.#currentActor) {
            const errorMsg = `${className}: Attempted to start a new turn for ${actorId} while turn for ${this.#currentActor.id} is already in progress.`;
            this.#logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.#clearTurnEndWaitingMechanisms();
        this.#currentActor = actor;

        try {
            this.#subscriptionManager.unsubscribeFromCommandInput(); // Safeguard

            this.#logger.debug(`${className}: Attempting to subscribe to command input for actor ${actorId}.`);
            const commandHandler = this._handleSubmittedCommand.bind(this);
            const commandSubscribed = this.#subscriptionManager.subscribeToCommandInput(commandHandler);

            if (!commandSubscribed) {
                // This is a critical failure in setting up the turn.
                throw new Error('Failed to subscribe to command input via SubscriptionLifecycleManager.');
            }
            this.#logger.debug(`${className}: Command input subscription successful for actor ${actorId}.`);

            await this._promptPlayerForAction(actor);
            this.#logger.debug(`${className}: Initial prompt sequence initiated for ${actorId}.`);

        } catch (initError) {
            this.#logger.error(`${className}: Critical error during turn initiation for ${actorId}: ${initError.message}`, initError);
            const promptErrorMessageCheck = `${className}: PlayerPromptService threw an error during prompt`;

            // If the error is NOT from _promptPlayerForAction (which already calls _handleTurnEnd),
            // then we need to ensure the turn is properly terminated here.
            if (!initError?.message?.includes(promptErrorMessageCheck)) {
                this.#logger.info(`${className}: Error during turn initiation for ${actorId} (not from PlayerPromptService). Proceeding to handle turn end.`);
                if (this.#currentActor && this.#currentActor.id === actorId) {
                    await this._handleTurnEnd(actorId, initError);
                } else {
                    // Actor might have become null or changed due to the error or subsequent logic,
                    // or it was never properly set if the error occurred early.
                    this.#logger.warn(`${className}: In startTurn catch for ${actorId}, current actor is ${this.#currentActor?.id || 'none'}. Turn end not invoked by startTurn. Performing minimal cleanup.`);
                    this._resetTurnStateAndResources(actorId || 'startTurn_initError_noCurrentActor');
                }
            } else {
                // If the error *is* from _promptPlayerForAction, _handleTurnEnd has already been called by it.
                // No need to call _handleTurnEnd again here.
                this.#logger.debug(`${className}: Error during turn initiation for ${actorId} (from PlayerPromptService). _handleTurnEnd already called by _promptPlayerForAction.`);
            }
            // Re-throw the original initialization error so the caller of startTurn is aware.
            throw initError;
        }
    }

    /**
     * Handles the scenario where an empty command string is submitted by the player.
     * It re-prompts the current actor for action if the turn is still valid for them.
     *
     * @async
     * @private
     * @param {Entity} actor - The actor who submitted the empty command.
     * @returns {Promise<void>} A promise that resolves after attempting to re-prompt the player or
     * determining that a re-prompt is not necessary/possible.
     * @throws {Error} Propagates errors from {@link _promptPlayerForAction} if re-prompting fails.
     */
    async _handleEmptyCommand(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.warn(`${className}: Received empty command from actor ${actorId}. Re-prompting.`);

        if (this.#currentActor && this.#currentActor.id === actorId) {
            try {
                await this._promptPlayerForAction(actor);
                if (!this.#_isTurnValidForActor(actorId)) { // Check actor validity *after* the prompt
                    this.#logger.warn(`${className}: _handleEmptyCommand: Aborting operation for actor ${actorId}. Turn became invalid after re-prompt attempt.`);
                    // #_isTurnValidForActor logs specific reason
                }
            } catch (error) {
                // _promptPlayerForAction is expected to call _handleTurnEnd on error.
                // This catch is primarily for logging and to prevent unhandled promise rejections if any other
                // unexpected error occurred within the try block before or after the _promptPlayerForAction call.
                this.#logger.debug(`${className}: _handleEmptyCommand: Error during re-prompt for actor ${actorId} (caught). Turn should have been ended by _promptPlayerForAction. Error: ${error.message}`);
                // Do not re-throw here as _promptPlayerForAction already handles its errors by ending the turn.
            }
        } else {
            this.#logger.warn(`${className}: _handleEmptyCommand: Skipping re-prompt for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }


    /**
     * Handles a command string submitted by the player.
     * This method is typically bound as a callback to command input events.
     * It validates the command, processes it if valid, or re-prompts if empty.
     * It also includes comprehensive error handling for various stages of command processing.
     *
     * @async
     * @private
     * @param {string} commandString - The command string submitted by the player.
     * @returns {Promise<void>} A promise that resolves when command handling is complete.
     * It doesn't return a specific value but orchestrates further actions or turn termination.
     */
    async _handleSubmittedCommand(commandString) {
        const className = this.constructor.name;
        const currentActorAtStart = this.#currentActor; // Capture at the beginning

        if (!currentActorAtStart) {
            this.#logger.warn(`${className}: Ignoring submitted command: no player turn is active.`);
            return;
        }
        const actorId = currentActorAtStart.id; // Safe to access .id due to the check above

        const trimmedCommand = commandString?.trim(); // Safely trim, handles null/undefined commandString
        this.#logger.debug(`${className}: Received command from actor ${actorId}: "${commandString}" (trimmed: "${trimmedCommand}")`);

        if (!trimmedCommand) {
            await this._handleEmptyCommand(currentActorAtStart);
            return;
        }

        this.#logger.info(`${className}: Handling command "${trimmedCommand}" for current actor ${actorId}.`);
        try {
            // Ensure the turn is still active for this specific actor before proceeding.
            // This covers cases where the turn might have been ended by an external factor
            // between the command submission and this point of execution.
            this.#_assertTurnActiveFor(actorId); // Throws if not active for this actor

            await this.#_processValidatedCommand(currentActorAtStart, trimmedCommand);

        } catch (error) {
            const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;

            if (error?.message?.startsWith(promptErrorOriginCheck)) {
                // This error originates from _promptPlayerForAction (or a similar method using it),
                // which should have already handled ending the turn.
                this.#logger.debug(`${className}: _handleSubmittedCommand: Re-thrown prompt error for ${actorId} caught. Lower-level handler should have finalized turn. Error: ${error.message}`);
                // No need to call _handleTurnEnd again.
            } else if (error?.message?.includes('Assertion Failed - Turn is not active')) {
                // This specific error comes from #_assertTurnActiveFor, indicating the turn state changed.
                this.#logger.warn(`${className}: _handleSubmittedCommand: Turn state assertion failed for command "${trimmedCommand}" by actor ${actorId}. Error: ${error.message}`);
                // Turn is no longer considered active for this actor; _handleTurnEnd might not be appropriate
                // or might have already been called. Resetting resources is a safe fallback.
                // However, if the error is due to actor mismatch, _resetTurnStateAndResources might be too broad.
                // Given #_assertTurnActiveFor's checks (destroyed, no currentActor, currentActor.id mismatch),
                // if currentActor became null or different, _handleTurnEnd(actorId,...) would also not proceed
                // for *this* actorId. So, simply logging is often enough here.
                // Consider if any cleanup is needed or if it's handled by the cause of the assertion failure.
            } else {
                // An unexpected error occurred during command processing.
                this.#logger.error(`${className}: _handleSubmittedCommand: Unexpected error for actor ${actorId} (command: "${trimmedCommand}"): ${error.message}`, error);

                // Check if the turn is still considered active for the actor *for whom this command was intended*.
                // This is crucial because an error might occur, and in its handling, the current actor state could change.
                // We only want to end the turn for 'actorId' if 'actorId' is *still* the #currentActor.
                if (this.#currentActor && this.#currentActor.id === actorId) {
                    this.#logger.warn(`${className}: _handleSubmittedCommand: Attempting fallback turn end for ${actorId} due to unexpected error. Awaiting event: ${this.#isAwaitingTurnEndEvent}.`);
                    await this._handleTurnEnd(actorId, error);
                } else {
                    this.#logger.warn(`${className}: _handleSubmittedCommand: Unexpected error for command "${trimmedCommand}" (intended for ${actorId}). Current actor is ${this.#currentActor?.id || 'none'}. Skipping fallback turn end for ${actorId}.`);
                    // If the actor changed, ending the turn for the original actorId here might be incorrect or redundant.
                    // The state change should ideally handle its own cleanup.
                }
            }
            // Do not re-throw general errors here unless _handleSubmittedCommand's caller needs to react to them.
            // The primary goal here is to handle the command submission's lifecycle, including errors.
        }
    }

    /**
     * Handles the successful outcome of command processing.
     * It interprets the command result using `ICommandOutcomeInterpreter` and then
     * executes the appropriate strategy based on the interpreter's directive (e.g., re-prompt, end turn).
     * Includes checks for turn validity throughout the process.
     *
     * @async
     * @private
     * @param {Entity} actor - The actor for whom the command was successful.
     * @param {CommandResult} cmdProcResult - The successful result from the `ICommandProcessor`.
     * @param {string} commandString - The original command string that was processed.
     * @returns {Promise<void>} A promise that resolves when the success handling and subsequent strategy execution are complete.
     * @throws {Error} If an unknown directive is received from the interpreter or if a re-prompt strategy fails.
     */
    async _handleCommandProcessorSuccess(actor, cmdProcResult, commandString) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.debug(`${className}: _handleCommandProcessorSuccess for actor ${actorId}, command "${commandString}". Result: ${JSON.stringify(cmdProcResult)}`);
        this.#logger.info(`${className}: CommandProcessor SUCCEEDED for "${commandString}" by ${actorId}. Event 'core:attempt_action' dispatched.`);

        // Check if the turn is still valid for the actor *before* interpretation.
        // The command's success might have indirectly led to conditions that end the turn (e.g., game objective met).
        if (!this.#_isTurnValidForActor(actorId)) {
            this.#logger.info(`${className}: _handleCommandProcessorSuccess: Turn for ${actorId} concluded by external rules after command success. Aborting further handler processing.`);
            return; // The turn is no longer valid, so stop further processing here.
        }

        /** @type {TurnDirective | null} */
        let directiveFromInterpreter = null;
        if (this.#commandOutcomeInterpreter) {
            this.#logger.info(`${className}: Interpreting successful command outcome for actor ${actorId}.`);
            directiveFromInterpreter = await this.#commandOutcomeInterpreter.interpret(cmdProcResult, actor.id);

            // Check turn validity *again* after interpretation, as the interpreter itself or events it triggers
            // could also affect turn validity.
            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: _handleCommandProcessorSuccess: Turn for ${actorId} became invalid after CommandOutcomeInterpreter. Aborting further handler processing.`);
                return;
            }
            this.#logger.info(`${className}: CommandOutcomeInterpreter for ${actorId} returned directive: '${directiveFromInterpreter}'.`);
        } else {
            this.#logger.warn(`${className}: _handleCommandProcessorSuccess: No CommandOutcomeInterpreter for actor ${actorId}. Assuming default: wait for turn end event.`);
            // Default behavior if no interpreter: usually means we wait for an external event to end the turn.
            // This will fall through to the _executeWaitForTurnEndEventStrategy by default.
        }

        // Validate the directive received from the interpreter
        if (directiveFromInterpreter && !Object.values(TurnDirective).includes(directiveFromInterpreter)) {
            const unknownDirectiveError = new Error(`Received unexpected directive: ${directiveFromInterpreter}`);
            this.#logger.error(`${className}: _handleCommandProcessorSuccess: Unknown directive '${directiveFromInterpreter}' for actor ${actorId}. Forcing turn failure.`);
            // Dispatch a system error event
            await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
                message: `Handler received unknown directive '${directiveFromInterpreter}' for actor ${actorId}.`,
                type: 'error',
                details: unknownDirectiveError.message
            });
            // If the turn is still for the current actor, end it with this error.
            if (this.#currentActor && this.#currentActor.id === actorId) {
                await this._handleTurnEnd(actorId, unknownDirectiveError);
            }
            return; // Stop processing due to unknown directive.
        }

        // Execute strategy based on the directive
        if (directiveFromInterpreter === TurnDirective.RE_PROMPT) {
            this.#logger.info(`${className}: Directive RE_PROMPT for ${actorId}. Executing re-prompt strategy.`);
            await this._executeRepromptStrategy(actor);
        } else if (directiveFromInterpreter === TurnDirective.END_TURN_SUCCESS) {
            await this._executeEndTurnSuccessStrategy(actor);
        } else if (directiveFromInterpreter === TurnDirective.END_TURN_FAILURE) {
            // This case means the command *processor* succeeded, but the *interpreter* decided the turn should end in failure.
            this.#logger.info(`${className}: Directive END_TURN_FAILURE for ${actorId} (post-success). Executing end turn failure strategy.`);
            const errorForStrategy = new Error("Turn ended by interpreter directive END_TURN_FAILURE after successful command processing.");
            await this._executeEndTurnFailureStrategy(actor, errorForStrategy, TurnDirective.END_TURN_FAILURE, commandString);
        } else {
            // Default strategy (includes null directive or WAIT_FOR_EVENT directive)
            await this._executeWaitForTurnEndEventStrategy(actor);
        }
    }


    async _handleCommandProcessorFailure(actor, cmdProcResult, commandString) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.warn(`${className}: CommandProcessor FAILED for "${commandString}" by ${actorId}. Error: ${cmdProcResult.error || 'N/A'}.`);
        const failureError = cmdProcResult.error ? (cmdProcResult.error instanceof Error ? cmdProcResult.error : new Error(String(cmdProcResult.error))) : new Error(`Command processing failed for "${commandString}".`);

        if (cmdProcResult.turnEnded === true) {
            this.#logger.info(`${className}: CommandProcessor indicated turn has ended for ${actorId} post-failure. Bypassing interpreter.`);
            if (this.#currentActor && this.#currentActor.id === actorId) {
                await this._handleTurnEnd(actorId, failureError);
            } // Else: actor mismatch, _handleTurnEnd would log/handle it if called.
        } else {
            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: _handleCommandProcessorFailure: Turn for ${actorId} became invalid before CommandOutcomeInterpreter. Aborting further handler processing.`);
                return;
            }

            this.#logger.info(`${className}: Interpreting FAILED command outcome for "${commandString}" by ${actorId}.`);
            const directiveForFailure = await this.#commandOutcomeInterpreter.interpret(cmdProcResult, actor.id);

            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: _handleCommandProcessorFailure: Turn for ${actorId} became invalid after CommandOutcomeInterpreter. Aborting further handler processing.`);
                return;
            }
            this.#logger.info(`${className}: Directive for CommandProcessor failure for ${actorId}: '${directiveForFailure}'.`);

            switch (directiveForFailure) {
                case TurnDirective.RE_PROMPT:
                    await this._executeRepromptStrategy(actor);
                    break;
                case TurnDirective.END_TURN_FAILURE:
                default:
                    await this._executeEndTurnFailureStrategy(actor, cmdProcResult.error, directiveForFailure, commandString);
                    break;
            }
        }
    }

    async _executeRepromptStrategy(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Executing RE_PROMPT strategy for ${actorId}.`);

        if (this.#currentActor && this.#currentActor.id === actorId) {
            try {
                await this._promptPlayerForAction(actor);
                if (!this.#_isTurnValidForActor(actorId)) { // Check actor validity *after* the prompt
                    this.#logger.warn(`${className}: _executeRepromptStrategy: Actor ${actorId} no longer valid after re-prompt attempt. Aborting operation.`);
                }
            } catch (promptError) {
                this.#logger.debug(`${className}: _executeRepromptStrategy: Re-throwing error from _promptPlayerForAction for ${actorId}. Error: ${promptError.message}`);
                throw promptError;
            }
        } else {
            this.#logger.warn(`${className}: _executeRepromptStrategy: Skipping re-prompt for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }

    async _executeEndTurnFailureStrategy(actor, initialErrorOrInfo, directive, commandString) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Executing END_TURN_FAILURE strategy for ${actorId} (directive: '${directive}').`);

        let turnEndError;
        if (initialErrorOrInfo instanceof Error) {
            turnEndError = initialErrorOrInfo;
        } else if (initialErrorOrInfo) {
            turnEndError = new Error(String(initialErrorOrInfo));
        } else {
            turnEndError = new Error(`Turn ended by CommandOutcomeInterpreter directive '${directive}' for command "${commandString}".`);
        }

        if (this.#currentActor && this.#currentActor.id === actorId) {
            this.#logger.warn(`${className}: Ending turn with failure for ${actorId} via strategy. Reason: ${turnEndError.message}`);
            await this._handleTurnEnd(actorId, turnEndError);
        } else {
            this.#logger.warn(`${className}: _executeEndTurnFailureStrategy: Skipping turn end for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }

    async _executeEndTurnSuccessStrategy(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Directive END_TURN_SUCCESS for ${actorId}. Ending turn successfully.`);
        if (this.#currentActor && this.#currentActor.id === actorId) {
            await this._handleTurnEnd(actorId, null);
        } else {
            this.#logger.warn(`${className}: _executeEndTurnSuccessStrategy: Skipping turn end for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }

    async _executeWaitForTurnEndEventStrategy(actor) {
        const className = this.constructor.name;
        const actorId = actor.id;

        this.#logger.info(`${className}: Default/No explicit directive for ${actorId}. Proceeding to wait for '${TURN_ENDED_ID}' event.`);
        if (this.#currentActor && this.#currentActor.id === actorId) {
            await this.#waitForTurnEndEvent(actor);
            if (!this.#_isTurnValidForActor(actorId)) { // Check after wait setup attempt
                this.#logger.warn(`${className}: _executeWaitForTurnEndEventStrategy: Actor ${actorId} no longer valid after attempting to set up wait for '${TURN_ENDED_ID}'. Aborting operation.`);
                return;
            }
            this.#logger.debug(`${className}: _executeWaitForTurnEndEventStrategy: Wait for '${TURN_ENDED_ID}' for actor ${actorId} initiated.`);
        } else {
            this.#logger.warn(`${className}: _executeWaitForTurnEndEventStrategy: Skipping wait for '${TURN_ENDED_ID}' for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
        }
    }


    /**
     * Processes a command that has been validated (e.g., not empty).
     * This method orchestrates the command processing by delegating to the `ICommandProcessor`
     * and then handles the success or failure outcome by calling the appropriate helper methods
     * (`_handleCommandProcessorSuccess` or `_handleCommandProcessorFailure`).
     * It also includes turn validity checks and robust error handling.
     *
     * @async
     * @private
     * @param {Entity} actor - The actor for whom the command is being processed.
     * @param {string} commandString - The validated (non-empty, trimmed) command string.
     * @returns {Promise<void>} A promise that resolves when the command processing and subsequent outcome handling are complete.
     * @throws {Error} Propagates errors from {@link _promptPlayerForAction} if a re-prompt occurs and fails.
     * Other specific errors (e.g., assertion failures) are typically handled internally,
     * though unexpected errors might lead to turn termination.
     */
    async #_processValidatedCommand(actor, commandString) {
        const actorId = actor.id;
        const className = this.constructor.name;
        /** @type {CommandResult | null} */
        let cmdProcResult = null; // Initialize to null to satisfy type checks if errors occur before assignment

        this.#_assertTurnActiveFor(actorId); // Ensure turn is active before any processing
        this.#logger.debug(`${className}: Processing validated command "${commandString}" for ${actorId}.`);
        this.#clearTurnEndWaitingMechanisms(); // Clear any existing event waits, as a new command cycle begins

        try {
            this.#logger.info(`${className}: Delegating command "${commandString}" for ${actorId} to CommandProcessor.`);
            cmdProcResult = await this.#commandProcessor.processCommand(actor, commandString);

            // It's crucial to check turn validity *after* command processing, as the command itself
            // might have triggered game state changes that invalidate the turn (e.g., actor died).
            if (!this.#_isTurnValidForActor(actorId)) {
                this.#logger.warn(`${className}: #_processValidatedCommand: Turn for ${actorId} became invalid after command processing. Aborting further handler action.`);
                // If turn became invalid, no further action (like interpreting result or ending turn based on it) should be taken by this flow.
                // The mechanism that invalidated the turn should be responsible for its cleanup.
                return;
            }

            if (cmdProcResult.success) {
                await this._handleCommandProcessorSuccess(actor, cmdProcResult, commandString);
            } else {
                await this._handleCommandProcessorFailure(actor, cmdProcResult, commandString);
            }

        } catch (error) {
            // Capture current actor status *at the time of error* for accurate decision making
            const stillCurrentOnError = this.#currentActor && this.#currentActor.id === actorId;

            if (error.message.includes('Assertion Failed - Turn is not active')) {
                // This error could be from an assertion within _handleCommandProcessorSuccess/Failure or deeper.
                this.#logger.warn(`${className}: #_processValidatedCommand: Turn state assertion failed for command "${commandString}" by actor ${actorId}. Error: ${error.message}`);
                // If an assertion fails, it implies the state is already inconsistent or handled. Avoid further complex logic.
                return; // Exit, as the state that caused assertion should handle cleanup.
            }

            const promptErrorOriginCheck = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}`;
            if (error?.message?.startsWith(promptErrorOriginCheck)) {
                // This error likely propagated from a re-prompt attempt within success/failure handlers.
                // _promptPlayerForAction handles its own turn ending.
                this.#logger.debug(`${className}: #_processValidatedCommand: Re-thrown prompt error for ${actorId} (command "${commandString}"). Lower-level handler should have finalized. Error: ${error.message}`);
                throw error; // Re-throw for _handleSubmittedCommand to see and potentially log.
            }

            // For any other unexpected errors from commandProcessor.processCommand or outcome handlers:
            this.#logger.error(`${className}: #_processValidatedCommand: Unexpected error processing command "${commandString}" for ${actorId}: ${error.message}`, error);

            // Dispatch a system error event for broader observability
            await this.#safeEventDispatcher.dispatchSafely('core:system_error_occurred', {
                eventName: 'core:system_error_occurred',
                message: `Internal error in #_processValidatedCommand for ${actorId}, command "${commandString}".`,
                type: 'error',
                details: error.message
            });

            // If the turn is still active for this actor and we are not already awaiting a turn end event
            // (which might have been set up by a strategy before this error occurred), attempt to end the turn.
            if (stillCurrentOnError) {
                if (!this.#isAwaitingTurnEndEvent) {
                    this.#logger.info(`${className}: #_processValidatedCommand: Attempting to end turn with failure for ${actorId} due to unexpected error (command "${commandString}").`);
                    await this._handleTurnEnd(actorId, error);
                } else {
                    // If awaiting an event, ending the turn here might conflict. Log this problematic state.
                    this.#logger.warn(`${className}: #_processValidatedCommand: Unexpected error for ${actorId} (command "${commandString}") while awaiting '${TURN_ENDED_ID}'. Turn might not end correctly. Error: ${error.message}`);
                }
            }
            // Do not re-throw generic errors here; they are handled by attempting to end the turn or logging.
            // Re-throwing would propagate to _handleSubmittedCommand, which might duplicate handling.
        }
    }

    async #waitForTurnEndEvent(actor) {
        const actorId = actor.id;
        const className = this.constructor.name;

        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}: #waitForTurnEndEvent: Skipping wait setup for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
            return;
        }

        if (this.#isAwaitingTurnEndEvent) {
            this.#logger.warn(`${className}: #waitForTurnEndEvent: Already awaiting turn end for ${this.#awaitingTurnEndForActorId}. Clearing previous wait for ${actorId} first.`);
            this.#clearTurnEndWaitingMechanisms();
        }

        this.#isAwaitingTurnEndEvent = true;
        this.#awaitingTurnEndForActorId = actorId;
        this.#logger.debug(`${className}: Subscribing to '${TURN_ENDED_ID}' for actor ${actorId}.`);

        /** @param {SystemEventPayloads[typeof TURN_ENDED_ID]} payload */
        const turnEndedListener = (payload) => {
            const localClassName = this.constructor.name;
            if (this.#isAwaitingTurnEndEvent && payload.entityId === this.#awaitingTurnEndForActorId) {
                this.#logger.info(`${localClassName}: Received target '${TURN_ENDED_ID}' event for actor ${this.#awaitingTurnEndForActorId}. Message: ${payload.message || 'N/A'}.`);
                if (this.#currentActor && this.#currentActor.id === this.#awaitingTurnEndForActorId) {
                    this._handleTurnEnd(this.#awaitingTurnEndForActorId, null)
                        .catch(err => this.#logger.error(`${localClassName}: Error in _handleTurnEnd after '${TURN_ENDED_ID}' event for ${this.#awaitingTurnEndForActorId}: ${err.message}`, err));
                } else {
                    this.#logger.warn(`${localClassName}: Received '${TURN_ENDED_ID}' for awaited actor ${this.#awaitingTurnEndForActorId}, but actor is no longer current (current: ${this.#currentActor?.id || 'none'}). Cleaning up wait mechanisms.`);
                    this.#clearTurnEndWaitingMechanisms();
                }
            } else if (this.#isAwaitingTurnEndEvent) {
                this.#logger.debug(`${localClassName}: Ignoring '${TURN_ENDED_ID}' event for entity ${payload.entityId} (awaiting for ${this.#awaitingTurnEndForActorId}).`);
            } else {
                this.#logger.debug(`${localClassName}: Received '${TURN_ENDED_ID}' for ${payload.entityId}, but no longer awaiting. Listener should have been removed. Safeguard cleanup.`);
                this.#clearTurnEndWaitingMechanisms(); // Safeguard
            }
        };

        const eventSubscribed = this.#subscriptionManager.subscribeToTurnEnded(turnEndedListener);

        if (!eventSubscribed) {
            this.#logger.error(`${className}: Failed to subscribe to '${TURN_ENDED_ID}' for actor ${actorId}. Ending turn with failure.`);
            this.#isAwaitingTurnEndEvent = false;
            this.#awaitingTurnEndForActorId = null;
            const subscriptionError = new Error(`Internal error: Failed to subscribe to ${TURN_ENDED_ID} event listener.`);
            if (this.#currentActor && this.#currentActor.id === actorId) {
                await this._handleTurnEnd(actorId, subscriptionError);
            }
            return;
        }
        this.#logger.debug(`${className}: Successfully subscribed to '${TURN_ENDED_ID}' for actor ${actorId}.`);
    }

    async _promptPlayerForAction(actor) {
        const className = this.constructor.name;
        const actorId = actor?.id || 'INVALID_ACTOR'; // Should be valid string if startTurn validation passed

        if (!this.#currentActor || this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}: _promptPlayerForAction: Skipping prompt for actor ${actorId}. Actor is not current (current actor: ${this.#currentActor?.id || 'none'}).`);
            return;
        }
        this.#_assertTurnActiveFor(actorId); // Asserts current actor, if it fails, error is thrown.

        this.#logger.debug(`${className}: Delegating prompt for actor ${actorId} to PlayerPromptService.`);
        try {
            await this.#playerPromptService.prompt(actor);
            this.#logger.debug(`${className}: PlayerPromptService.prompt completed for actor ${actorId}.`);
        } catch (error) {
            const detailedErrorMessage = `${className}: PlayerPromptService threw an error during prompt for actor ${actorId}: ${error.message}`;
            this.#logger.error(detailedErrorMessage, error);
            // Ensure the error message is prefixed if it's not already, for easier tracing.
            if (!error.message.startsWith(`${className}: PlayerPromptService threw an error`)) {
                error.message = detailedErrorMessage; // Modifying error in place
            }

            if (this.#currentActor && this.#currentActor.id === actorId) {
                this.#logger.info(`${className}: Signalling FAILED turn end for ${actorId} due to PlayerPromptService error.`);
                await this._handleTurnEnd(actorId, error);
            } else {
                // This case means actor changed *during* the error handling of this catch block, or was already not current.
                this.#logger.warn(`${className}: PlayerPromptService error for ${actorId}, but actor is no longer current (current: ${this.#currentActor?.id || 'none'}). Turn end not handled by this path.`);
            }
            throw error; // Re-throw for higher-level awareness if needed
        }
    }

    async _handleTurnEnd(actorId, error = null) {
        const className = this.constructor.name;
        const isSuccess = (error === null || error === undefined);
        const endingStatus = isSuccess ? 'success' : 'failure';
        const currentActorAtCall = this.#currentActor; // Capture for logging

        this.#logger.debug(`${className}: _handleTurnEnd called for actor ${actorId} (status: ${endingStatus}). Current actor: ${currentActorAtCall?.id || 'none'}. Awaiting event for: ${this.#awaitingTurnEndForActorId || 'none'}.`);

        if (!currentActorAtCall || currentActorAtCall.id !== actorId) {
            let logContextDetail = `actor ${actorId} is not the current actor (current: ${currentActorAtCall?.id || 'none'})`;
            if (this.#awaitingTurnEndForActorId === actorId) {
                logContextDetail = `actor ${actorId} was awaited, but is not current (current: ${currentActorAtCall?.id || 'none'})`;
            }
            this.#logger.warn(`${className}: _handleTurnEnd: ${logContextDetail}. TurnEndPort NOT notified by this call. Resetting state for context '${actorId}'.`);
            this._resetTurnStateAndResources(actorId); // Reset for the specified actorId context
            return;
        }

        this.#isTerminatingNormally = true;
        this.#logger.info(`${className}: Finalizing turn for ${actorId} (status: ${endingStatus}).`);

        if (!isSuccess) {
            const reasonMsg = error instanceof Error ? error.message : String(error);
            this.#logger.warn(`${className}: Turn for ${actorId} ended with failure. Reason: ${reasonMsg}`);
        }

        try {
            this.#logger.debug(`${className}: Notifying TurnEndPort for actor ${actorId} (success: ${isSuccess}).`);
            await this.#turnEndPort.notifyTurnEnded(actorId, isSuccess);
            this.#logger.debug(`${className}: TurnEndPort notified for ${actorId}.`);
        } catch (notifyError) {
            this.#logger.error(`${className}: CRITICAL - Error notifying TurnEndPort for ${actorId}: ${notifyError.message}. External state might be inconsistent. Handler state will reset.`, notifyError);
        }

        this.#logger.debug(`${className}: Calling _resetTurnStateAndResources for actor ${actorId} post-notification.`);
        this._resetTurnStateAndResources(actorId);

        this.#logger.debug(`${className}: _handleTurnEnd sequence completed for actor ${actorId}.`);
    }

    #_isTurnValidForActor(actorId) {
        const className = this.constructor.name;
        // These logs are specific and clearly indicate the point of failure.
        if (this.#isDestroyed) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for actor ${actorId}; handler is destroyed.`);
            return false;
        }
        if (!this.#currentActor) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for actor ${actorId}; no current actor.`);
            return false;
        }
        if (this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for actor ${actorId}; current actor is ${this.#currentActor.id}.`);
            return false;
        }
        return true;
    }

    #_assertTurnActiveFor(actorId) {
        const className = this.constructor.name;
        // These are assertion errors, their messages are primary.
        if (this.#isDestroyed) {
            throw new Error(`${className}: Assertion Failed - Handler is destroyed. Cannot process for actor '${actorId}'.`);
        }
        if (!this.#currentActor) {
            throw new Error(`${className}: Assertion Failed - Turn not active. Expected actor '${actorId}', but no turn in progress.`);
        }
        if (this.#currentActor.id !== actorId) {
            throw new Error(`${className}: Assertion Failed - Incorrect actor. Expected '${actorId}', current is '${this.#currentActor.id}'.`);
        }
    }

    #clearTurnEndWaitingMechanisms() {
        const className = this.constructor.name;
        const actorContextForLog = this.#awaitingTurnEndForActorId || (this.#currentActor ? this.#currentActor.id : 'general_cleanup');

        if (this.#isAwaitingTurnEndEvent) {
            this.#logger.debug(`${className}.#clearTurnEndWaitingMechanisms: Unsubscribing from '${TURN_ENDED_ID}' for actor context '${actorContextForLog}'.`);
            this.#subscriptionManager.unsubscribeFromTurnEnded();
        } else {
            this.#logger.debug(`${className}.#clearTurnEndWaitingMechanisms: No active wait for '${TURN_ENDED_ID}' event for context '${actorContextForLog}'. Flags reset. No unsubscription needed.`);
        }

        if (this.#isAwaitingTurnEndEvent || this.#awaitingTurnEndForActorId) {
            this.#logger.debug(`${className}.#clearTurnEndWaitingMechanisms: Resetting turn end wait flags (was awaiting: ${this.#isAwaitingTurnEndEvent}, for actor: ${this.#awaitingTurnEndForActorId || 'null'}).`);
        }
        this.#isAwaitingTurnEndEvent = false;
        this.#awaitingTurnEndForActorId = null;
    }


    signalNormalApparentTermination() {
        const className = this.constructor.name;
        this.#logger.debug(`${className}: Normal apparent termination signalled for actor: ${this.#currentActor?.id || this.#awaitingTurnEndForActorId || 'N/A'}. Setting #isTerminatingNormally=true.`);
        this.#isTerminatingNormally = true;
    }

    destroy() {
        const className = this.constructor.name;
        const initialCurrentActorId = this.#currentActor?.id;
        const actorIdForCleanupLog = initialCurrentActorId || this.#awaitingTurnEndForActorId || 'destroy_context_N/A';

        if (this.#isDestroyed) {
            this.#logger.debug(`${className}: Already destroyed. Skipping destruction for context: ${actorIdForCleanupLog}.`);
            return;
        }
        this.#isDestroyed = true;

        this.#logger.info(`${className}: Destroying handler instance (context: ${actorIdForCleanupLog}). Initial current actor: ${initialCurrentActorId || 'null'}. Normally terminating: ${this.#isTerminatingNormally}.`);

        if (initialCurrentActorId) {
            if (!this.#isTerminatingNormally) {
                this.#logger.warn(`${className}: Destroying during active turn for ${initialCurrentActorId} (not normally terminated). Failsafe: notifying TurnEndPort of failure.`);
                this.#turnEndPort.notifyTurnEnded(initialCurrentActorId, false)
                    .catch(notifyErr => {
                        this.#logger.error(`${className}: Error in failsafe TurnEndPort notification for ${initialCurrentActorId} during destroy: ${notifyErr.message}`, notifyErr);
                    });
            } else {
                this.#logger.debug(`${className}: Destroying for ${initialCurrentActorId} (normally terminated). Failsafe TurnEndPort notification skipped.`);
            }
        } else {
            const noActorContext = this.#awaitingTurnEndForActorId ? `awaiting turn end for ${this.#awaitingTurnEndForActorId}` : 'no active or awaited actor';
            this.#logger.debug(`${className}: Destroying handler (${noActorContext}). No failsafe notification needed (no primary active actor).`);
        }

        this.#logger.debug(`${className}: Calling _resetTurnStateAndResources during destroy (context: ${actorIdForCleanupLog}).`);
        this._resetTurnStateAndResources(actorIdForCleanupLog);

        // Note: this.#isTerminatingNormally is reset to false by _resetTurnStateAndResources
        this.#logger.info(`${className}: Destruction completed for handler instance (context: ${actorIdForCleanupLog}). State: destroyed=true, currentActor=null.`);
    }

    /* istanbul ignore next */
    _TEST_SET_CURRENT_ACTOR(actor) {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            this.#currentActor = actor;
        } else {
            this.#logger.error(`${this.constructor.name}: _TEST_SET_CURRENT_ACTOR is for testing purposes only and should not be called in production.`);
        }
    }

    /* istanbul ignore next */
    _TEST_GET_CURRENT_ACTOR() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            return this.#currentActor;
        }
        this.#logger.error(`${this.constructor.name}: _TEST_GET_CURRENT_ACTOR is for testing purposes only.`);
        return null;
    }

    /* istanbul ignore next */
    _TEST_GET_COMMAND_OUTCOME_INTERPRETER() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            return this.#commandOutcomeInterpreter;
        }
        this.#logger.error(`${this.constructor.name}: _TEST_GET_COMMAND_OUTCOME_INTERPRETER is for testing purposes only.`);
        return null;
    }

    /* istanbul ignore next */
    _TEST_GET_SAFE_EVENT_DISPATCHER() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            return this.#safeEventDispatcher;
        }
        this.#logger.error(`${this.constructor.name}: _TEST_GET_SAFE_EVENT_DISPATCHER is for testing purposes only.`);
        return null;
    }

    /* istanbul ignore next */
    _TEST_SET_COMMAND_OUTCOME_INTERPRETER_TO_NULL() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            this.#commandOutcomeInterpreter = null;
        } else {
            this.#logger.error(`${this.constructor.name}: _TEST_SET_COMMAND_OUTCOME_INTERPRETER_TO_NULL is for testing purposes only.`);
        }
    }
}

export default PlayerTurnHandler;
// --- FILE END ---