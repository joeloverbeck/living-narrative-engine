import { jest, describe, test, expect } from '@jest/globals';
import { LLMChooser } from '../../../../src/turns/adapters/llmChooser.js';
import { createMockLogger } from '../../../common/mockFactories.js';

const dummyLogger = createMockLogger();

describe('LLMChooser', () => {
  test('throws when twoPhaseOrchestrator is invalid', () => {
    expect(() => {
      new LLMChooser({ twoPhaseOrchestrator: null, logger: dummyLogger });
    }).toThrow('LLMChooser: twoPhaseOrchestrator invalid');
  });

  test('forwards AbortSignal to orchestrator', async () => {
    const twoPhaseOrchestrator = {
      orchestrate: jest.fn().mockResolvedValue({ index: 0, speech: null }),
    };

    const chooser = new LLMChooser({
      twoPhaseOrchestrator,
      logger: dummyLogger,
    });

    const controller = new AbortController();
    await chooser.choose({
      actor: { id: 'a1' },
      context: {},
      actions: [],
      abortSignal: controller.signal,
    });

    expect(twoPhaseOrchestrator.orchestrate).toHaveBeenCalledWith({
      actor: { id: 'a1' },
      context: {},
      actions: [],
      abortSignal: controller.signal,
    });
  });

  test('returns orchestrator result unchanged', async () => {
    const expected = {
      index: 2,
      speech: 'Hello there!',
      notes: null,
      thoughts: null,
      moodUpdate: null,
      sexualUpdate: null,
    };
    const twoPhaseOrchestrator = {
      orchestrate: jest.fn().mockResolvedValue(expected),
    };

    const chooser = new LLMChooser({
      twoPhaseOrchestrator,
      logger: dummyLogger,
    });

    const result = await chooser.choose({
      actor: { id: 'a1' },
      context: {},
      actions: [],
    });

    expect(result).toEqual(expected);
  });
});
