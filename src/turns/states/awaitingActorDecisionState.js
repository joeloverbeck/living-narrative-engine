// src/turns/states/awaitingActorDecisionState.js

/**
 * @file Defines the AwaitingActorDecisionState class for the turn-based system.
 * @module core/turns/states/awaitingPlayerInputState
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ACTION_DECIDED_ID } from '../../constants/eventIds.js';
import { getActorType } from '../../utils/actorTypeUtils.js';
import { getLogger, getSafeEventDispatcher } from './helpers/contextUtils.js';

/**
 * @typedef {import('../interfaces/turnStateContextTypes.js').AwaitingActorDecisionStateContext} AwaitingActorDecisionStateContext
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 */
import {
  assertValidActor,
  assertMatchingActor,
} from './helpers/validationUtils.js';

/**
 * State in which the engine waits for the current actor’s turn-strategy to
 * decide an ITurnAction.  When a valid action is obtained it is recorded in the
 * TurnContext and we transition to a processing state.
 *
 * ● `AbortError` from the strategy is treated as a graceful cancel.
 * ● All other errors cause the turn to end with an error.
 */
export class AwaitingActorDecisionState extends AbstractTurnState {
  /**
   * Ensures the context provides required methods for this state.
   *
   * @override
   * @param {string} reason - Explanation for context retrieval.
   * @returns {Promise<AwaitingActorDecisionStateContext|null>} The context if
   *   valid, otherwise null.
   */
  async _ensureContext(reason) {
    const ctx = await super._ensureContext(reason);
    if (!ctx) return null;
    const required = [
      'getActor',
      'getLogger',
      'getStrategy',
      'requestProcessingCommandStateTransition',
      'endTurn',
    ];
    const missing = required.filter((m) => typeof ctx[m] !== 'function');
    if (missing.length) {
      getLogger(ctx, this._handler).error(
        `${this.getStateName()}: ITurnContext missing required methods: ${missing.join(', ')}`
      );
      if (typeof ctx.endTurn === 'function') {
        await ctx.endTurn(
          new Error(
            `${this.getStateName()}: ITurnContext missing required methods: ${missing.join(', ')}`
          )
        );
      } else {
        await this._resetToIdle(`missing-methods-${this.getStateName()}`);
      }
      return null;
    }
    return /** @type {AwaitingActorDecisionStateContext} */ (ctx);
  }
  /**
   * @override
   */
  async enterState(handler, previousState) {
    await super.enterState(handler, previousState);

    const turnContext = await this._ensureContext(
      `critical-no-context-${this.getStateName()}`
    );
    if (!turnContext) return;

    const logger = turnContext.getLogger();

    let actor;
    let strategy;
    try {
      actor = this.validateActor(turnContext);
      strategy = this.retrieveStrategy(turnContext, actor);
    } catch (validationError) {
      await turnContext.endTurn(validationError);
      return;
    }

    try {
      const { action, extractedData } = await this._decideAction(
        strategy,
        turnContext,
        actor
      );

      if (!action || typeof action.actionDefinitionId !== 'string') {
        const warnMsg = `${this.getStateName()}: Strategy for actor ${actor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
        turnContext.getLogger().warn(warnMsg, { receivedAction: action });
        await turnContext.endTurn(new Error(warnMsg));
        return;
      }

      this._recordDecision(turnContext, action, extractedData);
      await this._emitActionDecided(turnContext, actor, extractedData);

      const cmdStr =
        action.commandString && action.commandString.trim().length > 0
          ? action.commandString
          : action.actionDefinitionId;

      turnContext
        .getLogger()
        .debug(
          `${this.getStateName()}: Requesting transition to ProcessingCommandState for actor ${actor.id}.`
        );
      await turnContext.requestProcessingCommandStateTransition(cmdStr, action);
    } catch (error) {
      if (error?.name === 'AbortError') {
        logger.debug(
          `${this.getStateName()}: Action decision for actor ${actor.id} was cancelled (aborted). Ending turn gracefully.`
        );
        await turnContext.endTurn(null);
      } else {
        const errMsg = `${this.getStateName()}: Error during action decision, storage, or transition for actor ${actor.id}: ${error.message}`;
        logger.error(errMsg, { originalError: error });
        await turnContext.endTurn(new Error(errMsg, { cause: error }));
      }
    }
  }

  /**
   * @description Validates that the turn context contains a valid actor.
   * @param {ITurnContext} turnContext - Current turn context.
   * @returns {Entity} Actor entity from the context.
   * @throws {Error} If no actor exists in the context.
   */
  validateActor(turnContext) {
    const logger = turnContext.getLogger();
    const actor = turnContext.getActor();
    const errorMsg = assertValidActor(actor, this.getStateName());
    if (errorMsg) {
      logger.error(
        `${this.getStateName()}: No actor found in TurnContext. Ending turn.`
      );
      throw new Error('No actor in context during AwaitingActorDecisionState.');
    }

    logger.debug(
      `${this.getStateName()}: Actor ${actor.id}. Attempting to retrieve turn strategy.`
    );

    return actor;
  }

  /**
   * @description Retrieves and validates the actor's strategy from context.
   * @param {ITurnContext} turnContext - Current turn context.
   * @param {Entity} actor - Actor whose strategy is being retrieved.
   * @returns {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy}
   * The resolved strategy.
   * @throws {Error} If the strategy is missing or malformed.
   */
  retrieveStrategy(turnContext, actor) {
    const logger = turnContext.getLogger();
    const actorError = assertValidActor(actor, this.getStateName());
    if (actorError) {
      logger.error(actorError);
      throw new Error(actorError);
    }

    const strategy = turnContext.getStrategy();
    if (!strategy || typeof strategy.decideAction !== 'function') {
      const msg = `${this.getStateName()}: No valid IActorTurnStrategy found for actor ${actor.id} or strategy is malformed (missing decideAction).`;
      logger.error(msg, { strategyReceived: strategy });
      throw new Error(msg);
    }

    const strategyName = strategy.constructor?.name ?? 'Object';
    logger.debug(
      `${this.getStateName()}: Strategy ${strategyName} obtained for actor ${actor.id}. Requesting action decision.`
    );

    return strategy;
  }

  /**
   * @description Invokes the strategy to decide an action.
   * @param {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} strategy - Actor strategy.
   * @param {ITurnContext} turnContext - Current turn context.
   * @param {Entity} actor - Actor deciding the action.
   * @returns {Promise<{action: ITurnAction|null, extractedData: object|null}>} Decision result.
   */
  async _decideAction(strategy, turnContext, actor) {
    const decision = await strategy.decideAction(turnContext);
    return {
      action: decision ? decision.action || decision : null,
      extractedData: decision?.extractedData ?? null,
    };
  }

  /**
   * @description Stores decision metadata and chosen action in the context.
   * @param {ITurnContext} turnContext - Current turn context.
   * @param {ITurnAction} action - Chosen action.
   * @param {?object} extractedData - Additional metadata from strategy.
   */
  _recordDecision(turnContext, action, extractedData) {
    if (typeof turnContext.setDecisionMeta === 'function') {
      const metaFrozen = extractedData ? Object.freeze(extractedData) : null;
      turnContext.setDecisionMeta(metaFrozen);
    }

    turnContext
      .getLogger()
      .debug(
        `${this.getStateName()}: Actor ${action?.actorId ?? turnContext.getActor().id} decided action: ${action.actionDefinitionId}. Storing action.`
      );

    if (typeof turnContext.setChosenAction === 'function') {
      turnContext.setChosenAction(action);
    } else {
      turnContext
        .getLogger()
        .warn(
          `${this.getStateName()}: ITurnContext.setChosenAction() not found. Cannot store action in context.`
        );
    }
  }

  /**
   * @description Emits the ACTION_DECIDED_ID event using SafeEventDispatcher.
   * @param {ITurnContext} turnContext - Current turn context.
   * @param {Entity} actor - Actor who decided.
   * @param {?object} extractedData - Metadata from the decision.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async _emitActionDecided(turnContext, actor, extractedData) {
    const payload = {
      actorId: actor.id,
      actorType: getActorType(actor),
    };
    if (extractedData) {
      payload.extractedData = {
        ...extractedData,
        thoughts: extractedData.thoughts ?? '',
        notes: extractedData.notes ?? [],
      };
    }

    const dispatcher = getSafeEventDispatcher(turnContext, this._handler);
    const logger = turnContext.getLogger();
    if (dispatcher) {
      try {
        await dispatcher.dispatch(ACTION_DECIDED_ID, payload);
        logger.debug(`Dispatched ${ACTION_DECIDED_ID} for actor ${actor.id}`);
      } catch (e) {
        logger.error(
          `Failed to dispatch ${ACTION_DECIDED_ID} event for actor ${actor.id}`,
          e
        );
      }
    } else {
      logger.error(
        `${this.getStateName()}: No SafeEventDispatcher available to dispatch ${ACTION_DECIDED_ID} for actor ${actor.id}.`
      );
    }
  }

  /* --------------------------------------------------------------------- */
  async exitState(handler, nextState) {
    await super.exitState(handler, nextState);
    const logger = getLogger(this._getTurnContext(), this._handler);
    logger.debug(
      `${this.getStateName()}: ExitState cleanup (if any) specific to AwaitingActorDecisionState complete.`
    );
  }

  /* --------------------------------------------------------------------- */
  async handleSubmittedCommand(handler, commandString, actorEntity) {
    const activeHandler = handler || this._handler;
    const turnContext = await this._ensureContext(
      `no-context-submission-${this.getStateName()}`
    );
    if (!turnContext) return;

    const logger = turnContext.getLogger();
    const actorInCtx = turnContext.getActor();
    const actorId = actorInCtx ? actorInCtx.id : 'unknown actor in context';

    logger.warn(
      `${this.getStateName()}: handleSubmittedCommand was called directly for actor ${actorId} with command "${commandString}". This is unexpected in the new strategy-driven workflow. Ending turn.`
    );
    await turnContext.endTurn(
      new Error(
        `Unexpected direct command submission to ${this.getStateName()} for actor ${actorId}. Input should be strategy-driven.`
      )
    );
  }

  /* --------------------------------------------------------------------- */
  async handleTurnEndedEvent(handler, payload) {
    const activeHandler = handler || this._handler;
    const turnContext = this._getTurnContext();
    const logger = getLogger(turnContext, activeHandler);

    if (!turnContext) {
      logger.warn(
        `${this.getStateName()}: handleTurnEndedEvent received but no turn context. Payload: ${JSON.stringify(
          payload
        )}. Deferring to superclass.`
      );
      return super.handleTurnEndedEvent(activeHandler, payload);
    }

    const ctxActor = turnContext.getActor();
    const evtId = payload?.entityId;

    if (ctxActor && ctxActor.id === evtId) {
      logger.debug(
        `${this.getStateName()}: core:turn_ended event received for current actor ${ctxActor.id}. Ending turn.`
      );
      await turnContext.endTurn(payload.error || null);
    } else {
      logger.debug(
        `${this.getStateName()}: core:turn_ended event for actor ${evtId} is not for current context actor ${
          ctxActor?.id
        }. Deferring to superclass.`
      );
      await super.handleTurnEndedEvent(activeHandler, payload);
    }
  }

  /* --------------------------------------------------------------------- */
  async destroy(handler) {
    const activeHandler = handler || this._handler;
    const turnContext = activeHandler?.getTurnContext?.();
    const logger = getLogger(turnContext, activeHandler);
    const actorInCtx = turnContext?.getActor();

    if (turnContext) {
      if (!actorInCtx) {
        logger.warn(
          `${this.getStateName()}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`
        );
      } else if (activeHandler._isDestroying || activeHandler._isDestroyed) {
        logger.debug(
          `${this.getStateName()}: Handler (actor ${actorInCtx.id}) is already being destroyed. Skipping turnContext.endTurn().`
        );
      } else {
        logger.debug(
          `${this.getStateName()}: Handler destroyed while state was active for actor ${
            actorInCtx.id
          }. Ending turn via turnContext (may trigger AbortError if prompt was active).`
        );
        await turnContext.endTurn(
          new Error(
            `Turn handler destroyed while actor ${actorInCtx.id} was in ${this.getStateName()}.`
          )
        );
      }
    } else {
      logger.warn(
        `${this.getStateName()}: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`
      );
    }

    await super.destroy(activeHandler);
  }
}
