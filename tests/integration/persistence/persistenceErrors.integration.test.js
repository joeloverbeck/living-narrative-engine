import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { webcrypto } from 'crypto';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import defaultCodes, {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
  normalizePersistenceFailure,
} from '../../../src/utils/persistenceResultUtils.js';

/**
 * Utility to temporarily override Error.captureStackTrace for branch coverage.
 *
 * @param {Function | undefined} replacement
 * @param {() => void | Promise<void>} callback
 */
async function withTemporaryCaptureStackTrace(replacement, callback) {
  const original = Error.captureStackTrace;
  if (replacement === undefined) {
    // @ts-ignore
    delete Error.captureStackTrace;
  } else {
    Error.captureStackTrace = replacement;
  }

  try {
    await callback();
  } finally {
    if (original) {
      Error.captureStackTrace = original;
    } else {
      // @ts-ignore
      delete Error.captureStackTrace;
    }
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

      expect(defaultCodes).toBe(PersistenceErrorCodes);
      expect(Object.keys(PersistenceErrorCodes)).toEqual(expectedKeys);
      expect(Object.isFrozen(PersistenceErrorCodes)).toBe(true);
      expect(() => {
        // Attempts to mutate should fail because the object is frozen.
        PersistenceErrorCodes.NEW_CODE = 'SHOULD_NOT_WRITE';
      }).toThrow(TypeError);
      expect(PersistenceErrorCodes.NEW_CODE).toBeUndefined();
    });
  });

  describe('PersistenceError', () => {
    it('captures error metadata and stack trace when supported by the runtime', async () => {
      const captureSpy = jest.fn();

      await withTemporaryCaptureStackTrace(captureSpy, () => {
        const error = new PersistenceError(
          PersistenceErrorCodes.FILE_READ_ERROR,
          'Unable to read save file'
        );

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PersistenceError);
        expect(error.name).toBe('PersistenceError');
        expect(error.code).toBe(PersistenceErrorCodes.FILE_READ_ERROR);
        expect(error.message).toBe('Unable to read save file');
        expect(captureSpy).toHaveBeenCalledWith(error, PersistenceError);
      });
    });

    it('still constructs cleanly when captureStackTrace is unavailable', async () => {
      await withTemporaryCaptureStackTrace(undefined, () => {
        const error = new PersistenceError(
          PersistenceErrorCodes.DESERIALIZATION_ERROR,
          'Invalid payload'
        );

        expect(
          error.stack === undefined || typeof error.stack === 'string'
        ).toBe(true);
        expect(error.code).toBe(PersistenceErrorCodes.DESERIALIZATION_ERROR);
      });
    });
  });

  describe('integration with persistenceResultUtils', () => {
    it('wraps failures in PersistenceError instances and preserves them during normalization', () => {
      const failure = createPersistenceFailure(
        PersistenceErrorCodes.CHECKSUM_MISMATCH,
        'Checksum mismatch detected'
      );

      expect(failure.success).toBe(false);
      expect(failure.error).toBeInstanceOf(PersistenceError);
      expect(failure.error.code).toBe(PersistenceErrorCodes.CHECKSUM_MISMATCH);

      const normalized = normalizePersistenceFailure(
        failure,
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        'Unexpected persistence failure'
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
        'Failed to persist game state'
      );

      expect(normalized.success).toBe(false);
      expect(normalized.error).toBeInstanceOf(PersistenceError);
      expect(normalized.error.code).toBe(PersistenceErrorCodes.WRITE_ERROR);
      expect(normalized.error.message).toBe(
        'Failed to persist game state: Disk full'
      );
    });

    it('passes through success results unchanged', () => {
      const data = { slotId: 'quick-save', timestamp: 1700 };
      const success = createPersistenceSuccess(data);

      const normalized = normalizePersistenceFailure(
        success,
        PersistenceErrorCodes.UNEXPECTED_ERROR,
        'This should not be used'
      );

      expect(normalized).toEqual({ success: true, data });
    });
  });

  describe('integration with runtime persistence services', () => {
    /** @type {ReturnType<typeof jest.spyOn>[]} */
    let consoleSpies;
    /** @type {ConsoleLogger} */
    let logger;

    beforeEach(() => {
      consoleSpies = [
        jest.spyOn(console, 'info').mockImplementation(() => {}),
        jest.spyOn(console, 'warn').mockImplementation(() => {}),
        jest.spyOn(console, 'error').mockImplementation(() => {}),
        jest.spyOn(console, 'debug').mockImplementation(() => {}),
        jest.spyOn(console, 'group').mockImplementation(() => {}),
        jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
        jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      ];

      logger = new ConsoleLogger(LogLevel.ERROR);
    });

    afterEach(() => {
      consoleSpies.forEach((spy) => spy.mockRestore());
    });

    it('propagates checksum failures as PersistenceError with metadata', async () => {
      const failingCrypto = {
        subtle: {
          digest: async () => {
            throw new Error('digest failure');
          },
        },
      };

      const checksumService = new ChecksumService({
        logger,
        crypto: failingCrypto,
      });
      const serializer = new GameStateSerializer({
        logger,
        checksumService,
      });

      const saveObject = {
        gameState: {
          actors: [{ id: 'hero-1' }],
          worldState: { activeArea: 'core:start', cycle: 42 },
        },
        integrityChecks: {},
      };

      await expect(
        serializer.compressPreparedState(saveObject)
      ).rejects.toBeInstanceOf(PersistenceError);

      await expect(
        serializer.compressPreparedState(saveObject)
      ).rejects.toMatchObject({
        name: 'PersistenceError',
        code: PersistenceErrorCodes.CHECKSUM_GENERATION_FAILED,
      });
    });

    it('normalizes sync persistence failures without captureStackTrace support', async () => {
      await withTemporaryCaptureStackTrace(undefined, () => {
        const checksumService = new ChecksumService({
          logger,
          crypto: webcrypto,
        });
        const serializer = new GameStateSerializer({
          logger,
          checksumService,
        });

        const invalidData = new Uint8Array([0, 1, 2, 3, 4]);
        const result = serializer.decompress(invalidData);

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(PersistenceError);
        expect(result.error.code).toBe(
          PersistenceErrorCodes.DECOMPRESSION_ERROR
        );
        expect(result.userFriendlyError).toBeDefined();
      });
    });
  });
});
