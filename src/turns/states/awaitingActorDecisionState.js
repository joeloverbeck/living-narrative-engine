// src/turns/states/awaitingActorDecisionState.js

/**
 * @file Defines the AwaitingActorDecisionState class for the turn-based system.
 * @module core/turns/states/awaitingPlayerInputState
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ACTION_DECIDED_ID } from '../../constants/eventIds.js';
import { determineActorType } from '../../utils/actorTypeUtils.js';
import { getLogger, getSafeEventDispatcher } from './helpers/contextUtils.js';
import { ActionDecisionWorkflow } from './workflows/actionDecisionWorkflow.js';

/**
 * @typedef {import('../interfaces/turnStateContextTypes.js').AwaitingActorDecisionStateContext} AwaitingActorDecisionStateContext
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 */
import {
  validateActorInContext,
  retrieveStrategyFromContext,
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
   * Factory function for creating ActionDecisionWorkflow instances.
   *
   * @type {(state: AwaitingActorDecisionState, ctx: AwaitingActorDecisionStateContext, actor: import('../../entities/entity.js').default, strategy: import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy) => ActionDecisionWorkflow}
   */
  _workflowFactory;

  /**
   * Creates an instance of AwaitingActorDecisionState.
   *
   * @param {BaseTurnHandler} handler - Owning handler instance.
   * @param {(state: AwaitingActorDecisionState, ctx: AwaitingActorDecisionStateContext, actor: import('../../entities/entity.js').default, strategy: import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy) => ActionDecisionWorkflow} [workflowFactory] - Optional factory for creating the workflow.
   */
  constructor(
    handler,
    workflowFactory = (state, ctx, actor, strategy) =>
      new ActionDecisionWorkflow(state, ctx, actor, strategy)
  ) {
    super(handler);
    this._workflowFactory = workflowFactory;
  }
  /**
   * Ensures the context provides required methods for this state.
   *
   * @override
   * @param {string} reason - Explanation for context retrieval.
   * @returns {Promise<AwaitingActorDecisionStateContext|null>} The context if
   *   valid, otherwise null.
   */
  async _ensureContext(reason) {
    const required = [
      'getActor',
      'getLogger',
      'getStrategy',
      'requestProcessingCommandStateTransition',
      'endTurn',
    ];
    const ctx = await this._ensureContextWithMethods(reason, required, {
      endTurnOnFail: true,
    });
    return /** @type {AwaitingActorDecisionStateContext | null} */ (ctx);
  }

  /**
   * @description Validates and retrieves the actor and strategy from the context.
   * @private
   * @param {AwaitingActorDecisionStateContext} turnContext - The current turn context.
   * @returns {Promise<{actor: Entity, strategy: import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy}|null>} The actor and strategy if valid, otherwise `null`.
   */
  async _getValidatedActorAndStrategy(turnContext) {
    try {
      const actor = this.validateActor(turnContext);
      const strategy = this.retrieveStrategy(turnContext, actor);
      return { actor, strategy };
    } catch (validationError) {
      await turnContext.endTurn(validationError);
      return null;
    }
  }

  /**
   * @description Handles strategy decision and state transition logic.
   * @private
   * @param {AwaitingActorDecisionStateContext} turnContext - Current turn context.
   * @param {Entity} actor - Actor making the decision.
   * @param {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} strategy - Strategy used for decision making.
   * @returns {Promise<void>} Resolves when handling completes.
   */
  async _handleActionDecision(turnContext, actor, strategy) {
    const workflow = this._workflowFactory(this, turnContext, actor, strategy);
    await workflow.run();
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

    const validated = await this._getValidatedActorAndStrategy(turnContext);
    if (!validated) return;

    const { actor, strategy } = validated;
    await this._handleActionDecision(turnContext, actor, strategy);
  }

  /**
   * @description Validates that the turn context contains a valid actor.
   * @param {ITurnContext} turnContext - Current turn context.
   * @returns {Entity} Actor entity from the context.
   * @throws {Error} If no actor exists in the context.
   */
  validateActor(turnContext) {
    try {
      const actor = validateActorInContext(
        turnContext,
        null,
        this.getStateName()
      );
      turnContext
        .getLogger()
        .debug(
          `${this.getStateName()}: Actor ${actor.id}. Attempting to retrieve turn strategy.`
        );
      return actor;
    } catch (err) {
      turnContext
        .getLogger()
        .error(
          `${this.getStateName()}: No actor found in TurnContext. Ending turn.`
        );
      throw new Error('No actor in context during AwaitingActorDecisionState.');
    }
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
    try {
      const strategy = retrieveStrategyFromContext(
        turnContext,
        actor,
        this.getStateName()
      );
      const strategyName = strategy.constructor?.name ?? 'Object';
      turnContext
        .getLogger()
        .debug(
          `${this.getStateName()}: Strategy ${strategyName} obtained for actor ${actor.id}. Requesting action decision.`
        );
      return strategy;
    } catch (err) {
      turnContext
        .getLogger()
        .error(err.message, { strategyReceived: turnContext.getStrategy() });
      throw err;
    }
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
      actorType: determineActorType(actor),
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

    await this._handleDestroyCleanup(
      activeHandler,
      turnContext,
      logger,
      actorInCtx
    );
    await super.destroy(activeHandler);
  }

  /**
   * @description Handles cleanup when the handler is destroyed while this state is active.
   * @private
   * @param {BaseTurnHandler} handler - Active turn handler being destroyed.
   * @param {?ITurnContext} turnContext - Current turn context.
   * @param {import('../../interfaces/coreServices.js').ILogger | Console} logger - Logger instance.
   * @param {?Entity} actor - Actor retrieved from the context.
   * @returns {Promise<void>} Resolves when cleanup completes.
   */
  async _handleDestroyCleanup(handler, turnContext, logger, actor) {
    if (turnContext) {
      if (!actor) {
        this._handleNoActorOnDestroy(logger);
      } else if (handler._isDestroying || handler._isDestroyed) {
        this._handleHandlerDestroying(logger, actor);
      } else {
        await this._handleActiveActorOnDestroy(turnContext, logger, actor);
      }
    } else {
      logger.warn(
        `${this.getStateName()}: Handler destroyed. Actor ID from context: N/A_no_context. No specific turn to end via context if actor is missing.`
      );
    }
  }

  /**
   * @description Logs warning when handler is destroyed and no actor exists in context.
   * @private
   * @param {import('../../interfaces/coreServices.js').ILogger | Console} logger - Logger instance.
   */
  _handleNoActorOnDestroy(logger) {
    logger.warn(
      `${this.getStateName()}: Handler destroyed. Actor ID from context: N/A_in_context. No specific turn to end via context if actor is missing.`
    );
  }

  /**
   * @description Logs debug message when handler is already destroying or destroyed.
   * @private
   * @param {import('../../interfaces/coreServices.js').ILogger | Console} logger - Logger instance.
   * @param {Entity} actor - Actor retrieved from the context.
   */
  _handleHandlerDestroying(logger, actor) {
    logger.debug(
      `${this.getStateName()}: Handler (actor ${actor.id}) is already being destroyed. Skipping turnContext.endTurn().`
    );
  }

  /**
   * @description Ends the turn via context when handler is destroyed with an active actor.
   * @private
   * @param {ITurnContext} turnContext - Current turn context.
   * @param {import('../../interfaces/coreServices.js').ILogger | Console} logger - Logger instance.
   * @param {Entity} actor - Actor retrieved from the context.
   * @returns {Promise<void>} Resolves when turn ending completes.
   */
  async _handleActiveActorOnDestroy(turnContext, logger, actor) {
    logger.debug(
      `${this.getStateName()}: Handler destroyed while state was active for actor ${
        actor.id
      }. Ending turn via turnContext (may trigger AbortError if prompt was active).`
    );
    await turnContext.endTurn(
      new Error(
        `Turn handler destroyed while actor ${actor.id} was in ${this.getStateName()}.`
      )
    );
  }
}
