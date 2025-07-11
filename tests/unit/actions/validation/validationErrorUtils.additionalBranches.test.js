import { describe, it, expect } from '@jest/globals';
import { formatValidationError } from '../../../../src/actions/validation/validationErrorUtils.js';

/**
 * Additional branch coverage for formatValidationError.
 */
describe('formatValidationError additional branches', () => {
  it('handles plain object errors with message property', () => {
    const customErr = { message: 'Custom Failure' };
    const result = formatValidationError(customErr, 'source', {});
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('source: Custom Failure');
  });

  it('handles object errors lacking a message', () => {
    const result = formatValidationError({}, 'source', {});
    expect(result.message).toBe('source: undefined');
  });
});
