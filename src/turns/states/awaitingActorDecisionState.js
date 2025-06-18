// src/turns/states/awaitingActorDecisionState.js

/**
 * @file Defines the AwaitingActorDecisionState class for the turn-based system.
 * @module core/turns/states/awaitingPlayerInputState
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ACTION_DECIDED_ID } from '../../constants/eventIds.js';
import { getActorType } from '../../utils/actorTypeUtils.js';
import { resolveLogger } from '../util/loggerUtils.js';
import { getSafeEventDispatcher } from '../util/eventDispatcherUtils.js';

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
   * @override
   */
  async enterState(handler, previousState) {
    await super.enterState(handler, previousState);

    const turnContext = await this._ensureContext(
      `critical-no-context-${this.getStateName()}`,
      handler
    );
    if (!turnContext) return;

    const logger = turnContext.getLogger();

    const validation = await this._validateActorAndStrategy(turnContext);
    if (!validation) return;
    const { actor, strategy } = validation;

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
   * @description Validates actor existence and retrieves a usable strategy.
   * @param {ITurnContext} turnContext - Current turn context.
   * @returns {Promise<{actor: Entity, strategy: import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} | null>}
   * Returns `null` if validation fails.
   */
  async _validateActorAndStrategy(turnContext) {
    const logger = turnContext.getLogger();
    const actor = turnContext.getActor();
    if (!actor) {
      logger.error(
        `${this.getStateName()}: No actor found in TurnContext. Ending turn.`
      );
      await turnContext.endTurn(
        new Error('No actor in context during AwaitingActorDecisionState.')
      );
      return null;
    }

    logger.debug(
      `${this.getStateName()}: Actor ${actor.id}. Attempting to retrieve turn strategy.`
    );

    if (typeof turnContext.getStrategy !== 'function') {
      const msg = `${this.getStateName()}: turnContext.getStrategy() is not a function for actor ${actor.id}.`;
      logger.error(msg);
      await turnContext.endTurn(new Error(msg));
      return null;
    }

    const strategy = turnContext.getStrategy();
    if (!strategy || typeof strategy.decideAction !== 'function') {
      const msg = `${this.getStateName()}: No valid IActorTurnStrategy found for actor ${actor.id} or strategy is malformed (missing decideAction).`;
      logger.error(msg, { strategyReceived: strategy });
      await turnContext.endTurn(new Error(msg));
      return null;
    }

    const strategyName = strategy.constructor?.name ?? 'Object';
    logger.debug(
      `${this.getStateName()}: Strategy ${strategyName} obtained for actor ${actor.id}. Requesting action decision.`
    );
    return { actor, strategy };
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

    const dispatcher = getSafeEventDispatcher(turnContext);
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
    const l = resolveLogger(this._getTurnContext(), handler);
    l.debug(
      `${this.getStateName()}: ExitState cleanup (if any) specific to AwaitingActorDecisionState complete.`
    );
  }

  /* --------------------------------------------------------------------- */
  async handleSubmittedCommand(handlerInstance, commandString, actorEntity) {
    const handler = handlerInstance || this._handler;
    const turnContext = await this._ensureContext(
      `no-context-submission-${this.getStateName()}`,
      handler
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
  async handleTurnEndedEvent(handlerInstance, payload) {
    const handler = handlerInstance || this._handler;
    const turnContext = this._getTurnContext();
    const logger = resolveLogger(turnContext, handler);

    if (!turnContext) {
      logger.warn(
        `${this.getStateName()}: handleTurnEndedEvent received but no turn context. Payload: ${JSON.stringify(
          payload
        )}. Deferring to superclass.`
      );
      return super.handleTurnEndedEvent(handler, payload);
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
      await super.handleTurnEndedEvent(handler, payload);
    }
  }

  /* --------------------------------------------------------------------- */
  async destroy(handlerInstance) {
    const handler = handlerInstance || this._handler;
    const turnContext = handler?.getTurnContext?.();
    const logger = resolveLogger(turnContext, handler);
    const actorInCtx = turnContext?.getActor();

    if (turnContext) {
      if (!actorInCtx) {
        logger.warn(
          `${this.getStateName()}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`
        );
      } else if (handler._isDestroying || handler._isDestroyed) {
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

    await super.destroy(handler);
  }
}
