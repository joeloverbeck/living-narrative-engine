import { describe, it, expect, jest } from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

class RecordingLogger {
  constructor() {
    this.calls = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
    this.throwOnError = false;
  }

  debug(...args) {
    this.calls.debug.push(args);
  }

  info(...args) {
    this.calls.info.push(args);
  }

  warn(...args) {
    this.calls.warn.push(args);
  }

  error(...args) {
    this.calls.error.push(args);
    if (this.throwOnError) {
      throw new Error('logger failure');
    }
  }
}

class AsyncRejectingDispatcher {
  dispatch() {
    return Promise.reject(new Error('async failure during dispatch'));
  }

  subscribe() {
    return () => true;
  }

  unsubscribe() {
    return true;
  }

  setBatchMode() {}
}

class SyncThrowingDispatcher {
  dispatch() {
    throw new Error('synchronous dispatch failure');
  }

  subscribe() {
    return () => true;
  }

  unsubscribe() {
    return true;
  }

  setBatchMode() {}
}

class UndefinedUnsubscribeDispatcher {
  dispatch() {
    return true;
  }

  subscribe() {
    return () => true;
  }

  unsubscribe() {
    return undefined;
  }

  setBatchMode() {}
}

describe('SafeEventDispatcher failure recovery edge cases', () => {
  it('falls back to console logging when async dispatch errors and logger fails', async () => {
    const logger = new RecordingLogger();
    logger.throwOnError = true;
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const dispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: new AsyncRejectingDispatcher(),
        logger,
      });

      const result = await dispatcher.dispatch(
        'integration:noncritical-event',
        {
          value: 1,
        }
      );

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'SafeEventDispatcher: Logger failed while handling error in dispatching event'
        ),
        expect.any(Error),
        'Logger error:',
        expect.any(Error)
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('logs directly to the console when synchronous error events fail to dispatch', async () => {
    const logger = new RecordingLogger();
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const dispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: new SyncThrowingDispatcher(),
        logger,
      });

      const outcome = await dispatcher.dispatch(
        'core:system_error_occurred',
        {}
      );

      expect(outcome).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'SafeEventDispatcher: Exception caught while dispatching event'
        ),
        expect.objectContaining({ error: expect.any(Error) })
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('gracefully handles undefined unsubscribe results without logging success messages', () => {
    const logger = new RecordingLogger();
    const dispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: new UndefinedUnsubscribeDispatcher(),
      logger,
    });

    const returnValue = dispatcher.unsubscribe(
      'integration:undefined-unsubscribe',
      () => {}
    );

    expect(returnValue).toBeUndefined();
    expect(
      logger.calls.debug.some(([message]) =>
        message.includes('Successfully unsubscribed')
      )
    ).toBe(false);
  });
});
