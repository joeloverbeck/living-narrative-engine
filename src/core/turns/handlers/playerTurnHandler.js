// src/core/handlers/playerTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  PlayerTurnHandler  – MODIFIED TO EXTEND BaseTurnHandler
//  Related Tickets: 1.2 (Implement TurnContext), 1.3 (Create BaseTurnHandler)
//
//  This class now extends BaseTurnHandler, inheriting common turn lifecycle
//  logic (_transitionToState, _assertHandlerActive, _handleTurnEnd).
//  It remains responsible for Player-specific dependencies, TurnContext creation,
//  and managing player-specific turn flags and subscriptions.
// ──────────────────────────────────────────────────────────────────────────────

// ── Base Class Import ────────────────────────────────────────────────────────
import {BaseTurnHandler} from './baseTurnHandler.js';

// ── Interface Imports ────────────────────────────────────────────────────────
import {ITurnHandler} from '../../interfaces/ITurnHandler.js';
// ITurnContext is used for type casting, BaseTurnHandler provides getTurnContext()
// import {ITurnContext} from '../turns/interfaces/ITurnContext.js';

// ── Class Imports ────────────────────────────────────────────────────────────
import {TurnContext} from '../context/turnContext.js'; // Concrete TurnContext

// ── Constant Imports ─────────────────────────────────────────────────────────
// import {TURN_ENDED_ID} from '../../constants/eventIds.js'; // Not directly used here anymore for subscriptions

// ── State Imports ────────────────────────────────────────────────────────────
import {TurnIdleState} from '../states/turnIdleState.js'; // Used for initial state
// TurnEndingState is now handled by BaseTurnHandler's _handleTurnEnd

// ── Type-Only JSDoc Imports ─────────────────────────────────────────────────
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../entities/entity.js').default} Entity */
// /** @typedef {import('../../commandProcessor.js').CommandResult} CommandResult */ // Not directly used by PTH methods
/** @typedef {import('../../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../turns/context/TurnContext.js').TurnContextServices} TurnContextServices */

/** @typedef {import('../../services/subscriptionLifecycleManager.js').default} SubscriptionLifecycleManager */
/** @typedef {import('../states/ITurnState.js').ITurnState} ITurnState */


// ──────────────────────────────────────────────────────────────────────────────
//  Class Definition
// ──────────────────────────────────────────────────────────────────────────────
class PlayerTurnHandler extends BaseTurnHandler {
    // ── Player-Specific Private Fields (Dependencies & State) ────────────────
    /** @type {ICommandProcessor} */
    #commandProcessor;
    /** @type {ITurnEndPort} */
    #turnEndPort;
    /** @type {IPlayerPromptService} */
    #playerPromptService;
    /** @type {ICommandOutcomeInterpreter} */
    #commandOutcomeInterpreter;
    /** @type {ISafeEventDispatcher} */
    #safeEventDispatcher;
    /** @type {SubscriptionLifecycleManager} */
    #subscriptionManager;
    /** @type {object} */ // TODO: Define GameWorld or a minimal interface
    #gameWorldAccess;

    // Player-specific flags, managed by PlayerTurnHandler
    /** @type {boolean} */
    #isAwaitingTurnEndEvent = false;
    /** @type {string|null} */
    #awaitingTurnEndForActorId = null;
    /** @type {boolean} */
    #isTerminatingNormally = false; // Used by destroy() logic

