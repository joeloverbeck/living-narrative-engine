/**
 * @file Integration tests covering the legacy static error dispatcher bridge.
 * @description Ensures the static facade forwards to EventDispatchService using
 * real dispatcher implementations without relying on mocks of the production
 * modules themselves.
 */

import {
  StaticErrorDispatcher,
  safeDispatchError,
  dispatchSystemErrorEvent,
  dispatchValidationError as dispatchValidationErrorFn,
} from '../../../src/utils/staticErrorDispatcher.js';
import { InvalidDispatcherError } from '../../../src/utils/eventDispatchService.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

/**
 * Creates a logger instance recognised by ensureValidLogger.
 *
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger}
 */
function createTestLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('StaticErrorDispatcher integration', () => {
  it('dispatchError emits a system error event using the underlying dispatcher', () => {
    const dispatched = [];
    const dispatcher = {
      dispatch: jest.fn((eventName, payload) => {
        dispatched.push({ eventName, payload });
      }),
    };
    const logger = createTestLogger();

    StaticErrorDispatcher.dispatchError(
      dispatcher,
      'Critical failure encountered',
      { scenario: 'sync' },
      logger
    );

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatched).toEqual([
      {
        eventName: SYSTEM_ERROR_OCCURRED_ID,
        payload: {
          message: 'Critical failure encountered',
          details: { scenario: 'sync' },
        },
      },
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('dispatchError falls back to console logging when supplied logger is invalid', () => {
    const failingDispatcher = {
      dispatch: jest.fn(() => {
        throw new Error('dispatcher exploded');
      }),
    };
    const invalidLogger = /** @type {any} */ ({ info: () => {} });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() =>
        StaticErrorDispatcher.dispatchError(
          failingDispatcher,
          'Unable to deliver event',
          { phase: 'fallback' },
          invalidLogger
        )
      ).not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        'StaticErrorDispatcher.dispatchError: ',
        'An invalid logger instance was provided. Falling back to console logging with prefix "StaticErrorDispatcher.dispatchError".'
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'StaticErrorDispatcher.dispatchError: ',
        'Failed to dispatch system error event: Unable to deliver event',
        expect.objectContaining({
          originalDetails: { phase: 'fallback' },
          dispatchError: expect.any(Error),
        })
      );
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('dispatchError throws InvalidDispatcherError when dispatcher is missing dispatch()', () => {
    const logger = createTestLogger();
    expect(() =>
      StaticErrorDispatcher.dispatchError(
        /** @type {any} */ ({}),
        'Missing dispatcher',
        { reason: 'no-dispatch' },
        logger
      )
    ).toThrow(InvalidDispatcherError);
  });

  it('dispatchErrorAsync handles rejected dispatcher promises and logs failure details', async () => {
    const rejection = new Error('network outage');
    const dispatcher = {
      dispatch: jest.fn(() => Promise.reject(rejection)),
    };
    const logger = createTestLogger();

    await StaticErrorDispatcher.dispatchErrorAsync(
      dispatcher,
      'Async meltdown',
      { stage: 'async' },
      logger
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Async meltdown',
      details: { stage: 'async' },
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to dispatch system error event: Async meltdown',
      expect.objectContaining({
        originalDetails: { stage: 'async' },
        dispatchError: rejection,
      })
    );
  });

  it('dispatchValidationError returns a structured failure object and emits a system error', () => {
    const dispatcher = {
      dispatch: jest.fn(() => true),
    };
    const logger = createTestLogger();

    const result = StaticErrorDispatcher.dispatchValidationError(
      dispatcher,
      'Validation failed',
      { field: 'name' },
      logger
    );

    expect(result).toEqual({
      ok: false,
      error: 'Validation failed',
      details: { field: 'name' },
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Validation failed',
      details: { field: 'name' },
    });
  });

  it('dispatchValidationError throws when dispatcher is invalid', () => {
    expect(() =>
      StaticErrorDispatcher.dispatchValidationError(
        /** @type {any} */ ({}),
        'Cannot emit validation error',
        { severity: 'high' },
        createTestLogger()
      )
    ).toThrow(InvalidDispatcherError);
  });

  it('safeDispatchError delegates to the static dispatcher helper', () => {
    const dispatcher = {
      dispatch: jest.fn(),
    };

    safeDispatchError(dispatcher, 'Legacy bridge');

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Legacy bridge',
      details: {},
    });
  });

  it('dispatchSystemErrorEvent resolves even when the dispatcher returns synchronously', async () => {
    const dispatcher = {
      dispatch: jest.fn(() => undefined),
    };

    await expect(
      dispatchSystemErrorEvent(
        dispatcher,
        'Async pathway',
        { attempt: 1 },
        createTestLogger()
      )
    ).resolves.toBeUndefined();

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Async pathway',
      details: { attempt: 1 },
    });
  });

  it('dispatchError uses an empty details object when none is provided', () => {
    const dispatcher = {
      dispatch: jest.fn(() => true),
    };
    const logger = createTestLogger();

    StaticErrorDispatcher.dispatchError(
      dispatcher,
      'Default details branch',
      undefined,
      logger
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Default details branch',
      details: {},
    });
  });

  it('dispatchValidationError wrapper omits details when not provided', () => {
    const dispatcher = {
      dispatch: jest.fn(() => true),
    };

    const result = dispatchValidationErrorFn(dispatcher, 'Missing details');

    expect(result).toEqual({ ok: false, error: 'Missing details' });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Missing details',
      details: {},
    });
  });
});
