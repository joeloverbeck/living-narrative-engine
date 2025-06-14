// tests/choicePipeline.spec.js
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { TurnActionChoicePipeline } from '../../../src/turns/pipeline/turnActionChoicePipeline.js';

describe('TurnActionChoicePipeline', () => {
  let provider;
  let logger;
  let pipeline;

  beforeEach(() => {
    provider = { get: jest.fn() };
    logger = { debug: jest.fn() };
    pipeline = new TurnActionChoicePipeline({
      availableActionsProvider: provider,
      logger,
    });
  });

  test('buildChoices invokes discovery, indexing and returns the indexed array', async () => {
    const actor = { id: 'actor-1' };
    const context = {};
    const indexedActions = [
      {
        index: 1,
        actionId: 'act-1',
        commandString: 'cmd1',
        params: {},
        description: '',
      },
    ];

    provider.get.mockResolvedValue(indexedActions);

    const result = await pipeline.buildChoices(actor, context);

    // provider called correctly
    expect(provider.get).toHaveBeenCalledWith(actor, context, logger);

    // returns exactly the provider's output
    expect(result).toBe(indexedActions);

    // logging
    expect(logger.debug).toHaveBeenCalledWith(
      `[ChoicePipeline] Fetching actions for ${actor.id}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `[ChoicePipeline] Actor ${actor.id}: ${indexedActions.length} choices ready`
    );
  });
});
