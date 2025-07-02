import { describe, it, expect } from '@jest/globals';
import { createTimeoutError } from '../../../src/utils/timeoutUtils.js';

describe('createTimeoutError', () => {
  it('returns error message and code', () => {
    const result = createTimeoutError('a1', 'jump', 42);
    expect(result.message).toBe(
      "No rule ended the turn for actor a1 after action 'jump'. The engine timed out after 42 ms."
    );
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.code).toBe('TURN_END_TIMEOUT');
    expect(result.error.message).toBe(result.message);
  });
});
