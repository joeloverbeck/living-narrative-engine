import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import createSaveLoadService from '../../../src/persistence/createSaveLoadService.js';
import PersistenceErrorCodes, {
  PersistenceError,
} from '../../../src/persistence/persistenceErrors.js';

/**
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 */
function createBaseStorageProvider() {
  return {
    ensureDirectoryExists: jest.fn().mockResolvedValue({ success: true }),
    writeFileAtomically: jest.fn().mockRejectedValue(
      new Error('write should not be reached'),
    ),
    listFiles: jest.fn().mockResolvedValue([]),
    readFile: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue({ success: true }),
    fileExists: jest.fn().mockResolvedValue(true),
  };
}

/**
 *
 * @param message
 */
function createFailingCrypto(message) {
  return {
    subtle: {
      digest: jest.fn().mockImplementation(() =>
        Promise.reject(new Error(message)),
      ),
    },
  };
}

/**
 *
 */
function buildGameState() {
  return {
    metadata: {
      saveFormatVersion: '1.0.0',
      engineVersion: 'integration-suite',
      gameTitle: 'Integration Harness',
      timestamp: '2024-01-02T10:20:30.000Z',
      playtimeSeconds: 128,
      saveName: '',
    },
    modManifest: {
      activeMods: [{ modId: 'core', version: '1.0.0' }],
    },
    gameState: {
      party: [{ id: 'hero', level: 7 }],
      world: { day: 5 },
    },
    integrityChecks: {},
  };
}

describe('persistenceErrors integration through save pipeline', () => {
  let originalCaptureStackTrace;

  beforeEach(() => {
    originalCaptureStackTrace = Error.captureStackTrace;
  });

  afterEach(() => {
    Error.captureStackTrace = originalCaptureStackTrace;
    jest.restoreAllMocks();
  });

  it('wraps checksum failures in PersistenceError instances and captures stacks when supported', async () => {
    const logger = createLogger();
    const storageProvider = createBaseStorageProvider();
    const crypto = createFailingCrypto('crypto subtle digest failed');
    const captureSpy = jest.fn();
    Error.captureStackTrace = captureSpy;

    const saveLoadService = createSaveLoadService({
      logger,
      storageProvider,
      crypto,
    });

    const result = await saveLoadService.saveManualGame(
      'BrokenSlot',
      buildGameState(),
    );

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(result.error.message).toBe(
      'Checksum generation failed: crypto subtle digest failed',
    );

    expect(captureSpy).toHaveBeenCalledWith(result.error, PersistenceError);
    expect(storageProvider.writeFileAtomically).not.toHaveBeenCalled();

    const loggedError = logger.error.mock.calls.find((call) =>
      call.some((arg) => arg instanceof PersistenceError),
    );
    expect(loggedError).toBeDefined();
    expect(loggedError[1].code).toBe(
      PersistenceErrorCodes.CHECKSUM_GENERATION_FAILED,
    );
  });

  it('still produces PersistenceError instances when captureStackTrace is unavailable', async () => {
    const logger = createLogger();
    const storageProvider = createBaseStorageProvider();
    const crypto = createFailingCrypto('legacy runtime digest failure');
    // Simulate runtimes without captureStackTrace support
    delete Error.captureStackTrace;

    const saveLoadService = createSaveLoadService({
      logger,
      storageProvider,
      crypto,
    });

    const result = await saveLoadService.saveManualGame(
      'LegacySlot',
      buildGameState(),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(PersistenceError);
    expect(result.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(result.error.message).toBe(
      'Checksum generation failed: legacy runtime digest failure',
    );
    expect(result.error.stack).toEqual(expect.any(String));

    expect(storageProvider.writeFileAtomically).not.toHaveBeenCalled();

    const loggedError = logger.error.mock.calls.find((call) =>
      call.some((arg) => arg instanceof PersistenceError),
    );
    expect(loggedError).toBeDefined();
    expect(loggedError[1].code).toBe(
      PersistenceErrorCodes.CHECKSUM_GENERATION_FAILED,
    );
  });
});
