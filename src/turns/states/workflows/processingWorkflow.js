/**
 * @file processingWorkflow.js
 * @description Workflow logic for ProcessingCommandState.enterState and related helpers.
 */

import { AbstractTurnState } from '../abstractTurnState.js';
import { handleProcessingException } from '../helpers/handleProcessingException.js';

/**
 * @class ProcessingWorkflow
 * @description Executes the main processing workflow for a ProcessingCommandState instance.
 */
export class ProcessingWorkflow {
  /**
   * @param {import('../processingCommandState.js').ProcessingCommandState} state - Owning state instance.
   * @param {string|null} commandString - Command string for logging.
   * @param {import('../interfaces/IActorTurnStrategy.js').ITurnAction|null} initialAction - Constructor provided action.
   * @param {(action: import('../interfaces/IActorTurnStrategy.js').ITurnAction|null) => void} setAction - Setter for the state's private action field.
   */
  constructor(state, commandString, initialAction, setAction) {
    this._state = state;
    this._commandString = commandString;
    this._turnAction = initialAction;
    this._setAction = setAction;
  }

  /**
   * Runs the workflow.
   *
   * @param {import('../handlers/baseTurnHandler.js').BaseTurnHandler} handler - Owning handler.
   * @param {import('../interfaces/ITurnState.js').ITurnState|null} previousState - Previous state.
   * @returns {Promise<void>} Resolves when complete.
   */
  async run(handler, previousState) {
    const turnCtx = await this._state._ensureContext(
      `critical-no-context-${this._state.getStateName()}`,
      handler
    );
    if (!turnCtx) return;

    if (this._state._isProcessing) {
      const logger = this._state._resolveLogger(turnCtx);
      logger.warn(
        `${this._state.getStateName()}: enterState called while already processing. Actor: ${turnCtx?.getActor()?.id ?? 'N/A'}. Aborting re-entry.`
      );
      return;
    }
    this._state._processingGuard.start();

    await AbstractTurnState.prototype.enterState.call(
      this._state,
      handler,
      previousState
    );

    const actor = await this._validateContextAndActor(turnCtx);
    if (!actor) return;

    const turnAction = await this._resolveTurnAction(turnCtx, actor);
    if (!turnAction) return;

    const decisionMeta = turnCtx.getDecisionMeta?.() ?? {};
    await this._state._dispatchSpeech(turnCtx, actor, decisionMeta);

    await this._executeActionWorkflow(turnCtx, actor, turnAction);
  }

  /**
   * Validates the actor from the context and logs entry.
   *
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context.
   * @returns {Promise<import('../../entities/entity.js').default|null>} Resolved actor or null.
   */
  async _validateContextAndActor(turnCtx) {
    const logger = this._state._resolveLogger(turnCtx);
    const actor = turnCtx.getActor();
    if (!actor) {
      const noActorError = new Error(
        'No actor present at the start of command processing.'
      );
      await handleProcessingException(
        this._state,
        turnCtx,
        noActorError,
        'NoActorOnEnter'
      );
      return null;
    }

    const actorId = actor.id;
    logger.debug(
      `${this._state.getStateName()}: Entered for actor ${actorId}.`
    );
    logger.debug(
      `${this._state.getStateName()}: Entering with command: "${this._commandString}" for actor: ${actorId}`
    );
    return actor;
  }

  /**
   * Resolves the ITurnAction to process.
   *
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context.
   * @param {import('../../entities/entity.js').default} actor - Actor.
   * @returns {Promise<import('../interfaces/IActorTurnStrategy.js').ITurnAction|null>} Resolved action or null.
   */
  async _resolveTurnAction(turnCtx, actor) {
    const logger = this._state._resolveLogger(turnCtx);
    let turnAction = this._turnAction;
    const actorId = actor.id;
    if (!turnAction) {
      logger.debug(
        `${this._state.getStateName()}: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actorId}.`
      );
      try {
        turnAction = turnCtx.getChosenAction();
      } catch (e) {
        const errorMsg = `${this._state.getStateName()}: Error retrieving ITurnAction from context for actor ${actorId}: ${e.message}`;
        logger.error(errorMsg, e);
        await handleProcessingException(
          this._state,
          turnCtx,
          new Error(errorMsg, { cause: e }),
          actorId
        );
        return null;
      }
    }

    if (!turnAction) {
      const errorMsg = `${this._state.getStateName()}: No ITurnAction available for actor ${actorId}. Cannot process command.`;
      logger.error(errorMsg);
      await handleProcessingException(
        this._state,
        turnCtx,
        new Error(errorMsg),
        actorId
      );
      return null;
    }

    if (
      typeof turnAction.actionDefinitionId !== 'string' ||
      !turnAction.actionDefinitionId
    ) {
      const errorMsg = `${this._state.getStateName()}: ITurnAction for actor ${actorId} is invalid: missing or empty actionDefinitionId.`;
      logger.error(errorMsg, { receivedAction: turnAction });
      await handleProcessingException(
        this._state,
        turnCtx,
        new Error(errorMsg),
        actorId
      );
      return null;
    }

    const commandStringToLog =
      turnAction.commandString ||
      this._commandString ||
      '(no command string available)';
    logger.debug(
      `${this._state.getStateName()}: Actor ${actorId} processing action. ` +
        `ID: "${turnAction.actionDefinitionId}". ` +
        `Params: ${JSON.stringify(turnAction.resolvedParameters || {})}. ` +
        `CommandString: "${commandStringToLog}".`
    );

    this._turnAction = turnAction;
    this._setAction(turnAction);
    return turnAction;
  }

  /**
   * Processes the resolved action via the state's internal method.
   *
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context.
   * @param {import('../../entities/entity.js').default} actor - Actor.
   * @param {import('../interfaces/IActorTurnStrategy.js').ITurnAction} turnAction - Action to process.
   * @returns {Promise<void>} Resolves when processing completes.
   */
  async _executeActionWorkflow(turnCtx, actor, turnAction) {
    try {
      await this._state._processCommandInternal(turnCtx, actor, turnAction);
    } catch (error) {
      const currentTurnCtxForCatch = this._state._getTurnContext() ?? turnCtx;
      const errorLogger =
        currentTurnCtxForCatch?.getLogger?.() ??
        this._state._resolveLogger(turnCtx);
      errorLogger.error(
        `${this._state.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`,
        error
      );
      const actorIdForHandler =
        currentTurnCtxForCatch?.getActor?.()?.id ?? actor.id;
      await handleProcessingException(
        this._state,
        currentTurnCtxForCatch || turnCtx,
        error,
        actorIdForHandler
      );
    }
  }
}

export default ProcessingWorkflow;
