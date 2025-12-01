/**
 * @file actionDecisionWorkflow.js
 * @description Workflow logic for AwaitingActorDecisionState handling action decisions.
 */

import { LLMDecisionProvider } from '../../providers/llmDecisionProvider.js';
import { getSafeEventDispatcher } from '../helpers/contextUtils.js';
import { LLM_SUGGESTED_ACTION_ID } from '../../../constants/eventIds.js';
import { getLLMTimeoutConfig } from '../../../config/llmTimeout.config.js';

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

  _getTimeoutSettings() {
    const config = getLLMTimeoutConfig();
    return {
      enabled: config.enabled === true,
      timeoutMs: config.timeoutMs,
      policy: config.policy,
      waitActionHints: Array.isArray(config.waitActionHints)
        ? config.waitActionHints
        : [],
    };
  }

  _cancelPrompt() {
    if (typeof this._turnContext.cancelActivePrompt === 'function') {
      try {
        this._turnContext.cancelActivePrompt();
      } catch (err) {
        this._turnContext
          .getLogger()
          .warn(
            `${this._state.getStateName()}: Failed to cancel prompt after timeout – ${err.message}`
          );
      }
    }
  }

  _findWaitActionIndex(actions, waitActionHints = []) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return null;
    }

    const hints = waitActionHints
      .filter((hint) => typeof hint === 'string' && hint.trim().length > 0)
      .map((hint) => hint.toLowerCase());

    const candidate = actions.find((action) => {
      const fields = [
        action.actionDefinitionId,
        action.actionId,
        action.commandString,
        action.description,
      ];
      return fields.some(
        (field) =>
          typeof field === 'string' &&
          hints.some((hint) => field.toLowerCase().includes(hint))
      );
    });

    return candidate?.index ?? null;
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

  async _resolveTimeoutPolicy({
    policy,
    actions,
    fallbackIndex,
    suggestedDescriptor,
    promptOutcomePromise,
    waitActionHints,
  }) {
    const logger = this._turnContext.getLogger();
    const baseMsg = `${this._state.getStateName()}: LLM suggestion timed out`;

    if (policy === 'noop') {
      logger.warn(
        `${baseMsg}; policy=noop – continuing to wait for submission.`
      );
      const outcome = await promptOutcomePromise;
      if (outcome.kind === 'error') {
        throw outcome.error;
      }
      return {
        ...outcome.result,
        timeout: false,
        timeoutPolicy: 'noop',
      };
    }

    if (policy === 'autoWait') {
      const waitIndex =
        this._findWaitActionIndex(actions, waitActionHints) ?? fallbackIndex;
      logger.warn(
        `${baseMsg}; policy=autoWait -> index ${waitIndex ?? 'none found'}.`
      );
      this._cancelPrompt();
      return {
        chosenIndex: waitIndex,
        speech: null,
        thoughts: null,
        notes: null,
        timeout: true,
        timeoutPolicy: 'autoWait',
      };
    }

    logger.warn(
      `${baseMsg}; policy=autoAccept -> index ${fallbackIndex ?? 'none found'}.`,
      { suggestedDescriptor: this._describeActionDescriptor(suggestedDescriptor) }
    );
    this._cancelPrompt();
    return {
      chosenIndex: fallbackIndex,
      speech: null,
      thoughts: null,
      notes: null,
      timeout: true,
      timeoutPolicy: 'autoAccept',
    };
  }

  async _awaitHumanSubmission(
    actions,
    fallbackIndex,
    suggestedDescriptor,
    timeoutSettings
  ) {
    const promptService = this._turnContext.getPlayerPromptService?.();
    const promptPromise =
      promptService && Array.isArray(actions) && actions.length > 0
        ? promptService.prompt(this._actor, {
            indexedComposites: actions,
            cancellationSignal: this._turnContext.getPromptSignal(),
            ...(Number.isInteger(fallbackIndex) && fallbackIndex > 0
              ? {
                  suggestedAction: {
                    index: fallbackIndex,
                    descriptor: this._describeActionDescriptor(
                      suggestedDescriptor
                    ),
                  },
                }
              : {}),
          })
        : Promise.resolve({
            chosenIndex: fallbackIndex,
            speech: null,
            thoughts: null,
            notes: null,
          });

    const safePromptPromise = Promise.resolve(promptPromise)
      .then((result) => ({ kind: 'submission', result }))
      .catch((error) => ({ kind: 'error', error }));

    if (!timeoutSettings?.enabled) {
      const outcome = await safePromptPromise;
      if (outcome.kind === 'error') {
        throw outcome.error;
      }
      return outcome.result;
    }

    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(
        () => resolve({ kind: 'timeout' }),
        timeoutSettings.timeoutMs
      );
    });

    const outcome = await Promise.race([safePromptPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    if (outcome.kind === 'timeout') {
      return this._resolveTimeoutPolicy({
        policy: timeoutSettings.policy,
        actions,
        fallbackIndex,
        suggestedDescriptor,
        promptOutcomePromise: safePromptPromise,
        waitActionHints: timeoutSettings.waitActionHints,
      });
    }

    if (outcome.kind === 'error') {
      throw outcome.error;
    }

    return outcome.result;
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
    const timeoutSettings = this._getTimeoutSettings();
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
        descriptor,
        timeoutSettings
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
        resolvedByTimeout: submission?.timeout === true,
        timeoutPolicy: submission?.timeoutPolicy ?? null,
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
