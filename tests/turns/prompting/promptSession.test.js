/**
 * @file Unit tests for the (index-based) PromptSession class.
 * @see tests/turns/prompting/promptSession.test.js
 */

/* eslint-env jest */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { PromptSession } from '../../../src/turns/prompting/promptSession.js';
import { PromptError } from '../../../src/errors/promptError.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../../src/constants/eventIds.js';

jest.useRealTimers(); // ← restore real timers

describe('PromptSession', () => {
  /* ─────────── fixtures ─────────── */
  let mockLogger, mockEventBus, mockUnsubscribe, mockIndexer, abortController;
  const actorId = 'player-1';

  const composite = Object.freeze({
    index: 1,
    actionId: 'core:attack',
    commandString: 'attack goblin',
    description: 'Attack',
    params: {},
  });
  const expectedActionShape = {
    id: composite.actionId,
    name: composite.description,
    command: composite.commandString,
    description: composite.description,
    params: composite.params,
  };

  beforeEach(() => {
    mockUnsubscribe = jest.fn();
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockEventBus = { subscribe: jest.fn().mockReturnValue(mockUnsubscribe) };
    mockIndexer = {
      resolve: jest.fn().mockImplementation((_actor, idx) => {
        if (idx === 1) return composite;
        throw new Error('Index not found');
      }),
    };
    abortController = new AbortController();
  });

  /* ───── constructor guards ───── */
  describe('Constructor', () => {
    it('throws if logger is missing', () => {
      expect(
        () =>
          new PromptSession({
            actorId,
            eventBus: mockEventBus,
            logger: null,
            actionIndexingService: mockIndexer,
          })
      ).toThrow('Missing required dependency: logger.');
    });

    it('throws if eventBus is missing', () => {
      expect(
        () =>
          new PromptSession({
            actorId,
            eventBus: null,
            logger: mockLogger,
            actionIndexingService: mockIndexer,
          })
      ).toThrow('Missing required dependency: eventBus.');
    });

    it('throws if actorId is blank', () => {
      expect(
        () =>
          new PromptSession({
            actorId: '',
            eventBus: mockEventBus,
            logger: mockLogger,
            actionIndexingService: mockIndexer,
          })
      ).toThrow('PromptSession: actorId must be a non-empty string.');
    });
  });

  /* ───── run() happy-path ───── */
  describe('run', () => {
    it('resolves with the chosen action (index 1)', async () => {
      const session = new PromptSession({
        actorId,
        eventBus: mockEventBus,
        logger: mockLogger,
        actionIndexingService: mockIndexer,
      });

      const promise = session.run();
      const handler = mockEventBus.subscribe.mock.calls[0][1];

      handler({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: {
          submittedByActorId: actorId,
          index: 1,
          speech: 'For glory!',
        },
      });

      await expect(promise).resolves.toEqual({
        action: expectedActionShape,
        speech: 'For glory!',
        notes: null,
        thoughts: null,
      });
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('returns the same promise on repeated run() calls', () => {
      const s = new PromptSession({
        actorId,
        eventBus: mockEventBus,
        logger: mockLogger,
        actionIndexingService: mockIndexer,
      });
      expect(s.run()).toBe(s.run());
    });
  });

  /* ───── rejection scenarios ───── */
  describe('Rejection Scenarios', () => {
    const makeSession = () =>
      new PromptSession({
        actorId,
        eventBus: mockEventBus,
        logger: mockLogger,
        actionIndexingService: mockIndexer,
      });

    it('rejects on mismatched submittedByActorId', async () => {
      expect.assertions(3);
      const s = makeSession();
      const p = s.run();
      const done = p.catch((e) => e); // attach early!

      mockEventBus.subscribe.mock.calls[0][1]({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { submittedByActorId: 'other', index: 1 },
      });

      const err = await done;
      expect(err).toBeInstanceOf(PromptError);
      expect(err.code).toBe('MISMATCHED_ACTOR');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('rejects on unknown index', async () => {
      expect.assertions(3);
      const s = makeSession();
      const p = s.run();
      const done = p.catch((e) => e); // attach early!

      mockEventBus.subscribe.mock.calls[0][1]({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { submittedByActorId: actorId, index: 99 },
      });

      const err = await done;
      expect(err).toBeInstanceOf(PromptError);
      expect(err.code).toBe('INVALID_INDEX');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('rejects on malformed payload', async () => {
      expect.assertions(3);
      const s = makeSession();
      const p = s.run();
      const done = p.catch((e) => e); // attach early!

      mockEventBus.subscribe.mock.calls[0][1]({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: null,
      });

      const err = await done;
      expect(err).toBeInstanceOf(PromptError);
      expect(err.code).toBe('INVALID_EVENT');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('rejects when abort signal fires', async () => {
      expect.assertions(3);
      const s = new PromptSession({
        actorId,
        eventBus: mockEventBus,
        logger: mockLogger,
        actionIndexingService: mockIndexer,
        abortSignal: abortController.signal,
      });
      const p = s.run();
      const done = p.catch((e) => e); // attach early!

      abortController.abort();

      const err = await done;
      expect(err.message).toBe('Prompt aborted by signal');
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(abortController.signal.aborted).toBe(true);
    });

    it('rejects immediately if signal already aborted', async () => {
      expect.assertions(2);
      abortController.abort();
      const s = new PromptSession({
        actorId,
        eventBus: mockEventBus,
        logger: mockLogger,
        actionIndexingService: mockIndexer,
        abortSignal: abortController.signal,
      });
      await expect(s.run()).rejects.toThrow('Prompt aborted by signal');
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('rejects if subscribe throws', async () => {
      expect.assertions(2);
      const boom = new Error('boop');
      mockEventBus.subscribe.mockImplementation(() => {
        throw boom;
      });

      await expect(
        new PromptSession({
          actorId,
          eventBus: mockEventBus,
          logger: mockLogger,
          actionIndexingService: mockIndexer,
        }).run()
      ).rejects.toHaveProperty('code', 'SUBSCRIPTION_ERROR');

      await expect(
        new PromptSession({
          actorId,
          eventBus: mockEventBus,
          logger: mockLogger,
          actionIndexingService: mockIndexer,
        }).run()
      ).rejects.toBeInstanceOf(PromptError);
    });
  });

  /* ───── cancel() ───── */
  describe('cancel', () => {
    const makeSession = () =>
      new PromptSession({
        actorId,
        eventBus: mockEventBus,
        logger: mockLogger,
        actionIndexingService: mockIndexer,
      });

    it('rejects when cancel() called', async () => {
      expect.assertions(3);
      const s = makeSession();
      const p = s.run();
      const done = p.catch((e) => e); // attach early!

      s.cancel();

      const err = await done;
      expect(err.code).toBe('PROMPT_CANCELLED');
      expect(err).toBeInstanceOf(PromptError);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('passes through custom cancellation error', async () => {
      expect.assertions(1);
      const s = makeSession();
      const p = s.run();
      const custom = new Error('stop');

      const done = p.catch((e) => e);
      s.cancel(custom);

      expect(await done).toBe(custom);
    });

    it('is a no-op after resolution', async () => {
      const s = makeSession();
      const p = s.run();

      mockEventBus.subscribe.mock.calls[0][1]({
        type: PLAYER_TURN_SUBMITTED_ID,
        payload: { submittedByActorId: actorId, index: 1 },
      });

      await p; // resolved
      s.cancel();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      s.cancel(); // still no throw
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  /* ───── cleanup path ───── */
  describe('Cleanup', () => {
    it('logs if unsubscribe throws but swallows error', async () => {
      const boom = new Error('fail');
      mockUnsubscribe.mockImplementation(() => {
        throw boom;
      });

      const s = new PromptSession({
        actorId,
        eventBus: mockEventBus,
        logger: mockLogger,
        actionIndexingService: mockIndexer,
      });
      const p = s.run();
      const done = p.catch((e) => e);

      s.cancel(); // triggers cleanup
      await done;

      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptSession: unsubscribe failed',
        boom
      );
    });
  });
});