    // ── Constructor ──────────────────────────────────────────────────────────
    /**
     * @param {object} deps
     * @param {ILogger} deps.logger
     * @param {ICommandProcessor} deps.commandProcessor
     * @param {ITurnEndPort} deps.turnEndPort
     * @param {IPlayerPromptService} deps.playerPromptService
     * @param {ICommandOutcomeInterpreter} deps.commandOutcomeInterpreter
     * @param {ISafeEventDispatcher} deps.safeEventDispatcher
     * @param {SubscriptionLifecycleManager} deps.subscriptionLifecycleManager
     * @param {object} [deps.gameWorldAccess]
     */
    constructor({
                    logger, // Required by BaseTurnHandler
                    commandProcessor,
                    turnEndPort,
                    playerPromptService,
                    commandOutcomeInterpreter,
                    safeEventDispatcher,
                    subscriptionLifecycleManager,
                    gameWorldAccess = {}
                }) {
        // Call BaseTurnHandler constructor with logger and initial state instance
        super({logger, initialConcreteState: new TurnIdleState(self)});
        // `self` here refers to the `PlayerTurnHandler` instance being constructed.
        // `TurnIdleState` needs the handler instance to call transitionToState, etc.

        // Validate Player-specific dependencies
        if (!commandProcessor) throw new Error('PlayerTurnHandler: commandProcessor is required');
        if (!turnEndPort) throw new Error('PlayerTurnHandler: turnEndPort is required');
        if (!playerPromptService) throw new Error('PlayerTurnHandler: playerPromptService is required');
        if (!commandOutcomeInterpreter) throw new Error('PlayerTurnHandler: commandOutcomeInterpreter is required');
        if (!safeEventDispatcher) throw new Error('PlayerTurnHandler: safeEventDispatcher is required');
        if (!subscriptionLifecycleManager) throw new Error('PlayerTurnHandler: subscriptionLifecycleManager is required');

        this.#commandProcessor = commandProcessor;
        this.#turnEndPort = turnEndPort;
        this.#playerPromptService = playerPromptService;
        this.#commandOutcomeInterpreter = commandOutcomeInterpreter;
        this.#safeEventDispatcher = safeEventDispatcher;
        this.#subscriptionManager = subscriptionLifecycleManager;
        this.#gameWorldAccess = gameWorldAccess;

        // _logger is inherited from BaseTurnHandler and set in super()
        this._logger.debug(`${this.constructor.name} player-specific dependencies initialised.`);
    }

    // --- Method Overrides from BaseTurnHandler (Abstract or for specific behavior) ---

    /**
     * @override
     * Initiates a new player turn.
     * @param {Entity} actor
     */
    async startTurn(actor) {
        super._assertHandlerActive(); // Use inherited assertion

        if (!actor) {
            this._logger.error("PlayerTurnHandler.startTurn: actor is required.");
            throw new Error("PlayerTurnHandler.startTurn: actor is required.");
        }

        this._setCurrentActorInternal(actor); // Set actor on handler (inherited protected method)

        /** @type {TurnContextServices} */
        const servicesForContext = {
            playerPromptService: this.#playerPromptService,
            game: this.#gameWorldAccess,
            commandProcessor: this.#commandProcessor,
            commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
            safeEventDispatcher: this.#safeEventDispatcher,
            subscriptionManager: this.#subscriptionManager, // For states that might use it
            turnEndPort: this.#turnEndPort,
        };

        const newTurnContext = new TurnContext({
            actor: actor,
            logger: this._logger, // Base logger, or could be a child logger: this._logger.createChild(...)
            services: servicesForContext,
            // Pass bound versions of the *handler's* methods to the context
            onEndTurnCallback: (errorOrNull) => this._handleTurnEnd(actor.id, errorOrNull),
            isAwaitingExternalEventProvider: this._getIsAwaitingExternalTurnEndFlag.bind(this)
        });
        this._setCurrentTurnContextInternal(newTurnContext); // Set context on handler (inherited protected method)

        this._logger.debug(`PlayerTurnHandler.startTurn: TurnContext created for actor ${actor.id}`);

        // Delegate to current state (which should be TurnIdleState)
        // The state will use `this` (PlayerTurnHandler) to transition,
        // and can access `this.getTurnContext()` (inherited from BaseTurnHandler).
        await this._currentState.startTurn(this, actor);
    }


