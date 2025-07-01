// src/turns/states/abstractTurnState.js
// --- FILE START ---

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../types/commandResult.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum
 * @typedef {import('../../constants/eventIds.js').SystemEventPayloads} SystemEventPayloads
 * @typedef {import('../../constants/eventIds.js').TURN_ENDED_ID} TURN_ENDED_ID_TYPE
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 */

import { ITurnState } from '../interfaces/ITurnState.js';
import { UNKNOWN_ACTOR_ID } from '../../constants/unknownIds.js';
import { getLogger } from './helpers/contextUtils.js';
import { validateContextMethods } from './helpers/validationUtils.js';

/**
 * @class AbstractTurnState
 * @implements {ITurnState_Interface}
 * @description
 * An abstract base class for turn states. It stores the BaseTurnHandler instance
 * (passed in constructor) to facilitate state transitions and to access the ITurnContext.
 * Concrete states extend this and primarily interact with turn data/services via ITurnContext
 * obtained from the handler.
 */
export class AbstractTurnState extends ITurnState {
  /**
   * The BaseTurnHandler (acting as the state machine's context) in which this state operates.
   * Provides access to state transition methods (_transitionToState) and the current ITurnContext.
   *
   * @protected
   * @readonly
   * @type {BaseTurnHandler}
   */
  _handler; // Renamed from _handlerContext for clarity, matches param name in methods.

