import {
  describe,
  beforeAll,
  beforeEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { webcrypto } from 'crypto';
import pako from 'pako';
import { decode, encode } from '@msgpack/msgpack';

import createSaveLoadService from '../../../src/persistence/createSaveLoadService.js';
import SaveLoadService from '../../../src/persistence/saveLoadService.js';
import { getManualSavePath } from '../../../src/utils/savePathUtils.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createStorageProvider = () => {
  const files = new Map();
  return {
    async writeFileAtomically(path, data) {
      const buffer =
        data instanceof Uint8Array
          ? new Uint8Array(data)
          : new Uint8Array(data);
      files.set(path, buffer);
      return { success: true };
    },
    async readFile(path) {
      const buffer = files.get(path);
      if (!buffer) {
        const error = new Error(`File not found: ${path}`);
        error.code = 'ENOENT';
        throw error;
      }
      return new Uint8Array(buffer);
    },
    async listFiles(directoryPath, patternSource) {
      const regex = new RegExp(patternSource);
      const prefix = `${directoryPath}/`;
      return Array.from(files.keys())
        .filter((path) => path.startsWith(prefix))
        .map((path) => path.slice(prefix.length))
        .filter((name) => regex.test(name));
    },
    async deleteFile(path) {
      if (!files.has(path)) {
        return { success: false, error: 'not found' };
      }
      files.delete(path);
      return { success: true };
    },
    async fileExists(path) {
      return files.has(path);
    },
    async ensureDirectoryExists() {
      return { success: true };
    },
    __getFile(path) {
      return files.get(path);
    },
  };
};

const buildGameState = () => ({
  metadata: {
    saveFormatVersion: '1.0.0',
    engineVersion: 'integration-test',
    gameTitle: 'Factory Integration Test',
    timestamp: '2024-01-01T00:00:00.000Z',
    playtimeSeconds: 42,
    saveName: '',
  },
  modManifest: {
    activeMods: [{ modId: 'core', version: '1.0.0' }],
  },
  gameState: {
    party: [{ id: 'hero', level: 5 }],
    world: { day: 3 },
  },
  integrityChecks: {},
});

describe('Integration: createSaveLoadService factory', () => {
  beforeAll(() => {
    Object.defineProperty(global, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  });

  let logger;
  let storageProvider;
  let saveLoadService;
  const saveName = 'FactorySlot';

  beforeEach(() => {
    logger = createLogger();
    storageProvider = createStorageProvider();
    saveLoadService = createSaveLoadService({
      logger,
      storageProvider,
      crypto: webcrypto,
    });
  });

  test('wires the persistence pipeline for manual save lifecycle', async () => {
    expect(saveLoadService).toBeInstanceOf(SaveLoadService);

    const state = buildGameState();
    const saveResult = await saveLoadService.saveManualGame(saveName, state);
    const expectedPath = getManualSavePath(saveName);

    expect(saveResult).toEqual({
      success: true,
      message: `Game saved as "${saveName}".`,
      filePath: expectedPath,
    });

    expect(await storageProvider.fileExists(expectedPath)).toBe(true);

    const listResult = await saveLoadService.listManualSaveSlots();
    expect(listResult.success).toBe(true);
    expect(listResult.data).toHaveLength(1);

    const [entry] = listResult.data;
    expect(entry).toMatchObject({
      identifier: expectedPath,
      saveName,
      timestamp: state.metadata.timestamp,
      playtimeSeconds: state.metadata.playtimeSeconds,
    });
    expect(entry.isCorrupted).toBeUndefined();

    const loadResult = await saveLoadService.loadGameData(expectedPath);
    expect(loadResult.success).toBe(true);
    expect(loadResult.data.metadata.saveName).toBe(saveName);
    expect(loadResult.data.metadata.gameTitle).toBe(state.metadata.gameTitle);
    expect(loadResult.data.gameState).toEqual(state.gameState);
    expect(loadResult.data.integrityChecks.gameStateChecksum).toEqual(
      expect.any(String)
    );

    const deleteResult = await saveLoadService.deleteManualSave(expectedPath);
    expect(deleteResult.success).toBe(true);
    expect(await storageProvider.fileExists(expectedPath)).toBe(false);
  });

  test('detects tampering through checksum validation when loading', async () => {
    const state = buildGameState();
    await saveLoadService.saveManualGame(saveName, state);
    const savePath = getManualSavePath(saveName);

    const storedBuffer = storageProvider.__getFile(savePath);
    expect(storedBuffer).toBeInstanceOf(Uint8Array);

    const decompressed = pako.ungzip(storedBuffer);
    const savedObject = decode(decompressed);
    savedObject.integrityChecks.gameStateChecksum = '0000';
    const tamperedBuffer = pako.gzip(encode(savedObject));
    await storageProvider.writeFileAtomically(savePath, tamperedBuffer);

    const loadResult = await saveLoadService.loadGameData(savePath);
    expect(loadResult.success).toBe(false);
    expect(loadResult.data).toBeNull();
    expect(loadResult.error.code).toBe(PersistenceErrorCodes.CHECKSUM_MISMATCH);
  });
});