    /**
     * @override
     * PlayerTurnHandler specific resource reset.
     * Calls super to reset base resources, then cleans up PTH specific resources.
     * @param {string} [actorIdContextForLog='N/A']
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        const logCtx = actorIdContextForLog || 'PTH-reset';
        this._logger.debug(`${this.constructor.name}._resetTurnStateAndResources specific cleanup for '${logCtx}'.`);

        // 1. Call base class reset first
        super._resetTurnStateAndResources(logCtx);

        // 2. PlayerTurnHandler specific: Clear "awaiting external turn-end" bookkeeping
        this._clearTurnEndWaitingMechanismsInternal(); // Clears PTH flags

        // 3. PlayerTurnHandler specific: Drop all dynamic subscriptions
        try {
            this.#subscriptionManager.unsubscribeAll();
            this._logger.debug(`${this.constructor.name}: All subscriptions managed by SubscriptionLifecycleManager unsubscribed for '${logCtx}'.`);
        } catch (err) {
            this._logger.warn(`${this.constructor.name}: unsubscribeAll failed during reset for '${logCtx}' \u2013 ${err.message}`, err);
        }

        // 4. PlayerTurnHandler specific: Reset transient flags to their idle defaults
        // #currentActor and #currentTurnContext are reset by super._resetTurnStateAndResources
        this.#isTerminatingNormally = false;

        this._logger.debug(`${this.constructor.name}: Player-specific state reset complete for '${logCtx}'.`);
    }


    /**
     * @override
     * Destroys the PlayerTurnHandler.
     */
    async destroy() {
        if (this._isDestroyed) {
            this._logger.debug(`${this.constructor.name}.destroy() called but already destroyed.`);
            return;
        }
        // Set _isDestroyed true early, but full logging of "invoked" is in super.destroy()
        // For PlayerTurnHandler, we need to handle the #isTerminatingNormally logic
        // *before* potentially calling _handleTurnEnd via super.destroy().

        this._logger.info(`${this.constructor.name}.destroy() invoked (Player specific part). Current state: ${this._currentState.getStateName()}`);

        const initialActorIdForDestroy = this.getCurrentActor()?.id || null; // Use getter

        try {
            // Allow current state to perform its specific teardown
            // The state receives `this` (the PlayerTurnHandler instance)
            await this._currentState.destroy(this);
        } catch (stateErr) {
            this._logger.warn(`${this.constructor.name}: currentState.destroy() errored \u2013 ${stateErr.message}`, stateErr);
        }

        // Failsafe for active turn not terminated normally by state's destroy
        if (initialActorIdForDestroy && !this.#isTerminatingNormally) {
            this._logger.warn(`${this.constructor.name}.destroy: Turn for ${initialActorIdForDestroy} might not have terminated normally via state. Forcing _handleTurnEnd.`);
            // This _handleTurnEnd is the inherited one from BaseTurnHandler.
            // It will transition to TurnEndingState, which calls _resetTurnStateAndResources.
            // The 'fromDestroy = true' bypasses the #isDestroyed check within _handleTurnEnd.
            await this._handleTurnEnd(
                initialActorIdForDestroy,
                new Error('PlayerTurnHandler destroyed unexpectedly during an active turn.'),
                true // fromDestroy flag
            );
        } else if (!initialActorIdForDestroy && !this.#isTerminatingNormally) {
            // If no actor was active, but we weren't already terminating normally,
            // ensure resources are reset. Base destroy will also call reset.
            this._logger.debug(`${this.constructor.name}.destroy: No active actor, ensuring PTH resources are reset.`);
            this._resetTurnStateAndResources('destroy-no-active-actor-pth');
        }
        // If it *was* terminating normally, _resetTurnStateAndResources would have been called by TurnEndingState.

        // Call super.destroy() to complete the destruction process (sets _isDestroyed, logs, final reset, transitions to Idle)
        await super.destroy();

        this._logger.debug(`${this.constructor.name}.destroy() player-specific handling complete.`);
    }


