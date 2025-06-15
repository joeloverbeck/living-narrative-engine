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
    const turnCtx = this._getTurnContext();

    if (this._isProcessing) {
      const logger = this._resolveLogger(turnCtx);
      logger.warn(
        `${this.getStateName()}: enterState called while already processing. Actor: ${turnCtx?.getActor()?.id ?? 'N/A'}. Aborting re-entry.`
      );
      return;
    }
    this._isProcessing = true;

    await super.enterState(this._handler, previousState);
    const logger = this._resolveLogger(turnCtx);

    if (!turnCtx) {
      logger.error(
        `${this.getStateName()}: Turn context is null on enter. Attempting to reset and idle.`
      );
      await this._resetToIdle(`critical-no-context-${this.getStateName()}`);
      this._isProcessing = false;
      return;
    }

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
      return;
    }

    const actorId = actor.id;
    logger.debug(`${this.getStateName()}: Entered for actor ${actorId}.`);
    logger.debug(
      `${this.getStateName()}: Entering with command: "${this.#commandStringForLog}" for actor: ${actorId}`
    );

    let turnAction = this.#turnActionToProcess;
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
        return;
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
      return;
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
      return;
    }

    const commandStringToLog =
      turnAction.commandString ||
      this.#commandStringForLog ||
      '(no command string available)';
    // Logging `turnAction.resolvedParameters` here which is no longer expected from LLMResponseProcessor output.
    // This log will show `Params: {}` if turnAction.resolvedParameters is undefined.
    // The actual speech is in `turnAction.speech`.
    logger.debug(
      `${this.getStateName()}: Actor ${actorId} processing action. ` +
        `ID: "${turnAction.actionDefinitionId}". ` +
        `Params: ${JSON.stringify(turnAction.resolvedParameters || {})}. ` + // This line shows resolvedParameters which should be undefined
        `CommandString: "${commandStringToLog}".`
    );

    this.#turnActionToProcess = turnAction;

    // --- MODIFIED SECTION ---
    // Get all relevant data from the persisted decision metadata.
    const decisionMeta = turnCtx.getDecisionMeta() ?? {};
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
        /** @type {ISafeEventDispatcher | undefined} */
        const eventDispatcher = turnCtx.getSafeEventDispatcher();
        if (eventDispatcher) {
          // Construct the base payload
          const payload = {
            entityId: actorId,
            speechContent: speech,
          };

          // Conditionally add thoughts if it is a valid string
          if (typeof thoughtsRaw === 'string' && thoughtsRaw.trim()) {
            payload.thoughts = thoughtsRaw.trim();
          }

          // Normalize notes which may be an array from the LLM output
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
      // This covers cases where speechRaw was a non-string or an empty/whitespace string.
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} had a non-string or empty speech field in decisionMeta. No ${ENTITY_SPOKE_ID} event dispatched. (Type: ${typeof speechRaw}, Value: "${String(speechRaw)}")`
      );
    } else {
      // This covers speechRaw being null or undefined (i.e., not present in meta).
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} has no 'speech' field in decisionMeta. No ${ENTITY_SPOKE_ID} event dispatched.`
      );
    }
    // --- END MODIFIED SECTION ---

    await (async () => {
      try {
        await this._processCommandInternal(
          turnCtx,
          actor,
          this.#turnActionToProcess
        );
      } catch (error) {
        const currentTurnCtxForCatch = this._getTurnContext() ?? turnCtx;
        const errorLogger = currentTurnCtxForCatch?.getLogger?.() ?? logger;
        errorLogger.error(
          `${this.getStateName()}: Uncaught error from _processCommandInternal scope. Error: ${error.message}`,
          error
        );
        const actorIdForHandler =
          currentTurnCtxForCatch?.getActor?.()?.id ?? actorId;
        await this.#handleProcessingException(
          currentTurnCtxForCatch || turnCtx,
          error,
          actorIdForHandler
        );
      }
    })();
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
