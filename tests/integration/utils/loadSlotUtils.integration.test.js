import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { webcrypto } from 'crypto';

import {
  compareLoadSlots,
  fetchAndFormatLoadSlots,
} from '../../../src/utils/loadSlotUtils.js';
import { formatSaveFileMetadata } from '../../../src/domUI/helpers/slotDataFormatter.js';
import createSaveLoadService from '../../../src/persistence/createSaveLoadService.js';
import { getManualSavePath } from '../../../src/utils/savePathUtils.js';

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
  };
};

const buildGameState = ({
  timestamp,
  playtimeSeconds,
  gameTitle = 'Integration Test World',
}) => ({
  metadata: {
    saveFormatVersion: '1.0.0',
    engineVersion: 'integration-test',
    gameTitle,
    timestamp,
    playtimeSeconds,
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

describe('Integration: loadSlotUtils with persistence pipeline', () => {
  let originalCrypto;

  beforeAll(() => {
    originalCrypto = global.crypto;
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  });

  afterAll(() => {
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  let logger;
  let storageProvider;
  let saveLoadService;

  beforeEach(() => {
    logger = createLogger();
    storageProvider = createStorageProvider();
    saveLoadService = createSaveLoadService({
      logger,
      storageProvider,
      crypto: webcrypto,
    });
  });

  it('sorts and formats slots returned by SaveLoadService while deferring corrupted entries', async () => {
    const alphaState = buildGameState({
      timestamp: '2024-05-01T12:00:00.000Z',
      playtimeSeconds: 360,
    });
    const betaState = buildGameState({
      timestamp: '2024-06-15T09:30:00.000Z',
      playtimeSeconds: 540,
    });

    await saveLoadService.saveManualGame('AlphaSlot', alphaState);
    await saveLoadService.saveManualGame('BetaSlot', betaState);

    const corruptedLatePath = getManualSavePath('CorruptZ');
    await storageProvider.writeFileAtomically(
      corruptedLatePath,
      new Uint8Array([1, 2, 3, 4])
    );
    const corruptedEarlyPath = getManualSavePath('CorruptA');
    await storageProvider.writeFileAtomically(
      corruptedEarlyPath,
      new Uint8Array([5, 6, 7, 8])
    );

    const adapter = {
      async listManualSaveSlots() {
        const result = await saveLoadService.listManualSaveSlots();
        if (!result.success) {
          throw result.error;
        }
        return result.data;
      },
    };

    const formattedSlots = await fetchAndFormatLoadSlots(adapter);

    expect(formattedSlots).toHaveLength(4);

    const rawResult = await saveLoadService.listManualSaveSlots();
    const expectedOrder = [...rawResult.data].sort(compareLoadSlots);

    expect(formattedSlots.map((slot) => slot.identifier)).toEqual(
      expectedOrder.map((slot) => slot.identifier)
    );

    expectedOrder.forEach((entry, index) => {
      expect(formattedSlots[index]).toMatchObject({
        identifier: entry.identifier,
        saveName: entry.saveName,
        slotItemMeta: formatSaveFileMetadata(entry),
      });
    });

    const nonCorrupted = formattedSlots.filter(
      (slot) => !slot.slotItemMeta.isCorrupted
    );
    expect(nonCorrupted.map((slot) => slot.identifier)).toEqual([
      getManualSavePath('BetaSlot'),
      getManualSavePath('AlphaSlot'),
    ]);

    const corrupted = formattedSlots.filter(
      (slot) => slot.slotItemMeta.isCorrupted
    );
    expect(corrupted).toHaveLength(2);
    expect(
      corrupted[0].slotItemMeta.name <= corrupted[1].slotItemMeta.name
    ).toBe(true);
    expect(corrupted[0].slotItemMeta.timestamp).toBe('Timestamp: N/A');
  });

  it('handles metadata that throws during timestamp conversion without crashing', async () => {
    const explosiveTimestamp = {
      [Symbol.toPrimitive]() {
        throw new Error('timestamp conversion failed');
      },
    };

    const serviceWithWeirdData = {
      async listManualSaveSlots() {
        return [
          {
            identifier: 'slot-1',
            saveName: 'Slot One',
            timestamp: explosiveTimestamp,
            playtimeSeconds: 120,
            isCorrupted: false,
          },
          {
            identifier: 'slot-2',
            saveName: 'Slot Two',
            timestamp: '2024-01-02T00:00:00.000Z',
            playtimeSeconds: 240,
            isCorrupted: false,
          },
        ];
      },
    };

    const slots = await fetchAndFormatLoadSlots(serviceWithWeirdData);

    expect(slots).toHaveLength(2);
    // Slot Two comes first because it has a valid timestamp
    // Slot One comes second because its explosive timestamp isn't a string, so it gets NaN
    expect(slots[0].slotItemMeta.name).toBe('Slot Two');
    expect(slots[1].slotItemMeta.name).toBe('Slot One');
    expect(slots[1].slotItemMeta.timestamp).toBe('Saved: Invalid Date');
  });
});
