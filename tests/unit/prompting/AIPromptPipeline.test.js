/* eslint-env node */
import { test, expect } from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import {
  describeAIPromptPipelineSuite,
  AIPromptPipelineDependencySpec,
} from '../../common/prompting/promptPipelineTestBed.js';
import { buildMissingDependencyCases } from '../../common/constructorValidationHelpers.js';

describeAIPromptPipelineSuite('AIPromptPipeline', (bed) => {
  describe('constructor validation', () => {
    const cases = buildMissingDependencyCases(
      () => bed.getDependencies(),
      AIPromptPipelineDependencySpec
    );
    test.each(cases)('throws when %s', (_desc, mutate, regex) => {
      const deps = bed.getDependencies();
      mutate(deps);
      expect(() => new AIPromptPipeline(deps)).toThrow(regex);
    });
  });

  test('generatePrompt orchestrates dependencies and returns prompt', async () => {
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
    await bed.expectGenerationFailure(mutate, error);
  });

  test('availableActions are attached to DTO sent to getPromptData', async () => {
    const actor = bed.defaultActor;
    const context = bed.defaultContext;
    const actions = [...bed.defaultActions, { id: 'act' }];

    bed.setupMockSuccess({
      gameState: {},
      promptData: {},
      finalPrompt: 'prompt',
    });

    await bed.generate(actor, context, actions);

    expect(bed.promptContentProvider.getPromptData).toHaveBeenCalledWith(
      expect.objectContaining({ availableActions: actions }),
      bed.logger
    );
  });
});
