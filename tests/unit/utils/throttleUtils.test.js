import { describe, expect, test } from '@jest/globals';
import { generateKey } from '../../../src/utils/throttleUtils.js';

describe('throttleUtils.generateKey', () => {
  test('combines message, status code, and url into dedupe key', () => {
    const message = 'Request failed';
    const details = { statusCode: 429, url: '/api/resource' };

    const key = generateKey(message, details);

    expect(key).toBe('Request failed::429::/api/resource');
  });

  test('omits missing details while keeping separators stable', () => {
    const message = 'Partial details';
    const details = { url: '/partial/only' };

    const key = generateKey(message, details);

    expect(key).toBe('Partial details::::/partial/only');
  });

  test('supports falsy status codes and undefined detail object', () => {
    expect(generateKey('Zero status', { statusCode: 0 })).toBe(
      'Zero status::0::'
    );
    expect(generateKey('No details')).toBe('No details::::');
  });
});
