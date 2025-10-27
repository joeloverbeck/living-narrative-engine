import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { webcrypto } from 'crypto';
import SaveFileParser from '../../../src/persistence/saveFileParser.js';
import GameStateSerializer from '../../../src/persistence/gameStateSerializer.js';
import ChecksumService from '../../../src/persistence/checksumService.js';
import {
  manualSavePath,
  buildManualFileName,
  FULL_MANUAL_SAVE_DIRECTORY_PATH,
} from '../../../src/utils/savePathUtils.js';
import { CHECKSUM_PENDING } from '../../../src/constants/persistence.js';
import { ENGINE_VERSION } from '../../../src/engine/engineVersion.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../src/logging/consoleLogger.js';
import createMemoryStorageProvider from '../../common/mockFactories/memoryStorageProvider.js';

const baseMetadata = {
  saveFormatVersion: '1.0.0',
  engineVersion: ENGINE_VERSION,
  gameTitle: 'Integration World',
  timestamp: '2024-02-03T04:05:06.789Z',
  playtimeSeconds: 654,
  saveName: 'TestSlot',
};

const baseGameState = {
  entities: [
    {
      instanceId: 'hero-1',
      definitionId: 'core:hero',
      overrides: {
        'core:position': { x: 10, y: 20 },
      },
    },
  ],
};

const baseModManifest = {
  activeMods: [
    { modId: 'core', version: '1.0.0' },
    { modId: 'expansion', version: '2.0.0' },
  ],
};

const baseIntegrityChecks = {
  gameStateChecksum: CHECKSUM_PENDING,
};

