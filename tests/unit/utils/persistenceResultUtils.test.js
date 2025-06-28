import { describe, it, expect } from '@jest/globals';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
  normalizePersistenceFailure
} from '../../../src/utils/persistenceResultUtils.js';
import { PersistenceError, PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';

describe('persistenceResultUtils', () => {
  it('createPersistenceFailure wraps code and message in PersistenceError', () => {
    const result = createPersistenceFailure(PersistenceErrorCodes.WRITE_ERROR, 'failed to write');
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
    const result = normalizePersistenceFailure({ success: true, data: 1 }, 'X', 'msg');
    expect(result).toEqual({ success: true, data: 1 });
  });

  it('normalizePersistenceFailure passes through PersistenceError', () => {
    const error = new PersistenceError(PersistenceErrorCodes.FILE_READ_ERROR, 'oops');
    const result = normalizePersistenceFailure({ success: false, error }, 'F', 'fallback');
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
    expect(result.error.message).toBe('unexpected');
    expect(result.data).toBeNull();
  });
});
