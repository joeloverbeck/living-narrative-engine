/**
 * @file processingWorkflow.js
 * @description Workflow logic for ProcessingCommandState.enterState and related helpers.
 */

import { AbstractTurnState } from '../abstractTurnState.js';
import { ProcessingExceptionHandler } from '../helpers/processingExceptionHandler.js';
import { getLogger } from '../helpers/contextUtils.js';

/**
 * @class ProcessingWorkflow
 * @description Executes the main processing workflow for a ProcessingCommandState instance.
 */
export class ProcessingWorkflow {
  /**
   * @param {object} state - Owning state instance (ProcessingCommandState, but type avoided to break circular dependency).
   * @param {string|null} commandString - Command string for logging.
   * @param {import('../../interfaces/IActorTurnStrategy.js').ITurnAction|null} initialAction - Constructor provided action.
   * @param {(action: import('../../interfaces/IActorTurnStrategy.js').ITurnAction|null) => void} setAction - Setter for the state's private action field.
   * @param {ProcessingExceptionHandler} [exceptionHandler] - Optional handler to manage processing errors.
   */
  constructor(
    state,
    commandString,
    initialAction,
    setAction,
    exceptionHandler = undefined
  ) {
    this._state = state;
    this._commandString = commandString;
    this._turnAction = initialAction;
    this._setAction = setAction;
    this._exceptionHandler =
      exceptionHandler || new ProcessingExceptionHandler(state);
  }

  /**
   * @description Acquire context and prepare the state for processing.
   * @param {import('../../interfaces/ITurnStateHost.js').ITurnStateHost} handler - Owning handler.
   * @param {import('../../interfaces/ITurnState.js').ITurnState|null} previousState - Previous state.
   * @returns {Promise<import('../../interfaces/ITurnContext.js').ITurnContext|null>} Context or null on failure.
   */
  async _acquireContext(handler, previousState) {
    const turnCtx = await this._state._ensureContext(
      `critical-no-context-${this._state.getStateName()}`
    );
    if (!turnCtx) return null;

    if (this._state.isProcessing) {
      const logger = getLogger(turnCtx, this._state._handler);
      logger.warn(
        `${this._state.getStateName()}: enterState called while already processing. Actor: ${turnCtx?.getActor()?.id ?? 'N/A'}. Aborting re-entry.`
      );
      return null;
    }

    this._state.startProcessing();

    await AbstractTurnState.prototype.enterState.call(
      this._state,
      handler,
      previousState
    );

    return turnCtx;
  }

  /**
   * Runs the workflow.
   *
   * @param {import('../../interfaces/ITurnStateHost.js').ITurnStateHost} handler - Owning handler.
   * @param {import('../../interfaces/ITurnState.js').ITurnState|null} previousState - Previous state.
   * @returns {Promise<void>} Resolves when complete.
   */
  async run(handler, previousState) {
    const turnCtx = await this._acquireContext(handler, previousState);
    if (!turnCtx) return;

    const actor = await this._validateActor(turnCtx);
    if (!actor) return;

    const turnAction = await this._obtainTurnAction(turnCtx, actor);
    if (!turnAction) return;

    await this._dispatchSpeechIfNeeded(turnCtx, actor);

    await this._executeAction(turnCtx, actor, turnAction);
  }

