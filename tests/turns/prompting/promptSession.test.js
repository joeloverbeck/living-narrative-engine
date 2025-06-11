/**
 * @file Unit tests for the PromptSession class.
 * @see tests/turns/prompting/promptSession.test.js
 */

// ──────────── Imports ────────────
import { jest, describe, beforeEach, expect } from '@jest/globals';
import { PromptSession } from '../../../src/turns/prompting/promptSession.js';
import { PromptError } from '../../../src/errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';

// ──────────── Setup ────────────

// Per ticket requirements, use fake timers.
jest.useFakeTimers();

describe('PromptSession', () => {
  // ──── Test Fixtures ────
  let mockLogger;
  let mockEventBus;
  let mockUnsubscribe;
  let actions;
  let actorId;
  let abortController;

  // ──── Test Hooks ────
  beforeEach(() => {
    // Reset mocks before each test
    mockUnsubscribe = jest.fn();
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockEventBus = {
      // Per ticket, subscribe returns a stub unsubscribe function
      subscribe: jest.fn().mockReturnValue(mockUnsubscribe),
    };
    actorId = 'player-1';
    actions = [
      { id: 'action-1', name: 'Attack', params: {} },
      { id: 'action-2', name: 'Defend', params: {} },
    ];
    abortController = new AbortController();
  });

  // ──────────── Constructor Tests ────────────

  describe('Constructor', () => {
    it('should throw an error if logger is missing or invalid', () => {
      expect(
        () =>
          new PromptSession({
            actorId,
            actions,
            eventBus: mockEventBus,
            logger: null,
          })
      ).toThrow('Missing required dependency: logger.');
    });

    it('should throw an error if eventBus is missing or invalid', () => {
      expect(
        () =>
          new PromptSession({
            actorId,
            actions,
            eventBus: null,
            logger: mockLogger,
          })
      ).toThrow('Missing required dependency: eventBus.');
    });

    it('should throw an error if actorId is not a non-empty string', () => {
      expect(
        () =>
          new PromptSession({
            actorId: '',
            actions,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow('PromptSession: actorId must be a non-empty string.');
    });

    it('should throw an error if actions is not an array', () => {
      expect(
        () =>
          new PromptSession({
            actorId,
            actions: null,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow('PromptSession: actions must be an array.');
    });
  });

  // ──────────── Core Functionality Tests ────────────

  describe('run', () => {
    it('✅ should resolve with the chosen action on a valid event (Happy Path)', async () => {
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      // Capture the event handler passed to subscribe
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      const selectedAction = actions[0];
      const speech = 'For glory!';

      // Simulate the event being dispatched
      eventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          submittedByActorId: actorId,
          actionId: selectedAction.id,
          speech,
        },
      });

      // Assert the promise resolves correctly
      await expect(promise).resolves.toEqual({
        action: selectedAction,
        speech,
      });

      // Assert cleanup was performed exactly once
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should return the same promise if run() is called multiple times', () => {
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise1 = session.run();
      const promise2 = session.run();
      expect(promise1).toBe(promise2);
    });
  });

  // ──────────── Rejection Scenario Tests ────────────

  describe('Rejection Scenarios', () => {
    it('✅ should reject on mismatched submittedByActorId', async () => {
      expect.assertions(3); // Expecting reject, error check, and unsubscribe check
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      eventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          submittedByActorId: 'some-other-actor', // Mismatched ID
          actionId: actions[0].id,
        },
      });

      await expect(promise).rejects.toThrow(PromptError);
      await expect(promise).rejects.toHaveProperty('code', 'MISMATCHED_ACTOR');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('✅ should reject on an unknown actionId', async () => {
      expect.assertions(3);
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      eventHandler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          submittedByActorId: actorId,
          actionId: 'unknown-action-id', // Unknown ID
        },
      });

      await expect(promise).rejects.toThrow(PromptError);
      await expect(promise).rejects.toHaveProperty('code', 'INVALID_ACTION_ID');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('✅ should reject on a malformed event envelope (null payload)', async () => {
      expect.assertions(3);
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      eventHandler({ type: PLAYER_TURN_SUBMITTED_ID, payload: null }); // Malformed

      await expect(promise).rejects.toThrow(PromptError);
      await expect(promise).rejects.toHaveProperty('code', 'INVALID_EVENT');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('✅ should reject when the abort signal is fired', async () => {
      expect.assertions(3);
      const abortSignal = abortController.signal;
      const removeListenerSpy = jest.spyOn(abortSignal, 'removeEventListener');

      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
        abortSignal,
      });
      const promise = session.run();

      abortController.abort(); // Fire the signal

      // --- CHANGE START ---
      // Updated the expected error message to match the PromptError thrown by the session.
      await expect(promise).rejects.toThrow('Prompt aborted by signal');
      // --- CHANGE END ---

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      // ✅ Assert abort-listener removed exactly once
      expect(removeListenerSpy).toHaveBeenCalledWith(
        'abort',
        expect.any(Function)
      );
    });

    it('should reject immediately if signal is already aborted', async () => {
      expect.assertions(2);
      abortController.abort(); // Abort BEFORE creating the session
      const abortSignal = abortController.signal;

      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
        abortSignal,
      });
      const promise = session.run();

      // --- CHANGE START ---
      // Updated the expected error message here as well.
      await expect(promise).rejects.toThrow('Prompt aborted by signal');
      // --- CHANGE END ---

      // Unsubscribe shouldn't even have been set up
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should reject if eventBus.subscribe throws an error', async () => {
      expect.assertions(2);
      const subscribeError = new Error('Subscription failed!');
      mockEventBus.subscribe.mockImplementation(() => {
        throw subscribeError;
      });

      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      await expect(promise).rejects.toThrow(PromptError);
      await expect(promise).rejects.toHaveProperty(
        'code',
        'SUBSCRIPTION_ERROR'
      );
    });
  });

  // ──────────── Cancellation Tests ────────────

  describe('cancel', () => {
    it('✅ should reject the promise when cancel() is called', async () => {
      expect.assertions(3);
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      session.cancel(); // External cancellation

      await expect(promise).rejects.toThrow(PromptError);
      await expect(promise).rejects.toHaveProperty('code', 'PROMPT_CANCELLED');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should allow a custom reason for cancellation', async () => {
      expect.assertions(1);
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();
      const customError = new Error('Custom cancellation reason');

      session.cancel(customError);

      await expect(promise).rejects.toBe(customError);
    });

    it('✅ should be a no-op if called after the promise is already resolved (double cancel)', async () => {
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      // Resolve the promise
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      eventHandler({
        payload: { actionId: actions[0].id, submittedByActorId: actorId },
      });

      await expect(promise).resolves.toBeDefined();

      // Now, call cancel() and expect it not to throw or cause issues
      expect(() => session.cancel()).not.toThrow();

      // The unsubscribe function should still have only been called once
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

      // A second cancel call should also do nothing
      expect(() => session.cancel()).not.toThrow();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────── Cleanup Tests ────────────

  describe('Cleanup', () => {
    it('should log an error if unsubscribe fails but not throw', async () => {
      const unsubscribeError = new Error('Failed to unsubscribe!');
      mockUnsubscribe.mockImplementation(() => {
        throw unsubscribeError;
      });
      const session = new PromptSession({
        actorId,
        actions,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      const promise = session.run();

      // Cancel to trigger cleanup
      session.cancel();

      await expect(promise).rejects.toBeInstanceOf(Error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptSession: Error during event unsubscribe.',
        unsubscribeError
      );
    });
  });
});
