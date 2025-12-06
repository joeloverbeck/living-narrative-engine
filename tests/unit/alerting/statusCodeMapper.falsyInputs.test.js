import { describe, it, expect, afterEach } from '@jest/globals';
import {
  statusCodeMap,
  getUserFriendlyMessage,
} from '../../../src/alerting/statusCodeMapper.js';

describe('statusCodeMapper falsy and dynamic cases', () => {
  const addedCodes = new Set();

  afterEach(() => {
    for (const code of addedCodes) {
      statusCodeMap.delete(code);
    }
    addedCodes.clear();
  });

  it('uses the numeric status code when the raw detail is a falsy number', () => {
    const details = {
      statusCode: 400,
      raw: 0,
      url: '/api/resource',
    };

    const result = getUserFriendlyMessage(details, 'Original message');

    expect(result).toEqual({
      displayMessage: 'Bad request. Please check your input.',
      devDetails: '400 at /api/resource',
    });
  });

  it('treats a status code of 0 as missing and preserves the original message', () => {
    const details = {
      statusCode: 0,
      raw: 'Zero status from upstream',
    };

    const result = getUserFriendlyMessage(details, 'Fallback message');

    expect(result).toEqual({
      displayMessage: 'Fallback message',
      devDetails: 'Zero status from upstream',
    });
  });

  it('includes whitespace-only URLs verbatim when building developer details', () => {
    const details = {
      statusCode: 401,
      raw: 'Expired token',
      url: '   ',
    };

    const result = getUserFriendlyMessage(details, 'Original message');

    expect(result).toEqual({
      displayMessage: 'You are not authorized. Please log in again.',
      devDetails: 'Expired token at    ',
    });
  });

  it('honors dynamically added mappings for newly introduced status codes', () => {
    const code = 418;
    const customMessage = 'Short and stout';
    statusCodeMap.set(code, customMessage);
    addedCodes.add(code);

    const details = {
      statusCode: code,
      url: '/brew/tea',
    };

    const result = getUserFriendlyMessage(details, 'Original message');

    expect(result).toEqual({
      displayMessage: customMessage,
      devDetails: '418 at /brew/tea',
    });
  });
});
