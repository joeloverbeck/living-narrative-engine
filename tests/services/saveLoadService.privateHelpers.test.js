import { describe, it, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import pako from 'pako';
import { webcrypto } from 'crypto';

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

describe('SaveLoadService private helper error propagation', () => {
  let logger;
  let storageProvider;
  let service;

  beforeEach(() => {
    ({ logger, storageProvider } = makeDeps());
    service = new SaveLoadService({ logger, storageProvider });
  });

  it('propagates readSaveFile errors', async () => {
    storageProvider.readFile.mockRejectedValue(new Error('read fail'));
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Could not access/);
  });

  it('propagates empty file error', async () => {
    storageProvider.readFile.mockResolvedValue(new Uint8Array());
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/empty or cannot be read/);
  });

  it('propagates decompression errors', async () => {
    storageProvider.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/could not decompress/);
  });

  it('propagates deserialization errors', async () => {
    const badGzip = pako.gzip(new Uint8Array([1, 2, 3]));
    storageProvider.readFile.mockResolvedValue(badGzip);
    const res = await service.loadGameData('saves/manual_saves/test.sav');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/could not understand/);
  });
});
