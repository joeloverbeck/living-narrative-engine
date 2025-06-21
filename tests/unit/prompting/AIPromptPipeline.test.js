/* eslint-env node */
import { beforeEach, test, expect } from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import {
  describeAIPromptPipelineSuite,
  AIPromptPipelineTestBed,
  AIPromptPipelineDependencySpec,
} from '../../common/prompting/promptPipelineTestBed.js';
import { buildMissingDependencyCases } from '../../common/constructorValidationHelpers.js';

describeAIPromptPipelineSuite('AIPromptPipeline', (getBed) => {
  /** @type {AIPromptPipelineTestBed} */
  let testBed;

  beforeEach(() => {
    testBed = getBed();
  });

  describe('constructor validation', () => {
    const cases = buildMissingDependencyCases(
      () => testBed.getDependencies(),
      AIPromptPipelineDependencySpec
    );
    test.each(cases)('throws when %s', (_desc, mutate, regex) => {
      const deps = testBed.getDependencies();
      mutate(deps);
      expect(() => new AIPromptPipeline(deps)).toThrow(regex);
    });
  });

  test('generatePrompt orchestrates dependencies and returns prompt', async () => {
    const actor = testBed.defaultActor;
    const context = testBed.defaultContext;
    const actions = [...testBed.defaultActions, { id: 'a1' }];

    await testBed.expectSuccessfulGeneration({
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
      mutate: () =>
        testBed.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(null),
      error: 'Could not determine active LLM ID.',
    },
    {
      desc: 'promptBuilder returns empty string',
      mutate: () => testBed.promptBuilder.build.mockResolvedValue(''),
      error: 'PromptBuilder returned an empty or invalid prompt.',
    },
  ])('generatePrompt rejects when %s', async ({ mutate, error }) => {
    mutate();
    await expect(testBed.generateDefault()).rejects.toThrow(error);
  });

  test('availableActions are attached to DTO sent to getPromptData', async () => {
    const actor = testBed.defaultActor;
    const context = testBed.defaultContext;
    const actions = [...testBed.defaultActions, { id: 'act' }];

    testBed.setupMockSuccess({
      gameState: {},
      promptData: {},
      finalPrompt: 'prompt',
    });

    await testBed.generate(actor, context, actions);

    expect(testBed.promptContentProvider.getPromptData).toHaveBeenCalledWith(
      expect.objectContaining({ availableActions: actions }),
      testBed.logger
    );
  });
});
