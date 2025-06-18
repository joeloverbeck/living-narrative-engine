// src/turns/states/processingCommandState.js
/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('../../types/commandResult.js').CommandResult} CommandResult
 * @typedef {import('../constants/turnDirectives.js').default} TurnDirectiveEnum
 * @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState_Interface
 * @typedef {import('../interfaces/ITurnDirectiveStrategy.js').ITurnDirectiveStrategy} ITurnDirectiveStrategy
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher // For type hint
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ENTITY_SPOKE_ID } from '../../constants/eventIds.js';
import { processCommandInternal } from './helpers/processCommandInternal.js';
import { getServiceFromContext } from './helpers/getServiceFromContext.js';
import { handleProcessingException } from './helpers/handleProcessingException.js';

/**
 * @class ProcessingCommandState
 * @augments {AbstractTurnState}
 */
export class ProcessingCommandState extends AbstractTurnState {
  _isProcessing = false;
  #turnActionToProcess = null;
  #commandStringForLog = null;

  /**
   * Creates an instance of ProcessingCommandState.
   *
   * @param {BaseTurnHandler} handler - The turn handler managing this state.
   * @param {string} [commandString]
   * @param {ITurnAction} [turnAction]
   */
  constructor(handler, commandString, turnAction = null) {
    super(handler);
    this._isProcessing = false;
    this.#turnActionToProcess = turnAction;
    this.#commandStringForLog =
      commandString || turnAction?.commandString || null;

    const logger = this._resolveLogger(null);
    logger.debug(
      `${this.getStateName()} constructed. Command string (arg): "${this.#commandStringForLog}". TurnAction ID (arg): ${turnAction ? `"${turnAction.actionDefinitionId}"` : 'null'}`
    );
  }

  /**
   * @override
   * @param {BaseTurnHandler} handler
   * @param {ITurnState_Interface} [previousState]
   */
  async enterState(handler, previousState) {
    const turnCtx = await this._ensureContext(
      `critical-no-context-${this.getStateName()}`,
      handler
    );

    if (!turnCtx) return;

    if (this._isProcessing) {
      const logger = this._resolveLogger(turnCtx);
      logger.warn(
        `${this.getStateName()}: enterState called while already processing. Actor: ${turnCtx?.getActor()?.id ?? 'N/A'}. Aborting re-entry.`
      );
      return;
    }
    this._isProcessing = true;

    await super.enterState(this._handler, previousState);

    const actor = await this._validateContextAndActor(turnCtx);
    if (!actor) return;

    const turnAction = await this._resolveTurnAction(turnCtx, actor);
    if (!turnAction) return;

    const decisionMeta = turnCtx.getDecisionMeta() ?? {};
    await this._dispatchSpeech(turnCtx, actor, decisionMeta);

    await this._processAction(turnCtx, actor, turnAction);
  }

  /**
   * @description Validates the actor retrieved from the turn context and logs entry.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @returns {Promise<Entity|null>} The actor entity or `null` if validation fails.
   */
  async _validateContextAndActor(turnCtx) {
    const logger = this._resolveLogger(turnCtx);
    const actor = turnCtx.getActor();
    if (!actor) {
      const noActorError = new Error(
        'No actor present at the start of command processing.'
      );
      await this.#handleProcessingException(
        turnCtx,
        noActorError,
        'NoActorOnEnter'
      );
      return null;
    }

