/**
 * @file Helper utilities for working with AIPromptPipeline test beds.
 */

import { expect } from '@jest/globals';

/**
 * @typedef {object} DependencySpecEntry
 * @property {RegExp} error - Expected error when dependency is missing.
 * @property {string[]} methods - Methods required on the dependency.
 */

/**
 * @description Defines how {@link module:src/prompting/AIPromptPipeline~AIPromptPipeline} constructor dependencies
 * should be validated within tests. Each property specifies the expected error
 * regex and required method names for that dependency.
 * @type {Object<string, DependencySpecEntry>}
 */
export const AIPromptPipelineDependencySpec = {
  llmAdapter: {
    error: /ILLMAdapter/,
    methods: ['getAIDecision', 'getCurrentActiveLlmId'],
  },
  gameStateProvider: {
    error: /IAIGameStateProvider/,
    methods: ['buildGameState'],
  },
  promptContentProvider: {
    error: /IAIPromptContentProvider/,
    methods: ['getPromptData'],
  },
  promptBuilder: {
    error: /IPromptBuilder/,
    methods: ['build'],
  },
  logger: { error: /ILogger/, methods: ['info'] },
};

/**
 * @description Generates a prompt using the provided test bed and verifies that
 * its dependencies were invoked with the expected arguments.
 * @param {import('./promptPipelineTestBed.js').AIPromptPipelineTestBed} bed -
 *   The active test bed instance.
 * @param {object} params - Options for generation and assertions.
 * @param {import('../../src/entities/entity.js').default} params.actor - Actor
 *   for the prompt.
 * @param {import('../../src/turns/interfaces/ITurnContext.js').ITurnContext} params.context -
 *   Turn context for the prompt.
 * @param {import('../../src/turns/dtos/actionComposite.js').ActionComposite[]} params.actions -
 *   Available actions for the actor.
 * @param {string} params.expectedPrompt - Expected final prompt string.
 * @param {string} [params.llmId] - Optional LLM ID override.
 * @param {object} [params.gameState] - Optional game state override.
 * @param {object} [params.promptData] - Optional prompt data override.
 * @param {string} [params.finalPrompt] - Optional final prompt override.
 * @returns {Promise<void>} Resolves when all assertions pass.
 */
export async function expectSuccessfulGeneration(
  bed,
  {
    actor,
    context,
    actions,
    expectedPrompt,
    llmId,
    gameState,
    promptData,
    finalPrompt,
  }
) {
  bed.setupMockSuccess({ llmId, gameState, promptData, finalPrompt });
  const prompt = await bed.generate(actor, context, actions);
  expect(prompt).toBe(expectedPrompt);

  const {
    llmId: _llmId,
    gameState: _gameState,
    promptData: _promptData,
  } = bed._successOptions;
  expect(bed.llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
  expect(bed.gameStateProvider.buildGameState).toHaveBeenCalledWith(
    actor,
    context,
    bed.logger
  );
  expect(bed.promptContentProvider.getPromptData).toHaveBeenCalledWith(
    expect.objectContaining({ ..._gameState, availableActions: actions }),
    bed.logger
  );
  expect(bed.promptBuilder.build).toHaveBeenCalledWith(_llmId, _promptData);
}

/**
 * @description Applies a mutation to the test bed's mocks and expects prompt
 * generation to fail with the provided error.
 * @param {import('./promptPipelineTestBed.js').AIPromptPipelineTestBed} bed -
 *   The active test bed instance.
 * @param {(bed: import('./promptPipelineTestBed.js').AIPromptPipelineTestBed) => void} mutateFn -
 *   Function that mutates the test bed's mocks before generation.
 * @param {string|RegExp|Error} expectedError - Error expected from the generation
 *   call.
 * @returns {Promise<void>} Resolves when the assertion completes.
 */
export async function expectGenerationFailure(bed, mutateFn, expectedError) {
  mutateFn(bed);
  await expect(bed.generateDefault()).rejects.toThrow(expectedError);
}