describe('SaveFileParser integration', () => {
  const originalCrypto = globalThis.crypto;
  /** @type {ReturnType<typeof createMemoryStorageProvider>} */
  let storageProvider;
  /** @type {ConsoleLogger} */
  let logger;
  /** @type {GameStateSerializer} */
  let serializer;
  /** @type {SaveFileParser} */
  let parser;
  /** @type {ReturnType<typeof jest.spyOn>[]} */
  let consoleSpies;

  beforeAll(() => {
    globalThis.crypto = webcrypto;
  });

  afterAll(() => {
    globalThis.crypto = originalCrypto;
  });

  beforeEach(() => {
    consoleSpies = [
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
      jest.spyOn(console, 'table').mockImplementation(() => {}),
      jest.spyOn(console, 'group').mockImplementation(() => {}),
      jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {}),
      jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
    ];

    storageProvider = createMemoryStorageProvider();
    logger = new ConsoleLogger(LogLevel.ERROR);
    const checksumService = new ChecksumService({
      logger,
      crypto: webcrypto,
    });
    serializer = new GameStateSerializer({ logger, checksumService });
    parser = new SaveFileParser({
      logger,
      storageProvider,
      serializer,
    });
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  /**
   * Deep clones simple values for predictable mutation-free operations.
   *
   * @template T
   * @param {T} value
   * @returns {T}
   */
  function clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * Builds a save object used by the serializer.
   *
   * @param {object} [options]
   * @param {object|null} [options.metadata]
   * @param {object} [options.gameState]
   * @param {object} [options.modManifest]
   * @param {object} [options.integrityChecks]
   * @returns {object}
   */
  function buildSaveObject({
    metadata: metadataOverride,
    gameState: gameStateOverride,
    modManifest: modManifestOverride,
    integrityChecks: integrityOverride,
  } = {}) {
    const metadata =
      metadataOverride === undefined
        ? clone(baseMetadata)
        : metadataOverride === null
        ? null
        : clone({ ...baseMetadata, ...metadataOverride });

    return {
      metadata,
      gameState:
        gameStateOverride === undefined
          ? clone(baseGameState)
          : clone(gameStateOverride),
      modManifest:
        modManifestOverride === undefined
          ? clone(baseModManifest)
          : clone(modManifestOverride),
      integrityChecks:
        integrityOverride === undefined
          ? clone(baseIntegrityChecks)
          : clone(integrityOverride),
    };
  }

  /**
   * Serializes and writes a manual save file to the storage provider.
   *
   * @param {string} fileName
   * @param {Parameters<typeof buildSaveObject>[0]} [overrides]
   * @returns {Promise<{filePath: string, finalSaveObject: object}>}
   */
  async function writeManualSave(fileName, overrides) {
    const saveObject = buildSaveObject(overrides ?? {});
    const { compressedData, finalSaveObject } =
      await serializer.serializeAndCompress(saveObject);
    const filePath = manualSavePath(fileName);
    await storageProvider.ensureDirectoryExists(
      FULL_MANUAL_SAVE_DIRECTORY_PATH
    );
    await storageProvider.writeFileAtomically(filePath, compressedData);
    return { filePath, finalSaveObject };
  }

  test('parses a real manual save and exposes metadata and decompressed data', async () => {
    const fileName = buildManualFileName('TestSlot');
    const { filePath, finalSaveObject } = await writeManualSave(fileName);

    const metadataResult = await parser.parseManualSaveFile(fileName);
    expect(metadataResult).toEqual({
      metadata: {
        identifier: filePath,
        saveName: 'TestSlot',
        timestamp: finalSaveObject.metadata.timestamp,
        playtimeSeconds: finalSaveObject.metadata.playtimeSeconds,
      },
      isCorrupted: false,
    });

    const readResult = await parser.readParsedSaveObject(filePath);
    expect(readResult.success).toBe(true);
    expect(readResult.data).toEqual(finalSaveObject);
  });

  test('flags metadata with missing fields while still surfacing sanitized values', async () => {
    const fileName = buildManualFileName('BadMeta');
    const { filePath } = await writeManualSave(fileName, {
      metadata: {
        saveName: '',
        timestamp: '',
        playtimeSeconds: 'oops',
      },
    });

    const result = await parser.parseManualSaveFile(fileName);
    expect(result).toEqual({
      metadata: {
        identifier: filePath,
        saveName: 'BadMeta (Bad Metadata)',
        timestamp: 'N/A',
        playtimeSeconds: 0,
      },
      isCorrupted: true,
    });
  });

  test('marks saves without metadata sections as corrupted', async () => {
    const fileName = buildManualFileName('NoMetadata');
    const { filePath } = await writeManualSave(fileName, {
      metadata: null,
    });

    const result = await parser.parseManualSaveFile(fileName);
    expect(result).toEqual({
      metadata: {
        identifier: filePath,
        saveName: 'NoMetadata (No Metadata)',
        timestamp: 'N/A',
        playtimeSeconds: 0,
      },
      isCorrupted: true,
    });
  });

  test('marks files that fail to decompress as corrupted', async () => {
    const fileName = buildManualFileName('Broken');
    const filePath = manualSavePath(fileName);
    await storageProvider.ensureDirectoryExists(
      FULL_MANUAL_SAVE_DIRECTORY_PATH
    );
    const invalidPayload = new TextEncoder().encode('not-a-valid-save');
    await storageProvider.writeFileAtomically(filePath, invalidPayload);

    const result = await parser.parseManualSaveFile(fileName);
    expect(result).toEqual({
      metadata: {
        identifier: filePath,
        saveName: 'Broken (Corrupted)',
        timestamp: 'N/A',
        playtimeSeconds: 0,
      },
      isCorrupted: true,
    });
  });

  test('rejects blank manual save names before touching storage', async () => {
    const result = await parser.parseManualSaveFile('');
    expect(result).toEqual({
      metadata: {
        identifier: manualSavePath(''),
        saveName: 'Unknown Save (Invalid Name)',
        timestamp: 'N/A',
        playtimeSeconds: 0,
      },
      isCorrupted: true,
    });
    expect(storageProvider.readFile).not.toHaveBeenCalled();
  });
});
