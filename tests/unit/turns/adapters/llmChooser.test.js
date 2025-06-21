import { jest, describe, test, expect } from '@jest/globals';
import { LLMChooser } from '../../../../src/turns/adapters/llmChooser.js';
import {
  createMockLogger,
  createMockAIPromptPipeline,
} from '../../../common/mockFactories.js';

const dummyLogger = createMockLogger();

describe('LLMChooser', () => {
  test('forwards AbortSignal to llmAdapter', async () => {
    const promptPipeline = createMockAIPromptPipeline('PROMPT');
    const llmAdapter = { getAIDecision: jest.fn().mockResolvedValue('{}') };
    const responseProcessor = {
      processResponse: jest.fn().mockResolvedValue({
        action: { chosenIndex: 0, speech: null },
      }),
    };

    const chooser = new LLMChooser({
      promptPipeline,
      llmAdapter,
      responseProcessor,
      logger: dummyLogger,
    });

    const controller = new AbortController();
    await chooser.choose({
      actor: { id: 'a1' },
      context: {},
      actions: [],
      abortSignal: controller.signal,
    });

    expect(llmAdapter.getAIDecision).toHaveBeenCalledWith(
      'PROMPT',
      controller.signal
    );
  });

  test('returns {index, speech} shape', async () => {
    const promptPipeline = createMockAIPromptPipeline('PROMPT');
    const llmAdapter = { getAIDecision: jest.fn().mockResolvedValue('{}') };
    const responseProcessor = {
      processResponse: jest.fn().mockResolvedValue({
        action: { chosenIndex: 2, speech: 'Hello there!' },
      }),
    };

    const chooser = new LLMChooser({
      promptPipeline,
      llmAdapter,
      responseProcessor,
      logger: dummyLogger,
    });

    const result = await chooser.choose({
      actor: { id: 'a1' },
      context: {},
      actions: [],
    });

    expect(result).toEqual({
      index: 2,
      speech: 'Hello there!',
      notes: null,
      thoughts: null,
    });
  });
});
