// src/core/turns/handlers/baseTurnHandler.js
// --- FILE START ---

/**
 * @typedef {import('../../entities/entity.js').default} Entity
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
     * Logger instance for this handler.
     * @protected
     * @readonly
     * @type {ILogger}
     */
    _logger;

    /**
     * The current active state of the turn handler.
     * @protected
     * @type {ITurnState}
     */
    _currentState;

    /**
     * The current turn-specific context.
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
     * The current actor whose turn is being processed.
     * @protected
     * @type {Entity | null}
     */
    _currentActor = null;


    constructor({logger}) {
        if (!logger) {
            console.error('BaseTurnHandler Constructor: logger is required.');
            throw new Error('BaseTurnHandler: logger is required.');
        }
        this._logger = logger;
        this._currentTurnContext = null;
        this._isDestroyed = false;
        this._currentActor = null;
        this._currentState = null;
    }

    getLogger() {
        if (this._currentTurnContext) {
            try {
                const contextLogger = this._currentTurnContext.getLogger();
                if (contextLogger && typeof contextLogger.info === 'function') {
                    return contextLogger;
                }
            } catch (e) {
                this._logger.warn(`Error accessing logger from TurnContext: ${e.message}. Falling back to base logger.`);
            }
        }
        return this._logger;
    }

    getTurnContext() {
        return this._currentTurnContext;
    }

    getCurrentActor() {
        if (this._currentTurnContext) {
            try {
                return this._currentTurnContext.getActor();
            } catch (e) {
                this.getLogger().warn(`Error accessing actor from TurnContext: ${e.message}. Falling back to _currentActor field.`);
            }
        }
        return this._currentActor;
    }

    _setCurrentActorInternal(actor) {
        this.getLogger().debug(`${this.constructor.name}._setCurrentActorInternal: Setting current actor to ${actor?.id ?? 'null'}.`);
        this._currentActor = actor;
        if (this._currentTurnContext && this._currentTurnContext.getActor()?.id !== actor?.id) {
            this.getLogger().warn(`${this.constructor.name}._setCurrentActorInternal: Handler's actor set to '${actor?.id ?? 'null'}' while an active TurnContext exists for '${this._currentTurnContext.getActor()?.id}'. Context not updated by this method.`);
        }
    }

    _setCurrentTurnContextInternal(turnContext) {
        this.getLogger().debug(`${this.constructor.name}._setCurrentTurnContextInternal: Setting turn context to ${turnContext ? `object for actor ${turnContext.getActor()?.id}` : 'null'}.`);
        this._currentTurnContext = turnContext;
        if (turnContext) {
            if (this._currentActor?.id !== turnContext.getActor()?.id) {
                this.getLogger().debug(`${this.constructor.name}._setCurrentTurnContextInternal: Aligning _currentActor ('${this._currentActor?.id}') with new TurnContext actor ('${turnContext.getActor()?.id}').`);
                this._currentActor = turnContext.getActor();
            }
        }
    }

    async _transitionToState(newState) {
        const logger = this.getLogger();
        if (!newState || typeof newState.enterState !== 'function' || typeof newState.exitState !== 'function') {
            const errorMsg = `${this.constructor.name}._transitionToState: newState must implement ITurnState. Received: ${newState}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        const prevState = this._currentState;
        if (prevState === newState && !(newState instanceof ConcreteTurnIdleState)) {
            logger.debug(`${this.constructor.name}: Attempted to transition to the same state ${prevState?.getStateName() ?? 'N/A'}. Skipping.`);
            return;
        }

        const prevStateName = prevState ? prevState.getStateName() : 'None (Initial)';
        logger.debug(`${this.constructor.name}: State Transition: ${prevStateName} \u2192 ${newState.getStateName()}`);

        if (prevState) {
            try {
                await this.onExitState(prevState, newState);
                await prevState.exitState(this, newState);
            } catch (exitErr) {
                logger.error(`${this.constructor.name}: Error during ${prevStateName}.exitState or onExitState hook \u2013 ${exitErr.message}`, exitErr);
            }
        }

        this._currentState = newState;

        try {
            await this.onEnterState(newState, prevState);
            await newState.enterState(this, prevState);
        } catch (enterErr) {
            logger.error(`${this.constructor.name}: Error during ${newState.getStateName()}.enterState or onEnterState hook \u2013 ${enterErr.message}`, enterErr);
            if (!(this._currentState instanceof ConcreteTurnIdleState)) {
                logger.warn(`${this.constructor.name}: Forcing transition to TurnIdleState due to error entering ${newState.getStateName()}.`);
                const currentContextActorIdForError = this._currentTurnContext?.getActor()?.id ?? this._currentActor?.id ?? 'N/A';
                this._resetTurnStateAndResources(`error-entering-${newState.getStateName()}-for-${currentContextActorIdForError}`);
                try {
                    await this._transitionToState(new ConcreteTurnIdleState(this));
                } catch (idleTransitionError) {
                    logger.error(`${this.constructor.name}: CRITICAL - Failed to transition to TurnIdleState even after an error entering ${newState.getStateName()}. Handler might be unstable. Error: ${idleTransitionError.message}`, idleTransitionError);
                    this._currentState = new ConcreteTurnIdleState(this);
                }
            } else {
                logger.error(`${this.constructor.name}: CRITICAL - Failed to enter TurnIdleState even after an error. Handler might be unstable.`);
            }
        }
    }

    _assertHandlerActive() {
        if (this._isDestroyed) {
            throw new Error(`${this.constructor.name}: Operation invoked after handler was destroyed.`);
        }
    }

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

        if (!fromDestroy && (this._currentState instanceof ConcreteTurnEndingState || this._currentState instanceof ConcreteTurnIdleState)) {
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
        await this._transitionToState(new ConcreteTurnEndingState(this, effectiveActorIdForState || 'UNKNOWN_ACTOR_FOR_STATE', turnError));
    }

    _resetTurnStateAndResources(logContext = 'N/A') {
        const logger = this.getLogger();
        const contextActorId = this._currentTurnContext?.getActor()?.id;
        const currentHandlerActorId = this._currentActor?.id;

        logger.debug(
            `${this.constructor.name}._resetTurnStateAndResources (context: '${logContext}'). Context actor: ${contextActorId ?? 'None'}. Handler actor: ${currentHandlerActorId ?? 'None'}.`
        );

        if (this._currentTurnContext) {
            // --- MODIFICATION: Ensure prompt is cancelled if context is being cleared here ---
            // Although destroy() now handles this proactively, if _resetTurnStateAndResources
            // is called from other paths (e.g., error recovery in _transitionToState),
            // it's good to ensure cancellation.
            if (typeof this._currentTurnContext.cancelActivePrompt === 'function') {
                logger.debug(`${this.constructor.name}._resetTurnStateAndResources: Cancelling active prompt in current TurnContext before clearing it.`);
                try {
                    this._currentTurnContext.cancelActivePrompt();
                } catch (cancelError) {
                    logger.warn(`${this.constructor.name}._resetTurnStateAndResources: Error during cancelActivePrompt: ${cancelError.message}`, cancelError);
                }
            }
            // --- END MODIFICATION ---
            logger.debug(`${this.constructor.name}: Clearing current TurnContext (was for actor ${contextActorId ?? 'N/A'}).`);
            this._setCurrentTurnContextInternal(null);
        }

        if (this._currentActor) {
            logger.debug(`${this.constructor.name}: Clearing current handler actor (was ${currentHandlerActorId ?? 'N/A'}).`);
            this._setCurrentActorInternal(null);
        }

        logger.debug(
            `${this.constructor.name}: Base per-turn state reset complete for '${logContext}'. Subclasses may perform additional cleanup.`
        );
    }

    _assertHandlerActiveUnlessDestroying(fromDestroy) {
        if (!fromDestroy) {
            this._assertHandlerActive();
        }
    }

    async onEnterState(currentState, previousState) {
        this.getLogger().debug(`${this.constructor.name}.onEnterState hook: Entering ${currentState.getStateName()} from ${previousState?.getStateName() ?? 'None'}`);
    }

    async onExitState(currentState, nextState) {
        this.getLogger().debug(`${this.constructor.name}.onExitState hook: Exiting ${currentState.getStateName()} to ${nextState?.getStateName() ?? 'None'}`);
    }

    async startTurn(actor) {
        this._assertHandlerActive();
        this.getLogger().error("Method 'startTurn(actor)' must be implemented by concrete subclasses of BaseTurnHandler.");
        throw new Error("Method 'startTurn(actor)' must be implemented by concrete subclasses of BaseTurnHandler.");
    }

    async destroy() {
        const logger = this.getLogger();
        const handlerName = this.constructor.name;

        if (this._isDestroyed) {
            logger.debug(`${handlerName}.destroy() called but already destroyed.`);
            return;
        }
        this._isDestroyed = true;
        logger.info(`${handlerName}.destroy() invoked. Current state: ${this._currentState?.getStateName() ?? 'N/A'}`);

        // --- MODIFICATION: Cancel active prompt in TurnContext ---
        // This should happen BEFORE the current state's destroy is called,
        // as the state's destroy might also call endTurn() which also cancels.
        // This ensures the signal is sent early.
        if (this._currentTurnContext && typeof this._currentTurnContext.cancelActivePrompt === 'function') {
            logger.debug(`${handlerName}.destroy: Attempting to cancel active prompt in TurnContext for actor ${this._currentTurnContext.getActor()?.id ?? 'N/A'}.`);
            try {
                this._currentTurnContext.cancelActivePrompt(); // Abort the signal
            } catch (cancelError) {
                logger.warn(`${handlerName}.destroy: Error during _currentTurnContext.cancelActivePrompt(): ${cancelError.message}`, cancelError);
            }
        } else {
            logger.debug(`${handlerName}.destroy: No active TurnContext or cancelActivePrompt method to call.`);
        }
        // --- END MODIFICATION ---

        if (this._currentState && typeof this._currentState.destroy === 'function') {
            try {
                logger.debug(`${handlerName}.destroy: Calling destroy on current state ${this._currentState.getStateName()}.`);
                await this._currentState.destroy(this);
            } catch (stateDestroyError) {
                logger.error(`${handlerName}.destroy: Error during ${this._currentState.getStateName()}.destroy() \u2013 ${stateDestroyError.message}`, stateDestroyError);
            }
        }

        if (!(this._currentState instanceof ConcreteTurnIdleState)) {
            logger.debug(`${handlerName}.destroy: Ensuring transition to TurnIdleState (current: ${this._currentState?.getStateName() ?? 'N/A'}).`);
            try {
                await this._transitionToState(new ConcreteTurnIdleState(this));
            } catch (e) {
                logger.error(`${handlerName}.destroy: Error while transitioning to TurnIdleState during destroy: ${e.message}`, e);
                this._currentState = new ConcreteTurnIdleState(this);
                logger.warn(`${handlerName}.destroy: Forcibly set state to TurnIdleState due to transition error.`);
            }
        } else {
            logger.debug(`${handlerName}.destroy: Already in TurnIdleState or no current state defined. Current state: ${this._currentState?.getStateName()}`);
        }

        logger.debug(`${handlerName}.destroy: Calling _resetTurnStateAndResources.`);
        // Note: _resetTurnStateAndResources now ALSO calls cancelActivePrompt if context still exists,
        // providing a fallback if destroy wasn't called from the top handler.
        // However, the explicit call earlier in this destroy method is more direct for this path.
        this._resetTurnStateAndResources(`destroy-${handlerName}`);

        logger.info(`${handlerName}.destroy() complete. Final state: ${this._currentState?.getStateName() ?? 'N/A'}`);
    }

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
        this._currentState = initialState;
        this._logger.debug(`${this.constructor.name} initial state set to: ${this._currentState.getStateName()}. EnterState will be called on first transition or explicit start.`);
    }
}

// --- FILE END ---