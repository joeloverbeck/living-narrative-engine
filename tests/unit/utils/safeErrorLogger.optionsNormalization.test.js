import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import createSafeErrorLogger from '../../../src/utils/safeErrorLogger.js';

describe('SafeErrorLogger loading option normalization', () => {
  let dispatcher;
  let logger;
  /** @type {ReturnType<typeof createSafeErrorLogger>} */
  let safeErrorLogger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    dispatcher = {
      setBatchMode: jest.fn(),
    };

    safeErrorLogger = createSafeErrorLogger({
      logger,
      safeEventDispatcher: dispatcher,
    });
  });

  afterEach(() => {
    safeErrorLogger.disableGameLoadingMode({
      force: true,
      reason: 'test-cleanup',
    });
    jest.clearAllMocks();
  });

  it('treats high-volume context strings with surrounding whitespace as high volume', () => {
    safeErrorLogger.enableGameLoadingMode('  game-load  ');

    expect(dispatcher.setBatchMode).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        context: 'game-load',
        maxGlobalRecursion: 200,
      })
    );
  });

  it('treats default context as high volume for backwards compatibility', () => {
    safeErrorLogger.enableGameLoadingMode();

    expect(dispatcher.setBatchMode).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        context: 'game-load',
        maxGlobalRecursion: 200,
      })
    );
  });
});
