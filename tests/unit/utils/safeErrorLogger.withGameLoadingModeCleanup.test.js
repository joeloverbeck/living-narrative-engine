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
});
