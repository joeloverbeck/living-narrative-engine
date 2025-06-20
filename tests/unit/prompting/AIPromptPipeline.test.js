/* eslint-env node */
import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { AIPromptPipeline } from '../../../src/prompting/AIPromptPipeline.js';
import { AIPromptPipelineTestBed } from '../../common/prompting/promptPipelineTestBed.js';

describe('AIPromptPipeline', () => {
  /** @type {AIPromptPipelineTestBed} */
  let testBed;
  /** @type {AIPromptPipeline} */
  let pipeline;

  beforeEach(() => {
    testBed = new AIPromptPipelineTestBed();
    pipeline = testBed.createPipeline();

    // Default success paths
    testBed.llmAdapter.getCurrentActiveLlmId.mockResolvedValue('llm-id');
    testBed.gameStateProvider.buildGameState.mockResolvedValue({});
    testBed.promptContentProvider.getPromptData.mockResolvedValue({});
    testBed.promptBuilder.build.mockResolvedValue('PROMPT');
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
    const actor = { id: 'actor1' };
    const context = {};
    const actions = [{ id: 'a1' }];

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

  test('generatePrompt errors when llmAdapter returns falsy', async () => {
    testBed.llmAdapter.getCurrentActiveLlmId.mockResolvedValue(null);

    await expect(pipeline.generatePrompt({ id: 'a' }, {}, [])).rejects.toThrow(
      'Could not determine active LLM ID.'
    );
  });

  test('generatePrompt errors when promptBuilder.build returns empty string', async () => {
    testBed.promptBuilder.build.mockResolvedValue('');

    await expect(pipeline.generatePrompt({ id: 'a' }, {}, [])).rejects.toThrow(
      'PromptBuilder returned an empty or invalid prompt.'
    );
  });

  test('availableActions are attached to DTO sent to getPromptData', async () => {
    const actor = { id: 'actor2' };
    const context = {};
    const actions = [{ id: 'act' }];

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
