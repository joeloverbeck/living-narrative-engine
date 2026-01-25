/* eslint-env es2022 */
/**
 * @file Orchestrates two-phase emotional state update flow
 * Phase 1: Generate mood prompt -> LLM call -> Parse -> Persist mood
 * Phase 2: Generate action prompt (fresh mood) -> LLM call -> Parse -> Return
 */

import {
  LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
} from '../schemas/llmOutputSchemas.js';

export class TwoPhaseDecisionOrchestrator {
  #moodUpdatePipeline;
  #moodResponseProcessor;
  #moodPersistenceService;
  #aiPromptPipeline;
  #llmAdapter;
  #llmResponseProcessor;
  #perceptionLogProvider;
  #safeEventDispatcher;
  #logger;

  constructor({
    moodUpdatePipeline,
    moodResponseProcessor,
    moodPersistenceService,
    aiPromptPipeline,
    llmAdapter,
    llmResponseProcessor,
    perceptionLogProvider,
    safeEventDispatcher,
    logger,
  }) {
    this.#validateDependencies({
      moodUpdatePipeline,
      moodResponseProcessor,
      moodPersistenceService,
      aiPromptPipeline,
      llmAdapter,
      llmResponseProcessor,
      perceptionLogProvider,
      safeEventDispatcher,
      logger,
    });

    this.#moodUpdatePipeline = moodUpdatePipeline;
    this.#moodResponseProcessor = moodResponseProcessor;
    this.#moodPersistenceService = moodPersistenceService;
    this.#aiPromptPipeline = aiPromptPipeline;
    this.#llmAdapter = llmAdapter;
    this.#llmResponseProcessor = llmResponseProcessor;
    this.#perceptionLogProvider = perceptionLogProvider;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger = logger;
  }

  #validateDependencies(deps) {
    if (!deps.moodUpdatePipeline?.generateMoodUpdatePrompt) {
      throw new Error('TwoPhaseDecisionOrchestrator: moodUpdatePipeline required');
    }
    if (!deps.moodResponseProcessor?.processMoodResponse) {
      throw new Error(
        'TwoPhaseDecisionOrchestrator: moodResponseProcessor required'
      );
    }
    if (!deps.moodPersistenceService?.persistMoodUpdate) {
      throw new Error(
        'TwoPhaseDecisionOrchestrator: moodPersistenceService required'
      );
    }
    if (!deps.aiPromptPipeline?.generatePrompt) {
      throw new Error('TwoPhaseDecisionOrchestrator: aiPromptPipeline required');
    }
    if (!deps.llmAdapter?.getAIDecision) {
      throw new Error('TwoPhaseDecisionOrchestrator: llmAdapter required');
    }
    if (!deps.llmResponseProcessor?.processResponse) {
      throw new Error(
        'TwoPhaseDecisionOrchestrator: llmResponseProcessor required'
      );
    }
    if (!deps.perceptionLogProvider?.isEmpty) {
      throw new Error(
        'TwoPhaseDecisionOrchestrator: perceptionLogProvider required'
      );
    }
    if (!deps.safeEventDispatcher?.dispatch) {
      throw new Error(
        'TwoPhaseDecisionOrchestrator: safeEventDispatcher required'
      );
    }
    if (!deps.logger?.debug) {
      throw new Error('TwoPhaseDecisionOrchestrator: logger required');
    }
  }

  /**
   * Execute two-phase decision flow.
   *
   * @param {object} params
   * @param {object} params.actor - Actor entity
   * @param {object} params.context - Turn context
   * @param {Array} params.actions - Available actions
   * @param {AbortSignal} [params.abortSignal] - Optional abort signal
   * @returns {Promise<object>} Decision result matching LLMChooser.choose() return type
   */
  async orchestrate({ actor, context, actions, abortSignal }) {
    this.#logger.debug(
      `TwoPhaseDecisionOrchestrator: Starting for actor ${actor.id}`
    );

    // ========================================
    // PHASE 1: Mood Update (skipped if perception log is empty)
    // ========================================
    let moodUpdate = null;
    let sexualUpdate = null;

    const isPerceptionLogEmpty = await this.#perceptionLogProvider.isEmpty(
      actor,
      this.#logger,
      this.#safeEventDispatcher
    );

    if (isPerceptionLogEmpty) {
      this.#logger.debug(
        'TwoPhaseDecisionOrchestrator: Phase 1 skipped - perception log is empty'
      );
    } else {
      this.#logger.debug('TwoPhaseDecisionOrchestrator: Phase 1 - Mood Update');

      const moodPrompt = await this.#moodUpdatePipeline.generateMoodUpdatePrompt(
        actor,
        context
      );

      const moodRawResponse = await this.#llmAdapter.getAIDecision(
        moodPrompt,
        abortSignal,
        {
          toolSchema: LLM_MOOD_UPDATE_RESPONSE_SCHEMA,
          toolName: 'mood_update',
          toolDescription:
            'Update character mood and sexual state based on recent events',
        }
      );

      const moodParsed = await this.#moodResponseProcessor.processMoodResponse(
        moodRawResponse,
        actor.id
      );

      await this.#moodPersistenceService.persistMoodUpdate(
        actor.id,
        moodParsed.moodUpdate,
        moodParsed.sexualUpdate
      );

      moodUpdate = moodParsed.moodUpdate;
      sexualUpdate = moodParsed.sexualUpdate;

      this.#logger.debug(
        'TwoPhaseDecisionOrchestrator: Phase 1 complete, mood persisted'
      );
    }

    // ========================================
    // PHASE 2: Action Decision
    // ========================================
    this.#logger.debug('TwoPhaseDecisionOrchestrator: Phase 2 - Action Decision');

    const actionPrompt = await this.#aiPromptPipeline.generatePrompt(
      actor,
      context,
      actions
    );

    const actionRawResponse = await this.#llmAdapter.getAIDecision(
      actionPrompt,
      abortSignal,
      {
        toolSchema: LLM_TURN_ACTION_RESPONSE_SCHEMA_V5,
        toolName: 'turn_action',
        toolDescription: 'Select action, speech, and thoughts for character turn',
      }
    );

    const actionResult = await this.#llmResponseProcessor.processResponse(
      actionRawResponse,
      actor.id
    );

    this.#logger.debug('TwoPhaseDecisionOrchestrator: Phase 2 complete');

    return {
      index: actionResult.action.chosenIndex,
      speech: actionResult.action.speech,
      thoughts: actionResult.extractedData?.thoughts ?? null,
      notes: actionResult.extractedData?.notes ?? null,
      cognitiveLedger: actionResult.extractedData?.cognitiveLedger ?? null,
      moodUpdate,
      sexualUpdate,
    };
  }
}
