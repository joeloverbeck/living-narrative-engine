/**
 * @file Additional unit tests covering fallback behaviors in TokenEstimator
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

/**
 * Creates a mock logger implementing the ILogger interface methods used by TokenEstimator.
 *
 * @returns {{info: jest.Mock, debug: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
const createMockLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('TokenEstimator fallback coverage', () => {
  let mockLogger;

  beforeEach(() => {
    jest.resetModules();
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should fall back to word estimation when encoder throws during tokenization', async () => {
    const encoderLoader = jest.fn(async () => {
      return () => {
        throw new Error('encode failure');
      };
    });

    const { TokenEstimator } = await import(
      '../../../../src/llms/services/tokenEstimator.js'
    );
    const estimator = new TokenEstimator({ logger: mockLogger, encoderLoader });

    const text = 'Fallback estimation should use word count';
    const tokens = await estimator.estimateTokens(text, 'gpt-3.5-turbo');

    expect(tokens).toBeGreaterThan(0);
    expect(encoderLoader).toHaveBeenCalledWith('cl100k_base');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "TokenEstimator: Tokenization failed for model 'gpt-3.5-turbo': encode failure. Using fallback estimation."
    );

    const fallbackDebugCall = mockLogger.debug.mock.calls.find(
      ([message]) => message === 'TokenEstimator: Used fallback estimation'
    );
    expect(fallbackDebugCall).toBeDefined();
    const [, fallbackDetails] = fallbackDebugCall;
    expect(fallbackDetails).toEqual(
      expect.objectContaining({
        textLength: text.length,
        wordCount: expect.any(Number),
        estimatedTokens: expect.any(Number),
      })
    );
    expect(tokens).toBe(fallbackDetails.estimatedTokens);
  });

  it('should log a warning when encoder import fails and fall back to default encoding', async () => {
    await jest.isolateModulesAsync(async () => {
      await jest.unstable_mockModule('gpt-tokenizer', () => ({
        __esModule: true,
        encode: jest.fn((text) => Array.from(text)),
      }));

      const { TokenEstimator } = await import(
        '../../../../src/llms/services/tokenEstimator.js'
      );
      const encodingSpy = jest
        .spyOn(TokenEstimator.prototype, 'getEncodingForModel')
        .mockReturnValue('non-existent-encoding');

      const estimator = new TokenEstimator({ logger: mockLogger });

      const tokens = await estimator.estimateTokens(
        'import fallback',
        'text-davinci-003'
      );

      expect(tokens).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "TokenEstimator: Failed to load encoder for 'non-existent-encoding', falling back to cl100k_base. Error:"
        )
      );
      expect(encodingSpy).toHaveBeenCalledWith('text-davinci-003');

      encodingSpy.mockRestore();
    });
  });

  it('should throw when encoderLoader is not a function', async () => {
    const { TokenEstimator } = await import(
      '../../../../src/llms/services/tokenEstimator.js'
    );

    expect(
      () =>
        new TokenEstimator({
          logger: mockLogger,
          // @ts-expect-error - intentionally invalid for runtime validation
          encoderLoader: 'invalid',
        })
    ).toThrow('TokenEstimator: encoderLoader must be a function');
  });
});
