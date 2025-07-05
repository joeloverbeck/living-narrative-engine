import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LLMStrategyFactoryError } from '../../../src/llms/errors/LLMStrategyFactoryError.js';

describe('LLMStrategyFactoryError', () => {
  let original;
  beforeEach(() => {
    original = Error.captureStackTrace;
  });
  afterEach(() => {
    Error.captureStackTrace = original;
  });

  it('stores provided details and cause', () => {
    const cause = new Error('root cause');
    const err = new LLMStrategyFactoryError('boom', {
      apiType: 'openrouter',
      jsonOutputMethod: 'tool_calling',
      cause,
    });

    expect(err.name).toBe('LLMStrategyFactoryError');
    expect(err.message).toBe('boom');
    expect(err.apiType).toBe('openrouter');
    expect(err.jsonOutputMethod).toBe('tool_calling');
    expect(err.cause).toBe(cause);
  });

  it('handles missing captureStackTrace gracefully', () => {
    Error.captureStackTrace = undefined;
    const err = new LLMStrategyFactoryError('msg');
    expect(err.stack).toBeDefined();
  });
});
