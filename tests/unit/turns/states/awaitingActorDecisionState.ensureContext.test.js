import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AwaitingActorDecisionState } from '../../../../src/turns/states/awaitingActorDecisionState.js';

const makeLogger = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('AwaitingActorDecisionState._ensureContext', () => {
  let logger;
  let ctx;
  let handler;
  let state;

  beforeEach(() => {
    logger = makeLogger();
    ctx = {
      getLogger: () => logger,
      getActor: jest.fn(() => ({ id: 'a1' })),
      requestProcessingCommandStateTransition: jest.fn(),
      endTurn: jest.fn().mockResolvedValue(undefined),
    };
    handler = {
      getLogger: jest.fn(() => logger),
      getTurnContext: jest.fn(() => ctx),
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
    };
    state = new AwaitingActorDecisionState(handler);
  });

  test('calls endTurn when required methods are missing', async () => {
    const result = await state._ensureContext('missing');
    expect(result).toBeNull();
    const expectedMsg =
      'AwaitingActorDecisionState: ITurnContext missing required methods: getStrategy';
    expect(logger.error).toHaveBeenCalledWith(expectedMsg);
    expect(ctx.endTurn).toHaveBeenCalledWith(expect.any(Error));
    expect(handler.resetStateAndResources).not.toHaveBeenCalled();
  });
});
