/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import SaveFileRepository from '../../../src/persistence/saveFileRepository.js';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import { encode, decode } from '@msgpack/msgpack';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { StorageErrorCodes } from '../../../src/storage/storageErrors.js';
import pako from 'pako';
import { webcrypto } from 'crypto';
import { createMockSaveValidationService } from '../testUtils.js';

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
 *
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
  const checksumService = new ChecksumService({ logger, crypto: webcrypto });
  const serializer = new GameStateSerializer({ logger, checksumService });
  const parser = new SaveFileParser({ logger, storageProvider, serializer });
  const saveFileRepository = new SaveFileRepository({
    logger,
    storageProvider,
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

describe('SaveLoadService additional coverage', () => {
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

  it('returns empty list when directory missing', async () => {
    const err = new Error('not found');
    err.code = StorageErrorCodes.FILE_NOT_FOUND;
    storageProvider.listFiles.mockRejectedValue(err);
    const result = await service.listManualSaveSlots();
    expect(result).toEqual({ success: true, data: [] });
    expect(logger.debug).toHaveBeenCalled();
  });

  it('parses valid save metadata', async () => {
    const obj = {
      metadata: { saveName: 'Slot1', timestamp: 't', playtimeSeconds: 1 },
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    const compressed = pako.gzip(encode(obj));
    storageProvider.listFiles.mockResolvedValue(['manual_save_Slot1.sav']);
    storageProvider.readFile.mockResolvedValue(compressed);

    const result = await service.listManualSaveSlots();
    expect(result.data).toEqual([
      {
        identifier: 'saves/manual_saves/manual_save_Slot1.sav',
        saveName: 'Slot1',
        timestamp: 't',
        playtimeSeconds: 1,
      },
    ]);
  });

  it('loadGameData validates identifier', async () => {
    const res = await service.loadGameData('');
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(PersistenceErrorCodes.INVALID_SAVE_IDENTIFIER);
    expect(res.data).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('loadGameData returns data on success', async () => {
    const obj = {
      metadata: { saveName: 'Slot1', timestamp: 't', playtimeSeconds: 1 },
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    const checksumBuffer = await webcrypto.subtle.digest(
      'SHA-256',
      encode(obj.gameState)
    );
    obj.integrityChecks.gameStateChecksum = Array.from(
      new Uint8Array(checksumBuffer)
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const compressed = pako.gzip(encode(obj));
    storageProvider.readFile.mockResolvedValue(compressed);
    const res = await service.loadGameData(
      'saves/manual_saves/manual_save_Slot1.sav'
    );
    expect(res).toEqual({ success: true, data: obj });
  });

  it('saveManualGame validates name', async () => {
    const res = await service.saveManualGame('', {});
    expect(res.success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('saveManualGame writes file when successful', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    storageProvider.writeFileAtomically.mockResolvedValue({ success: true });
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    const res = await service.saveManualGame('Test', obj);
    expect(storageProvider.writeFileAtomically).toHaveBeenCalled();
    expect(res.success).toBe(true);
  });

  it('does not mutate the provided game state object', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    storageProvider.writeFileAtomically.mockResolvedValue({ success: true });
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: { level: 1 },
    };
    const original = JSON.stringify(obj);
    await service.saveManualGame('NoMutate', obj);
    expect(JSON.stringify(obj)).toBe(original);
  });

  it('deepClone returns primitive values unchanged', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    let written;
    storageProvider.writeFileAtomically.mockImplementation((path, data) => {
      written = data;
      return { success: true };
    });
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: { level: 1 },
      primitive: 42,
    };
    const res = await service.saveManualGame('Prim', obj);
    expect(res.success).toBe(true);
    const saved = decode(pako.ungzip(written));
    expect(saved.primitive).toBe(42);
  });

  it('creates integrityChecks when absent on manual save', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    let written;
    storageProvider.writeFileAtomically.mockImplementation((p, d) => {
      written = d;
      return { success: true };
    });
    const obj = {
      metadata: {},
      modManifest: {},
      gameState: { a: 1 },
    };
    const res = await service.saveManualGame('NoIntegrity', obj);
    expect(res.success).toBe(true);
    const finalObj = decode(pako.ungzip(written));
    expect(finalObj.integrityChecks).toBeDefined();
    const buffer = await webcrypto.subtle.digest(
      'SHA-256',
      encode(obj.gameState)
    );
    const expected = Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(finalObj.integrityChecks.gameStateChecksum).toBe(expected);
  });

  it('deleteManualSave handles missing file', async () => {
    storageProvider.fileExists.mockResolvedValue(false);
    const res = await service.deleteManualSave('saves/manual_saves/x.sav');
    expect(res.success).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('deleteManualSave removes file when present', async () => {
    storageProvider.fileExists.mockResolvedValue(true);
    storageProvider.deleteFile.mockResolvedValue({ success: true });
    const res = await service.deleteManualSave('saves/manual_saves/x.sav');
    expect(storageProvider.deleteFile).toHaveBeenCalledWith(
      'saves/manual_saves/x.sav'
    );
    expect(res.success).toBe(true);
  });
});
