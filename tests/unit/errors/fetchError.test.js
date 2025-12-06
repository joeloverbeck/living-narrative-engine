import { describe, expect, it } from '@jest/globals';

import FetchError from '../../../src/errors/fetchError.js';
import BaseError from '../../../src/errors/baseError.js';

describe('FetchError', () => {
  it('captures path context and exposes BaseError contract', () => {
    const error = new FetchError(
      'Unable to fetch resource',
      '/mods/quest.json'
    );

    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(FetchError);
    expect(error.name).toBe('FetchError');
    expect(error.message).toBe('Unable to fetch resource');

    // BaseError derived accessors should expose the standardized metadata.
    expect(error.code).toBe('FETCH_ERROR');
    expect(error.context).toEqual({ path: '/mods/quest.json' });
    expect(error.severity).toBe('warning');
    expect(error.recoverable).toBe(true);

    // The legacy path property is preserved for backward compatibility.
    expect(error.path).toBe('/mods/quest.json');

    expect(error.getSeverity()).toBe('warning');
    expect(error.isRecoverable()).toBe(true);

    const serialized = error.toJSON();
    expect(serialized).toEqual(
      expect.objectContaining({
        name: 'FetchError',
        message: 'Unable to fetch resource',
        code: 'FETCH_ERROR',
        context: { path: '/mods/quest.json' },
        severity: 'warning',
        recoverable: true,
      })
    );
  });

  it('defaults the optional path to null when omitted', () => {
    const error = new FetchError('Config fetch failed');

    expect(error.path).toBeNull();
    expect(error.context).toEqual({ path: null });
    expect(error.toString()).toContain(
      'FetchError[FETCH_ERROR]: Config fetch failed'
    );
  });
});
