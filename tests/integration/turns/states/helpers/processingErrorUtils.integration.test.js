import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  resetProcessingFlags,
  finishProcessing,
  resolveLogger,
  dispatchSystemError,
} from '../../../../../src/turns/states/helpers/processingErrorUtils.js';
import { ProcessingGuard } from '../../../../../src/turns/states/helpers/processingGuard.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../../src/constants/systemEventIds.js';

class CollectingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, ...args) {
    this.debugEntries.push({ message, args });
  }

  info(message, ...args) {
    this.infoEntries.push({ message, args });
  }

  warn(message, ...args) {
    this.warnEntries.push({ message, args });
  }

  error(message, ...args) {
    this.errorEntries.push({ message, args });
  }

  // ConsoleLogger compatible no-op methods
  groupCollapsed() {}

  groupEnd() {}

  table() {}

  setLogLevel() {}
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    return true;
  }
}

class ThrowingDispatcher {
  dispatch() {
    throw new Error('dispatch failed');
  }
}

describe('processingErrorUtils integration', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = null;
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
      consoleErrorSpy = null;
    }
  });

  describe('resetProcessingFlags and finishProcessing', () => {
    it('resets processing state using an explicit finishProcessing method', () => {
      const state = {
        isProcessing: true,
        finishInvocations: 0,
        finishProcessing() {
          this.finishInvocations += 1;
          this.isProcessing = false;
        },
      };

      const wasProcessing = resetProcessingFlags(state);

      expect(wasProcessing).toBe(true);
      expect(state.isProcessing).toBe(false);
      expect(state.finishInvocations).toBe(1);
    });

    it('marks processing as finished via ProcessingGuard when available', () => {
      const owner = {
        isProcessing: true,
        transitions: [],
        _setProcessing(value) {
          this.isProcessing = value;
          this.transitions.push(value);
        },
      };
      owner._processingGuard = new ProcessingGuard(owner);

      finishProcessing(owner);

      expect(owner.isProcessing).toBe(false);
      expect(owner.transitions).toEqual([false]);
    });

    it('uses legacy _setProcessing flag when guard is missing', () => {
      const state = {
        isProcessing: true,
        calls: [],
        _setProcessing(value) {
          this.isProcessing = value;
          this.calls.push(value);
        },
      };

      finishProcessing(state);

      expect(state.isProcessing).toBe(false);
      expect(state.calls).toEqual([false]);
    });

    it('falls back to toggling _isProcessing when no helpers exist', () => {
      const legacyState = { _isProcessing: true };

      finishProcessing(legacyState);

      expect(legacyState._isProcessing).toBe(false);
    });
  });

  describe('resolveLogger', () => {
    it('extracts logger and actor id from a valid turn context', () => {
      const logger = new CollectingLogger();
      const state = { getStateName: () => 'TestState' };
      const turnCtx = {
        getLogger: () => logger,
        getActor: () => ({ id: 'actor-123' }),
      };

      const result = resolveLogger(state, turnCtx, 'fallback-actor');

      expect(result.logger).toBe(logger);
      expect(result.actorId).toBe('actor-123');
    });

    it('falls back to console logging when context is invalid', () => {
      const state = { getStateName: () => 'ErrorState' };
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = resolveLogger(state, null, 'missing-actor');

      expect(result.logger).toBe(console);
      expect(result.actorId).toBe('missing-actor');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'ErrorState: Critical error - turnCtx is invalid in resolveLogger.'
        )
      );
    });
  });

  describe('dispatchSystemError', () => {
    it('dispatches a standardized system error event', () => {
      const dispatcher = new RecordingDispatcher();
      const logger = new CollectingLogger();
      const error = new Error('boom');

      expect(() =>
        dispatchSystemError(dispatcher, logger, 'StateName', 'actor-777', error)
      ).not.toThrow();

      expect(dispatcher.events).toHaveLength(1);
      const event = dispatcher.events[0];
      expect(event.eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
      expect(event.payload).toMatchObject({
        message: expect.stringContaining('StateName'),
      });
      expect(event.payload.details).toMatchObject({
        raw: expect.stringContaining('boom'),
        stack: expect.any(String),
      });
      expect(logger.warnEntries).toHaveLength(0);
      expect(logger.errorEntries).toHaveLength(0);
    });

    it('logs an error when dispatching fails unexpectedly', () => {
      const dispatcher = new ThrowingDispatcher();
      const logger = new CollectingLogger();

      expect(() =>
        dispatchSystemError(
          dispatcher,
          logger,
          'StateName',
          'actor-999',
          new Error('fail')
        )
      ).not.toThrow();

      expect(logger.errorEntries).toHaveLength(1);
      expect(logger.errorEntries[0].message).toContain(
        'safeDispatchError: Failed to dispatch core:system_error_occurred.'
      );
    });

    it('warns when the dispatcher is not available', () => {
      const logger = new CollectingLogger();

      dispatchSystemError(
        null,
        logger,
        'StateName',
        'actor-404',
        new Error('missing dispatcher')
      );

      expect(logger.warnEntries).toHaveLength(1);
      expect(logger.warnEntries[0].message).toContain(
        'SafeEventDispatcher not available'
      );
    });
  });
});
