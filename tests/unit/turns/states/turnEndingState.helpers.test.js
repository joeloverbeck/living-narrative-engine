import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { TurnEndingState } from '../../../../src/turns/states/turnEndingState.js';
import { UNKNOWN_ACTOR_ID } from '../../../../src/constants/unknownIds.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const makeLogger = () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
});

describe('TurnEndingState helper methods', () => {
  let handler;
  let logger;
  let dispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    dispatcher = { dispatch: jest.fn() };
    handler = {
      getCurrentActor: jest.fn(() => ({ id: 'h-actor' })),
      getLogger: jest.fn(() => logger),
      getTurnContext: jest.fn(() => null),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
    };
  });

  test('_resolveActorId returns provided id', () => {
    const state = new TurnEndingState(handler, 'a1');
    expect(state._resolveActorId('x')).toBe('x');
  });

  test('_resolveActorId falls back to handler actor then unknown', () => {
    const state = new TurnEndingState(handler, null);
    expect(state._resolveActorId(null)).toBe('h-actor');
    handler.getCurrentActor.mockReturnValueOnce(null);
    expect(state._resolveActorId(undefined)).toBe(UNKNOWN_ACTOR_ID);
  });

  test('_notifyMissingActorId dispatches and logs warning', () => {
    const state = new TurnEndingState(handler, null);
    state._notifyMissingActorId(dispatcher, logger, undefined);
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      expect.any(String),
      { providedActorId: null, fallbackActorId: 'h-actor' },
      logger
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Actor ID was missing')
    );
  });

  test('constructor uses helper methods', () => {
    const spyResolve = jest.spyOn(TurnEndingState.prototype, '_resolveActorId');
    const spyNotify = jest.spyOn(
      TurnEndingState.prototype,
      '_notifyMissingActorId'
    );
    new TurnEndingState(handler, null);
    expect(spyResolve).toHaveBeenCalledWith(null);
    expect(spyNotify).toHaveBeenCalled();
  });
});
