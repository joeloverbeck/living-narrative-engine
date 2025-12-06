import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { dispatchWithErrorHandling } from '../../../src/utils/eventDispatchHelper.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import * as loggerUtils from '../../../src/utils/loggerUtils.js';
import { safeDispatchError } from '../../../src/utils/staticErrorDispatcher.js';
import { createErrorDetails } from '../../../src/utils/errorDetails.js';

jest.mock('../../../src/utils/loggerUtils.js');
jest.mock('../../../src/utils/staticErrorDispatcher.js', () => ({
  safeDispatchError: jest.fn(),
}));
jest.mock('../../../src/utils/errorDetails.js', () => ({
  createErrorDetails: jest.fn().mockImplementation((message, stack) => ({
    raw: message,
    stack,
    timestamp: 'mock-timestamp',
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dispatchWithErrorHandling', () => {
  it('logs success when dispatcher resolves true', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);

    const result = await dispatchWithErrorHandling(
      dispatcher,
      'evt',
      { foo: 1 },
      logger,
      'ctx'
    );

    expect(result).toBe(true);
    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(
      logger,
      'dispatchWithErrorHandling'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith('evt', { foo: 1 });
    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      "dispatchWithErrorHandling: Attempting dispatch: ctx ('evt')"
    );
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      'dispatchWithErrorHandling: Dispatch successful for ctx.'
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(safeDispatchError).not.toHaveBeenCalled();
    expect(createErrorDetails).not.toHaveBeenCalled();
  });

  it('logs warning when dispatcher returns false', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(false) };
    const logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);

    const result = await dispatchWithErrorHandling(
      dispatcher,
      'evt',
      { bar: 2 },
      logger,
      'ctx'
    );

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'dispatchWithErrorHandling: SafeEventDispatcher reported failure for ctx'
      )
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
    expect(createErrorDetails).not.toHaveBeenCalled();
  });

  it('safely stringifies circular payloads when dispatcher returns false', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(false) };
    const logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);

    const payload = {};
    payload.self = payload;

    const result = await dispatchWithErrorHandling(
      dispatcher,
      'evt',
      payload,
      logger,
      'ctx'
    );

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Circular]')
    );
    expect(safeDispatchError).not.toHaveBeenCalled();
    expect(createErrorDetails).not.toHaveBeenCalled();
  });

  it('handles exception by logging and dispatching system error', async () => {
    const error = new Error('boom');
    const dispatcher = { dispatch: jest.fn().mockRejectedValue(error) };
    const logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);

    const result = await dispatchWithErrorHandling(
      dispatcher,
      'evt',
      { baz: 3 },
      logger,
      'ctx'
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'dispatchWithErrorHandling: CRITICAL - Error during dispatch for ctx. Error: boom',
      error
    );
    expect(createErrorDetails).toHaveBeenCalledWith(
      'Exception in dispatch for evt',
      error.stack
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'System error during event dispatch.',
      {
        raw: 'Exception in dispatch for evt',
        stack: error.stack,
        timestamp: 'mock-timestamp',
      },
      logger
    );
  });

  it('uses fallback stack when dispatcher error lacks stack trace', async () => {
    const dispatcherError = { message: 'stackless failure', stack: '' };
    const dispatcher = {
      dispatch: jest.fn().mockRejectedValue(dispatcherError),
    };
    const logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);

    const result = await dispatchWithErrorHandling(
      dispatcher,
      'evt',
      { id: 42 },
      logger,
      'ctx'
    );

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'dispatchWithErrorHandling: CRITICAL - Error during dispatch for ctx. Error: stackless failure',
      dispatcherError
    );
    expect(createErrorDetails).toHaveBeenCalledWith(
      'Exception in dispatch for evt',
      expect.any(String)
    );
    const [, stackArg] = createErrorDetails.mock.calls[0];
    expect(stackArg).not.toBe(dispatcherError.stack);
    expect(stackArg).not.toBe('');
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'System error during event dispatch.',
      {
        raw: 'Exception in dispatch for evt',
        stack: stackArg,
        timestamp: 'mock-timestamp',
      },
      logger
    );
  });
});
