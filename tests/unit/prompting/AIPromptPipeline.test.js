/* eslint-env node */
import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import { AIPromptPipelineTestBed } from '../../common/prompting/promptPipelineTestBed.js';
import { createMockEntity } from '../../common/mockFactories.js';

const defaultActor = createMockEntity('actor');
const defaultContext = {};
const defaultActions = [];

describe('AIPromptPipeline', () => {
  /** @type {AIPromptPipelineTestBed} */
  let testBed;
  /** @type {AIPromptPipeline} */
  let pipeline;

  beforeEach(() => {
    testBed = new AIPromptPipelineTestBed();
    pipeline = testBed.createPipeline();

    // Default success paths
    testBed.setupMockSuccess();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('constructor validation', () => {
    test.each([
      [
        'llmAdapter missing',
        (d) => {
          delete d.llmAdapter;
        },
        /ILLMAdapter/,
      ],
      [
        'llmAdapter.getAIDecision missing',
        (d) => {
          delete d.llmAdapter.getAIDecision;
        },
        /ILLMAdapter/,
      ],
      [
        'llmAdapter.getCurrentActiveLlmId missing',
        (d) => {
          delete d.llmAdapter.getCurrentActiveLlmId;
        },
        /ILLMAdapter/,
      ],
      [
        'gameStateProvider missing',
        (d) => {
          delete d.gameStateProvider;
        },
        /IAIGameStateProvider/,
      ],
      [
        'gameStateProvider.buildGameState missing',
        (d) => {
          delete d.gameStateProvider.buildGameState;
        },
        /IAIGameStateProvider/,
      ],
      [
        'promptContentProvider missing',
        (d) => {
          delete d.promptContentProvider;
        },
        /IAIPromptContentProvider/,
      ],
      [
        'promptContentProvider.getPromptData missing',
        (d) => {
          delete d.promptContentProvider.getPromptData;
        },
        /IAIPromptContentProvider/,
      ],
      [
        'promptBuilder missing',
        (d) => {
          delete d.promptBuilder;
        },
        /IPromptBuilder/,
      ],
      [
        'promptBuilder.build missing',
        (d) => {
          delete d.promptBuilder.build;
        },
        /IPromptBuilder/,
      ],
      [
        'logger missing',
        (d) => {
          delete d.logger;
        },
        /ILogger/,
      ],
      [
        'logger.info missing',
        (d) => {
          delete d.logger.info;
        },
        /ILogger/,
      ],
    ])('throws when %s', (_desc, mutate, regex) => {
      const deps = testBed.getDependencies();
      mutate(deps);
      expect(() => new AIPromptPipeline(deps)).toThrow(regex);
    });
  });

  test('generatePrompt orchestrates dependencies and returns prompt', async () => {
    const actor = defaultActor;
    const context = defaultContext;
    const actions = [...defaultActions, { id: 'a1' }];

    testBed.llmAdapter.getCurrentActiveLlmId.mockResolvedValue('llm1');
    testBed.gameStateProvider.buildGameState.mockResolvedValue({ state: true });
    testBed.promptContentProvider.getPromptData.mockResolvedValue({ pd: true });
    testBed.promptBuilder.build.mockResolvedValue('FINAL');

    const prompt = await pipeline.generatePrompt(actor, context, actions);

    expect(prompt).toBe('FINAL');
    expect(testBed.llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(testBed.gameStateProvider.buildGameState).toHaveBeenCalledWith(
      actor,
      context,
      testBed.logger
    );
    expect(testBed.promptContentProvider.getPromptData).toHaveBeenCalledWith(
      expect.objectContaining({ state: true, availableActions: actions }),
      testBed.logger
    );
    expect(testBed.promptBuilder.build).toHaveBeenCalledWith('llm1', {
      pd: true,
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
    await expect(
      pipeline.generatePrompt(defaultActor, defaultContext, defaultActions)
    ).rejects.toThrow(error);
  });

  test('availableActions are attached to DTO sent to getPromptData', async () => {
    const actor = defaultActor;
    const context = defaultContext;
    const actions = [...defaultActions, { id: 'act' }];

    testBed.gameStateProvider.buildGameState.mockResolvedValue({});
    testBed.promptContentProvider.getPromptData.mockResolvedValue({});
    testBed.promptBuilder.build.mockResolvedValue('prompt');

    await pipeline.generatePrompt(actor, context, actions);

    expect(testBed.promptContentProvider.getPromptData).toHaveBeenCalledWith(
      expect.objectContaining({ availableActions: actions }),
      testBed.logger
    );
  });
});
