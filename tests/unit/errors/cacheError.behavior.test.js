import { describe, expect, it } from '@jest/globals';
import BaseError from '../../../src/errors/baseError.js';
import {
  CacheError,
  CacheKeyError,
  CacheValidationError,
} from '../../../src/errors/cacheError.js';

describe('cacheError hierarchy', () => {
  it('wraps causes and exposes base error semantics', () => {
    const cause = new Error('disk unavailable');
    const error = new CacheError('Failed to hydrate cache', cause);

    expect(error).toBeInstanceOf(CacheError);
    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Failed to hydrate cache');
    expect(error.name).toBe('CacheError');
    expect(error.code).toBe('CACHE_ERROR');
    expect(error.cause).toBe(cause);

    const context = error.getContext();
    expect(context).toHaveProperty('cause');
    expect(context.cause).toEqual({});

    // Mutating the retrieved context should not alter the stored metadata.
    context.cause = 'mutated';
    expect(error.getContext()).toEqual({ cause: {} });

    expect(error.getSeverity()).toBe('warning');
    expect(error.isRecoverable()).toBe(true);
    expect(error.recoverable).toBe(true);
    expect(error.severity).toBe('warning');
  });

  it('defaults to undefined cause when not provided', () => {
    const error = new CacheError('Cache miss escalation');

    expect(error.getContext()).toEqual({ cause: undefined });
    expect(error.cause).toBeUndefined();
  });

  it('specialized subclasses preserve cache semantics and naming', () => {
    const keyCause = new Error('Key format invalid');
    const keyError = new CacheKeyError('Invalid cache key', keyCause);

    expect(keyError).toBeInstanceOf(CacheError);
    expect(keyError.name).toBe('CacheKeyError');
    expect(keyError.getSeverity()).toBe('warning');
    expect(keyError.isRecoverable()).toBe(true);
    const keyContext = keyError.getContext();
    expect(keyContext).toHaveProperty('cause');
    expect(keyContext.cause).toEqual({});

    const validationError = new CacheValidationError(
      'Cache contents corrupted'
    );
    expect(validationError).toBeInstanceOf(CacheError);
    expect(validationError.name).toBe('CacheValidationError');
    expect(validationError.getSeverity()).toBe('warning');
    expect(validationError.isRecoverable()).toBe(true);
    expect(validationError.getContext()).toEqual({ cause: undefined });
  });
});
