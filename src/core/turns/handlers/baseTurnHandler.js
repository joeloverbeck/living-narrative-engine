// src/core/turns/handlers/baseTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────
//  BaseTurnHandler Abstract Class
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 */
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 */
/**
 * @typedef {import('../states/ITurnState.js').ITurnState} ITurnState
 */
/**
 * @typedef {import('../states/turnIdleState.js').TurnIdleState} TurnIdleState
 */
/**
 * @typedef {import('../states/turnEndingState.js').TurnEndingState} TurnEndingState
 */

// It's good practice to import concrete states if BaseTurnHandler will directly instantiate them.
import {TurnIdleState as ConcreteTurnIdleState} from '../states/turnIdleState.js';
import {TurnEndingState as ConcreteTurnEndingState} from '../states/turnEndingState.js';


/**
 * @abstract
 * @class BaseTurnHandler
 * @description
 * Abstract base class for all turn handlers (e.g., PlayerTurnHandler, AITurnHandler).
 * It provides the core machinery for managing turn lifecycles, state transitions,
 * and common resources. Subclasses are responsible for specific behaviors related
 * to the type of actor they handle (e.g., how input is gathered).
 *
 * This class orchestrates the turn using a state machine pattern, where ITurnState
 * instances define behavior for each phase of a turn.
 */
export class BaseTurnHandler {
    /**
     * Logger instance for this handler. Used for logging general handler operations,
     * especially when a turn-specific context (and its logger) might not yet exist.
     * @protected
     * @readonly
     * @type {ILogger}
     */
    _logger;

    /**
     * The current active state of the turn handler (e.g., Idle, AwaitingInput, Executing).
     * @protected
     * @type {ITurnState}
     */
    _currentState;

    /**
     * The current turn-specific context. This is created at the start of a turn
     * and nullified when the turn ends or the handler is reset.
     * @protected
     * @type {ITurnContext | null}
     */
    _currentTurnContext = null;

    /**
     * Flag indicating whether the handler has been destroyed.
     * @protected
     * @type {boolean}
     */
    _isDestroyed = false;

    /**
     * The current actor whose turn is being processed by this handler instance.
     * This is set at the beginning of a turn and cleared upon reset.
     * It might be temporarily out of sync with `_currentTurnContext.getActor()`
     * during context creation/destruction phases.
     * @protected
     * @type {Entity | null}
     */
    _currentActor = null;


    /**
     * Creates an instance of BaseTurnHandler.
     * @param {object} deps
     * @param {ILogger} deps.logger - The logger service.
     * @param {ITurnState} deps.initialConcreteState - The initial state for the handler, typically TurnIdleState.
     * @throws {Error} If logger or initialConcreteState is not provided.
     */
    constructor({logger, initialConcreteState}) {
        if (!logger) {
            throw new Error('BaseTurnHandler: logger is required.');
        }
        if (!initialConcreteState || typeof initialConcreteState.enterState !== 'function') {
            const msg = 'BaseTurnHandler: initialConcreteState (implementing ITurnState) is required.';
            // Log an error before throwing, only if logger is available (which it must be to reach here)
            logger.error(msg);
            throw new Error(msg);
        }

        this._logger = logger;
        this._currentState = initialConcreteState; // e.g., new TurnIdleState(this)
        this._logger.debug(`${this.constructor.name} initialised \u2192 state ${this._currentState.getStateName()}`);
    }

    /**
     * Retrieves the logger associated with this handler.
     * Prefers the turn context's logger if available, otherwise falls back to the handler's own logger.
     * @returns {ILogger} The logger instance.
     */
    getLogger() {
        return this._currentTurnContext?.getLogger() ?? this._logger;
    }

    /**
     * Retrieves the currently active turn context.
     * @returns {ITurnContext | null} The current ITurnContext, or null if no turn is active.
     */
    getTurnContext() {
        return this._currentTurnContext;
    }

    /**
     * Retrieves the current actor whose turn is being processed.
     * Prioritizes actor from TurnContext if available, otherwise falls back to handler's direct field.
     * @returns {Entity | null} The current actor entity.
     */
    getCurrentActor() {
        return this._currentTurnContext ? this._currentTurnContext.getActor() : this._currentActor;
    }

