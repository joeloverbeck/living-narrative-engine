import { describe, it, expect } from '@jest/globals';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
  normalizePersistenceFailure,
} from '../../../src/utils/persistenceResultUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';

describe('persistenceResultUtils', () => {
  it('createPersistenceFailure wraps code and message in PersistenceError', () => {
    const result = createPersistenceFailure(
      PersistenceErrorCodes.WRITE_ERROR,
      'failed to write'
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.WRITE_ERROR);
    expect(result.error.message).toBe('failed to write');
  });

  it('createPersistenceSuccess returns success result with data', () => {
    const data = { foo: 'bar' };
    const result = createPersistenceSuccess(data);
    expect(result).toEqual({ success: true, data });
  });

  it('normalizePersistenceFailure returns success unchanged', () => {
    const result = normalizePersistenceFailure(
      { success: true, data: 1 },
      'X',
      'msg'
    );
    expect(result).toEqual({ success: true, data: 1 });
  });

  it('normalizePersistenceFailure passes through PersistenceError', () => {
    const error = new PersistenceError(
      PersistenceErrorCodes.FILE_READ_ERROR,
      'oops'
    );
    const result = normalizePersistenceFailure(
      { success: false, error },
      'F',
      'fallback'
    );
    expect(result).toEqual({ success: false, error, data: null });
  });

  it('normalizePersistenceFailure wraps non-PersistenceError failures', () => {
    const result = normalizePersistenceFailure(
      { success: false, error: new Error('bad') },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'unexpected'
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(result.error.message).toBe('unexpected: bad');
    expect(result.data).toBeNull();
    expect(result.error.cause).toBeInstanceOf(Error);
  });

  it('normalizePersistenceFailure preserves string error messages', () => {
    const result = normalizePersistenceFailure(
      { success: false, error: 'Disk full' },
      PersistenceErrorCodes.WRITE_ERROR,
      'Failed to persist game state'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.WRITE_ERROR);
    expect(result.error.message).toBe(
      'Failed to persist game state: Disk full'
    );
    expect(result.data).toBeNull();
  });

  it('combines fallback and derived messages when both are available', () => {
    const rawError = { message: '  precise reason  ' };

    const result = normalizePersistenceFailure(
      { success: false, error: rawError },
      PersistenceErrorCodes.WRITE_ERROR,
      'Failed to persist game state'
    );

    expect(result.success).toBe(false);
    expect(result.error.message).toBe(
      'Failed to persist game state: precise reason'
    );
    expect(result.error.cause).toBe(rawError);
  });

  it('uses derived message when fallback text is blank after trimming', () => {
    const result = normalizePersistenceFailure(
      { success: false, error: '  details from storage  ' },
      PersistenceErrorCodes.WRITE_ERROR,
      '   '
    );

    expect(result.error.message).toBe('details from storage');
  });

  it('falls back to default unknown message when message is not provided', () => {
    const result = normalizePersistenceFailure(
      { success: false, error: null },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      /** @type {any} */ (undefined)
    );

    expect(result.error.message).toBe('Unknown error.');
  });

  it('derives messages from additional object keys when message is empty', () => {
    const rawError = { message: '   ', details: '  more context  ' };

    const result = normalizePersistenceFailure(
      { success: false, error: rawError },
      PersistenceErrorCodes.FILE_READ_ERROR,
      'Could not read save file'
    );

    expect(result.error.message).toBe('Could not read save file: more context');
  });

  it('serializes plain objects when no readable text properties exist', () => {
    const rawError = { foo: 'bar' };

    const result = normalizePersistenceFailure(
      { success: false, error: rawError },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'Operation failed'
    );

    expect(result.error.message).toBe('Operation failed: {"foo":"bar"}');
  });

  it('falls back to default when object serialization is empty', () => {
    const result = normalizePersistenceFailure(
      { success: false, error: {} },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'Could not complete request'
    );

    expect(result.error.message).toBe('Could not complete request');
  });

  it('handles array errors that serialize to an empty representation', () => {
    const result = normalizePersistenceFailure(
      { success: false, error: [] },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'Could not complete request'
    );

    expect(result.error.message).toBe('Could not complete request');
  });

  it('ignores non-object, non-string error payloads', () => {
    const result = normalizePersistenceFailure(
      { success: false, error: 404 },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'Default from status code'
    );

    expect(result.error.message).toBe('Default from status code');
  });

  it('ignores serialization failures when encountering circular structures', () => {
    const rawError = {};
    // @ts-expect-error - introduce a circular reference on purpose
    rawError.self = rawError;

    const result = normalizePersistenceFailure(
      { success: false, error: rawError },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'Circular reference'
    );

    expect(result.error.message).toBe('Circular reference');
  });

  it('stores raw error on originalError when assigning cause fails', () => {
    const rawError = { reason: 'permission denied' };
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      PersistenceError.prototype,
      'cause'
    );

    Object.defineProperty(PersistenceError.prototype, 'cause', {
      configurable: true,
      set() {
        throw new Error('cannot assign cause');
      },
    });

    try {
      const result = normalizePersistenceFailure(
        { success: false, error: rawError },
        PersistenceErrorCodes.WRITE_ERROR,
        'Unable to save'
      );

      expect(result.error.originalError).toBe(rawError);
      expect(result.error.cause).toBeUndefined();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(
          PersistenceError.prototype,
          'cause',
          originalDescriptor
        );
      } else {
        delete PersistenceError.prototype.cause;
      }
    }
  });

  it('uses fallback message when Error instance lacks a string message', () => {
    const rawError = new Error('ignored');
    Object.defineProperty(rawError, 'message', {
      configurable: true,
      value: 42,
    });

    const result = normalizePersistenceFailure(
      { success: false, error: rawError },
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'Defaulted message'
    );

    expect(result.error.message).toBe('Defaulted message');
  });

  it('omits cause attachment when raw error is undefined', () => {
    const result = normalizePersistenceFailure(
      /** @type {any} */ ({ success: false }),
      PersistenceErrorCodes.UNEXPECTED_ERROR,
      'No further details'
    );

    expect(result.error.cause).toBeUndefined();
    expect(result.error.originalError).toBeUndefined();
  });
});
