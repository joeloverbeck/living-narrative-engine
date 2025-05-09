// src/core/handlers/playerTurnHandler.js
// --- FILE START ---

// --- Interface Imports ---
import {ITurnHandler} from '../interfaces/ITurnHandler.js';
// --- Constant Imports ---
import TurnDirective from '../constants/turnDirectives.js';
import {TURN_ENDED_ID} from '../constants/eventIds.js';
// --- State Imports ---
import {TurnIdleState} from '../turnStates/TurnIdleState.js'; // PTH-STATE-003

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {{ command: string }} CommandSubmitEventData */
/** @typedef {import('../commandProcessor.js').CommandResult} CommandResult */
/** @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */
/** @typedef {import('../turnStates/ITurnState.js').ITurnState} ITurnState */ // PTH-STATE-003


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
 * signaling turn completion.
 * This version incorporates a state pattern for managing the turn lifecycle. // PTH-STATE-003
 */
class PlayerTurnHandler extends ITurnHandler {
    // --- Private Fields ---
    /**
     * @type {ILogger}
     * @private
     */
    #logger;

    /**
     * @type {ICommandProcessor}
     * @private
     */
    #commandProcessor;

    /**
     * @type {ITurnEndPort}
     * @private
     */
    #turnEndPort;

    /**
     * @type {IPlayerPromptService}
     * @private
     */
    #playerPromptService;

    /**
     * @type {ICommandOutcomeInterpreter}
     * @private
     */
    #commandOutcomeInterpreter;

    /**
     * @type {ISafeEventDispatcher}
     * @private
     */
    #safeEventDispatcher;

    /**
     * @type {SubscriptionLifecycleManager}
     * @private
     */
    #subscriptionManager;

    /**
     * @type {Entity | null}
     * @private
     */
    #currentActor = null;

    /**
     * @type {boolean}
     * @private
     * @description Flag indicating if the handler is currently waiting for an external {@link TURN_ENDED_ID} event.
     * This will be managed by a specific state (e.g., AwaitingExternalTurnEndState).
     */
    #isAwaitingTurnEndEvent = false;

    /**
     * @type {string | null}
     * @private
     * @description The ID of the actor for whom the handler is awaiting the {@link TURN_ENDED_ID} event.
     * This will be managed by a specific state.
     */
    #awaitingTurnEndForActorId = null;

    /**
     * @type {boolean}
     * @private
     */
    #isDestroyed = false;

    /**
     * @type {boolean}
     * @private
     * @description Flag indicating if the turn is being terminated through a normal, expected flow.
     * This might be refactored or its relevance re-evaluated with state pattern.
     */
    #isTerminatingNormally = false;

    /** // PTH-STATE-003
     * @type {ITurnState}
     * @private
     */
    #currentState;


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

