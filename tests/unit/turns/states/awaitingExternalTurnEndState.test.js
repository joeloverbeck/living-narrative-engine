// tests/turns/states/awaitingExternalTurnEndState.test.js
// ****** MODIFIED FILE ******

import { jest } from '@jest/globals';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

import { AwaitingExternalTurnEndState } from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('AwaitingExternalTurnEndState – action propagation', () => {
  // In the implementation TIMEOUT_MS is 3 000 ms when NODE_ENV === "test"
  const TIMEOUT_MS = 3_000;

  let mockCtx;
  let mockSafeEventDispatcher; // Renamed for clarity
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
    // MODIFIED: This now mocks the full ISafeEventDispatcher interface needed by the SUT
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {
        /* mock unsubscribe fn */
      }),
    };

    mockCtx = {
      // chosen action exposes ONLY a definitionId (no numeric instance id)
      getChosenActionId: jest.fn().mockReturnValue(undefined),
      getChosenAction: jest.fn().mockReturnValue({
        actionDefinitionId: 'attack',
      }),

      getActor: () => ({ id: 'hero-123' }),
      // MODIFIED: Returns the more complete mock dispatcher
      getSafeEventDispatcher: () => mockSafeEventDispatcher,
      // REMOVED: Obsolete mock for getSubscriptionManager
      getLogger: () => mockLogger,
      setAwaitingExternalEvent: jest.fn(),
      isAwaitingExternalEvent: jest.fn().mockReturnValue(true),
      endTurn: jest.fn(),
    };

    /* ── minimal handler stub ──────────────────────────────────────────── */
    mockHandler = {
      getLogger: () => mockLogger,
      getTurnContext: () => mockCtx,
      resetStateAndResources: jest.fn(),
      requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
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

  it('dispatches core:system_error_occurred with the *definition* id on timeout', async () => {
    // prime the state
    await state.enterState(mockHandler, /* prev */ null);

    // let the 3 s guard-rail fire
    jest.advanceTimersByTime(TIMEOUT_MS + 1);

    expect(safeDispatchError).toHaveBeenCalledWith(
      mockSafeEventDispatcher,
      expect.stringContaining('No rule ended the turn for actor hero-123'),
      expect.objectContaining({
        actorId: 'hero-123',
        actionId: 'attack',
        code: 'TURN_END_TIMEOUT',
      })
    );
  });

  it('prefers getChosenActionId() when both ids are present', async () => {
    mockCtx.getChosenActionId.mockReturnValue('use-potion');
    mockCtx.getChosenAction.mockReturnValue({ actionDefinitionId: 'attack' });

    await state.enterState(mockHandler, null);
    jest.advanceTimersByTime(TIMEOUT_MS + 1);

    expect(safeDispatchError).toHaveBeenCalledWith(
      mockSafeEventDispatcher,
      expect.any(String),
      expect.objectContaining({
        actionId: 'use-potion',
      })
    );
  });
});
