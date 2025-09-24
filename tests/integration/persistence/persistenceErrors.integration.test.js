import { describe, it, expect, jest } from '@jest/globals';
import PersistenceErrorCodes, {
  PersistenceError,
} from '../../../src/persistence/persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
  normalizePersistenceFailure,
} from '../../../src/utils/persistenceResultUtils.js';

/**
 * Utility to temporarily override Error.captureStackTrace for branch coverage.
 * @param {() => void | Promise<void>} callback
 */
async function withTemporaryCaptureStackTrace(value, callback) {
  const original = Error.captureStackTrace;
  Error.captureStackTrace = value;
  try {
    await callback();
  } finally {
    Error.captureStackTrace = original;
  }
}

describe('persistenceErrors integration', () => {
  describe('PersistenceErrorCodes', () => {
    it('exposes the complete immutable set of error codes', () => {
      const expectedKeys = [
        'INVALID_SAVE_NAME',
        'INVALID_SAVE_IDENTIFIER',
        'FILE_READ_ERROR',
        'EMPTY_FILE',
        'DECOMPRESSION_ERROR',
        'DESERIALIZATION_ERROR',
        'INVALID_GAME_STATE',
        'CHECKSUM_GENERATION_FAILED',
        'CHECKSUM_MISMATCH',
        'CHECKSUM_CALCULATION_ERROR',
        'DIRECTORY_CREATION_FAILED',
        'WRITE_ERROR',
        'DELETE_FILE_NOT_FOUND',
        'DELETE_FAILED',
        'DEEP_CLONE_FAILED',
        'UNEXPECTED_ERROR',
      ];

      expect(Object.keys(PersistenceErrorCodes)).toEqual(expectedKeys);
      expect(() => {
        // Attempts to mutate should fail because the object is frozen.
        PersistenceErrorCodes.NEW_CODE = 'SHOULD_NOT_WRITE';
      }).toThrow(TypeError);
      expect(PersistenceErrorCodes.NEW_CODE).toBeUndefined();
    });
  });

  describe('PersistenceError', () => {
    it('captures error metadata and stack trace when supported by the runtime', async () => {
      await withTemporaryCaptureStackTrace(jest.fn(), () => {
        const error = new PersistenceError(
          PersistenceErrorCodes.FILE_READ_ERROR,
          'Unable to read save file',
        );

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PersistenceError);
        expect(error.name).toBe('PersistenceError');
        expect(error.code).toBe(PersistenceErrorCodes.FILE_READ_ERROR);
        expect(error.message).toBe('Unable to read save file');
      });
    });

    it('still constructs cleanly when captureStackTrace is unavailable', async () => {
      await withTemporaryCaptureStackTrace(undefined, () => {
        const error = new PersistenceError(
          PersistenceErrorCodes.DESERIALIZATION_ERROR,
          'Invalid payload',
        );

        expect(error.stack).toBeDefined();
        expect(error.code).toBe(PersistenceErrorCodes.DESERIALIZATION_ERROR);
      });
    });
  });

  describe('integration with persistenceResultUtils', () => {
    it('wraps failures in PersistenceError instances and preserves them during normalization', () => {
      const failure = createPersistenceFailure(
        PersistenceErrorCodes.CHECKSUM_MISMATCH,
        'Checksum mismatch detected',
      );

      expect(failure.success).toBe(false);
      expect(failure.error).toBeInstanceOf(PersistenceError);
      expect(failure.error.code).toBe(PersistenceErrorCodes.CHECKSUM_MISMATCH);

      const normalized = normalizePersistenceFailure(
        failure,
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        'Unexpected persistence failure',
      );

      expect(normalized.success).toBe(false);
      expect(normalized.error).toBe(failure.error);
      expect(normalized.data).toBeNull();
    });

    it('converts unknown errors into standardized PersistenceError instances', () => {
      const rawError = { message: 'Disk full' };
      const normalized = normalizePersistenceFailure(
        { success: false, error: rawError },
        PersistenceErrorCodes.WRITE_ERROR,
        'Failed to persist game state',
      );

      expect(normalized.success).toBe(false);
      expect(normalized.error).toBeInstanceOf(PersistenceError);
      expect(normalized.error.code).toBe(PersistenceErrorCodes.WRITE_ERROR);
      expect(normalized.error.message).toBe('Failed to persist game state');
    });

    it('passes through success results unchanged', () => {
      const data = { slotId: 'quick-save', timestamp: 1700 };
      const success = createPersistenceSuccess(data);

      const normalized = normalizePersistenceFailure(
        success,
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        'This should not be used',
      );

      expect(normalized).toEqual({ success: true, data });
    });
  });
});