        this.#currentState = new TurnIdleState(this);
        this.#logger.debug(`${className} initialized successfully. Initial state: ${this.#currentState.getStateName()}`);
    }

    // --- Service Accessors for States ---
    /** @returns {ILogger} */
    get logger() {
        return this.#logger;
    }

    /** @returns {IPlayerPromptService} */
    get playerPromptService() {
        return this.#playerPromptService;
    }

    /** @returns {ICommandProcessor} */
    get commandProcessor() {
        return this.#commandProcessor;
    }

    /** @returns {ICommandOutcomeInterpreter} */
    get commandOutcomeInterpreter() {
        return this.#commandOutcomeInterpreter;
    }

    /** @returns {ITurnEndPort} */
    get turnEndPort() {
        return this.#turnEndPort;
    }

    /** @returns {ISafeEventDispatcher} */
    get safeEventDispatcher() {
        return this.#safeEventDispatcher;
    }

    /** @returns {SubscriptionLifecycleManager} */
    get subscriptionManager() {
        return this.#subscriptionManager;
    }

    // --- Actor Management (accessible by states via context) ---
    /** @returns {Entity | null} */
    getCurrentActor() {
        return this.#currentActor;
    }

    /** @param {Entity | null} actor */
    setCurrentActor(actor) {
        this.#currentActor = actor;
    }

    /** // +++ PTH-STATE-003
     * Transitions the handler to a new state.
     * This method orchestrates the exit from the current state and entry into the new state.
     * It ensures that `exitState` of the old state is called before `enterState` of the new state.
     *
     * @async
     * @private
     * @param {ITurnState} newState - The state instance to transition to.
     * @returns {Promise<void>} A promise that resolves when the transition is complete.
     * @throws {Error} Propagates errors from state `exitState` or `enterState` methods.
     */
    async _transitionToState(newState) {
        if (this.#isDestroyed) {
            this.#logger.warn(`${this.constructor.name}: #_transitionToState called on a destroyed handler. Transition to ${newState.getStateName()} aborted.`);
            return;
        }

        const previousState = this.#currentState;
        const previousStateName = previousState?.getStateName() ?? 'None';
        const newStateName = newState.getStateName();

        this.#logger.debug(`${this.constructor.name}: Attempting transition from ${previousStateName} to ${newStateName}.`);

        if (previousState && typeof previousState.exitState === 'function') {
            try {
                this.#logger.debug(`${this.constructor.name}: Calling exitState on ${previousStateName} (transitioning to ${newStateName}).`);
                await previousState.exitState(this, newState);
                this.#logger.debug(`${this.constructor.name}: exitState on ${previousStateName} completed.`);
            } catch (error) {
                this.#logger.error(`${this.constructor.name}: Error during exitState of ${previousStateName} (transitioning to ${newStateName}): ${error.message}`, error);
                throw error;
            }
        }

        this.#logger.info(`${this.constructor.name}: Transitioning from ${previousStateName} to ${newStateName}.`);

        this.#currentState = newState;
        this.#logger.debug(`${this.constructor.name}: #currentState updated to ${newStateName}.`);

        if (typeof this.#currentState.enterState === 'function') {
            try {
                this.#logger.debug(`${this.constructor.name}: Calling enterState on ${newStateName} (transitioned from ${previousStateName}).`);
                await this.#currentState.enterState(this, previousState);
                this.#logger.debug(`${this.constructor.name}: enterState on ${newStateName} completed.`);
            } catch (error) {
                this.#logger.error(`${this.constructor.name}: Error during enterState of ${newStateName} (transitioned from ${previousStateName}): ${error.message}`, error);
                // If enterState fails, we might be in an inconsistent state.
                // Depending on the error, we might want to attempt to transition to a safe state (e.g., TurnIdleState).
                // For now, re-throwing to indicate the transition failed.
                throw error;
            }
        } else {
            const criticalErrorMsg = `${this.constructor.name}: CRITICAL - New state ${newStateName} does not have an enterState method.`;
            this.#logger.error(criticalErrorMsg);
            throw new Error(criticalErrorMsg);
        }
        this.#logger.info(`${this.constructor.name}: Transition complete. Current state: ${this.#currentState.getStateName()}.`);
    }


    /**
     * Resets turn-specific flags and subscriptions. Does NOT change the current state.
     * State transitions (e.g., to an Idle state) must be handled via _transitionToState by the calling logic.
     * @private
     * @param {string} actorIdContextForLog - The actor ID for logging context, defaults to 'N/A'.
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        const className = this.constructor.name;
        this.#logger.debug(`${className}._resetTurnStateAndResources: Starting resource reset (flags, subscriptions) for actor context '${actorIdContextForLog}'.`);

        this.#logger.debug(`${className}._resetTurnStateAndResources: Calling unsubscribeAll via SubscriptionLifecycleManager.`);
        this.#subscriptionManager.unsubscribeAll();

        const oldActorId = this.#currentActor?.id || 'null';
        this.#logger.debug(`${className}._resetTurnStateAndResources: Resetting PTH internal flags: #currentActor (was ${oldActorId}), #isAwaitingTurnEndEvent (was ${this.#isAwaitingTurnEndEvent}), #awaitingTurnEndForActorId (was ${this.#awaitingTurnEndForActorId || 'null'}), #isTerminatingNormally (was ${this.#isTerminatingNormally}).`);

        this.#currentActor = null;
        this.#isAwaitingTurnEndEvent = false; // To be managed by AwaitingExternalTurnEndState
        this.#awaitingTurnEndForActorId = null; // To be managed by AwaitingExternalTurnEndState
        this.#isTerminatingNormally = false;

        this.#logger.debug(`${className}._resetTurnStateAndResources: Resource reset (flags, subscriptions) completed for actor context '${actorIdContextForLog}'. Current state remains ${this.#currentState.getStateName()}.`);
    }


    /**
     * Initiates the turn for a given player actor by delegating to the current state.
     * This method serves as the entry point for starting a turn. It first performs
     * essential pre-condition checks, such as ensuring the handler itself is not destroyed.
     * It then delegates the core turn initiation logic to the `startTurn` method
     * of its current state object ({@link ITurnState}).
     *
     * The promise returned by this method resolves when the initial phase of turn
     * setup by the state is complete (e.g., transition to an input-awaiting state
     * and initial player prompt), or rejects if a critical error occurs during this
     * delegation or initial state processing. This promise does not represent the
     * completion of the entire turn, which is signaled externally.
     *
     * @async
     * @override
     * @param {Entity} actor - The player entity whose turn is to be started.
     * @returns {Promise<void>} A promise that resolves upon successful delegation and
     * initial handling by the current state, or rejects on failure.
     * @throws {Error} If the handler is destroyed, or if the current state's `startTurn`
     * method throws an unrecoverable error.
     */
    async startTurn(actor) {
        const actorIdForLog = actor?.id ?? 'UNKNOWN_ACTOR';
        this.#logger.info(`${this.constructor.name}: Received request to start turn for actor ${actorIdForLog}. Delegating to current state: ${this.#currentState.getStateName()}`);

        if (this.#isDestroyed) {
            const errorMessage = `${this.constructor.name}: startTurn called on a destroyed handler for actor ${actorIdForLog}. Operation aborted.`;
            this.#logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        // Other top-level pre-condition checks (e.g. if a turn is already in progress)
        // are now primarily handled by the logic within specific states (e.g., TurnIdleState
        // will proceed, other states like AwaitingPlayerInputState will typically log an error
        // or be a no-op for a startTurn call).

        try {
            // The delegation to the state's startTurn method.
            // ITurnState.startTurn is expected to return Promise<void>.
            await this.#currentState.startTurn(this, actor);
        } catch (error) {
            // This catch block handles errors thrown directly by the state's startTurn
            // or if a state transition initiated by startTurn fails critically.
            // States themselves should handle most operational errors and may trigger
            // _handleTurnEnd (which in turn manages state transitions, e.g., to TurnEndingState).
            this.#logger.error(`${this.constructor.name}: Error during startTurn delegation to state ${this.#currentState.getStateName()} for actor ${actorIdForLog}: ${error.message}`, error);
            // Re-throw the error to signal failure to the caller.
            // More sophisticated error handling (e.g., attempting to force a reset to TurnIdleState)
            // could be added here if necessary, but often it's better if states manage their recovery
            // or signal unrecoverable errors.
            throw error;
        }
    }

    /**
     * Handles a command string submitted by the player by delegating to the current state.
     * This method is typically the entry point for command input after initial subscription.
     * @async
     * @private Lifecycle method, primarily called by subscription callbacks set up by states.
     * @param {string} commandString - The command string submitted by the player.
     * @returns {Promise<void>}
     * @throws {Error} Propagates errors from the current state's handleSubmittedCommand method.
     */
    async _handleSubmittedCommand(commandString) {
        if (this.#isDestroyed) {
            this.#logger.warn(`${this.constructor.name}: _handleSubmittedCommand called on a destroyed handler for command "${commandString}". Ignoring.`);
            return; // Return void promise
        }
        this.#logger.info(`${this.constructor.name}: _handleSubmittedCommand received command "${commandString}". Delegating to current state: ${this.#currentState.getStateName()}`);

        try {
            await this.#currentState.handleSubmittedCommand(this, commandString);
        } catch (error) {
            this.#logger.error(`${this.constructor.name}: Error during _handleSubmittedCommand delegation to state ${this.#currentState.getStateName()} for command "${commandString}": ${error.message}`, error);
            throw error;
        }
    }

    // --- Deprecated/Refactored Methods (logic moved to states) ---
    // These methods are kept temporarily to avoid breaking existing tests extensively.
    // Their direct calls should be phased out as states take over their responsibilities.

    async _handleEmptyCommand(actor) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _handleEmptyCommand called directly on PlayerTurnHandler. This logic should be in an active state (e.g., AwaitingPlayerInputState). Actor: ${actor?.id}. (Old logic)`);
        // In state pattern, AwaitingPlayerInputState.handleSubmittedCommand would handle empty strings.
    }

    async _handleCommandProcessorSuccess(actor, cmdProcResult, commandString) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _handleCommandProcessorSuccess called directly. Logic should be in ProcessingCommandState. Actor: ${actor?.id}. (Old logic)`);
        // In state pattern, ProcessingCommandState would handle this.
    }

    async _handleCommandProcessorFailure(actor, cmdProcResult, commandString) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _handleCommandProcessorFailure called directly. Logic should be in ProcessingCommandState. Actor: ${actor?.id}. (Old logic)`);
        // In state pattern, ProcessingCommandState would handle this.
    }

    async _executeRepromptStrategy(actor) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _executeRepromptStrategy called directly. This is a state-driven action (e.g., by ProcessingCommandState transitioning to AwaitingPlayerInputState). Actor: ${actor?.id}. (Old logic)`);
    }

    async _executeEndTurnFailureStrategy(actor, initialErrorOrInfo, directive, commandString) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _executeEndTurnFailureStrategy called directly. This is a state-driven action (e.g., by ProcessingCommandState transitioning to TurnEndingState). Actor: ${actor?.id}. (Old logic)`);
    }

    async _executeEndTurnSuccessStrategy(actor) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _executeEndTurnSuccessStrategy called directly. This is a state-driven action (e.g., by ProcessingCommandState transitioning to TurnEndingState). Actor: ${actor?.id}. (Old logic)`);
    }

    async _executeWaitForTurnEndEventStrategy(actor) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _executeWaitForTurnEndEventStrategy called directly. This is a state-driven action (e.g., by ProcessingCommandState transitioning to AwaitingExternalTurnEndState). Actor: ${actor?.id}. (Old logic)`);
    }

    async #_processValidatedCommand(actor, commandString) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: #_processValidatedCommand called directly. Logic is now part of states like AwaitingPlayerInputState or ProcessingCommandState. Actor: ${actor?.id}. (Old logic)`);
    }

    async #waitForTurnEndEvent(actor) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: #waitForTurnEndEvent called directly. This logic belongs to AwaitingExternalTurnEndState. Actor: ${actor?.id}. (Old logic)`);
    }

    async _promptPlayerForAction(actor) {
        const className = this.constructor.name;
        this.#logger.warn(`${className}: _promptPlayerForAction called directly on PlayerTurnHandler. States should use 'this.context.playerPromptService.prompt()'. Actor: ${actor?.id}. (Old logic)`);
        // In state pattern, AwaitingPlayerInputState.enterState calls playerPromptService.prompt().
    }

    /**
     * Handles the final steps common to ending a turn, like notifying external systems
     * and resetting PTH's turn-specific flags and subscriptions.
     * This method is intended to be called by a state (e.g., TurnEndingState)
     * as part of its `enterState` or other turn finalization logic.
     * It does NOT transition the state; the calling state is responsible for that.
     *
     * @async
     * @param {string} actorId - The ID of the actor whose turn is ending.
     * @param {Error | null} [error=null] - An optional error if the turn ended due to a failure.
     * @returns {Promise<void>}
     */
    async _handleTurnEnd(actorId, error = null) {
        const className = this.constructor.name;
        const isSuccess = (error === null || error === undefined);
        const endingStatus = isSuccess ? 'success' : 'failure';
        const pthCurrentActorAtCall = this.#currentActor; // Capture for consistent checking

        this.#logger.debug(`${className}: _handleTurnEnd called for actor ${actorId} (status: ${endingStatus}). PTH current actor: ${pthCurrentActorAtCall?.id || 'none'}. Current state: ${this.#currentState.getStateName()}`);

        // This method should only proceed if it's genuinely the end of the turn for the actor currently managed by PTH.
        // States should ensure they call this for the correct actor.
        if (!pthCurrentActorAtCall || pthCurrentActorAtCall.id !== actorId) {
            this.#logger.warn(`${className}: _handleTurnEnd called for actor ${actorId}, but PTH's current actor is ${pthCurrentActorAtCall?.id || 'none'}. TurnEndPort NOT notified for ${actorId} by this call. Resetting PTH resources for context '${actorId}'.`);
            this._resetTurnStateAndResources(actorId); // Reset flags/subscriptions for the given context.
            return;
        }

        this.#isTerminatingNormally = true; // Mark that termination is being handled.
        this.#logger.info(`${className}: Finalizing turn processing for ${actorId} (status: ${endingStatus}).`);

        if (!isSuccess) {
            const reasonMsg = error instanceof Error ? error.message : String(error);
            this.#logger.warn(`${className}: Turn for ${actorId} ended with failure. Reason: ${reasonMsg}`);
        }

        try {
            this.#logger.debug(`${className}: Notifying TurnEndPort for actor ${actorId} (success: ${isSuccess}).`);
            await this.#turnEndPort.notifyTurnEnded(actorId, isSuccess);
            this.#logger.debug(`${className}: TurnEndPort notified for ${actorId}.`);
        } catch (notifyError) {
            this.#logger.error(`${className}: CRITICAL - Error notifying TurnEndPort for ${actorId}: ${notifyError.message}. External state might be inconsistent. Resetting PTH flags/subscriptions.`, notifyError);
        }

        this.#logger.debug(`${className}: Calling _resetTurnStateAndResources for actor ${actorId} post-notification (flags, subscriptions).`);
        this._resetTurnStateAndResources(actorId); // Resets PTH flags and subscriptions.

        this.#logger.debug(`${className}: _handleTurnEnd sequence completed for actor ${actorId}. PTH flags/subscriptions reset. State machine (e.g., TurnEndingState) is responsible for transitioning to Idle state.`);
    }

    // --- Utility/Assertion methods (may be refactored or used by states) ---
    #_isTurnValidForActor(actorId) {
        const className = this.constructor.name;
        if (this.#isDestroyed) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for ${actorId}; handler destroyed.`);
            return false;
        }
        if (!this.#currentActor) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for ${actorId}; no #currentActor in PTH.`);
            return false;
        }
        if (this.#currentActor.id !== actorId) {
            this.#logger.warn(`${className}.#_isTurnValidForActor: Check failed for ${actorId}; PTH #currentActor is ${this.#currentActor.id}.`);
            return false;
        }
        return true;
    }

    #_assertTurnActiveFor(actorId) {
        const className = this.constructor.name;
        if (this.#isDestroyed) {
            throw new Error(`${className}: Assertion Failed - Handler is destroyed. Cannot process for actor '${actorId}'.`);
        }
        if (!this.#currentActor) {
            throw new Error(`${className}: Assertion Failed - PTH #currentActor not set. Expected actor '${actorId}'.`);
        }
        if (this.#currentActor.id !== actorId) {
            throw new Error(`${className}: Assertion Failed - Incorrect actor at PTH level. Expected '${actorId}', PTH #currentActor is '${this.#currentActor.id}'.`);
        }
    }

    #clearTurnEndWaitingMechanisms() {
        // This logic is now primarily responsibility of AwaitingExternalTurnEndState and _resetTurnStateAndResources.
        const className = this.constructor.name;
        this.#logger.debug(`${className}.#clearTurnEndWaitingMechanisms called. (Old logic - AwaitingExternalTurnEndState will manage its own subscriptions or _resetTurnStateAndResources clears all)`);

        // Unsubscribe specific turn ended subscription if one was made by AwaitingExternalTurnEndState
        // This implies SubscriptionLifecycleManager needs a more targeted unsubscribe or states manage their own unsubscribe functions.
        // The current #subscriptionManager.unsubscribeFromTurnEnded() is somewhat generic.
        // For now, this specific method is largely superseded by state exit logic / _resetTurnStateAndResources.

        // if (this.#isAwaitingTurnEndEvent) {
        //     this.#subscriptionManager.unsubscribeFromTurnEnded(); // This might be too broad if it's a generic method.
        // }
        this.#isAwaitingTurnEndEvent = false;
        this.#awaitingTurnEndForActorId = null;
    }

    signalNormalApparentTermination() {
        const className = this.constructor.name;
        this.#logger.debug(`${className}: signalNormalApparentTermination called. Setting #isTerminatingNormally=true. (Old logic - this flag is now set within _handleTurnEnd)`);
        this.#isTerminatingNormally = true;
    }

    /**
     * Destroys the PlayerTurnHandler, cleaning up resources and notifying the current state.
     * @public
     * @returns {void}
     */
    destroy() {
        const className = this.constructor.name;
        const initialCurrentActorIdForLog = this.#currentActor?.id || 'N/A_at_destroy_start';
        const currentStateAtDestroyStart = this.#currentState?.getStateName() ?? 'None';

        if (this.#isDestroyed) {
            this.#logger.debug(`${className}: Already destroyed. Skipping destruction for actor context: ${initialCurrentActorIdForLog}, current state: ${currentStateAtDestroyStart}.`);
            return;
        }
        this.#logger.info(`${className}: Destroying handler instance. Actor context: ${initialCurrentActorIdForLog}, Current state: ${currentStateAtDestroyStart}.`);
        this.#isDestroyed = true;

        // Call destroy on the current state, if it exists and has the method.
        // The state's destroy method is responsible for any state-specific cleanup
        // and potentially for finalizing the turn if it's active.
        if (this.#currentState && typeof this.#currentState.destroy === 'function') {
            this.#logger.debug(`${className}: Calling destroy() on current state: ${currentStateAtDestroyStart}.`);
            // State's destroy method is async, but we don't await it here in the main destroy flow
            // to prevent destroy() from becoming async itself if not strictly necessary.
            // Errors in state.destroy() should be logged by the state or by this catch.
            Promise.resolve(this.#currentState.destroy(this))
                .catch(err => {
                    this.#logger.error(`${className}: Error during state ${currentStateAtDestroyStart} destroy() call: ${err.message}`, err);
                });
        }

        // Failsafe: If a turn was active and not marked as terminating normally
        // (e.g., if state.destroy() didn't call _handleTurnEnd), notify turn end port.
        if (this.#currentActor && !this.#isTerminatingNormally) {
            this.#logger.warn(`${className}: Destroying during active turn for ${this.#currentActor.id} that was not marked as normally terminated. Failsafe: notifying TurnEndPort of failure.`);
            // Not awaiting here to keep destroy() synchronous.
            this.#turnEndPort.notifyTurnEnded(this.#currentActor.id, false)
                .catch(notifyErr => {
                    this.#logger.error(`${className}: Error in failsafe TurnEndPort notification for ${this.#currentActor.id} during destroy: ${notifyErr.message}`, notifyErr);
                });
        } else if (this.#currentActor) {
            this.#logger.debug(`${className}: Destroying for ${this.#currentActor.id}. Turn was either normally terminated or state's destroy handled it. Failsafe TurnEndPort notification skipped.`);
        } else {
            this.#logger.debug(`${className}: Destroying handler (no #currentActor at PTH level). No failsafe notification needed.`);
        }

        const actorIdForResetLog = this.#currentActor?.id || 'destroy_context_N/A';
        this.#logger.debug(`${className}: Calling _resetTurnStateAndResources (flags, subscriptions) during destroy (actor context: ${actorIdForResetLog}).`);
        this._resetTurnStateAndResources(actorIdForResetLog); // Clears #currentActor, subscriptions etc.

        // Force state to a safe, inert state.
        const finalStateLogName = this.#currentState?.getStateName() ?? 'None_before_final_set'; // Log previous state name
        this.#currentState = new TurnIdleState(this); // Explicitly set to TurnIdleState.
        // Note: We do not call enterState for this new TurnIdleState during destroy,
        // as the handler is being dismantled, not starting normal operation.
        this.#logger.info(`${className}: Destruction completed. Handler is destroyed. State forced to ${this.#currentState.getStateName()} (was ${finalStateLogName}). Current PTH actor: ${this.#currentActor?.id || 'null'}.`);
    }


    // --- Test-only methods ---
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

    /* istanbul ignore next */
    _TEST_GET_CURRENT_STATE() {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            return this.#currentState;
        }
        this.#logger.error(`${this.constructor.name}: _TEST_GET_CURRENT_STATE is for testing purposes only.`);
        return null;
    }

    /* istanbul ignore next */ // PTH-STATE-003
    async _TEST_TRANSITION_TO_STATE(newState) {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            if (this.#isDestroyed) {
                this.#logger.warn(`${this.constructor.name}: _TEST_TRANSITION_TO_STATE called on destroyed handler.`);
                return;
            }
            this.#logger.debug(`${this.constructor.name}._TEST_TRANSITION_TO_STATE: Test call to transition to ${newState.getStateName()}`);
            try {
                await this._transitionToState(newState);
            } catch (e) {
                this.#logger.error(`${this.constructor.name}._TEST_TRANSITION_TO_STATE: Error during test transition: ${e.message}`, e);
            }
        } else {
            this.#logger.error(`${this.constructor.name}: _TEST_TRANSITION_TO_STATE is for testing only.`);
        }
    }
}

export default PlayerTurnHandler;
// --- FILE END ---