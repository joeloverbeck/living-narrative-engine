import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import createSafeErrorLogger from '../../../src/utils/safeErrorLogger.js';

describe('SafeErrorLogger.withGameLoadingMode cleanup', () => {
  let mockLogger;
  let mockDispatcher;
  let safeErrorLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDispatcher = {
      setBatchMode: jest.fn(),
      dispatch: jest.fn().mockResolvedValue(true),
    };

    safeErrorLogger = createSafeErrorLogger({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
  });

  it('forces batch mode cleanup when nested loading contexts leak', async () => {
    await safeErrorLogger.withGameLoadingMode(
      async () => {
        safeErrorLogger.enableGameLoadingMode({
          context: 'nested-operation',
          timeoutMs: 0,
        });
        // Intentionally omit disableGameLoadingMode to simulate a leak.
      },
      {
        context: 'outer-operation',
        timeoutMs: 0,
      }
    );

    expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
    const setBatchModeCalls = mockDispatcher.setBatchMode.mock.calls;
    expect(setBatchModeCalls[setBatchModeCalls.length - 1][0]).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'SafeErrorLogger: Game loading mode still active after scope exit. Forcing batch mode disable to prevent leaks.',
      { context: 'outer-operation' }
    );
  });

  it('preserves outer loading context when nested mode exits cleanly', async () => {
    await safeErrorLogger.withGameLoadingMode(
      async () => {
        await safeErrorLogger.withGameLoadingMode(
          async () => {
            expect(safeErrorLogger.isGameLoadingActive()).toBe(true);
          },
          {
            context: 'inner-operation',
            timeoutMs: 0,
          }
        );

        expect(safeErrorLogger.isGameLoadingActive()).toBe(true);
      },
      {
        context: 'outer-operation',
        timeoutMs: 0,
      }
    );

    expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('logs cleanup failure but preserves the original error when disabling batch mode fails', async () => {
    const operationError = new Error('operation failed');
    const disableFailure = new Error('disable failed');

    mockDispatcher.setBatchMode.mockImplementation((enable) => {
      if (!enable) {
        throw disableFailure;
      }
    });

    await expect(
      safeErrorLogger.withGameLoadingMode(
        async () => {
          throw operationError;
        },
        { context: 'failing-operation', timeoutMs: 0 }
      )
    ).rejects.toBe(operationError);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'SafeErrorLogger: Failed to disable game loading mode during cleanup.',
      disableFailure
    );
  });

  it('rethrows cleanup failures when no prior error occurred', async () => {
    const disableFailure = new Error('disable failed');
    mockDispatcher.setBatchMode.mockImplementation((enable) => {
      if (!enable) {
        throw disableFailure;
      }
    });

    await expect(
      safeErrorLogger.withGameLoadingMode(
        async () => {},
        { context: 'success-operation', timeoutMs: 0 }
      )
    ).rejects.toBe(disableFailure);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'SafeErrorLogger: Failed to disable game loading mode during cleanup.',
      disableFailure
    );
  });
});