    // --- PlayerTurnHandler Specific Public Methods (if any beyond ITurnHandler contract) ---
    // These were protected helpers, now some are internal or part of reset.

    /**
     * Marks or clears the flag indicating the handler is waiting for an external `core:turn_ended` event.
     * @param {boolean} isAwaiting - True if awaiting, false otherwise.
     * @param {string|null} [actorId=null] - The ID of the actor for whom the turn end is awaited.
     * @protected // Or private if only called internally by PTH states or strategies
     */
    _markAwaitingTurnEnd(isAwaiting, actorId = null) {
        const prevFlag = this.#isAwaitingTurnEndEvent;
        const prevActor = this.#awaitingTurnEndForActorId;

        this.#isAwaitingTurnEndEvent = Boolean(isAwaiting);
        this.#awaitingTurnEndForActorId = this.#isAwaitingTurnEndEvent ? (actorId ?? null) : null;

        this._logger.debug(`${this.constructor.name}._markAwaitingTurnEnd: ${prevFlag}/${prevActor} \u2192 ${this.#isAwaitingTurnEndEvent}/${this.#awaitingTurnEndForActorId}`);
    }

    /**
     * Used by TurnContext's `isAwaitingExternalEventProvider` to check the flag.
     * @returns {boolean}
     * @private
     */
    _getIsAwaitingExternalTurnEndFlag() {
        return this.#isAwaitingTurnEndEvent;
    }

    /**
     * Clears mechanisms related to waiting for an external turn end event.
     * This primarily means resetting the internal PTH flags.
     * Specific unsubscriptions (like from TURN_ENDED_ID event) are usually managed
     * by the state that set them up (e.g., AwaitingExternalTurnEndState) or globally by _resetTurnStateAndResources.
     * @private
     */
    _clearTurnEndWaitingMechanismsInternal() {
        if (this.#isAwaitingTurnEndEvent || this.#awaitingTurnEndForActorId) {
            this._logger.debug(`${this.constructor.name}: Clearing turn-end waiting flags (was ${this.#isAwaitingTurnEndEvent} for ${this.#awaitingTurnEndForActorId}).`);
        }
        this._markAwaitingTurnEnd(false); // Resets the flags
        // Note: Actual event unsubscription is typically handled by SubscriptionLifecycleManager.unsubscribeAll()
        // called in the overridden _resetTurnStateAndResources, or by the specific state (AwaitingExternalTurnEndState).
    }

    /**
     * Signals that the handler's current turn processing is expected to terminate normally.
     * Used by TurnEndingState to inform PlayerTurnHandler.destroy() that a forced _handleTurnEnd
     * might not be necessary if destruction happens concurrently with normal termination.
     */
    signalNormalApparentTermination() {
        this.#isTerminatingNormally = true;
        this._logger.debug(`${this.constructor.name}: Normal apparent termination signaled.`);
    }


    // --- Public Getters for Player-Specific Services (if still needed directly by external systems) ---
    // States should primarily use getTurnContext().getPlayerPromptService() etc.
    // These are kept if external systems (not states) might still directly access them on PTH.

    /** @returns {IPlayerPromptService} */
    get playerPromptService() {
        this._assertHandlerActive();
        return this.#playerPromptService;
    }

    /** @returns {ICommandProcessor} */
    get commandProcessor() {
        this._assertHandlerActive();
        return this.#commandProcessor;
    }

    /** @returns {ICommandOutcomeInterpreter} */
    get commandOutcomeInterpreter() {
        this._assertHandlerActive();
        return this.#commandOutcomeInterpreter;
    }

    /** @returns {ITurnEndPort} */
    get turnEndPort() {
        this._assertHandlerActive();
        return this.#turnEndPort;
    }

    /** @returns {ISafeEventDispatcher} */
    get safeEventDispatcher() {
        this._assertHandlerActive();
        return this.#safeEventDispatcher;
    }

    /** @returns {SubscriptionLifecycleManager} */
    get subscriptionManager() { // Mainly for states to subscribe/unsubscribe
        this._assertHandlerActive();
        return this.#subscriptionManager;
    }

