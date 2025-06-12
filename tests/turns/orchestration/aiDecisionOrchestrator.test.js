// File: tests/turns/orchestration/aiDecisionOrchestrator.test.js
import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { AIDecisionOrchestrator } from '../../../src/turns/orchestration/aiDecisionOrchestrator.js';
import {
  NoActionsDiscoveredError,
  InvalidIndexError,
} from '../../../src/turns/errors';

describe('AIDecisionOrchestrator', () => {
  let discoverySvc,
    indexer,
    llmChooser,
    turnActionFactory,
    fallbackFactory,
    logger,
    orchestrator;

  beforeEach(() => {
    discoverySvc = { getValidActions: jest.fn() };
    indexer = { index: jest.fn() };
    llmChooser = { choose: jest.fn() };
    turnActionFactory = { create: jest.fn() };
    fallbackFactory = { create: jest.fn() };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    orchestrator = new AIDecisionOrchestrator({
      discoverySvc,
      indexer,
      llmChooser,
      turnActionFactory,
      fallbackFactory,
      logger,
    });
  });

  it('happy path: returns success with correct action and speech', async () => {
    const actor = { id: 'actor1' };
    const context = { getPromptSignal: jest.fn() };
    const discovered = [
      {
        /*…*/
      },
    ];
    const indexed = [{ actionId: 'A', params: {}, commandString: 'cmd' }];

    discoverySvc.getValidActions.mockResolvedValue(discovered);
    indexer.index.mockReturnValue(indexed);
    llmChooser.choose.mockResolvedValue({ index: 1, speech: 'hello!' });

    const fakeAction = {
      actionDefinitionId: 'A',
      resolvedParameters: {},
      commandString: 'cmd',
      speech: 'hello!',
    };
    turnActionFactory.create.mockReturnValue(fakeAction);

    const result = await orchestrator.decide({ actor, context });
    expect(result.kind).toBe('success');
    expect(result.action).toBe(fakeAction);
    expect(result.extractedData).toEqual({ speech: 'hello!' });
  });

  it('no-actions path: throws NoActionsDiscoveredError', async () => {
    const actor = { id: 'actor2' };
    const context = { getPromptSignal: jest.fn() };

    discoverySvc.getValidActions.mockResolvedValue([]);
    indexer.index.mockReturnValue([]);

    await expect(orchestrator.decide({ actor, context })).rejects.toThrow(
      NoActionsDiscoveredError
    );
  });

  it('invalid-index path: throws InvalidIndexError', async () => {
    const actor = { id: 'actor3' };
    const context = { getPromptSignal: jest.fn() };
    const discovered = [
      {
        /*…*/
      },
    ];
    const indexed = [
      {
        /*…*/
      },
    ];

    discoverySvc.getValidActions.mockResolvedValue(discovered);
    indexer.index.mockReturnValue(indexed);
    llmChooser.choose.mockResolvedValue({ index: 2, speech: null });

    await expect(orchestrator.decide({ actor, context })).rejects.toThrow(
      InvalidIndexError
    );
  });

  it('fallback path: decideOrFallback wraps errors into fallback decision', async () => {
    const actor = { id: 'actor4' };
    const context = { getPromptSignal: jest.fn() };
    const err = new Error('oops');

    orchestrator.decide = jest.fn().mockRejectedValue(err);

    const fakeFbAction = { actionDefinitionId: 'FB' };
    fallbackFactory.create.mockReturnValue(fakeFbAction);

    const result = await orchestrator.decideOrFallback({ actor, context });
    expect(result.kind).toBe('fallback');
    expect(result.action).toBe(fakeFbAction);
    expect(result.extractedData).toEqual({ speech: null });
  });
});