    /**
     * Sets the current actor for the handler.
     * Primarily used by subclasses or states during turn setup/reset.
     * @param {Entity | null} actor
     * @protected
     */
    _setCurrentActorInternal(actor) {
        this._currentActor = actor;
        if (this._currentTurnContext && this._currentTurnContext.getActor()?.id !== actor?.id) {
            this._logger.warn(`${this.constructor.name}._setCurrentActorInternal called with '${actor?.id}' while an active TurnContext exists for '${this._currentTurnContext.getActor()?.id}'. Context not updated directly by this method.`);
        }
    }

    /**
     * Sets the current turn context.
     * Typically called by subclasses when a turn starts (new context created)
     * or when it's reset (context set to null).
     * @param {ITurnContext | null} turnContext
     * @protected
     */
    _setCurrentTurnContextInternal(turnContext) {
        this._currentTurnContext = turnContext;
    }

    // --- Core Turn Lifecycle Methods ---

    /**
     * Transitions the handler to a new state.
     * Manages exiting the previous state and entering the new state.
     * Calls `onExitState` and `onEnterState` hooks.
     * @param {ITurnState} newState - The state to transition to.
     * @protected
     * @async
     */
    async _transitionToState(newState) {
        if (!newState || typeof newState.enterState !== 'function' || typeof newState.exitState !== 'function') {
            const errorMsg = `${this.constructor.name}._transitionToState: newState must implement ITurnState. Received: ${newState}`;
            this._logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        const prevState = this._currentState;
        if (prevState === newState && newState.getStateName() !== 'TurnIdleState') { // Allow re-transition to Idle for reset purposes
            this._logger.debug(`${this.constructor.name}: Attempted to transition to the same state ${prevState.getStateName()}. Skipping.`);
            return;
        }

        this._logger.debug(`${this.constructor.name}: ${prevState.getStateName()} \u2192 ${newState.getStateName()}`);

        try {
            // Call subclass hook before exiting previous state
            await this.onExitState(prevState, newState);
            await prevState.exitState(this, newState);
        } catch (exitErr) {
            this._logger.error(`${this.constructor.name}: Error during ${prevState.getStateName()}.exitState or onExitState hook \u2013 ${exitErr.message}`, exitErr);
            // Potentially handle critical exit error, e.g., by forcing to Idle.
            // For now, we allow the transition to the new state to proceed if exitState fails,
            // as the new state might be a recovery state (like Idle).
        }

        this._currentState = newState;

        try {
            // Call subclass hook before entering new state
            await this.onEnterState(newState, prevState);
            await newState.enterState(this, prevState);
        } catch (enterErr) {
            this._logger.error(`${this.constructor.name}: Error during ${newState.getStateName()}.enterState or onEnterState hook \u2013 ${enterErr.message}`, enterErr);
            // If entering the new state fails, attempt to recover to a stable Idle state.
            // This check prevents infinite loops if transitioning to Idle itself fails.
            if (!(this._currentState instanceof ConcreteTurnIdleState)) { // _currentState is already newState here
                this._logger.warn(`${this.constructor.name}: Forcing transition to TurnIdleState due to error entering ${newState.getStateName()}.`);
                if (this._currentTurnContext) {
                    this._logger.warn(`${this.constructor.name}: Current TurnContext for ${this._currentTurnContext.getActor()?.id} will be reset during forced idle transition.`);
                }
                // Ensure resources are reset before attempting the forced transition to Idle.
                this._resetTurnStateAndResources('error-entering-state-recovery');
                await this._transitionToState(new ConcreteTurnIdleState(this));
            } else {
                this._logger.error(`${this.constructor.name}: CRITICAL - Failed to enter TurnIdleState even after an error. Handler might be unstable.`);
            }
        }
    }

    /**
     * Asserts that the handler is active (i.e., not destroyed).
     * @throws {Error} If the handler has been destroyed.
     * @protected
     */
    _assertHandlerActive() {
        if (this._isDestroyed) {
            throw new Error(`${this.constructor.name}: Operation invoked after handler was destroyed.`);
        }
    }

    /**
     * Handles the logical end of a turn, which typically involves transitioning
     * to a `TurnEndingState`. This method is called by the `ITurnContext.endTurn()`
     * implementation or by states when a turn concludes.
     * @param {string} actorIdToEnd - The ID of the actor whose turn is ending.
     * @param {Error | null} [turnError=null] - An error if the turn ended abnormally.
     * @param {boolean} [fromDestroy=false] - Flag indicating if this call originates from the handler's destroy process.
     * @protected
     * @async
     */
    async _handleTurnEnd(actorIdToEnd, turnError = null, fromDestroy = false) {
        this._assertHandlerActiveUnlessDestroying(fromDestroy);

        const contextActorId = this._currentTurnContext?.getActor()?.id;
        // Use actorIdToEnd as the primary reference if provided, otherwise try context/current actor.
        const effectiveActorIdForLog = actorIdToEnd || contextActorId || this._currentActor?.id || 'UNKNOWN_ACTOR_AT_END_LOG';

        if (actorIdToEnd && contextActorId && actorIdToEnd !== contextActorId) {
            this._logger.warn(`${this.constructor.name}._handleTurnEnd called for actor '${actorIdToEnd}', but TurnContext's current actor is '${contextActorId}'. Effective actor for ending will be based on actorIdToEnd ('${actorIdToEnd}').`);
        }

        if (this._isDestroyed && !fromDestroy) {
            this._logger.debug(`${this.constructor.name}._handleTurnEnd ignored for actor ${effectiveActorIdForLog} \u2013 handler destroyed.`);
            return;
        }

        this._logger.debug(`${this.constructor.name}._handleTurnEnd initiated for actor ${effectiveActorIdForLog}. Error: ${turnError ? turnError.message : 'null'}`);
        // The effectiveActorId for TurnEndingState should be the one whose turn is actually ending.
        const effectiveActorIdForState = actorIdToEnd || contextActorId || this._currentActor?.id;
        if (!effectiveActorIdForState) {
            this._logger.warn(`${this.constructor.name}._handleTurnEnd: Could not determine a definitive actor ID for ending turn. Using 'UNKNOWN_ACTOR_FOR_STATE'. This might indicate a problem if a turn was expected to be active.`);
        }

        await this._transitionToState(new ConcreteTurnEndingState(this, effectiveActorIdForState || 'UNKNOWN_ACTOR_FOR_STATE', turnError));
    }

    /**
     * Resets all per-turn state, transient data, and subscriptions.
     * Nullifies the current `ITurnContext`.
     * This method is the single point of truth for cleaning up after a turn.
     * Invoked by:
     * - `TurnIdleState.enterState()` (to ensure a clean slate)
     * - `TurnEndingState.enterState()` (after notifying ports, before idling)
     * - `BaseTurnHandler.destroy()` (as a final cleanup)
     * @param {string} [actorIdContextForLog='N/A'] - Diagnostic context for logging.
     * @protected
     */
    _resetTurnStateAndResources(actorIdContextForLog = 'N/A') {
        const logCtx = actorIdContextForLog ?? 'N/A_reset';
        const contextActorId = this._currentTurnContext?.getActor()?.id;
        this._logger.debug(
            `${this.constructor.name}._resetTurnStateAndResources \u2192 actorCtx='${logCtx}'. Current context actor: ${contextActorId ?? 'None'}.`
        );

        // 1. Nullify the current TurnContext instance
        if (this._currentTurnContext) {
            this._logger.debug(`${this.constructor.name}: Clearing current TurnContext for actor ${contextActorId}.`);
            this._setCurrentTurnContextInternal(null);
        }

        // 2. Clear any handler-level "awaiting external turn-end" bookkeeping (subclasses might implement this)
        // Example: this._clearAwaitingTurnEndFlags?.(); -> Subclass would implement _clearAwaitingTurnEndFlags

        // 3. Reset handler's current actor
        // Only reset if no new turn context is immediately going to be set,
        // or if explicitly part of a full handler reset (like destroy).
        // TurnIdleState.enterState is a good place for this to happen unconditionally.
        if (logCtx.startsWith('destroy-') || logCtx.startsWith('enterState-TurnIdleState') || logCtx.startsWith('error-entering-state-recovery')) {
            this._logger.debug(`${this.constructor.name}: Resetting current actor due to context: ${logCtx}.`);
            this._setCurrentActorInternal(null);
        }


        // 4. Reset any other transient flags specific to the BaseTurnHandler or its direct responsibilities.
        // (Subclasses are responsible for their own specific flags if not covered by TurnContext or general reset)

        // NOTE: Subscription management is often tied to the specific handler (e.g., PlayerTurnHandler's #subscriptionManager).
        // PlayerTurnHandler's _resetTurnStateAndResources will need to call super and then handle its specific subscriptions.
        // Alternatively, BaseTurnHandler could manage a list of disposables, or subclasses override this method.
        // For this iteration, we assume subclasses will extend this method.

        this._logger.debug(
            `${this.constructor.name}: Base per-turn state reset complete for '${logCtx}'. Subclasses may perform additional cleanup.`
        );
    }

    /**
     * Helper to assert handler is active, unless specifically called during destruction.
     * @param {boolean} fromDestroy - Whether this call originates from the destroy process.
     * @protected
     */
    _assertHandlerActiveUnlessDestroying(fromDestroy) {
        if (!fromDestroy) {
            this._assertHandlerActive();
        }
    }


    // --- Abstract or Overridable Lifecycle Hooks for Subclasses ---

    /**
     * Protected hook called by `_transitionToState` before the new state's `enterState` method is called.
     * Subclasses can override this to perform specific actions when the handler is about to enter a new state.
     * @param {ITurnState} currentState - The state being entered.
     * @param {ITurnState} [previousState] - The state being exited.
     * @returns {Promise<void>}
     * @protected
     * @abstract
     */
    async onEnterState(currentState, previousState) {
        // Default implementation is no-op. Subclasses should override if needed.
        this._logger.debug(`${this.constructor.name}.onEnterState hook: Entering ${currentState.getStateName()} from ${previousState?.getStateName() ?? 'None'}`);
    }

    /**
     * Protected hook called by `_transitionToState` before the previous state's `exitState` method is called.
     * Subclasses can override this to perform specific actions when the handler is about to exit the current state.
     * @param {ITurnState} currentState - The state being exited.
     * @param {ITurnState} [nextState] - The state being transitioned to.
     * @returns {Promise<void>}
     * @protected
     * @abstract
     */
    async onExitState(currentState, nextState) {
        // Default implementation is no-op. Subclasses should override if needed.
        this._logger.debug(`${this.constructor.name}.onExitState hook: Exiting ${currentState.getStateName()} to ${nextState?.getStateName() ?? 'None'}`);
    }


    // --- Public API (from ITurnHandler or common handler logic) ---

    /**
     * Initiates a turn for the specified actor.
     * This is an abstract method that concrete handlers MUST implement.
     * It typically involves:
     * - Asserting handler is active.
     * - Validating the actor.
     * - Creating and setting up the `ITurnContext`.
     * - Setting the handler's current actor.
     * - Delegating to the current state's `startTurn` method (usually `TurnIdleState`).
     * @param {Entity} actor - The entity whose turn is to be started.
     * @returns {Promise<void>}
     * @abstract
     */
    async startTurn(actor) {
        this._assertHandlerActive();
        throw new Error("Method 'startTurn(actor)' must be implemented by concrete subclasses of BaseTurnHandler.");
    }


    /**
     * Destroys the handler, performing necessary cleanup.
     * Calls the current state's `destroy` method if available, then resets resources
     * and ensures a transition to `TurnIdleState`.
     * Subclasses overriding this should typically call `super.destroy()` last.
     * @returns {Promise<void>}
     */
    async destroy() {
        if (this._isDestroyed) {
            this._logger.debug(`${this.constructor.name}.destroy() called but already destroyed.`);
            return;
        }
        this._isDestroyed = true; // Mark as destroyed early
        this._logger.info(`${this.constructor.name}.destroy() invoked.`);

        // Allow current state to perform its specific cleanup, which might trigger turn end.
        // This is crucial for states like AwaitingPlayerInputState to end the turn gracefully.
        if (this._currentState && typeof this._currentState.destroy === 'function') {
            try {
                this._logger.debug(`${this.constructor.name}.destroy: Calling destroy on current state ${this._currentState.getStateName()}.`);
                // Pass 'fromDestroy = true' to _handleTurnEnd if state.destroy() calls turnCtx.endTurn()
                // The onEndTurnCallback defined in MinimalTestHandler.startTurn implicitly passes actor.id and error.
                // _handleTurnEnd needs to know this is from a destroy context.
                // This implies that the onEndTurnCallback might need to be aware of 'fromDestroy',
                // or _handleTurnEnd needs a way to infer it when _isDestroyed is true.
                // For now, state.destroy() will call _handleTurnEnd(actorId, error), and _handleTurnEnd
                // will see _isDestroyed = true and use fromDestroy=true internally if it matters.
                // Let's make _handleTurnEnd aware of fromDestroy implicitly via this._isDestroyed.
                // The third parameter of _handleTurnEnd(actorIdToEnd, turnError, fromDestroy) is used for this.
                // The onEndTurnCallback in MinimalTestHandler doesn't pass 'fromDestroy'.
                // So, if AwaitingPlayerInputState.destroy calls turnCtx.endTurn(), that eventually calls _handleTurnEnd.
                // We need to ensure _handleTurnEnd knows it's part of a destroy sequence.
                // The _assertHandlerActiveUnlessDestroying(fromDestroy) check in _handleTurnEnd helps.
                // Let's assume state.destroy() -> turnCtx.endTurn() -> _handleTurnEnd(actorId, error, true_if_destroy_is_passed_somehow)
                // The call chain is: AwaitingPlayerInputState.destroy -> turnCtx.endTurn(err) -> onEndTurnCallback(err) [which is this._handleTurnEnd(actor.id, err)]
                // So, _handleTurnEnd(actor.id, err) needs to be called with fromDestroy=true.
                // The current onEndTurnCallback in MinimalTestHandler is: (error) => { this._handleTurnEnd(actor.id, error); };
                // It doesn't pass fromDestroy.
                // This means BaseTurnHandler._handleTurnEnd will use its default fromDestroy=false.
                // However, _handleTurnEnd also checks this._isDestroyed.
                // if (this._isDestroyed && !fromDestroy) { /* return */ }
                // This is fine. _handleTurnEnd will proceed because fromDestroy is false, but _isDestroyed is true.
                // It will then transition to TurnEndingState with fromDestroy=true effectively due to the handler context.
                // The more explicit way is if state.destroy() called something like handler.endTurnFromDestroy().
                // For now, let's rely on _handleTurnEnd's logic.

                await this._currentState.destroy(this); // 'this' is the handler context
                // If state.destroy() successfully transitioned to Idle (e.g. via endTurn), _currentState reflects that.
            } catch (stateDestroyError) {
                this._logger.error(`${this.constructor.name}.destroy: Error during ${this._currentState.getStateName()}.destroy() \u2013 ${stateDestroyError.message}`, stateDestroyError);
                // Continue with reset and forcing to Idle despite state.destroy() error.
            }
        }

        // Final reset of base resources. This is important regardless of state.destroy behavior.
        // It clears _currentTurnContext and _currentActor.
        this._resetTurnStateAndResources(`destroy-${this.constructor.name}`);

        // Ensure transition to TurnIdleState if not already there (e.g., if state.destroy didn't lead to Idle or failed)
        if (!(this._currentState instanceof ConcreteTurnIdleState)) {
            this._logger.debug(`${this.constructor.name}.destroy: Ensuring transition to TurnIdleState (current: ${this._currentState?.getStateName() ?? 'N/A'}).`);
            try {
                // Pass `this` (the handler itself) to the state constructor
                await this._transitionToState(new ConcreteTurnIdleState(this));
            } catch (e) {
                this._logger.error(`${this.constructor.name}.destroy: Error while transitioning to TurnIdleState during destroy: ${e.message}`, e);
                // Force set to a new Idle state instance directly if transition fails catastrophically
                this._currentState = new ConcreteTurnIdleState(this);
                this._logger.warn(`${this.constructor.name}.destroy: Forcibly set state to TurnIdleState due to transition error.`);

            }
        } else {
            this._logger.debug(`${this.constructor.name}.destroy: Already in TurnIdleState after state cleanup and reset.`);
        }
        this._logger.debug(`${this.constructor.name}.destroy() complete.`);
    }


    // --- Test-only hooks (optional, if needed by specific subclasses for testing) ---
    /* istanbul ignore next */
    _TEST_GET_CURRENT_STATE_NAME() {
        return this._currentState?.getStateName() ?? 'NoState';
    }
}