  /**
   * Creates an instance of AbstractTurnState.
   *
   * @param {BaseTurnHandler} handler - The BaseTurnHandler instance that manages this state.
   * @throws {Error} If the handler is not provided.
   */
  constructor(handler) {
    super();
    if (!handler) {
      const errorMessage = `${this.constructor.name} Constructor: BaseTurnHandler (handler) must be provided.`;
      // Attempt to use a global/static logger if available, otherwise console.
      const logger =
        typeof handler?.getLogger === 'function'
          ? handler.getLogger()
          : console;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    this._handler = handler;
  }

  /**
   * Retrieves the current ITurnContext from the stored handler.
   * This is the primary way concrete states should access actor, logger, services, etc.
   *
   * @protected
   * @returns {ITurnContext | null} The current ITurnContext, or null if no turn is active.
   */
  _getTurnContext() {
    if (!this._handler || typeof this._handler.getTurnContext !== 'function') {
      const logger =
        typeof this._handler?.getLogger === 'function'
          ? this._handler.getLogger()
          : console;
      const errorMessage = `${this.getStateName()}: _handler is invalid or missing getTurnContext method.`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    const turnCtx = this._handler.getTurnContext();
    if (!turnCtx) {
      // Use the handler's logger, which should always be available on BaseTurnHandler
      const handlerLogger = this._handler.getLogger();
      // ↓↓↓ CHANGED warn ➜ debug – this condition is expected during teardown and should not pollute logs.
      handlerLogger.debug(
        `${this.getStateName()}: Attempted to access ITurnContext via _getTurnContext(), but none is currently active on the handler.`
      );
    }
    return turnCtx;
  }

  /**
   
   * Resets turn-specific resources and requests a transition to the idle state.
   *
   * @protected
   * @async
   * @param {string} reason - Contextual reason for the reset.
   * @returns {Promise<void>}
   */
  async _resetToIdle(reason) {
    if (typeof this._handler?.resetStateAndResources === 'function') {
      this._handler.resetStateAndResources(reason);
    }
    if (typeof this._handler?.requestIdleStateTransition === 'function') {
      await this._handler.requestIdleStateTransition();
    }
  }

  /**
   * Ensures a valid ITurnContext exists. If not, logs an error and resets
   * the handler to an idle state.
   *
   * @protected
   * @async
   * @param {string} reason - Reason passed to the idle reset helper.
   * @returns {Promise<ITurnContext | null>} The current ITurnContext or null if
   *   none is available.
   */
  async _ensureContext(reason) {
    let ctx;
    try {
      ctx = this._getTurnContext();
    } catch (err) {
      getLogger(null, this._handler).error(err.message);
      await this._resetToIdle(reason);
      return null;
    }
    if (!ctx) {
      getLogger(null, this._handler).error(
        `${this.getStateName()}: No ITurnContext available. Resetting to idle.`
      );
      await this._resetToIdle(reason);
      return null;
    }
    return ctx;
  }

  /**
   * Logs state transitions for entering or exiting a state.
   *
   * @private
   * @param {"enter"|"exit"} action - Whether the state is being entered or exited.
   * @param {string} actorId - Resolved actor identifier for the log.
   * @param {string} otherState - Name of the previous or next state.
   * @returns {void}
   */
  _logStateTransition(action, actorId, otherState) {
    const turnCtx = this._getTurnContext();
    const logger = getLogger(turnCtx, this._handler);

    const isEnter = action === 'enter';
    const message = isEnter
      ? `${this.getStateName()}: Entered. Actor: ${actorId}. Previous state: ${otherState}.`
      : `${this.getStateName()}: Exiting. Actor: ${actorId}. Transitioning to ${otherState}.`;

    if (logger) {
      logger.debug(message);
    } else {
      console.log(`(Fallback log) ${message}`);
    }
  }

  /**
   * Ensures the ITurnContext implements required methods.
   *
   * @protected
   * @async
   * @param {string} reason - Explanation for context retrieval.
   * @param {string[]} requiredMethods - Methods expected on the context.
   * @param {{ endTurnOnFail?: boolean }} [opts] - Options controlling failure behavior.
   * @returns {Promise<ITurnContext|null>} The context if valid, otherwise null.
   */
  async _ensureContextWithMethods(
    reason,
    requiredMethods,
    { endTurnOnFail = false } = {}
  ) {
    const ctx = await AbstractTurnState.prototype._ensureContext.call(
      this,
      reason
    );
    if (!ctx) return null;

    const missing = validateContextMethods(ctx, requiredMethods);
    if (missing.length) {
      const logger = getLogger(ctx, this._handler);
      const msg = `${this.getStateName()}: ITurnContext missing required methods: ${missing.join(', ')}`;
      logger.error(msg);

      if (endTurnOnFail && typeof ctx.endTurn === 'function') {
        await ctx.endTurn(new Error(msg));
      } else {
        await this._resetToIdle(`missing-methods-${this.getStateName()}`);
      }
      return null;
    }

    return ctx;
  }

  // --- Interface Methods with Default Implementations ---

  /** @override */
  async enterState(handler, previousState) {
    const turnCtx = this._getTurnContext();

    let actorIdForLog = 'N/A';
    if (turnCtx && typeof turnCtx.getActor === 'function') {
      const actor = turnCtx.getActor();
      if (actor && typeof actor.id !== 'undefined') actorIdForLog = actor.id;
    }

    const prevName = previousState?.getStateName() ?? 'None';
    this._logStateTransition('enter', actorIdForLog, prevName);
  }

  /** @override */
  async exitState(handler, nextState) {
    const turnCtx = this._getTurnContext();

    let actorIdForLog = 'N/A';
    if (turnCtx && typeof turnCtx.getActor === 'function') {
      const actor = turnCtx.getActor();
      if (actor && typeof actor.id !== 'undefined') actorIdForLog = actor.id;
    }

    const nextName = nextState?.getStateName() ?? 'None';
    this._logStateTransition('exit', actorIdForLog, nextName);
  }

  /** @override */
  async startTurn(handler, actorEntity) {
    const turnCtx = this._getTurnContext();
    const logger = getLogger(turnCtx, handler);
    const actorIdForLog = actorEntity?.id ?? UNKNOWN_ACTOR_ID;
    const warningMessage = `Method 'startTurn(actorId: ${actorIdForLog})' called on state ${this.getStateName()} where it is not expected or handled.`;
    logger.warn(warningMessage);
    throw new Error(
      `Method 'startTurn()' is not applicable for state ${this.getStateName()}.`
    );
  }

  /** @override */
  async handleSubmittedCommand(handler, commandString, actorEntity) {
    const turnCtx = this._getTurnContext();
    const logger = getLogger(turnCtx, handler);
    const contextActorId = turnCtx?.getActor()?.id ?? 'NO_CONTEXT_ACTOR';
    const errorMessage = `Method 'handleSubmittedCommand(command: "${commandString}", entity: ${actorEntity?.id}, contextActor: ${contextActorId})' must be implemented by concrete state ${this.getStateName()}.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  /** @override */
  async handleTurnEndedEvent(handler, payload) {
    const turnCtx = this._getTurnContext();
    const logger = getLogger(turnCtx, handler);
    const warningMessage = `Method 'handleTurnEndedEvent(payloadActorId: ${payload?.entityId})' called on state ${this.getStateName()} where it might not be expected or handled. Current context actor: ${turnCtx?.getActor()?.id ?? 'N/A'}.`;
    logger.warn(warningMessage);
  }

  /** @override */
  async processCommandResult(handler, actor, commandResult, commandString) {
    const turnCtx = this._getTurnContext(); // Actor should come from turnCtx
    const logger = getLogger(turnCtx, handler);
    const contextActor = turnCtx?.getActor();
    if (actor.id !== contextActor?.id) {
      logger.warn(
        `${this.getStateName()}: processCommandResult called with actor ${actor.id} that does not match context actor ${contextActor?.id}.`
      );
    }
    const errorMessage = `Method 'processCommandResult(actorId: ${contextActor?.id}, command: "${commandString}")' must be implemented by concrete state ${this.getStateName()}.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  /** @override */
  async handleDirective(handler, actor, directive, commandResult) {
    const turnCtx = this._getTurnContext(); // Actor should come from turnCtx
    const logger = getLogger(turnCtx, handler);
    const contextActor = turnCtx?.getActor();
    if (actor.id !== contextActor?.id) {
      logger.warn(
        `${this.getStateName()}: handleDirective called with actor ${actor.id} that does not match context actor ${contextActor?.id}.`
      );
    }
    const errorMessage = `Method 'handleDirective(actorId: ${contextActor?.id}, directive: ${directive})' must be implemented by concrete state ${this.getStateName()}.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  /** @override */
  async destroy(handler) {
    // Ensure logger is available, use handler's as context might be gone
    const logger = handler.getLogger();
    logger.debug(
      `${this.getStateName()}: Received destroy call. No state-specific cleanup by default in AbstractTurnState.`
    );
  }

  /** @override */
  getStateName() {
    return this.constructor.name; // Default implementation
  }

  /** @override */
  isIdle() {
    return false;
  }

  /** @override */
  isEnding() {
    return false;
  }
}

// --- FILE END ---
