// src/core/handlers/playerTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  PlayerTurnHandler  – MODIFIED TO EXTEND BaseTurnHandler & USE ITurnContext
// ──────────────────────────────────────────────────────────────────────────────

// ── Base Class Import ────────────────────────────────────────────────────────
import {BaseTurnHandler} from './baseTurnHandler.js';

// ── Interface Imports ────────────────────────────────────────────────────────
// ITurnHandler interface is conceptually implemented by extending BaseTurnHandler.
// import {ITurnHandler} from '../../interfaces/ITurnHandler.js';
// ITurnContext is used by states, which get the context from this handler.
// For type casting if needed, though states get it.
import {ITurnContext} from '../interfaces/ITurnContext.js';


// ── Class Imports ────────────────────────────────────────────────────────────
import {TurnContext} from '../context/turnContext.js'; // Concrete TurnContext for instantiation
// Import HumanPlayerStrategy for instantiation
import {HumanPlayerStrategy} from '../strategies/humanPlayerStrategy.js';


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
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */

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
    #playerPromptService; // Still injected, to be passed to TurnContext
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
        this.#playerPromptService = playerPromptService; // Store for context creation
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
     * This version instantiates HumanPlayerStrategy for the player actor and includes it
     * in the ITurnContext. Direct prompting is removed from this handler.
     * @param {Entity} actor
     */
    async startTurn(actor) {
        super._assertHandlerActive(); // Use inherited assertion

        if (!actor) {
            this._logger.error("PlayerTurnHandler.startTurn: actor is required.");
            throw new Error("PlayerTurnHandler.startTurn: actor is required.");
        }

        // TODO: Add check: if (!actor.hasComponent(PLAYER_COMPONENT_ID)) { ...error... }
        // For now, assume actor is a human player if passed to PlayerTurnHandler.

        this._setCurrentActorInternal(actor); // Set actor on handler

        // Instantiate HumanPlayerStrategy for this player's turn.
        // HumanPlayerStrategy itself doesn't take constructor deps in this version.
        // It will get IPlayerPromptService from the TurnContext.
        const humanPlayerStrategy = new HumanPlayerStrategy();
        this._logger.debug(`${this.constructor.name}: Instantiated HumanPlayerStrategy for actor ${actor.id}.`);

        /** @type {TurnContextServices} */
        const servicesForContext = {
            playerPromptService: this.#playerPromptService, // PTH makes PPS available in context
            game: this.#gameWorldAccess,
            commandProcessor: this.#commandProcessor,
            commandOutcomeInterpreter: this.#commandOutcomeInterpreter,
            safeEventDispatcher: this.#safeEventDispatcher,
            subscriptionManager: this.#subscriptionManager,
            turnEndPort: this.#turnEndPort,
            // The strategy instance is passed directly to TurnContext constructor below,
            // not as part of the general 'services' bag.
        };

        const newTurnContext = new TurnContext({
            actor: actor,
            logger: this._logger, // Or a child logger specific to this turn
            services: servicesForContext,
            strategy: humanPlayerStrategy, // Pass the strategy instance here
            onEndTurnCallback: (errorOrNull) => this._handleTurnEnd(actor.id, errorOrNull),
            isAwaitingExternalEventProvider: this._getIsAwaitingExternalTurnEndFlag.bind(this),
            onSetAwaitingExternalEventCallback: (isAwaiting, anActorId) => this._markAwaitingTurnEnd(isAwaiting, anActorId),
            handlerInstance: this
        });
        this._setCurrentTurnContextInternal(newTurnContext); // Set context on handler

        this._logger.debug(`PlayerTurnHandler.startTurn: TurnContext created for actor ${actor.id} with HumanPlayerStrategy.`);

        // Delegate to current state (which should be TurnIdleState).
        // The state will receive 'this' (PlayerTurnHandler instance) as its handler context.
        // AwaitingPlayerInputState will then use `turnContext.getStrategy().decideAction(turnContext)`.
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
        this._logger.info(`${this.constructor.name}.destroy() invoked (Player specific part). Current state: ${this._currentState.getStateName()}`);
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
    // For now, keeping them as they are used by the original code structure which the states hook into.
    // These are no longer directly used by PlayerTurnHandler for core prompting.

    /** @returns {IPlayerPromptService} */
    get playerPromptService() {
        this._assertHandlerActive();
        return this.#playerPromptService; // Still returned, but PTH doesn't call prompt() on it.
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
    // The role of these methods changes: they primarily delegate to the current state.

    /**
     * Handles a command string that was somehow submitted.
     * This method's primary role is now to delegate to the current state.
     * In the new flow, AwaitingPlayerInputState should obtain an ITurnAction via strategy,
     * and then transition to ProcessingCommandState. Direct command string submission
     * to PlayerTurnHandler should become less common or routed through states.
     * @param {string} commandString - The command string.
     * @param {Entity} actorEntity - The actor submitting the command (usually from context via state).
     * @returns {Promise<void>}
     */
    async handleSubmittedCommand(commandString, actorEntity) {
        this._assertHandlerActive();
        const currentContext = this.getTurnContext(); // Get ITurnContext
        if (!currentContext || currentContext.getActor()?.id !== actorEntity.id) {
            const errMsg = `${this.constructor.name}: handleSubmittedCommand actor mismatch or no context. Command for ${actorEntity.id}, context actor: ${currentContext?.getActor()?.id}.`;
            this._logger.error(errMsg);
            if (currentContext) currentContext.endTurn(new Error("Actor mismatch in handleSubmittedCommand"));
            else this._handleTurnEnd(actorEntity.id, new Error("No context in handleSubmittedCommand"));
            return;
        }

        if (!this._currentState || typeof this._currentState.handleSubmittedCommand !== 'function') {
            const errMsg = `${this.constructor.name}: handleSubmittedCommand called, but current state ${this._currentState?.getStateName()} cannot handle it.`;
            this._logger.error(errMsg);
            // If current state cannot handle it, this might be an error.
            // Consider ending turn or throwing.
            currentContext.endTurn(new Error(errMsg));
            return;
        }
        // Delegate to the current state.
        // The state was constructed with 'this' (PlayerTurnHandler).
        // AwaitingPlayerInputState's handleSubmittedCommand is now more of a fallback,
        // as its enterState should resolve the action via strategy.
        await this._currentState.handleSubmittedCommand(this, commandString, actorEntity);
    }

    /**
     * Handles the `core:turn_ended` system event.
     * Delegates to the current state.
     * @param {object} payload - The event payload.
     * @returns {Promise<void>}
     */
    async handleTurnEndedEvent(payload) {
        this._assertHandlerActive();
        const currentContext = this.getTurnContext(); // Get ITurnContext
        if (!currentContext) {
            this._logger.error(`${this.constructor.name}: handleTurnEndedEvent called but no ITurnContext is active. Payload actor: ${payload?.entityId}`);
            // If no context, and an event for a specific actor arrives, it's hard to handle.
            // If payload.entityId matches _awaitingTurnEndForActorId, we *might* attempt to end it.
            // However, without context, proper ending is difficult.
            // This suggests an unstable state. Let the current state attempt to handle it if it can.
            if (this._currentState && typeof this._currentState.handleTurnEndedEvent === 'function') {
                await this._currentState.handleTurnEndedEvent(this, payload);
            } else {
                this._logger.error(`${this.constructor.name}: No current state or state cannot handle turn ended event during no-context scenario.`);
            }
            return;
        }

        if (!this._currentState || typeof this._currentState.handleTurnEndedEvent !== 'function') {
            this._logger.error(`${this.constructor.name}: handleTurnEndedEvent called, but current state ${this._currentState?.getStateName()} cannot handle it.`);
            currentContext.endTurn(new Error(`Current state ${this._currentState?.getStateName()} cannot handle turn ended event.`));
            return;
        }
        // Delegate to the current state.
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
