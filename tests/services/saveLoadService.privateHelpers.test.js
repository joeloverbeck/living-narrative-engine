import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
} from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import pako from 'pako';
import { webcrypto } from 'crypto';

/**
 * @typedef {import('../../src/persistence/persistenceTypes.js').PersistenceResult<any>} PersistenceResult
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
  return {
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    storageProvider: {
      listFiles: jest.fn(),
      readFile: jest.fn(),
      writeFileAtomically: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      ensureDirectoryExists: jest.fn(),
    },
  };
}

describe('SaveLoadService private helper error propagation', () => {
  let logger;
  let storageProvider;
  let service;

  beforeEach(() => {
    ({ logger, storageProvider } = makeDeps());
    service = new SaveLoadService({
      logger,
      storageProvider,
      crypto: webcrypto,
    });
  });

  it('propagates readSaveFile errors', async () => {
    storageProvider.readFile.mockRejectedValue(new Error('read fail'));
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/Could not access/);
  });

  it('propagates empty file error', async () => {
    storageProvider.readFile.mockResolvedValue(new Uint8Array());
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/empty or cannot be read/);
  });

  it('propagates decompression errors', async () => {
    storageProvider.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/could not decompress/);
  });

  it('propagates deserialization errors', async () => {
    const badGzip = pako.gzip(new Uint8Array([1, 2, 3]));
    storageProvider.readFile.mockResolvedValue(badGzip);
    /** @type {PersistenceResult<any>} */
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/could not understand/);
  });
});

describe('SaveLoadService helper functions', () => {
  let logger;
  let storageProvider;
  let service;

  beforeEach(() => {
    ({ logger, storageProvider } = makeDeps());
    service = new SaveLoadService({
      logger,
      storageProvider,
      crypto: webcrypto,
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
    const slots = await service.listManualSaveSlots();
    expect(slots[0].saveName).toBe('TestFile (Corrupted)');
  });
});
