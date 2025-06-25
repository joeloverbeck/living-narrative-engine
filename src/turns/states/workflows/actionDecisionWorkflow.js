/**
 * @file actionDecisionWorkflow.js
 * @description Workflow logic for AwaitingActorDecisionState handling action decisions.
 */

export class ActionDecisionWorkflow {
  /**
   * @param {import('../awaitingActorDecisionState.js').AwaitingActorDecisionState} state - Owning state instance.
   * @param {import('../../interfaces/turnStateContextTypes.js').AwaitingActorDecisionStateContext} turnContext - Context for the turn.
   * @param {import('../../../entities/entity.js').default} actor - Actor making the decision.
   * @param {import('../../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} strategy - Strategy used to decide the action.
   */
  constructor(state, turnContext, actor, strategy) {
    this._state = state;
    this._turnContext = turnContext;
    this._actor = actor;
    this._strategy = strategy;
  }

  /**
   * Runs the workflow.
   *
   * @returns {Promise<void>} Resolves when workflow completes.
   */
  async run() {
    const logger = this._turnContext.getLogger();
    try {
      const { action, extractedData } = await this._state._decideAction(
        this._strategy,
        this._turnContext,
        this._actor
      );

      if (!action || typeof action.actionDefinitionId !== 'string') {
        const warnMsg = `${this._state.getStateName()}: Strategy for actor ${this._actor.id} returned an invalid or null ITurnAction (must have actionDefinitionId).`;
        this._turnContext.getLogger().warn(warnMsg, { receivedAction: action });
        await this._turnContext.endTurn(new Error(warnMsg));
        return;
      }

      this._state._recordDecision(this._turnContext, action, extractedData);
      await this._state._emitActionDecided(
        this._turnContext,
        this._actor,
        extractedData
      );

      const cmdStr =
        action.commandString && action.commandString.trim().length > 0
          ? action.commandString
          : action.actionDefinitionId;

      logger.debug(
        `${this._state.getStateName()}: Requesting transition to ProcessingCommandState for actor ${this._actor.id}.`
      );
      await this._turnContext.requestProcessingCommandStateTransition(
        cmdStr,
        action
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        logger.debug(
          `${this._state.getStateName()}: Action decision for actor ${this._actor.id} was cancelled (aborted). Ending turn gracefully.`
        );
        await this._turnContext.endTurn(null);
      } else {
        const errMsg = `${this._state.getStateName()}: Error during action decision, storage, or transition for actor ${this._actor.id}: ${error.message}`;
        logger.error(errMsg, { originalError: error });
        await this._turnContext.endTurn(new Error(errMsg, { cause: error }));
      }
    }
  }
}

export default ActionDecisionWorkflow;
