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
 * @typedef {import('../interfaces/turnStateContextTypes.js').ProcessingCommandStateContext} ProcessingCommandStateContext
 */

import { AbstractTurnState } from './abstractTurnState.js';
import { ENTITY_SPOKE_ID } from '../../constants/eventIds.js';
import { processCommandInternal } from './helpers/processCommandInternal.js';
import { getServiceFromContext } from './helpers/getServiceFromContext.js';
import { ProcessingWorkflow } from './workflows/processingWorkflow.js';
import { buildSpeechPayload } from './helpers/buildSpeechPayload.js';
import { ProcessingGuard } from './helpers/processingGuard.js';
import { finishProcessing } from './helpers/processingErrorUtils.js';
import { getLogger } from './helpers/contextUtils.js';

/**
 * @class ProcessingCommandState
 * @augments {AbstractTurnState}
 */
export class ProcessingCommandState extends AbstractTurnState {
  _isProcessing = false;
  _processingGuard;
  #turnActionToProcess = null;
  #commandStringForLog = null;

  /**
   * @override
   * @param {string} reason - Explanation for context validation failure.
   * @returns {Promise<ProcessingCommandStateContext|null>} The current context
   *   cast to ProcessingCommandStateContext or null on failure.
   */
  async _ensureContext(reason) {
    const ctx = await super._ensureContext(reason);
    if (!ctx) return null;
    const required = [
      'getActor',
      'getLogger',
      'getChosenAction',
      'getSafeEventDispatcher',
    ];
    const missing = required.filter((m) => typeof ctx[m] !== 'function');
    if (missing.length) {
      getLogger(ctx, this._handler).error(
        `${this.getStateName()}: ITurnContext missing required methods: ${missing.join(', ')}`
      );
      await this._resetToIdle(`missing-methods-${this.getStateName()}`);
      return null;
    }
    return /** @type {ProcessingCommandStateContext} */ (ctx);
  }

  /**
   * Creates an instance of ProcessingCommandState.
   *
   * @param {BaseTurnHandler} handler - The turn handler managing this state.
   * @param {string} [commandString]
   * @param {ITurnAction} [turnAction]
   */
  constructor(handler, commandString, turnAction = null) {
    super(handler);
    this._processingGuard = new ProcessingGuard(this);
    finishProcessing(this);
    this.#turnActionToProcess = turnAction;
    this.#commandStringForLog =
      commandString || turnAction?.commandString || null;

    const logger = getLogger(null, this._handler);
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
    const workflow = new ProcessingWorkflow(
      this,
      this.#commandStringForLog,
      this.#turnActionToProcess,
      (a) => {
        this.#turnActionToProcess = a;
      }
    );
    await workflow.run(handler, previousState);
  }

  /**
   * @description Dispatches ENTITY_SPOKE_ID if decision metadata contains speech.
   * @param {ITurnContext} turnCtx - Current turn context.
   * @param {Entity} actor - Actor speaking.
   * @param {object} decisionMeta - Metadata from the actor decision.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async _dispatchSpeech(turnCtx, actor, decisionMeta) {
    const logger = getLogger(turnCtx, this._handler);
    const actorId = actor.id;
    const payloadBase = buildSpeechPayload(decisionMeta);
    const speechRaw = decisionMeta?.speech;

    if (payloadBase) {
      logger.debug(
        `${this.getStateName()}: Actor ${actorId} spoke: "${payloadBase.speechContent}". Dispatching ${ENTITY_SPOKE_ID}.`
      );

      try {
        const eventDispatcher = turnCtx.getSafeEventDispatcher?.();
        if (eventDispatcher) {
          const payload = { entityId: actorId, ...payloadBase };
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
  // _executeActionWorkflow logic moved to ProcessingWorkflow

  async _processCommandInternal(turnCtx, actor, turnAction) {
    return processCommandInternal(this, turnCtx, actor, turnAction);
  }

  async _getServiceFromContext(
    turnCtx,
    contextMethod,
    serviceLabel,
    actorIdForLog
  ) {
    return getServiceFromContext(
      this,
      turnCtx,
      contextMethod,
      serviceLabel,
      actorIdForLog
    );
  }

  async exitState(handler, nextState) {
    const wasProcessing = this._isProcessing;
    // Ensure processing flag is false on exit, regardless of how exit was triggered.
    finishProcessing(this);

    const turnCtx = this._getTurnContext();
    const logger = getLogger(turnCtx, handler);
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
    const logger = getLogger(turnCtx, handler);
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
    finishProcessing(this); // Ensure flag is cleared.

    await super.destroy(handler); // Call super.destroy which handles its own logging.
    logger.debug(
      `${this.getStateName()}: Destroy handling for actor ${actorId} complete.`
    );
  }
}
