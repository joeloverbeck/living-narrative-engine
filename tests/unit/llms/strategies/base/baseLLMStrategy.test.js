import { describe, test, expect, jest } from '@jest/globals';
import { BaseLLMStrategy } from '../../../../../src/llms/strategies/base/baseLLMStrategy.js';

describe('BaseLLMStrategy', () => {
  const createLogger = () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  test('constructor throws when logger is missing', () => {
    expect(() => new BaseLLMStrategy()).toThrow(
      "BaseLLMStrategy constructor: Valid logger instance (ILogger, with at least an 'info' method) is required."
    );
  });

  test('constructor assigns logger when provided', () => {
    const logger = createLogger();
    const strategy = new BaseLLMStrategy(logger);
    expect(strategy.logger).toBe(logger);
  });

  test('_constructPromptPayload logs and throws', () => {
    const logger = createLogger();
    const strategy = new BaseLLMStrategy(logger);
    expect(() => strategy._constructPromptPayload('summary', {})).toThrow(
      'BaseLLMStrategy._constructPromptPayload: Method not implemented.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'BaseLLMStrategy._constructPromptPayload: Method not implemented. Subclasses must override this.'
    );
  });
});
