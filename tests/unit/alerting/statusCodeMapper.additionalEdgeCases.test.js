import { describe, it, expect } from '@jest/globals';
import {
  statusCodeMap,
  getUserFriendlyMessage,
} from '../../../src/alerting/statusCodeMapper.js';

describe('statusCodeMapper additional edge cases', () => {
  it('exposes the default status code mapping without mutation', () => {
    expect(statusCodeMap).toBeInstanceOf(Map);
    const knownPairs = [
      [400, 'Bad request. Please check your input.'],
      [401, 'You are not authorized. Please log in again.'],
      [403, 'Access denied.'],
      [404, 'Resource not found.'],
      [500, 'Server error. Please try again later.'],
      [503, 'Service temporarily unavailable. Please retry in a moment.'],
    ];

    expect(statusCodeMap.size).toBe(knownPairs.length);
    for (const [code, message] of knownPairs) {
      expect(statusCodeMap.get(code)).toBe(message);
    }
    // Reading from the map should not add or remove entries.
    expect(statusCodeMap.size).toBe(knownPairs.length);
  });

  it('falls back gracefully when details are completely undefined', () => {
    const result = getUserFriendlyMessage(undefined, 'Fallback message');

    expect(result).toEqual({
      displayMessage: 'Fallback message',
      devDetails: null,
    });
  });

  it('treats non-numeric status codes as unknown values and preserves raw detail strings', () => {
    const result = getUserFriendlyMessage(
      {
        // Some callers may incorrectly send a string status code; ensure we do not crash.
        statusCode: '503',
        raw: 'degraded upstream',
      },
      'Original message'
    );

    expect(result).toEqual({
      displayMessage: 'An unexpected error occurred.',
      devDetails: 'degraded upstream',
    });
  });

  it('prefers the provided raw string even when it looks falsy once trimmed', () => {
    const result = getUserFriendlyMessage(
      {
        statusCode: 500,
        raw: '0',
        url: '',
      },
      'Original message'
    );

    expect(result).toEqual({
      displayMessage: 'Server error. Please try again later.',
      devDetails: '0',
    });
  });
});
