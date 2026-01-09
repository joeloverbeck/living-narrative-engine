import { describe, it, expect, jest } from '@jest/globals';
import { LLMChooser } from '../../../../src/turns/adapters/llmChooser.js';
import { createMockLogger } from '../../../common/mockFactories.js';

/**
 * Additional branch coverage tests for LLMChooser.
 */
describe('LLMChooser additional branches', () => {
  const logger = createMockLogger();

  it('throws when dependencies are missing required methods', () => {
    expect(
      () =>
        new LLMChooser({
          twoPhaseOrchestrator: {},
          logger,
        })
    ).toThrow('twoPhaseOrchestrator invalid');

    expect(
      () =>
        new LLMChooser({
          twoPhaseOrchestrator: { orchestrate: jest.fn() },
          logger: {},
        })
    ).toThrow('logger invalid');
  });

  it('returns orchestrator result with notes and thoughts', async () => {
    const expected = {
      index: 1,
      speech: null,
      thoughts: 't',
      notes: ['n1'],
      moodUpdate: null,
      sexualUpdate: null,
    };
    const chooser = new LLMChooser({
      twoPhaseOrchestrator: { orchestrate: jest.fn().mockResolvedValue(expected) },
      logger,
    });

    const result = await chooser.choose({
      actor: { id: 'a' },
      context: {},
      actions: [],
    });

    expect(result).toEqual(expected);
  });
});
