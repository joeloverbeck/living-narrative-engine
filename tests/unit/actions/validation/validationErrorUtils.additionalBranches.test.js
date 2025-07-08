import { describe, it, expect } from '@jest/globals';
import { formatValidationError } from '../../../../src/actions/validation/validationErrorUtils.js';

// Custom dummy error classes so instanceof checks are false
class SomeOtherError {}

/**
 * Additional branch coverage for formatValidationError.
 */
describe('formatValidationError additional branches', () => {
  it('handles plain object errors with message property', () => {
    const customErr = { message: 'Custom Failure' };
    const result = formatValidationError(customErr, 'source', {});
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('source: custom Failure');
  });

  it('handles object errors lacking a message', () => {
    const result = formatValidationError({}, 'source', {});
    expect(result.message).toBe('source: invalid input');
  });
});
