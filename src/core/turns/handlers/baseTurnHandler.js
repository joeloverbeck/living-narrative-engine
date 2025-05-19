// src/core/turns/handlers/baseTurnHandler.js
// --- FILE START ---

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
// No longer directly instantiating concrete states like TurnIdleState from BaseTurnHandler constructor
// The initial state will be passed in by the concrete handler (e.g., PlayerTurnHandler)

// Import concrete states for type checking in specific scenarios if needed,
// but avoid direct instantiation if initial state comes from subclass.
import {TurnIdleState as ConcreteTurnIdleState} from '../states/turnIdleState.js';
import {TurnEndingState as ConcreteTurnEndingState} from '../states/turnEndingState.js';


/**
 * @abstract
 * @class BaseTurnHandler
 * @description
 * Abstract base class for all turn handlers (e.g., PlayerTurnHandler, AITurnHandler).
 * It provides the core machinery for managing turn lifecycles, state transitions,
 * and common resources like the ITurnContext. Subclasses are responsible for
 * specific behaviors related to the type of actor they handle and for providing
 * the initial concrete state.
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
     * The current turn-specific context. This is created at the start of a turn by
     * the concrete handler (e.g., PlayerTurnHandler) and nullified when the turn ends or the handler is reset.
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
     * This is set by the concrete handler at the beginning of a turn and cleared upon reset.
     * It should ideally always be in sync with `_currentTurnContext.getActor()` when a turn is active.
     * @protected
     * @type {Entity | null}
     */
    _currentActor = null;


    /**
     * Creates an instance of BaseTurnHandler.
     * Initializes basic properties like the logger.
     * The initial state must be set by the derived class constructor *after* calling super().
     * @param {object} deps
     * @param {ILogger} deps.logger - The logger service.
     * @throws {Error} If logger is not provided.
     */
    constructor({logger}) { // REMOVED initialConcreteState from params
        if (!logger) {
            console.error('BaseTurnHandler Constructor: logger is required.');
            throw new Error('BaseTurnHandler: logger is required.');
        }
        this._logger = logger;

        // Initialize other base fields if necessary
        this._currentTurnContext = null;
        this._isDestroyed = false;
        this._currentActor = null;
        this._currentState = null; // Explicitly null initially

        // REMOVED: Initialization log that used initialConcreteState. Can be added in derived class.
        // this._logger.debug(`${this.constructor.name} initialised. Initial state will be set by derived class.`);
    }

    /**
     * Retrieves the logger. Prefers the turn context's logger if available and valid,
     * otherwise falls back to the handler's own base logger.
     * @returns {ILogger} The logger instance.
     */
    getLogger() {
        if (this._currentTurnContext) {
            try {
                const contextLogger = this._currentTurnContext.getLogger();
                // Basic check to ensure getLogger() returned something sensible
                if (contextLogger && typeof contextLogger.info === 'function') {
                    return contextLogger;
                }
            } catch (e) {
                this._logger.warn(`Error accessing logger from TurnContext: ${e.message}. Falling back to base logger.`);
            }
        }
        return this._logger;
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
     * This method primarily defers to the `ITurnContext` if available,
     * falling back to the handler's `_currentActor` field only if no context exists.
     * During an active turn, `ITurnContext.getActor()` is the source of truth.
     * @returns {Entity | null} The current actor entity.
     */
    getCurrentActor() {
        if (this._currentTurnContext) {
            try {
                return this._currentTurnContext.getActor();
            } catch (e) {
                this.getLogger().warn(`Error accessing actor from TurnContext: ${e.message}. Falling back to _currentActor field.`);
                // Fall through to return this._currentActor in case of context error
            }
        }
        // If no context, _currentActor might still hold the last active actor if not properly cleared
        // by _resetTurnStateAndResources or if called outside a turn cycle.
        // It's more reliable to depend on context when available.
        return this._currentActor;
    }

    /**
     * Sets the current actor for the handler. Called by concrete handlers.
     * This should be called *before* `_setCurrentTurnContextInternal` if the context
     * relies on `this._currentActor` during its own initialization (though TurnContext constructor takes actor directly).
     * @param {Entity | null} actor
     * @protected
     */
    _setCurrentActorInternal(actor) {
        this.getLogger().debug(`${this.constructor.name}._setCurrentActorInternal: Setting current actor to ${actor?.id ?? 'null'}.`);
        this._currentActor = actor;
        // Warn if context exists and is for a different actor.
        if (this._currentTurnContext && this._currentTurnContext.getActor()?.id !== actor?.id) {
            this.getLogger().warn(`${this.constructor.name}._setCurrentActorInternal: Handler's actor set to '${actor?.id ?? 'null'}' while an active TurnContext exists for '${this._currentTurnContext.getActor()?.id}'. Context not updated by this method.`);
        }
    }

    /**
     * Sets the current turn context. Called by concrete handlers.
     * @param {ITurnContext | null} turnContext
     * @protected
     */
    _setCurrentTurnContextInternal(turnContext) {
        this.getLogger().debug(`${this.constructor.name}._setCurrentTurnContextInternal: Setting turn context to ${turnContext ? `object for actor ${turnContext.getActor()?.id}` : 'null'}.`);
        this._currentTurnContext = turnContext;
        // If a new context is set, ensure _currentActor aligns with it.
        if (turnContext) {
            // Ensure _currentActor is in sync if context is being set.
            if (this._currentActor?.id !== turnContext.getActor()?.id) {
                this.getLogger().debug(`${this.constructor.name}._setCurrentTurnContextInternal: Aligning _currentActor ('${this._currentActor?.id}') with new TurnContext actor ('${turnContext.getActor()?.id}').`);
                this._currentActor = turnContext.getActor();
            }
        } else {
            // If context is cleared, _resetTurnStateAndResources is usually responsible for _currentActor.
            // However, if called directly to nullify context, _currentActor might need explicit clearing
            // if it's not part of a full reset sequence. For safety, we could clear it here too if context is null.
            // this.getLogger().debug(`${this.constructor.name}._setCurrentTurnContextInternal: Context is null, also clearing _currentActor.`);
            // this._currentActor = null; // This is typically handled by _resetTurnStateAndResources
        }
    }

    // --- Core Turn Lifecycle Methods ---

    /**
     * Transitions the handler to a new state.
     * Manages exiting the previous state and entering the new state.
     * Calls `onExitState` and `onEnterState` hooks.
     * The `newState` should have been constructed with `this` (the concrete handler instance).
     * @param {ITurnState} newState - The state to transition to.
     * @protected
     * @async
     */
    async _transitionToState(newState) {
        const logger = this.getLogger(); // Use current best logger
        if (!newState || typeof newState.enterState !== 'function' || typeof newState.exitState !== 'function') {
            const errorMsg = `${this.constructor.name}._transitionToState: newState must implement ITurnState. Received: ${newState}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        const prevState = this._currentState;
        // Allow re-transition to Idle for reset purposes, otherwise skip same-state transition.
        // Also ensure prevState is not null (can happen if initial state setting failed or during early init errors)
        if (prevState === newState && !(newState instanceof ConcreteTurnIdleState)) {
            logger.debug(`${this.constructor.name}: Attempted to transition to the same state ${prevState?.getStateName() ?? 'N/A'}. Skipping.`);
            return;
        }

        const prevStateName = prevState ? prevState.getStateName() : 'None (Initial)';
        logger.debug(`${this.constructor.name}: State Transition: ${prevStateName} \u2192 ${newState.getStateName()}`);

        if (prevState) { // Ensure prevState exists before trying to exit from it
            try {
                await this.onExitState(prevState, newState); // Hook for subclasses
                // Pass 'this' (the handler instance) to state methods. States expect their handler context.
                await prevState.exitState(this, newState);
            } catch (exitErr) {
                logger.error(`${this.constructor.name}: Error during ${prevStateName}.exitState or onExitState hook \u2013 ${exitErr.message}`, exitErr);
                // Potentially handle critical exit error. For now, proceed with transition.
            }
        }


        this._currentState = newState;

        try {
            await this.onEnterState(newState, prevState); // Hook for subclasses
            // Pass 'this' (the handler instance) to state methods.
            await newState.enterState(this, prevState);
        } catch (enterErr) {
            logger.error(`${this.constructor.name}: Error during ${newState.getStateName()}.enterState or onEnterState hook \u2013 ${enterErr.message}`, enterErr);
            if (!(this._currentState instanceof ConcreteTurnIdleState)) {
                logger.warn(`${this.constructor.name}: Forcing transition to TurnIdleState due to error entering ${newState.getStateName()}.`);
                const currentContextActorIdForError = this._currentTurnContext?.getActor()?.id ?? this._currentActor?.id ?? 'N/A';
                // Reset resources BEFORE attempting the emergency transition to Idle.
                // This ensures Idle state starts as clean as possible.
                this._resetTurnStateAndResources(`error-entering-${newState.getStateName()}-for-${currentContextActorIdForError}`);
                // The new ConcreteTurnIdleState needs 'this' (the concrete handler instance).
                // Avoid awaiting this if it's already part of an error recovery, to prevent chained errors.
                // Let's still await to ensure state consistency if possible.
                try {
                    await this._transitionToState(new ConcreteTurnIdleState(this));
                } catch (idleTransitionError) {
                    logger.error(`${this.constructor.name}: CRITICAL - Failed to transition to TurnIdleState even after an error entering ${newState.getStateName()}. Handler might be unstable. Error: ${idleTransitionError.message}`, idleTransitionError);
                    // Forcibly set to a new Idle state instance. This is a last resort.
                    this._currentState = new ConcreteTurnIdleState(this);
                }
            } else {
                logger.error(`${this.constructor.name}: CRITICAL - Failed to enter TurnIdleState even after an error. Handler might be unstable.`);
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
     * Handles the logical end of a turn.
     * This method is typically invoked via `ITurnContext.endTurn()`, which is a callback
     * pointing to this method, bound by the concrete handler.
     * It transitions to `TurnEndingState`.
     * @param {string} actorIdToEnd - The ID of the actor whose turn is ending.
     * @param {Error | null} [turnError=null] - An error if the turn ended abnormally.
     * @param {boolean} [fromDestroy=false] - Internal flag if called during handler's destroy process.
     * @protected
     * @async
     */
    async _handleTurnEnd(actorIdToEnd, turnError = null, fromDestroy = false) {
        this._assertHandlerActiveUnlessDestroying(fromDestroy);
        const logger = this.getLogger();

        const contextActorId = this._currentTurnContext?.getActor()?.id;
        const handlerCurrentActorId = this._currentActor?.id;
        const effectiveActorIdForLog = actorIdToEnd || contextActorId || handlerCurrentActorId || 'UNKNOWN_ACTOR_AT_END';

        if (actorIdToEnd && contextActorId && actorIdToEnd !== contextActorId) {
            logger.warn(`${this.constructor.name}._handleTurnEnd called for actor '${actorIdToEnd}', but TurnContext is for '${contextActorId}'. Effective actor: '${effectiveActorIdForLog}'.`);
        } else if (actorIdToEnd && !contextActorId && handlerCurrentActorId && actorIdToEnd !== handlerCurrentActorId) {
            logger.warn(`${this.constructor.name}._handleTurnEnd called for actor '${actorIdToEnd}', no active TurnContext, but handler's _currentActor is '${handlerCurrentActorId}'. Effective actor: '${effectiveActorIdForLog}'.`);
        }


        if (this._isDestroyed && !fromDestroy) {
            logger.warn(`${this.constructor.name}._handleTurnEnd ignored for actor ${effectiveActorIdForLog} \u2013 handler is already destroyed and call is not from destroy process.`);
            return;
        }

        // Prevent re-entering _handleTurnEnd if already in TurnEndingState or TurnIdleState (post-ending)
        // unless it's part of a destroy sequence that needs to force it.
        if (!fromDestroy && (this._currentState instanceof ConcreteTurnEndingState || this._currentState instanceof ConcreteTurnIdleState)) {
            // If the turnError is new and significant, we might want to log it or handle it.
            if (turnError) {
                logger.warn(`${this.constructor.name}._handleTurnEnd called for ${effectiveActorIdForLog} with error '${turnError.message}', but already in ${this._currentState.getStateName()}. Error will be logged but no new transition initiated.`);
            } else {
                logger.debug(`${this.constructor.name}._handleTurnEnd called for ${effectiveActorIdForLog}, but already in ${this._currentState.getStateName()}. Ignoring.`);
            }
            return;
        }


        logger.debug(`${this.constructor.name}._handleTurnEnd initiated for actor ${effectiveActorIdForLog}. Error: ${turnError ? turnError.message : 'null'}. Called from destroy: ${fromDestroy}`);

        const effectiveActorIdForState = actorIdToEnd || contextActorId || this._currentActor?.id;
        if (!effectiveActorIdForState) {
            logger.warn(`${this.constructor.name}._handleTurnEnd: Could not determine actor ID for TurnEndingState. Using 'UNKNOWN_ACTOR_FOR_STATE'.`);
        }
        // TurnEndingState constructor needs 'this' (the concrete handler instance).
        await this._transitionToState(new ConcreteTurnEndingState(this, effectiveActorIdForState || 'UNKNOWN_ACTOR_FOR_STATE', turnError));
    }

    /**
     * Resets all per-turn state, including nullifying the current `ITurnContext` and `_currentActor`.
     * Invoked by states like `TurnIdleState`, `TurnEndingState`, or during handler destruction.
     * Subclasses should call `super._resetTurnStateAndResources()` and then perform their specific cleanup.
     * @param {string} [logContext='N/A'] - Diagnostic context for logging.
     * @protected
     */
    _resetTurnStateAndResources(logContext = 'N/A') {
        const logger = this.getLogger(); // Get logger before context is cleared
        const contextActorId = this._currentTurnContext?.getActor()?.id;
        const currentHandlerActorId = this._currentActor?.id;

        logger.debug(
            `${this.constructor.name}._resetTurnStateAndResources (context: '${logContext}'). Context actor: ${contextActorId ?? 'None'}. Handler actor: ${currentHandlerActorId ?? 'None'}.`
        );

        if (this._currentTurnContext) {
            logger.debug(`${this.constructor.name}: Clearing current TurnContext (was for actor ${contextActorId ?? 'N/A'}).`);
            this._setCurrentTurnContextInternal(null); // Clears _currentTurnContext
        }

        if (this._currentActor) {
            logger.debug(`${this.constructor.name}: Clearing current handler actor (was ${currentHandlerActorId ?? 'N/A'}).`);
            this._setCurrentActorInternal(null); // Clears _currentActor
        }

        // Subclasses will call super._resetTurnStateAndResources and then reset their own specific flags or resources.
        logger.debug(
            `${this.constructor.name}: Base per-turn state reset complete for '${logContext}'. Subclasses may perform additional cleanup.`
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
     * Hook called by `_transitionToState` before the new state's `enterState`.
     * @param {ITurnState} currentState - The state being entered.
     * @param {ITurnState | undefined} [previousState] - The state being exited.
     * @returns {Promise<void>}
     * @protected
     * @virtual
     */
    async onEnterState(currentState, previousState) {
        this.getLogger().debug(`${this.constructor.name}.onEnterState hook: Entering ${currentState.getStateName()} from ${previousState?.getStateName() ?? 'None'}`);
    }

    /**
     * Hook called by `_transitionToState` before the previous state's `exitState`.
     * @param {ITurnState} currentState - The state being exited.
     * @param {ITurnState | undefined} [nextState] - The state being transitioned to.
     * @returns {Promise<void>}
     * @protected
     * @virtual
     */
    async onExitState(currentState, nextState) {
        this.getLogger().debug(`${this.constructor.name}.onExitState hook: Exiting ${currentState.getStateName()} to ${nextState?.getStateName() ?? 'None'}`);
    }


    // --- Public API (from a potential ITurnHandler interface or common handler logic) ---

    /**
     * Initiates a turn for the specified actor.
     * Concrete handlers MUST implement this. It typically involves:
     * - Asserting handler is active.
     * - Validating actor.
     * - Creating and setting up `ITurnContext` via `_setCurrentTurnContextInternal`.
     * - Setting `_currentActor` via `_setCurrentActorInternal`.
     * - Delegating to the current state's `startTurn` method (usually `TurnIdleState`).
     * @param {Entity} actor - The entity whose turn is to be started.
     * @returns {Promise<void>}
     * @abstract
     */
    async startTurn(actor) {
        this._assertHandlerActive();
        // This is an abstract method, so direct implementation is in subclasses.
        // Logging here can indicate if a subclass forgot to implement it.
        this.getLogger().error("Method 'startTurn(actor)' must be implemented by concrete subclasses of BaseTurnHandler.");
        throw new Error("Method 'startTurn(actor)' must be implemented by concrete subclasses of BaseTurnHandler.");
    }


    /**
     * Destroys the handler, performing necessary cleanup.
     * Subclasses overriding this should typically call `super.destroy()` LAST.
     * Key change: _resetTurnStateAndResources is called AFTER the transition to Idle.
     * @returns {Promise<void>}
     */
    async destroy() {
        const logger = this.getLogger(); // Get logger before any state changes.
        const handlerName = this.constructor.name;

        if (this._isDestroyed) {
            logger.debug(`${handlerName}.destroy() called but already destroyed.`);
            return;
        }
        this._isDestroyed = true; // Mark as destroyed early
        logger.info(`${handlerName}.destroy() invoked. Current state: ${this._currentState?.getStateName() ?? 'N/A'}`);

        // 1. Call destroy on the current state, if it exists and has a destroy method.
        //    The ITurnContext should still be available for the state's destroy method.
        if (this._currentState && typeof this._currentState.destroy === 'function') {
            try {
                logger.debug(`${handlerName}.destroy: Calling destroy on current state ${this._currentState.getStateName()}.`);
                // The state's destroy method is passed 'this' (the concrete handler instance)
                await this._currentState.destroy(this);
            } catch (stateDestroyError) {
                logger.error(`${handlerName}.destroy: Error during ${this._currentState.getStateName()}.destroy() \u2013 ${stateDestroyError.message}`, stateDestroyError);
            }
        }

        // 2. Ensure transition to TurnIdleState if not already in it.
        //    ITurnContext should still be available for exitState of current and enterState of Idle.
        if (!(this._currentState instanceof ConcreteTurnIdleState)) {
            logger.debug(`${handlerName}.destroy: Ensuring transition to TurnIdleState (current: ${this._currentState?.getStateName() ?? 'N/A'}).`);
            try {
                // Pass 'this' (the concrete handler instance) to the state constructor.
                await this._transitionToState(new ConcreteTurnIdleState(this));
            } catch (e) {
                logger.error(`${handlerName}.destroy: Error while transitioning to TurnIdleState during destroy: ${e.message}`, e);
                // Forcibly set state if transition fails catastrophically during destroy.
                // This is a last resort to ensure the handler is in a known "safe" state.
                this._currentState = new ConcreteTurnIdleState(this); // Pass 'this'
                logger.warn(`${handlerName}.destroy: Forcibly set state to TurnIdleState due to transition error.`);
            }
        } else {
            logger.debug(`${handlerName}.destroy: Already in TurnIdleState or no current state defined. Current state: ${this._currentState?.getStateName()}`);
        }

        // 3. NOW, reset all per-turn resources, including nullifying the ITurnContext.
        //    This is called on the concrete handler (e.g. PlayerTurnHandler._resetTurnStateAndResources).
        logger.debug(`${handlerName}.destroy: Calling _resetTurnStateAndResources.`);
        this._resetTurnStateAndResources(`destroy-${handlerName}`);

        logger.info(`${handlerName}.destroy() complete. Final state: ${this._currentState?.getStateName() ?? 'N/A'}`);
    }

    /**
     * Sets the initial state. Should be called by derived constructors after super().
     * @param {ITurnState} initialState
     * @protected
     */
    _setInitialState(initialState) {
        if (!initialState || typeof initialState.enterState !== 'function') {
            const msg = `${this.constructor.name}: Attempted to set invalid initial state.`;
            this._logger.error(msg, {state: initialState});
            throw new Error(msg);
        }
        if (this._currentState !== null) {
            const msg = `${this.constructor.name}: Initial state has already been set. Cannot set again.`;
            this._logger.error(msg);
            throw new Error(msg);
        }
        this._currentState = initialState; // Set the state object
        // No immediate call to enterState here; it's typically called by _transitionToState or initial game setup.
        // If an initial enterState is required upon setting, the derived class or system needs to manage that first transition.
        this._logger.debug(`${this.constructor.name} initial state set to: ${this._currentState.getStateName()}. EnterState will be called on first transition or explicit start.`);
    }
}

// --- FILE END ---