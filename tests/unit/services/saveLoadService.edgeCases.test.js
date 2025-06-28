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
import { encode } from '@msgpack/msgpack';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { StorageErrorCodes } from '../../../src/storage/storageErrors.js';
import pako from 'pako';
import { webcrypto } from 'crypto';
import SaveValidationService from '../../../src/persistence/saveValidationService.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';

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
  const saveValidationService = new SaveValidationService({
    logger,
    gameStateSerializer: serializer,
  });
  return {
    logger,
    storageProvider,
    serializer,
    saveFileRepository,
    saveValidationService,
  };
}

describe('SaveLoadService edge cases', () => {
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

  describe('private helper failures via saveManualGame', () => {
    it('propagates checksum generation failure', async () => {
      storageProvider.ensureDirectoryExists.mockResolvedValue();
      const digestSpy = jest
        .spyOn(webcrypto.subtle, 'digest')
        .mockRejectedValue(new Error('digest fail'));
      const obj = {
        metadata: {},
        modManifest: {},
        gameState: {},
        integrityChecks: {},
      };
      const result = await service.saveManualGame('Slot', obj);
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/Checksum generation failed/);
      expect(logger.error).toHaveBeenCalled();
      digestSpy.mockRestore();
    });

    it('handles deepClone failure', async () => {
      storageProvider.ensureDirectoryExists.mockResolvedValue();
      const cyc = {
        metadata: {},
        modManifest: {},
        gameState: {},
        integrityChecks: {},
      };
      cyc.self = cyc;
      const result = await service.saveManualGame('Loop', cyc);
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/deep clone/);
      expect(logger.error).toHaveBeenCalled();
    });

    it('throws on invalid gameState during serialization', async () => {
      storageProvider.ensureDirectoryExists.mockResolvedValue();
      const obj = { metadata: {}, modManifest: {}, integrityChecks: {} };
      const result = await service.saveManualGame('Bad', obj);
      expect(result.success).toBe(false);
      expect(result.error.message).toMatch(/Invalid gameState/);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deserializeAndDecompress failure scenarios via loadGameData', () => {
    const path = 'saves/manual_saves/test.sav';

    it('returns failure when file read fails', async () => {
      storageProvider.readFile.mockRejectedValue(new Error('read fail'));
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns failure for empty file', async () => {
      storageProvider.readFile.mockResolvedValue(new Uint8Array());
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('returns failure for gzip error', async () => {
      storageProvider.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns failure for msgpack decode error', async () => {
      const badGzip = pako.gzip(new Uint8Array([1, 2, 3]));
      storageProvider.readFile.mockResolvedValue(badGzip);
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('listManualSaveSlots corrupted files', () => {
    it('handles missing metadata section', async () => {
      const obj = { modManifest: {}, gameState: {}, integrityChecks: {} };
      const compressed = pako.gzip(encode(obj));
      storageProvider.listFiles.mockResolvedValue(['manual_save_slot1.sav']);
      storageProvider.readFile.mockResolvedValue(compressed);
      const result = await service.listManualSaveSlots();
      expect(result.data[0].isCorrupted).toBe(true);
      expect(result.data[0].saveName).toBe('slot1 (No Metadata)');
    });

    it('handles malformed metadata fields', async () => {
      const obj = {
        metadata: { saveName: '', timestamp: 0, playtimeSeconds: 'x' },
        modManifest: {},
        gameState: {},
        integrityChecks: {},
      };
      const compressed = pako.gzip(encode(obj));
      storageProvider.listFiles.mockResolvedValue(['manual_save_slot2.sav']);
      storageProvider.readFile.mockResolvedValue(compressed);
      const result = await service.listManualSaveSlots();
      expect(result.data[0].isCorrupted).toBe(true);
      expect(result.data[0].saveName).toBe('slot2 (Bad Metadata)');
    });

    it('marks slot corrupted when deserialization fails', async () => {
      storageProvider.listFiles.mockResolvedValue(['manual_save_bad.sav']);
      storageProvider.readFile.mockRejectedValue(new Error('read fail'));
      const result = await service.listManualSaveSlots();
      expect(result.data[0].isCorrupted).toBe(true);
      expect(result.data[0].saveName).toMatch(/Corrupted/);
    });
  });

  describe('loadGameData validation branches', () => {
    const path = 'saves/manual_saves/test.sav';

    it('fails on invalid identifier', async () => {
      const res = await service.loadGameData('');
      expect(res.success).toBe(false);
      expect(res.error.code).toBe(
        PersistenceErrorCodes.INVALID_SAVE_IDENTIFIER
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('fails when required section missing', async () => {
      const obj = { metadata: {}, gameState: {}, integrityChecks: {} };
      const compressed = pako.gzip(encode(obj));
      storageProvider.readFile.mockResolvedValue(compressed);
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('fails when checksum missing', async () => {
      const obj = {
        metadata: {},
        modManifest: {},
        gameState: {},
        integrityChecks: {},
      };
      const compressed = pako.gzip(encode(obj));
      storageProvider.readFile.mockResolvedValue(compressed);
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('fails on checksum mismatch', async () => {
      const obj = {
        metadata: {},
        modManifest: {},
        gameState: { a: 1 },
        integrityChecks: {},
      };
      const checksum = await webcrypto.subtle.digest(
        'SHA-256',
        encode(obj.gameState)
      );
      obj.integrityChecks.gameStateChecksum = Array.from(
        new Uint8Array(checksum)
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      // tamper checksum
      obj.integrityChecks.gameStateChecksum =
        obj.integrityChecks.gameStateChecksum.replace(/^./, '0');
      const compressed = pako.gzip(encode(obj));
      storageProvider.readFile.mockResolvedValue(compressed);
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('fails when checksum calculation throws', async () => {
      const obj = {
        metadata: {},
        modManifest: {},
        gameState: { a: 1 },
        integrityChecks: {},
      };
      const checksum = await webcrypto.subtle.digest(
        'SHA-256',
        encode(obj.gameState)
      );
      obj.integrityChecks.gameStateChecksum = Array.from(
        new Uint8Array(checksum)
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const compressed = pako.gzip(encode(obj));
      storageProvider.readFile.mockResolvedValue(compressed);
      const digestSpy = jest
        .spyOn(webcrypto.subtle, 'digest')
        .mockRejectedValue(new Error('calc fail'));
      const res = await service.loadGameData(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
      digestSpy.mockRestore();
    });
  });

  describe('saveManualGame additional branches', () => {
    it('handles directory creation failure', async () => {
      storageProvider.ensureDirectoryExists.mockRejectedValue(
        new Error('mkdir fail')
      );
      const obj = {
        metadata: {},
        modManifest: {},
        gameState: {},
        integrityChecks: {},
      };
      const res = await service.saveManualGame('Dir', obj);
      expect(res.success).toBe(false);
      expect(res.error.message).toMatch(/Failed to create save directory/);
      expect(logger.error).toHaveBeenCalled();
    });

    it('handles disk full error', async () => {
      storageProvider.ensureDirectoryExists.mockResolvedValue();
      storageProvider.writeFileAtomically.mockResolvedValue({
        success: false,
        error: 'disk full',
        code: StorageErrorCodes.DISK_FULL,
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

    it('handles write failure rejection', async () => {
      storageProvider.ensureDirectoryExists.mockResolvedValue();
      storageProvider.writeFileAtomically.mockRejectedValue(
        new Error('fs fail')
      );
      const obj = {
        metadata: {},
        modManifest: {},
        gameState: {},
        integrityChecks: {},
      };
      const res = await service.saveManualGame('Reject', obj);
      expect(res.success).toBe(false);
      expect(res.error.message).toBe('fs fail');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteManualSave branches', () => {
    const path = 'saves/manual_saves/test.sav';

    it('rejects invalid identifier', async () => {
      const res = await service.deleteManualSave('');
      expect(res.success).toBe(false);
      expect(res.error.code).toBe(
        PersistenceErrorCodes.INVALID_SAVE_IDENTIFIER
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('handles missing file', async () => {
      storageProvider.fileExists.mockResolvedValue(false);
      const res = await service.deleteManualSave(path);
      expect(res.success).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('propagates deletion failure', async () => {
      storageProvider.fileExists.mockResolvedValue(true);
      storageProvider.deleteFile.mockResolvedValue({
        success: false,
        error: 'perm',
      });
      const res = await service.deleteManualSave(path);
      expect(res.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
