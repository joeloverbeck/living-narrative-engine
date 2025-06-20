import { jest, describe, beforeEach, test, expect } from '@jest/globals';

import {
  InvalidIndexError,
  NoActionsDiscoveredError,
  LLMTimeoutError,
} from '../../../../src/turns/errors';

describe('aiStrategyErrors', () => {
  test('InvalidIndexError has correct name and message', () => {
    const err = new InvalidIndexError(5, 4);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvalidIndexError');
    expect(err.message).toBe('Index 5 out of 1–4');
  });

  test('NoActionsDiscoveredError has correct name and message', () => {
    const err = new NoActionsDiscoveredError('actor123');
    expect(err.name).toBe('NoActionsDiscoveredError');
    expect(err.message).toBe('No actions for actor actor123');
  });

  test('LLMTimeoutError has correct name and message', () => {
    const err = new LLMTimeoutError();
    expect(err.name).toBe('LLMTimeoutError');
    expect(err.message).toBe('LLM call timed out');
  });
});
