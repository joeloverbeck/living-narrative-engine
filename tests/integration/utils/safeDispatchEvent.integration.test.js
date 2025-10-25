import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { safeDispatchEvent } from '../../../src/utils/safeDispatchEvent.js';

class MemoryLogger {
  constructor() {
    this.entries = {
      info: [],
      warn: [],
      error: [],
      debug: [],
    };
  }

  info(message, metadata) {
    this.entries.info.push({ message, metadata });
  }

  warn(message, metadata) {
    this.entries.warn.push({ message, metadata });
  }

  error(message, metadata) {
    this.entries.error.push({ message, metadata });
  }

  debug(message, metadata) {
    this.entries.debug.push({ message, metadata });
  }
}

class RecordingDispatcher {
  constructor({ shouldFail = false, errorFactory = () => new Error('dispatch failed') } = {}) {
    this.calls = [];
    this.shouldFail = shouldFail;
    this.errorFactory = errorFactory;
  }

  async dispatch(eventId, payload, options) {
    this.calls.push({ eventId, payload, options });
    if (this.shouldFail) {
      throw this.errorFactory();
    }
    return true;
  }
}

describe('safeDispatchEvent integration', () => {
  let logger;

  beforeEach(() => {
    logger = new MemoryLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a warning and exits early when dispatcher is unavailable', async () => {
    await safeDispatchEvent(null, 'story:missing-dispatcher', { foo: 'bar' }, logger);

    expect(logger.entries.warn).toEqual([
      {
        message: 'SafeEventDispatcher unavailable for story:missing-dispatcher',
        metadata: undefined,
      },
    ]);
    expect(logger.entries.debug).toHaveLength(0);
    expect(logger.entries.error).toHaveLength(0);
  });

  it('dispatches events and records debug output when dispatcher succeeds', async () => {
    const dispatcher = new RecordingDispatcher();
    const payload = { important: true, detail: 'bridge status' };

    await safeDispatchEvent(
      dispatcher,
      'system:status-updated',
      payload,
      logger
    );

    expect(dispatcher.calls).toEqual([
      {
        eventId: 'system:status-updated',
        payload,
        options: undefined,
      },
    ]);
    expect(logger.entries.debug).toEqual([
      {
        message: 'Dispatched system:status-updated',
        metadata: { payload },
      },
    ]);
    expect(logger.entries.error).toHaveLength(0);
  });

  it('falls back to console logging when logger is invalid and captures dispatcher failures', async () => {
    const dispatcher = new RecordingDispatcher({
      shouldFail: true,
      errorFactory: () => new Error('network unreachable'),
    });
    const partialLogger = {
      warn: () => {},
    };

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      safeDispatchEvent(
        dispatcher,
        'system:critical-alert',
        { severity: 'high' },
        partialLogger
      )
    ).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'safeDispatchEvent: ',
      'An invalid logger instance was provided. Falling back to console logging with prefix "safeDispatchEvent".'
    );
    const errorCall = consoleErrorSpy.mock.calls[0];
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'safeDispatchEvent: ',
      'Failed to dispatch system:critical-alert',
      expect.any(Error)
    );
    const dispatchedError = errorCall[2];
    expect(dispatchedError).toBeInstanceOf(Error);
    expect(dispatchedError.message).toBe('network unreachable');
  });

  it('passes through dispatcher options when provided', async () => {
    const dispatcher = new RecordingDispatcher();
    const payload = { important: true };
    const options = { allowSchemaNotFound: true };

    await safeDispatchEvent(
      dispatcher,
      'system:with-options',
      payload,
      logger,
      options
    );

    expect(dispatcher.calls).toEqual([
      {
        eventId: 'system:with-options',
        payload,
        options,
      },
    ]);
    expect(logger.entries.debug).toEqual([
      {
        message: 'Dispatched system:with-options',
        metadata: { payload, options },
      },
    ]);
  });
});
