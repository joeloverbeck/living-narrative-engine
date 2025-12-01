/**
 * @file actionDecisionWorkflow.js
 * @description Workflow logic for AwaitingActorDecisionState handling action decisions.
 */

import { LLMDecisionProvider } from '../../providers/llmDecisionProvider.js';
import { getSafeEventDispatcher } from '../helpers/contextUtils.js';
import {
  DISPLAY_SPEECH_ID,
  DISPLAY_THOUGHT_ID,
  LLM_SUGGESTED_ACTION_ID,
} from '../../../constants/eventIds.js';
import { getLLMTimeoutConfig } from '../../../config/llmTimeout.config.js';
import { buildSpeechPayload } from '../helpers/buildSpeechPayload.js';
import { buildThoughtPayload } from '../helpers/buildThoughtPayload.js';

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

    const logger = this._turnContext.getLogger();

    try {
      this._turnContext.setAwaitingExternalEvent(isPending, this._actor.id);
      if (logger?.debug) {
        logger.debug(
          `${this._state.getStateName()}: Pending approval ${
            isPending ? 'set' : 'cleared'
          } for actor ${this._actor.id}.`
        );
      }
    } catch (err) {
      logger?.warn?.(
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

    try {
      await dispatcher.dispatch(LLM_SUGGESTED_ACTION_ID, payload, {
        allowSchemaNotFound: true,
      });
    } catch (err) {
      this._turnContext
        .getLogger()
        ?.error?.(
          `${this._state.getStateName()}: Failed to dispatch suggested action event – ${err.message}`,
          err
        );
    }
  }

  async _dispatchLLMDialogPreview(decisionMeta) {
    const dispatcher = getSafeEventDispatcher(this._turnContext, this._state._handler);
    const logger = this._turnContext.getLogger();
    if (!dispatcher) {
      return { speech: false, thought: false };
    }

    const speechPayload = buildSpeechPayload(decisionMeta);
    if (speechPayload) {
      try {
        await dispatcher.dispatch(DISPLAY_SPEECH_ID, {
          entityId: this._actor.id,
          ...speechPayload,
        });
        return { speech: true, thought: Boolean(speechPayload.thoughts) };
      } catch (err) {
        logger?.warn?.(
          `${this._state.getStateName()}: Failed to dispatch LLM preview speech bubble – ${err.message}`
        );
      }
      return { speech: false, thought: false };
    }

    const thoughtPayload = buildThoughtPayload(decisionMeta, this._actor.id);
    if (thoughtPayload) {
      try {
        await dispatcher.dispatch(DISPLAY_THOUGHT_ID, thoughtPayload);
        return { speech: false, thought: true };
      } catch (err) {
        logger?.warn?.(
          `${this._state.getStateName()}: Failed to dispatch LLM preview thought bubble – ${err.message}`
        );
      }
    }

    return { speech: false, thought: false };
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

  _logLLMSuggestionTelemetry({
    rawSuggestedIndex,
    clampedSuggestedIndex,
    rawSubmittedIndex,
    clampedSubmittedIndex,
    resolvedByTimeout,
    timeoutPolicy,
  }) {
    const logger = this._turnContext.getLogger();
    if (!logger?.debug) return;

    const finalIndex =
      Number.isInteger(clampedSubmittedIndex) && clampedSubmittedIndex > 0
        ? clampedSubmittedIndex
        : clampedSuggestedIndex;

    const override =
      Number.isInteger(clampedSuggestedIndex) &&
      Number.isInteger(clampedSubmittedIndex) &&
      clampedSuggestedIndex !== clampedSubmittedIndex;

    const correctedSuggestedIndex =
      Number.isInteger(rawSuggestedIndex) &&
      rawSuggestedIndex !== clampedSuggestedIndex
        ? rawSuggestedIndex
        : null;

    const correctedSubmittedIndex =
      Number.isInteger(rawSubmittedIndex) &&
      rawSubmittedIndex !== clampedSubmittedIndex
        ? rawSubmittedIndex
        : null;

    logger.debug(`${this._state.getStateName()}: LLM suggestion telemetry`, {
      actorId: this._actor.id,
      suggestedIndex: clampedSuggestedIndex,
      finalIndex,
      override,
      resolvedByTimeout: resolvedByTimeout === true,
      timeoutPolicy: resolvedByTimeout ? timeoutPolicy ?? null : null,
      correctedSuggestedIndex,
      correctedSubmittedIndex,
    });
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
    const logger = this._turnContext.getLogger();
    const fallbackSubmission = (error) => {
      if (error) {
        logger?.error?.(
          `${this._state.getStateName()}: Prompt submission failed – ${error.message}`,
          error
        );
      }
      return {
        chosenIndex: fallbackIndex,
        speech: null,
        thoughts: null,
        notes: null,
        timeout: false,
        timeoutPolicy: null,
      };
    };
    let promptService = null;

    if (typeof this._turnContext.getPlayerPromptService === 'function') {
      try {
        promptService = this._turnContext.getPlayerPromptService();
      } catch (err) {
        logger?.error?.(
          `${this._state.getStateName()}: PlayerPromptService unavailable – ${err.message}`,
          err
        );
      }
    }

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
        return fallbackSubmission(outcome.error);
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
      return fallbackSubmission(outcome.error);
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
    const rawSuggestedIndex = suggestedIndex ?? baseMeta.chosenIndex ?? null;
    const { value: clampedIndex, adjusted: suggestedAdjusted } = this._clampIndex(
      rawSuggestedIndex,
      actions.length
    );

    if (suggestedAdjusted) {
      logger.warn(
        `${this._state.getStateName()}: LLM suggested index ${rawSuggestedIndex} was out of range for ${actions.length} actions; clamped to ${clampedIndex}.`
      );
    }

    if (!actions.length) {
      logger.warn(
        `${this._state.getStateName()}: No indexed actions available for pending approval; proceeding with suggested action.`
      );
    }

    this._setPendingFlag(true);

    try {
      const descriptor = this._findCompositeForIndex(clampedIndex, actions) || action;
      await this._emitSuggestedActionEvent(clampedIndex, descriptor, baseMeta);

      const previewResult = await this._dispatchLLMDialogPreview(baseMeta);

      const submission = await this._awaitHumanSubmission(
        actions,
        clampedIndex,
        descriptor,
        timeoutSettings
      );
      const rawSubmittedIndex = submission?.chosenIndex ?? null;
      const { value: submittedIndex, adjusted: submissionAdjusted } = this._clampIndex(
        rawSubmittedIndex,
        actions.length
      );

      const finalIndex = submittedIndex ?? clampedIndex;

      if (submissionAdjusted) {
        logger.warn(
          `${this._state.getStateName()}: Submitted index ${rawSubmittedIndex} was out of range for ${actions.length} actions; clamped to ${submittedIndex}.`
        );
      }

      const mergedMeta = {
        speech: submission?.speech ?? baseMeta.speech ?? null,
        thoughts: submission?.thoughts ?? baseMeta.thoughts ?? null,
        notes: submission?.notes ?? baseMeta.notes ?? null,
        suggestedIndex: clampedIndex,
        submittedIndex: finalIndex,
        resolvedByTimeout: submission?.timeout === true,
        timeoutPolicy: submission?.timeoutPolicy ?? null,
        previewDisplayed:
          previewResult?.speech === true || previewResult?.thought === true,
      };

      const finalAction = this._buildActionForIndex(
        finalIndex,
        actions,
        mergedMeta.speech,
        action
      );

      this._logLLMSuggestionTelemetry({
        rawSuggestedIndex,
        clampedSuggestedIndex: clampedIndex,
        rawSubmittedIndex,
        clampedSubmittedIndex: submittedIndex,
        resolvedByTimeout: submission?.timeout,
        timeoutPolicy: submission?.timeoutPolicy,
      });

      return { action: finalAction, extractedData: mergedMeta };
    } finally {
      this._setPendingFlag(false);
    }
  }
}

export default ActionDecisionWorkflow;
