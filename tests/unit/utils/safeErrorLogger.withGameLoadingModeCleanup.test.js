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

  it('supports legacy string context arguments', async () => {
    await safeErrorLogger.withGameLoadingMode(async () => {}, 'legacy-context');

    const setBatchModeCalls = mockDispatcher.setBatchMode.mock.calls;
    expect(setBatchModeCalls[0][0]).toBe(true);
    expect(setBatchModeCalls[0][1]).toEqual(
      expect.objectContaining({ context: 'legacy-context' })
    );
    expect(setBatchModeCalls[setBatchModeCalls.length - 1][0]).toBe(false);
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
      safeErrorLogger.withGameLoadingMode(async () => {}, {
        context: 'success-operation',
        timeoutMs: 0,
      })
    ).rejects.toBe(disableFailure);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'SafeErrorLogger: Failed to disable game loading mode during cleanup.',
      disableFailure
    );
  });

  it('normalizes non-Error cleanup failures to Error instances', async () => {
    // This tests the normalizeError() integration - when setBatchMode throws
    // a non-Error value (string, number, etc.), it must be normalized to Error
    const nonErrorFailure = 'string error from batch mode';

    mockDispatcher.setBatchMode.mockImplementation((enable) => {
      if (!enable) {
        throw nonErrorFailure; // Throw non-Error value
      }
    });

    await expect(
      safeErrorLogger.withGameLoadingMode(async () => {}, {
        context: 'non-error-failure',
        timeoutMs: 0,
      })
    ).rejects.toBeInstanceOf(Error);

    // Verify the logged error is an Error instance with the normalized message
    expect(mockLogger.error).toHaveBeenCalledWith(
      'SafeErrorLogger: Failed to disable game loading mode during cleanup.',
      expect.any(Error)
    );

    const loggedError = mockLogger.error.mock.calls[0][1];
    expect(loggedError.message).toBe('string error from batch mode');
  });

  it('normalizes non-Error failures from force-disable path', async () => {
    // Tests the second normalization point in withGameLoadingMode:
    // when disableGameLoadingMode({ force: true }) throws a non-Error
    //
    // Scenario: The outer withGameLoadingMode exits, calls disableGameLoadingMode()
    // which succeeds but doesn't fully clean up the nested context (because nested
    // was enabled inside but not disabled). The leak detection sees stack is too deep
    // and calls disableGameLoadingMode({ force: true }) which throws a non-Error.

    let setBatchModeCallCount = 0;
    mockDispatcher.setBatchMode.mockImplementation((enable, config) => {
      setBatchModeCallCount++;

      // Call 1: enable outer context (enable=true)
      // Call 2: enable nested/leaking context (enable=true)
      // Call 3: first disable attempt from finally (enable=false) - succeeds
      //         but only decrements stack by 1, leaving leak
      // Call 4: force disable (enable=false) - throws non-Error

      if (!enable && setBatchModeCallCount >= 4) {
        // Force disable path - throw non-Error
        throw 42;
      }
    });

    await safeErrorLogger.withGameLoadingMode(
      async () => {
        // Create a nested context that will leak
        safeErrorLogger.enableGameLoadingMode({
          context: 'leaking-context',
          timeoutMs: 0,
        });
        // Intentionally omit disableGameLoadingMode to cause leak
      },
      { context: 'outer-context', timeoutMs: 0 }
    );

    // The force-disable path should normalize the non-Error and log it
    const errorCalls = mockLogger.error.mock.calls;
    const forceDisableErrorCall = errorCalls.find((call) =>
      call[0].includes('Forced disable')
    );
    expect(forceDisableErrorCall).toBeDefined();
    expect(forceDisableErrorCall[1]).toBeInstanceOf(Error);
    expect(forceDisableErrorCall[1].message).toBe('42');
  });

  it('cleans up state when enabling batch mode throws', async () => {
    const enableFailure = new Error('enable failed');
    mockDispatcher.setBatchMode.mockImplementationOnce((enable) => {
      if (enable) {
        throw enableFailure;
      }
    });

    await expect(
      safeErrorLogger.withGameLoadingMode(async () => {}, {
        context: 'failing-enable',
        timeoutMs: 0,
      })
    ).rejects.toBe(enableFailure);

    expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
    expect(mockDispatcher.setBatchMode).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.setBatchMode).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ context: 'failing-enable' })
    );

    await safeErrorLogger.withGameLoadingMode(async () => {}, {
      context: 'post-failure',
      timeoutMs: 0,
    });

    const finalCall =
      mockDispatcher.setBatchMode.mock.calls[
        mockDispatcher.setBatchMode.mock.calls.length - 1
      ];
    expect(finalCall[0]).toBe(false);
  });
});
