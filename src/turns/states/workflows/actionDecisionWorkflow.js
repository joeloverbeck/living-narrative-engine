/**
 * @file actionDecisionWorkflow.js
 * @description Workflow logic for AwaitingActorDecisionState handling action decisions.
 */

import { LLMDecisionProvider } from '../../providers/llmDecisionProvider.js';
import { getSafeEventDispatcher } from '../helpers/contextUtils.js';
import { LLM_SUGGESTED_ACTION_ID } from '../../../constants/eventIds.js';

/**
 * @class ActionDecisionWorkflow
 * @description Executes the action decision workflow for an AwaitingActorDecisionState instance.
 */
export class ActionDecisionWorkflow {
  /**
   * Constructs an instance of ActionDecisionWorkflow.
   *
   * @param {object} state - Owning AwaitingActorDecisionState instance.
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
      const {
        action: initialAction,
        extractedData: initialExtractedData,
        availableActions,
        suggestedIndex,
      } = await this._state._decideAction(
        this._strategy,
        this._turnContext,
        this._actor
      );

      let action = initialAction;
      let extractedData = initialExtractedData;

      if (this._isLLMStrategy()) {
        const pendingResult = await this._handleLLMPendingApproval({
          action,
          extractedData,
          availableActions,
          suggestedIndex,
        });

        if (!pendingResult) return;

        action = pendingResult.action;
        extractedData = pendingResult.extractedData;
      }

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

      const commandToExecute =
        action.commandString && action.commandString.trim().length > 0
          ? action.commandString
          : action.actionDefinitionId;

      logger.debug(
        `${this._state.getStateName()}: Requesting transition to ProcessingCommandState for actor ${this._actor.id}.`
      );
      await this._turnContext.requestProcessingCommandStateTransition(
        commandToExecute,
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

  _isLLMStrategy() {
    return this._strategy?.decisionProvider instanceof LLMDecisionProvider;
  }

  _clampIndex(value, actionsLength) {
    if (!Number.isInteger(value) || actionsLength < 1) {
      return { value: actionsLength > 0 ? 1 : null, adjusted: true };
    }

    const clamped = Math.min(Math.max(value, 1), actionsLength);
    return { value: clamped, adjusted: clamped !== value };
  }

  _setPendingFlag(isPending) {
    if (typeof this._turnContext.setAwaitingExternalEvent !== 'function') {
      return;
    }

    try {
      this._turnContext.setAwaitingExternalEvent(isPending, this._actor.id);
    } catch (err) {
      this._turnContext
        .getLogger()
        .warn(
          `${this._state.getStateName()}: Failed to set pending flag – ${err.message}`
        );
    }
  }

  async _emitSuggestedActionEvent(clampedIndex, descriptor, extractedData) {
    const dispatcher = getSafeEventDispatcher(this._turnContext, this._state._handler);
    if (!dispatcher) return;

    const payload = {
      actorId: this._actor.id,
      suggestedIndex: clampedIndex,
      suggestedActionDescriptor: this._describeActionDescriptor(descriptor),
      speech: extractedData?.speech ?? null,
      thoughts: extractedData?.thoughts ?? null,
      notes: extractedData?.notes ?? null,
    };

    await dispatcher.dispatch(LLM_SUGGESTED_ACTION_ID, payload);
  }

  _describeActionDescriptor(descriptor) {
    if (!descriptor) return null;

    return (
      descriptor.description ??
      descriptor.actionId ??
      descriptor.commandString ??
      descriptor.actionDefinitionId ??
      null
    );
  }

  _findCompositeForIndex(index, actions) {
    if (!Array.isArray(actions) || actions.length === 0) return null;
    return (
      actions.find((candidate) => candidate?.index === index) || actions[index - 1] || null
    );
  }

  _buildActionForIndex(index, actions, speech, fallbackAction) {
    const composite = this._findCompositeForIndex(index, actions);
    if (composite && this._strategy?.turnActionFactory?.create) {
      return this._strategy.turnActionFactory.create(composite, speech ?? null);
    }
    return fallbackAction;
  }

  async _awaitHumanSubmission(actions, fallbackIndex, suggestedDescriptor) {
    const promptService = this._turnContext.getPlayerPromptService?.();
    if (promptService && Array.isArray(actions) && actions.length > 0) {
      const suggestedAction =
        Number.isInteger(fallbackIndex) && fallbackIndex > 0
          ? {
              index: fallbackIndex,
              descriptor: this._describeActionDescriptor(suggestedDescriptor),
            }
          : null;

      return promptService.prompt(this._actor, {
        indexedComposites: actions,
        cancellationSignal: this._turnContext.getPromptSignal(),
        ...(suggestedAction ? { suggestedAction } : {}),
      });
    }

    return {
      chosenIndex: fallbackIndex,
      speech: null,
      thoughts: null,
      notes: null,
    };
  }

  async _handleLLMPendingApproval({
    action,
    extractedData,
    availableActions,
    suggestedIndex,
  }) {
    const logger = this._turnContext.getLogger();
    const actions = Array.isArray(availableActions) ? availableActions : [];
    const baseMeta = extractedData || {};
    const { value: clampedIndex } = this._clampIndex(
      suggestedIndex ?? baseMeta.chosenIndex ?? null,
      actions.length
    );

    if (!actions.length) {
      logger.warn(
        `${this._state.getStateName()}: No indexed actions available for pending approval; proceeding with suggested action.`
      );
    }

    this._setPendingFlag(true);

    try {
      const descriptor = this._findCompositeForIndex(clampedIndex, actions) || action;
      await this._emitSuggestedActionEvent(clampedIndex, descriptor, baseMeta);

      const submission = await this._awaitHumanSubmission(
        actions,
        clampedIndex,
        descriptor
      );
      const { value: submittedIndex } = this._clampIndex(
        submission?.chosenIndex,
        actions.length
      );

      const finalIndex = submittedIndex ?? clampedIndex;

      const mergedMeta = {
        speech: submission?.speech ?? baseMeta.speech ?? null,
        thoughts: submission?.thoughts ?? baseMeta.thoughts ?? null,
        notes: submission?.notes ?? baseMeta.notes ?? null,
        suggestedIndex: clampedIndex,
        submittedIndex: finalIndex,
      };

      const finalAction = this._buildActionForIndex(
        finalIndex,
        actions,
        mergedMeta.speech,
        action
      );

      return { action: finalAction, extractedData: mergedMeta };
    } finally {
      this._setPendingFlag(false);
    }
  }
}

export default ActionDecisionWorkflow;
