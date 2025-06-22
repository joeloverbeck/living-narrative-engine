import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
} from '@jest/globals';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import {
  MSG_FILE_READ_ERROR,
  MSG_EMPTY_FILE,
  MSG_DECOMPRESSION_FAILED,
  MSG_DESERIALIZATION_FAILED,
} from '../../../src/persistence/persistenceMessages.js';
import pako from 'pako';
import { webcrypto } from 'crypto';
import { createMockSaveValidationService } from '../testUtils.js';

/**
 * @typedef {import('../../../src/persistence/persistenceTypes.js').PersistenceResult<any>} PersistenceResult
 */

beforeAll(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  }
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
});

/**
 * Creates mocked dependencies for SaveLoadService.
 *
 * @returns {object} Mocked dependencies
 */
function makeDeps() {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const storageProvider = {
    listFiles: jest.fn(),
    readFile: jest.fn(),
    writeFileAtomically: jest.fn(),
    deleteFile: jest.fn(),
    fileExists: jest.fn(),
    ensureDirectoryExists: jest.fn(),
  };
  const serializer = new GameStateSerializer({ logger, crypto: webcrypto });
  const parser = new SaveFileParser({ logger, storageProvider, serializer });
  const saveFileRepository = new SaveFileRepository({
    logger,
    storageProvider,
    serializer,
    parser,
  });
  return {
    logger,
    storageProvider,
    serializer,
    saveFileRepository,
    saveValidationService: createMockSaveValidationService(),
  };
}

describe('SaveLoadService private helper error propagation', () => {
  let logger;
  let storageProvider;
  let serializer;
  let saveFileRepository;
  let saveValidationService;
  let service;

  beforeEach(() => {
    ({
      logger,
      storageProvider,
      saveFileRepository,
      serializer,
      saveValidationService,
    } = makeDeps());
    service = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService,
    });
  });

  it('propagates readSaveFile errors', async () => {
    storageProvider.readFile.mockRejectedValue(new Error('read fail'));
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toBe(MSG_FILE_READ_ERROR);
  });

  it('propagates empty file error', async () => {
    storageProvider.readFile.mockResolvedValue(new Uint8Array());
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toBe(MSG_EMPTY_FILE);
  });

  it('propagates decompression errors', async () => {
    storageProvider.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toBe(MSG_DECOMPRESSION_FAILED);
  });

  it('propagates deserialization errors', async () => {
    const badGzip = pako.gzip(new Uint8Array([1, 2, 3]));
    storageProvider.readFile.mockResolvedValue(badGzip);
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toBe(MSG_DESERIALIZATION_FAILED);
  });
});

describe('SaveLoadService helper functions', () => {
  let logger;
  let storageProvider;
  let serializer;
  let saveFileRepository;
  let saveValidationService;
  let service;

  beforeEach(() => {
    ({
      logger,
      storageProvider,
      serializer,
      saveFileRepository,
      saveValidationService,
    } = makeDeps());
    service = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService,
    });
  });

  it('sanitizes manual save file names', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    storageProvider.writeFileAtomically.mockResolvedValue({ success: true });
    await service.saveManualGame('Bad Name*?', { gameState: {} });
    expect(storageProvider.writeFileAtomically).toHaveBeenCalledWith(
      'saves/manual_saves/manual_save_Bad_Name__.sav',
      expect.anything()
    );
  });

  it('extracts save name for corrupted files', async () => {
    storageProvider.listFiles.mockResolvedValue(['manual_save_TestFile.sav']);
    storageProvider.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const result = await service.listManualSaveSlots();
    expect(result.data[0].saveName).toBe('TestFile (Corrupted)');
  });
});

describe('SaveLoadService new private helper error paths', () => {
  let logger;
  let storageProvider;
  let serializer;
  let saveFileRepository;
  let saveValidationService;
  let service;

  beforeEach(() => {
    ({
      logger,
      storageProvider,
      serializer,
      saveFileRepository,
      saveValidationService,
    } = makeDeps());
    service = new SaveLoadService({
      logger,
      saveFileRepository,
      gameStateSerializer: serializer,
      saveValidationService,
    });
  });

  it('fails when ensureDirectoryExists rejects', async () => {
    storageProvider.ensureDirectoryExists.mockRejectedValue(
      new Error('mkdir fail')
    );
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    const res = await service.saveManualGame('Slot', obj);
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/Failed to create save directory/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails when deep clone throws', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    const cyc = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    cyc.self = cyc;
    const res = await service.saveManualGame('Loop', cyc);
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/deep clone/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('fails when writeFileAtomically returns failure', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    storageProvider.writeFileAtomically.mockResolvedValue({
      success: false,
      error: 'disk full',
    });
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    const res = await service.saveManualGame('Disk', obj);
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/Not enough disk space/);
    expect(logger.error).toHaveBeenCalled();
  });
});
