import { describe, it, expect, jest } from '@jest/globals';
import PromptTooLongError from '../../../src/errors/promptTooLongError.js';

describe('PromptTooLongError branch coverage', () => {
  it('captures stack when available and sets properties', () => {
    const spy = jest.spyOn(Error, 'captureStackTrace');
    const err = new PromptTooLongError('too long', {
      estimatedTokens: 5,
      promptTokenSpace: 3,
      contextTokenLimit: 10,
      maxTokensForOutput: 1,
    });

    expect(spy).toHaveBeenCalledWith(err, PromptTooLongError);
    expect(err.message).toBe('too long');
    expect(err.name).toBe('PromptTooLongError');
    expect(err.estimatedTokens).toBe(5);
    expect(err.promptTokenSpace).toBe(3);
    expect(err.contextTokenLimit).toBe(10);
    expect(err.maxTokensForOutput).toBe(1);
    spy.mockRestore();
  });

  it('handles absence of Error.captureStackTrace gracefully', () => {
    const original = Error.captureStackTrace;
    // @ts-ignore
    delete Error.captureStackTrace;
    const err = new PromptTooLongError('msg');
    expect(err.name).toBe('PromptTooLongError');
    // restore
    if (original) Error.captureStackTrace = original;
  });
});
