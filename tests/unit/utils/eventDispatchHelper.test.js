import { describe, it, expect, jest } from '@jest/globals';
import { dispatchWithErrorHandling } from '../../../src/utils/eventDispatchHelper.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import * as loggerUtils from '../../../src/utils/loggerUtils.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/loggerUtils.js');
jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

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
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'System error during event dispatch.',
      expect.any(Object),
      logger
    );
  });
});
