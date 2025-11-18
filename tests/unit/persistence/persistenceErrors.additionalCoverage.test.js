import { describe, it, expect, afterEach } from '@jest/globals';

import defaultCodes, {
  PersistenceErrorCodes,
  PersistenceError,
} from '../../../src/persistence/persistenceErrors.js';

describe('persistenceErrors module', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes a frozen map of persistence error codes', () => {
    expect(defaultCodes).toBe(PersistenceErrorCodes);
    expect(Object.isFrozen(PersistenceErrorCodes)).toBe(true);

    expect(PersistenceErrorCodes).toMatchObject({
      INVALID_SAVE_NAME: 'INVALID_SAVE_NAME',
      INVALID_SAVE_IDENTIFIER: 'INVALID_SAVE_IDENTIFIER',
      FILE_READ_ERROR: 'FILE_READ_ERROR',
      EMPTY_FILE: 'EMPTY_FILE',
      DECOMPRESSION_ERROR: 'DECOMPRESSION_ERROR',
      DESERIALIZATION_ERROR: 'DESERIALIZATION_ERROR',
      INVALID_GAME_STATE: 'INVALID_GAME_STATE',
      CHECKSUM_GENERATION_FAILED: 'CHECKSUM_GENERATION_FAILED',
      CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
      CHECKSUM_CALCULATION_ERROR: 'CHECKSUM_CALCULATION_ERROR',
      DIRECTORY_CREATION_FAILED: 'DIRECTORY_CREATION_FAILED',
      WRITE_ERROR: 'WRITE_ERROR',
      DELETE_FILE_NOT_FOUND: 'DELETE_FILE_NOT_FOUND',
      DELETE_FAILED: 'DELETE_FAILED',
      DEEP_CLONE_FAILED: 'DEEP_CLONE_FAILED',
      UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
    });

    const original = PersistenceErrorCodes.INVALID_SAVE_NAME;
    expect(() => {
      PersistenceErrorCodes.INVALID_SAVE_NAME = 'MUTATED';
    }).toThrow(TypeError);
    expect(PersistenceErrorCodes.INVALID_SAVE_NAME).toBe(original);
  });

  it('creates errors with contextual metadata and captured stacks when supported', () => {
    const captureSpy = jest.spyOn(Error, 'captureStackTrace');

    const error = new PersistenceError(
      PersistenceErrorCodes.FILE_READ_ERROR,
      'Unable to read the save file.'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PersistenceError');
    expect(error.code).toBe(PersistenceErrorCodes.FILE_READ_ERROR);
    expect(error.message).toBe('Unable to read the save file.');
    expect(captureSpy).toHaveBeenCalledWith(error, PersistenceError);
  });

  it('gracefully skips stack capture when the runtime does not support it', () => {
    const originalCapture = Error.captureStackTrace;
    try {
       
      // @ts-ignore - deleting built-in for test coverage purposes.
      delete Error.captureStackTrace;

      const error = new PersistenceError(
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        'A totally unexpected failure occurred.'
      );

      expect(error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
      expect(error.name).toBe('PersistenceError');
      expect(typeof error.stack === 'string' || typeof error.stack === 'undefined').toBe(true);
    } finally {
      if (originalCapture) {
        Error.captureStackTrace = originalCapture;
      } else {
         
        // @ts-ignore
        delete Error.captureStackTrace;
      }
    }
  });
});