    const actorId = actor.id;
    logger.debug(`${this.getStateName()}: Entered for actor ${actorId}.`);
    logger.debug(
      `${this.getStateName()}: Entering with command: "${this.#commandStringForLog}" for actor: ${actorId}`
    );
    return actor;
  }

  /**
   * @description Resolves the ITurnAction to process from constructor or context.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor performing the action.
   * @returns {Promise<ITurnAction|null>} The resolved ITurnAction or `null` on failure.
   */
  async _resolveTurnAction(turnCtx, actor) {
    const logger = this._resolveLogger(turnCtx);
    let turnAction = this.#turnActionToProcess;
    const actorId = actor.id;
    if (!turnAction) {
      logger.debug(
        `${this.getStateName()}: No turnAction passed via constructor. Retrieving from turnContext.getChosenAction() for actor ${actorId}.`
      );
      try {
        turnAction = turnCtx.getChosenAction();
      } catch (e) {
        const errorMsg = `${this.getStateName()}: Error retrieving ITurnAction from context for actor ${actorId}: ${e.message}`;
        logger.error(errorMsg, e);
        await this.#handleProcessingException(
          turnCtx,
          new Error(errorMsg, { cause: e }),
          actorId
        );
        return null;
      }
    }

    if (!turnAction) {
      const errorMsg = `${this.getStateName()}: No ITurnAction available for actor ${actorId}. Cannot process command.`;
      logger.error(errorMsg);
      await this.#handleProcessingException(
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
      const errorMsg = `${this.getStateName()}: ITurnAction for actor ${actorId} is invalid: missing or empty actionDefinitionId.`;
      logger.error(errorMsg, { receivedAction: turnAction });
      await this.#handleProcessingException(
        turnCtx,
        new Error(errorMsg),
        actorId
      );
      return null;
    }

    const commandStringToLog =
      turnAction.commandString ||
      this.#commandStringForLog ||
      '(no command string available)';
    logger.debug(
      `${this.getStateName()}: Actor ${actorId} processing action. ` +
        `ID: "${turnAction.actionDefinitionId}". ` +
        `Params: ${JSON.stringify(turnAction.resolvedParameters || {})}. ` +
        `CommandString: "${commandStringToLog}".`
    );

    this.#turnActionToProcess = turnAction;
    return turnAction;
  }

  /**
   * @description Dispatches ENTITY_SPOKE_ID if decision metadata contains speech.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor speaking.
   * @param {object} decisionMeta - Metadata from the actor decision.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async _dispatchSpeech(turnCtx, actor, decisionMeta) {
    const logger = this._resolveLogger(turnCtx);
    const actorId = actor.id;
    const {
      speech: speechRaw,
      thoughts: thoughtsRaw,
      notes: notesRaw,
    } = decisionMeta;
    const speech =
      typeof speechRaw === 'string' && speechRaw.trim()
        ? speechRaw.trim()
        : null;

    if (speech) {
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} spoke: "${speech}". Dispatching ${ENTITY_SPOKE_ID}.`
      );

      try {
        const eventDispatcher = turnCtx.getSafeEventDispatcher?.();
        if (eventDispatcher) {
          const payload = { entityId: actorId, speechContent: speech };
          if (typeof thoughtsRaw === 'string' && thoughtsRaw.trim()) {
            payload.thoughts = thoughtsRaw.trim();
          }
          if (Array.isArray(notesRaw)) {
            const joined = notesRaw
              .map((n) => (typeof n === 'string' ? n.trim() : ''))
              .filter(Boolean)
              .join('\n');
            if (joined) {
              payload.notes = joined;
            }
          } else if (typeof notesRaw === 'string' && notesRaw.trim()) {
            payload.notes = notesRaw.trim();
          }

          await eventDispatcher.dispatch(ENTITY_SPOKE_ID, payload);
          logger.debug(
            `${this.getStateName()}: Attempted dispatch of ${ENTITY_SPOKE_ID} for actor ${actorId} via TurnContext's SafeEventDispatcher.`,
            { payload }
          );
        } else {
          logger.warn(
            `${this.getStateName()}: Could not get SafeEventDispatcher from TurnContext. ${ENTITY_SPOKE_ID} event not dispatched for actor ${actorId}.`
          );
        }
      } catch (eventDispatchError) {
        logger.error(
          `${this.getStateName()}: Unexpected error when trying to use dispatch for ${ENTITY_SPOKE_ID} for actor ${actorId}: ${eventDispatchError.message}`,
          eventDispatchError
        );
      }
    } else if (speechRaw !== null && speechRaw !== undefined) {
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} had a non-string or empty speech field in decisionMeta. No ${ENTITY_SPOKE_ID} event dispatched. (Type: ${typeof speechRaw}, Value: "${String(speechRaw)}")`
      );
    } else {
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} has no 'speech' field in decisionMeta. No ${ENTITY_SPOKE_ID} event dispatched.`
      );
    }
  }

  /**
   * @description Processes the resolved action and handles errors from the internal workflow.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor performing the action.
   * @param {ITurnAction} turnAction - Action to process.
   * @returns {Promise<void>} Resolves when processing completes.
   */
  async _processAction(turnCtx, actor, turnAction) {
    try {
      await this._processCommandInternal(turnCtx, actor, turnAction);
    } catch (error) {
      const currentTurnCtxForCatch = this._getTurnContext() ?? turnCtx;
      const errorLogger =
        currentTurnCtxForCatch?.getLogger?.() ?? this._resolveLogger(turnCtx);
      errorLogger.error(
        `${this.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`,
        error
      );
      const actorIdForHandler =
        currentTurnCtxForCatch?.getActor?.()?.id ?? actor.id;
      await this.#handleProcessingException(
        currentTurnCtxForCatch || turnCtx,
        error,
        actorIdForHandler
      );
    }
  }

  async _processCommandInternal(turnCtx, actor, turnAction) {
    return processCommandInternal(this, turnCtx, actor, turnAction);
  }

  async _getServiceFromContext(
    turnCtx,
    methodName,
    serviceNameForLog,
    actorIdForLog
  ) {
    return getServiceFromContext(
      this,
      turnCtx,
      methodName,
      serviceNameForLog,
      actorIdForLog
    );
  }

  async #handleProcessingException(
    turnCtx,
    error,
    actorIdContext = 'UnknownActor',
    shouldEndTurn = true
  ) {
    return handleProcessingException(
      this,
      turnCtx,
      error,
      actorIdContext,
      shouldEndTurn
    );
  }

  async exitState(handler, nextState) {
    const wasProcessing = this._isProcessing;
    // Ensure processing flag is false on exit, regardless of how exit was triggered.
    this._isProcessing = false;

    const turnCtx = this._getTurnContext();
    const logger = this._resolveLogger(turnCtx, handler);
    const actorId = turnCtx?.getActor?.()?.id ?? 'N/A_on_exit';

    if (wasProcessing) {
      logger.debug(
        `${this.getStateName()}: Exiting for actor ${actorId} while _isProcessing was true (now false). Transitioning to ${nextState?.getStateName() ?? 'None'}.`
      );
    } else {
      logger.debug(
        `${this.getStateName()}: Exiting for actor: ${actorId}. Transitioning to ${nextState?.getStateName() ?? 'None'}.`
      );
    }
    await super.exitState(handler, nextState);
  }

  async destroy(handler) {
    const turnCtx = this._getTurnContext(); // Get context before calling super, as super.destroy might clear it.
    const logger = this._resolveLogger(turnCtx, handler);
    const actorId = turnCtx?.getActor?.()?.id ?? 'N/A_at_destroy';

    logger.debug(
      `${this.getStateName()}: Destroying for actor: ${actorId}. Current _isProcessing: ${this._isProcessing}`
    );

    if (this._isProcessing) {
      // This indicates an abnormal termination, like the handler itself being destroyed.
      logger.warn(
        `${this.getStateName()}: Destroyed during active processing for actor ${actorId}.`
      );
    }
    this._isProcessing = false; // Ensure flag is cleared.

    await super.destroy(handler); // Call super.destroy which handles its own logging.
    logger.debug(
      `${this.getStateName()}: Destroy handling for actor ${actorId} complete.`
    );
  }
}
