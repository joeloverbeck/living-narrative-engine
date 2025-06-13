/**
 * @file Contains the base class for the base turn handler (used by AITurnHandler, HumanTurnHandler, etc.)
 * @see src/turns/handlers/baseTurnHandler.js
 */

/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState
 * @typedef {import('../interfaces/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory
 * @typedef {import('../ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 */

// REMOVED: Direct imports of concrete states are no longer needed, breaking the dependency.
// import { TurnIdleState as ConcreteTurnIdleState } from '../states/turnIdleState.js';
// import { TurnEndingState as ConcreteTurnEndingState } from '../states/turnEndingState.js';

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
   * @param {ITurnStateFactory} deps.turnStateFactory - Factory for creating turn states.
   */
  constructor({ logger, turnStateFactory }) {
    if (!logger) {
      console.error('BaseTurnHandler: logger is required.');
      throw new Error('BaseTurnHandler: logger is required.');
    }
    if (!turnStateFactory) {
      console.error('BaseTurnHandler: turnStateFactory is required.');
      throw new Error('BaseTurnHandler: turnStateFactory is required.');
    }

    this._logger = logger;
    this._turnStateFactory = turnStateFactory;
    this._currentState = null;
  }

  getLogger() {
    if (this._currentTurnContext) {
      try {
        const ctxLogger = this._currentTurnContext.getLogger();
        if (ctxLogger) return ctxLogger;
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

  /**
   * Retrieves the port for signaling the end of a turn.
   * Subclasses that manage a turn-end port should override this method.
   * @abstract
   * @returns {ITurnEndPort}
   */
  getTurnEndPort() {
    this.getLogger().error(
      `${this.constructor.name} does not implement getTurnEndPort.`
    );
    throw new Error('Method not implemented.');
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

    // MODIFIED: Use the new identity method, which depends only on the abstraction.
    if (prevState === newState && !newState.isIdle()) {
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
      // MODIFIED: Use the new identity method for the recovery check.
      if (!this._currentState.isIdle()) {
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
          // Use the factory to recover.
          await this._transitionToState(
            this._turnStateFactory.createIdleState(this)
          );
        } catch (idleErr) {
          logger.error(
            `${this.constructor.name}: CRITICAL - Failed to transition to TurnIdleState after error. Error: ${idleErr.message}`,
            idleErr
          );
          // Forcibly set state as a last resort.
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

    // MODIFIED: Use the new identity methods. Add a null check for safety.
    if (
      !fromDestroy &&
      this._currentState &&
      (this._currentState.isEnding() || this._currentState.isIdle())
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

  async startTurn(_actor) {
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
    logger.debug(
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

    // MODIFIED: Use the new identity method. Add a null check for safety.
    if (this._currentState && !this._currentState.isIdle()) {
      logger.debug(
        `${name}.destroy: Ensuring transition to TurnIdleState (current: ${this._currentState?.getStateName() ?? 'N/A'}).`
      );
      try {
        await this._transitionToState(
          this._turnStateFactory.createIdleState(this)
        );
      } catch (e) {
        logger.error(
          `${name}.destroy: Error while transitioning to TurnIdleState during destroy: ${e.message}`,
          e
        );
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
    logger.debug(
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

  /* ────────────────── NEW PUBLIC TRANSITION REQUESTS ─────────────────── */

  /**
   * Initiates a transition to the Idle state using the state factory.
   * This method should be called by states via the ITurnContext.
   */
  async requestIdleStateTransition() {
    this.getLogger().debug(
      `${this.constructor.name}: Received request to transition to Idle state.`
    );
    await this._transitionToState(this._turnStateFactory.createIdleState(this));
  }

  /**
   * Initiates a transition to the AwaitingInput state using the state factory.
   */
  async requestAwaitingInputStateTransition() {
    this.getLogger().debug(
      `${this.constructor.name}: Received request to transition to AwaitingInput state.`
    );
    await this._transitionToState(
      this._turnStateFactory.createAwaitingInputState(this)
    );
  }

  /**
   * Initiates a transition to the ProcessingCommand state using the state factory.
   * @param {string} commandString
   * @param {ITurnAction} turnAction
   */
  async requestProcessingCommandStateTransition(commandString, turnAction) {
    this.getLogger().debug(
      `${this.constructor.name}: Received request to transition to ProcessingCommand state.`
    );
    await this._transitionToState(
      this._turnStateFactory.createProcessingCommandState(
        this,
        commandString,
        turnAction
      )
    );
  }
}
