// src/core/turns/handlers/baseTurnHandler.js
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState
 * @typedef {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory // NEW
 */

// Remove direct imports of concrete states if they are solely created by the factory
// import { TurnIdleState as ConcreteTurnIdleState } from '../states/turnIdleState.js';
// import { TurnEndingState as ConcreteTurnEndingState } from '../states/turnEndingState.js';
// However, instanceof checks might still require them or a more abstract check.
// For now, let's assume instanceof checks might remain or be refactored later.
import { TurnIdleState as ConcreteTurnIdleState } from '../states/turnIdleState.js';
import { TurnEndingState as ConcreteTurnEndingState } from '../states/turnEndingState.js';

/**
 * @abstract
 * @class BaseTurnHandler
 * Abstract base class for all turn handlers.
 */
export class BaseTurnHandler {
  _logger;
  _turnStateFactory;
  _currentState;
  _currentTurnContext = null;
  _isDestroyed = false;
  _isDestroying = false;
  _currentActor = null;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {ITurnStateFactory} deps.turnStateFactory - Factory for creating turn states. // NEW
   */
  constructor({ logger, turnStateFactory }) {
    // MODIFIED
    if (!logger) {
      console.error('BaseTurnHandler: logger is required.');
      throw new Error('BaseTurnHandler: logger is required.');
    }
    if (!turnStateFactory) {
      // NEW
      console.error('BaseTurnHandler: turnStateFactory is required.');
      throw new Error('BaseTurnHandler: turnStateFactory is required.');
    }

    this._logger = logger;
    this._turnStateFactory = turnStateFactory; // NEW
    this._currentState = null;
  }

  getLogger() {
    if (this._currentTurnContext) {
      try {
        const ctxLogger = this._currentTurnContext.getLogger();
        if (ctxLogger && typeof ctxLogger.info === 'function') return ctxLogger;
      } catch (e) {
        this._logger.warn(
          `Error accessing logger from TurnContext: ${e.message}. Falling back to base logger.`
        );
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
        this.getLogger().warn(
          `Error accessing actor from TurnContext: ${e.message}. Falling back to _currentActor field.`
        );
      }
    }
    return this._currentActor;
  }

  _setCurrentActorInternal(actor) {
    this.getLogger().debug(
      `${this.constructor.name}._setCurrentActorInternal: Setting current actor to ${actor?.id ?? 'null'}.`
    );
    this._currentActor = actor;
    if (
      this._currentTurnContext &&
      this._currentTurnContext.getActor()?.id !== actor?.id
    ) {
      this.getLogger().warn(
        `${this.constructor.name}._setCurrentActorInternal: Handler's actor set to '${
          actor?.id ?? 'null'
        }' while an active TurnContext exists for '${
          this._currentTurnContext.getActor()?.id
        }'. Context not updated by this method.`
      );
    }
  }

  _setCurrentTurnContextInternal(turnContext) {
    this.getLogger().debug(
      `${this.constructor.name}._setCurrentTurnContextInternal: Setting turn context to ${
        turnContext ? `object for actor ${turnContext.getActor()?.id}` : 'null'
      }.`
    );
    this._currentTurnContext = turnContext;
    if (turnContext) {
      if (this._currentActor?.id !== turnContext.getActor()?.id) {
        this.getLogger().debug(
          `${this.constructor.name}._setCurrentTurnContextInternal: Aligning _currentActor ('${this._currentActor?.id}') with new TurnContext actor ('${
            turnContext.getActor()?.id
          }').`
        );
        this._currentActor = turnContext.getActor();
      }
    }
  }

  async _transitionToState(newState) {
    const logger = this.getLogger();
    if (
      !newState ||
      typeof newState.enterState !== 'function' ||
      typeof newState.exitState !== 'function'
    ) {
      const msg = `${this.constructor.name}._transitionToState: newState must implement ITurnState. Received: ${newState}`;
      logger.error(msg);
      throw new Error(msg);
    }

    const prevState = this._currentState;
    // The instanceof check for ConcreteTurnIdleState might need reconsideration
    // if you want to avoid direct dependencies on concrete types here.
    // For now, it's kept as is, assuming ConcreteTurnIdleState is the specific type.
    if (
      prevState === newState &&
      !(newState instanceof ConcreteTurnIdleState)
    ) {
      logger.debug(
        `${this.constructor.name}: Attempted to transition to the same state ${
          prevState?.getStateName() ?? 'N/A'
        }. Skipping.`
      );
      return;
    }

    const prevStateName = prevState
      ? prevState.getStateName()
      : 'None (Initial)';
    logger.debug(
      `${this.constructor.name}: State Transition: ${prevStateName} → ${newState.getStateName()}`
    );

    if (prevState) {
      try {
        await this.onExitState(prevState, newState);
        await prevState.exitState(this, newState);
      } catch (exitErr) {
        logger.error(
          `${this.constructor.name}: Error during ${prevStateName}.exitState or onExitState hook – ${exitErr.message}`,
          exitErr
        );
      }
    }

    this._currentState = newState;

    try {
      await this.onEnterState(newState, prevState);
      await newState.enterState(this, prevState);
    } catch (enterErr) {
      logger.error(
        `${this.constructor.name}: Error during ${newState.getStateName()}.enterState or onEnterState hook – ${enterErr.message}`,
        enterErr
      );
      // Check if the current state is an idle state without direct concrete class dependency
      // This might involve adding an `isIdle()` method to ITurnState or similar.
      // For now, using instanceof as it was.
      if (!(this._currentState instanceof ConcreteTurnIdleState)) {
        logger.warn(
          `${this.constructor.name}: Forcing transition to TurnIdleState due to error entering ${newState.getStateName()}.`
        );
        const actorIdForErr =
          this._currentTurnContext?.getActor()?.id ??
          this._currentActor?.id ??
          'N/A';
        this._resetTurnStateAndResources(
          `error-entering-${newState.getStateName()}-for-${actorIdForErr}`
        );
        try {
          // MODIFIED: Use factory
          await this._transitionToState(
            this._turnStateFactory.createIdleState(this)
          );
        } catch (idleErr) {
          logger.error(
            `${this.constructor.name}: CRITICAL - Failed to transition to TurnIdleState after error entering ${newState.getStateName()}. Error: ${idleErr.message}`,
            idleErr
          );
          // MODIFIED: Use factory as a last resort
          this._currentState = this._turnStateFactory.createIdleState(this);
        }
      } else {
        logger.error(
          `${this.constructor.name}: CRITICAL - Failed to enter TurnIdleState even after an error.`
        );
      }
    }
  }

  /* ───────────────────────────── LIVENESS CHECKS ──────────────────────── */

  /**
   * Throws if the handler has *finished* being destroyed.
   * Calls made while destruction is *in progress* are tolerated.
   */
  _assertHandlerActive() {
    if (this._isDestroyed && !this._isDestroying) {
      throw new Error(
        `${this.constructor.name}: Operation invoked after handler was destroyed.`
      );
    }
  }

  _assertHandlerActiveUnlessDestroying(fromDestroy) {
    if (!fromDestroy && !this._isDestroying) {
      this._assertHandlerActive();
    }
  }

  /* ─────────────────────────── TURN-END HANDLING ─────────────────────── */

  async _handleTurnEnd(actorIdToEnd, turnError = null, fromDestroy = false) {
    if (this._isDestroyed && !fromDestroy) {
      this.getLogger().warn(
        `${this.constructor.name}._handleTurnEnd ignored for actor ${
          actorIdToEnd ?? 'UNKNOWN'
        } – handler already destroyed.`
      );
      return;
    }

    this._assertHandlerActiveUnlessDestroying(fromDestroy);
    const logger = this.getLogger();
    // ... (actor ID resolution logic remains the same) ...
    const contextActorId = this._currentTurnContext?.getActor()?.id;
    const handlerActorId = this._currentActor?.id;
    const effectiveActor =
      actorIdToEnd ||
      contextActorId ||
      handlerActorId ||
      'UNKNOWN_ACTOR_AT_END';

    if (actorIdToEnd && contextActorId && actorIdToEnd !== contextActorId) {
      logger.warn(
        `${this.constructor.name}._handleTurnEnd called for actor '${actorIdToEnd}', but TurnContext is for '${contextActorId}'. Effective actor: '${effectiveActor}'.`
      );
    } else if (
      actorIdToEnd &&
      !contextActorId &&
      handlerActorId &&
      actorIdToEnd !== handlerActorId
    ) {
      logger.warn(
        `${this.constructor.name}._handleTurnEnd called for actor '${actorIdToEnd}', no active TurnContext, but handler's _currentActor is '${handlerActorId}'. Effective actor: '${effectiveActor}'.`
      );
    }

    if (this._isDestroyed && !fromDestroy) {
      logger.warn(
        `${this.constructor.name}._handleTurnEnd ignored for actor ${effectiveActor} – handler is already destroyed and call is not from destroy process.`
      );
      return;
    }
    // The instanceof checks might need reconsideration for full abstraction
    if (
      !fromDestroy &&
      (this._currentState instanceof ConcreteTurnEndingState ||
        this._currentState instanceof ConcreteTurnIdleState)
    ) {
      if (turnError) {
        logger.warn(
          `${this.constructor.name}._handleTurnEnd called for ${effectiveActor} with error '${turnError.message}', but already in ${this._currentState.getStateName()}. Error will be logged but no new transition initiated.`
        );
      } else {
        logger.debug(
          `${this.constructor.name}._handleTurnEnd called for ${effectiveActor}, but already in ${this._currentState.getStateName()}. Ignoring.`
        );
      }
      return;
    }

    logger.debug(
      `${this.constructor.name}._handleTurnEnd initiated for actor ${effectiveActor}. Error: ${
        turnError ? turnError.message : 'null'
      }. Called from destroy: ${fromDestroy}`
    );

    const actorIdForState =
      actorIdToEnd || contextActorId || this._currentActor?.id;
    if (!actorIdForState) {
      logger.warn(
        `${this.constructor.name}._handleTurnEnd: Could not determine actor ID for TurnEndingState. Using 'UNKNOWN_ACTOR_FOR_STATE'.`
      );
    }

    // MODIFIED: Use factory
    await this._transitionToState(
      this._turnStateFactory.createEndingState(
        this,
        actorIdForState || 'UNKNOWN_ACTOR_FOR_STATE',
        turnError
      )
    );
  }

  /* ──────────────────────── RESOURCE RESETTER ────────────────────────── */

  _resetTurnStateAndResources(logContext = 'N/A') {
    const logger = this.getLogger();
    const contextActorId = this._currentTurnContext?.getActor()?.id;
    const handlerActorId = this._currentActor?.id;

    logger.debug(
      `${this.constructor.name}._resetTurnStateAndResources (context: '${logContext}'). Context actor: ${
        contextActorId ?? 'None'
      }. Handler actor: ${handlerActorId ?? 'None'}.`
    );

    if (this._currentTurnContext) {
      if (typeof this._currentTurnContext.cancelActivePrompt === 'function') {
        logger.debug(
          `${this.constructor.name}._resetTurnStateAndResources: Cancelling active prompt in current TurnContext before clearing it.`
        );
        try {
          this._currentTurnContext.cancelActivePrompt();
        } catch (err) {
          logger.warn(
            `${this.constructor.name}._resetTurnStateAndResources: Error during cancelActivePrompt: ${err.message}`,
            err
          );
        }
      }

      logger.debug(
        `${this.constructor.name}: Clearing current TurnContext (was for actor ${
          contextActorId ?? 'N/A'
        }).`
      );
      this._setCurrentTurnContextInternal(null);
    }

    if (this._currentActor) {
      logger.debug(
        `${this.constructor.name}: Clearing current handler actor (was ${
          handlerActorId ?? 'N/A'
        }).`
      );
      this._setCurrentActorInternal(null);
    }

    logger.debug(
      `${this.constructor.name}: Base per-turn state reset complete for '${logContext}'. Subclasses may perform additional cleanup.`
    );
  }

  /* ───────────────────────────── PUBLIC API ──────────────────────────── */

  async startTurn(actor) {
    this._assertHandlerActive();
    this.getLogger().error(
      "Method 'startTurn(actor)' must be implemented by concrete subclasses of BaseTurnHandler."
    );
    throw new Error(
      "Method 'startTurn(actor)' must be implemented by concrete subclasses of BaseTurnHandler."
    );
  }

  /**
   * Fully tear down the handler.
   * Safe to call multiple times.
   */
  async destroy() {
    const logger = this.getLogger();
    const name = this.constructor.name;

    if (this._isDestroyed) {
      logger.debug(`${name}.destroy() called but already destroyed.`);
      return;
    }

    this._isDestroying = true;
    logger.info(
      `${name}.destroy() invoked. Current state: ${
        this._currentState?.getStateName() ?? 'N/A'
      }`
    );

    if (this._currentTurnContext?.cancelActivePrompt) {
      logger.debug(
        `${name}.destroy: Attempting to cancel active prompt in TurnContext for actor ${
          this._currentTurnContext.getActor()?.id ?? 'N/A'
        }.`
      );
      try {
        this._currentTurnContext.cancelActivePrompt();
      } catch (err) {
        logger.warn(
          `${name}.destroy: Error during cancelActivePrompt: ${err.message}`,
          err
        );
      }
    }

    if (this._currentState?.destroy) {
      try {
        logger.debug(
          `${name}.destroy: Calling destroy() on current state ${this._currentState.getStateName()}.`
        );
        await this._currentState.destroy(this);
      } catch (stateErr) {
        logger.error(
          `${name}.destroy: Error during ${this._currentState.getStateName()}.destroy(): ${stateErr.message}`,
          stateErr
        );
      }
    }

    // The instanceof check might need reconsideration for full abstraction
    if (!(this._currentState instanceof ConcreteTurnIdleState)) {
      logger.debug(
        `${name}.destroy: Ensuring transition to TurnIdleState (current: ${this._currentState?.getStateName() ?? 'N/A'}).`
      );
      try {
        // MODIFIED: Use factory
        await this._transitionToState(
          this._turnStateFactory.createIdleState(this)
        );
      } catch (e) {
        logger.error(
          `${name}.destroy: Error while transitioning to TurnIdleState during destroy: ${e.message}`,
          e
        );
        // MODIFIED: Use factory as a last resort
        this._currentState = this._turnStateFactory.createIdleState(this);
        logger.warn(
          `${name}.destroy: Forcibly set state to TurnIdleState due to transition error.`
        );
      }
    }

    logger.debug(`${name}.destroy: Calling _resetTurnStateAndResources.`);
    this._resetTurnStateAndResources(`destroy-${name}`);

    this._isDestroyed = true;
    this._isDestroying = false;
    logger.info(
      `${name}.destroy() complete. Final state: ${this._currentState?.getStateName() ?? 'N/A'}`
    );
  }

  /* ──────────────────────────── INITIAL STATE ────────────────────────── */

  _setInitialState(initialState) {
    if (!initialState || typeof initialState.enterState !== 'function') {
      const msg = `${this.constructor.name}: Attempted to set invalid initial state.`;
      this._logger.error(msg, { state: initialState });
      throw new Error(msg);
    }
    if (this._currentState !== null) {
      const msg = `${this.constructor.name}: Initial state has already been set. Cannot set again.`;
      this._logger.error(msg);
      throw new Error(msg);
    }
    this._currentState = initialState;
    this._logger.debug(
      `${this.constructor.name} initial state set to: ${this._currentState.getStateName()}. EnterState will be called on first transition or explicit start.`
    );
  }

  /* ───────────────────────────── HOOKS ───────────────────────────────── */

  async onEnterState(currentState, previousState) {
    this.getLogger().debug(
      `${this.constructor.name}.onEnterState hook: Entering ${currentState.getStateName()} from ${
        previousState?.getStateName() ?? 'None'
      }`
    );
  }

  async onExitState(currentState, nextState) {
    this.getLogger().debug(
      `${this.constructor.name}.onExitState hook: Exiting ${currentState.getStateName()} to ${
        nextState?.getStateName() ?? 'None'
      }`
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