    // --- Overridable Hooks from BaseTurnHandler (Implement if PTH has specific logic) ---
    /**
     * @override
     */
    async onEnterState(currentState, previousState) {
        // PlayerTurnHandler might have specific logic here if needed.
        // For now, just call super to get the base logging.
        await super.onEnterState(currentState, previousState);
        // Example: if (currentState instanceof SomePlayerSpecificState) { /* do something */ }
    }

    /**
     * @override
     */
    async onExitState(currentState, nextState) {
        // PlayerTurnHandler might have specific logic here if needed.
        await super.onExitState(currentState, nextState);
    }


    // --- ITurnHandler Interface Methods (already implemented by Base or overridden above) ---
    // - startTurn(actor): Overridden above.
    // - destroy(): Overridden above.
    // - getCurrentActor(): Inherited from BaseTurnHandler.
    // - getTurnContext(): Inherited from BaseTurnHandler.
    // - getLogger(): Inherited from BaseTurnHandler.

    // Methods like handleSubmittedCommand, handleTurnEndedEvent are not on ITurnHandler
    // but are part of the state machine interaction, called by states on the handler instance.
    // BaseTurnHandler does not provide default implementations for these, as they are highly
    // dependent on the specific handler's capabilities and the states it uses.
    // However, since PlayerTurnHandler *is* the context for its states,
    // states will call these methods directly on the PlayerTurnHandler instance.
    // These methods are effectively part of an implicit contract with its states.

    /**
     * Handles a command string submitted by the player.
     * This method is called by states (e.g., AwaitingPlayerInputState).
     * @param {string} commandString - The command string.
     * @param {Entity} actor - The actor submitting the command (usually from context).
     * @returns {Promise<void>}
     */
    async handleSubmittedCommand(commandString, actor) {
        this._assertHandlerActive();
        if (!this._currentState || typeof this._currentState.handleSubmittedCommand !== 'function') {
            this._logger.error(`${this.constructor.name}: handleSubmittedCommand called, but current state ${this._currentState?.getStateName()} cannot handle it.`);
            throw new Error(`Current state ${this._currentState?.getStateName()} cannot handle submitted commands.`);
        }
        // Actor is passed to ensure the state has the correct context,
        // though it usually matches this.getCurrentActor().
        await this._currentState.handleSubmittedCommand(this, commandString, actor);
    }

    /**
     * Handles the `core:turn_ended` system event.
     * This method is called by states (e.g., AwaitingExternalTurnEndState).
     * @param {object} payload - The event payload.
     * @returns {Promise<void>}
     */
    async handleTurnEndedEvent(payload) {
        this._assertHandlerActive();
        if (!this._currentState || typeof this._currentState.handleTurnEndedEvent !== 'function') {
            this._logger.error(`${this.constructor.name}: handleTurnEndedEvent called, but current state ${this._currentState?.getStateName()} cannot handle it.`);
            throw new Error(`Current state ${this._currentState?.getStateName()} cannot handle turn ended event.`);
        }
        await this._currentState.handleTurnEndedEvent(this, payload);
    }


    // --- Test-only hooks ---
    /* istanbul ignore next */
    _TEST_GET_INTERNAL_CURRENT_STATE() { // Renamed to avoid clash if Base has similar
        return this._currentState;
    }

    /* istanbul ignore next */
    _TEST_GET_INTERNAL_TURN_CONTEXT() { // Renamed
        return this.getTurnContext(); // Use the public getter from Base
    }
}

// Ensure PlayerTurnHandler explicitly implements ITurnHandler for clarity,
// though BaseTurnHandler might also claim to (or a more generic IBaseTurnHandler could exist).
// For now, this is more a conceptual link as ITurnHandler might be a simpler interface.
// PlayerTurnHandler.prototype satisfies ITurnHandler

export default PlayerTurnHandler;