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
import ChecksumService from '../../../src/persistence/checksumService.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import pako from 'pako';
import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';
import { createMockSaveValidationService } from '../testUtils.js';

/**
 * @typedef {import('../../../src/persistence/persistenceTypes.js').PersistenceResult<any>} PersistenceResult
 */

jest.mock('@msgpack/msgpack', () => {
  global.encodeMock = jest.fn();
  global.decodeMock = jest.fn();
  return {
    encode: (...args) => global.encodeMock(...args),
    decode: (...args) => global.decodeMock(...args),
  };
});

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

describe('SaveLoadService error paths', () => {
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
    global.encodeMock = jest.fn();
    global.decodeMock = jest.fn();
  });

  it('logs error when listFiles fails with non-not-found', async () => {
    storageProvider.listFiles.mockRejectedValue(new Error('permission'));
    const result = await service.listManualSaveSlots();
    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('handles deleteFile throwing exception', async () => {
    storageProvider.fileExists.mockResolvedValue(true);
    storageProvider.deleteFile.mockRejectedValue(new Error('fs failure'));
    /** @type {PersistenceResult<any>} */
    const res = await service.deleteManualSave('saves/manual_saves/bad.sav');
    expect(res.success).toBe(false);
    expect(res.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(res.error.message).toBe('fs failure');
    expect(logger.error).toHaveBeenCalled();
  });

  it('generateChecksum processes non-Uint8Array input', async () => {
    const te = new TextEncoder();
    const td = new TextDecoder();
    const gameStateString = 'dummy';

    global.encodeMock.mockImplementation((obj) => {
      if (obj && obj.isGameState) return gameStateString;
      return te.encode(JSON.stringify(obj));
    });
    global.decodeMock.mockImplementation((buf) => JSON.parse(td.decode(buf)));

    storageProvider.ensureDirectoryExists.mockResolvedValue();
    let written;
    storageProvider.writeFileAtomically.mockImplementation((path, data) => {
      written = data;
      return { success: true };
    });

    const obj = {
      metadata: {},
      modManifest: {},
      gameState: { isGameState: true },
      integrityChecks: {},
    };
    /** @type {PersistenceResult<any>} */
    const result = await service.saveManualGame('Slot', obj);
    expect(result.success).toBe(true);

    const decompressed = pako.ungzip(written);
    const finalObj = global.decodeMock(decompressed);
    const hashBuffer = await webcrypto.subtle.digest(
      'SHA-256',
      te.encode(gameStateString)
    );
    const expected = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(finalObj.integrityChecks.gameStateChecksum).toBe(expected);
  });

  it('fails to save circular object due to deepClone', async () => {
    storageProvider.ensureDirectoryExists.mockResolvedValue();
    const cyc = {
      metadata: {},
      modManifest: {},
      gameState: {},
      integrityChecks: {},
    };
    cyc.self = cyc;
    /** @type {PersistenceResult<any>} */
    const res = await service.saveManualGame('Loop', cyc);
    expect(res.success).toBe(false);
    expect(res.error.message).toMatch(/deep clone/i);
    expect(logger.error).toHaveBeenCalled();
  });
});
