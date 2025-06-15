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
import { TextEncoder, TextDecoder } from 'util';

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
  return {
    logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
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

describe('SaveLoadService error paths', () => {
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
    global.encodeMock = jest.fn();
    global.decodeMock = jest.fn();
  });

  it('logs error when listFiles fails with non-not-found', async () => {
    storageProvider.listFiles.mockRejectedValue(new Error('permission'));
    const slots = await service.listManualSaveSlots();
    expect(slots).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('handles deleteFile throwing exception', async () => {
    storageProvider.fileExists.mockResolvedValue(true);
    storageProvider.deleteFile.mockRejectedValue(new Error('fs failure'));
    const res = await service.deleteManualSave('saves/manual_saves/bad.sav');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unexpected error/i);
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
    const res = await service.saveManualGame('Loop', cyc);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/deep clone/i);
    expect(logger.error).toHaveBeenCalled();
  });
});
