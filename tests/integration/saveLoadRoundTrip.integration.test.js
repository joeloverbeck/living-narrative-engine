import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import SaveLoadService from '../../src/persistence/saveLoadService.js';
import GamePersistenceService from '../../src/persistence/gamePersistenceService.js';
import receptionistDef from '../../data/mods/isekai/characters/receptionist.character.json';
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

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates an in-memory storage provider implementation for testing.
 *
 * @returns {import('../../src/interfaces/IStorageProvider.js').IStorageProvider} In-memory provider
 */
const createMemoryStorageProvider = () => {
  const files = {};
  return {
    writeFileAtomically: jest.fn(async (path, data) => {
      files[path] = data;
      return { success: true };
    }),
    readFile: jest.fn(async (path) => files[path]),
    listFiles: jest.fn(async () => Object.keys(files)),
    deleteFile: jest.fn(async (path) => {
      delete files[path];
      return { success: true };
    }),
    fileExists: jest.fn(async (path) => path in files),
    ensureDirectoryExists: jest.fn(async () => {}),
  };
};

const makeEntity = (id, def) => ({
  id,
  definitionId: def.id,
  componentEntries: new Map(Object.entries(def.components)),
});

describe('Persistence round-trip', () => {
  let logger;
  let storageProvider;
  let saveLoadService;
  let entityManager;
  let dataRegistry;
  let playtimeTracker;
  let persistence;
  let entity;
  const saveName = 'RoundTripTest';

  beforeEach(() => {
    logger = makeLogger();
    storageProvider = createMemoryStorageProvider();
    saveLoadService = new SaveLoadService({ logger, storageProvider });

    entity = makeEntity('e1', receptionistDef);

    entityManager = {
      activeEntities: new Map([[entity.id, entity]]),
      clearAll: jest.fn(() => {
        entityManager.activeEntities.clear();
      }),
      reconstructEntity: jest.fn((data) => {
        const restored = makeEntity(data.instanceId, {
          id: data.definitionId,
          components: data.components,
        });
        entityManager.activeEntities.set(restored.id, restored);
        return restored;
      }),
    };

    dataRegistry = {
      getAll: jest.fn().mockReturnValue([{ id: 'core', version: '1.0.0' }]),
    };
    playtimeTracker = {
      getTotalPlaytime: jest.fn().mockReturnValue(0),
      setAccumulatedPlaytime: jest.fn(),
    };

    persistence = new GamePersistenceService({
      logger,
      saveLoadService,
      entityManager,
      dataRegistry,
      playtimeTracker,
      container: {},
    });
  });

  test('entity with many components survives save and load', async () => {
    const saveResult = await persistence.saveGame(saveName, true, 'TestWorld');
    expect(saveResult.success).toBe(true);

    // ensure the file was written
    const filePath = `saves/manual_saves/manual_save_${saveName}.sav`;
    expect(storageProvider.writeFileAtomically).toHaveBeenCalledWith(
      filePath,
      expect.any(Uint8Array)
    );

    // wipe entities before load
    entityManager.activeEntities.clear();

    const loadResult = await persistence.loadAndRestoreGame(filePath);
    expect(loadResult.success).toBe(true);

    const restored = entityManager.activeEntities.get('e1');
    expect(restored).toBeDefined();
    expect(restored.definitionId).toBe(entity.definitionId);
    const originalComponents = Object.fromEntries(entity.componentEntries);
    const expectedComponents = Object.fromEntries(
      Object.entries(originalComponents).filter(([key, value]) => {
        if (key === 'core:current_actor') return false;
        if (value === null || typeof value !== 'object') return true;
        return Object.keys(value).length > 0;
      })
    );
    const restoredComponents = Object.fromEntries(restored.componentEntries);
    expect(restoredComponents).toEqual(expectedComponents);
  });
});
