import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { HumanDecisionProvider } from '../../../src/turns/providers/humanDecisionProvider.js';

describe('HumanDecisionProvider', () => {
  let promptCoordinator;
  let actionIndexingService;
  let logger;
  let provider;
  const actor = { id: 'actor-1' };

  beforeEach(() => {
    promptCoordinator = { prompt: jest.fn() };
    actionIndexingService = { resolve: jest.fn() };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    provider = new HumanDecisionProvider({
      promptCoordinator,
      actionIndexingService,
      logger,
    });
  });

  it('uses promptRes.index when it is an integer', async () => {
    const abortSignal = {};
    const promptRes = {
      index: 2,
      speech: 'Hello',
      thoughts: 'Thinking aloud',
      notes: ['noteA', 'noteB'],
    };
    promptCoordinator.prompt.mockResolvedValueOnce(promptRes);

    const result = await provider.decide(actor, {}, [], abortSignal);

    expect(promptCoordinator.prompt).toHaveBeenCalledWith(actor, {
      cancellationSignal: abortSignal,
    });
    expect(actionIndexingService.resolve).not.toHaveBeenCalled();
    expect(result).toEqual({
      chosenIndex: 2,
      speech: 'Hello',
      thoughts: 'Thinking aloud',
      notes: ['noteA', 'noteB'],
    });
  });

  it('resolves via actionIndexingService when index is not integer', async () => {
    const abortSignal = {};
    const promptRes = {
      action: { id: 'action-42' },
      speech: 'Speak up',
      thoughts: 'Inner monologue',
      notes: ['noteX'],
    };
    promptCoordinator.prompt.mockResolvedValueOnce(promptRes);
    actionIndexingService.resolve.mockReturnValueOnce({ index: 5 });

    const result = await provider.decide(actor, {}, [], abortSignal);

    expect(promptCoordinator.prompt).toHaveBeenCalledWith(actor, {
      cancellationSignal: abortSignal,
    });
    expect(actionIndexingService.resolve).toHaveBeenCalledWith(
      actor.id,
      'action-42'
    );
    expect(result).toEqual({
      chosenIndex: 5,
      speech: 'Speak up',
      thoughts: 'Inner monologue',
      notes: ['noteX'],
    });
  });
});
