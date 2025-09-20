import { describe, it, expect } from '@jest/globals';
import { generateKey } from '../../../src/utils/throttleUtils.js';

describe('throttleUtils.generateKey integration', () => {
  it('combines message with status code and url details', () => {
    const key = generateKey('Request failed', {
      statusCode: 503,
      url: '/api/status',
    });

    expect(key).toBe('Request failed::503::/api/status');
  });

  it('falls back to empty placeholders when details are missing', () => {
    const key = generateKey('An unexpected issue occurred');

    expect(key).toBe('An unexpected issue occurred::::');
  });

  it('uses empty segments for undefined detail fields', () => {
    const key = generateKey('Partial details', {
      statusCode: undefined,
      url: '/health',
    });

    expect(key).toBe('Partial details::::/health');
  });
});
