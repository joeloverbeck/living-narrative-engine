import { getUserFriendlyMessage } from '../../src/alerting/statusCodeMapper';
import { describe, expect, it } from '@jest/globals';

describe('getUserFriendlyMessage', () => {
  it('should return a mapped message for a known status code', () => {
    const details = {
      statusCode: 503,
      url: '/api/x',
      raw: '503 Service Unavailable',
    };
    const result = getUserFriendlyMessage(details, 'Original message');

    expect(result.displayMessage).toBe(
      'Service temporarily unavailable. Please retry in a moment.'
    );
    expect(result.devDetails).toBe('503 Service Unavailable at /api/x');
  });

  it('should return a generic message for an unmapped status code', () => {
    const details = { statusCode: 418, url: '/api/teapot' };
    const result = getUserFriendlyMessage(details, 'Original message');

    expect(result.displayMessage).toBe('An unexpected error occurred.');
    expect(result.devDetails).toBe('418 at /api/teapot');
  });

  it('should return a generic message for an unmapped status code with raw details', () => {
    const details = {
      statusCode: 418,
      url: '/api/teapot',
      raw: "I'm a teapot",
    };
    const result = getUserFriendlyMessage(details, 'Original message');

    expect(result.displayMessage).toBe('An unexpected error occurred.');
    expect(result.devDetails).toBe("I'm a teapot at /api/teapot");
  });

  it('should return the original message when there is no status code', () => {
    const details = { url: '/somewhere', raw: 'Some raw details' };
    const result = getUserFriendlyMessage(details, 'A custom event occurred.');

    expect(result.displayMessage).toBe('A custom event occurred.');
    expect(result.devDetails).toBe('Some raw details');
  });

  it('should return the original message and null details if details are null/empty', () => {
    const result1 = getUserFriendlyMessage({}, 'A plain message.');
    expect(result1.displayMessage).toBe('A plain message.');
    expect(result1.devDetails).toBeNull();

    const result2 = getUserFriendlyMessage(null, 'Another plain message.');
    expect(result2.displayMessage).toBe('Another plain message.');
    expect(result2.devDetails).toBeNull();
  });

  it('should handle details with a status code but no url or raw message', () => {
    const details = { statusCode: 404 };
    const result = getUserFriendlyMessage(details, 'Original message');

    expect(result.displayMessage).toBe('Resource not found.');
    expect(result.devDetails).toBe('404');
  });
});
