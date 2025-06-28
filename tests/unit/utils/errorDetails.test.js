import { describe, it, expect } from '@jest/globals';
import { createErrorDetails } from '../../../src/utils/errorDetails.js';

describe('createErrorDetails', () => {
  it('returns error details with provided stack', () => {
    const details = createErrorDetails('boom', 'my-stack');
    expect(details).toEqual({
      raw: 'boom',
      timestamp: expect.any(String),
      stack: 'my-stack',
    });
    expect(new Date(details.timestamp).toISOString()).toBe(details.timestamp);
  });

  it('uses default stack when none provided', () => {
    const details = createErrorDetails('oops');
    expect(details.raw).toBe('oops');
    expect(details.stack).toEqual(expect.any(String));
    expect(new Date(details.timestamp).toISOString()).toBe(details.timestamp);
  });
});
