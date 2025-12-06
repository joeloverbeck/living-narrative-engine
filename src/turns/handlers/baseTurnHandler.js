/**
 * @file Contains the base class for actor turn handlers (specialized for AI or human players).
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

import { ITurnStateHost } from '../interfaces/ITurnStateHost.js';
import TurnDirectiveStrategyResolver, {
  DEFAULT_STRATEGY_MAP,
} from '../strategies/turnDirectiveStrategyResolver.js';

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
  /** @type {Promise<void>|null} Lock held during state transitions to prevent destroy() during transition */
  _transitionLock = null;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {ITurnStateFactory} deps.turnStateFactory - Factory for creating turn states.
   * @implements {ITurnStateHost}
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

  /**
   * Retrieves the current turn state.
   *
   * @returns {ITurnState|null} The active state instance or null.
   */
  getCurrentState() {
    return this._currentState;
  }

  /**
   * Resolves a SafeEventDispatcher for use by states.
   * Attempts to use the active ITurnContext first, falling back
   * to a `safeEventDispatcher` property on the handler if available.
   *
   * @returns {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher|null}
   *   The dispatcher instance or null if unavailable.
   */
  getSafeEventDispatcher() {
    if (
      this._currentTurnContext &&
      typeof this._currentTurnContext.getSafeEventDispatcher === 'function'
    ) {
      try {
        const dispatcher = this._currentTurnContext.getSafeEventDispatcher();
        if (dispatcher && typeof dispatcher.dispatch === 'function') {
          return dispatcher;
        }
      } catch (err) {
        this.getLogger().warn(
          `${this.constructor.name}.getSafeEventDispatcher: ` +
            `Error accessing dispatcher from TurnContext – ${err.message}`
        );
      }
    }

    if (
      this.safeEventDispatcher &&
      typeof this.safeEventDispatcher.dispatch === 'function'
    ) {
      return this.safeEventDispatcher;
    }

    this.getLogger().warn(
      `${this.constructor.name}.getSafeEventDispatcher: dispatcher unavailable.`
    );
    return null;
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
   *
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
    let actorId = 'null';
    if (turnContext) {
      try {
        actorId = turnContext.getActor()?.id || 'null';
      } catch (e) {
        actorId = 'error-accessing-actor';
      }
    }

    this.getLogger().debug(
      `${this.constructor.name}._setCurrentTurnContextInternal: Setting turn context to ${
        turnContext ? `object for actor ${actorId}` : 'null'
      }.`
    );
    this._currentTurnContext = turnContext;
    if (turnContext) {
      try {
        const contextActor = turnContext.getActor();
        if (this._currentActor?.id !== contextActor?.id) {
          this.getLogger().debug(
            `${this.constructor.name}._setCurrentTurnContextInternal: Aligning _currentActor ('${this._currentActor?.id || 'null'}') with new TurnContext actor ('${
              contextActor?.id || 'null'
            }').`
          );
          this._currentActor = contextActor;
        }
      } catch (e) {
        this.getLogger().debug(
          `${this.constructor.name}._setCurrentTurnContextInternal: Error accessing actor from TurnContext: ${e.message}. Keeping current actor.`
        );
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
    let nextIsIdle = false;
    try {
      nextIsIdle =
        typeof newState.isIdle === 'function' ? newState.isIdle() : false;
    } catch (e) {
      // If isIdle throws an error, assume it's not idle
      nextIsIdle = false;
    }
    if (prevState === newState && !nextIsIdle) {
      logger.debug(
        `${this.constructor.name}: Attempted to transition to the same state ${
          prevState?.getStateName() ?? 'N/A'
        }. Skipping.`
      );
      return;
    }

    const prevStateName = prevState
      ? typeof prevState.getStateName === 'function'
        ? prevState.getStateName()
        : 'N/A'
      : 'None (Initial)';
    logger.debug(
      `${this.constructor.name}: State Transition: ${prevStateName} → ${newState.getStateName()}`
    );

    // Create transition lock to prevent destroy() from running mid-transition
    let resolveLock;
    this._transitionLock = new Promise((resolve) => {
      resolveLock = resolve;
    });

    try {
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
        const currentIsIdle =
          typeof this._currentState.isIdle === 'function'
            ? this._currentState.isIdle()
            : false;
        if (!currentIsIdle) {
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
            // Release lock before recursive call to avoid deadlock
            resolveLock();
            this._transitionLock = null;
            // Use the factory to recover.
            await this._transitionToState(
              this._turnStateFactory.createIdleState(this)
            );
            return; // Lock already released, skip finally
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
    } finally {
      // Release transition lock
      resolveLock();
      this._transitionLock = null;
    }
  }

  /* ───────────────────────────── LIVENESS CHECKS ──────────────────────── */

  _assertHandlerActive() {
    if (this._isDestroyed || this._isDestroying) {
      throw new Error(
        `${this.constructor.name}: Operation invoked while handler is destroying or has been destroyed.`
      );
    }
  }

  _assertHandlerActiveUnlessDestroying(fromDestroy) {
    if (!fromDestroy) {
      this._assertHandlerActive();
    }
  }

  /* ─────────────────────────── TURN-END HANDLING ─────────────────────── */

  async _handleTurnEnd(endedActorId, turnError = null, fromDestroy = false) {
    if (this._isDestroyed && !fromDestroy) {
      this.getLogger().warn(
        `${this.constructor.name}._handleTurnEnd ignored for actor ${
          endedActorId ?? 'UNKNOWN'
        } – handler already destroyed.`
      );
      return;
    }

    this._assertHandlerActiveUnlessDestroying(fromDestroy);
    const logger = this.getLogger();

    let contextActorId;
    try {
      contextActorId = this._currentTurnContext?.getActor()?.id;
    } catch (e) {
      contextActorId = null;
    }

    const handlerActorId = this._currentActor?.id;
    const effectiveActor =
      endedActorId ||
      contextActorId ||
      handlerActorId ||
      'UNKNOWN_ACTOR_AT_END';

    if (endedActorId && contextActorId && endedActorId !== contextActorId) {
      logger.warn(
        `${this.constructor.name}._handleTurnEnd called for actor '${endedActorId}', but TurnContext is for '${contextActorId}'. Effective actor: '${effectiveActor}'.`
      );
    } else if (
      endedActorId &&
      !contextActorId &&
      handlerActorId &&
      endedActorId !== handlerActorId
    ) {
      logger.warn(
        `${this.constructor.name}._handleTurnEnd called for actor '${endedActorId}', no active TurnContext, but handler's _currentActor is '${handlerActorId}'. Effective actor: '${effectiveActor}'.`
      );
    }

    if (this._isDestroyed && !fromDestroy) {
      logger.warn(
        `${this.constructor.name}._handleTurnEnd ignored for actor ${effectiveActor} – handler is already destroyed and call is not from destroy process.`
      );
      return;
    }

    // MODIFIED: Use the new identity methods. Add a null check for safety.
    let stateIsEnding = false;
    let stateIsIdle = false;

    try {
      stateIsEnding =
        typeof this._currentState?.isEnding === 'function'
          ? this._currentState.isEnding()
          : false;
    } catch (e) {
      // If isEnding throws an error, assume it's not ending
      stateIsEnding = false;
    }

    try {
      stateIsIdle =
        typeof this._currentState?.isIdle === 'function'
          ? this._currentState.isIdle()
          : false;
    } catch (e) {
      // If isIdle throws an error, assume it's not idle
      stateIsIdle = false;
    }
    if (!fromDestroy && this._currentState && (stateIsEnding || stateIsIdle)) {
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
      endedActorId || contextActorId || this._currentActor?.id;
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

    let contextActorId;
    try {
      contextActorId = this._currentTurnContext?.getActor()?.id;
    } catch (e) {
      contextActorId = null;
    }

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

  /**
   * Public wrapper that delegates to the internal resource resetter.
   *
   * @param {string} reason - Contextual reason for the reset.
   * @returns {void}
   */
  resetStateAndResources(reason) {
    this._resetTurnStateAndResources(reason);
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

    // Wait for any active state transition to complete before destruction
    // This prevents the race condition where destroy() runs mid-transition
    if (this._transitionLock) {
      logger.debug(
        `${name}.destroy: Waiting for active state transition to complete.`
      );
      await this._transitionLock;
    }

    // Notify turn ended BEFORE destruction begins (handler still active)
    // This moves the notification from TurnEndingState.enterState() to here,
    // eliminating the race condition where notification triggers destruction mid-state-entry
    if (
      this._currentState &&
      typeof this._currentState.isEnding === 'function' &&
      this._currentState.isEnding() &&
      this._currentTurnContext
    ) {
      try {
        const actorId = this._currentActor?.id;
        const turnEndPort = this._currentTurnContext.getTurnEndPort?.();
        // Determine success based on whether there was a turn error
        // TurnEndingState tracks this via #turnError field, but we can check
        // if the state was entered due to an error by examining _lastTurnError
        const success = !this._lastTurnError;
        if (actorId && turnEndPort) {
          logger.debug(
            `${name}.destroy: Notifying turn end for actor ${actorId}, success=${success}`
          );
          await turnEndPort.notifyTurnEnded(actorId, success);
        }
      } catch (err) {
        logger.warn(
          `${name}.destroy: Error notifying turn end: ${err.message}`,
          err
        );
      }
    }

    this._isDestroying = true;
    logger.debug(
      `${name}.destroy() invoked. Current state: ${
        this._currentState &&
        typeof this._currentState.getStateName === 'function'
          ? this._currentState.getStateName()
          : 'N/A'
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
    let needsTransition = false;
    if (this._currentState && typeof this._currentState.isIdle === 'function') {
      try {
        needsTransition = !this._currentState.isIdle();
      } catch (e) {
        // If isIdle throws an error, assume it's not idle and needs transition
        needsTransition = true;
      }
    }

    if (needsTransition) {
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
    this._assertHandlerActive();
    this.getLogger().debug(
      `${this.constructor.name}: Received request to transition to Idle state.`
    );
    await this._transitionToState(this._turnStateFactory.createIdleState(this));
  }

  /**
   * Initiates a transition to the AwaitingInput state using the state factory.
   */
  async requestAwaitingInputStateTransition() {
    this._assertHandlerActive();
    this.getLogger().debug(
      `${this.constructor.name}: Received request to transition to AwaitingInput state.`
    );
    await this._transitionToState(
      this._turnStateFactory.createAwaitingInputState(this)
    );
  }

  /**
   * Initiates a transition to the ProcessingCommand state using the state factory.
   *
   * @param {string} commandString
   * @param {ITurnAction} turnAction
   */
  async requestProcessingCommandStateTransition(commandString, turnAction) {
    this._assertHandlerActive();
    this.getLogger().debug(
      `${this.constructor.name}: Received request to transition to ProcessingCommand state.`
    );
    await this._transitionToState(
      this._turnStateFactory.createProcessingCommandState(
        this,
        commandString,
        turnAction,
        new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP)
      )
    );
  }

  /**
   * Initiates a transition to the AwaitingExternalTurnEnd state using the state factory.
   */
  async requestAwaitingExternalTurnEndStateTransition() {
    this._assertHandlerActive();
    this.getLogger().debug(
      `${this.constructor.name}: Received request to transition to AwaitingExternalTurnEnd state.`
    );
    // Assumes the factory has this method, following the established pattern.
    await this._transitionToState(
      this._turnStateFactory.createAwaitingExternalTurnEndState(this)
    );
  }
}
