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

  describe('buildToolSchema', () => {
    test('returns null by default', () => {
      const logger = createLogger();
      const strategy = new BaseLLMStrategy(logger);
      const result = strategy.buildToolSchema([]);
      expect(result).toBeNull();
    });

    test('returns null with empty tools array', () => {
      const logger = createLogger();
      const strategy = new BaseLLMStrategy(logger);
      const result = strategy.buildToolSchema([]);
      expect(result).toBeNull();
    });

    test('returns null with populated tools array', () => {
      const logger = createLogger();
      const strategy = new BaseLLMStrategy(logger);
      const tools = [
        { name: 'tool1', description: 'Test tool 1' },
        { name: 'tool2', description: 'Test tool 2' }
      ];
      const result = strategy.buildToolSchema(tools);
      expect(result).toBeNull();
    });

    test('returns null with requestOptions', () => {
      const logger = createLogger();
      const strategy = new BaseLLMStrategy(logger);
      const tools = [{ name: 'tool1', description: 'Test tool' }];
      const requestOptions = { someOption: 'value' };
      const result = strategy.buildToolSchema(tools, requestOptions);
      expect(result).toBeNull();
    });

    test('returns null when called without parameters', () => {
      const logger = createLogger();
      const strategy = new BaseLLMStrategy(logger);
      const result = strategy.buildToolSchema();
      expect(result).toBeNull();
    });
  });

  describe('requiresCustomToolSchema', () => {
    test('returns false by default', () => {
      const logger = createLogger();
      const strategy = new BaseLLMStrategy(logger);
      const result = strategy.requiresCustomToolSchema();
      expect(result).toBe(false);
    });

    test('returns false consistently when called multiple times', () => {
      const logger = createLogger();
      const strategy = new BaseLLMStrategy(logger);
      expect(strategy.requiresCustomToolSchema()).toBe(false);
      expect(strategy.requiresCustomToolSchema()).toBe(false);
      expect(strategy.requiresCustomToolSchema()).toBe(false);
    });
  });
});
