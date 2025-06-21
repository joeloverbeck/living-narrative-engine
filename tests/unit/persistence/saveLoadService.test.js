import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import * as savePreparation from '../../../src/persistence/savePreparation.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';
import {
  createMockLogger,
  createMockSaveValidationService,
} from '../testUtils.js';

/** @typedef {import('../../../src/interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
import { createMemoryStorageProvider } from '../../common/mockFactories';
/** @typedef {import('../../../src/persistence/gameStateSerializer.js').default} GameStateSerializer */

/**
 * Creates a mock GameStateSerializer.
 *
 * @returns {jest.Mocked<GameStateSerializer>} Mock serializer
 */
const createMockGameStateSerializer = () => ({
  compressPreparedState: jest.fn(async (obj) => ({
    compressedData: new Uint8Array([1, 2, 3]),
    finalSaveObject: obj,
  })),
  decompress: jest.fn((data) => ({ success: true, data })),
  deserialize: jest.fn(() => ({ success: true, data: {} })),
  decompressAndDeserialize: jest.fn(() => ({ success: true, data: {} })),
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
  let prepareSpy;

  beforeEach(() => {
    storageProvider = createMemoryStorageProvider();
    serializer = createMockGameStateSerializer();
    validationService = createMockSaveValidationService();
    logger = createMockLogger();
    const saveFileRepository = new SaveFileRepository({
      logger,
      storageProvider,
      serializer,
    });
    service = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService: validationService,
    });
    prepareSpy = jest.spyOn(savePreparation, 'prepareState');
  });

  afterEach(() => {
    prepareSpy.mockRestore();
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
      expect(serializer.compressPreparedState).toHaveBeenCalledTimes(1);
      expect(prepareSpy).toHaveBeenCalledWith(
        name,
        state,
        serializer,
        expect.anything()
      );
      const passedObj = serializer.compressPreparedState.mock.calls[0][0];
      expect(passedObj.metadata.saveName).toBe(name);
      expect(passedObj.integrityChecks).toEqual({});
    });

    it('handles invalid save names', async () => {
      // Act
      const result = await service.saveManualGame('', {});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(PersistenceError);
      expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_SAVE_NAME);
      expect(storageProvider.writeFileAtomically).not.toHaveBeenCalled();
      expect(serializer.compressPreparedState).not.toHaveBeenCalled();
      expect(prepareSpy).not.toHaveBeenCalled();
    });
  });

  describe('loadGameData', () => {
    it('returns error when deserialization fails', async () => {
      // Arrange
      const path = 'saves/manual_saves/manual_save_bad.sav';
      storageProvider.readFile.mockResolvedValue(new Uint8Array([1]));
      serializer.decompressAndDeserialize.mockReturnValue({
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

    it('normalizes non-PersistenceError failures', async () => {
      // Arrange
      const path = 'saves/manual_saves/manual_save_bad.sav';
      storageProvider.readFile.mockResolvedValue(new Uint8Array([1]));
      serializer.decompressAndDeserialize.mockReturnValue({
        success: false,
        error: 'boom',
        userFriendlyError: 'Boom!',
      });

      // Act
      const result = await service.loadGameData(path);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(PersistenceError);
      expect(result.error.code).toBe(
        PersistenceErrorCodes.DESERIALIZATION_ERROR
      );
      expect(result.error.message).toBe('Boom!');
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