  /**
   * Validates the actor from the context and logs entry.
   *
   * @param {import('../../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context.
   * @returns {Promise<import('../../../entities/entity.js').default|null>} Resolved actor or null.
   */
  async _validateActor(turnCtx) {
    const logger = getLogger(turnCtx, this._state._handler);
    const actor = turnCtx.getActor();
    if (!actor) {
      const noActorError = new Error(
        'No actor present at the start of command processing.'
      );
      await this._exceptionHandler.handle(
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
   * @description Retrieves the ITurnAction from the current context.
   * @private
   * @param {import('../../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context containing the action.
   * @returns {Promise<import('../../interfaces/IActorTurnStrategy.js').ITurnAction|null>} Resolved action or null.
   */
  async _fetchActionFromContext(turnCtx) {
    const logger = getLogger(turnCtx, this._state._handler);
    const actorId = turnCtx.getActor()?.id ?? 'N/A';
    logger.debug(
      `${this._state.getStateName()}: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actorId}.`
    );
    try {
      return turnCtx.getChosenAction();
    } catch (e) {
      const errorMsg = `${this._state.getStateName()}: Error retrieving ITurnAction from context for actor ${actorId}: ${e.message}`;
      logger.error(errorMsg, e);
      await this._exceptionHandler.handle(
        turnCtx,
        new Error(errorMsg, { cause: e }),
        actorId
      );
      return null;
    }
  }

  /**
   * @description Validates a resolved ITurnAction.
   * @private
   * @param {import('../../interfaces/IActorTurnStrategy.js').ITurnAction|null} turnAction - Action to validate.
   * @param {string} actorId - Actor identifier for logging.
   * @returns {Promise<boolean>} True if valid, otherwise false.
   */
  async _validateResolvedAction(turnAction, actorId) {
    const turnCtx = this._state._getTurnContext();
    const logger = getLogger(turnCtx, this._state._handler);

    if (!turnAction) {
      const errorMsg = `${this._state.getStateName()}: No ITurnAction available for actor ${actorId}. Cannot process command.`;
      logger.error(errorMsg);
      await this._exceptionHandler.handle(
        turnCtx,
        new Error(errorMsg),
        actorId
      );
      return false;
    }

    if (
      typeof turnAction.actionDefinitionId !== 'string' ||
      !turnAction.actionDefinitionId
    ) {
      const errorMsg = `${this._state.getStateName()}: ITurnAction for actor ${actorId} is invalid: missing or empty actionDefinitionId.`;
      logger.error(errorMsg, { receivedAction: turnAction });
      await this._exceptionHandler.handle(
        turnCtx,
        new Error(errorMsg),
        actorId
      );
      return false;
    }

    return true;
  }

  /**
   * @description Logs details about the action being processed.
   * @private
   * @param {import('../../interfaces/IActorTurnStrategy.js').ITurnAction} turnAction - The action to log.
   * @param {string} actorId - Actor identifier for logging.
   * @returns {void}
   */
  _logActionDetails(turnAction, actorId) {
    const turnCtx = this._state._getTurnContext();
    const logger = getLogger(turnCtx, this._state._handler);
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
  }

  /**
   * Resolves the ITurnAction to process.
   *
   * @param {import('../../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context.
   * @param {import('../../../entities/entity.js').default} actor - Actor.
   * @returns {Promise<import('../../interfaces/IActorTurnStrategy.js').ITurnAction|null>} Resolved action or null.
   */
  async _obtainTurnAction(turnCtx, actor) {
    let turnAction = this._turnAction;
    const actorId = actor.id;

    if (!turnAction) {
      turnAction = await this._fetchActionFromContext(turnCtx);
    }

    if (!(await this._validateResolvedAction(turnAction, actorId))) {
      return null;
    }

    this._logActionDetails(turnAction, actorId);

    this._turnAction = turnAction;
    this._setAction(turnAction);
    return turnAction;
  }

  /**
   * @description Dispatch speech event if present in metadata.
   * @param {import('../../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context.
   * @param {import('../../../entities/entity.js').default} actor - Actor.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async _dispatchSpeechIfNeeded(turnCtx, actor) {
    const decisionMeta = turnCtx.getDecisionMeta?.() ?? {};
    await this._state._dispatchSpeech(turnCtx, actor, decisionMeta);
  }

  /**
   * Processes the resolved action via the state's internal method.
   *
   * @param {import('../../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context.
   * @param {import('../../../entities/entity.js').default} actor - Actor.
   * @param {import('../../interfaces/IActorTurnStrategy.js').ITurnAction} turnAction - Action to process.
   * @returns {Promise<void>} Resolves when processing completes.
   */
  async _executeAction(turnCtx, actor, turnAction) {
    if (
      !(await this._validateExecutionPreconditions(turnCtx, actor, turnAction))
    ) {
      return;
    }

    try {
      await this._state._processCommandInternal(
        turnCtx,
        actor,
        turnAction,
        this._exceptionHandler
      );
    } catch (error) {
      await this._handleProcessError(turnCtx, actor, error);
    }
  }

  /**
   * @description Validates the required parameters for executing an action.
   * @private
   * @param {import('../../interfaces/ITurnContext.js').ITurnContext|null} turnCtx - Context.
   * @param {import('../../../entities/entity.js').default|null} actor - Actor.
   * @param {import('../../interfaces/IActorTurnStrategy.js').ITurnAction|null} turnAction - Action to process.
   * @returns {Promise<boolean>} True if all parameters are valid, otherwise false.
   */
  async _validateExecutionPreconditions(turnCtx, actor, turnAction) {
    const logger = getLogger(turnCtx, this._state._handler);

    if (!turnCtx) {
      logger.error(`${this._state.getStateName()}: Invalid turn context.`);
      await this._exceptionHandler.handle(
        turnCtx,
        new Error('Invalid context'),
        actor?.id ?? 'N/A'
      );
      return false;
    }

    if (!actor) {
      logger.error(`${this._state.getStateName()}: Invalid actor.`);
      await this._exceptionHandler.handle(
        turnCtx,
        new Error('Invalid actor'),
        turnCtx.getActor?.()?.id ?? 'N/A'
      );
      return false;
    }

    if (!turnAction) {
      logger.error(`${this._state.getStateName()}: Invalid turnAction.`);
      await this._exceptionHandler.handle(
        turnCtx,
        new Error('Invalid action'),
        actor.id
      );
      return false;
    }

    return true;
  }

  /**
   * @description Handles errors that occur during internal command processing.
   * @private
   * @param {import('../../interfaces/ITurnContext.js').ITurnContext} turnCtx - Context in use when the error occurred.
   * @param {import('../../../entities/entity.js').default} actor - Actor executing the command.
   * @param {Error} error - Error thrown by internal processing.
   * @returns {Promise<void>} Resolves when handling completes.
   */
  async _handleProcessError(turnCtx, actor, error) {
    const currentTurnCtxForCatch = this._state._getTurnContext() ?? turnCtx;
    const errorLogger =
      currentTurnCtxForCatch?.getLogger?.() ??
      getLogger(turnCtx, this._state._handler);
    errorLogger.error(
      `${this._state.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`,
      error
    );
    const actorIdForHandler =
      currentTurnCtxForCatch?.getActor?.()?.id ?? actor.id;
    await this._exceptionHandler.handle(
      currentTurnCtxForCatch || turnCtx,
      error,
      actorIdForHandler
    );
  }
}

export default ProcessingWorkflow;
