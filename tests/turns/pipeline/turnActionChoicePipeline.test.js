// tests/choicePipeline.spec.js
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { TurnActionChoicePipeline } from '../../../src/turns/pipeline/turnActionChoicePipeline.js';

describe('TurnActionChoicePipeline', () => {
  let discoverySvc;
  let indexer;
  let logger;
  let pipeline;

  beforeEach(() => {
    discoverySvc = { getValidActions: jest.fn() };
    indexer = { index: jest.fn() };
    logger = { debug: jest.fn() };
    pipeline = new TurnActionChoicePipeline({ discoverySvc, indexer, logger });
  });

  test('buildChoices invokes discovery, indexing and returns the indexed array', async () => {
    const actor = { id: 'actor-1' };
    const context = {};
    const rawActions = [{ id: 'act-1' }, { id: 'act-2' }];
    const indexedActions = [
      {
        index: 1,
        actionId: 'act-1',
        commandString: 'cmd1',
        params: {},
        description: '',
      },
    ];

    discoverySvc.getValidActions.mockResolvedValue(rawActions);
    indexer.index.mockReturnValue(indexedActions);

    const result = await pipeline.buildChoices(actor, context);

    // discovery called correctly
    expect(discoverySvc.getValidActions).toHaveBeenCalledWith(actor, context);

    // indexing called with rawActions and actor.id
    expect(indexer.index).toHaveBeenCalledWith(rawActions, actor.id);

    // returns exactly the indexer’s output
    expect(result).toBe(indexedActions);

    // logging
    expect(logger.debug).toHaveBeenCalledWith(
      `[ChoicePipeline] Discovering actions for ${actor.id}`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `[ChoicePipeline] Actor ${actor.id}: ${indexedActions.length} choices ready`
    );
  });
});
