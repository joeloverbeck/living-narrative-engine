/* eslint-env node */
import { test, expect } from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import {
  describeAIPromptPipelineSuite,
  AIPromptPipelineDependencySpec,
} from '../../common/prompting/promptPipelineTestBed.js';
import { describeConstructorValidation } from '../../common/constructorValidationHelpers.js';
import { useTestBed } from '../../common/useTestBed.js';

describeAIPromptPipelineSuite('AIPromptPipeline', (getBed) => {
  const get = useTestBed(getBed);
  describeConstructorValidation(
    AIPromptPipeline,
    () => get().getDependencies(),
    AIPromptPipelineDependencySpec
  );

  test('generatePrompt orchestrates dependencies and returns prompt', async () => {
    const bed = get();
    const actor = bed.defaultActor;
    const context = bed.defaultContext;
    const actions = [...bed.defaultActions, { id: 'a1' }];

    await bed.expectSuccessfulGeneration({
      actor,
      context,
      actions,
      expectedPrompt: 'FINAL',
      llmId: 'llm1',
      gameState: { state: true },
      promptData: { pd: true },
      finalPrompt: 'FINAL',
    });
  });

  test.each([
    {
      desc: 'llmAdapter returns falsy',
      mutate: (bed) =>
        bed.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(null),
      error: 'Could not determine active LLM ID.',
    },
    {
      desc: 'promptBuilder returns empty string',
      mutate: (bed) => bed.promptBuilder.build.mockResolvedValue(''),
      error: 'PromptBuilder returned an empty or invalid prompt.',
    },
  ])('generatePrompt rejects when %s', async ({ mutate, error }) => {
    const bed = get();
    await bed.expectGenerationFailure(mutate, error);
  });
});
