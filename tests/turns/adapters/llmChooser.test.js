import { jest, describe, test, expect } from '@jest/globals';
import { LLMChooser } from '../../../src/turns/adapters/llmChooser.js';

const dummyLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('LLMChooser', () => {
  test('forwards AbortSignal to llmAdapter', async () => {
    const promptPipeline = {
      generatePrompt: jest.fn().mockResolvedValue('PROMPT'),
    };
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
    const promptPipeline = {
      generatePrompt: jest.fn().mockResolvedValue('PROMPT'),
    };
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

    expect(result).toEqual({ index: 2, speech: 'Hello there!' });
  });
});
