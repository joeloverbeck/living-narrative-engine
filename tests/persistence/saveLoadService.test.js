import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../src/persistence/persistenceErrors.js';
import {
  createMockLogger,
  createMockSaveValidationService,
} from '../testUtils.js';

/** @typedef {import('../../src/interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
/** @typedef {import('../../src/persistence/gameStateSerializer.js').default} GameStateSerializer */

/**
 * Creates an in-memory storage provider for testing.
 *
 * @returns {IStorageProvider} In-memory provider
 */
const createMemoryStorageProvider = () => {
  const files = {};
  return {
    writeFileAtomically: jest.fn(async (path, data) => {
      files[path] = data;
      return { success: true };
    }),
    readFile: jest.fn(async (path) => files[path]),
    listFiles: jest.fn(async () => Object.keys(files)),
    deleteFile: jest.fn(async (path) => {
      if (path in files) {
        delete files[path];
        return { success: true };
      }
      return { success: false, error: 'not found' };
    }),
    fileExists: jest.fn(async (path) => path in files),
    ensureDirectoryExists: jest.fn(async () => {}),
  };
};

/**
 * Creates a mock GameStateSerializer.
 *
 * @returns {jest.Mocked<GameStateSerializer>} Mock serializer
 */
const createMockGameStateSerializer = () => ({
  serializeAndCompress: jest.fn(async (obj) => ({
    compressedData: new Uint8Array([1, 2, 3]),
    finalSaveObject: obj,
  })),
  decompress: jest.fn((data) => ({ success: true, data })),
  deserialize: jest.fn(() => ({ success: true, data: {} })),
});

describe('SaveLoadService', () => {
  /** @type {ReturnType<typeof createMemoryStorageProvider>} */
  let storageProvider;
  /** @type {ReturnType<typeof createMockGameStateSerializer>} */
  let serializer;
  /** @type {ReturnType<typeof createMockSaveValidationService>} */
  let validationService;
  let logger;
  /** @type {SaveLoadService} */
  let service;

  beforeEach(() => {
    storageProvider = createMemoryStorageProvider();
    serializer = createMockGameStateSerializer();
    validationService = createMockSaveValidationService();
    logger = createMockLogger();
    service = new SaveLoadService({
      logger,
      storageProvider,
      gameStateSerializer: serializer,
      saveValidationService: validationService,
    });
  });

  describe('saveManualGame', () => {
    it('creates a manual save successfully', async () => {
      // Arrange
      const state = {
        metadata: {},
        modManifest: {},
        gameState: {},
        integrityChecks: {},
      };
      const name = 'TestSave';
      const expectedPath = `saves/manual_saves/manual_save_${name}.sav`;

      // Act
      const result = await service.saveManualGame(name, state);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(expectedPath);
      expect(storageProvider.writeFileAtomically).toHaveBeenCalledWith(
        expectedPath,
        expect.any(Uint8Array)
      );
      expect(serializer.serializeAndCompress).toHaveBeenCalledTimes(1);
    });

    it('handles invalid save names', async () => {
      // Act
      const result = await service.saveManualGame('', {});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(PersistenceError);
      expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_SAVE_NAME);
      expect(storageProvider.writeFileAtomically).not.toHaveBeenCalled();
      expect(serializer.serializeAndCompress).not.toHaveBeenCalled();
    });
  });

  describe('loadGameData', () => {
    it('returns error when deserialization fails', async () => {
      // Arrange
      const path = 'saves/manual_saves/manual_save_bad.sav';
      storageProvider.readFile.mockResolvedValue(new Uint8Array([1]));
      serializer.deserialize.mockReturnValue({
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.DESERIALIZATION_ERROR,
          'bad'
        ),
      });

      // Act
      const result = await service.loadGameData(path);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(
        PersistenceErrorCodes.DESERIALIZATION_ERROR
      );
      expect(validationService.validateLoadedSaveObject).not.toHaveBeenCalled();
    });
  });

  describe('deleteManualSave', () => {
    it('returns error when file does not exist', async () => {
      // Arrange
      const path = 'saves/manual_saves/missing.sav';
      storageProvider.fileExists.mockResolvedValue(false);

      // Act
      const result = await service.deleteManualSave(path);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(
        PersistenceErrorCodes.DELETE_FILE_NOT_FOUND
      );
      expect(storageProvider.deleteFile).not.toHaveBeenCalled();
    });
  });
});
