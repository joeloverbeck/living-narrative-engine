// src/core/handlers/playerTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  PlayerTurnHandler  – MODIFIED TO EXTEND BaseTurnHandler & USE ITurnContext
// ──────────────────────────────────────────────────────────────────────────────

// ── Base Class Import ────────────────────────────────────────────────────────
import {BaseTurnHandler} from './baseTurnHandler.js';

// ── Interface Imports ────────────────────────────────────────────────────────
// ITurnHandler interface is conceptually implemented by extending BaseTurnHandler.
// import {ITurnHandler} from '../../interfaces/ITurnHandler.js';
import {ITurnContext} from '../interfaces/ITurnContext.js'; // For type casting if needed, though states get it.

// ── Class Imports ────────────────────────────────────────────────────────────
import {TurnContext} from '../context/turnContext.js'; // Concrete TurnContext for instantiation

// ── State Imports ────────────────────────────────────────────────────────────
import {TurnIdleState} from '../states/turnIdleState.js'; // Used for initial state

// ── Type-Only JSDoc Imports ─────────────────────────────────────────────────
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../interfaces/IPlayerPromptService.js').IPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../context/turnContext.js').TurnContextServices} TurnContextServices */

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
                    logger,
                    commandProcessor,
                    turnEndPort,
                    playerPromptService,
                    commandOutcomeInterpreter,
                    safeEventDispatcher,
                    subscriptionLifecycleManager,
                    gameWorldAccess = {}
                }) {
        // Pass logger and an instance of TurnIdleState constructed with 'this' PlayerTurnHandler instance.
        super({logger, initialConcreteState: new TurnIdleState(self || this)}); // 'self' or 'this' should resolve to PlayerTurnHandler instance

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
     * Initiates a new player turn. Creates and sets the ITurnContext.
     * @param {Entity} actor
     */
    async startTurn(actor) {
        super._assertHandlerActive(); // Use inherited assertion

        if (!actor) {
            this._logger.error("PlayerTurnHandler.startTurn: actor is required.");
            throw new Error("PlayerTurnHandler.startTurn: actor is required.");
        }

        this._setCurrentActorInternal(actor); // Set actor on handler

        /** @type {TurnContextServices} */
        const servicesForContext = {
            playerPromptService: this.#playerPromptService,
            game: this.#gameWorldAccess,
            commandProcessor: this.#commandProcessor,
            commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
            safeEventDispatcher: this.#safeEventDispatcher,
            subscriptionManager: this.#subscriptionManager,
            turnEndPort: this.#turnEndPort,
        };

        const newTurnContext = new TurnContext({
            actor: actor,
            // Use this.getLogger() to ensure consistent logger access (might be overridden or from context if logic changes)
            // However, for context creation, the handler's direct logger is fine.
            logger: this._logger,
            services: servicesForContext,
            // Pass bound versions of the *handler's* methods to the context
            onEndTurnCallback: (errorOrNull) => this._handleTurnEnd(actor.id, errorOrNull),
            isAwaitingExternalEventProvider: this._getIsAwaitingExternalTurnEndFlag.bind(this),
            onSetAwaitingExternalEventCallback: (isAwaiting, anActorId) => this._markAwaitingTurnEnd(isAwaiting, anActorId), // New callback
            handlerInstance: this // Pass the handler instance itself
        });
        this._setCurrentTurnContextInternal(newTurnContext); // Set context on handler

        this._logger.debug(`PlayerTurnHandler.startTurn: TurnContext created for actor ${actor.id}.`);

        // Delegate to current state (which should be TurnIdleState).
        // The state will receive 'this' (PlayerTurnHandler instance) as its handler context.
        // States will then use handler.getTurnContext() to get the ITurnContext.
        await this._currentState.startTurn(this, actor);
    }


    /**
     * @override
     * PlayerTurnHandler specific resource reset.
     * Calls super to reset base resources, then cleans up PTH specific resources.
     * @param {string} [actorIdContextForLog='N/A']
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        const logCtx = actorIdContextForLog || (this.getCurrentActor()?.id ?? 'PTH-reset');
        this._logger.debug(`${this.constructor.name}._resetTurnStateAndResources specific cleanup for '${logCtx}'.`);

        // 1. Call base class reset first (clears _currentTurnContext and _currentActor on BaseTurnHandler)
        super._resetTurnStateAndResources(logCtx);

        // 2. PlayerTurnHandler specific: Clear "awaiting external turn-end" bookkeeping
        this._clearTurnEndWaitingMechanismsInternal();

        // 3. PlayerTurnHandler specific: Drop all dynamic subscriptions
        try {
            this.#subscriptionManager.unsubscribeAll();
            this._logger.debug(`${this.constructor.name}: All subscriptions managed by SubscriptionLifecycleManager unsubscribed for '${logCtx}'.`);
        } catch (err) {
            this._logger.warn(`${this.constructor.name}: unsubscribeAll failed during reset for '${logCtx}' \u2013 ${err.message}`, err);
        }

        // 4. PlayerTurnHandler specific: Reset transient flags
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
        // Initial log is in PlayerTurnHandler, super.destroy() will also log.
        this._logger.info(`${this.constructor.name}.destroy() invoked (Player specific part). Current state: ${this._currentState.getStateName()}`);

        const initialActorIdForDestroy = this.getCurrentActor()?.id || null;

        // Logic regarding #isTerminatingNormally and forcing _handleTurnEnd
        // needs to be evaluated carefully in relation to BaseTurnHandler.destroy().
        // BaseTurnHandler.destroy() calls state.destroy(), then _resetTurnStateAndResources, then transitions to Idle.
        // If a turn was active, state.destroy() should ideally call turnCtx.endTurn(), which triggers _handleTurnEnd.

        // Mark as destroyed early in BaseTurnHandler.destroy()
        // super.destroy() will handle calling this._currentState.destroy(this)
        // and then this._resetTurnStateAndResources and transition to idle.

        // If PlayerTurnHandler needs to ensure #isTerminatingNormally influences _handleTurnEnd
        // before super.destroy() takes over, that logic might need adjustment.
        // For now, assuming super.destroy() covers the core sequence.
        // If the active state's destroy method calls context.endTurn(),
        // our _handleTurnEnd will be called. It uses actorId and error.
        // The 'fromDestroy' flag in _handleTurnEnd is implicitly true if 'this._isDestroyed' is true.

        // It's important that if a turn is active, it gets properly ended.
        // The current structure: PlayerTurnHandler.destroy() -> calls super.destroy()
        // super.destroy() -> calls this._currentState.destroy(this)
        // state.destroy() -> (if active turn) calls this.getTurnContext().endTurn()
        // endTurn() on context -> calls this._handleTurnEnd(actorId, error)
        // this._handleTurnEnd -> transitions to TurnEndingState
        // TurnEndingState -> calls this._resetTurnStateAndResources() and then transitions to TurnIdleState.
        // This sequence seems robust.

        // The original PlayerTurnHandler.destroy() had specific logic if !this.#isTerminatingNormally.
        // This flag is set by TurnEndingState.enterState() via signalNormalApparentTermination().
        // If super.destroy() correctly leads to TurnEndingState for an active turn, this flag will be set.
        // If destroy is called abruptly, this flag might not be set, and the original logic was to force _handleTurnEnd.
        // BaseTurnHandler.destroy already calls state.destroy(), which should lead to _handleTurnEnd.
        // If the state's destroy doesn't, or if no actor was active, base.destroy will still call reset.

        // This means the specific block for `if (initialActorIdForDestroy && !this.#isTerminatingNormally)`
        // might be redundant if `super.destroy()` handles it properly through state.destroy().
        // Let's rely on super.destroy() for now and simplify this override.
        // We still need to call super.destroy().

        await super.destroy(); // This will call current state's destroy, reset resources, and go to Idle.

        this._logger.debug(`${this.constructor.name}.destroy() player-specific handling complete (delegated most to base).`);
    }


    // --- PlayerTurnHandler Specific Protected/Private Methods ---

    /**
     * Marks or clears the flag indicating the handler is waiting for an external `core:turn_ended` event.
     * @param {boolean} isAwaiting - True if awaiting, false otherwise.
     * @param {string|null} [actorId=null] - The ID of the actor for whom the turn end is awaited.
     * @protected
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
     * Resets internal PTH flags. Event unsubscription is managed by SubscriptionLifecycleManager
     * or specific states.
     * @private
     */
    _clearTurnEndWaitingMechanismsInternal() {
        if (this.#isAwaitingTurnEndEvent || this.#awaitingTurnEndForActorId) {
            this._logger.debug(`${this.constructor.name}: Clearing turn-end waiting flags (was ${this.#isAwaitingTurnEndEvent} for ${this.#awaitingTurnEndForActorId}).`);
        }
        this._markAwaitingTurnEnd(false); // Resets the flags via the protected method
    }

    /**
     * Signals that the handler's current turn processing is expected to terminate normally.
     * Used by TurnEndingState to inform PlayerTurnHandler.destroy() that a forced _handleTurnEnd
     * by destroy() itself might not be necessary if destruction happens concurrently.
     * @public // Called by TurnEndingState
     */
    signalNormalApparentTermination() {
        this.#isTerminatingNormally = true;
        this._logger.debug(`${this.constructor.name}: Normal apparent termination signaled.`);
    }


    // --- Public Getters for Player-Specific Services ---
    // These might be deprecated if no external system (other than states) uses them.
    // States should now primarily use ITurnContext to get services.

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
    get subscriptionManager() {
        this._assertHandlerActive();
        return this.#subscriptionManager;
    }

    // --- Overridable Hooks from BaseTurnHandler (Implement if PTH has specific logic) ---
    /**
     * @override
     * @param {ITurnState} currentState
     * @param {ITurnState | undefined} [previousState]
     */
    async onEnterState(currentState, previousState) {
        await super.onEnterState(currentState, previousState);
        // PlayerTurnHandler might have specific logic here if needed.
        // this._logger.debug(`${this.constructor.name} specific onEnterState: ${currentState.getStateName()}`);
    }

    /**
     * @override
     * @param {ITurnState} currentState
     * @param {ITurnState | undefined} [nextState]
     */
    async onExitState(currentState, nextState) {
        await super.onExitState(currentState, nextState);
        // PlayerTurnHandler might have specific logic here if needed.
        // this._logger.debug(`${this.constructor.name} specific onExitState: ${currentState.getStateName()}`);
    }

    // --- Methods called by states on the handler instance ---
    // These methods are part of an implicit contract with its states.
    // The 'handlerContext' parameter in state methods refers to 'this' PlayerTurnHandler instance.

    /**
     * Handles a command string submitted by the player.
     * Called by states (e.g., AwaitingPlayerInputState). The state itself receives ITurnContext.
     * This method on the handler orchestrates state logic.
     * @param {string} commandString - The command string.
     * @param {Entity} actorEntity - The actor submitting the command (usually from context via state).
     * @returns {Promise<void>}
     */
    async handleSubmittedCommand(commandString, actorEntity) {
        this._assertHandlerActive();
        const currentContext = this.getTurnContext(); // Get ITurnContext
        if (!currentContext || currentContext.getActor()?.id !== actorEntity.id) {
            this._logger.error(`${this.constructor.name}: handleSubmittedCommand actor mismatch or no context. Command for ${actorEntity.id}, context actor: ${currentContext?.getActor()?.id}.`);
            // Potentially end turn or throw error
            if (currentContext) currentContext.endTurn(new Error("Actor mismatch in handleSubmittedCommand"));
            else this._handleTurnEnd(actorEntity.id, new Error("No context in handleSubmittedCommand"));
            return;
        }

        if (!this._currentState || typeof this._currentState.handleSubmittedCommand !== 'function') {
            this._logger.error(`${this.constructor.name}: handleSubmittedCommand called, but current state ${this._currentState?.getStateName()} cannot handle it.`);
            throw new Error(`Current state ${this._currentState?.getStateName()} cannot handle submitted commands.`);
        }
        // The state's handleSubmittedCommand will use the ITurnContext it gets from this handler.
        // The state was constructed with 'this' (PlayerTurnHandler).
        await this._currentState.handleSubmittedCommand(this, commandString, actorEntity);
    }

    /**
     * Handles the `core:turn_ended` system event.
     * Called by states (e.g., AwaitingExternalTurnEndState).
     * @param {object} payload - The event payload.
     * @returns {Promise<void>}
     */
    async handleTurnEndedEvent(payload) {
        this._assertHandlerActive();
        const currentContext = this.getTurnContext(); // Get ITurnContext
        if (!currentContext) {
            this._logger.error(`${this.constructor.name}: handleTurnEndedEvent called but no ITurnContext is active.`);
            // This is a problematic state, might need to reset or throw
            return;
        }

        if (!this._currentState || typeof this._currentState.handleTurnEndedEvent !== 'function') {
            this._logger.error(`${this.constructor.name}: handleTurnEndedEvent called, but current state ${this._currentState?.getStateName()} cannot handle it.`);
            throw new Error(`Current state ${this._currentState?.getStateName()} cannot handle turn ended event.`);
        }
        // The state was constructed with 'this' (PlayerTurnHandler).
        await this._currentState.handleTurnEndedEvent(this, payload);
    }


    // --- Test-only hooks ---
    /* istanbul ignore next */
    _TEST_GET_INTERNAL_CURRENT_STATE() {
        return this._currentState;
    }

    /* istanbul ignore next */
    _TEST_GET_INTERNAL_TURN_CONTEXT() {
        return this.getTurnContext();
    }
}

export default PlayerTurnHandler;