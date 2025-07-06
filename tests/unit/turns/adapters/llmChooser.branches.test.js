import { describe, it, expect, jest } from '@jest/globals';
import { LLMChooser } from '../../../../src/turns/adapters/llmChooser.js';
import {
  createMockLogger,
  createMockAIPromptPipeline,
} from '../../../common/mockFactories.js';

/**
 * Additional branch coverage tests for LLMChooser.
 */
describe('LLMChooser additional branches', () => {
  const logger = createMockLogger();

  it('throws when dependencies are missing required methods', () => {
    expect(
      () =>
        new LLMChooser({
          promptPipeline: {},
          llmAdapter: { getAIDecision: jest.fn() },
          responseProcessor: { processResponse: jest.fn() },
          logger,
        })
    ).toThrow('promptPipeline invalid');

    expect(
      () =>
        new LLMChooser({
          promptPipeline: createMockAIPromptPipeline('x'),
          llmAdapter: {},
          responseProcessor: { processResponse: jest.fn() },
          logger,
        })
    ).toThrow('llmAdapter invalid');

    expect(
      () =>
        new LLMChooser({
          promptPipeline: createMockAIPromptPipeline('x'),
          llmAdapter: { getAIDecision: jest.fn() },
          responseProcessor: {},
          logger,
        })
    ).toThrow('responseProcessor invalid');

    expect(
      () =>
        new LLMChooser({
          promptPipeline: createMockAIPromptPipeline('x'),
          llmAdapter: { getAIDecision: jest.fn() },
          responseProcessor: { processResponse: jest.fn() },
          logger: {},
        })
    ).toThrow('logger invalid');
  });

  it('throws if prompt pipeline returns empty prompt', async () => {
    const promptPipeline = createMockAIPromptPipeline('');
    const llmAdapter = { getAIDecision: jest.fn() };
    const responseProcessor = { processResponse: jest.fn() };
    const chooser = new LLMChooser({
      promptPipeline,
      llmAdapter,
      responseProcessor,
      logger,
    });
    await expect(
      chooser.choose({ actor: { id: 'a' }, context: {}, actions: [] })
    ).rejects.toThrow('empty prompt');
  });

  it('returns notes and thoughts from responseProcessor', async () => {
    const promptPipeline = createMockAIPromptPipeline('PROMPT');
    const llmAdapter = { getAIDecision: jest.fn().mockResolvedValue('{}') };
    const responseProcessor = {
      processResponse: jest.fn().mockResolvedValue({
        action: { chosenIndex: 1, speech: null },
        extractedData: { thoughts: 't', notes: ['n1'] },
      }),
    };
    const chooser = new LLMChooser({
      promptPipeline,
      llmAdapter,
      responseProcessor,
      logger,
    });

    const result = await chooser.choose({
      actor: { id: 'a' },
      context: {},
      actions: [],
    });

    expect(result).toEqual({
      index: 1,
      speech: null,
      thoughts: 't',
      notes: ['n1'],
    });
  });
});
