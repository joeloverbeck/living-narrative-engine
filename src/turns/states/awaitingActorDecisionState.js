// src/turns/states/awaitingActorDecisionState.js

/**
 * @file Defines the AwaitingActorDecisionState class for the turn-based system.
 * @module core/turns/states/awaitingPlayerInputState
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ACTION_DECIDED_ID } from '../../constants/eventIds';

/**
 * State in which the engine waits for the current actor’s turn-strategy to
 * decide an ITurnAction.  When a valid action is obtained it is recorded in the
 * TurnContext and we transition to a processing state.
 *
 * ● `AbortError` from the strategy is treated as a graceful cancel.
 * ● All other errors cause the turn to end with an error.
 */
export class AwaitingActorDecisionState extends AbstractTurnState {
  get name() {
    return this.getStateName();
  }

  /**
   * @override
   */
  async enterState(handler, previousState) {
    await super.enterState(handler, previousState);

    const turnContext = this._getTurnContext();
    if (!turnContext) {
      const logger = this._resolveLogger(null);
      logger.error(
        `${this.name}: Critical error - TurnContext is not available. Attempting to reset and idle.`
      );
      await this._resetToIdle(`critical-no-context-${this.name}`);
      return;
    }

    const logger = turnContext.getLogger();
    const actor = turnContext.getActor();

    if (!actor) {
      logger.error(`${this.name}: No actor found in TurnContext. Ending turn.`);
      await turnContext.endTurn(
        new Error('No actor in context during AwaitingActorDecisionState.')
      );
      return;
    }

    logger.debug(
      `${this.name}: Actor ${actor.id}. Attempting to retrieve turn strategy.`
    );

    if (typeof turnContext.getStrategy !== 'function') {
      const msg = `${this.name}: turnContext.getStrategy() is not a function for actor ${actor.id}.`;
      logger.error(msg);
      await turnContext.endTurn(new Error(msg));
      return;
    }

    const strategy = turnContext.getStrategy();
    if (!strategy || typeof strategy.decideAction !== 'function') {
      const msg = `${this.name}: No valid IActorTurnStrategy found for actor ${actor.id} or strategy is malformed (missing decideAction).`;
      logger.error(msg, { strategyReceived: strategy });
      await turnContext.endTurn(new Error(msg));
      return;
    }

    const strategyName = strategy.constructor?.name ?? 'Object';
    logger.debug(
      `${this.name}: Strategy ${strategyName} obtained for actor ${actor.id}. Requesting action decision.`
    );

    let decision, action, extractedData;
    try {
      decision = await strategy.decideAction(turnContext);
      action = decision ? decision.action || decision : null;
      extractedData = decision?.extractedData ?? null;

      if (typeof turnContext.setDecisionMeta === 'function') {
        const metaFrozen = extractedData ? Object.freeze(extractedData) : null;
        turnContext.setDecisionMeta(metaFrozen);
      }

      if (!action || typeof action.actionDefinitionId !== 'string') {
        const warnMsg = `${this.name}: Strategy for actor ${actor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
        logger.warn(warnMsg, { receivedAction: action });
        await turnContext.endTurn(new Error(warnMsg));
        return;
      }

      // Determine actor type: 'ai' or 'human'
      const actorType = actor.isAi === true ? 'ai' : 'human';

      // Dispatch the standardized action_decided event
      const payload = {
        actorId: actor.id,
        actorType,
      };

      // Sanitize the extractedData before adding it to the payload to ensure
      // it conforms to the event schema (e.g., no nulls for string/array types).
      if (extractedData) {
        payload.extractedData = {
          ...extractedData,
          thoughts: extractedData.thoughts ?? '',
          notes: extractedData.notes ?? [],
        };
      }

      try {
        const dispatcher = turnContext.getSafeEventDispatcher();
        await dispatcher.dispatch(ACTION_DECIDED_ID, payload);
        logger.debug(`Dispatched ${ACTION_DECIDED_ID} for actor ${actor.id}`);
      } catch (e) {
        logger.error(
          `Failed to dispatch ${ACTION_DECIDED_ID} event for actor ${actor.id}`,
          e
        );
      }

      logger.debug(
        `${this.name}: Actor ${actor.id} decided action: ${action.actionDefinitionId}. Storing action.`
      );

      if (typeof turnContext.setChosenAction === 'function') {
        turnContext.setChosenAction(action);
      } else {
        logger.warn(
          `${this.name}: ITurnContext.setChosenAction() not found. Cannot store action in context.`
        );
      }

      const cmdStr =
        action.commandString && action.commandString.trim().length > 0
          ? action.commandString
          : action.actionDefinitionId;

      logger.debug(
        `${this.getStateName()}: Requesting transition to ProcessingCommandState for actor ${actor.id}.`
      );
      await turnContext.requestProcessingCommandStateTransition(cmdStr, action);
    } catch (error) {
      if (error?.name === 'AbortError') {
        logger.debug(
          `${this.name}: Action decision for actor ${actor.id} was cancelled (aborted). Ending turn gracefully.`
        );
        await turnContext.endTurn(null);
      } else {
        const errMsg = `${this.name}: Error during action decision, storage, or transition for actor ${actor.id}: ${error.message}`;
        logger.error(errMsg, { originalError: error });
        await turnContext.endTurn(new Error(errMsg, { cause: error }));
      }
    }
  }

  /* --------------------------------------------------------------------- */
  async exitState(handler, nextState) {
    await super.exitState(handler, nextState);
    const l = this._resolveLogger(this._getTurnContext());
    l.debug(
      `${this.name}: ExitState cleanup (if any) specific to AwaitingActorDecisionState complete.`
    );
  }

  /* --------------------------------------------------------------------- */
  async handleSubmittedCommand(handlerInstance, commandString, actorEntity) {
    const turnContext = this._getTurnContext();

    if (!turnContext) {
      const logger = this._resolveLogger(null);
      const actorIdForLog = actorEntity?.id ?? 'unknown actor';
      logger.error(
        `${this.name}: handleSubmittedCommand (for actor ${actorIdForLog}, cmd: "${commandString}") called, but no ITurnContext. Forcing handler reset.`
      );
      await this._resetToIdle(`no-context-submission-${this.name}`);
      return;
    }

    const logger = turnContext.getLogger();
    const actorInCtx = turnContext.getActor();
    const actorId = actorInCtx ? actorInCtx.id : 'unknown actor in context';

    logger.warn(
      `${this.name}: handleSubmittedCommand was called directly for actor ${actorId} with command "${commandString}". This is unexpected in the new strategy-driven workflow. Ending turn.`
    );
    await turnContext.endTurn(
      new Error(
        `Unexpected direct command submission to ${this.name} for actor ${actorId}. Input should be strategy-driven.`
      )
    );
  }

  /* --------------------------------------------------------------------- */
  async handleTurnEndedEvent(handlerInstance, payload) {
    const handler = handlerInstance || this._handler;
    const turnContext = this._getTurnContext();
    const logger = this._resolveLogger(turnContext, handler);

    if (!turnContext) {
      logger.warn(
        `${this.name}: handleTurnEndedEvent received but no turn context. Payload: ${JSON.stringify(
          payload
        )}. Deferring to superclass.`
      );
      return super.handleTurnEndedEvent(handler, payload);
    }

    const ctxActor = turnContext.getActor();
    const evtId = payload?.entityId;

    if (ctxActor && ctxActor.id === evtId) {
      logger.debug(
        `${this.name}: core:turn_ended event received for current actor ${ctxActor.id}. Ending turn.`
      );
      await turnContext.endTurn(payload.error || null);
    } else {
      logger.debug(
        `${this.name}: core:turn_ended event for actor ${evtId} is not for current context actor ${
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
    const logger = this._resolveLogger(turnContext, handler);
    const actorInCtx = turnContext?.getActor();

    if (turnContext) {
      if (!actorInCtx) {
        logger.warn(
          `${this.name}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`
        );
      } else if (handler._isDestroying || handler._isDestroyed) {
        logger.debug(
          `${this.name}: Handler (actor ${actorInCtx.id}) is already being destroyed. Skipping turnContext.endTurn().`
        );
      } else {
        logger.debug(
          `${this.name}: Handler destroyed while state was active for actor ${
            actorInCtx.id
          }. Ending turn via turnContext (may trigger AbortError if prompt was active).`
        );
        await turnContext.endTurn(
          new Error(
            `Turn handler destroyed while actor ${actorInCtx.id} was in ${this.name}.`
          )
        );
      }
    } else {
      logger.warn(
        `${this.name}: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`
      );
    }

    await super.destroy(handler);
  }
}
