// tests/turns/states/awaitingExternalTurnEndState.test.js

import { AwaitingExternalTurnEndState } from '../../../src/turns/states/awaitingExternalTurnEndState.js';
import { DISPLAY_ERROR_ID } from '../../../src/constants/eventIds.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

describe('AwaitingExternalTurnEndState – action-definition propagation', () => {
  // In the implementation TIMEOUT_MS is 3 000 ms when NODE_ENV === "test"
  const TIMEOUT_MS = 3_000;

  let mockCtx;
  let mockDispatcher;
  let mockHandler;
  let state;
  let mockLogger;

  beforeEach(() => {
    jest.useFakeTimers();

    const noop = () => {};
    mockLogger = {
      debug: jest.fn(noop),
      error: jest.fn(noop),
      warn: jest.fn(noop),
    };

    /* ── turn-context stub ─────────────────────────────────────────────── */
    mockDispatcher = { dispatch: jest.fn() };

    mockCtx = {
      // chosen action exposes ONLY a definitionId (no numeric instance id)
      getChosenActionId: jest.fn().mockReturnValue(undefined),
      getChosenAction: jest.fn().mockReturnValue({
        actionDefinitionId: 'attack',
      }),

      getActor: () => ({ id: 'hero-123' }),
      getSafeEventDispatcher: () => mockDispatcher,
      getSubscriptionManager: () => ({
        subscribeToTurnEnded: jest.fn().mockReturnValue(() => {
          /* unsubscribe noop */
        }),
      }),
      getLogger: () => mockLogger, // <-- FIX: Added missing getLogger method
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn().mockReturnValue(true),
      endTurn: jest.fn(),
    };

    /* ── minimal handler stub ──────────────────────────────────────────── */
    mockHandler = {
      getLogger: () => mockLogger,
      getTurnContext: () => mockCtx,
      _transitionToState: jest.fn(),
      _resetTurnStateAndResources: jest.fn(),
    };

    /* ── state under test ──────────────────────────────────────────────── */
    state = new AwaitingExternalTurnEndState(mockHandler);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('dispatches core:display_error with the *definition* id on timeout', async () => {
    // prime the state
    await state.enterState(mockHandler, /* prev */ null);

    // let the 3 s guard-rail fire
    jest.advanceTimersByTime(TIMEOUT_MS + 1);

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          actorId: 'hero-123',
          actionId: 'attack', // the definition id must be surfaced
          code: 'TURN_END_TIMEOUT',
        }),
      })
    );
  });

  it('prefers getChosenActionId() when both ids are present', async () => {
    mockCtx.getChosenActionId.mockReturnValue('use-potion');
    mockCtx.getChosenAction.mockReturnValue({ actionDefinitionId: 'attack' });

    await state.enterState(mockHandler, null);
    jest.advanceTimersByTime(TIMEOUT_MS + 1);

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({
        details: expect.objectContaining({
          actionId: 'use-potion', // explicit chosenActionId wins
        }),
      })
    );
  });
});
